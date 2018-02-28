var rpio = require('rpio')
var _ = require('underscore')

class explorerBoard {
    constructor() {
        this.movement = new Movement();
    }
}

class Movement {
    constructor() {
        var config = {
            max_pwm: 1000,
            min_pwm: 500,
            motors: {
                left: {
                    pwm: 37,
                    dir: 40,
                },
                right: {
                    pwm: 38,
                    dir: 35
                }
            },
        }
        rpio.init({
            gpiomem: false
        })
        this.config = config;
        this.control = false;
        _.each(this.config.motors, function (motor) {
            rpio.open(motor.pwm, rpio.OUTPUT)
            //rpio.pwmSetClockDivider(64)
            //rpio.pwmSetRange(motor.pwm, config.max_pwm);
            rpio.open(motor.dir, rpio.OUTPUT)
        })
    }

    scale_pwm(pwm_val) {
        if (pwm_val) {
            return (pwm_val * ((this.config.max_pwm - this.config.min_pwm) / this.config.max_pwm)) + Math.sign(pwm_val) * this.config.min_pwm;
        }
        return 0;
    }

    setForwardDir(motor) {
        rpio.write(motor.dir, rpio.LOW);
        rpio.write(motor.pwm, rpio.HIGH);
    }

    setBackwardDir(motor) {
        rpio.write(motor.dir, rpio.HIGH);
        rpio.write(motor.pwm, rpio.LOW);
    }

    runMotor(motor, motor_pwm) {
        var currentMotor = this.config.motors[motor];
        if (motor_pwm < 0) {
            this.setBackwardDir(currentMotor);
        } else {
            this.setForwardDir(currentMotor);
        }
        //rpio.pwmSetData(currentMotor.pwm, Math.abs(motor_pwm));
    }

    runRobot(left_pwm, right_pwm, accel) {
        var left_drift;
        //transform acceleration from percentage to pwm
        accel = (this.config.max_pwm / 100) * accel;
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
        rpio.write(this.config.motors.right.pwm, rpio.LOW);
        rpio.write(this.config.motors.left.pwm, rpio.LOW);
        rpio.write(this.config.motors.left.dir, rpio.LOW);
        rpio.write(this.config.motors.right.dir, rpio.LOW);
    }
}

module.exports = explorerBoard;
