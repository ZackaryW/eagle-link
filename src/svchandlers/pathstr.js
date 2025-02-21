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
        return ctx.manager.setupModalHandlers(ctx, async (ctx, selectedPath) => {
            const targetPath = path.resolve(ctx.text);
            const tempFile = path.join(eagle.os.tmpdir(), `path-${Date.now()}.eagleLink`);
            
            // Handler-specific path handling
            const eagleLink = EagleLink.fromPath(targetPath, selectedPath);
            await eagleLink.toFile(tempFile);
            
            const folders = await this.eagle.folder.getSelected();
            await this.eagle.item.addFromPath(tempFile, {
                name: path.basename(targetPath),
                folders: folders.map(folder => folder.id)
            });
        });
    }
}

module.exports = { PathstrHandler };
