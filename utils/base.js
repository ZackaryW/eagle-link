const fs = require('fs');

/**
 * Caches function results based on input arguments
 * @function
 * @param {Function} fn - The function to cache
 * @returns {Function} Cached version of the input function
 */
function cache(fn) {
    /**
     * @param {Function} fn - The function to cache.
     * @returns {Function} - The cached function.
     */

    const cacheStore = {};
    return function(...args) {
        const key = JSON.stringify(args);
        if (cacheStore[key]) {
            return cacheStore[key];
        }
        const result = fn.apply(this, args);
        cacheStore[key] = result;
        return result;
    };
}

/**
 * Class-based function result cache with argument-based storage
 * @class
 * @param {Function} fn - The function to cache
 */
class fnCache {
    constructor(fn) {
        this.fn = fn;
        this.cache = {};
    }

    get(args) {
        const key = JSON.stringify(args);
        if (this.cache[key]) {
            return this.cache[key];
        }
        const result = this.fn.apply(this, args);
        this.cache[key] = result;
        return result;
    }
}

/**
 * JSON file caching system with file watching and automatic updates
 * @class
 * @param {string} path - Path to JSON file
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.changeListener=false] - Enable periodic change checking
 * @param {boolean} [options.touchFile=true] - Create file if it doesn't exist
 * @param {boolean} [options.autoSaveOnExit=true] - Automatically save data on process exit
 * @throws {Error} If file doesn't exist and touchFile is false
 */
class JsonCache {
    static #instances = new Map();

    constructor(path, options = {}) {
        if (JsonCache.#instances.has(path)) {
            return JsonCache.#instances.get(path);
        }

        const { changeListener = false, touchFile = true, autoSaveOnExit = true } = options;
        this._path = path;
        this._changeListener = changeListener;
        this._cachedData = null;
        this._lastModifiedTime = 0;
        this._alistener = null;

        if (touchFile && !fs.existsSync(this._path)) {
            fs.writeFileSync(this._path, JSON.stringify({}));
        } else if (!fs.existsSync(this._path)) {
            throw new Error(`File ${this._path} does not exist`);
        }

        this.updateCache();
        fs.watchFile(this._path, (curr, prev) => {
            if (curr.mtimeMs !== prev.mtimeMs) {
                this.updateCache();
            }
        });

        // Auto-save on process exit
        if (autoSaveOnExit) {
            process.on('beforeExit', () => this.save());
        }

        JsonCache.#instances.set(path, this);
    }

    updateCache() {
        const stats = fs.statSync(this._path);
        if (stats.mtimeMs !== this._lastModifiedTime) {
            this._cachedData = JSON.parse(fs.readFileSync(this._path, 'utf8'));
            this._lastModifiedTime = stats.mtimeMs;
            if (this._changeListener) {
                this._alistener = setInterval(() => {
                    if (this._cachedData !== JSON.parse(fs.readFileSync(this._path, 'utf8'))) {
                        this._cachedData = JSON.parse(fs.readFileSync(this._path, 'utf8'));
                        this._lastModifiedTime = stats.mtimeMs;
                    }
                }, 1000);
            }
        }
    }

    /**
     * Get cached JSON data
     * @member {Object} data
     */
    get data() {
        return this._cachedData;
    }

    /**
     * Last modified timestamp of the file
     * @member {number} lastModified
     */
    get lastModified(){
        return this._lastModifiedTime;
    }

    /**
     * Saves current data back to the JSON file
     * @method
     */
    save() {
        fs.writeFileSync(this._path, JSON.stringify(this._cachedData, null, 2));
    }

    set(key, value) {
        this._cachedData[key] = value;
        this.save();
    }

    set_default(key, value) {
        if (!this._cachedData[key]) {
            this._cachedData[key] = value;
            this.save();
        }
    }
}

/**
 * Overrides static getters on a class
 * @function
 * @param {Class} Class - The class to modify
 * @param {Object} options - Object mapping property names to new getter functions
 */
function overloadStaticGetters(Class, options) {
    for (const [key, newGetter] of Object.entries(options)) {
        const descriptor = Object.getOwnPropertyDescriptor(Class, key);
        
        if (descriptor && descriptor.get) {
            // If there's already a getter, modify it
            Object.defineProperty(Class, key, {
                get: function() {
                    return newGetter(descriptor.get.call(this));
                },
                configurable: true
            });
        } else {
            // If there's no existing getter, create a new one
            Object.defineProperty(Class, key, {
                get: newGetter,
                configurable: true
            });
        }
    }
}

/**
 * Cross-platform zip file extraction using native commands
 * @async
 * @function
 * @param {string} src - Source zip file path
 * @param {string} dest - Destination directory path
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<void>} Resolves when extraction completes
 * @throws {Error} If extraction process fails
 */
async function nativeUnzip(src, dest, debug = false) {
    const { spawn } = require('child_process');
    let args, command;
    
    if (eagle.app.isWindows) {
        command = 'powershell';
        args = [
            '-Command',
            `Expand-Archive -Path "${src}" -DestinationPath "${dest}"`
        ];
    } else {
        command = 'unzip';
        args = [src, '-d', dest];
    }
    
    const unzip = spawn(command, args);
    console.log("Extracting zip file...", [command, ...args].join(' '));
    
    unzip.stdout.on('data', (data) => {
        if (debug) {
            console.log(`stdout: ${data}`);
        }
    });


    unzip.stderr.on('data', (data) => {
        if (debug) {
            console.error(`stderr: ${data}`);
        }
    });

    await new Promise((resolve, reject) => {
        unzip.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Extract process exited with code ${code}`));
            } else {
                console.log("Extraction completed");
                resolve();
            }
        });
    });
}

const LibraryIDToPath = new Map();

function getLibraryId(path = null){
    if (!path){
        path = eagle.library.path;
    }

    if (LibraryIDToPath.has(path)){
        return LibraryIDToPath.get(path);
    }

    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    hash.update(path);
    const hex = hash.digest('hex');
    LibraryIDToPath.set(path, hex);
    return hex;
}

module.exports = {
    cache,
    JsonCache,
    fnCache,
    overloadStaticGetters,
    nativeUnzip,
    getLibraryId,
    LibraryIDToPath
}

