const fs = require('fs');

module.exports = class Config {

	constructor(urlsFile) {
		this.urlsFile = urlsFile;
	}

    parseUrls(strUrls) {

        const re = new RegExp("(https?\\:\\/\\/\\S+\\/)\\s+(.*)", "g");
        const output = [];
        var match;

        do {
            match = re.exec(strUrls);
            if (match) {
                output.push({
                    url: match[1].trim(),
                    key: match[2].trim()
                });
            }
        } while (match);

        return output;

    }

    getUrls() {
        return new Promise(resolve => {
            fs.readFile(this.urlsFile, 'utf8' , (err, data) => {
                resolve(this.parseUrls(data));
            });
        });
    }

}