module.exports = (app) ->
  app.sequence('init').insert(
    'firebase-uptime',
    firebase_uptime(app), after: '*'
  )

firebase_uptime = (app) ->
  os = require 'os'
  path = require 'path'
  {exec} = require 'child_process'
  firebase_builder = require 'firebase-builder'
  
  (done) ->
    return done() unless app.config.firebase.url?
    
    if process.env.PROJECT? and process.env.DYNO?
      [name, number] = process.env.DYNO.split('.')
      name = process.env.PROJECT + ':' + name
    else
      pkg = require(path.join(process.cwd(), 'package.json'))
      name = pkg.name
      number = [os.hostname(), process.pid].join('-').replace(/\./g, '-')
    
    url = app.config.env.firebase + ('/uptime/' + app.environment + '/' + name + '/' + number)
    uptime_ref = firebase_builder(url)
    uptime_ref.onDisconnect().remove()
    
    update_uptime = ->
      uptime_ref.child('process').update(
        uptime: process.uptime()
        memory: process.memoryUsage()
      )
      uptime_ref.child('system').update(
        load: os.loadavg()
        memory:
          total: os.totalmem()
          free: os.freemem()
      )
    
    uptime_data =
      process:
        pid: process.pid
        argv: process.argv
        uptime: process.uptime()
        memory: process.memoryUsage()
      system:
        arch: os.arch()
        type: os.platform()
        release: os.release()
        hostname: os.hostname()
        node_version: process.version
        load: os.loadavg()
        memory:
          total: os.totalmem()
          free: os.freemem()
    
    set_ec2_data = (str) ->
      ec2_data = str.trim()
        .split('\n')
        .filter((line) -> line.trim().length > 0)
        .reduce (o, line) ->
          [k, v] = line.trim().split(': ')
          o[k] = v if k? and v?
          o
        , {}
      
      uptime_data.ec2 = ec2_data
    
    exec 'ec2metadata', (err, stdout, stderr) ->
      set_ec2_data(stdout) if stdout? and not err?
      uptime_ref.set(uptime_data)
      setInterval(update_uptime, 5000)
      done()
