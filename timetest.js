const { DateTime } = require("luxon");

const cTime = DateTime.fromISO("2021-07-07T17:41:23.254Z");

console.log(cTime.toFormat('y-o'));