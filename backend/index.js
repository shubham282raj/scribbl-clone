// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const words = require("./words.json");

const getRandomWord = () => words[Math.floor(Math.random() * words.length)];

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // adjust to your frontend URL if deploying
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const drawHistory = [];
const players = [];
let currPlayer = null;
let currWord = null;
let isRoundRunning = false;
const chats = [];
let pointsToGive = 100;

let currentRoundInterval = null;
let currentSeconds = null;
let gameTime = 90;
let hintInterval = 20;
let revealedIndices = new Set();

io.on("connection", (socket) => {
  socket.emit("clearChat");

  // init start
  console.log("User connected:", socket.handshake.auth);

  const username = socket.handshake.auth.username;

  const existingPlayer = players.find((player) => player.username === username);

  if (existingPlayer) {
    if (io.sockets.sockets.get(existingPlayer.id)) {
      console.log(`Duplicate connection attempt for username: ${username}`);
      socket.emit("duplicate-username"); // Optional: notify client
      socket.disconnect(true); // Forcefully disconnect
      return;
    } else {
      existingPlayer.id = socket.id;
      existingPlayer.connected = true;
    }
  } else {
    players.push({
      id: socket.id,
      username,
      connected: true,
      score: 0,
      gussedCorrect: false,
    });
  }

  io.emit("players", players);
  socket.emit("chat", chats);
  socket.emit("clear");
  socket.emit("currPlayer", currPlayer);
  socket.emit("disableChats", false);

  sendWord(username, revealedIndices.size);
  drawHistory.forEach((data) => socket.emit("draw", data));

  sendChat({ message: username + " joinged the room!", color: "green" });
  if (io.sockets.sockets.size >= 2) {
    gameLoop();
  } else {
    endGameLoop();
  }

  // init end

  socket.on("draw", (data) => {
    drawHistory.push(data);
    // console.log(drawHistory.length, drawHistory[drawHistory.length - 1]);
    io.emit("draw", data);
  });

  socket.on("clear", () => {
    drawHistory.length = 0;
    io.emit("clear");
  });

  socket.on("undo", () => {
    drawHistory.pop();
    while (true) {
      if (
        drawHistory.length == 0 ||
        drawHistory[drawHistory.length - 1].event == "penup"
      ) {
        break;
      } else {
        drawHistory.pop();
      }
    }

    io.emit("undo");
  });

  socket.on("chat", (chat) => {
    let chatToPush = chat;
    if (String(chat.message).toLowerCase() == currWord) {
      const player = players.find(
        (player) => player.username == socket.handshake.auth.username
      );

      //   pointsToGive = Math.max(40, pointsToGive);

      if (player) {
        const addScore = gameTime - currentSeconds;
        player.score += addScore;
        player.addScore = addScore;

        socket.emit("message", "You gussed it bro! +" + addScore);

        player.gussedCorrect = true;
        // pointsToGive -= 30;
      }
      //   console.log("username guessed right", username);

      chatToPush.message = username + " guessed it right!";
      chatToPush.color = "green";

      disableChat(socket);
      io.emit("players", players);
    }

    sendChat(chatToPush);
    checkAllPlayerCorrect();
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.handshake.auth);
    const existingPlayer = players.find(
      (player) => player.username == socket.handshake.auth.username
    );
    if (existingPlayer) {
      existingPlayer.id = socket.id;
      existingPlayer.connected = false;
    }
    sendChat({ message: username + " disconnected!", color: "#FF5555" });
    io.emit("players", players);

    if ([0, 1].includes(io.sockets.sockets.size)) {
      chats.length = 0;
      endGameLoop();
    }
  });
});

server.listen(6968, () => {
  console.log("Server listening on http://localhost:6968");
});

const checkAllPlayerCorrect = () => {
  let totalScore = 0;
  let numPlayers = 0;
  let allAnswered = true;

  for (let player of players) {
    if (io.sockets.sockets.has(player.id)) {
      if (player.username !== currPlayer && player.gussedCorrect === true) {
        totalScore += player.addScore;
        numPlayers++;
      } else if (
        player.username !== currPlayer &&
        player.gussedCorrect !== true
      ) {
        allAnswered = false;
      }
    }
  }

  let avgScore = numPlayers > 0 ? totalScore / numPlayers : 0;

  if (allAnswered) {
    const player = players.find((player) => player.username == currPlayer);
    if (player && player.connected) {
      player.score += avgScore;
      getSocketByUsername(currPlayer)?.emit(
        "message",
        "You made everyone guess! +" + avgScore
      );
    }

    io.emit("players", players);

    sendChat({
      message: "The word was " + currWord,
      color: "skyblue",
      username: "system",
    });
    assignPlayer();
  }
};

function disableChat(socket) {
  console.log("disabling chats for", socket?.handshake.auth.username);
  socket?.emit("disableChats", true);
}

function toast(data) {
  io.emit("message", data);
}

