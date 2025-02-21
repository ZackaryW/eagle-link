const path = require("path");
const fs = require("fs").promises;

class EagleLink {
    constructor(libraryName = null, id = null, type = null, osPath = null) {
        this.id = id;
        this.type = type;
        this.libraryName = libraryName;
        this.osPath = osPath;

        // if osPath is set, cannot have anything else
        if (osPath != null && (id != null || type != null || libraryName != null)){
            throw new Error("osPath is set, cannot have anything else");
        }
    }

    static async fromFileJson(path) {
        const data = await fs.readFile(path, 'utf8');
        const json = JSON.parse(data);
        const { libraryName, id, type, osPath } = json;
        return new EagleLink(libraryName, id, type, osPath);
    }

    async toFile(path){
        const json = {
            libraryName: this.libraryName,
            id: this.id,
            type: this.type,
            osPath: this.osPath
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
            return new EagleLink(libraryName, id, type, null);
        }
    }

    static fromPath(filePath, destPath = null) {
        const fs = require("fs");
        const path = require("path");
        // get absolute path
        const absPath = fs.realpathSync(filePath);
        // get relative path to current library
        const relPath = path.relative(destPath, absPath);
        return new EagleLink(null, null, null, relPath);
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
        if (this.osPath != null){
            // check if this path is absolute
            if (path.isAbsolute(this.osPath)){
                eagle.shell.openPath(this.osPath);
            } else {
                // relative to current library
                eagle.shell.openPath(path.resolve(eagle.library.path, this.osPath));
            }
            
            return;
        }
        
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
