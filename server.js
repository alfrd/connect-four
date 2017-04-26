//Server things

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
//http.maxConnections = 7;

//some variables
var whoseTurn;
var playerList = [];
var clients = [];
var gameOver = 0;
var isLocalGame;

//Highscore list (most wins)
var highscoreList = new Map();
var topThree = new Map();
var topThreeUsernames = [];
var topThreeWins = [];

//for logging of games
var fs = require('fs');
var logger = fs.createWriteStream('gameslog.txt', {
  flags: 'a' // 'a' means appending (old data will be preserved)
});

//Multiplayer stuff
var waitingForPlayer = null;
var isOnlineGame;

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function(req, res) {
  res.sendFile(__dirname + '/style.css');
});

app.get('/node_modules/bootstrap/dist/css/bootstrap.min.css', function(req, res) {
  res.sendFile(__dirname + '/node_modules/bootstrap/dist/css/bootstrap.min.css')
});

app.get('/client.js', function(req, res) {
  res.sendFile(__dirname + '/client.js');
});

app.get('/node_modules/jquery/dist/jquery.js', function(req, res) {
  res.sendFile(__dirname + '/node_modules/jquery/dist/jquery.js');
});

app.get('/node_modules/js-cookie/src/js.cookie.js', function(req, res) {
  res.sendFile(__dirname + '/node_modules/js-cookie/src/js.cookie.js');
});
io.on('connection', function(socket) {

  console.log('a user connected ' + socket.id);

  if(isLocalGame || isOnlineGame) {
    socket.emit('game state', boardMatrix, boardHeight, boardWidth, whoseTurn, playerList[1], playerList[2], isLocalGame, isOnlineGame);
    socket.emit('highscore', topThreeUsernames, topThreeWins);
    console.log("A user reloaded");
  } else {
    waitingForPlayer = null;

  }
  /*
  socket.emit('client id', socket.id);

  var usersInRoom = io.of('/').in('game room').clients;
  console.log('length: ' + usersInRoom.length);
  if(usersInRoom.length < 2) {
    socket.join('game room');
    io.to('game room').emit('client joined room', socket.id);
  }
  */

  //Starts a new local game
  socket.on('new local game', function(username1, username2) {
    if (!isOnlineGame && !isLocalGame) { //Can't start a local game if the server is busy with online game
      console.log("A new game was started by " + username1 + " and " + username2);
      logger.write("\nA new game was started by " + username1 + " and " + username2);
      whoseTurn = Math.floor((Math.random() * 2) + 1);
      console.log(whoseTurn);
      setPlayers(username1, username2);
      //clear boardMatrix
      boardMatrix = createBoardMatrix(boardWidth, boardHeight);
      updateTopThree();
      gameOver = 0;
      isOnlineGame = false;
      isLocalGame = true;
      socket.emit('initialize local game', boardWidth, boardHeight, whoseTurn, playerList[1], playerList[2]);

      //Sending the highscore toplist to the client.
      socket.emit('highscore', topThreeUsernames, topThreeWins);
    } else {
      socket.emit('game in progress');
    }


  });

  //When a client tells the server that a checker has been dropped into the board.
  //The client tells the server what column it was dropped in with "columnNbrClick"
  //and which player dropped it with "player"
  socket.on('dropped checker', function(columnNbrClick, player) {
    if (gameOver != 1 && dropChecker(player, columnNbrClick)) {
      console.log(playerList[player] + " played");
      logger.write("\n" + playerList[player] + " played");
      printBoard();
      io.sockets.emit('successful drop', latestPositionX, latestPositionY);
      if (whoseTurn == 1) {
        whoseTurn = 2;
      } else {
        whoseTurn = 1;
      }
      console.log(playerList[whoseTurn] + "'s turn to play");
      logger.write("\n" + playerList[whoseTurn] + "'s turn to play");

      //Check if the dropped checker resulted in a win
      if (checkFromPosition(latestPositionX, latestPositionY)) {
        if(isOnlineGame) {
          io.sockets.emit('win', player);
        } else {
          socket.emit('win', player)
        }
        console.log(playerList[player] + ' won!');
        gameOver = 1;
        isOnlineGame = false;
        isLocalGame = false;
        addWin(playerList[player]);
        setPlayers(null, null);
      }
    } else {
      io.sockets.emit('unsuccessful drop', "Column " + columnNbrClick + " is full");
    }
    if (checkIfBoardIsFull()) {
      console.log("board is full");
      io.sockets.emit('board full', "Draw, the board is full!");
      logger.write("\nDraw, the board is full!");
    }
  });

  //When a new online game is initialized by a client by a player with username "username"
  socket.on('online multiplayer init', function(username) {
    if (waitingForPlayer != null) { //Checks if there is another player waiting in the lobby
      setPlayers(waitingForPlayer, username);
      socket.emit('online multiplayer number', 2); //If there's already a player waiting in the lobby, this client will be player 2

      console.log("A new game was started by " + playerList[1] + " and " + playerList[2]);
      logger.write("\nA new game was started by " + playerList[1] + " and " + playerList[2]);

      whoseTurn = Math.floor(Math.random() * 2 + 1); //Randomizes who gets the first turn

      //clears boardMatrix
      boardMatrix = createBoardMatrix(boardWidth, boardHeight);
      updateTopThree();
      gameOver = 0;
      isOnlineGame = true;
      io.sockets.emit('online multiplayer initialize game', playerList[1], playerList[2], boardWidth, boardHeight, whoseTurn);
      //Sending the highscore toplist to the client.
      io.sockets.emit('highscore', topThreeUsernames, topThreeWins);
      waitingForPlayer = null;
    } else { //If there's no player in the lobby, place this "username" in the lobby and tell all other clients about it
      socket.emit('online multiplayer number', 1);
      waitingForPlayer = username;
      console.log(waitingForPlayer + " entered the online lobby");
      logger.write("\n" + waitingForPlayer + " entered the online lobby");
      io.sockets.emit('wants to play', username);
    }

  });

  //When a user disconnects during a online game
  //The client provides the parameter "multiplayerNbr" which tells the server
  //if the player is player 1 och player 2
  socket.on('online multiplayer disconnect', function(multiplayerNbr) {
    if (multiplayerNbr == 1) {
      waitingForPlayer = null;
      io.sockets.emit('wants to play', waitingForPlayer); //To empty the lobby on the clients
    }
    io.sockets.emit('user disconnected');
  });

  //When a client requests the lobby i.e. the variable waitingForPlayer
  socket.on('get lobby', function() {
    if(waitingForPlayer != null) { //only print this if someone is waiting
      console.log(waitingForPlayer + " is waiting...");
    }
    socket.emit('wants to play', waitingForPlayer);
  });

  //When a client enters the online lobby, the server responds with
  //isOnlineGame to to tell the client if there is an online gam in progress
  //and waitingForPlayer to tell the client if there is someone waiting in the lobby
  socket.on('entered online lobby', function() {
    socket.emit('lobby response', isOnlineGame, waitingForPlayer);
  })
  //When a user disconnects from the server (happens when a client reloads the page in the browser)
  socket.on('disconnect', function() {
    console.log('user disconnected');

  });
});


