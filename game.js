'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

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
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');

let startLevel = 1;
let comboCount = 0;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
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
    const prevLevel = level;
    level = startLevel + Math.floor(lines / 10);
    SFX.clear(cleared);
    if (level > prevLevel) SFX.levelUp();
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
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
  if (lines > before) {
    comboCount++;
    if (comboCount > records.bestCombo) { records.bestCombo = comboCount; saveRecords(); }
  } else {
    comboCount = 0;
  }
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

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- Records (localStorage 'tetris-records') ----
const REC_KEY = 'tetris-records';
const REC_MAX = 5;
const startScreen = document.getElementById('start-screen');
const startListEl = document.getElementById('start-list');
const startLevelSel = document.getElementById('start-level');
const recOver = document.getElementById('rec-over');
const recOverList = document.getElementById('rec-over-list');
const recEntry = document.getElementById('rec-entry');
const recName = document.getElementById('rec-name');
let records = loadRecords();
let pendingScore = null; // { score, lines } esperando nombre

function defaultRecords() { return { top: [], bestCombo: 0, maxLines: 0 }; }

function isNum(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }

function loadRecords() {
  const out = defaultRecords();
  try {
    const raw = JSON.parse(localStorage.getItem(REC_KEY));
    if (!raw || typeof raw !== 'object') return out;
    if (Array.isArray(raw.top)) {
      out.top = raw.top
        .filter(e => e && typeof e.name === 'string' && isNum(e.score) && isNum(e.lines))
        .map(e => ({ name: e.name.slice(0, 12), score: e.score, lines: e.lines, date: typeof e.date === 'string' ? e.date : '' }))
        .sort((a, b) => b.score - a.score)
        .slice(0, REC_MAX);
    }
    if (isNum(raw.bestCombo)) out.bestCombo = raw.bestCombo;
    if (isNum(raw.maxLines)) out.maxLines = raw.maxLines;
  } catch (e) { /* corrupto o sin acceso: valores por defecto */ }
  return out;
}

function saveRecords() {
  try { localStorage.setItem(REC_KEY, JSON.stringify(records)); } catch (e) { /* ignore */ }
}

function qualifies(s) {
  return s > 0 && (records.top.length < REC_MAX || s > records.top[records.top.length - 1].score);
}

// Pinta tabla top 5 y estadisticas con textContent (nunca innerHTML).
function renderRecords(container, highlight) {
  container.textContent = '';
  const table = document.createElement('table');
  table.className = 'rec-table';
  const cap = document.createElement('caption');
  cap.textContent = 'TOP 5';
  table.appendChild(cap);
  if (!records.top.length) {
    const tr = table.insertRow();
    const td = tr.insertCell();
    td.colSpan = 4;
    td.textContent = 'Sin records todavía';
  }
  records.top.forEach((e, i) => {
    const tr = table.insertRow();
    if (e === highlight) tr.className = 'rec-new';
    [String(i + 1) + '.', e.name, e.score.toLocaleString(), e.lines + ' L'].forEach((t, k) => {
      const td = tr.insertCell();
      td.textContent = t;
      if (k >= 2) td.className = 'num';
    });
  });
  container.appendChild(table);
  const p = document.createElement('p');
  p.className = 'rec-stats';
  p.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx.: ${records.maxLines}`;
  container.appendChild(p);
}

function showStartScreen() {
  renderRecords(startListEl, null);
  startScreen.classList.remove('hidden');
}

function submitRecord(e) {
  e.preventDefault();
  if (!pendingScore) return;
  const name = recName.value.trim().slice(0, 12) || 'Anónimo';
  const entry = { name, score: pendingScore.score, lines: pendingScore.lines, date: new Date().toISOString().slice(0, 10) };
  pendingScore = null;
  records.top.push(entry);
  records.top.sort((a, b) => b.score - a.score);
  records.top = records.top.slice(0, REC_MAX);
  saveRecords();
  recEntry.classList.add('hidden');
  renderRecords(recOverList, entry);
}

function recordGameOver() {
  if (lines > records.maxLines) records.maxLines = lines;
  saveRecords();
  pendingScore = qualifies(score) ? { score, lines } : null;
  renderRecords(recOverList, null);
  recEntry.classList.toggle('hidden', !pendingScore);
  recName.value = '';
  recOver.classList.remove('hidden');
  if (pendingScore) recName.focus();
}

for (let i = 1; i <= 15; i++) {
  const o = document.createElement('option');
  o.value = String(i);
  o.textContent = String(i);
  startLevelSel.appendChild(o);
}
startLevelSel.addEventListener('change', () => { startLevel = parseInt(startLevelSel.value, 10) || 1; });
recEntry.addEventListener('submit', submitRecord);
document.getElementById('start-btn').addEventListener('click', () => {
  startLevel = parseInt(startLevelSel.value, 10) || 1;
  startScreen.classList.add('hidden');
  document.activeElement && document.activeElement.blur();
  init();
});
document.getElementById('rec-reset').addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  records = defaultRecords();
  saveRecords();
  renderRecords(startListEl, null);
});

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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = highlightColor;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!current) return;

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
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;
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
  recordGameOver();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    recOver.classList.add('hidden');
    overlay.classList.remove('hidden');
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
  comboCount = 0;
  pendingScore = null;
  recOver.classList.add('hidden');
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (!current) return; // aún en la pantalla de inicio
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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

restartBtn.addEventListener('click', () => {
  if (pendingScore) recEntry.requestSubmit(); // no perder un record sin guardar
  init();
});
themeBtn.addEventListener('click', () => {
  toggleTheme();
  themeBtn.blur(); // evita que Space/Enter vuelvan a activar el botón durante la partida
});

applyTheme(document.documentElement.dataset.theme || 'dark', false);
board = createBoard();
draw();
showStartScreen();
