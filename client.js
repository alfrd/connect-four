//Some variables
var socket = io(); //creates an instance of socket.io
var whosTurn = 1; //Keeps track of who's turn it is to play
var columnNbrHover; //Holds the number for the column that the mouse hovered over last
var playerList = []; //Holds username1 at index 1 and username2 at index 2 (index 0 is not used, since it represents an empty position on the board)
var multiplayerNbr = 0; //Keeps track of if this client is player 1 or player 2 in a online game (0 means not in online game)
var isOnlineGame; //Is true if it's an online game in progress, else false
var isLocalGame; //Is true if it's an local game in progress, else false
var clientID; //this clients ID at the server
$(function() {

  console.log("multiplayerNbr is: " + multiplayerNbr);

  //Shows the new local game overlay where you choose usernames when
  //the newgame-btn is clicked
  $('#newgame-btn').click(function() {
    $('#local-game-overlay').show();
    socket.emit('online multiplayer disconnect', multiplayerNbr);
  });

  //Cancels and removes the local game overlay when cancel-local-overlay-btn is pressed
  $('#cancel-local-overlay-btn').click(function() {
    if (!isOnlineGame && !isLocalGame) {
      $('#p1-turn').addClass("hider");
      $('#p2-turn').addClass("hider");
    }
    $('#local-game-overlay').hide();
    $('.game-in-progress').hide();
  });

  //Sends the selected usernames for a local game to the server to
  //start the game when the submit-username-local-btn is pressed
  $('#submit-username-local-btn').click(function() {

    if ($("#player1-username").val() != "" && $("#player2-username").val() != "") {
      socket.emit('new local game', $("#player1-username").val(), $("#player2-username").val());
      isLocalGame = true;
      Cookies.set('isLocalGame', 1);
      Cookies.set('multiplayerNbr', 0);
    }
  });

  //Enters the online lobby when online-multiplayer-btn is pressed
  $('#online-multiplayer-btn').click(function() {
    $('#online-multiplayer-overlay').show();
    socket.emit('entered online lobby');
    socket.on('lobby response', function(state) {
      if (state == null) {
        Cookies.set('isOnlineGame', 0);
      } else if(state == true) {
        Cookies.set('isOnlineGame', 1);
      } else {
        Cookies.set('isOnlineGame', 0);
      }
      console.log(isOnlineGame);

      if (Cookies.get('isOnline') == 1) {
        console.log("first");
        $('.game-in-progress').show();
      } else if (Cookies.get('multiplayerNbr') == 1 && Cookies.get('isOnlineGame') == 1) {
        socket.emit('get lobby');
        $('#waiting-for-other-player').removeClass('hider');
        $('#submit-username-online-multiplayer-btn').addClass('disabled');
        $('#submit-username-online-multiplayer-btn').addClass('disable-click');
      } else {
        socket.emit('get lobby');
      }
    });


  });

  //Hides the online multiplayer overlay when cancel-online-multiplayer-overlay-btn is clicked
  $('#cancel-online-multiplayer-overlay-btn').click(function() {
    if (multiplayerNbr == 1 && Cookies.get('isOnlineGame') == 0) { //Checks if this client is already in the online lobby or if game is in progress
      socket.emit('online multiplayer disconnect', multiplayerNbr);
      multiplayerNbr = null;
      $('#waiting-for-other-player').addClass('hider');
      $('#submit-username-online-multiplayer-btn').removeClass('disabled');
      $('#submit-username-online-multiplayer-btn').removeClass('disable-click');
    }
    $('#online-multiplayer-overlay').hide();
  });


  //Submit online multiplayer username to server and wait for other player
  //when submit-username-online-multiplayer-btn is pressed
  $('#submit-username-online-multiplayer-btn').click(function() {
    if ($("#online-multiplayer-username").val() != "" && Cookies.get('isOnlineGame') == 0) {
      socket.emit('online multiplayer init', $("#online-multiplayer-username").val());
      $('#waiting-for-other-player').removeClass('hider');
      $('#submit-username-online-multiplayer-btn').addClass('disabled');
      $('#submit-username-online-multiplayer-btn').addClass('disable-click');
    }
  });

  //Sends a disconnect from online multiplayer message to the server
  //when online-multiplayer-disconnect-btn is clicked
  $('#online-multiplayer-disconnect-btn').click(function() {
    Cookies.set('isOnlineGame', 0);
    Cookies.set('multiplayerNbr', 0);
    $('#waiting-for-other-player').addClass('hider');
    socket.emit('online multiplayer disconnect', multiplayerNbr);
    $('#submit-username-online-multiplayer-btn').removeClass('disabled');
    $('#submit-username-online-multiplayer-btn').removeClass('disable-click');
  });

  //Recieves a response from the server containing the client id
  socket.on('client id', function(id) {
    console.log("This clients id: " + id);
    clientID = id;
  });

  socket.on('client joined room', function(id) {
    console.log(id + " joined the game room");
  })
  //When the server tells the client that an online game is in progress
  //the game in progress alert will be shown
  socket.on('game in progress', function() {
    $('.game-in-progress').show();
  })

  //Receives info from the server about if this client is player number 1 och player number 2
  socket.on('online multiplayer number', function(nbr, opponent) {
    multiplayerNbr = nbr;
    Cookies.set('multiplayerNbr', nbr);
    console.log("Your multiplayerNbr is set to " + Cookies.get('multiplayerNbr'));
  });

  //When the client receives a 'online multiplayer initialize game' message
  //from the server, it will prepare the page for a new online multiplayer game
  socket.on('online multiplayer initialize game', function(mpUsername1, mpUsername2, boardWidth, boardHeight, firstTurn) {
    multiplayerNbr = Cookies.get('multiplayerNbr');
    setPlayers(mpUsername1, mpUsername2);
    onlineMultiplayerSetup(firstTurn);
    renderBoard(boardWidth, boardHeight);

  });

  //
  socket.on('user disconnected', function() {
    if (isOnlineGame) {
      //$('#winner').text('The other user disconnected, please reload the page!');
      //$('#winner').show();
    }

  });

  socket.on('game state', function(boardMatrix, boardHeight, boardWidth, whosTurn, username1, username2, isLocalGame, isOnlineGame) {
    if (Cookies.get('isOnlineGame') == 1) {
      console.log("Shouldn't be here");
      multiplayerNbr = Cookies.get('multiplayerNbr');
      setPlayers(username1, username2);
      onlineMultiplayerSetup(whosTurn);
      renderBoard(boardWidth, boardHeight);
      refillBoard(boardMatrix, boardWidth, boardHeight);
    } else if (Cookies.get('isLocalGame') == 1) {
      setPlayers(username1, username2);
      localSetup(whosTurn);
      renderBoard(boardWidth, boardHeight);
      refillBoard(boardMatrix, boardWidth, boardHeight);
    }

  });

  socket.on('wants to play', function(username) {
    $('#wants-to-play').text(username);
  });

  //Creates a rematch with the same usernames as the previous game
  $('#rematch-btn').click(function() {
    socket.emit('new local game', playerList[1], playerList[2]);
  });

  //When the server initializes a game
  socket.on("initialize local game", function(width, height, firstTurn, username1, username2) {
    if (isLocalGame) {
      console.log("new local game");
      setPlayers(username1, username2);
      localSetup(firstTurn);
      renderBoard(width, height);
    }
  });

  //Receiving the highscore from the server. It's split into two arrays
  //since there were problems with sending a Map object
  socket.on("highscore", function(topThreeUsernames, topThreeWins) {
    console.log("Highscore: ");
    $('#highscore-list').remove();
    $('#highscore').append('<ul class="list-group" id="highscore-list">');
    $('#highscore').removeClass("hider");
    for (var i = 0; i < 3; i++) {
      console.log(topThreeUsernames[i] + ": " + topThreeWins[i]);
      if (topThreeUsernames[i] != "") {
        $('#highscore-list').append($('<li class="list-group-item">' + topThreeUsernames[i] + ': ' + topThreeWins[i] + '</li>'))
      }

    }
  });

  socket.on('successful drop', function(x, y) {
    if (Cookies.get('isLocalGame') == 1 || Cookies.get('isOnlineGame') == 1) {
      console.log("Succesful drop " + Cookies.get('isLocalGame') + " " + Cookies.get('isOnlineGame'));
      if (whosTurn == 1) {
        $('#pos-' + x + y).children().addClass("make-red");
      } else {
        $('#pos-' + x + y).children().addClass("make-black");
      }
      $('#top-' + columnNbrHover).children().removeClass("make-black");
      $('#top-' + columnNbrHover).children().removeClass("make-red");
      switchTurn();
    }
  });

  socket.on('win', function(winner) {
    console.log("Winner: " + playerList[winner]);
    $('#winner-text').text(playerList[winner] + " won!");
    $('#winner').show();
    console.log(playerList[winner] + " won!");
    //$('#rematch-btn').show();
    $('#p1-turn').addClass("hider");
    $('#p2-turn').addClass("hider");
    $('.game-in-progress').hide();
    $('#submit-username-online-multiplayer-btn').removeClass('disabled');
    $('#submit-username-online-multiplayer-btn').removeClass('disable-click');

    multiplayerNbr = null;

    Cookies.set('isOnlineGame', 0);
    Cookies.set('isLocalGame', 0);
    Cookies.set('multiplayerNbr', 0);
  });

  socket.on('board full', function(message) {
    $('#winner-text').text(message);
    $('#winner').show();
    $('#rematch-btn').show();
  });

});



