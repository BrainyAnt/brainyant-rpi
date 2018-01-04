var promise = require('promise');
var _ = require('underscore');
var five = require("johnny-five");

class mBotBoard {
    constructor() {
        this.board = new five.Board({port:'/dev/rfcomm0' });
        var _this = this
        this.promise = new Promise(function(resolve, reject) {
            _this.board.on("ready", function(err) {
                if (err){
                    console.log(err);
                    reject("NOT initialized!")
                    return;
                }
                _this.movement = new Movement(this.board);
                _this.lightSensor = new LightSensor(this.board);
                _this.proximitySensor = new ProximitySensor(this.board);
                _this.piezo = new Piezo(this.board);
                _this.lineSensor = new Line(this.board);
            });
        });
        
    }
}

class Line {
    constructor(board) {
        this.board = board;
        this.eyes = new five.IR.Reflect.Array({
            emitter: 13,
            pins: ["A3", "A2"], // any number of pins
            freq: 100,
            autoCalibrate: true,
        });
    }
    readRaw() {
        this.eyes.on('data', function() {
            console.log( "Raw Values: ", this.raw );
        });
    }
    readLine(){    
        this.eyes.on('line', function() {
            console.log( "Line Position: ", this.line);
        });
    }
    enable(){
        this.eyes.enable();
    }
}

class Piezo {
    constructor(board) {
        this.board = board;
        // Creates a piezo object and defines the pin to be used for the signal
        this.piezo = new five.Piezo(8);
    }
    play() {
        this.piezo.play({
            // song is composed by a string of notes
            // a default beat is set, and the default octave is used
            // any invalid note is read as "no note"
            song: "C D F D A - A A A A G G G G - - C D F D G - G G G G F F F F - -",
            beats: 1 / 4,
            tempo: 100
        });
    }
}

class LightSensor {
    constructor(board){
        this.board = board;
        this.sensor = new five.Sensor({
            pin: "A6",
            freq: 500 // change this to speed you want data reported at. Slower is better
        });
        
    }
    read() {
        this.sensor.on("data", function() {
            console.log("Light: ", this.value);
        });
    }
}

class ProximitySensor {
    constructor(board) {
        this.board = board;
        this.proximity = new five.Proximity({
                freq: 1000,
                controller: "HCSR04",
                pin: 10
            });
    }
    onRead(publishData) {
        this.proximity.on("data", function() {
            publishData(this.cm);
        });
    }
}

class Movement {
    constructor(board) {
        var config = {
            standBy: 38,
            max_pwm: 255,
            min_pwm: 130,
            motors: {
                left: null,
                right: null
            },
        }
        
        //TODO this is a workaround. When sending  too many commands the robot has mechanical glitches.
        this.onTime=true;
        this.commandDelayMS=90;

        this.config = config;
        this.control = false;
        this.board = board;
        
        this.config.motors['left'] = new five.Motor({pins: {pwm: 6, dir: 7}});
        this.config.motors['left'].goForward = this.config.motors['left'].reverse;
        this.config.motors['left'].goBackward = this.config.motors['left'].forward;
        
        this.config.motors['right'] = new five.Motor({pins: {pwm: 5, dir: 4}});
        this.config.motors['right'].goForward = this.config.motors['right'].forward;
        this.config.motors['right'].goBackward = this.config.motors['right'].reverse;
    }

    scale_pwm(pwm) {
        if (pwm) {
            return (pwm * ((this.config.max_pwm - this.config.min_pwm) / this.config.max_pwm)) + Math.sign(pwm) * this.config.min_pwm;
        }
        return 0;
    }

    runMotor(motor, motor_pwm) {
        var currentMotor = this.config.motors[motor];
        if (currentMotor == null) {
            return;
        }
        if (motor == "right") {
            motor_pwm=5*Math.sign(motor_pwm)+motor_pwm;
        }
       if (motor_pwm < 0) {
            currentMotor.goBackward(Math.abs(motor_pwm));
        } else {
            currentMotor.goForward(Math.abs(motor_pwm));
        }
    }

    runRobot(left_pwm, right_pwm, accel) {
        var left_drift;
        if (!this.onTime){
            return;
        }
        var _this=this;
        this.onTime=false;
        setTimeout ( function (){
             _this.onTime=true;
        }, this.commandDelayMS);
 
        if (accel) {
            left_drift = ((left_pwm - right_pwm) / 100) * accel;
            left_drift += Math.sign(left_drift) * this.config.min_pwm / 2;
        } else {
            left_drift = ((left_pwm - right_pwm) / 100) * this.config.max_pwm;
        }
        var left_accel = accel - left_drift;
        var right_accel = accel + left_drift;
        left_accel = this.scale_pwm(left_accel);
        right_accel = this.scale_pwm(right_accel);
        this.runMotor("left", left_accel);
        this.runMotor("right", right_accel);
    }

    clear() {
        _.each(this.config.motors, function (motor) {
              if ( motor!=null ){
                  motor.stop();
              }
        })
    }
}

module.exports = mBotBoard;
