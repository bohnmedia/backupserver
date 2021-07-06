const Config = require('./lib/Config');
const config = new Config("/home/contaobackup/backupserver/urls.txt");
var urls;

config.getUrls().then(urls => {
    console.log(urls);
});
