var firebase = require('firebase');
var Promise = require('promise');
var _ = require('underscore')
var gcloud = require('google-cloud');
var fs = require('fs');
var https = require('https')
var isRunning = require('is-running')
var Rx = require('rxjs')

const { spawn } = require('child_process');

var brainyantApp = firebase.initializeApp({
  apiKey: "AIzaSyDC23ZxJ7YjwVfM0BQ2o6zAtWinFrxCrcI",     // Auth / General Use
  authDomain: "https://brainyant-2e30d.firebaseapp.com", // Auth with popup/redirect
  databaseURL: 'https://brainyant-2e30d.firebaseio.com', // Realtime Database
  storageBucket: "https://brainyant-2e30d.appspot.com",  // Storage
}, "brainyantApp")

// Retrieve services via the brainyantApp variable...
var brainyantAuth = firebase.auth(brainyantApp);
var brainyantDatabase = firebase.database(brainyantApp);

class Brain {

  constructor() {
    this.userCommand = new Rx.Subject();
    this.control = false;
    
    this.robotID = "";     //example: mBot, furnica, Rover
    this.ownerID = "";
    this.cameraID = "";
    this.userId = new Rx.Subject();
    this.maxControlTime = 70000;        //1 min 10s
    this.streamParam = "";
	  this.raspivid = undefined;
    this.initDone = false;

    // Init process:
    // Start robot
    // Authenticate
    // Set isOnline flag
    // Listen to commands
    
    var _this = this; 
    fs.readFile(__dirname+"/../../../auth.json", 'utf8', function (err, data){
      if (err){
        console.log(err);
        process.exit(1);
      }
      _this.robotID = JSON.parse(data)["robotID"];
      _this.ownerID = JSON.parse(data)["ownerID"];
      _this.cameraID = JSON.parse(data)["cameraID"];
      _this.firebasePrefix = '/users/'+_this.ownerID+'/robots/' + _this.robotID;
      var robotAuthPostOptions = {
        hostname: 'robots.brainyant.com',
        port: 8080,
        path: '/robotLogin',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };
      var robotAuthRequest = https.request(robotAuthPostOptions, function (response) {
        response.setEncoding('utf8');
        response.on('data', function (body) {
          var customToken = JSON.parse(body)["customToken"];
          brainyantAuth.signInWithCustomToken(customToken).then( function() {
            _this.clearOutput();
            _this.waitForOwner();
            _this.waitForCommands();
            _this.initDone=true;
          }).catch(function(err) {
            console.log(err);
            process.exit(1);
          });
        });
      });
      robotAuthRequest.on('error', function(err) {
         console.log("failure access key auth", err.message);
      });
      robotAuthRequest.write(data);
      robotAuthRequest.end();
    
      var robotAlivePostOptions = {
        hostname: 'robots.brainyant.com',
        port: 8080,
        path: '/iAmAlive',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      setInterval ( function() {
        var robotAliveRequest = https.request(robotAlivePostOptions, function (response) {
          response.setEncoding('utf8');
          response.on('data', function (body) {
          });
        });
        robotAliveRequest.on('error', function(err) {
           console.log("failure sending alive", err.message);
        });
        robotAliveRequest.write(JSON.stringify({robotID: _this.robotID, ownerID: _this.ownerID}));
        robotAliveRequest.end();
      }, 1000);
    })
  }

  initStream() {
    var _this = this;
    var stream = brainyantDatabase.ref(this.firebasePrefix + '/profile/stream');
    stream.once('value', function(camera) {
      var camera=camera.val();
      if (camera){
        brainyantDatabase.ref('users/' + _this.ownerID +'/cameras/'+camera+ '/secretKey')
          .once('value', function(secretKey){
          var secretKey=secretKey.val();
          _this.streamParam = _this.ownerID + '/' + camera + '/' + secretKey;
        });
      }
    });
  }

  startStream() {
   this.raspivid = spawn('sh', ['-c',
      "raspivid -w 800 -h 500 -fps 10 -cd MJPEG -t 0 -o - | ffmpeg -loglevel panic -i - -f mpegts -codec:v mpeg1video -s 800x500 -b:v 750k https://robots.brainyant.eu:8080/"+this.streamParam],
      {detached: true});
  }
  stopStream(){
    if (isRunning(this.raspivid.pid)) {
      process.kill(-this.raspivid.pid);
    }
  }

  waitForCommands() {
    var _this = this;
    var commandHandler = undefined;
    this.userId.subscribe(function(userId){
      if(userId) {
        commandHandler = brainyantDatabase.ref(_this.firebasePrefix+'/users/'+ userId + '/ControlData');
        commandHandler.on('value', function(commands) {
          commands = commands.val();
          if (!commands){
            return;
          }
          _this.userCommand.next(commands);
        });
      }
      else {
        commandHandler.off();
      }
    });
  }

  standby() {
  }

  // TODO: move this to backend
  archiveControlSession(timestamp, entry, waitTime, useTime){
    brainyantDatabase.ref(this.firebasePrefix + '/queueArchive/'+timestamp).set(entry);
    brainyantDatabase.ref(this.firebasePrefix + '/queueArchive/'+timestamp+"/waitTime").set(waitTime);
    brainyantDatabase.ref(this.firebasePrefix + '/queueArchive/'+timestamp+"/useTime").set(useTime);
    brainyantDatabase.ref(this.firebasePrefix + '/queue/'+timestamp).remove();
  }

  waitForOwner() {
    var _this = this;
    var queueQuery=brainyantDatabase.ref(_this.firebasePrefix+'/queue').orderByKey();
    queueQuery.on('value', function(queue) {
      var queue=queue.val();
      if(queue) {
        for(var timestampUser in queue) {
          var queueEntry = queue[timestampUser]
          if ( typeof queueEntry.userOn === 'undefined' || typeof queueEntry.uid === 'undefined' ) {
            brainyantDatabase.ref(_this.firebasePrefix+'/queue/'+timestampUser).remove();
            continue;
          }
          if(!queueEntry.userOn){
            _this.archiveControlSession(timestampUser, queueEntry, 0, 0);
            continue; //move to the next queue entry
          }
          queueQuery.off();
          brainyantDatabase.ref(_this.firebasePrefix + '/queue/'+timestampUser+"/robotOn").set(true, function() {
          });
          _this.startStream();
          _this.userId.next(queueEntry.uid);
          var controlStart = Date.now();
          brainyantDatabase.ref(_this.firebasePrefix + '/queue/'+timestampUser+"/startControl").set(controlStart);
          var userReleaseListener = brainyantDatabase.ref(_this.firebasePrefix + '/queue/'+timestampUser+"/userOn");
          userReleaseListener.on('value', function (userOn) {
            var userOn=userOn.val();
            if(userOn==false || userOn==null) {
              userReleaseListener.off();
              clearTimeout(controlTimeout);
              _this.userId.next(null);
              var controlTime = Date.now()-controlStart;
              _this.archiveControlSession(timestampUser, queueEntry, timestampUser-Date.now()-controlTime, controlTime);
              _this.stopStream();
              _this.waitForOwner();
            }
          });
          var controlTimeout = setTimeout( function() {
            userReleaseListener.off();
            _this.userId.next(null);
            _this.archiveControlSession(timestampUser, queueEntry, timestampUser-Date.now()-_this.maxControlTime, _this.maxControlTime);
            _this.stopStream();
            _this.waitForOwner();
          }, _this.maxControlTime);
          break;
        }
      }
    });
    _this.initStream();
  }

  //=================Sensor Data Handling=====================
  clearOutput() {
    brainyantDatabase.ref(this.firebasePrefix + '/output').remove();
  }

  registerSensor(sensor, getSensorData) {
    var _this=this;
    if(this.initDone){
      this.handleSensor(sensor, getSensorData);
    }
    else {
      setTimeout(function() {
        _this.registerSensor(sensor, getSensorData);
      }, 200);
    }
  }

  handleSensor(sensor, getSensorData){
    var _this=this;
    var sensorHandler = undefined;
    brainyantDatabase.ref(this.firebasePrefix + '/output/'+sensor).set("0");
    var looper = undefined;
    var looperOn = false;
    this.userId.subscribe(function(userId){
      if(userId) {
        sensorHandler = brainyantDatabase.ref(_this.firebasePrefix+'/users/'+ userId + '/SensorData/'+sensor);
        sensorHandler.on('value', function(dataRequest) {
          var dataRequest = dataRequest.val();
          switch(dataRequest){
            case 'once':
              if(looperOn) {
                looperOn = false;
                clearInterval(looper);
              }
              brainyantDatabase.ref(_this.firebasePrefix + '/output/'+sensor).set(getSensorData());
              break;
            case 'loop':
              looper = setInterval(function(){
                  brainyantDatabase.ref(_this.firebasePrefix + '/output/'+sensor).set(getSensorData());
                }, 1000)
                looperOn = true;
              break;
            default:
              if(looperOn) {
                looperOn = false;
                clearInterval(looper);
              }
          }
        });
      }
      else {
        sensorHandler.off();
        if(looperOn) {
          looperOn = false;
          clearInterval(looper);
        }
      }
    });
  }

//Control Data handling
  clearControlData() {
    brainyantDatabase.ref(this.firebasePrefix + '/users/' + userId + '/ControlData').remove();
  }

  registerCommand(command, key, behave, commandCallback) {
    var _this=this;
    if(this.initDone){
      this.handleCommand(command, key, behave, commandCallback);
    }
    else {
      setTimeout(function() {
        _this.registerCommand(command, key, behave, commandCallback);
      }, 200);
    }
  }

  handleCommand(command, key, behave, commandCallback){
    var _this=this;
    var commandHandler2 = undefined;
    brainyantDatabase.ref(this.firebasePrefix + '/input/' + command).set({'key': key, 'behavior': behave});
    brainyantDatabase.ref(this.firebasePrefix + '/users/' + userId + '/ConstrolData/' + command).set("0");
    this.userId.subscribe(function(userId){
      if(userId) {
        commandHandler2 = brainyantDatabase.ref(_this.firebasePrefix+'/users/'+ userId + '/ControlData/'+command);
        commandHandler2.on('value', function(dataChange) {
          var dataChange = dataChange.val();
          //handle command with value dataChange
          commandCallback(dataChange);
        });
      }
      else {
        sensorHandler.off();
        if(looperOn) {
          looperOn = false;
          clearInterval(looper);
        }
      }
    });
  }

}

module.exports = Brain;
