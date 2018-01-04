var firebase = require('firebase');
var Promise = require('promise');
var _ = require('underscore')
var spawn = require('child_process').spawn;
// TODO i really don't like this
var gcloud = require('google-cloud');
var fs = require('fs');
var https = require('https')
var Rx = require('rxjs')

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
        this.userId = "";
        //TODO Discuss about this limit; Should be added as a config value
        this.maxControlTime = 70000;        //1 min 10s

        // Init process:
        // Start robot
        // Authenticate
        // Set isOnline flag
        // Listen to commands
        
        // TODO move auth.json to *.xml
        var _this = this; 
        fs.readFile("./auth.json", 'utf8', function (err, data){
          if (err){
            console.log(err);
            process.exit(1);
          }
          _this.robotID = JSON.parse(data)["robotID"];
          _this.ownerID = JSON.parse(data)["ownerID"];
          _this.firebasePrefix = '/users/'+_this.ownerID+'/robots/' + _this.robotID
          // login robot
          // TODO move all this to functions
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
                // sign in succesful. Start brain instance
                _this.waitForOwner();
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
        
          //start isAliveBeacon
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
            robotAliveRequest.write(JSON.stringify({robotID: _this.robotID}));
            robotAliveRequest.end();
          }, 1000);
        })
    }

    waitForCommands() {
        var _this = this;
        this.commandHandler = brainyantDatabase.ref(this.firebasePrefix+'/users/'+ this.userId + '/ControlData');
        this.commandHandler.on('value', function(commands) {
              commands = commands.val();
              if (!commands){
                return;
              }
              _this.userCommand.next(commands);
              //handle mechanical commands
              //if (commands['fwd'] || commands['back'] ||
              //    commands['left'] || commands['right']) {
              //    var accel = commands['fwd'] - commands['back'];
              //    _this.board.movement.runRobot(commands['left'], commands['right'], accel);
              //} else {
              //    _this.board.movement.clear()
              //}
        }
      );
    }

    waitForCommandsStop() {
        var _this = this;
        // TODO: Make sure this handler is called only once, or else you need to call it off multiple times
        this.commandHandler.off();
        this.standby();
    }

    standby() {
        // TODO make sure that commanderHandler exists
        //this.board.movement.clear();
        //this.control = false;
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
          if(queue) { //there are users waiting
            for(var timestampUser in queue) {
              var queueEntry = queue[timestampUser]
              //TODO check if queueEntry is valid
              if ( typeof queueEntry.userOn === 'undefined' || typeof queueEntry.uid === 'undefined' ) {
                // data is corrupted
                // remove it from database and continue
                brainyantDatabase.ref(_this.firebasePrefix+'/queue/'+timestampUser).remove();
                continue;
              }
              if(!queueEntry.userOn){ //user has left the page or stopped waiting for the robot
                _this.archiveControlSession(timestampUser, queueEntry, 0, 0);
                continue; //move to the next queue entry
              }
              // TODO there is a risk of reentering the queue subscription
              // this should be handeled diferently
              queueQuery.off();
              // take user
              brainyantDatabase.ref(_this.firebasePrefix + '/queue/'+timestampUser+"/robotOn").set(true, function() {
              });
              _this.userId = queueEntry.uid;
              _this.waitForCommands();
              var controlStart = Date.now();
              brainyantDatabase.ref(_this.firebasePrefix + '/queue/'+timestampUser+"/startControl").set(controlStart);
              //listen for user releaseing control 
              var userReleaseListener = brainyantDatabase.ref(_this.firebasePrefix + '/queue/'+timestampUser+"/userOn");
              userReleaseListener.on('value', function (userOn) {
                var userOn=userOn.val();
                if(userOn==false || userOn==null) { //user has released the robot
                  userReleaseListener.off();
                  clearTimeout(controlTimeout);
                  _this.waitForCommandsStop();
                  var controlTime = Date.now()-controlStart;
                  _this.archiveControlSession(timestampUser, queueEntry, timestampUser-Date.now()-controlTime, controlTime);
                  _this.waitForOwner();
                }
              });
              var controlTimeout = setTimeout( function() { //we give limited time of control
                userReleaseListener.off();
                _this.waitForCommandsStop();
                _this.archiveControlSession(timestampUser, queueEntry, timestampUser-Date.now()-_this.maxControlTime, _this.maxControlTime);
                _this.waitForOwner();
              }, _this.maxControlTime);
              break;
          }
        }
      });
    }
}

module.exports = Brain;
