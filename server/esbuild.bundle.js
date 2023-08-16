let makeAllPackagesExternalPlugin = {
    name: 'make-all-packages-external',
    setup(build) {
        let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
        let ignored = []
        build.onResolve({ filter }, args => (ignored.includes(args.path) ? { path: args.path, external: true } : null))
    },
}
const { build } = require('esbuild');
build({
    entryPoints: ["src/main.ts"],
    platform: "node",
    // format: "esm",
    bundle: true,
    outfile: "dist/dist.js",
    plugins: [
        makeAllPackagesExternalPlugin
    ],
})