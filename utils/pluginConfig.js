/*
 * Enhanced plugin configuration manager with file locking and namespacing support
 * 
 * Differences from app.js version:
 * - Implements file-based locking for concurrent access safety
 * - Provides automatic plugin-scoped namespacing for configuration keys
 * - Uses JSON storage with atomic write operations
 * 
 * This version should be used for plugin-specific configuration needs
 * 
 * ! Avoid using app/PluginConfig and pluginConfig/PluginConfig at the same time
 */

const { JsonCache } = require('./base');
const path = require('path');
const fs = require('fs');
const { roamingPath } = require('./app');

class PluginConfigInternal {
    static _settingsCache = new JsonCache(
        path.join(roamingPath, 'pluginConfig.json'),
        {
            autoSaveOnExit: true,
        }
    );
    static _path = path.join(roamingPath, 'pluginConfig.json');
    
    //
    static pluginScopeMarker = "$$";
    static pluginScopeSeparator = "//";

    // Lock configuration (simplified)
    static lockRetryInterval = 100;
    static lockMaxAge = 30; // Seconds
    static #lockPath = path.join(roamingPath, 'pluginConfig.lock');
    static #lockTimeout = 10000;
    static #lockHolder = null;

    static async #acquireLock() {
        if (this.#lockHolder === process.pid) return;
        
        const start = Date.now();
        while (fs.existsSync(this.#lockPath)) {
            const stats = fs.statSync(this.#lockPath);
            const lockAge = Date.now() - stats.ctimeMs;

            // Simple age-based staleness check
            if (lockAge > this.lockMaxAge * 1000) {
                fs.unlinkSync(this.#lockPath);
                break;
            }

            await new Promise(resolve => setImmediate(resolve));
            if (Date.now() - start > this.#lockTimeout) {
                throw new Error(`Lock acquisition timeout after ${this.#lockTimeout}ms`);
            }
            await new Promise(resolve => setTimeout(resolve, this.lockRetryInterval));
        }
        
        try {
            // Create empty lock file atomically
            fs.writeFileSync(this.#lockPath, '', { flag: 'wx' });
        } catch (error) {
            if (error.code === 'EEXIST') return this.#acquireLock();
            throw error;
        }
        this.#lockHolder = process.pid;
    }

    static #releaseLock() {
        try {
            if (this.#lockHolder === process.pid) {
                fs.unlinkSync(this.#lockPath);
                this.#lockHolder = null;
            }
        } catch (error) {
            console.error('Lock release error:', error);
        }
    }

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

    static async containsRaw(key) {
        const data = await this.getRaw();
        return key in data;
    }   

    static async setDefaultRaw(key, defaultValue) {
        await this.#acquireLock();
        try {
            if (!(key in this._settingsCache.data)) {
                this._settingsCache.data[key] = defaultValue;
                await this._settingsCache.save();
            }
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

    static async clear() {
        await this.#acquireLock();
        try {
            this._settingsCache.data = {};
            await this._settingsCache.save();
        } finally {
            this.#releaseLock();
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
}

/**
 * ! Avoid using app/PluginConfig and pluginConfig/PluginConfig at the same time
 * 
 * Configuration manager with namespacing support for plugins
 * 
 * Provides both raw access and namespaced configuration management:
 * - Local methods (getLocal/setLocal) automatically namespace keys for current plugin
 * - Global methods work with unnamespaced keys visible to all plugins
 * - All operations are atomic with file locking
 */
class PluginConfig {
    static getRaw = (...args) => PluginConfigInternal.getRaw(...args);
    static setRaw = (...args) => PluginConfigInternal.setRaw(...args);
    static setDefaultRaw = (...args) => PluginConfigInternal.setDefaultRaw(...args);
    static save = (...args) => PluginConfigInternal.save(...args);
    static containsRaw = (...args) => PluginConfigInternal.containsRaw(...args);
    static popRaw = (...args) => PluginConfigInternal.popRaw(...args);

    /**
     * Async generator yielding all raw configuration entries
     * @yields {Array} [key, value] pairs for every entry in config
     */
    static async *iterRaw() {
        const data = await this.getRaw();
        for (const key in data) {
            yield [key, data[key]];
        }
    }

    /**
     * Get namespaced configuration value for current plugin
     * @param {string} key - Local configuration key (without namespace)
     * @returns {Promise<any>} Stored value or undefined
     */
    static async getLocal(key) {
        const key2 = PluginConfigInternal.pluginScopeMarker + eagle.plugin.manifest.id + PluginConfigInternal.pluginScopeSeparator + key;
        return this.getRaw(key2);
    }
    
    /**
     * Set namespaced configuration value for current plugin
     * @param {string} key - Local configuration key (without namespace)
     * @param {any} value - Value to store
     */
    static async setLocal(key, value) {
        const key2 = PluginConfigInternal.pluginScopeMarker + eagle.plugin.manifest.id + PluginConfigInternal.pluginScopeSeparator + key;
        return this.setRaw(key2, value);
    }

    /**
     * Check if namespaced key exists for current plugin
     * @param {string} key - Local configuration key
     * @returns {Promise<boolean>} True if key exists
     */
    static async hasLocal(key) {
        const key2 = PluginConfigInternal.pluginScopeMarker + eagle.plugin.manifest.id + PluginConfigInternal.pluginScopeSeparator + key;
        return this.containsRaw(key2);
    }

    /**
     * Async generator yielding all namespaced entries for current plugin
     * @yields {Array} [localKey, value] pairs with namespace stripped
     */
    static async *iterLocal() {
        const data = await this.getRaw();
        const pluginKeyStarter = PluginConfigInternal.pluginScopeMarker + eagle.plugin.manifest.id + PluginConfigInternal.pluginScopeSeparator;
        for (const key in data) {
            if (key.startsWith(pluginKeyStarter)) {
                yield [key.slice(pluginKeyStarter.length), data[key]];
            }
        }
    }

    /**
     * Async generator yielding all global configuration entries
     * @yields {Array} [key, value] pairs for non-namespaced entries
     */
    static async *iterGlobal() {
        const data = await this.getRaw();
        for (const key in data) {
            if (!key.startsWith(PluginConfigInternal.pluginScopeMarker)) {
                yield [key, data[key]];
            }
        }
    }

    /**
     * Set global configuration value (visible to all plugins)
     * @param {string} key - Global configuration key
     * @param {any} value - Value to store
     */
    static async setGlobal(key, value) {
        return await PluginConfigInternal.setRaw(key, value);
    }

    /**
     * Check if global key exists
     * @param {string} key - Global configuration key
     * @returns {Promise<boolean>} True if key exists
     */
    static async hasGlobal(key) {
        return await PluginConfigInternal.containsRaw(key);
    }

    // Note: containsGlobal is duplicate of hasGlobal, consider deprecating
    static async containsGlobal(key) {
        return await PluginConfigInternal.containsRaw(key);
    }

    /**
     * Pop namespaced configuration key for current plugin
     * @param {string} key - Local configuration key
     * @param {Object} [options] - Configuration options
     * @param {boolean} [options.save=true] - Whether to persist changes immediately
     */
    static async popLocal(key, options) {
        return this.popRaw(this.#localKey(key), options);
    }

    /**
     * Pop global configuration key
     * @param {string} key - Global configuration key
     * @param {Object} [options] - Configuration options
     * @param {boolean} [options.save=true] - Whether to persist changes immediately
     */
    static async popGlobal(key, options) {
        return this.popRaw(key, options);
    }

    // Add private method declaration
    static #localKey(key) {
        return `${PluginConfigInternal.pluginScopeMarker}${eagle.plugin.manifest.id}${PluginConfigInternal.pluginScopeSeparator}${key}`;
    }

    /**
     * Pop values from both local and global scopes
     * @param {string} key - Key to pop from both scopes
     * @param {Object} [options] - Configuration options
     * @param {'local'|'global'|'first'|'last'} [options.returnScope='first'] - Which value to return
     * @param {boolean} [options.save=true] - Whether to persist changes
     */
    static async pop(key, options = {}) {
        const localKey = this.#localKey(key);
        const globalKey = key;
        
        // Pop both values without saving yet
        const localVal = await this.popRaw(localKey, { save: false });
        const globalVal = await this.popRaw(globalKey, { save: false });
        
        let returnVal;
        switch(options.returnScope || 'first') {
            case 'local':
                returnVal = localVal;
                break;
            case 'global':
                returnVal = globalVal;
                break;
            case 'first':
                returnVal = typeof localVal !== 'undefined' ? localVal : globalVal;
                break;
            case 'last':
                returnVal = typeof globalVal !== 'undefined' ? globalVal : localVal;
                break;
        }

        // Save once if requested
        if (options.save !== false) {
            await this.save();
        }

        return returnVal;
    }
}

module.exports = { PluginConfig, PluginConfigInternal };
