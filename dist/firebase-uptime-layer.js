(function() {
  var firebase_uptime;

  module.exports = function(app) {
    return app.sequence('init').insert('firebase-uptime', firebase_uptime(app), {
      after: '*'
    });
  };

  firebase_uptime = function(app) {
    var exec, firebase_builder, os, path;
    os = require('os');
    path = require('path');
    exec = require('child_process').exec;
    firebase_builder = require('firebase-builder');
    return function(done) {
      var name, number, pkg, set_ec2_data, update_uptime, uptime_data, uptime_ref, url, _ref;
      if (app.config.firebase.url == null) {
        return done();
      }
      if ((process.env.PROJECT != null) && (process.env.DYNO != null)) {
        _ref = process.env.DYNO.split('.'), name = _ref[0], number = _ref[1];
        name = process.env.PROJECT + ':' + name;
      } else {
        pkg = require(path.join(process.cwd(), 'package.json'));
        name = pkg.name;
        number = [os.hostname(), process.pid].join('-').replace(/\./g, '-');
      }
      url = app.config.firebase.url + ('/uptime/' + app.environment + '/' + name + '/' + number);
      uptime_ref = firebase_builder(url);
      uptime_ref.onDisconnect().remove();
      update_uptime = function() {
        uptime_ref.child('process').update({
          uptime: process.uptime(),
          memory: process.memoryUsage()
        });
        return uptime_ref.child('system').update({
          load: os.loadavg(),
          memory: {
            total: os.totalmem(),
            free: os.freemem()
          }
        });
      };
      uptime_data = {
        process: {
          pid: process.pid,
          argv: process.argv,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        },
        system: {
          arch: os.arch(),
          type: os.platform(),
          release: os.release(),
          hostname: os.hostname(),
          node_version: process.version,
          load: os.loadavg(),
          memory: {
            total: os.totalmem(),
            free: os.freemem()
          }
        }
      };
      set_ec2_data = function(str) {
        var ec2_data;
        ec2_data = str.trim().split('\n').filter(function(line) {
          return line.trim().length > 0;
        }).reduce(function(o, line) {
          var k, v, _ref1;
          _ref1 = line.trim().split(': '), k = _ref1[0], v = _ref1[1];
          if ((k != null) && (v != null)) {
            o[k] = v;
          }
          return o;
        }, {});
        return uptime_data.ec2 = ec2_data;
      };
      return exec('ec2metadata', function(err, stdout, stderr) {
        if ((stdout != null) && (err == null)) {
          set_ec2_data(stdout);
        }
        uptime_ref.set(uptime_data);
        setInterval(update_uptime, 5000);
        return done();
      });
    };
  };

}).call(this);
