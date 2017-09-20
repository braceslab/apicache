'use strict'

const Promise = require('bluebird')
const log = require('log-segment')
const fs = require('fs-extra')
const uuid = require('uuid/v4')
const path = require('path')
const EventEmitter = require('events')

const Store = require('./interface')

log.set({
  segments: {
    'apicache-fs': {
      color: 'white'
    }
  }
})

function index (key, expire) {
  return {
    id: uuid(),
    key: key,
    expire: expire || 0
  }
}

function entry (content, expire) {
  return {
    content: content,
    expire: expire || 0
  }
}

/**
 * @param {Object} options
 * @param {!string} options.cwd
 * @param {?boolean} [options.debug=false]
 * @param {?boolean} [options.resume=false]
 */
class Fs extends Store {
  constructor (options) {
    super()
    this.type = 'fs'
    this.index = {}
    this.store = {}

    if (!options) {
      options = {}
    }

    if (!options.debug) {
      log.set({disabled: {segments: ['apicache-fs']}})
    }

    if (!options.cwd) {
      log.error('apicache-fs', 'constructor', 'missing options: cwd')
      throw Error(options.cwd + ' is not a valid path')
    }
    this.cwd = options.cwd
    this.options = options

    this._emitter = new EventEmitter()
    this._inited = false
    this._initing = false
    this._init()
  }

  _init () {
    const _this = this
    return new Promise((resolve, reject) => {
      log.info('apicache-fs', 'init')
      if (_this._inited || _this._initing) {
        resolve()
        return
      }
      _this._initing = true

      fs.ensureDir(_this.options.cwd)
        .then(() => {
          return fs.ensureDir(path.join(_this.options.cwd, 'index'))
        })
        .then(() => {
          if (_this.options.resume) {
            return _this._resume()
          }
        })
        .then(() => {
          _this._inited = true
          _this._initing = true
          log.success('apicache-fs', 'init')
          resolve()
          _this._emitter.emit('inited')
        })
        .catch((err) => {
          log.error('apicache-fs', 'init', log.v('err', err))
          reject(err)
        })
    })
  }

  _resume () {
    const _this = this
    return new Promise((resolve, reject) => {
      log.info('apicache-fs', '_resume')
      _this.index = {}
      let _files
      let _dir = path.join(_this.options.cwd, 'index')
      fs.readdir(_dir)
        .then((files) => {
          _files = files.map(file => path.join(_dir, file))
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
        .then(() => {
          log.success('apicache-fs', '_resume')
          resolve()
        })
        .catch((err) => {
          log.error('apicache-fs', '_resume', log.v('err', err))
          reject(err)
        })
    })
  }

  _wait (method, args, resolve, reject) {
    const _this = this
    log.warning('apicache-fs', method, 'store not yet inited')
    // not elegant, but Object.observe is not stable
    this._emitter.once('inited', () => {
      _this[method].apply(_this, args)
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
      log.info('apicache-fs', 'get', log.v('key', key))
      if (!_this._inited) {
        _this._wait('get', [key], resolve, reject)
        return
      }

      if (!_this.index[key]) {
        log.success('apicache-fs', 'get', log.v('key', key), 'no entry')
        resolve(null)
        _this._emitter.emit('get', key)
        return
      }

      const id = _this.index[key].id
      if (_this.store[id]) {
        log.success('apicache-fs', 'get', log.v('key', key), 'from memory')
        resolve(_this.store[id])
        _this._emitter.emit('get', key)
        return
      }

      fs.readJson(path.join(_this.options.cwd, id))
        .then((content) => {
          _this.store[id] = entry(content, _this.index[key].expire)
          log.success('apicache-fs', 'get', log.v('key', key), 'from fs')
          resolve(_this.store[id])
          _this._emitter.emit('get', key)
        })
        .catch((err) => {
          log.error('apicache-fs', 'get', log.v('key', key), log.v('err', err))
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
  set (key, content, duration) {
    const _this = this
    return new Promise((resolve, reject) => {
      log.info('apicache-fs', 'set', log.v('key', key))
      if (!_this._inited) {
        _this._wait('set', [key, content, duration], resolve, reject)
        return
      }

      const _expire = Date.now() + duration
      _this.index[key] = index(key, _expire)
      const id = _this.index[key].id
      _this.store[id] = entry(content, _expire)

      Promise.all([
        fs.writeJson(path.join(_this.options.cwd, id), content),
        fs.writeJson(path.join(_this.options.cwd, 'index', id), _this.index[key])
      ])
        .then(() => {
          log.success('apicache-fs', 'set', log.v('key', key))
          resolve()
          _this._emitter.emit('set', key)
        })
        .catch((err) => {
          log.error('apicache-fs', 'set', log.v('err', err))
          reject(err)
        })
    })
  }

  /**
   * delete key
   * @param {string} key
   */
  delete (key) {
    const _this = this
    return new Promise((resolve, reject) => {
      log.info('apicache-fs', 'delete', log.v('key', key))
      if (!_this._inited) {
        _this._wait('delete', [key], resolve, reject)
        return
      }

      if (!_this.index[key]) {
        log.success('apicache-fs', 'delete', log.v('key', key), 'no entry')
        resolve()
        _this._emitter.emit('delete', key)
        return
      }

      const id = _this.index[key].id
      delete _this.index[key]
      delete _this.store[id]

      Promise.all([
        fs.remove(path.join(_this.options.cwd, id)),
        fs.remove(path.join(_this.options.cwd, 'index', id))
      ])
      .then(() => {
        log.success('apicache-fs', 'delete', log.v('key', key))
        resolve()
        _this._emitter.emit('delete', key)
      })
      .catch((err) => {
        log.error('apicache-fs', 'delete', log.v('key', key), log.v('err', err))
        resolve()
        _this._emitter.emit('delete', key)
          // safe, should be reject(err)
      })
    })
  }

  /**
   * remove all - drop dir
   */
  clear () {
    const _this = this
    return new Promise((resolve, reject) => {
      log.info('apicache-fs', 'clear')
      if (!_this._inited) {
        _this._wait('clear', [], resolve, reject)
        return
      }

      _this.index = {}
      _this.store = {}

      fs.emptyDir(_this.options.cwd)
        .then(() => {
          return fs.ensureDir(path.join(_this.options.cwd, 'index'))
        })
        .then(() => {
          log.success('apicache-fs', 'clear')
          resolve()
          _this._emitter.emit('clear')
        })
        .catch((err) => {
          log.error('apicache-fs', 'clear', log.v('err', err))
          resolve()
          _this._emitter.emit('clear')
          // safe, should be reject(err)
        })
    })
  }
}

module.exports = Fs

/*
log-segment instead of debug function (merge debug function into log segment)

@todo
delete exipired entries
get/set buffer base64
log-segment chrono in fs store
set (key, content, duration, expireCallback) => options.events.expire > move to emitter
  kept in Memory and Redis for retrocompatibility, move out in 2.x?
  event to emit: on set, on delete, on clear (on get?)

clear() no entries => see redis

doc store interface
doc events, api, example use
*/
