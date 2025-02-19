const path = require("path");
const PyEnv = require("./pyEnv");
const { ProcessExecutor } = require("./base2");

class Py {
    static createLocalVenv(){
        const venvPath = path.join(eagle.plugin.path, "pyvenv");
        if (fs.existsSync(venvPath)) {
            fs.rmSync(venvPath, { recursive: true, force: true });
        }
        PyEnv.exec(`-m venv ${venvPath}`);
    }
    
    static get hasLocalVenv(){
        return fs.existsSync(path.join(eagle.plugin.path, "pyvenv"));
    }

    static get pythonPath(){
        let rpath = null;
        if (!Py.hasLocalVenv){
            rpath = PyEnv.pythonPath;
        } else if (eagle.app.isWindows){
            rpath = path.join(eagle.plugin.path, "pyvenv", "bin", "python.exe");
        } else {
            rpath = path.join(eagle.plugin.path, "pyvenv", "bin", "python");
        }
        if (!fs.existsSync(rpath)){
            throw new Error("Python path not found");
        }
        return rpath;
    }


    static exec(command, cwd=null){
        console.log("Executing command:", `${Py.pythonPath} ${command}`);
        return new ProcessExecutor(`"${Py.pythonPath}" ${command}`, {
            cwd: cwd,
            shell: true,
        });
    }


    static async pipInstall(pkg){
        return await Py.exec(`-m pip install ${pkg}`).execute()
    }


    static async pipInstallAll(pkgs){
        return await Py.exec(`-m pip install ${pkgs.join(" ")}`).execute()
    }




    static async runCode(code){
        let codeEscaped = code.replace(/\n+/g, ';').replace(/;+/, ';');
        codeEscaped = codeEscaped.replace(/"/g, '\\"');
        const cmd = `-c "${codeEscaped}"`;
        console.log("Running command:", `${Py.pythonPath} ${cmd}`);
        return await new ProcessExecutor(`"${Py.pythonPath}" ${cmd}`, {
            shell: true,
        }).execute();
    }


    static async runFile(filePath){
        return await Py.exec(`"${filePath}"`).execute();
    }


    static _pyprojectJsonPath = path.join(eagle.plugin.path, "pyproject.json");
    static _pyprojectTomlPath = path.join(eagle.plugin.path, "pyproject.toml");
    static _requirementsTxtPath = path.join(eagle.plugin.path, "requirements.txt");

    static get hasLocalDeclaration(){
        return fs.existsSync(Py._pyprojectJsonPath) || fs.existsSync(Py._pyprojectTomlPath);
    }


    static async init(){
        const hasJson = fs.existsSync(Py._pyprojectJsonPath);
        const hasToml = fs.existsSync(Py._pyprojectTomlPath);
        const hasRequirementsTxt = fs.existsSync(Py._requirementsTxtPath);

        if (hasJson || hasToml || hasRequirementsTxt){
            if (!Py.hasLocalVenv){
                Py.createLocalVenv();
            }
            if (hasToml){
                await Py.exec("-m pip install .", eagle.plugin.path).execute();
            } else if (hasJson){
                fileContent = fs.readFileSync(Py._pyprojectJsonPath, "utf-8");

                const pyproject = JSON.parse(fileContent);
                const dependencies = pyproject.dependencies;
                Py.pipInstallAll(dependencies);
            } else if (hasRequirementsTxt){
                fileContent = fs.readFileSync(Py._requirementsTxtPath, "utf-8");
                const dependencies = fileContent.split("\n");
                Py.pipInstallAll(dependencies);
            }
        }
    }
}


module.exports = Py;
