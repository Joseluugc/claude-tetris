'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;


// ---- Skins ----
// colors: índices 1–7 (0 sin uso). bg/grid: null => usa los del tema claro/oscuro.
// block(context, px, py, size, color): dibuja un bloque con la esquina superior izquierda en px,py.
const SKINS = {
  retro: {
    label: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d'],
    bg: null,
    grid: null,
    block(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = highlightColor;
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neon',
    colors: [null, '#00f5ff', '#ffee00', '#d500f9', '#39ff14', '#ff1744', '#2979ff', '#ff9100'],
    bg: '#000000',
    grid: '#14141f',
    block(context, px, py, size, color) {
      context.shadowColor = color;
      context.shadowBlur = 14;
      context.fillStyle = color + '55';
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6ef', '#fff2b3', '#d9b8e6', '#b8e6bf', '#f5b5b5', '#b9d4f5', '#fcd5a5'],
    bg: '#fdf8f3',
    grid: '#efe6dc',
    block(context, px, py, size, color) {
      context.fillStyle = color;
      context.beginPath();
      context.roundRect(px + 1.5, py + 1.5, size - 3, size - 3, size * 0.3);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.5)';
      context.beginPath();
      context.roundRect(px + size * 0.2, py + size * 0.15, size * 0.45, size * 0.14, size * 0.07);
      context.fill();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#29c5d6', '#f2c200', '#9c27b0', '#43a047', '#e53935', '#1e88e5', '#fb8c00'],
    bg: '#1b1b24',
    grid: '#262633',
    block(context, px, py, size, color) {
      const inner = size - 2;
      const u = inner / 5; // cuadrícula 5x5 de "píxeles"
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, inner, inner);
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          let shade = null;
          if (i === 0 || j === 0) shade = 'rgba(255,255,255,0.35)';
          else if (i === 4 || j === 4) shade = 'rgba(0,0,0,0.35)';
          else if ((i + j) % 2 === 0) shade = 'rgba(0,0,0,0.15)';
          if (!shade) continue;
          context.fillStyle = shade;
          context.fillRect(px + 1 + j * u, py + 1 + i * u, u, u);
        }
      }
      context.strokeStyle = '#000';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    },
  },
  bw: {
    label: 'Blanco y negro',
    colors: [null, '#ffffff', '#e0e0e0', '#c2c2c2', '#a3a3a3', '#858585', '#666666', '#484848'],
    bg: '#000000',
    grid: '#222222',
    block(context, px, py, size, color) {
      const idx = SKINS.bw.colors.indexOf(color);
      const x = px + 1, y = py + 1, s = size - 2;
      context.fillStyle = color;
      context.fillRect(x, y, s, s);
      // Patrón por pieza para distinguirlas aunque los grises se parezcan
      const dark = idx <= 4 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
      context.fillStyle = dark;
      context.strokeStyle = dark;
      context.lineWidth = 2;
      const c = size / 2;
      switch (idx) {
        case 2: // raya horizontal
          context.fillRect(x, c - 1, s, 2); break;
        case 3: // raya vertical
          context.fillRect(c - 1, y, 2, s); break;
        case 4: // punto central
          context.beginPath(); context.arc(c, c, size * 0.15, 0, Math.PI * 2); context.fill(); break;
        case 5: // diagonal
          context.beginPath(); context.moveTo(x + 3, y + s - 3); context.lineTo(x + s - 3, y + 3); context.stroke(); break;
        case 6: // cruz
          context.fillRect(x, c - 1, s, 2); context.fillRect(c - 1, y, 2, s); break;
        case 7: // marco interior
          context.strokeRect(x + 5, y + 5, s - 10, s - 10); break;
        default: break; // 1: liso
      }
      context.strokeStyle = '#000';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    },
  },
};
const DEFAULT_SKIN = 'retro';
let skinName = DEFAULT_SKIN;
let skin = SKINS[skinName];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// ---- Sound effects (Web Audio, no external assets) ----
let audioCtx = null;

function getAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Play a tone with optional pitch slide, starting `delay` seconds from now.
function tone({ freq, endFreq, dur = 0.15, type = 'square', vol = 0.12, delay = 0 }) {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol, delay = 0) {
  const ac = getAudio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = buf;
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
}

