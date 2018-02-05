brainyant-rpi
=============

Node JS library interfacing Raspberry Pi with BrainyAnt platform. Use this to build your own
robot and code the funcionality you desire.

## System Requirements

Hardware:
  Raspberry Pi 3
  Raspicam
  Some actuators. It can be anything from a LED to Mars Rover

Operating System: Raspian Stretch

## Install dependencies:

Node JS
```console
curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Use Raspicam for broadcasting video

ffmpeg
```console
sudo apt-get install ffmpeg
```

## Setup Your Robot

Browse to [brainyant.com](https://brainyant.com), create an account and add a new robot. Remember to
add a video stream for the robot;
Connect to your RPi, open a browser and login to your account in brainyant.com. Go to the newly
added robot and press the "Download Auth File" button. This will save auth.json that contains your
robot credentials. Create a separate folder and save it on the disk.

Open the console, browse to the new folder and install brainyant-rpi package. This will take some
time.

```console
$ npm install brainyant-rpi
```

Enable raspicam

```console
$ sudo raspi-config
```
Navigate to 'Interface Options'>'Camera' and enable camera. Reboot device.

You are ready to start adding functionality to your robot. Create a new js file, import brainyant-rpi
library and start adding functions. You can subscribe to the commands taken from the web app which
the users are sending. 

```js
var brain = require("brainyant-rpi");
brain = new brain.Brain();

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
```

## Run

Start your node application. Use sudo if you are accessing the input/output pins. Don't forget to connect
your raspicam so the users of your robot will be able to see what they are doing;

```console
sudo node run_my_first_brainy_bot.js
```
