# Getting started

## Build from source

Install Node.js 22+, npm, Pixi, and the pinned Mojo toolchain declared by
\`pixi.toml\`. The repository expects the sibling Tsonic and Mojo
target/runtime/capability checkouts listed in the root \`package.json\`.

\`\`\`bash
npm install
npm run build
\`\`\`

Tsonic checks the authored TypeScript and emits Mojo under the ignored
\`packages/*/out/mojo\` directories. The user-owned Pixi project then compiles
the engine package, command-line application, and test product. The executable
is:

\`\`\`text
build/tsumo
\`\`\`

Run the complete reproducible gate before publishing changes:

\`\`\`bash
npm run verify-all
\`\`\`

## Quick start

\`\`\`bash
build/tsumo new site ./my-site
build/tsumo new posts/first-post.md --source ./my-site
build/tsumo build --source ./my-site --destination ./public
build/tsumo server --source ./my-site
\`\`\`

## Included examples

\`\`\`bash
build/tsumo build --source ./examples/basic-blog
build/tsumo server --source ./examples/basic-blog
build/tsumo build --source ./examples/docs-site
\`\`\`

## Themes

Set a theme in \`hugo.toml\`, \`hugo.yaml\`, or \`hugo.json\`. By default Tsumo
resolves it under the site's \`themes\` directory; \`--themesDir\` selects an
explicit parent directory.

\`\`\`toml
theme = "hugo-book"
\`\`\`

\`\`\`bash
build/tsumo build --source ./my-site --themesDir /path/to/hugo-themes
\`\`\`

## Sass

Sass execution is an explicit external tool boundary. Set \`TSUMO_SASS\` to the
desired executable or make \`sass\` available on \`PATH\`:

\`\`\`bash
TSUMO_SASS=/opt/dart-sass/sass build/tsumo build --source ./my-site
\`\`\`

Missing or failing Sass commands produce a deterministic build diagnostic; the
engine does not fall back to another implementation.