//Renders the game board
function renderBoard(width, height) {
  //clear board
  $('#board-table').remove();
  $('#board-table-top').remove();

  //create board again
  $('#board').append($('<table id="board-table-top">'));
  $('#board').append($('<table id="board-table">'));
  $('#board-table-top').append($('<tr id="top-boardRow" class="board-row">'));

  //create circles above board
  for (var h = 0; h < width; h++) {
    $('#top-boardRow').append($('<td id="top-' + h + '" class="place-checker-hole">').append($('<div class="circle-hole">')))
  }
  //create the circles on the board
  for (var i = height - 1; i >= 0; i--) {
    $('#board-table').append($('<tr id="boardRow' + i + '" class="board-row">'));

    for (var j = 0; j < width; j++) {
      $('#boardRow' + i).append($('<td id="pos-' + j + i + '">').append($('<div class="circle-hole">')));

    }
  }

  //Listens for a click on the circles above the board and sends the dropp event to the server
  $('#board-table-top td').click(function() {
    var columnNbrClick = parseInt($(this).index());
    if (Cookies.get('isOnlineGame') == 1) {
      if (multiplayerNbr == whosTurn) { //to check if it's your turn and if you are allowed to drop
        socket.emit('dropped checker', columnNbrClick, whosTurn);
      }
    } else if (Cookies.get('isLocalGame') == 1) {
      socket.emit('dropped checker', columnNbrClick, whosTurn);
    }


  });

  //Listens for hovers over the circles above the board
  $('#board-table-top td').hover(function() {
    columnNbrHover = parseInt($(this).index());
    if (Cookies.get('isOnlineGame') == 1) {
      if (whosTurn == 1 && whosTurn == multiplayerNbr) {
        $('#top-' + columnNbrHover).children().addClass("make-red");
      } else if (whosTurn == 2 && whosTurn == multiplayerNbr) {
        $('#top-' + columnNbrHover).children().addClass("make-black");
      }
    } else {
      if (whosTurn == 1) {
        $('#top-' + columnNbrHover).children().addClass("make-red");
      } else {
        $('#top-' + columnNbrHover).children().addClass("make-black");
      }
    }

  }, function() {
    $('#top-' + columnNbrHover).children().removeClass("make-black");
    $('#top-' + columnNbrHover).children().removeClass("make-red");
  });

}
//Refills the board from the data in boardMatrix
//used if the page is reloaded
function refillBoard(boardMatrix, boardWidth, boardHeight) {
  for (var i = 0; i < boardHeight; i++) {
    for (var j = 0; j < boardWidth; j++) {
      if (boardMatrix[i][j] == 1) {
        $('#pos-' + i + j).children().addClass("make-red");
      } else if (boardMatrix[i][j] == 2) {
        $('#pos-' + i + j).children().addClass("make-black");
      }
    }
  }
}
//sets up local game
function localSetup(firstTurn) {
  $('#player1-turn').text(playerList[1] + ", it's your turn!");
  $('#player2-turn').text(playerList[2] + ", it's your turn!");
  Cookies.set('isOnlineGame', 0);
  whosTurn = firstTurn;
  $('#p' + firstTurn + '-turn').removeClass("hider");
  $('#player1-circle').removeClass("hider");
  $('#player2-circle').removeClass("hider");
  if (firstTurn == 1) {
    $('#p2-turn').addClass("hider");
  } else {
    $('#p1-turn').addClass("hider");
  }
  $('#winner').hide();
  $('#rematch-btn').hide();
  $('#local-game-overlay').hide();
  $('#online-multiplayer-overlay').hide();
}
//Sets up online multiplayer game
function onlineMultiplayerSetup(firstTurn) {
  Cookies.set('isOnlineGame', 1);
  console.log("Shouldn't be here");
  Cookies.set('isLocalGame', 0);
  whosTurn = firstTurn;
  multiplayerNbr = Cookies.get('multiplayerNbr');
  if (multiplayerNbr == 1) {
    $('#player1-turn').text("Your turn!");
    $('#player2-turn').text(playerList[2] + "'s turn!");
  } else if (multiplayerNbr == 2) {
    $('#player1-turn').text(playerList[1] + "'s turn!");
    $('#player2-turn').text("Your turn!");
  } else {
    $('#player1-turn').text("You are spectating!");
    $('#player2-turn').text("You are spectating!");
  }

  $('#p' + firstTurn + '-turn').removeClass("hider");
  $('#player1-circle').removeClass("hider");
  $('#player2-circle').removeClass("hider");
  $('#waiting-for-other-player').addClass('hider');
  console.log("First turn: " + whosTurn);
  if (firstTurn == 1) {
    $('#p2-turn').addClass("hider");
  } else {
    $('#p1-turn').addClass("hider");
  }
  $('#winner').hide();
  $('#rematch-btn').hide();
  $('#local-game-overlay').hide();
  $('#online-multiplayer-overlay').hide();
}
//Switches turn
function switchTurn() {
  if (whosTurn == 1) {
    whosTurn = 2;
    $('#p1-turn').addClass("hider");
    $('#p2-turn').removeClass("hider");

  } else {
    whosTurn = 1;

    $('#p1-turn').removeClass("hider");
    $('#p2-turn').addClass("hider");
  }
}

function setPlayers(username1, username2) {
  //Fills the first position with a zero, so we get player IDs that are non-zero
  playerList[0] = 0;
  playerList[1] = username1;
  playerList[2] = username2;
}
