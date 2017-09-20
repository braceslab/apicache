'use strict'

const Store = require('./interface')
const Promise = require('bluebird')

class Memory extends Store {
  constructor () {
    super()
    this.type = 'memory'
    this.cache = new Map()
  }

  get (key) {
    return new Promise((resolve) => {
      resolve(this.cache.get(key))
    })
  }

  set (key, value, duration, expireCallback) {
    return new Promise((resolve) => {
      let instance = this

      let entry = {
        value: value,
        expire: duration + Date.now(),
        timeout: setTimeout(() => {
          instance.delete(key)
          return expireCallback && typeof expireCallback === 'function' && expireCallback(value, key)
        }, duration)
      }

      this.cache.set(key, entry)
      resolve()
    })
  }

  delete (key) {
    return new Promise((resolve) => {
      let entry = this.cache.get(key)
      // clear existing timeout for entry, if exists
      if (entry) {
        clearTimeout(entry.timeout)
      }
      this.cache.delete(key)
      resolve()
    })
  }

  clear (entries) {
    return new Promise((resolve) => {
      this.cache.forEach(key => this.delete(key))
      resolve()
    })
  }
}

module.exports = Memory
