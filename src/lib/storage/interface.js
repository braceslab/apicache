'use strict'

class Storage {
  constructor () {
    this.type = 'none'
  }

  /**
   * get method resolve Promise with an entry
   * entry is an object {value:*, expire:number}
   * if entry is null means entry was not previously cached
   * value can be null or empty, means that the content of entry is null
   * expire is number represent millisecond
   * see Memory.get for an example
   * @param {string} key
   */
  get (key) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .get method')
      reject(new Error('storage.get method to be implemented'))
    })
  }

  /**
   * entry to store
   * see Memory.set for an example
   * @param {string} key
   * @param {*} value
   * @param {number} duration
   */
  set (key, value, duration) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .set method')
      reject(new Error('storage.set method to be implemented'))
    })
  }

  /**
   * entry to delete
   * see Memory.delete for an example
   * @param {string} key
   */
  delete (key) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .delete method')
      reject(new Error('storage.delete method to be implemented'))
    })
  }

  /**
   * remove all entries
   * see Memory.clear for an example
   * @param {string} key
   */
  clear (entries) {
    return new Promise((resolve, reject) => {
      console.log('implement your storage .clear method')
      reject(new Error('storage.clear method to be implemented'))
    })
  }
}

module.exports = Storage
