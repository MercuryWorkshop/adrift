const { dtsPlugin } = require("esbuild-plugin-d.ts");
const { build } = require("esbuild");


for (let project of ["client", "protocol"]) {
    build({
        bundle: true,
        format: "esm",
        entryPoints: [`./${project}/src/index.ts`],
        outfile: `./dist/${project}.mjs`,
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