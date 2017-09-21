'use strict'

const Promise = require('bluebird')
const async = require('async')

const Store = require('./interface')
const utils = require('../utils')

class Redis extends Store {
  constructor (options) {
    super()
    this.type = 'redis'

    if (!options.client) {
      utils.debug('error in redis init')
    // should throw Error(options.client + ' is not a valid Redis client')
    }
    this.client = options.client
  }

  get (key) {
    const _this = this
    return new Promise((resolve, reject) => {
      try {
        _this.client.hgetall(key, (err, entry) => {
          if (err) {
            return reject(err)
          }
          if (entry) {
            try {
              resolve({
                content: JSON.parse(entry.response),
                expire: entry.duration
              })
              _this.emitter.emit('read', key)
              return
            } catch (err) {
              resolve({
                content: null,
                expire: 0
              })
              _this.emitter.emit('read', key)
              return
            }
          }
          resolve()
          _this.emitter.emit('read', key)
        })
      } catch (err) {
        return reject(err)
      }
    })
  }

  set (key, content, duration) {
    const _this = this
    return new Promise((resolve, reject) => {
      try {
        _this.client.hset(key, 'response', JSON.stringify(content))
        _this.client.hset(key, 'duration', duration)
        _this.client.expire(key, duration / 1000, () => {
          _this.delete(key)
        })
        resolve()
        _this.emitter.emit('save', key)
      } catch (err) {
        utils.debug('error in redis.hset()')
        reject(err)
      }
    })
  }

  delete (key) {
    const _this = this
    return new Promise((resolve, reject) => {
      try {
        _this.client.del(key)
        resolve()
        _this.emitter.emit('expire', key)
      } catch (err) {
        utils.debug('error in redis.del("' + key + '"")')
        reject(err)
      }
    })
  }

  /**
   * clear redis keys one by one from internal index to prevent clearing non-apicache entries
   */
  clear (entries) {
    const _this = this
    return new Promise((resolve, reject) => {
      try {
        const deletes = []
        entries.forEach((key) => {
          deletes.push((done) => {
            _this.client.del(key, done)
          })
        })

        async.parallel(deletes, (err) => {
          if (err) {
            utils.debug('error in redis clear')
            return reject(err)
          }
          resolve()
          _this.emitter.emit('clear')
        })
      } catch (err) {
        utils.debug('error in redis clear - invalid redis client')
        reject(err)
      }
    })
  }
}

module.exports = Redis
