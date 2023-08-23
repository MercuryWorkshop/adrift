let makeAllPackagesExternalPlugin = {
    name: 'make-all-packages-external',
    setup(build) {
        let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
        let ignored = ["wrtc"]
        build.onResolve({ filter }, args => (ignored.includes(args.path) ? { path: args.path, external: true } : null))
    },
}
const { build } = require('esbuild');
build({
    entryPoints: ["src/main.ts"],
    platform: "node",
    // format: "esm",
    bundle: true,
    minify: true,

    outfile: "dist/main.js",
    plugins: [
        makeAllPackagesExternalPlugin
    ],
})
build({
    entryPoints: ["src/autoupdater.ts"],
    platform: "node",
    bundle: true,
    minify: true,
    outfile: "dist/autoupdater.js",
    plugins: [
        makeAllPackagesExternalPlugin
    ],
})