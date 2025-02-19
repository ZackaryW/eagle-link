const { JsonCache } = require('./base');
const path = require('path');
const { getLibraryId, LibraryIDToPath } = require('./base');
const fs = require('fs');

class PerPluginConfigInternal {
    
    static _path = path.join(path.dirname(__dirname), "config.json");
    static _settingsCache = new JsonCache(
        PerPluginConfigInternal._path,
        true
    );

    // Key structure: $${type}||{id}//{key}
    static scopeMarker = "$$";
    static typeSeparator = "||";
    static idSeparator = "//";
    
    // Lock configuration (same as pluginConfig)
    static useLock = false;
    static lockRetryInterval = 100;
    static lockMaxAge = 30;
    static #lockPath = path.join(path.dirname(__dirname), "perPluginConfig.lock");
    static #lockTimeout = 10000;
    static #lockHolder = null;

    
    
    static async getRaw() {
        await this.#acquireLock();
        try {
            return this._settingsCache.data;
        } finally {
            this.#releaseLock();
        }
    }

    static async setRaw(key, value) {
        await this.#acquireLock();
        try {
            this._settingsCache.data[key] = value;
            await this._settingsCache.save();
        } finally {
            this.#releaseLock();
        }
    }

    static async #acquireLock() {
        if (!this.useLock) return;
        if (this.#lockHolder === process.pid) return;
        
        const start = Date.now();
        while (fs.existsSync(this.#lockPath)) {
            const stats = fs.statSync(this.#lockPath);
            const lockAge = Date.now() - stats.ctimeMs;

            if (lockAge > this.lockMaxAge * 1000) {
                fs.unlinkSync(this.#lockPath);
                break;
            }

            await new Promise(resolve => setImmediate(resolve));
            if (Date.now() - start > this.#lockTimeout) {
                throw new Error(`Lock timeout after ${this.#lockTimeout}ms`);
            }
            await new Promise(resolve => setTimeout(resolve, this.lockRetryInterval));
        }
        
        try {
            fs.writeFileSync(this.#lockPath, '', { flag: 'wx' });
        } catch (error) {
            if (error.code === 'EEXIST') return this.#acquireLock();
            throw error;
        }
        this.#lockHolder = process.pid;
    }

    static #releaseLock() {
        if (!this.useLock) return;
        try {
            if (this.#lockHolder === process.pid) {
                fs.unlinkSync(this.#lockPath);
                this.#lockHolder = null;
            }
        } catch (error) {
            console.error('Lock release error:', error);
        }
    }

    static async popRaw(key, options = {}) {
        await this.#acquireLock();
        try {
            const val = this._settingsCache.data[key];
            delete this._settingsCache.data[key];
            if (options.save !== false) {  // Default true
                await this._settingsCache.save();
            }
            return val;
        } finally {
            this.#releaseLock();
        }
    }

    static async save() {
        await this.#acquireLock();
        try {
            await this._settingsCache.save();
        } finally {
            this.#releaseLock();
        }
    }
    
}

class PerPluginConfig {
    /**
     * Build scoped key based on hierarchy level
     * @param {string} type - 'item', 'folder', or 'library'
     * @param {string} pathOrId - ID or path of the target entity
     * @param {string} key - Configuration key
     */
    static #buildKey(type, pathOrId, key) {
        let id = pathOrId;
        
        if (type === 'library') {
            // Use existing getLibraryId function that maintains the map
            id = getLibraryId(pathOrId);
        }

        return [
            PerPluginConfigInternal.scopeMarker,
            type,
            PerPluginConfigInternal.typeSeparator,
            id,
            PerPluginConfigInternal.idSeparator,
            key
        ].join('');
    }

    /**
     * Get value with priority: item > folder > library > global
     * @param {string} key - Configuration key
     * @param {object} [context] - Optional context with itemId, folderId, libraryId
     */
    static async get(key, context = {}) {
        const data = await PerPluginConfigInternal.getRaw();
        
        // Check in priority order
        const scopes = [
            context.itemId && this.#buildKey('item', context.itemId, key),
            context.folderId && this.#buildKey('folder', context.folderId, key),
            context.libraryId && this.#buildKey('library', context.libraryId, key),
            key // Global fallback
        ].filter(Boolean);

        for (const scopeKey of scopes) {
            if (scopeKey in data) {
                return data[scopeKey];
            }
        }
        return undefined;
    }

    // Scoped setters
    static async setItem(itemId, key, value) {
        const fullKey = this.#buildKey('item', itemId, key);
        return PerPluginConfigInternal.setRaw(fullKey, value);
    }

    static async setFolder(folderId, key, value) {
        const fullKey = this.#buildKey('folder', folderId, key);
        return PerPluginConfigInternal.setRaw(fullKey, value);
    }

    static async setLibrary(libraryPath, key, value) {
        const fullKey = this.#buildKey('library', libraryPath, key);
        return PerPluginConfigInternal.setRaw(fullKey, value);
    }

    static async setGlobal(key, value) {
        return PerPluginConfigInternal.setRaw(key, value);
    }

    static async set(key, value) {
        return PerPluginConfigInternal.setRaw(key, value);
    }

    // Bulk operations
    static async getForItem(itemId, key) {
        const fullKey = this.#buildKey('item', itemId, key);
        return PerPluginConfigInternal.getRaw()[fullKey];
    }

    static async getForFolder(folderId, key) {
        const fullKey = this.#buildKey('folder', folderId, key);
        return PerPluginConfigInternal.getRaw()[fullKey];
    }

    static async getForLibrary(libraryPath, key) {
        const fullKey = this.#buildKey('library', libraryPath, key);
        return PerPluginConfigInternal.getRaw()[fullKey];
    }

    // Add method to get path from ID
    static getLibraryPath(id) {
        return LibraryIDToPath.get(id);
    }

    /**
     * Pop values across scopes with configurable return behavior
     * @param {string} key - Key to pop from applicable scopes
     * @param {object} [context] - Context with itemId, folderId, libraryId
     * @param {object} [options] - Configuration options
     * @param {'first'|'all'|'item'|'folder'|'library'|'global'} [options.returnScope='first'] - Return behavior
     * @param {boolean} [options.save=true] - Whether to persist changes
     */
    static async pop(key, context = {}, options = {}) {
        // Generate scope values in priority order
        const scopes = {
            item: context.itemId && this.#buildKey('item', context.itemId, key),
            folder: context.folderId && this.#buildKey('folder', context.folderId, key),
            library: context.libraryId && this.#buildKey('library', context.libraryId, key),
            global: key
        };

        // Pop values from all existing scopes without saving
        const results = {};
        for (const [scopeName, scopeKey] of Object.entries(scopes)) {
            if (scopeKey) {
                results[scopeName] = await PerPluginConfigInternal.popRaw(scopeKey, { save: false });
            }
        }

        // Determine return value based on options
        let returnVal;
        switch(options.returnScope || 'first') {
            case 'item':
                returnVal = results.item;
                break;
            case 'folder':
                returnVal = results.folder;
                break;
            case 'library':
                returnVal = results.library;
                break;
            case 'global':
                returnVal = results.global;
                break;
            case 'all':
                returnVal = results;
                break;
            case 'first':
            default:
                // Return first existing value in priority order
                returnVal = results.item ?? results.folder ?? results.library ?? results.global;
                break;
        }

        // Save once if requested
        if (options.save !== false) {
            await PerPluginConfigInternal.save();
        }

        return returnVal;
    }
}

module.exports = { PerPluginConfig };
