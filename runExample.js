Brain = require("brainyant-rpi").Brain;
Board = require("brainyant-rpi").furnicaBoard;
board = new Board();
brain = new Brain();

brain.userCommand.subscribe(function(command){
  if (command['fwd'] || command['back'] ||
      command['left'] || command['right']) {
      var accel = command['fwd'] - command['back'];
      board.movement.runRobot(command['left'], command['right'], accel);
  } else {
      board.movement.clear()
  }
})

var dist=0;

brain.registerSensor('Distance', function() {
    return dist++;
  })

brain.registerCommand('front', function(data) {
    board.runRobot(255, 255, data);
})