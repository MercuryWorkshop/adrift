export { AdriftBareClient } from "./AdriftClient";
export { Connection } from "./Connection";
export { DevWsTransport } from "./DevWsTransport";
export { RTCTransport } from "./RTCTransport";
export * as SignalFirebase from "./SignalFirebase";


export function downloadShortcut(name: string, title: string) {
    let a = document.createElement("a");
    a.href = "data:text/plain;base64," + btoa(`
    <!DOCTYPE html>
    <html lang="en">
    
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body,
            html {
                padding: 0;
                margin: 0;
                width: 100vw;
                height: 100vh;
                overflow: hidden;
            }
    
            iframe {
                width: 100%;
                height: 100%;
                border: none;
                outline: none;
    
            }
        </style>
    
    </head>
    
    <body>
        <iframe src="${location.href}" />
    </body>
    
    </html>
`);
    console.log(a.href);
    a.download = name;
    a.click();
}