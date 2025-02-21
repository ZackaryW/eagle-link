class EagleLinkHandler {
    match(text) {
        const result = (
            typeof text === 'string' &&
            (text.startsWith('http://localhost:41595') || text.startsWith('eagle://')) &&
            !text.includes(' ')
        );
        console.log('EagleLinkHandler match result:', result);
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

                    console.log(ctx);
                    const eagleLink = EagleLink.fromLink(
                        ctx.text, 
                        ctx.currentLibrary
                    );

                    // parse name
                    const tempFile = path.join(
                        eagle.os.tmpdir(), 
                        `link-${Date.now()}.eagleLink`
                    );
                    await eagleLink.toFile(tempFile);
                    console.log(eagleLink);
                    let useName;
                    try {
                        const id = eagleLink.id;
                        const type = eagleLink.type;
                        if (type == "item"){
                            const item = await eagle.item.getById(id);
                            useName = item.name;
                        } else if (type == "folder" || type == "smart-folder"){
                            const folder = await eagle.folder.getById(id);
                            useName = folder.name;
                        }
                    } catch (e) {
                        console.error('Error getting item or folder:', e);
                        useName = "Unknown";
                        
                    }
                    console.log("using name: ", useName);
                    
                    // if not current library, switch
                    if (selectedPath != ctx.currentLibrary) {
                        const { EagleApi} = require(path.join(eagle.plugin.path, 'utils', 'api'));
                        await EagleApi.library.switch(selectedPath);
                        // wait for 1 second
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    
                    
                    const folders = await eagle.folder.getSelected();
                    const libraryName = path.basename(ctx.currentLibrary).replace(".library", "");

                    await eagle.item.addFromPath(tempFile, {
                        name : libraryName + " - " + useName,
                        folders: folders.map(folder => folder.id)
                    });
                    
                    resolve(true);
                } catch(e) {
                    console.error('Processing failed:', e);
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

module.exports = { EagleLinkHandler }; 