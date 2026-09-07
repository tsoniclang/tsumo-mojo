# Tsumo Mojo

Tsumo is a Hugo-inspired static-site generator authored in TypeScript and compiled by Tsonic to native Mojo.

The application source uses the shared Node and JavaScript contracts. Mojo-only Markdown, HTML decoding, and image operations remain behind an explicit `tsumo_platform` package boundary.

## Build

```sh
npm install
npm run verify-all
```

The complete gate generates all three Tsonic products twice, checks deterministic output, compiles and runs the Mojo products, executes the authored test program and end-to-end site corpus, and verifies formatter stability.

## Run

```sh
pixi run build/tsumo --help
npm test
```

Run the executable and its tests inside the locked Pixi environment. The native platform package uses the Python dependencies declared there for Markdown, images, and regular expressions; a global Python installation is not a substitute for that runtime environment.
