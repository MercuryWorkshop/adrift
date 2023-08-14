import { build } from 'esbuild';
import inlineImportPlugin from 'esbuild-plugin-inline-import';
import path from "path";
import fs from "fs/promises";
import _fs from "fs";
const transform = options => {
    const { filter, namespace, transform } = Object.assign(
        {
            filter: /sw-filemap/,


            namespace: '_' + Math.random().toString(36).substr(2, 9),

            transform: async (contents, args) => contents
        },
        options
    );

    return {
        name: 'esbuild-sw-transformer',
        setup(build) {
            if (_fs.existsSync("./filemap.js"))
                fs.rm("./filemap.js");
            build.onResolve({ filter }, args => {
                const realPath = args.path.replace(filter, '');
                return {
                    path: path.resolve(args.resolveDir, realPath),
                    namespace
                };
            });

            build.onLoad({ filter: /.*/, namespace }, async args => {
                let map = {

                };


                async function transformDir(dir) {
                    let entries = await fs.readdir(dir);
                    for (let entry of entries) {
                        console.log(entry);

                        if ((await fs.lstat(`${dir}/${entry}`)).isDirectory()) {
                            await transformDir(`${dir}/${entry}`);
                        } else {
                            map[`${dir}/${entry}`.replace("./", "/")] = (await fs.readFile(`${dir}/${entry}`)).toString();
                        }
                    }
                }

                await transformDir(".");

                //
                // console.log(map);
                // let contents = await fs.readFile(args.path, 'utf8');

                // if (typeof transform === 'function') {
                //     contents = await transform(contents, args);
                // }

                return {
                    contents: JSON.stringify(map),
                    loader: 'text'
                };
            });
        }
    };
};

build({
    entryPoints: ['../filemap.js'],
    bundle: true,
    outfile: 'filemap.js',
    plugins: [
        // Always include this plugin before others
        transform()
    ]
}).catch(() => process.exit(1))