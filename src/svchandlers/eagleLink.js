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
                    const selectedPath = ctx.librarySelect.value === "current" 
                        ? null 
                        : ctx.librarySelect.value;
                    
                    const eagleLink = EagleLink.fromLink(
                        ctx.text, 
                        selectedPath || ctx.currentLibrary
                    );
                    const tempFile = path.join(
                        eagle.os.tmpdir(), 
                        `link-${Date.now()}.eagleLink`
                    );
                    
                    const folders = await eagle.folder.getSelected();
                    await eagleLink.toFile(tempFile);

                    const id = eagleLink.id;
                    const type = eagleLink.type;
                    let useName;
                    if (type == "item"){
                        const item = await eagle.item.getById(id);
                        useName = item.name;
                    } else if (type == "folder" || type == "smart-folder"){
                        const folder = await eagle.folder.getById(id);
                        useName = folder.name;
                    }
                    console.log(useName);

                    await eagle.item.addFromPath(tempFile, {
                        name : useName,
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