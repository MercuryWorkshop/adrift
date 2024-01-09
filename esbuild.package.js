const { dtsPlugin } = require("esbuild-plugin-d.ts");
const { build } = require("esbuild");

let makeAllPackagesExternalPlugin = {
    name: 'make-all-packages-external',
    setup(build) {

        build.onResolve({ filter: /protocol/ }, args => ({ external: false }))
        let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
        build.onResolve({ filter }, args => ({ path: args.path, external: true }))
    },
}

for (let project of ["client", "protocol", "tracker-list"]) {
    build({
        bundle: true,
        format: "esm",
        entryPoints: [`./${project}/src/index.ts`],
        outfile: `./dist/${project}.mjs`,
        plugins: [makeAllPackagesExternalPlugin]
    })
    build({
        bundle: true,
        format: "cjs",
        entryPoints: [`./${project}/src/index.ts`],
        outfile: `./dist/${project}.cjs`,
        plugins: [dtsPlugin({
            outDir: `./dist/${project}`,
            tsconfig: "tsconfig.json"
        })]
    })
}