function getSocketByUsername(username) {
  for (const [id, socket] of io.sockets.sockets) {
    if (socket.handshake.auth?.username === username) {
      return socket; // ✅ Found the matching socket
    }
  }
  return null; // ❌ Not found
}

const assignPlayer = () => {
  pointsToGive = 100;

  if (players.length === 0) return;

  const currPlayerIdx = players.findIndex(
    (player) => player.username === currPlayer
  );

  if (currPlayerIdx === -1 || currPlayer == null) {
    // If no current player, start from the beginning
    currPlayer = players[0].username;
  } else {
    // Move to next player (wrap around)
    const nextIdx = (currPlayerIdx + 1) % players.length;
    currPlayer = players[nextIdx].username;
  }

  players.forEach((player) => {
    player.gussedCorrect = false;
    player.addScore = 0;
  });

  // clear slate
  drawHistory.length = 0;
  io.emit("clear");

  io.emit("disableChats", false);
  disableChat(getSocketByUsername(currPlayer));

  io.emit("currPlayer", currPlayer);
  io.emit("players", players);
  assignWords();

  sendChat({ message: currPlayer + " is drawing now", color: "skyblue" });

  clearInterval(currentRoundInterval);
  currentSeconds = 0;
  currentRoundInterval = setInterval(() => {
    currentSeconds += 1;
    io.emit("time", { timer: currentSeconds, maxTime: gameTime });

    if (
      currentSeconds % hintInterval == 0 &&
      currentSeconds / hintInterval <= Math.floor(currWord.length / 2)
    ) {
      //   getSocketByUsername(currPlayer)?.broadcast.emit(
      //     "message",
      //     "Here's a hint :)"
      //   );
      sendWordToAll(currentSeconds / hintInterval);
    }

    if (currentSeconds >= gameTime) {
      clearInterval(currentRoundInterval);
      sendChat({
        message: "Times up! The word was " + currWord,
        color: "#FF5555",
      });
      assignPlayer();
    }
  }, 1000);
};

function sendChat(data) {
  const chatToPush = {
    message: data.message,
    color: data.color || "white",
    username: data.username || "system",
  };
  chats.push(chatToPush);
  io.emit("chat", [chatToPush]);
}

const wordToSend = (username, hints = 0) => {
  if (!currWord) return "";
  if (username === currPlayer) return currWord;

  const wordLength = currWord.length;
  // Only count non-space characters for hint calculation
  const nonSpaceIndices = [];
  for (let i = 0; i < wordLength; i++) {
    if (currWord[i] !== " ") {
      nonSpaceIndices.push(i);
    }
  }

  const maxHints = Math.floor(nonSpaceIndices.length / 2);
  const targetHints = Math.min(hints, maxHints);

  // Add hints from non-space characters only
  while (revealedIndices.size < targetHints) {
    const availableIndices = nonSpaceIndices.filter(
      (i) => !revealedIndices.has(i)
    );

    if (availableIndices.length === 0) break;

    const randomIndex =
      availableIndices[Math.floor(Math.random() * availableIndices.length)];
    revealedIndices.add(randomIndex);
  }

  // Build the masked word - spaces always show, others based on reveals
  return currWord
    .split("")
    .map((char, idx) => {
      if (char === " ") return " ";
      return revealedIndices.has(idx) ? char : "_";
    })
    .join("");
};

function sendWord(username, hints) {
  getSocketByUsername(username).emit("currWord", wordToSend(username, hints));
}

function sendWordToAll(hints) {
  io.sockets.sockets.forEach((socket, socketId) => {
    socket.emit("currWord", wordToSend(socket.handshake.auth.username, hints));
  });
}

function assignWords() {
  currWord = getRandomWord();
  revealedIndices.clear();
  sendWordToAll(revealedIndices.size);
}

let gameLoopInteval;

const gameLoop = () => {
  clearInterval(gameLoopInteval);

  console.log("game start");

  return (gameLoopInteval = setInterval(() => {
    const currPlayerObj = players.find(
      (player) => player.username === currPlayer
    );
    if (!currPlayerObj || !io.sockets.sockets.has(currPlayerObj.id)) {
      isRoundRunning = false;
      io.emit("message", "Assigning new player");
    }

    if (!isRoundRunning) {
      assignPlayer();
      isRoundRunning = true;
    } else {
    }
  }, 100));
};

const endGameLoop = () => {
  clearInterval(gameLoopInteval);

  const numPlayersOnline = io.sockets.sockets.size;
  if (numPlayersOnline)
    sendChat({
      message: `Only ${numPlayersOnline} players here. Waiting for more!`,
      color: "skyblue",
      username: "system",
    });
  else {
    drawHistory.length = 0;
    players.length = 0;
    chats.length = 0;
    currPlayer = null;
    currWord = null;
    isRoundRunning = false;
    pointsToGive = 100;
    currentRoundInterval = null;
    currentSeconds = null;
    gameTime = 90;
    hintInterval = 20;
    revealedIndices = new Set();
    clearInterval(currentRoundInterval);
  }
};
