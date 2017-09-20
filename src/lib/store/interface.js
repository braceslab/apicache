'use strict'

class Store {
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
      console.log('implement your store .get method')
      reject(new Error('store.get method to be implemented'))
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
      console.log('implement your store .set method')
      reject(new Error('store.set method to be implemented'))
    })
  }

  /**
   * entry to delete
   * see Memory.delete for an example
   * @param {string} key
   */
  delete (key) {
    return new Promise((resolve, reject) => {
      console.log('implement your store .delete method')
      reject(new Error('store.delete method to be implemented'))
    })
  }

  /**
   * remove all entries
   * see Memory.clear for an example
   * @param {string} key
   */
  clear (entries) {
    return new Promise((resolve, reject) => {
      console.log('implement your store .clear method')
      reject(new Error('store.clear method to be implemented'))
    })
  }
}

module.exports = Store
