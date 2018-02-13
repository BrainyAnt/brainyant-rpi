brainyant-rpi
=============

Node JS library interfacing Raspberry Pi with BrainyAnt platform. Use this to build your own
robot and code the funcionality you desire.

## System Requirements

Hardware:
  Raspberry Pi 3
  Raspicam
  Actuators and sensors.

Operating System: Raspian Stretch

## Connect device to the internet:

Connect your Raspberry Pi to a monitor, a keyboard and a mouse. You will be able to use the graphical
interface to connect to WiFi or Ethernet.

## Install dependencies:

Node JS
```console
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Use Raspicam for broadcasting video

ffmpeg
```console
sudo apt-get install ffmpeg
```
Enable raspicam

```console
$ sudo raspi-config
```
Navigate to 'Interface Options'>'Camera' and enable camera. Reboot device.

## Setup Your Robot

Open the terminal on the Rapberry Pi and create a new folder:

```console
mkdir myRobot
cd myRobot
```

Browse to [brainyant.com](https://brainyant.com), create an account and add a new robot.
Connect to your RPi, open a browser and login to your account in brainyant.com. Go to the newly
added robot and press the "Download Auth File" button. This will save auth.json that contains your
robot credentials. Save it to the forlder you just created: myRobot.

Install brainyant-rpi package. This will take some time.

```console
$ npm install brainyant-rpi
```

## Build your code

You are ready to start adding functionality to your robot. You can subscribe to the commands taken
from the web app which the users are sending and also add output data that will be visible on the
user interface. Create a new js file, import brainyant-rpi and start adding functions like in the
example.

```console
nano myRobot.js
```

```js
var brain = require("brainyant-rpi");
brain = new brain.Brain();

// Handle user command
// This function will get trigered each time
// the use in control touches a control key or button
brain.userCommand.subscribe(function(command){
  // command is a JSON Object with the structure:
  // command {
  //   fwd:   <forward-command>; // 0-100
  //   back:  <back-command>;    // 0-100
  //   left:  <left-command>;    // 0-100
  //   right: <right-command>;   // 0-100
  // }

  // Your code goes here
  // ...
}) 

// Register a sensor
brain.registerSensor('Distance', function() {
  //return data from your sensor
  var dummyValue=1;
  return dummyValue;
})
``

Save the file using Ctrl+x

## Run

Start your node application. Use sudo if you are accessing the input/output pins. Don't forget to connect
your raspicam so the users of your robot will be able to see what they are doing;

```console
sudo node myRobot.js
```
