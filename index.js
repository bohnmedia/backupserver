const Backup = require('./lib/Backup');
const Config = require('./lib/Config');

const config = new Config('./servers.txt');

const backupAll = async function(servers) {

    for (let i=0; i<servers.length; i++) {
        console.log('Start backup: "' + servers[i].url + '"');
        const backup = new Backup(servers[i]);
        await backup.start();
    }

}

config.getServers(backupAll);