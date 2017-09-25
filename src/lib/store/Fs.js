'use strict'

/*
log-segment instead of debug function (merge debug function into log segment)

@todo
log-segment chrono in fs store

Redis.clear() no entries => see redis

test events (Memory, Redis, fs)

utils.debug in Memory and Redis

doc
  store interface, events, howto
  events, api, example

  changelog
    options.redisClient > store
    events
*/

const Promise = require('bluebird')
const log = require('log-segment')
const fs = require('fs-extra')
const uuid = require('uuid/v4')
const path = require('path')

const utils = require('../utils')
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
          _this.emitter.emit('inited')
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
      log.info('apicache-fs', '_resume', log.v('cwd', _this.options.cwd))
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
            const _duration = Math.max(0, content.expire - Date.now())
            if (_duration > 0) {
              _this.index[content.key] = content
              setTimeout(() => {
                _this.delete(content.key)
              }, _duration)
            }
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
    this.emitter.once('inited', () => {
      _this[method].apply(_this, args)
        .then(resolve)
        .catch(reject)
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

      if (duration < 1) {
        duration = 0
      }

      // index
      const _expire = Date.now() + duration
      _this.index[key] = index(key, _expire)
      setTimeout(() => {
        _this.delete(key)
      }, duration)

      // content
      const id = _this.index[key].id
      _this.store[id] = content
      let _copy = content
      // if restify, data is plain json / string
      // if express, data is Buffer then store as base64
      if (_copy.data instanceof Buffer) {
        _copy = utils.clone(content)
        _copy.data = _copy.data.toString('base64')
      }

      Promise.all([
        fs.writeJson(path.join(_this.options.cwd, id), _copy),
        fs.writeJson(path.join(_this.options.cwd, 'index', id), _this.index[key])
      ])
        .then(() => {
          log.success('apicache-fs', 'set', log.v('key', key))
          resolve()
          _this.emitter.emit('save', key)
        })
        .catch((err) => {
          log.error('apicache-fs', 'set', log.v('err', err))
          reject(err)
        })
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
        _this.emitter.emit('read', key)
        return
      }

      _this.getEntry(key)
        .then(resolve)
        .catch(reject)
    })
  }

  getEntry (key) {
    const _this = this
    return new Promise((resolve, reject) => {
      const id = _this.index[key].id
      if (_this.store[id]) {
        log.success('apicache-fs', 'getContent', log.v('key', key), 'from memory')
        resolve(entry(_this.store[id], _this.index[key].expire))
        _this.emitter.emit('read', key)
        return
      }

      fs.readJson(path.join(_this.options.cwd, id))
        .then((content) => {
          _this.store[id] = content
          // if restify, data is plain json
          // if express, data is Buffer stored in bas64
          if (_this.store[id].data[0] !== '[') {
            _this.store[id].data = utils.toBuffer(_this.store[id].data, 'base64')
          }
          log.success('apicache-fs', 'getContent', log.v('key', key), 'from fs')
          resolve(entry(_this.store[id], _this.index[key].expire))
          _this.emitter.emit('read', key)
        })
        .catch((err) => {
          log.error('apicache-fs', 'getContent', log.v('key', key), log.v('err', err))
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
        _this.emitter.emit('expire', key)
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
        _this.emitter.emit('expire', key)
      })
      .catch((err) => {
        log.error('apicache-fs', 'delete', log.v('key', key), log.v('err', err))
        resolve()
        _this.emitter.emit('expire', key)
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
          _this.emitter.emit('clear')
        })
        .catch((err) => {
          log.error('apicache-fs', 'clear', log.v('err', err))
          resolve()
          _this.emitter.emit('clear')
          // safe, should be reject(err)
        })
    })
  }
}

module.exports = Fs
