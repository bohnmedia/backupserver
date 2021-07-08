const Api = require('./Api');
const Log = require('./Log');
const Archiver = require('archiver');
const { DateTime } = require('luxon');

const crypto = require('crypto');
const fs = require('fs');

module.exports = class Backup {
  constructor(server, options) {
    const url = new URL(server.url);

    this.server = server;
    this.url = server.url;
    this.key = server.key;
    this.hostname = url.hostname;
    this.api = new Api(server);
    this.options = options;

    // Directories
    this.cacheDir = './cache';
    this.hostDir = this.cacheDir + '/' + url.hostname;
    this.filesDir = this.hostDir + '/files';
    this.dumpFile = this.hostDir + '/dump.sql';
    this.backupDir = './backups';
    this.archiveDir = this.backupDir + '/' + this.hostname;

    this.backupTimeFormats = {
      minute: 'y-o-H-m',
      hour: 'y-o-H',
      day: 'y-o',
      week: 'y-W',
      month: 'y-L',
      year: 'y',
    };
    this.backups = this.getBackups();
    this.pending = this.getPending();
  }

  // Delete old files
  async deleteOldFiles(fileList) {
    const self = this;

    // Walk through files directory
    const processDir = async function (dir) {
      // Count items to check if directory is empty after deleting items
      var itemCounter = 0;

      const scanDir = dir ? self.filesDir + '/' + dir : self.filesDir;
      const items = fs.readdirSync(scanDir);

      for (let i = 0; i < items.length; i++) {
        let deleteFile = true;

        const item = items[i];
        const path = dir ? dir + '/' + item : item;
        const fullPath = self.filesDir + '/' + path;
        const stat = fs.lstatSync(fullPath);

        // If item is a directory call processDir function and skip the rest
        if (stat.isDirectory()) {
          itemCounter += await processDir(path);
          continue;
        }

        // Skip if file doesnt need to be deleted
        for (let i = 0; i < fileList.length; i++) {
          // Does file exist?
          if (fileList[i][0] === path) {
            // Does file have the same hash?
            const hash = await self.generateHash(fullPath);
            if (hash === fileList[i][1]) {
              Log.info('Keep file: "' + path + '"');
              deleteFile = false;
              break;
            }
          }
        }

        // Delete file if it doesnt exist in the list
        if (deleteFile) {
          Log.info('Delete: "' + path + '"');
          fs.unlinkSync(fullPath);

          // Increment itemCounter if file was not deleted
        } else {
          itemCounter++;
        }
      }

      return new Promise((resolve) => {
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
    };

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
  async downloadFiles(fileList) {
    const self = this;

    return new Promise(async function (resolve, reject) {
      for (let i = 0; i < fileList.length; i++) {
        let item = fileList[i];
        let filename = item[0];
        let arrFilename = filename.split('/');
        let fullPath = self.filesDir + '/' + filename;

        // Create folder if it doesnt exist
        for (let i = 1; i < arrFilename.length; i++) {
          let path = arrFilename.slice(0, i).join('/');
          let partPath = self.filesDir + '/' + path;
          if (!fs.existsSync(partPath)) fs.mkdirSync(partPath);
        }

        if (fs.existsSync(fullPath)) {
          Log.info('Skip download: "' + filename + '"');
          continue;
        }

        await self.api.downloadFile(filename, fullPath);
      }

      resolve();
    });
  }

  // Create a zip archive
  async createArchive() {
    const self = this;
    const output = [];
    const archive = Archiver('zip');
    var closeCounter = 0;

    // Create file stream for every pending type
    for (let i = 0; i < self.pending.length; i++) {
      const filename =
        self.archiveDir +
        '/' +
        self.pending[i] +
        '_' +
        DateTime.now().toFormat('yyyy-LL-dd_HH-mm-ss') +
        '_' +
        this.hostname +
        '.zip';
      Log.info('Archive: "' + filename + '"');
      output.push(fs.createWriteStream(filename));
    }

    return new Promise(function (resolve, reject) {
      for (let i = 0; i < output.length; i++) {
        output[i].on('close', function () {
          closeCounter++;
          if (closeCounter === output.length) resolve();
        });

        archive.pipe(output[i]);
      }

      archive.directory(self.hostDir, false);
      archive.finalize();
    });
  }

  // Find all backups
  getBackups() {
    // Generate empty backups object
    const backups = {};
    for (let type in this.backupTimeFormats) {
      backups[type] = [];
    }

    // Return empty object when directory doesnt exist
    if (!fs.existsSync(this.archiveDir)) return backups;

    // Read dir
    const items = fs.readdirSync(this.archiveDir);
    for (let i = 0; i < items.length; i++) {
      const type = items[i].replace(/_.*/, '');
      if (backups[type]) {
        backups[type].push({
          filename: items[i],
          mtime: fs.statSync(this.archiveDir + '/' + items[i]).mtimeMs,
        });
      }
    }

    // Order backups by date
    for (let type in backups) {
      backups[type].sort((a, b) => a.mtime - b.mtime);
    }

    return backups;
  }

  // Check if updates are pending
  getPending() {
    const pending = [];
    const now = DateTime.now();

    // Check all types in backup options
    for (let type in this.options.backupsPerServer) {
      // If number was set to 0, continue
      if (this.options.backupsPerServer[type] == 0) continue;

      // Add type to the pending array
      pending.push(type);

      // Generate a string for DateTime comparion
      const nowFormat = now.toFormat(this.backupTimeFormats[type]);

      // Check if backup already exists
      for (let i = 0; i < this.backups[type].length; i++) {
        // Convert mtime (in milliseconds) to string for comparion
        const mtimeFormat = DateTime.fromMillis(
          this.backups[type][i].mtime
        ).toFormat(this.backupTimeFormats[type]);

        // If a backup for this type already exists, remove the type from array again
        if (mtimeFormat === nowFormat) {
          pending.pop();
          break;
        }
      }
    }

    return pending;
  }

  // Delete old backups
  deleteOldBackups() {
    for (var type in this.backups) {
      // Get max backups for this type
      let typeMaxBackups = Math.max(
        this.options.backupsPerServer[type] || 0,
        0
      );

      // Reduce max by one if a backup is pending
      if (typeMaxBackups && this.pending.includes(type)) typeMaxBackups--;

      // Is length of backups higher than the max?
      while (this.backups[type].length > typeMaxBackups) {
        // Fetch oldest backup
        const backup = this.backups[type].shift();

        // Delete backup
        Log.info('Delete backup: "' + backup.filename + '"');
        fs.unlinkSync(this.archiveDir + '/' + backup.filename);
      }
    }
  }

  async start() {
    const self = this;

    return new Promise(function (resolve, reject) {
      self.deleteOldBackups();

      // Skip if the pending array is empty
      if (self.pending.length === 0) {
        Log.info('Skip backup');
        return resolve();
      }

      // Create directories
      [
        self.cacheDir,
        self.hostDir,
        self.filesDir,
        self.backupDir,
        self.archiveDir,
      ].forEach((dir) => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      });

      // Load remote file list
      self.api.getList(async (fileList) => {
        await self.deleteOldFiles(fileList);
        await self.downloadFiles(fileList);
        await self.api.dumpDb(self.dumpFile);
        await self.createArchive();
        Log.success('Backup completed');
        resolve();
      });
    });
  }
};
