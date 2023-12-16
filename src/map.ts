const TILE_SIZE = 16;
const TILES_X = 100;
const TILES_Y = 100;

export function createMap() {
  const tiles = Array.from({ length: 100 }, () => Array(100).fill(16)) as number[][];

  return {
    width: TILES_X * TILE_SIZE,
    height: TILES_Y * TILE_SIZE,
    tileSize: TILE_SIZE,
    tilesX: TILES_X,
    tilesY: TILES_Y,
    tiles,
  }
}