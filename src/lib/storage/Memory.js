'use strict'

const Storage = require('./Storage')
const utils = require('../utils')

class Memory extends Storage {
  super () {
    this.cache = new Map()
  }

  get (key) {
    // @todo promise
    return this.cache.get(key)
  }

  set (key, value, time, timeoutCallback) {
    // @todo promise
    let instance = this

    let entry = {
      value: value,
      expire: time + Date.now(),
      timeout: setTimeout(() => {
        instance.delete(key)
        return timeoutCallback && typeof timeoutCallback === 'function' && timeoutCallback(value, key)
      }, time)
    }

    this.cache.set(key, entry)

    return entry
  }

  delete (key) {
    // @todo promise
    let entry = this.cache.get(key)

    // clear existing timeout for entry, if exists
    if (entry) clearTimeout(entry.timeout)

    this.cache.delete(key)

    return this
  }

  clear (entries) {
    // @todo promise
    this.cache.forEach(key => this.delete(key))

    return this
  }
}

module.exports = Memory