//Listens for connections on port 3000
http.listen(3000, function() {
  console.log('listening on *:3000');
});



//Saves the current players with respective usernames
function setPlayers(username1, username2) {
  //Fills the first position with a zero, so we get player IDs that are non-zero
  playerList[0] = 0;
  playerList[1] = username1;
  playerList[2] = username2;
}

//Adds a win for the username to the highscoreList
function addWin(username) {
  if (highscoreList.has(username)) {
    var u = highscoreList.get(username);
    var nbrOfWins = u + 1;
    highscoreList.set(username, nbrOfWins);
    console.log(username + " has won before! (" + nbrOfWins + " times exactly!)");
  } else {
    highscoreList.set(username, 1);
    console.log("That was " + username + "'s first win!");
  }
  updateTopThree();
}

//Updates the three usernames with the most wins and their number of wins
//in the arrays topThreeUsernames and topThreeWins
function updateTopThree() {

  //three values holding the largest, second largest and third largest values
  var temp1Val = 0;
  var temp2Val = 0;
  var temp3Val = 0;
  //three variables holding the usernames of the usernames related to the value currently in the temp1Val,temp2Val,temp3Val variables
  var temp1uname = "";
  var temp2uname = "";
  var temp3uname = "";

  //Goes through the highscoreList to find the three usernames with the most wins
  highscoreList.forEach(function(value, key) {
    if (value > temp1Val) {
      temp2Val = temp1Val;
      temp2uname = temp1uname;
      temp1Val = value;
      temp1uname = key;
    } else if (value > temp2Val) {
      temp3Val = temp2Val;
      temp3uname = temp2uname;
      temp2Val = value;
      temp2uname = key;
    } else if (value > temp3Val) {
      temp3Val = value;
      temp3uname = key;
      console.log("temp3uname: " + temp3uname);
    }
  });

  //The highscore toplist is split into two arrays (instead of a map) since there were
  //problems with sending a Map object to the client
  topThreeWins[0] = temp1Val;
  topThreeWins[1] = temp2Val;
  topThreeWins[2] = temp3Val;
  topThreeUsernames[0] = temp1uname;
  topThreeUsernames[1] = temp2uname;
  topThreeUsernames[2] = temp3uname;
}




//Code below represents the game board

var boardWidth = 7;
var boardHeight = 6;
var boardMatrix; //standard size 7x6
var latestPositionX; //Used when checking for 4-in-a-row to keep track of the previous x-position
var latestPositionY; //Used when checking for 4-in-a-row to keep track of the previous y-position

