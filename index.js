var WS = require('multiserver/plugins/ws')
var http = require('http')
var pull = require('pull-stream')
var JSONApi = require('./json-api')
var scopes = require('multiserver-scopes')

var READ_AND_ADD = [ //except for add, of course
  'get',
  'getLatest',
  'createLogStream',
  'createUserStream',

  'createHistoryStream',
  'getAddress',

  'links',

  'blobs.add',
  'blobs.size',
  'blobs.has',
  'blobs.get',
  'blobs.changes',
  'blobs.createWants',

  'add',

  'query.read',
  'links2.read'
]

exports.name = 'ws'
exports.version = require('./package.json').version
exports.manifest = {}

exports.init = function (sbot, config) {
  var port, host
  if(config.ws) {
    port = config.ws.port
    host = config.ws.host || config.host
  }
  if(!port)
    port = 1024+(~~(Math.random()*(65536-1024)))

  var layers = []

  var handlers = JSONApi(sbot, layers)

  sbot.auth.hook(function (fn, args) {
    var id = args[0]
    var cb = args[1]
    fn(id, function (err, value) {
      if(value === true)
        sbot.friends.get({source: sbot.id, dest: toId(id)}, function (err, follows) {
          if(err) return cb(err)
          else if(follows) cb(null, {allow: READ_AND_ADD, deny: null})
          else cb(null, true)
        })
      else
        cb(err, value)
    })
  })
  var c = 0
  sbot.multiserver.transport({
    name: 'ws',
    create: function (config) {
      if(c++) throw new Error('more than one server, same port:'+JSON.stringify(config))
      var _host = config.host || 'localhost'
      var _port = config.port || port
      //debug('listening on host=%s port=%d', _host, _port)
      var server = http.createServer(handlers).listen(_port, _host, function(err) {
        if (err) console.error('ssb-ws failed to listen on ' + _host + ':' + _port, err)
        else console.log('Listening on ' + _host + ':' + _port, '(ssb-ws)')
      })
      return WS(Object.assign({
        server: server, port: _port, host: _host
      }, config))
    }
  })

  return {
    use: function (handler) {
      layers.push(handler)
    }
  }
}

