import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { repoRoot } from "./helpers.mjs";

const repositoryFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: repoRoot, encoding: "utf8" },
).split("\0").filter((path) => path !== "" && existsSync(join(repoRoot, path)));

const sourceFiles = repositoryFiles.filter((path) =>
  /^packages\/(?:cli|engine|tests)\/src\/.*\.ts$/u.test(path)
);
const productSourceFiles = sourceFiles.filter((path) =>
  /^packages\/(?:cli|engine)\/src\/.*\.ts$/u.test(path)
);
const platformSpecifier = "@tsonic/mojo/packages/tsumo-platform/index.js";
const platformBoundaryFiles = new Set([
  "packages/engine/src/markdown/platform.ts",
  "packages/engine/src/resources/image-provider.ts",
  "packages/engine/src/utils/html.ts",
]);

test("authored modules stay within the reviewed size boundary", () => {
  const oversized = [
    ...sourceFiles,
    ...repositoryFiles.filter((path) => path.startsWith("mojo/") && path.endsWith(".mojo")),
  ].flatMap((path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const lines = text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    return lines > 600 ? [path + ": " + lines + " lines"] : [];
  });
  assert.deepEqual(oversized, []);
});

test("product source contains no retired, compatibility, or heuristic mechanisms", () => {
  const patterns = [
    ["retired Node module", /@tsonic\/nodejs\//u],
    ["retired generated binding", /(?:markdig-types|photo-sauce-magic-scaler-types|xunit-types|@tsonic\/tsbindgen)/u],
    ["foreign target primitive", /@tsonic\/(?:csharp|rust)\/types\.js/u],
    ["foreign native module", /@tsonic\/(?:dotnet|rust\/crates)\//u],
    ["retired cast marker", /\b(?:trycast|asinterface|attributes)\s*(?:<|\()/u],
    ["TypeScript source import", /(?:from\s+|import\s*\()\s*["'][^"']+\.ts["']/u],
    ["CommonJS operation", /\brequire\s*\(|\bmodule\.exports\b|\bexport\s*=/u],
    ["triple-slash reference", /^\s*\/\/\/\s*<reference\b/u],
    ["TypeScript namespace", /^\s*(?:export\s+)?namespace\s+/u],
    ["explicit class accessibility", /^\s*(?:public|private|protected)\s+/u],
    ["override modifier", /^\s*override\s+/u],
    ["runtime reflection", /\b(?:System\.Reflection|MethodInfo\.Invoke|Activator\.CreateInstance|Assembly\.Load)\b/u],
    ["unfinished product marker", /\b(?:TODO|FIXME|HACK)\b|\bbest[- ]effort\b|\bFor now\b/u],
  ];
  const violations = [];
  for (const path of sourceFiles) {
    const lines = readFileSync(join(repoRoot, path), "utf8").split("\n");
    for (let index = 0; index < lines.length; index++) {
      for (const [label, pattern] of patterns) {
        if (pattern.test(lines[index])) {
          violations.push(path + ":" + (index + 1) + ": " + label + ": " + lines[index].trim());
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("Mojo-native limits are adapted through composition and closed unions", () => {
  const violations = sourceFiles.flatMap((path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const findings = [];
    if (/\b(?:extends|implements)\s+[A-Za-z_$]/u.test(text)) {
      findings.push(path + ": uses unsupported class heritage");
    }
    if (/^\s*(?:get|set)\s+[A-Za-z_$][\w$]*\s*\(/mu.test(text)) {
      findings.push(path + ": uses unsupported accessor syntax");
    }
    return findings;
  });
  assert.deepEqual(violations, []);

  const values = readFileSync(
    join(repoRoot, "packages/engine/src/template/values/base.ts"),
    "utf8",
  );
  const nodes = readFileSync(join(repoRoot, "packages/engine/src/template/nodes.ts"), "utf8");
  const expressions = readFileSync(
    join(repoRoot, "packages/engine/src/template/syntax/expressions.ts"),
    "utf8",
  );
  assert.match(values, /export type TemplateValue\s*=/u);
  assert.match(nodes, /export type TemplateNode\s*=/u);
  assert.match(expressions, /export type Expr\s*=/u);
});

test("portable filesystem and process work stays on Node capabilities", () => {
  const violations = productSourceFiles.flatMap((path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    return /Directory\.(?:Get|Enumerate)(?:Files|Directories)\(|SearchOption\.AllDirectories/u.test(text)
      ? [path + ": bypasses shared recursive filesystem traversal"]
      : [];
  });
  assert.deepEqual(violations, []);

  for (const fileName of ["sass-provider.ts", "javascript-provider.ts"]) {
    const text = readFileSync(join(repoRoot, "packages/engine/src/resources", fileName), "utf8");
    assert.match(text, /runExternalProcess\s*\(/u, fileName);
  }
  const processBoundary = readFileSync(
    join(repoRoot, "packages/engine/src/resources/external-process.ts"),
    "utf8",
  );
  assert.match(processBoundary, /from\s+["']node:child_process["']/u);
  assert.match(processBoundary, /\bspawnSync\s*\(/u);
});

test("filesystem calls use standard Node option objects", () => {
  const violations = sourceFiles.flatMap((path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    return /\b(?:mkdirSync|rmSync)\([^\n,]+,\s*(?:true|false)\s*\)/u.test(text)
      ? [path + ": uses a provider-private boolean filesystem overload"]
      : [];
  });
  assert.deepEqual(violations, []);
});

test("native Markdown, HTML, and image work stays behind one Mojo package", () => {
  const violations = [];
  for (const path of sourceFiles) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    for (const match of text.matchAll(
      /(?:from\s+|import\s*\()\s*["'](@tsonic\/mojo\/packages\/[^"']+)["']/gu,
    )) {
      if (!platformBoundaryFiles.has(path) || match[1] !== platformSpecifier) {
        violations.push(path + ": imports native package " + match[1] + " outside its boundary");
      }
    }
  }
  assert.deepEqual(violations, []);

  const platform = readFileSync(join(repoRoot, "mojo/tsumo_platform/__init__.mojo"), "utf8");
  assert.match(platform, /from std\.python import Python, PythonObject/u);
  assert.match(platform, /markdown_it/u);
  assert.match(platform, /from PIL import Image/u);

  const otherMojo = repositoryFiles.filter(
    (path) => path.endsWith(".mojo") && path !== "mojo/tsumo_platform/__init__.mojo",
  );
  assert.deepEqual(
    otherMojo.filter((path) =>
      /\b(?:PythonObject|Python\.import_module|Python\.evaluate)\b/u.test(
        readFileSync(join(repoRoot, path), "utf8"),
      )
    ),
    [],
  );
});

test("regular expression helpers use the single pinned Mojo platform boundary", () => {
  const source = readFileSync(
    join(repoRoot, "packages/engine/src/utils/regular-expressions.ts"),
    "utf8",
  );
  const platform = readFileSync(
    join(repoRoot, "mojo/tsumo_platform/__init__.mojo"),
    "utf8",
  );
  const pixi = readFileSync(join(repoRoot, "pixi.toml"), "utf8");
  assert.match(source, /@tsonic\/mojo\/packages\/tsumo-platform\/index\.js/u);
  assert.doesNotMatch(source, /\bRegExp\b|\.matchAll\(/u);
  assert.match(platform, /quickjs\.Function/u);
  assert.match(platform, /def regular_expression_matches\(/u);
  assert.match(pixi, /quickjs = "==1\.19\.4"/u);
});

test("all compiler products use one user-owned Mojo project contract", () => {
  const expected = new Map([
    ["engine", { packageName: "tsumo_engine", outputType: "lib" }],
    ["cli", { packageName: "tsumo", outputType: "bin" }],
    ["tests", { packageName: "tsumo_tests", outputType: "bin" }],
  ]);
  let canonicalProvider;
  for (const [projectName, product] of expected) {
    const root = join(repoRoot, "packages", projectName);
    const manifest = readJson(join(root, "package.json"));
    const config = readJson(join(root, "tsonic.json"));
    const target = config.targets[0];
    assert.equal(manifest.type, "module", projectName);
    assert.equal(manifest.devDependencies["@tsonic/target-mojo"].startsWith("file:"), true, projectName);
    assert.equal(manifest.devDependencies["@tsonic/mojo-nodejs"].startsWith("file:"), true, projectName);
    assert.equal(target.id, "mojo", projectName);
    assert.deepEqual(target.surfaces, ["js"], projectName);
    assert.equal(target.options.packageName, product.packageName, projectName);
    assert.equal(target.options.outputType, product.outputType, projectName);
    assert.equal(target.options.projectFile, "../../pixi.toml", projectName);
    assert.equal(target.options.compiler.executable, "scripts/mojo-provider.sh", projectName);
    assert.equal(target.options.compiler.workingDirectory, "../..", projectName);
    if (canonicalProvider === undefined) canonicalProvider = target.options.providerPackages;
    else assert.deepEqual(target.options.providerPackages, canonicalProvider, projectName);
  }
  assert.deepEqual(canonicalProvider, [{
    kind: "package",
    id: "tsumo-platform",
    alias: "tsumo-platform",
    packageName: "tsumo_platform",
    version: "0.0.1",
    importRoot: "../../mojo",
    sourceRoot: "../../mojo/tsumo_platform",
  }]);
});

test("the Pixi project pins the complete native toolchain and platform dependencies", () => {
  const pixi = readFileSync(join(repoRoot, "pixi.toml"), "utf8");
  for (const dependency of [
    'mojo = "==1.1.0.dev2026083005"',
    'linkify-it-py = "==2.0.3"',
    'markdown-it-py = "==4.0.0"',
    'mdit-py-plugins = "==0.5.0"',
    'pillow = "==12.1.1"',
  ]) {
    assert.equal(pixi.includes(dependency), true, dependency);
  }
  assert.equal(repositoryFiles.includes("Cargo.toml"), false);
  assert.equal(repositoryFiles.includes("Cargo.lock"), false);
  assert.deepEqual(repositoryFiles.filter((path) => path.endsWith(".csproj") || path.endsWith(".slnx")), []);
});

test("test inventory contains no disabled cases", () => {
  const testFiles = repositoryFiles.filter((path) =>
    /^(?:test\/.*\.test\.mjs|packages\/tests\/src\/.*\.test\.ts)$/u.test(path)
  );
  assert.deepEqual(
    testFiles.filter((path) =>
      /\b(?:test|it|describe)\.(?:skip|todo)\b/u.test(readFileSync(join(repoRoot, path), "utf8"))
    ),
    [],
  );
});

test("generated and investigation artifacts remain untracked and ignored", () => {
  const forbiddenTracked = repositoryFiles.filter((path) =>
    path.startsWith(".analysis/") ||
    path.startsWith(".temp/") ||
    /(^|\/)public\d*(\/|$)/u.test(path) ||
    /\/(?:out|dist|bin|obj|node_modules|build|target)\//u.test("/" + path + "/")
  );
  assert.deepEqual(forbiddenTracked, []);
  for (const path of [
    ".analysis/probe.md",
    ".temp/probe",
    "packages/engine/out/probe.mojo",
    "build/probe",
  ]) {
    const ignored = execFileSync("git", ["check-ignore", path], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    assert.equal(ignored, path);
  }
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