//Creates a matrix with a width and a height, filled with zeros representing empty positions
//i.e an empty board
function createBoardMatrix(width, height) {
  var matrix = [];
  for (var i = 0; i < width; i++) {
    matrix[i] = Array.apply(null, Array(height)).map(Number.prototype.valueOf, 0);
  }
  return matrix;
}

//Drops a checker by a "player" in a "column" in the boardMatrix
//returns true if the drop was successful, i.e. the column was not full
//returns false if the drop was unsuccessful, i.e. the colum was full
function dropChecker(player, column) {
  var pos; //A variable used to see if the position is empty
  for (var i = 0; i < boardHeight; i++) {
    pos = boardMatrix[column][i];
    if (pos == 0) {
      latestPositionX = column;
      latestPositionY = i;
      boardMatrix[column][i] = player;
      return true
    }
  }
  return false;
}

//Prints a column to the console
function printColumn(column) {
  for (var i = 0; i < boardHeight; i++) {
    console.log("Row " + i + ": " + boardMatrix[column][i]);
  }
}

//Prints boardMatrix and logs to the log file
function printBoard() {
  var row;
  for (var i = boardHeight - 1; i >= 0; i--) {
    row = "";
    for (var j = 0; j < boardWidth; j++) {
      row += boardMatrix[j][i] + " ";
    }
    console.log(row);
    logger.write("\n" + row);

  }
  console.log("-----------------");
  logger.write("\n-----------------");
}

//Goes through the top row of the board to check if the board is full (returns true if the board is full)
function checkIfBoardIsFull() {
  for (var i = 0; i < boardWidth; i++) {
    if (boardMatrix[i][boardHeight - 1] == 0) {
      return false;
    }
  }
  return true;
}

//Runs a check for 4-in-a-row from a specific checker
//returns true if 4-in-a-row is found
function checkFromPosition(x, y) {
  if (checkRow(y) || checkColumn(x) || checkDiagonals(x, y)) {
    return true;
  } else {
    return false;
  }
}

//Check rows from left to right starting with row 0 (the lowest one)
//returns true if 4-in-a-row is found, else returns false
function checkRow(y) {
  var prevChecker = boardMatrix[0][y];
  var thisChecker;
  var inRowCounter = 1;

  for (var i = 1; i < boardWidth; i++) {
    thisChecker = boardMatrix[i][y];
    if (prevChecker != 0 && prevChecker == thisChecker) {
      inRowCounter++;

      if (inRowCounter == 4) {
        console.log("Four in a row in row " + y);
        return true;
      }
    } else {
      inRowCounter = 1;
    }
    prevChecker = thisChecker;
  }
  return false;
}

//Check columns from bottom to top starting with column 0 (the leftmost one)
//returns true if 4-in-a-row is found, else returns false
function checkColumn(x) {
  var prevChecker = boardMatrix[x][0];
  var thisChecker;
  var inRowCounter = 1;

  for (var i = 1; i < boardHeight; i++) {
    thisChecker = boardMatrix[x][i];
    if (prevChecker != 0 && prevChecker == thisChecker) {
      inRowCounter++;
      if (inRowCounter == 4) {
        return true;
      }
    } else {
      inRowCounter = 1;
    }
    prevChecker = thisChecker;
  }
  return false;
}

//Check diagonals first from left to right, then right to left for 4-in-a-row
//returns true if 4-in-a-row is found, else returns false
function checkDiagonals(x, y) {

  var thisChecker;
  var inRowCounter = 1;

  var newX = x;
  var newY = y;

  //Diagonal from down left to up right

  //This will find the starting position of the diagonal
  while (newX > 0 && newY > 0) {
    newX--;
    newY--;
  }
  var prevChecker = boardMatrix[newX][newY];
  while (newX < boardWidth - 1 && newY < boardHeight - 1) {
    newX++;
    newY++;
    thisChecker = boardMatrix[newX][newY];
    if (prevChecker != 0 && prevChecker == thisChecker) {
      inRowCounter++;
      if (inRowCounter == 4) {
        return true;
      }
    } else {
      inRowCounter = 1;
    }
    prevChecker = thisChecker;
  }

  //Resets to original position
  newX = x;
  newY = y;

  //This will find the starting position of the diagonal
  while (newX > 0 && newY < boardHeight) {
    newX--;
    newY++;
  }

  //Going through the diagonal
  var prevChecker = boardMatrix[newX][newY];
  inRowCounter = 1;
  while (newX < boardWidth - 1 && newY > 0) {
    newX++;
    newY--;
    thisChecker = boardMatrix[newX][newY];
    if (prevChecker != 0 && prevChecker == thisChecker) {
      inRowCounter++;
      if (inRowCounter == 4) {
        return true;
      }
    } else {
      inRowCounter = 1;

    }
    prevChecker = thisChecker;
  }
}