const SFX = {
  move()   { tone({ freq: 220, dur: 0.04, type: 'triangle', vol: 0.06 }); },
  rotate() { tone({ freq: 380, endFreq: 560, dur: 0.07, type: 'square', vol: 0.07 }); },
  lock() {
    tone({ freq: 140, endFreq: 60, dur: 0.12, type: 'sine', vol: 0.25 });
    noise(0.08, 0.12);
  },
  hardDrop() {
    tone({ freq: 220, endFreq: 40, dur: 0.22, type: 'sawtooth', vol: 0.18 });
    tone({ freq: 90, endFreq: 35, dur: 0.25, type: 'sine', vol: 0.3 });
    noise(0.15, 0.25);
  },
  clear(n) {
    // Ascending arpeggio; more rows => longer and higher. Tetris (4) gets a fanfare.
    const base = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    const steps = n >= 4 ? 6 : n + 2;
    for (let i = 0; i < steps; i++) {
      tone({ freq: base[i], dur: 0.14, type: 'square', vol: 0.09, delay: i * 0.06 });
      tone({ freq: base[i] * 2, dur: 0.1, type: 'triangle', vol: 0.05, delay: i * 0.06 });
    }
    if (n >= 4) tone({ freq: 2093, dur: 0.5, type: 'triangle', vol: 0.1, delay: steps * 0.06 });
  },
  levelUp() {
    [659.25, 783.99, 987.77, 1318.5].forEach((f, i) =>
      tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.12, delay: 0.35 + i * 0.07 }));
  },
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, endFreq: f * 0.9, dur: 0.3, type: 'sawtooth', vol: 0.12, delay: i * 0.22 }));
  },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const gameOverRestartBtn = document.getElementById('gameover-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsList = document.getElementById('controls-list');
const startLevelSelect = document.getElementById('start-level');
const themeBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');
const nameForm = document.getElementById('name-form');
const nameMsg = document.getElementById('name-msg');
const nameInput = document.getElementById('name-input');
const recordsBox = document.getElementById('records');
const recordsList = document.getElementById('records-list');
const recordsStats = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records-btn');

let startLevel = 1;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let started = false, combo = 0, bestCombo = 0;

// ---- Records (localStorage) ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;

function loadRecords() {
  const empty = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const r = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!r || !Array.isArray(r.top)) return empty;
    return {
      top: r.top
        .filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score))
        .slice(0, MAX_RECORDS),
      bestCombo: Number(r.bestCombo) || 0,
      maxLines: Number(r.maxLines) || 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveRecords(r) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); } catch (e) { /* ignore */ }
}

function qualifies(r, s) {
  return s > 0 && (r.top.length < MAX_RECORDS || s > r.top[r.top.length - 1].score);
}

// Position (0-based) the score would take; ties go below existing entries.
function rankOf(r, s) {
  const i = r.top.findIndex(e => s > e.score);
  return i === -1 ? r.top.length : i;
}

