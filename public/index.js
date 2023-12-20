const DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1;
console.log('DEVICE_PIXEL_RATIO', DEVICE_PIXEL_RATIO);

const screen = {
  width: 800,
  height: 600
}

// Start PIXI app
let app = new PIXI.Application({
  // width: 800 * DEVICE_PIXEL_RATIO,
  // height: 600 * DEVICE_PIXEL_RATIO,
  width: screen.width,
  height: screen.height,
  background: '#1d1d1d',
  // resolution: DEVICE_PIXEL_RATIO
});

// app.stage.scale.set(DEVICE_PIXEL_RATIO)
// Append app to dom
const gameContainer = document.getElementById('game-container');
gameContainer.appendChild(app.view);

// Scoreboard dom element
const scoreboardContainer = document.getElementById('scoreboard');

// Player info dom element
const playerInfoContainer = document.getElementById('player_info');
const serverPlayerInfoContainer = document.getElementById('server_player_info');
const cameraInfoContainer = document.getElementById('camera_info');

// Connect to websocket server
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

const clientState = {
  players: new Map(),
}

const clientData = {
  loaded: false,
  playerId: null,
  map: null,
}

document.addEventListener('keydown', (event) => {
  const { key } = event;

  if (!MOVEMENT_KEYS.includes(key)) return;

  if (!clientData.playerId) return;

  const player = clientState.players.get(clientData.playerId);

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

  socket.emit('INPUT_PLAYER_MOVE', playerInput)
});

socket.on('OUTPUT_INITIAL_INFO', ({ player, serverState, serverMap }) => {
  clientData.playerId = player.id;
  clientData.map = createMap(app, serverMap);
  window.clientGame = clientData

  clientData.map.x += 10;
  clientData.map.y += 10;

  for (const serverPlayer of serverState.players) {
    createPlayer(app, serverPlayer);
  }

  clientData.loaded = true;
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
  if (!clientData.loaded) return;

  for (const serverPlayer of serverState.players) {
    const clientPlayer = clientState.players.get(serverPlayer.id);

    // Current server position
    clientPlayer.x = serverPlayer.x;
    clientPlayer.y = serverPlayer.y;

    if (clientPlayer.id !== clientData.playerId) {
      clientPlayer.x = lerp(clientPlayer.x, serverPlayer.x, 0.2);
      clientPlayer.y = lerp(clientPlayer.y, serverPlayer.y, 0.2);
      return;
    }

    serverPlayerInfoContainer.innerHTML = `SERVER x: ${serverPlayer.x} y: ${serverPlayer.y}`;

    // Move current server position to client position
    const lastProcessedEventIndex = playerEvents.findIndex(event => event.eventId === serverPlayer.eventId);

    if (lastProcessedEventIndex > -1) {
      playerEvents.splice(0, lastProcessedEventIndex + 1)
    }

    playerEvents.forEach(event => {
      clientPlayer.x += event.dx;
      clientPlayer.y += event.dy;
    });

    playerInfoContainer.innerHTML = `SERVER x: ${clientPlayer.x} y: ${clientPlayer.y}`;
  }
});

const camera = {
  x: 0,
  y: 0,
}

setInterval(() => {
  const player = clientState.players.get(clientData.playerId);

  if (!player) return;

  // Client Prediction
  if (playerInput.up) {
    if (player.y - (player.height / 2) - player.velocity >= 0) {
      eventId++;
      player.y -= player.velocity;
      playerEvents.push({ eventId, dx: 0, dy: -player.velocity })
      socket.emit('INPUT_PLAYER_MOVE', 'UP', eventId);
    }
  }

  if (playerInput.down) {
    if (player.y + (player.height / 2) + player.velocity <= clientData.map.height) {
      eventId++;
      player.y += player.velocity;
      playerEvents.push({ eventId, dx: player.velocity, dy: 0 })
      socket.emit('INPUT_PLAYER_MOVE', 'DOWN', eventId);
    }
  }

  if (playerInput.left) {
    if (player.x - (player.width / 2) - player.velocity >= 0) {
      eventId++;
      player.x -= player.velocity;
      playerEvents.push({ eventId, dx: -player.velocity, dy: 0 })
      socket.emit('INPUT_PLAYER_MOVE', 'LEFT', eventId);
    }
  }

  if (playerInput.right) {
    if (player.x + (player.width / 2) + player.velocity <= clientData.map.width) {
      eventId++;
      player.x += player.velocity;
      playerEvents.push({ eventId, dx: player.velocity, dy: 0 })
      socket.emit('INPUT_PLAYER_MOVE', 'RIGHT', eventId);
    }
  }
}, 1000 / 60);

app.ticker.add((delta) => {
  if (!clientData.loaded) return;

  const player = clientState.players.get(clientData.playerId);

  if (!player) return;

  playerInfoContainer.innerHTML = `CLIENTE: x: ${player.x} y: ${player.y}`;
  cameraInfoContainer.innerHTML = `CAMERA: x: ${camera.x}; y: ${camera.y}`;

  camera.x = lerp(camera.x, player.x - app.view.clientWidth / 2, 0.1);
  camera.y = lerp(camera.y, player.y - app.view.clientHeight / 2, 0.1);

  // Camera does not leave map area
  // if (camera.x < 0) camera.x = 0;
  // if (camera.x > app.view.clientWidth) camera.x = app.view.clientWidth;
  // if (camera.y < 0) camera.y = 0;
  // if (camera.y > app.view.clientHeight) camera.y = app.view.clientHeight;

  clientData.map.x = -camera.x;
  clientData.map.y = -camera.y;

  // Player Movement
  (() => {
    for (const clientPlayer of Array.from(clientState.players.values())) {
      clientPlayer.sprite.x = clientPlayer.x - camera.x;
      clientPlayer.sprite.y = clientPlayer.y - camera.y;
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

  if (serverPlayer.id === clientData.playerId) span.setAttribute('data-player', true)

  span.className = 'w-full text-sm data-[player="true"]:text-purple-500';
  span.innerText = serverPlayer.id;
  scoreboardContainer.appendChild(span);

  return createdPlayer;
}

function createMap(app, serverMap) {
  const { tiles, tileSize, tilesX, tilesY } = serverMap;

  const tilesetTexture = PIXI.Texture.from('assets/tiles.png');

  const mapContainer = new PIXI.Container();

  for (let row = 0; row < tilesY; row++) {
    for (let column = 0; column < tilesX; column++) {
      const tileIndex = tiles[row][column];

      const tile = new PIXI.Sprite(tilesetTexture);

      tile.x = column * tileSize;
      tile.y = row * tileSize;

      tile.texture = new PIXI.Texture(
        tilesetTexture,
        new PIXI.Rectangle((tileIndex % 16) * tileSize, (tileIndex / 16) * tileSize, tileSize, tileSize)
      );

      mapContainer.addChild(tile);
    }
  }

  app.stage.addChild(mapContainer);

  return mapContainer;
}

function lerp(start, end, t) {
  return parseInt(start + t * (end - start));
}