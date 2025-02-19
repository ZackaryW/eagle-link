class EagleApi {
    static token = null;

    static async _internalGetToken() {
        if (EagleApi.token) {
            return EagleApi.token;
        }

        try {
            let res = await fetch("http://localhost:41595/api/application/info");
            if (!res) {
                throw new Error("No response from Eagle");
            }
            let raw = await res.json();
            let token = raw.data.preferences.developer.apiToken;
            if (token) {
                EagleApi.token = token;
                return token;
            }
        } catch (error) {
            console.error(error);
        }
        return null;
    }

    static _internalRequest(path, methodname, data = null, params = null) {
        return EagleApi._internalGetToken().then(token => {
            if (!token) {
                throw new Error("No token found");
            }

            let url = `http://localhost:41595/api/${path}?token=${token}`;
            if (params) {
                params = Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== null));
                url += "&" + Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");
            }
            let res = null;

            if (methodname == "POST") {
                if (data) {
                    data = Object.fromEntries(Object.entries(data).filter(([k, v]) => v !== null));
                }

                res = fetch(url, {method: "POST", headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
            } else {
                res = fetch(url);
            }
            
            return res
                .then(response => response.json())
                .then(json => {
                    return json.data;
                })
                .catch(error => {
                    console.error('Request failed:', error);
                    throw error;
                });
        });
    }

    static application = class {
        static info() {
            return EagleApi._internalRequest("application/info", "GET");
        }
    }

    static folder = class {
        static create(name, parentId = null) {
            return EagleApi._internalRequest("folder/create", "POST", {folderName: name, parent: parentId}).then(data => {
                return data;
            });
        }

        static rename(folderId, newName) {
            return EagleApi._internalRequest("folder/rename", "POST", {folderId, newName});
        }

        static update({folderId, newName = null, newDescription = null, newColor = null}) {
            return EagleApi._internalRequest("folder/update", "POST", {
                folderId,
                newName,
                newDescription,
                newColor
            });
        }

        static list() {
            return EagleApi._internalRequest("folder/list", "GET");
        }

        static listRecent() {
            return EagleApi._internalRequest("folder/listRecent", "GET");
        }
    }

    static library = class {
        static info() {
            return EagleApi._internalRequest("library/info", "GET");
        }

        static history() {
            return EagleApi._internalRequest("library/history", "GET");
        }

        static switch(libraryPath) {
            return EagleApi._internalRequest("library/switch", "POST", {libraryPath});
        }

        static icon(libraryPath) {
            return EagleApi._internalRequest("library/icon", "GET", null, {libraryPath});
        }
    }

    static item = class {
        static update({itemId, tags = null, annotation = null, url = null, star = null}) {
            return EagleApi._internalRequest("item/update", "POST", {
                id: itemId,
                tags,
                annotation,
                url,
                star
            });
        }

        static refreshThumbnail(itemId) {
            return EagleApi._internalRequest("item/refreshThumbnail", "POST", {id: itemId});
        }

        static refreshPalette(itemId) {
            return EagleApi._internalRequest("item/refreshPalette", "POST", {id: itemId});
        }

        static moveToTrash(itemIds) {
            return EagleApi._internalRequest("item/moveToTrash", "POST", {itemIds});
        }

        static list({limit = 200, offset = 0, orderBy = null, keyword = null, ext = null, tags = null, folders = null}) {
            return EagleApi._internalRequest("item/list", "GET", null, {
                limit,
                offset,
                orderBy,
                keyword,
                ext,
                tags,
                folders
            });
        }

        static getThumbnail(itemId) {
            return EagleApi._internalRequest("item/thumbnail", "GET", null, {id: itemId});
        }

        static getInfo(itemId) {
            return EagleApi._internalRequest("item/info", "GET", null, {id: itemId});
        }

        static addBookmark({url, name, base64 = null, tags = null, modificationTime = null, folderId = null}) {
            return EagleApi._internalRequest("item/addBookmark", "POST", {
                url,
                name,
                base64,
                tags,
                modificationTime,
                folderId
            });
        }

        static addFromUrl({url, name, website = null, tags = null, star = null, annotation = null, 
                         modificationTime = null, folderId = null, headers = null}) {
            return EagleApi._internalRequest("item/addFromUrl", "POST", {
                url,
                name,
                website,
                tags,
                star,
                annotation,
                modificationTime,
                folderId,
                headers
            });
        }

        static addFromPath({path, name, website = null, annotation = null, tags = null, folderId = null}) {
            return EagleApi._internalRequest("item/addFromPath", "POST", {
                path,
                name,
                website,
                annotation,
                tags,
                folderId
            });
        }

        static addFromURLs({items, folderId = null}) {
            return EagleApi._internalRequest("item/addFromURLs", "POST", {
                items,
                folderId
            });
        }
    }
}

class EagleApiUtils {
    static closestLibrary(libraryName) {
        return EagleApi.library.history().then(histories => {
            const names = histories.map(history => [path.basename(history).replace('.library', ''), history]);

            // Calculate similarity scores using Levenshtein distance
            let scores = {};
            for (const [name, fullpath] of names) {
                scores[fullpath] = this._calculateSimilarity(libraryName, name);
            }
            return scores;
        });
    }

    static _calculateSimilarity(a, b) {
        a = a.toLowerCase();
        b = b.toLowerCase();
        
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b.charAt(i-1) === a.charAt(j-1) ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i-1][j] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j-1] + cost
                );
            }
        }

        const distance = matrix[b.length][a.length];
        const maxLength = Math.max(a.length, b.length);
        return 1 - distance / maxLength;
    }

    static switchLibrary(libraryName, exactMatch = false, maxDistance = 0.5) {
        if (exactMatch) {
            EagleApi.library.history().then(histories => {
                for (const history of histories) {
                    if (path.basename(history) == libraryName) {
                        EagleApi.library.switch(history);
                        return;
                    }
                }
            });
        }

        this.closestLibrary(libraryName).then(scores => {
            console.log("scoring table:", scores);
            // Find candidate with highest score
            let closest = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
            if (closest[1] > maxDistance) {
                EagleApi.library.switch(closest[0]);
            } else {
                throw new Error("No library found");
            }
        });
    }
}

module.exports = {
    EagleApi,
    EagleApiUtils
}