function renderRecords(highlight = -1) {
  const r = loadRecords();
  recordsList.replaceChildren();
  for (let i = 0; i < MAX_RECORDS; i++) {
    const li = document.createElement('li');
    const e = r.top[i];
    if (e) {
      li.textContent = e.name;
      const sc = document.createElement('span');
      sc.textContent = e.score.toLocaleString();
      li.append(sc);
      if (i === highlight) li.className = 'new';
    } else {
      li.textContent = '---';
      li.className = 'empty';
    }
    recordsList.append(li);
  }
  recordsStats.textContent = `Mejor combo: ${r.bestCombo} · Líneas máx.: ${r.maxLines}`;
  recordsBox.hidden = false;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// 7-bag: cada "bolsa" contiene las 7 piezas barajadas, así la O (y el resto)
// aparece al menos una vez cada 7 piezas.
let bag = [];

function refillBag() {
  bag = [1, 2, 3, 4, 5, 6, 7];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}

function randomPiece() {
  if (bag.length === 0) refillBag();
  const type = bag.pop();
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      SFX.rotate();
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    combo++;
    bestCombo = Math.max(bestCombo, combo);
    const prevLevel = level;
    level = startLevel + Math.floor(lines / 10);
    SFX.clear(cleared);
    if (level > prevLevel) SFX.levelUp();
    dropInterval = intervalFor(level);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece(true);
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece(hard = false) {
  merge();
  const before = lines;
  clearLines();
  if (lines === before) combo = 0;
  if (lines === before) (hard ? SFX.hardDrop : SFX.lock)();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function intervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- Theme (light/dark) ----
let gridColor = '#22222e';
let highlightColor = 'rgba(255,255,255,0.12)';

function applyTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try { localStorage.setItem('theme', theme); } catch (e) { /* ignore */ }
  }
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  highlightColor = theme === 'light' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
  themeBtn.textContent = theme === 'light' ? '🌙 Modo oscuro' : '☀️ Modo claro';
  // Repinta de inmediato (necesario en pausa / game over)
  if (current && next) { draw(); drawNext(); }
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  skin.block(context, x * size, y * size, size, skin.colors[colorIndex]);
  context.globalAlpha = 1;
}

function applySkin(name, persist) {
  if (!SKINS[name]) name = DEFAULT_SKIN;
  skinName = name;
  skin = SKINS[name];
  skinSelect.value = name;
  if (persist) {
    try { localStorage.setItem('skin', name); } catch (e) { /* ignore */ }
  }
  // Repinta de inmediato (necesario en pausa / game over)
  if (current && next) { draw(); drawNext(); }
}

function paintBackground(context, w, h) {
  context.clearRect(0, 0, w, h);
  if (skin.bg) {
    context.fillStyle = skin.bg;
    context.fillRect(0, 0, w, h);
  }
}

function drawGrid() {
  ctx.strokeStyle = skin.grid || gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  paintBackground(ctx, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  paintBackground(nextCtx, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  SFX.gameOver();
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  pauseMenu.classList.add('hidden');
  gameOverRestartBtn.textContent = 'Reiniciar';
  gameOverRestartBtn.classList.remove('hidden');

  const r = loadRecords();
  r.bestCombo = Math.max(r.bestCombo, bestCombo);
  r.maxLines = Math.max(r.maxLines, lines);
  const enters = qualifies(r, score);
  saveRecords(r);
  renderRecords();
  nameForm.hidden = !enters;
  if (enters) {
    nameMsg.textContent = `¡Entras en el top 5 (puesto ${rankOf(r, score) + 1})! Tu nombre:`;
    nameInput.value = '';
  }
  overlay.classList.remove('hidden');
  if (enters) nameInput.focus();
}

function showStart() {
  started = false;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  pauseMenu.classList.add('hidden');
  gameOverRestartBtn.textContent = 'Jugar';
  gameOverRestartBtn.classList.remove('hidden');
  nameForm.hidden = true;
  renderRecords();
  overlay.classList.remove('hidden');
}

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  const r = loadRecords();
  if (!qualifies(r, score)) return;
  const pos = rankOf(r, score);
  r.top.splice(pos, 0, { name: nameInput.value.trim().slice(0, 12) || 'Anónimo', score, lines });
  r.top.length = Math.min(r.top.length, MAX_RECORDS);
  saveRecords(r);
  nameForm.hidden = true;
  renderRecords(pos);
  gameOverRestartBtn.focus();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  saveRecords({ top: [], bestCombo: 0, maxLines: 0 });
  renderRecords();
  nameForm.hidden = true;
  resetRecordsBtn.blur();
});

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    // Quita el foco del menú para que Space/Enter no activen un botón durante la partida
    if (overlay.contains(document.activeElement)) document.activeElement.blur();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    gameOverRestartBtn.classList.add('hidden');
    pauseMenu.classList.remove('hidden');
    controlsList.classList.add('hidden');
    controlsBtn.setAttribute('aria-expanded', 'false');
    recordsBox.hidden = true;
    nameForm.hidden = true;
    overlay.classList.remove('hidden');
    resumeBtn.focus();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  started = true;
  combo = 0;
  bestCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  bag = [];
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  if (overlay.contains(document.activeElement)) document.activeElement.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (paused || gameOver || !started) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; SFX.move(); }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; SFX.move(); }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

for (let l = 1; l <= 10; l++) startLevelSelect.add(new Option(l, l));
startLevelSelect.addEventListener('change', () => { startLevel = Number(startLevelSelect.value); });
resumeBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', init);
gameOverRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  const open = controlsList.classList.toggle('hidden') === false;
  controlsBtn.setAttribute('aria-expanded', String(open));
});
skinSelect.innerHTML = Object.entries(SKINS)
  .map(([key, sk]) => `<option value="${key}">${sk.label}</option>`).join('');
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value, true);
  skinSelect.blur(); // evita que las flechas/Space sigan actuando sobre el selector
});
themeBtn.addEventListener('click', () => {
  toggleTheme();
  themeBtn.blur(); // evita que Space/Enter vuelvan a activar el botón durante la partida
});

let savedSkin = null;
try { savedSkin = localStorage.getItem('skin'); } catch (e) { /* ignore */ }
applySkin(savedSkin, false);
init();
showStart();
applyTheme(document.documentElement.dataset.theme || 'dark', false);
