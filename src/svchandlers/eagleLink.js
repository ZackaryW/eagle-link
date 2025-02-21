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

    async preCallback(ctx) {
        const eagleLink = EagleLink.fromLink(ctx.text, ctx.currentLibrary);
        return {
            useName: await this.resolveItemName(eagleLink),
            eagleLink // Store for use in handle
        };
    }

    async handle(ctx) {
        return ctx.manager.setupModalHandlers(ctx, async (ctx, selectedPath) => {
            const tempFile = path.join(eagle.os.tmpdir(), `link-${Date.now()}.eagleLink`);
            await ctx.handlerData.eagleLink.toFile(tempFile);

            const libraryName = path.basename(ctx.currentLibrary).replace(".library", "");
            
            const folders = await eagle.folder.getSelected();
            await eagle.item.addFromPath(tempFile, {
                name: `${libraryName} - ${ctx.handlerData.useName}`,
                folders: folders.map(folder => folder.id)
            });
        });
    }

    async resolveItemName(eagleLink) {
        try {
            const id = eagleLink.id;
            const type = eagleLink.type;
            if (type === "item") {
                const item = await eagle.item.getById(id);
                return item.name;
            }
            if (type === "folder" || type === "smart-folder") {
                const folder = await eagle.folder.getById(id);
                return folder.name;
            }
            return "Unknown";
        } catch (e) {
            console.error('Error getting item/folder:', e);
            return "Unknown";
        }
    }
}

module.exports = { EagleLinkHandler }; 