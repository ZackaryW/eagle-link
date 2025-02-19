const { spawn } = require('child_process');

class ProcessExecutor {
    /**
     * Executes a child process with real-time output handling
     * @class
     * @param {string} command - Command to execute
     * @param {object} [options={shell: true}] - Spawn options
     * @example
     * const executor = new ProcessExecutor('python script.py')
     *   .onStdout(data => console.log('OUT:', data))
     *   .onStderr(data => console.error('ERR:', data));
     */
    constructor(command, options = { shell: true }) {
        this.process = spawn(command, options);
        this.stdoutData = '';
        this.stderrData = '';
        this.stdoutCallbacks = [];
        this.stderrCallbacks = [];

        this.process.stdout.on('data', (data) => {
            const strData = Buffer.from(data).toString();
            console.log("stdout:", strData);
            this.stdoutData += strData;
            this.stdoutCallbacks.forEach(({ condition, callback }) => {
                if (condition(strData)) {
                    callback(strData);
                }
            });
        });

        this.process.stderr.on('data', (data) => {
            const strData = Buffer.from(data).toString();
            console.log("stderr:", strData);
            this.stderrData += strData;
            this.stderrCallbacks.forEach(({ condition, callback }) => {
                if (condition(strData)) {
                    callback(strData);
                }
            });
        });
    }

    /**
     * Register a stdout callback with optional filtering
     * @overload
     * @param {function(string|Buffer): void} callback - Receives all data chunks
     * @returns {ProcessExecutor} self for chaining
     * 
     * @overload
     * @param {RegExp|function(string|Buffer): boolean} condition - Filter condition
     * @param {function(string|Buffer): void} callback - Receives matching chunks
     * @returns {ProcessExecutor} self for chaining
     * @example
     * Basic usage
     * .onStdout(data => console.log(data))
     * 
     * Regex filter
     * .onStdout(/error/i, data => handleError(data))
     * 
     * Function filter
     * .onStdout(data => data.length > 100, data => handleLargeChunk(data))
     */
    onStdout(condition, callback) {
        if (typeof condition === 'function' && !callback) {
            callback = condition;
            condition = () => true;
        }
        
        if (condition instanceof RegExp) {
            const regex = condition;
            condition = data => regex.test(Buffer.from(data).toString());
        }
        
        if (typeof condition !== 'function') {
            throw new Error('Condition must be RegExp or function');
        }

        this.stdoutCallbacks.push({ condition, callback });
        return this;
    }

    /**
     * Register a stderr callback with optional filtering
     * @overload
     * @param {function(string|Buffer): void} callback - Receives all error chunks
     * @returns {ProcessExecutor} self for chaining
     * 
     * @overload
     * @param {RegExp|function(string|Buffer): boolean} condition - Filter condition
     * @param {function(string|Buffer): void} callback - Receives matching errors
     * @returns {ProcessExecutor} self for chaining
     */
    onStderr(condition, callback) {
        if (typeof condition === 'function' && !callback) {
            callback = condition;
            condition = () => true;
        }
        
        if (condition instanceof RegExp) {
            const regex = condition;
            condition = data => regex.test(Buffer.from(data).toString());
        }
        
        if (typeof condition !== 'function') {
            throw new Error('Condition must be RegExp or function');
        }

        this.stderrCallbacks.push({ condition, callback });
        return this;
    }

    /**
     * Execute the process and return a promise with final results
     * @returns {Promise<{stdout: string, stderr: string}>}
     * @throws {Error} If process exits with non-zero code
     */
    async execute() {
        return new Promise((resolve) => {
            this.process.on('close', (code) => {
                const result = {
                    stdout: this.stdoutData,
                    stderr: this.stderrData,
                    code: code
                };
                resolve(result);
            });
        });
    }

}

module.exports = {
    ProcessExecutor
};
