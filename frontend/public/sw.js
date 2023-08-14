/*global UVServiceWorker,__uv$config*/
/*
 * Stock service worker script.
 * Users can provide their own sw.js if they need to extend the functionality of the service worker.
 * Ideally, this will be registered under the scope in uv.config.js so it will not need to be modified.
 * However, if a user changes the location of uv.bundle.js/uv.config.js or sw.js is not relative to them, they will need to modify this script locally.
 */

self.filemap = {};
importScripts("filemap.js");

importScripts('uv/uv.bundle.js');
importScripts('uv.config.js');
importScripts(__uv$config.sw || 'uv.sw.js');
importScripts('/dynamic/dynamic.config.js');
importScripts('/dynamic/dynamic.worker.js');

const dynamic = new Dynamic();

self.dynamic = dynamic;

const sw = new UVServiceWorker();

self.addEventListener('fetch', (event) => {

    event.respondWith(
        (async function () {
            let url = new URL(event.request.url).pathname;
            if (url == "/")
                url = "/index.html";
            if (filemap[url]) {

                let contenttype = "text/plain";

                if (url.includes(".js"))
                    contenttype = "application/javascript";
                else if (url.includes(".html"))
                    contenttype = "text/html";
                else if (url.includes(".css"))
                    contenttype = "text/css";


                return new Response(filemap[url], {
                    headers: {
                        "content-type": contenttype
                    }
                });
            } else {

                if (await dynamic.route(event)) {
                    return await dynamic.fetch(event);
                }

                if (event.request.url.startsWith(location.origin + "/uvsw/")) {
                    return await sw.fetch(event);
                }


                return await fetch(event.request)
            }
        })()
    );
    //
});

// self.addEventListener('fetch',
//     event => {
//         event.respondWith(
//             (async function() {
//                 if (await dynamic.route(event)) {
//                     return await dynamic.fetch(event);
//                 }

//                 return await fetch(event.request);
//             })()
//         );
//     }
// );
