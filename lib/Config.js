const fs = require('fs');

module.exports = class Config {

	constructor(serversFile) {

		this.serversFile = serversFile;

	}

    parseServers(strServers) {

        // Regular expression for lineparsing
        const re = new RegExp("(https?\\:\\/\\/\\S+\\/)\\s+(.*)", "g");

        // Array for output
        const output = [];

        // Parse every line in servers.txt
        var match;
        do {
            match = re.exec(strServers);
            if (match) {
                output.push({
                    url: match[1].trim(),
                    key: match[2].trim()
                });
            }
        } while (match);

        // Output array
        return output;

    }

    getServers(callback) {

        fs.readFile(this.serversFile, 'utf8' , (err, data) => {
            callback(this.parseServers(data));
        });

    }

}