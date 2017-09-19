'use strict'

const utils = {
  debug: function (a, b, c, d) {
    if (!utils._debug) {
      return
    }
    const arr = (['\x1b[36m[apicache]\x1b[0m', a, b, c, d]).filter(function (arg) { return arg !== undefined })
    console.log.apply(null, arr)
  },

  matches: function (a) {
    return function (b) { return a === b }
  },

  doesntMatch: function (a) {
    return function (b) { return !utils.matches(a)(b) }
  },

  logDuration: function (d, prefix) {
    var str = (d > 1000) ? ((d / 1000).toFixed(2) + 'sec') : (d + 'ms')
    return '\x1b[33m- ' + (prefix ? prefix + ' ' : '') + str + '\x1b[0m'
  },

  alloc: function (init) {
    return Buffer.alloc ? Buffer.alloc(init) : new Buffer(init)
  },

  toBuffer: function (data) {
    return Buffer.from ? Buffer.from(data) : new Buffer(data)
  }
}

module.exports = utils
