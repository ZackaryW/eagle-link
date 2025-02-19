/**
 * module to provide global python environment handle
 * 
 */

const path = require('path');
const { PluginConfig } = require('./app');
const { JsonCache, nativeUnzip } = require('./base');
const { ProcessExecutor } = require('./base2');
const fs = require('fs');


class PyEnv {
    static _resolveArchPart(){
        const arch = eagle.app.arch;

        if (arch == "x64") {
            return "x86_64";
        } else if (
            ["arm", "x86_64", "aarch64", "i386"].includes(arch)
        ) {
            return arch;
        } else if (os == "mac") {
            return "universal2";
        } else {
            throw new Error("Unsupported architecture: " + arch);
        }
    }

    static arch = PyEnv._resolveArchPart();
    
    static _resolveOsPart(){

        if (eagle.app.isWindows) {
            return "windows";
        } else if (eagle.app.isMac) {
            return "darwin";
        } else if (eagle.app.isLinux) {
            return "linux";
        } else {
            throw new Error("Unsupported operating system: " + os);
        }

    }

    static os = PyEnv._resolveOsPart();

    static get pyBasePath() {
        try {

            return PluginConfig.get().pythonToEagle;
        } catch (e) {
            throw new Error("Python base path not found");
        }

    }

    static get pyConfigPath() {
        return path.join(PyEnv.pyBasePath, 'config.json');
    }

    static pyConfig = new JsonCache(PyEnv.pyConfigPath)

    static get envSetUrl() {
        console.log(PyEnv.pyConfig);
        const config = PyEnv.pyConfig.data;
        let source = config.source;
        const regex = /{[^}]+}/g;
        source = source.replace(regex, (match) => {

            const varName = match.substring(1, match.length - 1);
    
            if (varName == "source") {
                throw new Error("source cant be re-referenced");
            }
    
            if (varName == "os"){
                return PyEnv.os;
            }
    


            if (varName == "arch"){
                return PyEnv.arch;
            }
            return config[varName];


        });
        console.log("Constructed URL: ", source);
        return source;
    }

    static _envBuildPath = null;

    static get envBuildPath() {
        if (PyEnv._envBuildPath) {
            return PyEnv._envBuildPath;
        }


        const envBuildPath = path.join(PyEnv.pyBasePath, "build");


        if (!fs.existsSync(envBuildPath)) {
            fs.mkdirSync(envBuildPath, { recursive: true });
        }

        PyEnv._envBuildPath = envBuildPath;
        return envBuildPath;

    }

    static get envBuildPyLib() {
        return path.join(PyEnv.envBuildPath, "pylib.zip");
    }


    static get envLibPath() {
        return path.join(PyEnv.pyBasePath, "pyenv");
    }
    


    static async downloadBase(){
        if (fs.existsSync(PyEnv.envBuildPyLib)) {
            console.log("pylib.zip already exists, deleting...");
            fs.unlinkSync(PyEnv.envBuildPyLib);

        }

        const response = await fetch(PyEnv.envSetUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(PyEnv.envBuildPyLib, Buffer.from(buffer));
        return PyEnv.envBuildPyLib;

    }

    static async resetEnv(){
        if (!fs.existsSync(PyEnv.envBuildPyLib)) {
            await PyEnv.downloadBase();
        }


        if (fs.existsSync(PyEnv.envLibPath)) {
            fs.rmSync(PyEnv.envLibPath, { recursive: true, force: true });
        }
        
        const parentEnvLibPath = path.dirname(PyEnv.envLibPath);
        await nativeUnzip(PyEnv.envBuildPyLib, parentEnvLibPath, true);

        const pyenvDir = fs.readdirSync(parentEnvLibPath).find(dir => dir.startsWith('python-'));
        if (pyenvDir) {
            const oldPath = path.join(parentEnvLibPath, pyenvDir);
            const newPath = path.join(parentEnvLibPath, 'pyenv');
            fs.renameSync(oldPath, newPath);
            console.log(`Renamed ${pyenvDir} to pyenv.`);
        } else {
            console.error('No python-... directory found.');
        }
        console.log("Environment reset completed.");
    }

    static get pythonPath(){
        if (eagle.app.isWindows){
            return path.join(PyEnv.envLibPath, "bin", "python.exe");
        } else {
            return path.join(PyEnv.envLibPath, "bin", "python");
        }
    }

    static exec(command, cwd=null){
        return new ProcessExecutor(`"${PyEnv.pythonPath}" "${command}"`, {
            cwd: cwd,
            shell: true,
        });
    }
}


module.exports = PyEnv;
