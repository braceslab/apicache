'use strict'

const storage = {
  Fs: require('./Fs'),
  Memory: require('./Memory'),
  Redis: require('./Redis')
}

module.exports = storage
