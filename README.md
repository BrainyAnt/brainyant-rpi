brainyant-rpi
=============

Node JS library interfacing Raspberry Pi with BrainyAnt platform. Use this to build your own
robot and code the funcionality you desire.

## System Requirements

Hardware: Raspberry Pi 3
Operating System: Raspian Stretch

Install dependencies:

Node JS
```console
curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
sudo apt-get install -y nodejs
```

ffmpeg - if you have an onboard camera
```console
sudo apt-get install ffmpeg
```

## Install

Browse to brainyant.com/newrobot and add a new robot. You can see it listed in "My Robots" list.
Connect to a raspberry pi and connect to your account in brainyant.com. Go to the newly added robot
and press "Download Auth File" button. This will save auth.json that contains your robot credentials
that will be used to communicate with the platform.
Save it on the disk in a separate folder and open the console in that folder.

```console
$ npm install brainyant-rpi
```

In the same folder you can now start writing code to do whatever you want with your device based on
the controls got from the user.

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
