'use strict'

const Storage = require('./Storage')
const log = require('log-segment')
const fs = require('fs-extra')

log.set({
  segments: {
    'apicache-fs': {
      color: 'white'
    }
  }
})

class Fs extends Storage {
  constructor (options) {
    super()
    if (!options.cwd) {
      log.error('apicache-fs', 'constructor', 'missing options: cwd')
      throw Error(options.cwd + ' is not a valid path')
    }
    // init
    fs.ensureDir(options.cwd)
    if (options.resume) {
      // load index
    }

    this.options = options
  }

  /**
   * lazy load content
   * @param {string} key
   */
  get (key) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .get method')
      reject(new Error('storage.get method to be implemented'))
    })
  }

  /**
   * write content
   * @param {string} key
   */
  set (key, value, duration, expireCallback) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .set method')
      reject(new Error('storage.set method to be implemented'))
    })
  }

  /**
   * delete key
   * @param {string} key
   */
  delete (key) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .delete method')
      reject(new Error('storage.delete method to be implemented'))
    })
  }

  /**
   * remove all - drop dir
   */
  clear (entries) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .clear method')
      reject(new Error('storage.clear method to be implemented'))
    })
  }
}

module.exports = Fs

/*
promised Storage
  no chain for clear and delete
refactor var => const, let
use standardjs style
log-segment instead of debug function (merge debug function into log segment)
async lib for redis client

@todo
doc api:
  options: redisClient => storage.type, client ...
  fs options: cwd, resume

tests
test redis
*/
