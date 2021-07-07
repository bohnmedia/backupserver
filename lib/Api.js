const https = require('https');
const fs = require('fs');

module.exports = class Api {

    constructor(server) {

        const url = new URL(server.url);

		this.url = server.url;
		this.key = server.key;
		this.hostname = url.hostname;

	}

    // Ajax call
    getAjax(url, callback) {

        var data = '';
        const options = new URL(url);
        const req = https.request(options, res => {

            // Write data to jsonString
            res.on('data', d => {
                data += d;
            });

            // Send parsed json to callback
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    throw new Error(data);
                }
                const objJson = JSON.parse(data);
                callback(objJson);
            });

        });
        req.end();

    }

    // Get list
    getList(callback) {

        const url = this.url + 'contaobackup/list?key=' + this.key;
        console.log('Get filelist: "' + url + '"');
        this.getAjax(url, data => {
            callback(data);
        });

    }

    // Sync files
    syncFiles(files) {

        const cacheDir = './cache';
        const hostDir = cacheDir + '/' + this.hostname;
        const filesDir = hostDir + '/files';
        const fileList = this.loadFilelist(hostDir);

        // Create folders
        [cacheDir, hostDir, filesDir].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        });

    }

    // Download
    download(url, destination) {
        return new Promise(resolve => {
            const file = fs.createWriteStream(destination);
            const request = https.get(url, function(response) {
                response.pipe(file);
                file.on('finish', function() {
                    file.close();
                    resolve();
                });
            });
        });
    }

    // Download file
    downloadFile(filename, destination) {
        const url = this.url + 'contaobackup/file?name=' + encodeURIComponent(filename) + '&key=' + this.key;
        console.log('Download: "' + filename + '" => "' + destination + '"');
        return this.download(url, destination);
    }

    // Dump database
    dumpDb(destination) {
        const url = this.url + 'contaobackup/dumpdb?&key=' + this.key;
        console.log('Dump database');
        return this.download(url, destination);
    }

    // Backup server
    backupServer() {

        // Get list of files
        this.getList(data => this.syncFiles(data));

    }

}