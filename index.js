const Backup = require('./lib/Backup');
const Config = require('./lib/Config');

const config = new Config('./servers.txt');
const options = {
    backupsPerServer: {
        hour: 3,
        day: 7,
        week: 4,
        month: 3
    }
}

const backupAll = async function(servers) {

    for (let i=0; i<servers.length; i++) {
        const backup = new Backup(servers[i], options);
        console.log('Start backup: "' + servers[i].url + '"');
        await backup.start();
    }

}

config.getServers(backupAll);