'use strict'

const Storage = require('./Storage')
const utils = require('../utils')

class Redis extends Storage {
  super (options) {
    if (!options.client) {
      utils.debug('[apicache] error in redis init')
      throw Error(options.client + ' is not a valid Redis client')
    }
    this.client = options.client
  }
  
  get (key) {
    return new Promise((resolve, reject) => {
      this.client.hgetall(key, function (err, obj) {
        if (err) {
          return reject(err)
        }
        if (obj) {
          return resolve(JSON.parse(obj.response))
        }
        resolve()
      })
    })
  }

  set (key, value, duration, expireCallback) {
    return new Promise((resolve, reject) => {
      try {
        this.client.hset(key, 'response', JSON.stringify(value))
        this.client.hset(key, 'duration', duration)
        this.client.expire(key, duration / 1000, expireCallback)
      } catch (err) {
        utils.debug('[apicache] error in redis.hset()')
      }
    })
  }

  delete (key) {
    return new Promise((resolve, reject) => {
      try {
        this.client.del(key)
      } catch (err) {
        throw Error('[apicache] error in redis.del("' + key + '"")')
      }
    })
  }

  clear (entries) {
    return new Promise((resolve, reject) => {
      // clear redis keys one by one from internal index to prevent clearing non-apicache entries
      entries.forEach(function (key) {
        try {
          this.client.del(key)
        } catch (err) {
          throw Error('[apicache] error in redis.del("' + key + '"")')
        }
      })
    })
  }
}

module.exports = Redis
