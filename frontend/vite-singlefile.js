import micromatch from "micromatch"

const defaultConfig = {
    useRecommendedBuildConfig: true,
    removeViteModuleLoader: false,
    deleteInlinedFiles: true
}

export function replaceScript(
    html,
    scriptFilename,
    scriptCode,
    removeViteModuleLoader = false
) {
    const reScript = new RegExp(
        `<script([^>]*?) src="[./]*${scriptFilename}"([^>]*)></script>`
    )
    // we can't use String.prototype.replaceAll since it isn't supported in Node.JS 14
    const preloadMarker = /"__VITE_PRELOAD__"/g
    const newCode = scriptCode.replace(preloadMarker, "void 0")
    const inlined = html.replace(
        reScript,
        (_, beforeSrc, afterSrc) =>
            `<script${beforeSrc}${afterSrc}>\nimport "data:application/javascript;base64,${Buffer.from(
                newCode
            ).toString("base64")}";\n</script>`
    )
    return removeViteModuleLoader ? _removeViteModuleLoader(inlined) : inlined
}

export function replaceCss(html, scriptFilename, scriptCode) {
    const reCss = new RegExp(`<link[^>]*? href="[./]*${scriptFilename}"[^>]*?>`)
    const inlined = html.replace(reCss, `<style>\n${scriptCode}\n</style>`)
    return inlined
}

const warnNotInlined = filename =>
    console.warn(`WARNING: asset not inlined: ${filename}`)

export function viteSingleFile({
    useRecommendedBuildConfig = true,
    removeViteModuleLoader = false,
    inlinePattern = [],
    deleteInlinedFiles = true
} = defaultConfig) {
    return {
        name: "vite:singlefile",
        config: useRecommendedBuildConfig ? _useRecommendedBuildConfig : undefined,
        enforce: "post",
        generateBundle: (_, bundle) => {
            const jsExtensionTest = /\.[mc]?js$/
            const htmlFiles = Object.keys(bundle).filter(i => i.endsWith(".html"))
            const cssAssets = Object.keys(bundle).filter(i => i.endsWith(".css"))
            const jsAssets = Object.keys(bundle).filter(i => jsExtensionTest.test(i))
            const bundlesToDelete = []
            for (const name of htmlFiles) {
                const htmlChunk = bundle[name]
                let replacedHtml = htmlChunk.source
                for (const jsName of jsAssets) {
                    if (
                        !inlinePattern.length ||
                        micromatch.isMatch(jsName, inlinePattern)
                    ) {
                        const jsChunk = bundle[jsName]
                        if (jsChunk.code != null) {
                            bundlesToDelete.push(jsName)
                            replacedHtml = replaceScript(
                                replacedHtml,
                                jsChunk.fileName,
                                jsChunk.code,
                                removeViteModuleLoader
                            )
                        }
                    } else {
                        warnNotInlined(jsName)
                    }
                }
                for (const cssName of cssAssets) {
                    if (
                        !inlinePattern.length ||
                        micromatch.isMatch(cssName, inlinePattern)
                    ) {
                        const cssChunk = bundle[cssName]
                        bundlesToDelete.push(cssName)
                        replacedHtml = replaceCss(
                            replacedHtml,
                            cssChunk.fileName,
                            cssChunk.source
                        )
                    } else {
                        warnNotInlined(cssName)
                    }
                }
                htmlChunk.source = replacedHtml
            }
            if (deleteInlinedFiles) {
                for (const name of bundlesToDelete) {
                    delete bundle[name]
                }
            }
            for (const name of Object.keys(bundle).filter(
                i =>
                    !jsExtensionTest.test(i) &&
                    !i.endsWith(".css") &&
                    !i.endsWith(".html")
            )) {
                warnNotInlined(name)
            }
        }
    }
}

// Optionally remove the Vite module loader since it's no longer needed because this plugin has inlined all code.
// This assumes that the Module Loader is (1) the FIRST function declared in the module, (2) an IIFE, (4) is within
// a script with no unexpected attribute values, and (5) that the containing script is the first script tag that
// matches the above criteria. Changes to the SCRIPT tag especially could break this again in the future. It should
// work whether `minify` is enabled or not.
// Update example:
// https://github.com/richardtallent/vite-plugin-singlefile/issues/57#issuecomment-1263950209
const _removeViteModuleLoader = html =>
    html.replace(
        /(<script type="module" crossorigin>\s*)\(function(?: polyfill)?\(\)\s*\{[\s\S]*?\}\)\(\);/,
        '<script type="module">\n'
    )

// Modifies the Vite build config to make this plugin work well.
const _useRecommendedBuildConfig = config => {
    if (!config.build) config.build = {}
    // Ensures that even very large assets are inlined in your JavaScript.
    config.build.assetsInlineLimit = 100000000
    // Avoid warnings about large chunks.
    config.build.chunkSizeWarningLimit = 100000000
    // Emit all CSS as a single file, which `vite-plugin-singlefile` can then inline.
    config.build.cssCodeSplit = false
    // Subfolder bases are not supported, and shouldn't be needed because we're embedding everything.
    config.base = undefined

    if (!config.build.rollupOptions) config.build.rollupOptions = {}
    if (!config.build.rollupOptions.output) config.build.rollupOptions.output = {}

    const updateOutputOptions = out => {
        // Ensure that as many resources as possible are inlined.
        out.inlineDynamicImports = true
    }

    if (Array.isArray(config.build.rollupOptions.output)) {
        for (const o in config.build.rollupOptions.output) updateOutputOptions(o)
    } else {
        updateOutputOptions(config.build.rollupOptions.output)
    }
}
