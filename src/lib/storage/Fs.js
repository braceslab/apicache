'use strict'

const Promise = require('bluebird')
const log = require('log-segment')
const fs = require('fs-extra')
const path = require('path')

const Storage = require('./interface')

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
    this.type = 'fs'
    this.index = {}

    if (!options.cwd) {
      log.error('apicache-fs', 'constructor', 'missing options: cwd')
      throw Error(options.cwd + ' is not a valid path')
    }
    this.cwd = options.cwd
    this.options = options.resume

    this.setup()
  }

  setup () {
    const _this = this
    return new Promise((resolve, reject) => {
      // init
      fs.ensureDir(_this.options.cwd)
        .then(() => {
          return fs.ensureDir(path.join(_this.options.cwd, 'index'))
        })
        .then(() => {
          if (_this.options.resume) {
            return _this.resume()
          }
        })
        .then(resolve)
        .catch(reject)
    })
  }

  resume () {
    const _this = this
    return new Promise((resolve, reject) => {
      // load index files
      _this.index = {}
      fs.readDir(path.join(_this.options.cwd, 'index'))
        .then((files) => {
          files.forEach(file => {
            console.log(file)
            // @todo if isFile
            fs.readFile(file)
              .then((content) => {
                try {
                  const _index = JSON.parse(content)
                  _this.index[_index.key] = _index
                } catch (e) {
                  log.warning('apicache-fs', 'resume', 'skip index file', log.v('file', file))
                }
              })
          })
        })
        .then(resolve)
        .catch(reject)
    })
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
