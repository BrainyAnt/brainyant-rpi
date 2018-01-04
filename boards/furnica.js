var rpio = require('rpio')
var _ = require('underscore')

class furnicaBoard {
    constructor() {
        this.movement = new Movement();
    }
}

class Movement {
    constructor() {
        var config = {
            max_pwm: 1000,
            min_pwm: 500,
            standBy: 38,
            motors: {
                left: {
                    pwm: 12,
                    in1: 16,
                    in2: 18
                },
                right: {
                    pwm: 35,
                    in1: 29,
                    in2: 31
                }
            },
        }
        rpio.init({
            gpiomem: false
        })
        this.config = config;
        this.control = false;
        rpio.open(this.config.standBy, rpio.OUTPUT)
        _.each(this.config.motors, function (motor) {
            rpio.open(motor.pwm, rpio.PWM)
            rpio.pwmSetClockDivider(64)
            rpio.pwmSetRange(motor.pwm, config.max_pwm);
            rpio.open(motor.in1, rpio.OUTPUT)
            rpio.open(motor.in2, rpio.OUTPUT)
        })
    }

    scale_pwm(pwm_val) {
        if (pwm_val) {
            return (pwm_val * ((this.config.max_pwm - this.config.min_pwm) / this.config.max_pwm)) + Math.sign(pwm_val) * this.config.min_pwm;
        }
        return 0;
    }

    activate() {
        rpio.write(this.config.standBy, rpio.HIGH);
    }

    standBy() {
        rpio.write(this.config.standBy, rpio.LOW);
    }

    setForwardDir(motor) {
        rpio.write(motor.in1, rpio.HIGH);
        rpio.write(motor.in2, rpio.LOW);
    }

    setBackwardDir(motor) {
        rpio.write(motor.in1, rpio.LOW);
        rpio.write(motor.in2, rpio.HIGH);
    }

    runMotor(motor, motor_pwm) {
        var currentMotor = this.config.motors[motor];
        if (motor_pwm < 0) {
            this.setBackwardDir(currentMotor);
        } else {
            this.setForwardDir(currentMotor);
        }
        rpio.pwmSetData(currentMotor.pwm, Math.abs(motor_pwm));
    }

    runRobot(left_pwm, right_pwm, accel) {
        this.activate();
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
        rpio.write(this.config.standBy, rpio.LOW)
        _.each(this.config.motors, function (motor) {
            rpio.write(motor.pwm, rpio.LOW);
            rpio.write(motor.in1, rpio.LOW);
            rpio.write(motor.in2, rpio.LOW);
        })
    }
}

module.exports = furnicaBoard;
