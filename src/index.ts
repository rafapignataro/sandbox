import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { Server } from 'socket.io';

const PORT = 4000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 2000,
  pingTimeout: 5000
});

// HTTP
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/', (request, response) => {
  response.setHeader('Content-Type', 'text/html')
  response.sendFile(path.join(__dirname, 'public', 'index.html'))
});

// WS
type GameMap = {
  width: number;
  height: number;
}

type Player = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: number;
  input: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
  eventId: number;
}

type GameState = {
  status: 'ACTIVE' | 'STOPPED';
  players: Map<string, Player>;
}

type RawGameState = Omit<GameState, 'players'> & {
  players: Array<Player>;
};

const gameState: GameState = {
  status: 'STOPPED',
  players: new Map(),
}

let gameLoop: NodeJS.Timeout | null = null;

io.on('connection', socket => {
  console.log(`\x1b[32m${socket.id} CONNECTED\x1b[0m\n`)
  const socketId = socket.id;

  const player: Player = {
    id: socketId,
    x: 200,
    y: 200,
    width: 50,
    height: 50,
    velocity: 5,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    eventId: 0,
  };

  gameState.players.set(player.id, player);

  if (gameState.status === 'STOPPED') {
    gameState.status = 'ACTIVE';

    startGameLoop();
  }

  socket.emit('OUTPUT_INITIAL_INFO', {
    player,
    serverState: getRawGameState(gameState)
  });

  socket.broadcast.emit('OUTPUT_PLAYER_CONNECTED', player);

  socket.on('INPUT_PLAYER_MOVE', (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', eventId) => {
    const movingPlayer = gameState.players.get(socket.id);

    if (!movingPlayer) return;

    if (eventId) movingPlayer.eventId = eventId;

    if (direction === 'UP') {
      movingPlayer.y -= movingPlayer.velocity;
    }

    if (direction === 'DOWN') {
      movingPlayer.y += movingPlayer.velocity;
    }

    if (direction === 'LEFT') {
      movingPlayer.x -= movingPlayer.velocity;
    }

    if (direction === 'RIGHT') {
      movingPlayer.x += movingPlayer.velocity;
    }
  });

  socket.on('disconnect', () => {
    console.log(`\x1b[31m${socket.id} DISCONNECTED\x1b[0m\n`);

    gameState.players.delete(socket.id);

    if (!gameState.players.size) {
      gameState.status = 'STOPPED';

      if (gameLoop) {
        clearTimeout(gameLoop);
        gameLoop = null;
      }

      return;
    }
    socket.broadcast.emit('OUTPUT_PLAYER_DISCONNECTED', player);
  })
});

function startGameLoop() {
  let lastUpdateTime = Date.now();
  const fps = 1000 / 60;

  gameLoop = setInterval(() => {
    const currentTime = Date.now();
    const delta = (currentTime - lastUpdateTime) / 60;

    io.emit('OUTPUT_GAME_STATE', getRawGameState(gameState));

    lastUpdateTime = currentTime;
  }, fps);
}

function getRawGameState(state: GameState): RawGameState {
  return {
    ...state,
    players: Array.from(state.players.values())
  }
}

// START
server.listen(PORT, () => {
  console.info(`\n\x1b[35m~ SERVER ON: http://localhost:\x1b[1m${PORT}/\x1b[0m\n`);
});