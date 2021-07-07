const Api = require('./Api');
const Archiver = require('archiver');
const { DateTime } = require("luxon");

const crypto = require('crypto');
const fs = require('fs');

module.exports = class Backup {

    constructor(server) {

        const url = new URL(server.url);

        this.server = server;
		this.url = server.url;
		this.key = server.key;
		this.hostname = url.hostname;
        this.api = new Api(server);

    }

    // Load filelist
    loadFilelist(hostDir) {

        const filename = hostDir + '/files.json';

        // Return empty array if file not exists
        if (!fs.existsSync(filename)) return [];

        // Read json from file
        const strJson = fs.readFileSync(filename);
        const objFiles = JSON.parse(strJson);

        // Return json
        return objFiles;

    }

    // Delete old files
    async deleteOldFiles(filesDir, fileList) {

        const self = this;

        // Walk through files directory
        const processDir = async function(dir) {

            // Count items to check if directory is empty after deleting items
            var itemCounter = 0;

            const scanDir = dir ? filesDir + '/' + dir : filesDir;
            const items = fs.readdirSync(scanDir);

            for (let i=0; i < items.length; i++) {

                let deleteFile = true;

                const item = items[i];
                const path = dir ? dir + '/' + item : item;
                const fullPath = filesDir + '/' + path;
                const stat = fs.lstatSync(fullPath);

                // If item is a directory call processDir function and skip the rest
                if (stat.isDirectory()) {
                    itemCounter += await processDir(path);
                    continue;
                }

                // Skip if file doesnt need to be deleted
                for (let i=0; i<fileList.length; i++) {

                    // Does file exist?
                    if (fileList[i][0] === path) {

                        // Does file have the same hash?
                        const hash = await self.generateHash(fullPath);
                        if (hash === fileList[i][1]) {
                            console.log('Keep file: "' + path + '"');
                            deleteFile = false;
                            break;
                        }

                    }
                }

                // Delete file if it doesnt exist in the list
                if (deleteFile) {
                    console.log('Delete: "' + path + '"');
                    fs.unlinkSync(fullPath);

                // Increment itemCounter if file was not deleted
                } else {
                    itemCounter++;
                }

            }

            return new Promise(resolve => {

                // Do not delete root directory
                if (!dir) return resolve();

                // If directory is not empty, return 1
                if (itemCounter) {
                    return resolve(1);
                }
                
                // If directory is empty, delete it and return 0
                if (!itemCounter) {
                    fs.rmdirSync(scanDir);
                    resolve(0);
                }

            });

        }

        await processDir();

    }

    // Generate hash
    generateHash(path) {

        return new Promise(function (resolve, reject) {

            const hash = crypto.createHash('md5');
            const input = fs.createReadStream(path);

            input.on('data', function (chunk) {
                hash.update(chunk);
            });

            input.on('close', function () {
                resolve(hash.digest('hex'));
            });

        });

    }

    // Download files
    async downloadFiles(filesDir, fileList) {

        const self = this;

        return new Promise(async function (resolve, reject) {

            for (let i=0; i<fileList.length; i++) {

                let item = fileList[i];
                let filename = item[0];
                let arrFilename = filename.split("/");
                let fullPath = filesDir + '/' + filename;

                // Create folder if it doesnt exist
                for (let i=1; i<arrFilename.length; i++) {
                    let path = arrFilename.slice(0,i).join("/");
                    let partPath = filesDir + '/' + path;
                    if (!fs.existsSync(partPath)) fs.mkdirSync(partPath);
                }

                if (fs.existsSync(fullPath)) {
                    console.log('Skip download: "' + filename + '"');
                    continue;
                }

                await self.api.downloadFile(filename, fullPath);

            }

            resolve();

        });

    }

    async createArchive(hostDir, archiveDir) {
        const filename = archiveDir + '/' + DateTime.now().toFormat("yyyy-LL-dd_HH-mm-ss_") + this.hostname + '.zip';
        const output = fs.createWriteStream(filename);
        const archive = Archiver('zip');

        return new Promise(function (resolve, reject) {

            output.on('close', function () {
                console.log('Archive created: "' + filename + '"');
                resolve();
            });

            archive.pipe(output);
            archive.directory(hostDir, false);
            archive.finalize();

        });

    }
    
    async start() {

        const self = this;

        return new Promise(function (resolve, reject) {

            const cacheDir = './cache';
            const hostDir = cacheDir + '/' + self.hostname;
            const filesDir = hostDir + '/files';
            const dumpFile = hostDir + '/dump.sql';
            const backupDir = './backups';
            const archiveDir = backupDir + '/' + self.hostname;

            // Create directories
            [cacheDir, hostDir, filesDir, backupDir, archiveDir].forEach(dir => {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            });
            
            // Load local file list
            const localFileList = self.loadFilelist(hostDir);

            // Load remote file list
            self.api.getList(async (fileList) => {
                await self.deleteOldFiles(filesDir, fileList);
                await self.downloadFiles(filesDir, fileList);
                await self.api.dumpDb(dumpFile);
                await self.createArchive(hostDir, archiveDir);
                resolve();
            });

        });
        
    }

}
