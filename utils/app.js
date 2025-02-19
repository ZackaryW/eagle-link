const path = require('path');
const fs = require('fs');

function _getRecursTree(p, ignores = ["^\\..*", "pyenv", "pyvenv", "node_modules", ".git"]){
    const arr = [];
    for (const file of fs.readdirSync(p, {recursive: true, withFileTypes: true})){
        const fullPath = path.join(p, file.name);

        if (ignores.some(ignore => fullPath.match(new RegExp(ignore)))){
            continue;
        }
        if (file.isDirectory()){
            const subArr = _getRecursTree(fullPath);
            for (const sub of subArr){
                arr.push(sub);
            }
        } else {
            arr.push(fullPath);
        }
    }
    return arr.sort((a, b) => a.length - b.length);
}
const localBasePath = path.dirname(__dirname)
const locallyMapped = _getRecursTree(localBasePath);

function importUtil(name){
    if (!name.endsWith('.js')){
        name += '.js';
    }

    const utilsPath = path.join(localBasePath, 'utils', name);

    if (fs.existsSync(utilsPath)){
        return require(utilsPath);
    } else {
        throw new Error(`${name} not found in ${localBasePath}`);
    }
}

function importPath(filePath) {
    if (!filePath.endsWith('.js')){
        filePath += '.js';
    }
    filePath = filePath.split('/').join(path.sep);
    let matchedFile;
    for (const file of locallyMapped){
        if (file.includes(filePath)){
            matchedFile = file;
            break;
        }
    }
    if (matchedFile) {
        return require(matchedFile);
    } else {
        throw new Error(`${filePath} not found in ${eagle.plugin.path}`);
    }
}
function _roamingPath() { 
	let roamingPath;
	if (eagle.app.isWindows) {
		roamingPath = path.join(process.env.APPDATA, 'Eagle');
	} else if (eagle.app.isMac) {
		roamingPath = path.join(process.env.HOME, 'Library', 'Application Support', 'Eagle');
	} else {
		roamingPath = path.join(process.env.HOME, '.config', 'eagle');
	}
	return roamingPath;
}
const roamingPath = _roamingPath();

module.exports = {
    roamingPath,
    importUtil,
    importPath
}
