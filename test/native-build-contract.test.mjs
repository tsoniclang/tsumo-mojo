import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = resolve(repository, ".temp/native-build-contract");
mkdirSync(scratch, { recursive: true });

for (const fail of [false, true]) {
  for (const language of [undefined, "c", "c++"]) {
  test(`native component publication preserves package identity${fail ? " and prior output on failure" : ""}${language ? ` with ${language} units` : ""}`, () => {
    const root = mkdtempSync(resolve(scratch, "case-"));
    const binaries = resolve(root, "bin");
    mkdirSync(binaries);
    const compiler = resolve(binaries, "mojo");
    writeFileSync(compiler, [
      "#!/usr/bin/env node",
      "const fs = await import('node:fs');",
      "const path = await import('node:path');",
      "const args = process.argv.slice(2);",
      "if (args[0] === '--version') { console.log('Mojo test-version'); process.exit(0); }",
      "const output = args[args.indexOf('-o') + 1];",
      "if (path.basename(output) !== 'library.mojoc') process.exit(21);",
      "if (args.includes('-j')) process.exit(22);",
      "fs.writeFileSync(output, 'compiled-library');",
      "if (process.env.FAIL_NATIVE_BUILD === '1') process.exit(23);",
    ].join("\n"));
    chmodSync(compiler, 0o755);
    const nativeCompiler = resolve(binaries, "native-compiler");
    writeFileSync(nativeCompiler, [
      "#!/usr/bin/env node",
      "const fs = await import('node:fs');",
      "const args = process.argv.slice(2);",
      "if (!args.includes('-std=' + process.env.EXPECT_NATIVE_STD)) process.exit(24);",
      "fs.writeFileSync(args[args.indexOf('-o') + 1], 'compiled-native-unit');",
    ].join("\n"));
    chmodSync(nativeCompiler, 0o755);
    const artifactPath = "build/library.mojoc";
    mkdirSync(resolve(root, "build"));
    writeFileSync(resolve(root, artifactPath), "previous-component");
    const published = resolve(root, "published.mojoc");
    writeFileSync(published, "previous-published");
    writeFileSync(resolve(root, "mojo-native-build.json"), JSON.stringify({
      schemaVersion: 3,
      toolchain: {
        commandEnvironment: "posix", compilerVersion: "test-version",
        cCompiler: { environmentVariable: "CONDA_PREFIX", path: "bin/native-compiler" },
        cxxCompiler: { environmentVariable: "CONDA_PREFIX", path: "bin/native-compiler" },
      },
      packages: language ? [{
        includeDirectories: [], translationUnits: [{
          language, standard: language === "c" ? "c11" : "c++17",
          sourcePath: language === "c" ? "source.c" : "source.cpp",
          objectPath: "build/unit.o",
        }],
      }] : [], libraryDirectories: [], staticLibraries: [], dynamicLibraries: [],
      components: [{
        id: "root", root: true, packageName: "library", kind: "library",
        dependencies: [], artifactPath, sourcePath: "src/library", includeDirectories: [],
      }],
    }));
    const result = spawnSync(process.execPath, [
      resolve(repository, "scripts/build-generated-project.mjs"), root, published, root,
    ], {
      encoding: "utf8", timeout: 10000,
      env: {
        ...process.env, PATH: `${binaries}${delimiter}${process.env.PATH}`,
        CONDA_PREFIX: root, FAIL_NATIVE_BUILD: fail ? "1" : "0",
        EXPECT_NATIVE_STD: language === "c" ? "c11" : "c++17",
      },
    });
    assert.ifError(result.error);
    assert.equal(result.status, fail ? 1 : 0, result.stderr);
    assert.equal(readFileSync(resolve(root, artifactPath), "utf8"), fail ? "previous-component" : "compiled-library");
    assert.equal(readFileSync(published, "utf8"), fail ? "previous-published" : "compiled-library");
    if (language) assert.equal(readFileSync(resolve(root, "build/unit.o"), "utf8"), "compiled-native-unit");
  });
  }
}
