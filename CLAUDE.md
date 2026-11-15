/# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No build, no dependencies, no package.json, no tests, no linter. README.md is in Spanish; UI strings in the code are mixed Spanish/English.

## Running

Open `index.html` directly, or serve statically: `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Architecture

All logic lives in `game.js` (loaded as a classic script from `index.html`, strict mode). It relies on fixed DOM ids in `index.html`: `board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `pause-menu`, `resume-btn`, `restart-btn`, `gameover-restart-btn`, `controls-btn`, `controls-list`, `start-level`.

- **State** is a set of module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...) reset by `init()`. `init()` is also the restart handler.
- **Pieces/board** use color indices 1–7 (index into `skin.colors` and `PIECES`; 0 = empty). A piece is `{shape, x, y}` where `shape` is a square matrix whose cell values are its color index.
- **Skins**: `SKINS` holds per-skin `colors`, optional `bg`/`grid` (null = follow light/dark theme) and a `block(ctx, px, py, size, color)` draw function; `drawBlock` delegates to the active `skin`. Choice persists in `localStorage` key `skin`; `applySkin` repaints immediately.
- **Loop**: `requestAnimationFrame` → `loop(ts)` accumulates `dropAccum` and gravity-drops or calls `lockPiece()` when `dropAccum >= dropInterval`; `draw()` is called every frame. `togglePause`/`endGame` stop it via `cancelAnimationFrame(animId)`; unpausing resets `lastTime` and re-enters `loop`.
- **Input**: a single `keydown` listener (uses `e.code`: arrows, `KeyX` rotate, `Space` hard drop, `KeyP` pause) calls `collide` before mutating `current`, then `updateHUD()`.
- **Spawn/game over**: `spawn()` promotes `next` to `current` and rolls a new `next`; if the new piece collides immediately, `endGame()` fires.
- Pause and game over share the overlay element; pause shows `#pause-menu` (resume/restart/controls/start-level select), game over shows only `#gameover-restart-btn`. `startLevel` (set by the select) seeds `level` in `init()`; level = `startLevel + floor(lines/10)`.

## Gotchas

- Canvas pixel size is duplicated: `index.html` hardcodes `300×600` (and `120×120` for next) to match `COLS*BLOCK` × `ROWS*BLOCK` in `game.js`. Change both together.
- The drop interval formula (`max(100, 1000 − (level−1)×90)`), line scoring (`LINE_SCORES × level`), and level-up every 10 lines are described in README.md; keep README in sync if you change them.
