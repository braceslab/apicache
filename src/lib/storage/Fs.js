'use strict'

const Storage = require('./Storage')
const utils = require('../utils')

class Fs extends Storage {
  get (key) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .get method')
      reject(new Error('storage.get method to be implemented'))
    })
  }

  set (key, value, time, timeoutCallback) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .set method')
      reject(new Error('storage.set method to be implemented'))
    })
  }

  delete (key) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .delete method')
      reject(new Error('storage.delete method to be implemented'))
    })
  }

  clear () {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .clear method')
      reject(new Error('storage.clear method to be implemented'))
    })
  }
}

module.exports = Fs
