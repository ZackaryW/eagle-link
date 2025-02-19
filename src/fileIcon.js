const fs = require('fs');
const path = require('path');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            const iconPath = path.join(path.dirname(__dirname), "assets", "fileIcon.png");
            
            // Directly copy the pre-made icon file
            fs.copyFileSync(iconPath, dest);

            // Set fixed dimensions for the known icon size
            item.height = 512; 
            item.width = 512;

            return resolve(item);
        }
        catch (err) {
            alert(err);
            return reject(err);
        }
    });
}