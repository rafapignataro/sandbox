const DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1;
console.log('DEVICE_PIXEL_RATIO', DEVICE_PIXEL_RATIO)

let app = new PIXI.Application({
  width: 800 * DEVICE_PIXEL_RATIO,
  height: 600 * DEVICE_PIXEL_RATIO,
  background: '#1d1d1d'
});

const gameContainer = document.getElementById('game-container');
gameContainer.appendChild(app.view);

const scoreboardContainer = document.getElementById('scoreboard');

const socket = io('ws://localhost:4000');

const MOVEMENT_KEYS = ['w', 'a', 's', 'd'];
const playerInput = {
  up: false,
  down: false,
  left: false,
  right: false
}
const playerEvents = [];
let eventId = 0;

let clientState = {
  players: new Map(),
}

let playerId = null;

// Handle player input
(() => {

})();

document.addEventListener('keydown', (event) => {
  const { key } = event;

  if (!MOVEMENT_KEYS.includes(key)) return;

  if (!playerId) return;

  const player = clientState.players.get(playerId);

  if (!player) return;

  if (key === 'w' && !playerInput.up) {
    playerInput.up = true;
  };

  if (key === 's' && !playerInput.down) {
    playerInput.down = true;
  };

  if (key === 'a' && !playerInput.left) {
    playerInput.left = true;
  };

  if (key === 'd' && !playerInput.right) {
    playerInput.right = true;
  };
});

document.addEventListener('keyup', (event) => {
  const { key } = event;

  if (!MOVEMENT_KEYS.includes(key)) return;

  if (key === 'w' && playerInput.up) {
    playerInput.up = false;
  };

  if (key === 's' && playerInput.down) {
    playerInput.down = false;
  };

  if (key === 'a' && playerInput.left) {
    playerInput.left = false;
  };

  if (key === 'd' && playerInput.right) {
    playerInput.right = false;
  };

  console.log('MOVE STOP', key)

  // Emit movement
  socket.emit('INPUT_PLAYER_MOVE', playerInput)
});

socket.on('OUTPUT_INITIAL_INFO', ({ player, serverState }) => {
  playerId = player.id;

  for (const serverPlayer of serverState.players) {
    createPlayer(app, serverPlayer);
  }
});

socket.on('OUTPUT_PLAYER_CONNECTED', serverPlayer => {
  console.log('CONNECTED', serverPlayer);

  createPlayer(app, serverPlayer);
});

socket.on('OUTPUT_PLAYER_DISCONNECTED', serverPlayer => {
  console.log('DISCONNECTED', serverPlayer);

  const clientPlayer = clientState.players.get(serverPlayer.id);

  if (clientPlayer) {
    app.stage.removeChild(clientPlayer.sprite);
  }

  clientState.players.delete(serverPlayer.id);

  scoreboardContainer.removeChild(document.getElementById(`player-${serverPlayer.id}`))
});

// Transfer SERVER STATE to CLIENT STATE
socket.on('OUTPUT_GAME_STATE', serverState => {
  for (const serverPlayer of serverState.players) {
    const clientPlayer = clientState.players.get(serverPlayer.id);

    // Current server position
    clientPlayer.x = serverPlayer.x;
    clientPlayer.y = serverPlayer.y;

    if (clientPlayer.id !== playerId) {
      gsap.to(clientPlayer, {
        x: serverPlayer.x,
        y: serverPlayer.y,
        duration: 0.25,
        ease: 'none'
      });
      return;
    }

    // Move current server position to client position
    const lastProcessedEventIndex = playerEvents.findIndex(event => event.eventId === serverPlayer.eventId);

    if (lastProcessedEventIndex > -1) {
      playerEvents.splice(0, lastProcessedEventIndex + 1)
    }

    playerEvents.forEach(event => {
      clientPlayer.x += event.dx;
      clientPlayer.y += event.dy;
    });
  }
});

app.ticker.add((delta) => {
  // Client Prediction
  (() => {
    const clientPlayer = clientState.players.get(playerId);

    if (!clientPlayer) return;

    if (playerInput.up) {
      eventId++;
      clientPlayer.y -= clientPlayer.velocity;
      playerEvents.push({ eventId, dx: 0, dy: -clientPlayer.velocity })
      socket.emit('INPUT_PLAYER_MOVE', 'UP', eventId);
    }

    if (playerInput.down) {
      eventId++;
      clientPlayer.y += clientPlayer.velocity;
      playerEvents.push({ eventId, dx: clientPlayer.velocity, dy: 0 })
      socket.emit('INPUT_PLAYER_MOVE', 'DOWN', eventId);
    }

    if (playerInput.left) {
      eventId++;
      clientPlayer.x -= clientPlayer.velocity;
      playerEvents.push({ eventId, dx: -clientPlayer.velocity, dy: 0 })
      socket.emit('INPUT_PLAYER_MOVE', 'LEFT', eventId);
    }

    if (playerInput.right) {
      eventId++;
      clientPlayer.x += clientPlayer.velocity;
      playerEvents.push({ eventId, dx: clientPlayer.velocity, dy: 0 })
      socket.emit('INPUT_PLAYER_MOVE', 'RIGHT', eventId);
    }
  })();

  // Player Movement
  (() => {
    for (const clientPlayer of Array.from(clientState.players.values())) {
      clientPlayer.sprite.x = clientPlayer.x;
      clientPlayer.sprite.y = clientPlayer.y;
    }
  })();
});

function createPlayer(app, serverPlayer) {
  const createdPlayer = { ...serverPlayer };

  createdPlayer.sprite = PIXI.Sprite.from('/assets/player.png');

  createdPlayer.sprite.anchor.set(0.5);

  createdPlayer.sprite.x = serverPlayer.x;
  createdPlayer.sprite.y = serverPlayer.y;
  createdPlayer.sprite.width = serverPlayer.width;
  createdPlayer.sprite.height = serverPlayer.height;

  app.stage.addChild(createdPlayer.sprite);

  clientState.players.set(createdPlayer.id, createdPlayer);

  const span = document.createElement('span');

  span.id = `player-${serverPlayer.id}`;

  if (serverPlayer.id === playerId) span.setAttribute('data-player', true)

  span.className = 'w-full text-sm data-[player="true"]:text-purple-500';
  span.innerText = serverPlayer.id;
  scoreboardContainer.appendChild(span);

  return createdPlayer;
}