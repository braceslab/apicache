'use strict'

const Promise = require('bluebird')
const async = require('async')

const Storage = require('./interface')
const utils = require('../utils')

class Redis extends Storage {
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
              return resolve({
                value: JSON.parse(entry.response),
                expire: entry.duration
              })
            } catch (err) {
              return resolve({
                value: null,
                expire: 0
              })
            }
          }
          resolve()
        })
      } catch (err) {
        return reject(err)
      }
    })
  }

  set (key, value, duration, expireCallback) {
    const _this = this
    return new Promise((resolve, reject) => {
      try {
        _this.client.hset(key, 'response', JSON.stringify(value))
        _this.client.hset(key, 'duration', duration)
        _this.client.expire(key, duration / 1000, expireCallback)
        resolve()
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
            _this.client.del(key, done)})
        })

        async.parallel(deletes, (err) => {
          if (err) {
            utils.debug('error in redis clear')
            return reject(err)
          }
          resolve()
        })
      } catch (err) {
        utils.debug('error in redis clear - invalid redis client')
        reject(err)
      }
    })
  }
}

module.exports = Redis
