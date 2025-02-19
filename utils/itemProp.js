const { JsonCache } = require('./base');
const fs = require('fs');
const path = require('path');

/**
 * Manages item-specific properties with file locking and plugin-scoped namespacing
 * @class
 */
class ItemProp {
    #pluginScopeMarker = "$$";
    #pluginScopeSeparator = "//";
    static #pluginId = eagle.plugin.manifest.id;
    
    /**
     * @param {Object} item - Eagle item object containing filePath property
     */
    constructor(item) {
        this._filePath = path.join(path.dirname(item.filePath), 'itemProp.json');
        this._settingsCache = new JsonCache(this._filePath, true);
        
        // Lock configuration
        this._lockPath = this._filePath + '.lock';
        this._lockHolder = null;
        this.lockRetryInterval = 100;
        this.lockMaxAge = 30; // Seconds
        this._lockTimeout = 10000;
    }

    async #acquireLock() {
        if (this._lockHolder === process.pid) return;
        
        const start = Date.now();
        while (fs.existsSync(this._lockPath)) {
            const stats = fs.statSync(this._lockPath);
            const lockAge = Date.now() - stats.ctimeMs;

            if (lockAge > this.lockMaxAge * 1000) {
                fs.unlinkSync(this._lockPath);
                break;
            }

            await new Promise(resolve => setImmediate(resolve));
            if (Date.now() - start > this._lockTimeout) {
                throw new Error(`Lock acquisition timeout after ${this._lockTimeout}ms`);
            }
            await new Promise(resolve => setTimeout(resolve, this.lockRetryInterval));
        }
        
        try {
            fs.writeFileSync(this._lockPath, '', { flag: 'wx' });
        } catch (error) {
            if (error.code === 'EEXIST') return this.#acquireLock();
            throw error;
        }
        this._lockHolder = process.pid;
    }

    #releaseLock() {
        try {
            if (this._lockHolder === process.pid) {
                fs.unlinkSync(this._lockPath);
                this._lockHolder = null;
            }
        } catch (error) {
            console.error(`Lock release failed for ${this._lockPath}:`, error);
        }
    }

    /**
     * Get a property value
     * @param {string} key - Property name to retrieve
     * @returns {Promise<any>} The stored value or undefined
     */
    async get(key) {
        await this.#acquireLock();
        try {
            return this._settingsCache.data[key];
        } finally {
            this.#releaseLock();
        }
    }

    /**
     * Set a property value
     * @param {string} key - Property name to set
     * @param {any} value - Value to store
     * @returns {Promise<void>}
     */
    async set(key, value) {
        await this.#acquireLock();
        try {
            this._settingsCache.data[key] = value;
            await this._settingsCache.save();
        } finally {
            this.#releaseLock();
        }
    }

    async has(key) {
        await this.#acquireLock();
        try {
            return key in this._settingsCache.data;
        } finally {
            this.#releaseLock();
        }
    }

    async delete(key) {
        await this.#acquireLock();
        try {
            delete this._settingsCache.data[key];
            await this._settingsCache.save();
        } finally {
            this.#releaseLock();
        }
    }

    async getAll() {
        await this.#acquireLock();
        try {
            return { ...this._settingsCache.data };
        } finally {
            this.#releaseLock();
        }
    }

    // Plugin-scoped methods
    #getScopedKey(key) {
        return `${this.#pluginScopeMarker}${ItemProp.#pluginId}${this.#pluginScopeSeparator}${key}`;
    }

    /**
     * Get a plugin-scoped property value
     * @param {string} key - Local property name (automatically namespaced)
     * @returns {Promise<any>} The stored value or undefined
     * @example await itemProp.getLocal('previewState');
     */
    async getLocal(key) {
        return this.get(this.#getScopedKey(key));
    }

    async setLocal(key, value) {
        return this.set(this.#getScopedKey(key), value);
    }

    async hasLocal(key) {
        return this.has(this.#getScopedKey(key));
    }

    async deleteLocal(key) {
        return this.delete(this.#getScopedKey(key));
    }

    /**
     * Iterate through all plugin-scoped properties
     * @async
     * @generator
     * @yields {Array} [key, value] pairs with plugin-scoped prefix removed
     * @example
     * for await (const [key, value] of itemProp.iterLocal()) {
     *   console.log(key, value);
     * }
     */
    async *iterLocal() {
        const allData = await this.getAll();
        const prefix = `${this.#pluginScopeMarker}${ItemProp.#pluginId}${this.#pluginScopeSeparator}`;
        
        for (const [key, value] of Object.entries(allData)) {
            if (key.startsWith(prefix)) {
                yield [key.slice(prefix.length), value];
            }
        }
    }
}

module.exports = { ItemProp };
