class ClipboardBaseManager {
    constructor() {
        this.handlers = [];
    }

    registerHandler(handler) {
        if (typeof handler.match !== 'function' || typeof handler.handle !== 'function') {
            throw new Error('Handler must implement match() and handle() methods');
        }
        this.handlers.push(handler);
        handler.manager = this;
    }

    hasMatch(text) {
        if (!text) return false;
        for (const handler of this.handlers) {
            if (handler.match(text)) {
                console.log(`Handler ${handler.constructor.name} matched text`);
                return true;
            }
        }
        return false;
    }

    async processText(text, context) {
        const handler = this.handlers.find(h => h.match(text));
        if (!handler) return false;

        const modal = this.#createModal();
        document.body.appendChild(modal);
        
        // Auto-populate library selection
        this.#addBaseComponents(modal, context.libraries);

        const ctx = {
            text,
            eagle: eagle,
            currentLibrary: eagle.library.path,
            libraries: context.libraries,
            modal,
            manager: this,
            librarySelect: modal.querySelector('#libraryInput'), // Add reference
            handler: handler // Add handler to context
        };

        return handler.handle(ctx);
    }

    #createModal() {
        const modal = document.createElement('div');
        modal.className = 'clipboard-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-body">
                    <div id="base-library-select-container" style="color: white;">
                        <div class="search-container">
                            <input type="text" 
                                   id="libraryInput" 
                                   class="search-bar" 
                                   placeholder="Select or type library..."
                                   autocomplete="off">
                            <div class="dropdown-options" id="libraryDropdown"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="modal-confirm">Confirm</button>
                    <button class="modal-cancel">Cancel</button>
                </div>
            </div>
        `;
        return modal;
    }

    #addBaseComponents(modal, libraries) {
        const container = modal.querySelector('#base-library-select-container');
        container.insertAdjacentHTML('afterbegin', 
            '<p class="library-prompt">Add to library:</p>');
        
        const input = container.querySelector('#libraryInput');
        const dropdown = container.querySelector('#libraryDropdown');
        
        // Show dropdown when input is focused
        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
            this.filterDropdown(input, dropdown);
        });
        
        // Pass input reference when populating
        this.populateLibraryDropdown(input, dropdown, libraries);
    }

    // Updated method signature
    populateLibraryDropdown(input, dropdown, libraries) {
        dropdown.innerHTML = '';
        
        // Current Library option
        const currentOption = document.createElement('div');
        currentOption.className = 'dropdown-option';
        currentOption.dataset.value = 'current';
        currentOption.textContent = 'Current Library';
        currentOption.addEventListener('click', () => {
            input.value = 'Current Library';
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(currentOption);

        // Other libraries
        libraries.forEach(lib => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.dataset.value = lib;
            option.textContent = path.basename(lib).replace(/\.library$/, '');
            option.addEventListener('click', () => {
                input.value = option.textContent;
                input.dataset.selectedValue = option.dataset.value;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(option);
        });

        // Add click outside handler
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                dropdown.style.display = 'none';
            }
        });
    }

    // Updated filterDropdown parameters
    filterDropdown(input, dropdown) {
        const searchTerm = input.value.toLowerCase();
        const options = dropdown.querySelectorAll('.dropdown-option');
        
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
        
        dropdown.style.display = 'block';
    }

    // Shared library selection creation
    addLibrarySelection(modal, libraries) {
        const container = modal.querySelector('#base-library-select-container');
        container.appendChild(this.createLibrarySelect(libraries));
    }

    createLibrarySelect(libraries) {
        const select = document.createElement('select');
        select.className = 'base-library-select';
        select.id = 'libraryInput';
        
        // Current Library option
        const currentOption = document.createElement('option');
        currentOption.value = 'current';
        currentOption.textContent = 'Current Library';
        select.appendChild(currentOption);

        // Other libraries
        libraries.forEach(lib => {
            const option = document.createElement('option');
            option.value = lib;
            // Remove .library extension from display name
            option.textContent = path.basename(lib).replace(/\.library$/, '');
            select.appendChild(option);
        });

        return select;
    }

    async populateModalWithLibraries(modal, libraries) {
        const select = this.createLibrarySelect(libraries);
        modal.querySelector('.modal-body').appendChild(select);
    }

    // Generic confirmation handler
    async handleDefaultConfirmation(modal, handler) {
        return new Promise((resolve) => {
            modal.querySelector('.modal-confirm').addEventListener('click', async () => {
                const result = await handler.onConfirm(modal);
                resolve(result);
                modal.remove();
            });
        });
    }

    setupModalHandlers(ctx, processFn) {
        return new Promise((resolve) => {
            ctx.modal.querySelector('.modal-confirm').addEventListener('click', async () => {
                try {
                    const selectedPath = this.getSelectedLibrary(ctx.modal);
                    
                    // Add pre-callback execution
                    if (typeof ctx.handler.preCallback === 'function') {
                        ctx.handlerData = await ctx.handler.preCallback(ctx);
                    }

                    // Common library switching logic
                    if (selectedPath !== ctx.currentLibrary) {
                        const { EagleApi } = require(path.join(eagle.plugin.path, 'utils', 'api'));
                        await EagleApi.library.switch(selectedPath);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    // Execute handler-specific processing with stored data
                    await processFn(ctx, selectedPath);
                    
                    resolve(true);
                } catch(e) {
                    console.error('Processing failed:', e);
                    resolve(false);
                } finally {
                    ctx.modal.remove();
                    ctx.handlerData = null; // Reset stored data
                }
            });

            ctx.modal.querySelector('.modal-cancel').addEventListener('click', () => {
                resolve(false);
                ctx.modal.remove();
            });
        });
    }

    getSelectedLibrary(modal) {
        const inputValue = modal.querySelector('#libraryInput').value;
        const selectedOption = Array.from(modal.querySelectorAll('.dropdown-option'))
            .find(option => option.textContent === inputValue);
        const selectedValue = selectedOption?.dataset.value || 'current';
        return selectedValue === 'current' ? eagle.library.path : selectedValue;
    }
}

module.exports = {
    ClipboardBaseManager
}; 