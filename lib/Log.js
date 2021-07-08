const colors = require('colors');

module.exports = class Log {
  static success(msg) {
    console.log(msg.green);
  }

  static info(msg) {
    console.log(msg);
  }

  static warning(msg) {
    console.log(msg.yellow);
  }

  static error(msg) {
    console.log(msg.red);
  }
};
