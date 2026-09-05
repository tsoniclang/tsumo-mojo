import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const [outputDirectory, publishPath, platformDirectory] = process.argv.slice(2);
if (outputDirectory === undefined || publishPath === undefined || platformDirectory === undefined) {
  throw new Error("Usage: build-generated-project.mjs <generated-root> <published-artifact> <platform-root>");
}
const root = resolve(outputDirectory);
const manifest = JSON.parse(readFileSync(resolve(root, "mojo-native-build.json"), "utf8"));
if (manifest.schemaVersion !== 2 || manifest.toolchain.commandEnvironment !== "posix") {
  throw new Error("Expected the current POSIX Mojo native build contract.");
}
const condaPrefix = process.env.CONDA_PREFIX;
if (condaPrefix === undefined) throw new Error("The user-owned Pixi environment must be active.");
const compilerVersion = run("mojo", ["--version"], true).trim();
if (!compilerVersion.split(/\s+/u).includes(manifest.toolchain.compilerVersion)) {
  throw new Error(`Mojo compiler '${compilerVersion}' does not match '${manifest.toolchain.compilerVersion}'.`);
}
const jobs = process.env.TSUMO_MOJO_JOBS ?? "1";
if (!/^[1-9][0-9]*$/u.test(jobs)) throw new Error("TSUMO_MOJO_JOBS must be a positive integer.");

const linkArguments = [];
for (const package_ of manifest.packages) {
  for (const unit of package_.translationUnits) {
    if (unit.standard !== "c11") throw new Error("Unsupported native C dialect.");
    const output = within(root, unit.objectPath);
    mkdirSync(dirname(output), { recursive: true });
    const staging = `${output}.${process.pid}.pending`;
    run(manifest.toolchain.cCompiler, [
      "-O3", "-fPIC", "-std=c11", `-I${resolve(condaPrefix, "include")}`,
      ...package_.includeDirectories.map((directory) => `-I${within(condaPrefix, directory)}`),
      "-c", within(root, unit.sourcePath), "-o", staging,
    ]);
    renameSync(staging, output);
    linkArguments.push("-Xlinker", output);
  }
}
for (const directory of manifest.libraryDirectories) {
  linkArguments.push("-Xlinker", `-L${environmentPath(directory)}`);
}
for (const library of manifest.staticLibraries) linkArguments.push("-Xlinker", environmentPath(library));
for (const library of manifest.dynamicLibraries) {
  if (!/^[A-Za-z0-9_+.-]+$/u.test(library)) throw new Error("Invalid native library identifier.");
  linkArguments.push("-Xlinker", `-l${library}`);
}

const byId = new Map(manifest.components.map((component) => [component.id, component]));
if (byId.size !== manifest.components.length) throw new Error("Duplicate native component identity.");
const roots = manifest.components.filter((component) => component.root);
if (roots.length !== 1) throw new Error("Expected exactly one generated root component.");
const completed = new Set();
const active = new Set();
function buildComponent(id) {
  if (completed.has(id)) return;
  if (active.has(id)) throw new Error("Cyclic native component dependency.");
  const component = byId.get(id);
  if (component === undefined) throw new Error(`Missing native component '${id}'.`);
  if (component.kind !== "library" && component.kind !== "executable") {
    throw new Error("Unsupported native component output kind.");
  }
  active.add(id);
  for (const dependency of component.dependencies) buildComponent(dependency);
  const artifact = within(root, component.artifactPath);
  mkdirSync(dirname(artifact), { recursive: true });
  const staging = resolve(dirname(artifact), `.pending-${process.pid}`, basename(artifact));
  mkdirSync(dirname(staging), { recursive: true });
  process.stdout.write(`=== Native component ${component.packageName} ===\n`);
  run("mojo", [
    component.kind === "library" ? "precompile" : "build",
    ...(component.kind === "executable" ? ["-j", jobs] : []),
    ...component.includeDirectories.flatMap((directory) => ["-I", within(root, directory)]),
    "-I", resolve(platformDirectory), within(root, component.sourcePath), "-o", staging,
    ...(component.kind === "executable" ? linkArguments : []),
  ]);
  renameSync(staging, artifact);
  active.delete(id);
  completed.add(id);
}
buildComponent(roots[0].id);
if (completed.size !== byId.size) throw new Error("Unreachable native component in the output contract.");
const published = resolve(publishPath);
mkdirSync(dirname(published), { recursive: true });
const staging = `${published}.${process.pid}.pending`;
copyFileSync(within(root, roots[0].artifactPath), staging);
renameSync(staging, published);

function within(directory, path) {
  if (typeof path !== "string" || path.length === 0 || isAbsolute(path)) {
    throw new Error("Native build paths must be nonempty relative paths.");
  }
  const resolved = resolve(directory, path);
  const relation = relative(resolve(directory), resolved);
  if (relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    throw new Error(`Native build path '${path}' escapes its declared root.`);
  }
  return resolved;
}

function environmentPath(value) {
  if (value.environmentVariable !== "CONDA_PREFIX") throw new Error("Unknown native environment input.");
  return within(condaPrefix, value.path);
}

function run(command, arguments_, capture = false) {
  const result = spawnSync(command, arguments_, {
    cwd: root, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status ?? result.signal}.${capture ? ` ${result.stderr}` : ""}`);
  }
  return result.stdout;
}
