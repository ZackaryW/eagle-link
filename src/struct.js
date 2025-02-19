const path = require("path");
const fs = require("fs").promises;

class EagleLink {
    constructor(libraryName, id = null, type = null) {
        this.id = id;
        this.type = type;
        this.libraryName = libraryName;
    }

    static async fromFileJson(path) {
        const data = await fs.readFile(path, 'utf8');
        const json = JSON.parse(data);
        const { libraryName, id, type } = json;
        return new EagleLink(libraryName, id, type);
    }

    async toFile(path){
        const json = {
            libraryName: this.libraryName,
            id: this.id,
            type: this.type
        }
        await fs.writeFile(path, JSON.stringify(json, null, 2));
    }

    static fromLink(link, libraryName = null){
        if (libraryName == null){
            libraryName = eagle.library.path;
        }
        const name = path.basename(libraryName);
        libraryName = name.replace('.library', '');

        if (link.startsWith("eagle://")){
            const [type, id] = link.split("://")[1].split("/");
            return new EagleLink(libraryName, id, type);
        } else if (link.startsWith("http://localhost:41595")){
            const raw = link.split("http://localhost:41595/")[1];
            const type = raw.split('?')[0];
            const id = raw.split('=')[1];
            return new EagleLink(libraryName, id, type);
        }
    }

    get isCurrentLibrary(){
        const libpath = eagle.library.path;
        let libname = path.basename(libpath);
        libname = libname.replace('.library', '');
        return libname == this.libraryName;
    }

    async #createOpenLink(hold = false){
        const { spawn } = require('child_process');
        const uri = `eagle://${this.type}/${this.id}`;
        const spawnOptions = {
            detached: true,
            stdio: 'ignore',
            windowsHide: false
        };
        let cmd;
        let args;
        if (eagle.app.isWindows){
            cmd = 'cmd';
            args = hold 
                ? ['/c', `timeout /t 1 /nobreak && start ${uri}`]
                : ['/c', 'start', '', uri];
        } else if (eagle.app.isMac) {
            cmd = hold ? 'sh' : 'open';
            args = hold
                ? ['-c', `sleep 1 && open ${uri}`]
                : [uri];
        } else {
            cmd = hold ? 'sh' : 'xdg-open';
            args = hold
                ? ['-c', `sleep 1 && xdg-open ${uri}`]
                : [uri];
        }

        spawn(cmd, args, spawnOptions);
    }

    async open(){
        const path = require("path");
        const { EagleApiUtils } = require(path.join(__dirname, "utils", "api"));
        const isCurrentLibrary = this.isCurrentLibrary;
        this.#createOpenLink(!isCurrentLibrary);

        if (!isCurrentLibrary){
            await EagleApiUtils.switchLibrary(this.libraryName);
        }
    }
}


module.exports = {
    EagleLink
}
