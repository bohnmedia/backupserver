const Backup = require(__dirname + "/lib/Backup");
const Config = require(__dirname + "/lib/Config");
const Log = require(__dirname + "/lib/Log");

const config = new Config(__dirname + "/servers.txt");
const options = {
  backupsPerServer: {
    hour: 3,
    day: 7,
    week: 4,
    month: 3,
    year: 1,
  },
};

const backupAll = async function (servers) {
  for (let i = 0; i < servers.length; i++) {
    const backup = new Backup(servers[i], options);
    Log.info('Start backup: "' + servers[i].url + '"');
    await backup.start();
  }
};

config.getServers(backupAll);
