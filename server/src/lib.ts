import fs from "fs";

export function datadir(): string {
    let base = (process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.config")) + "/adrift-server"
    if (!fs.existsSync(base))
        fs.mkdirSync(base, { recursive: true });
    return base;
}