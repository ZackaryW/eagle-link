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
            librarySelect: modal.querySelector('#libraryInput') // Add reference
        };

        return handler.handle(ctx);
    }

    #createModal() {
        const modal = document.createElement('div');
        modal.className = 'clipboard-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-body">
                    <div id="base-library-select-container" style="color: white;"></div>
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
        container.appendChild(this.createLibrarySelect(libraries));
        container.insertAdjacentHTML('afterbegin', 
            '<p class="library-prompt">Add to library:</p>');
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
}

module.exports = {
    ClipboardBaseManager
}; 