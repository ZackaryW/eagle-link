class PathstrHandler {
    constructor(eagle) {
        this.eagle = eagle;
    }

    match(pathStr) {
        let result;
        try {
            const fs = require('fs');
            const normalizedPath = path.normalize(pathStr.replace(/\\/g, '/'));
            
            // Check if path exists as either file or directory
            const stats = fs.statSync(normalizedPath);
            result = stats.isFile() || stats.isDirectory();
        } catch(e) {
            result = false;
        }
        console.log('PathstrHandler match result:', result);
        return result;
    }

    async handle(ctx) {
        return new Promise((resolve) => {
            ctx.modal.querySelector('.modal-confirm').addEventListener('click', async () => {
                try {
                    const inputValue = ctx.modal.querySelector('#libraryInput').value;
                    const selectedOption = Array.from(ctx.modal.querySelectorAll('.dropdown-option'))
                        .find(option => option.textContent === inputValue);
                    const selectedValue = selectedOption?.dataset.value || 'current';
                    const selectedPath = selectedValue === 'current' ? eagle.library.path : selectedValue;
                    
                    const targetPath = path.resolve(ctx.text);
                    const tempFile = path.join(
                        eagle.os.tmpdir(),
                        `path-${Date.now()}.eagleLink`
                    );

                    // Create EagleLink instance and save to temp file
                    const eagleLink = EagleLink.fromPath(targetPath, selectedPath);
                    const folders = await this.eagle.folder.getSelected();
                    await eagleLink.toFile(tempFile);
                    
                    if (selectedPath != ctx.currentLibrary) {
                        const { EagleApi} = require(path.join(eagle.plugin.path, 'utils', 'api'));
                        await EagleApi.library.switch(selectedPath);
                        // wait for 1 second
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    // Add to Eagle library
                    await this.eagle.item.addFromPath(tempFile, {
                        name : path.basename(targetPath),
                        folders: folders.map(folder => folder.id)
                    });

                    resolve(true);
                } catch(e) {
                    console.error('Path processing failed:', e);
                    resolve(false);
                } finally {
                    ctx.modal.remove();
                }
            });

            ctx.modal.querySelector('.modal-cancel').addEventListener('click', () => {
                resolve(false);
                ctx.modal.remove();
            });
        });
    }
}

module.exports = { PathstrHandler };
