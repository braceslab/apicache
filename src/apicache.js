'use strict'

const url = require('url')
const Promise = require('bluebird')
const pkg = require('../package.json')
const MemoryStore = require('./lib/store/Memory')
const utils = require('./lib/utils')

const t = {
  ms: 1,
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 3600000 * 24,
  week: 3600000 * 24 * 7,
  month: 3600000 * 24 * 30,
  max: 2147483647
}

const instances = []

function ApiCache () {
  const instance = this
  const middlewareOptions = []
  let index
  let store = new MemoryStore()

  const globalOptions = {
    debug: false,
    defaultDuration: 3600000,
    enabled: true,
    appendKey: [],
    jsonp: false,
    statusCodes: {
      include: [],
      exclude: []
    },
    events: {
      'expire': undefined
    },
    headers: {
      // 'cache-control':  'no-cache' // example of header overwrite
    }
  }
  utils._debug = globalOptions.debug

  instances.push(this)
  this.id = instances.length

  function shouldCacheResponse (response) {
    const opt = globalOptions
    const codes = opt.statusCodes

    if (!response) return false

    if (codes.exclude && codes.exclude.length && codes.exclude.indexOf(response.statusCode) !== -1) return false
    if (codes.include && codes.include.length && codes.include.indexOf(response.statusCode) === -1) return false

    return true
  }

  function addIndexEntries (key, req) {
    const groupName = req.apicacheGroup

    if (groupName) {
      utils.debug('group detected "' + groupName + '"')
      const group = (index.groups[groupName] = index.groups[groupName] || [])
      group.unshift(key)
    }

    index.all.unshift(key)
  }

  function createCacheObject (status, headers, data, encoding) {
    return {
      status: status,
      headers: Object.assign({}, headers),
      data: data,
      encoding: encoding
    }
  }

  function cacheResponse (key, value, duration) {
    store.set(key, value, duration, globalOptions.events.expire)
      .then(() => {
        // add automatic cache clearing from duration, includes max limit on setTimeout
        setTimeout(function () {
          instance.clear(key, true)
        }, Math.min(duration, t.max))
      })
      .catch((err) => {
        utils.debug('cacheResponse error', err)
      })
  }

  function accumulateContent (res, content) {
    if (content) {
      if (typeof (content) === 'string') {
        res._apicache.content = (res._apicache.content || '') + content
      } else if (Buffer.isBuffer(content)) {
        let oldContent
        if (res._apicache.content) {
          oldContent = res._apicache.content
        } else {
          oldContent = utils.alloc(0)
        }
        res._apicache.content = Buffer.concat([oldContent, content], oldContent.length + content.length)
      } else {
        res._apicache.content = content
      // res._apicache.cacheable = false
      }
    }
  }

  function makeResponseCacheable (req, res, next, key, duration, strDuration) {
    // monkeypatch res.end to create cache object
    res._apicache = {
      write: res.write,
      end: res.end,
      cacheable: true,
      content: undefined
    }

    // add cache control headers
    if (!globalOptions.headers['cache-control']) {
      res.header('cache-control', 'max-age=' + (duration / 1000).toFixed(0))
    }

    // append header overwrites if applicable
    Object.keys(globalOptions.headers).forEach(name => {
      res.header(name, globalOptions.headers[name])
    })

    // patch res.write
    res.write = function (content) {
      accumulateContent(res, content)
      return res._apicache.write.apply(this, arguments)
    }

    // patch res.end
    res.end = function (content, encoding) {
      if (shouldCacheResponse(res)) {
        accumulateContent(res, content)

        if (res._apicache.cacheable && res._apicache.content) {
          addIndexEntries(key, req)
          const cacheObject = createCacheObject(res.statusCode, res._headers, res._apicache.content, encoding)
          cacheResponse(key, cacheObject, duration)

          // display log entry
          const elapsed = new Date() - req.apicacheTimer
          utils.debug('adding cache entry for "' + key + '" @ ' + strDuration, utils.logDuration(elapsed))
        }
      }

      return res._apicache.end.apply(this, arguments)
    }

    next()
  }

  function sendCachedResponse (response, cacheObject) {
    let headers = (typeof response.getHeaders === 'function') ? response.getHeaders() : response._headers
    Object.assign(headers, cacheObject.headers || {}, {
      'apicache-store': store.type,
      'apicache-version': pkg.version
    })

    // unstringify buffers
    let data = cacheObject.data
    if (data && data.type === 'Buffer') {
      data = utils.toBuffer(data.data)
    }

    response.writeHead(cacheObject.status || 200, headers)

    return response.end(data, cacheObject.encoding)
  }

  function setup () {
    for (let i in middlewareOptions) {
      Object.assign(middlewareOptions[i].options, globalOptions, middlewareOptions[i].localOptions)
    }

    const debugEnv = process.env.DEBUG && process.env.DEBUG.split(',').indexOf('apicache') !== -1
    utils._debug = globalOptions.debug || debugEnv

    if (globalOptions.store) {
      store = globalOptions.store
    }
  }

  function clearGroup (target, auto) {
    return new Promise((resolve, reject) => {
      const group = index.groups[target]
      utils.debug('clearing group "' + target + '"')

      const deletes = []
      group.forEach(function (key) {
        utils.debug('clearing cached entry for "' + key + '"')
        deletes.push(store.delete(key))
        index.all = index.all.filter(utils.doesntMatch(key))
      })
      Promise.all(deletes)
        .then(() => {
          delete index.groups[target]
        })
        .then(resolve)
        .catch(reject)
    })
  }

  function clearEntry (target, auto) {
    return new Promise((resolve, reject) => {
      utils.debug('clearing ' + (auto ? 'expired' : 'cached') + ' entry for "' + target + '"')

      // clear actual cached entry
      store.delete(target)
        .then(() => {
          // remove from global index
          index.all = index.all.filter(utils.doesntMatch(target))

          // remove target from each group that it may exist in
          Object.keys(index.groups).forEach(function (groupName) {
            index.groups[groupName] = index.groups[groupName].filter(utils.doesntMatch(target))

            // delete group if now empty
            if (!index.groups[groupName].length) {
              delete index.groups[groupName]
            }
          })
        })
        .then(resolve)
        .catch(reject)
    })
  }

  function clearAll () {
    return new Promise((resolve, reject) => {
      utils.debug('clearing entire index')
      store.clear(index.all)
        .then(() => {
          instance.resetIndex()
        })
        .then(resolve)
        .catch(reject)
    })
  }

  this.clear = function (target, auto) {
    if (index.groups[target]) {
      return clearGroup(target, auto)
    } else if (target) {
      return clearEntry(target, auto)
    }
    return clearAll()
  }

  this.getDuration = function (duration) {
    if (typeof duration === 'number') return duration

    if (typeof duration === 'string') {
      const split = duration.match(/^([\d\.,]+)\s(\w+)$/)

      if (split.length === 3) {
        const len = parseFloat(split[1])
        let unit = split[2].replace(/s$/i, '').toLowerCase()
        if (unit === 'm') {
          unit = 'ms'
        }

        return (len || 1) * (t[unit] || 0)
      }
    }

    return globalOptions.defaultDuration
  }

  this.getIndex = function (group) {
    if (group) {
      return index.groups[group]
    } else {
      return index
    }
  }

  this.middleware = function (strDuration, middlewareToggle, localOptions) {
    const duration = instance.getDuration(strDuration)
    const opt = {}

    middlewareOptions.push({
      options: opt
    })

    const options = function (localOptions) {
      if (localOptions) {
        middlewareOptions.find(function (middleware) {
          return middleware.options === opt
        }).localOptions = localOptions
      }
      setup()
      return opt
    }

    options(localOptions)

    const cache = function (req, res, next) {
      function bypass () {
        utils.debug('bypass detected, skipping cache.')
        return next()
      }

      // initial bypass chances
      if (!opt.enabled) return bypass()
      if (req.headers['x-apicache-bypass'] || req.headers['x-apicache-force-fetch']) return bypass()
      if (typeof middlewareToggle === 'function') {
        if (!middlewareToggle(req, res)) return bypass()
      } else if (middlewareToggle !== undefined && !middlewareToggle) {
        return bypass()
      }

      // embed timer
      req.apicacheTimer = new Date()

      // In Express 4.x the url is ambigious based on where a router is mounted.  originalUrl will give the full Url
      let key = req.originalUrl || req.url

      // Remove querystring from key if jsonp option is enabled
      if (opt.jsonp) {
        key = url.parse(key).pathname
      }

      if (opt.appendKey.length > 0) {
        let appendKey = req

        for (let i = 0; i < opt.appendKey.length; i++) {
          appendKey = appendKey[opt.appendKey[i]]
        }
        key += '$$appendKey=' + appendKey
      }

      // attempt cache hit
      store.get(key)
        .then((entry) => {
          if (entry) {
            utils.debug('sending cached version of', key, utils.logDuration(new Date() - req.apicacheTimer))
            return sendCachedResponse(res, entry.value)
          }
          makeResponseCacheable(req, res, next, key, duration, strDuration)
        })
        .catch((err) => {
          utils.debug('empty or missing version of', key, err)
          makeResponseCacheable(req, res, next, key, duration, strDuration)
        })
    }

    cache.options = options

    return cache
  }

  this.options = function (options) {
    if (options) {
      Object.assign(globalOptions, options)
      setup()
      return this
    } else {
      return globalOptions
    }
  }

  this.resetIndex = function () {
    index = {
      all: [],
      groups: {}
    }
  }

  this.newInstance = function (config) {
    const instance = new ApiCache()
    if (config) {
      instance.options(config)
    }
    return instance
  }

  this.clone = function () {
    return this.newInstance(this.options())
  }

    // initialize index
  this.resetIndex()
}

module.exports = new ApiCache()
