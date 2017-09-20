'use strict'

const Promise = require('bluebird')
const log = require('log-segment')
const fs = require('fs-extra')
const uuid = require('uuid/v4')
const path = require('path')

const Storage = require('./interface')

log.set({
  segments: {
    'apicache-fs': {
      color: 'white'
    }
  }
})

function index (key) {
  return {
    id: uuid(),
    key: key,
    expire: null
  }
}

function entry (value, expire) {
  return {
    value: null,
    expire: 0
  }
}

class Fs extends Storage {
  constructor (options) {
    super()
    this.type = 'fs'
    this.index = {}
    this.store = {}

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
      _this.index = {}
      let _files
      fs.readDir(path.join(_this.options.cwd, 'index'))
        .then((files) => {
          _files = files
          const _tasks = []
          _files.forEach((file, i) => {
            _tasks.push(fs.stat(file))
          })
          return Promise.all(_tasks)
        })
        .then((stats) => {
          const _indexes = []
          _files.forEach((file, i) => {
            if (stats[i].isFile()) {
              _indexes.push(fs.readJson(file))
            }
          })
          return Promise.all(_indexes)
        })
        .then((contents) => {
          contents.forEach((content) => {
            _this.index[content.key] = content
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
    const _this = this
    return new Promise((resolve, reject) => {
      if (!_this.index[key]) {
        resolve(entry(null, 0))
        return
      }

      const id = _this.index[key].id
      if (_this.store[id]) {
        resolve(_this.store[id])
        return
      }

      fs.readFile(path.join(_this.options.cwd, id))
        .then((content) => {
          _this.store[id] = entry(content, _this.index[key].expire)
          resolve(_this.store[id])
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  /**
   * write content
   * @todo set store size limit, if exceed discard some entries from .store - will be read from fs
   * policy to discard: add request counter on index, discard less requested
   * @param {string} key
   */
  set (key, value, duration) {
    const _this = this
    return new Promise((resolve, reject) => {
      _this.index[key] = index(key)
      const id = _this.index[key].id
      _this.store[id] = entry(value, Date.now() + duration)

      Promise.all([
        fs.writeFile(path.join(_this.options.cwd, id), value),
        fs.writeJson(path.join(_this.options.cwd, 'index', id), _this.index[key])
      ])
        .then(resolve)
        .catch(reject)
    })
  }

  /**
   * delete key
   * @param {string} key
   */
  delete (key) {
    const _this = this
    return new Promise((resolve, reject) => {
      if (!_this.index[key]) {
        resolve()
        return
      }

      const id = _this.index[key].id
      delete _this.index[key]
      delete _this.store[id]

      Promise.all([
        fs.remove(path.join(_this.options.cwd, id)),
        fs.remove(path.join(_this.options.cwd, 'index', id))
      ])
        .then(resolve)
        .catch(reject)
    })
  }

  /**
   * remove all - drop dir
   */
  clear (entries) {
    const _this = this
    return new Promise((resolve, reject) => {
      _this.index = {}
      _this.store = {}

      fs.emptyDir(_this.options.cwd)
        .then(() => {
          return fs.ensureDir(path.join(_this.options.cwd, 'index'))
        })
        .then(resolve)
        .catch(reject)

      console.log('implement your storage .clear method')
      reject(new Error('storage.clear method to be implemented'))
    })
  }
}

module.exports = Fs

/*
log-segment instead of debug function (merge debug function into log segment)
removed getValue
value should be renamed in content

@todo
test fs
log-segment chrono in fs storage
set (key, value, duration, expireCallback) => options.events.expire > move to emitter
  kept in Memory and Redis for retrocompatibility, remove in 2.x?
  event to emit: on set, on delete, on clear (on get?)

doc storage interface

*/
