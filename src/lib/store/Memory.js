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
      // @todo emit get event
    })
  }

  set (key, content, duration) {
    return new Promise((resolve) => {
      let instance = this
      let entry = {
        content: content,
        expire: duration + Date.now(),
        timeout: setTimeout(function () {
          instance.delete(key)
        }, Math.min(duration, Store.MAX_TIMEOUT))
      }
      this.cache.set(key, entry)
      resolve()
      // @todo emit set event
    })
  }

  delete (key) {
    return new Promise((resolve) => {
      const entry = this.cache.get(key)
      // clear existing timeout for entry, if exists
      if (entry) {
        clearTimeout(entry.timeout)
      }
      this.cache.delete(key)
      resolve()
      // @todo emit delete event
    })
  }

  clear (entries) {
    return new Promise((resolve) => {
      this.cache.forEach(key => this.delete(key))
      resolve()
      // @todo emit clear event
    })
  }
}

module.exports = Memory
