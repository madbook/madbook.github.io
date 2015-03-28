// build => babel -o simple-game-engine.js simple-game-engine.jsx

// utils
function copy(from, to) {
  for (let key in from) {
    let fromVal = from[key];
    if (Array.isArray(fromVal)) {
      to[key] = from[key].slice();
    } else if (fromVal !== null && typeof fromVal === 'Object') {
      to[key] = copy(fromVal, {});
    }
    to[key] = fromVal;
  }
  return to;
}

// input handing
const KEYDOWN = 1;
const KEYDOWN_PREV = 2;

let keys = {}

function getKeyName(keyCode, identifier) {
  if (identifier.slice(0, 2) === 'U+') {
    return String.fromCharCode(keyCode);
  } else {
    return identifier.toUpperCase();
  }
}

function stepKeys() {
  for (let key in keys) {
    if (isKeyDown(key)) {
      keys[key] |= KEYDOWN_PREV;
    } else {
      keys[key] &= ~KEYDOWN_PREV;
    }
  }
}

window.addEventListener('keydown', (e) => {
  let keyName = getKeyName(e.keyCode, e.keyIdentifier || e.key); 
  keys[keyName] |= KEYDOWN;
});

window.addEventListener('keyup', (e) => {
  let keyName = getKeyName(e.keyCode, e.keyIdentifier || e.key);
  keys[keyName] &= ~KEYDOWN;
});

let isKeyDown = (key) => keys[key] & KEYDOWN;

let isKeyPressed = (key) =>  keys[key] === KEYDOWN;

let isKeyReleased = (key) => keys[key] === KEYDOWN_PREV;

// rendering logic
let canvas = document.createElement('canvas');
let ctx = canvas.getContext('2d');

function draw(entity) {
  let {x, y} = entity.state;
  ctx.translate(x, y);
  entity.draw();
  ctx.translate(-x, -y);
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// audio logic
window.AudioContext = window.AudioContext || window.webkitAudioContext;

let audioCtx = new window.AudioContext();
let audioGain = audioCtx.createGain();
audioGain.connect(audioCtx.destination);

let getFrequency = (n) => pow(2, (n - 49) / 12) * 440;

const audioKeys = new Map([
  ['A', 1], ['A#', 2], ['B@', 2], ['B', 3], ['C', 4], ['C#', 5], ['D@', 5],
  ['D', 6], ['D#', 7], ['E@', 7], ['E', 8], ['F', 9], ['F#', 10], ['G@', 10],
  ['G', 11], ['G#', 12], ['A@', 12],
]);

const FULL = 1;
const HALF = 1 / 2;
const QUARTER = 1 / 4;
const EIGHTH = 1 / 8;
const SIXTEENTH = 1 / 16;

function playNote(key, octave, duration, delay=0) {
  let {currentTime} = audioCtx;
  currentTime += delay;
  
  function next(key='C', octave=4, duration=0.25) {
    let frequency = audioKeys.get(key) + (octave * 12);
    let o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = getFrequency(frequency);
    o.connect(audioGain);
    o.start(currentTime);
    currentTime += duration;
    o.stop(currentTime);

    return next;
  }

  return next(key, octave, duration);
}

// entities
let entities = [];
let entitiesToAdd = [];
let entitiesByUid = {};

let getUid = getUidGenerator();

function clearEntities () {
  for (let entity of entities.slice()) {
    deleteEntity(entity);
  }
}

function getUidGenerator() {
  let id = 1;
  return () => id++;
}

function addEntity(entity) {
  let {uid} = entity;
  if (!entity.state.exists && !entity.nextState.exists) {
    entity.enter();
    entitiesByUid[uid] = entity;
    entitiesToAdd.push(entity);
    entity.nextState.exists = true;
  }
}

function deleteEntity(entity) {
  let {uid} = entity;
  if (entity.state.exists && entity.nextState.exists) {
    entitiesByUid[uid] = null;
    entity.nextState.exists = false;
    entity.leave();
  }
}

function stepEntities() {
  entities = entities.concat(entitiesToAdd).filter(a => a.nextState.exists);
  entitiesToAdd.length = 0;
  entities.sort((a, b) => a.state.z - b.state.z);
}

class Entity {
  constructor(initialState={}) {
    this.uid = getUid();
    this.state = copy(initialState, {x: 0, y: 0, z: 0, exists: false});
    this.nextState = copy(this.state, {});
  }

  step() {}
  check() {}

  update() {
    copy(this.nextState, this.state);
  }

  draw() {
    drawEntity(this);
  }

  enter() {}
  leave() {}
}

function loop() {
  let iterEntities = entities.slice();
  iterEntities.forEach(entity => entity.step());
  iterEntities.forEach(entity => entity.check());
  iterEntities.forEach(entity => entity.update());
  stepEntities();

  stepKeys();

  clearCanvas();
  entities.forEach(entity => draw(entity));
  
  requestAnimationFrame(loop);
}  

function start() {
  document.body.appendChild(canvas);
  loop();
}

// localstorage
function saveData(data, key='game') {
  localStorage[key] = JSON.stringify(data);
}

function loadData(defaultObj={}, key='game') {
  if (!localStorage[key]) {
    localStorage[key] = '{}';
  }

  return copy(JSON.parse(localStorage[key]), defaultObj) || defaultObj;
}

/* ======== GAME_CODE ======== */

let data = loadData({
  maxLevel: 1,
  highScores: [],
});

const SCALE = 2;
const WIDTH = 600;
const HEIGHT = 400;

canvas.width = WIDTH * SCALE;
canvas.height = HEIGHT * SCALE;
canvas.style.width = `${WIDTH}px`;
canvas.style.height = `${HEIGHT}px`;
ctx.scale(SCALE, SCALE);

const {random, min, max, sqrt, floor, pow, log2, PI, abs} = Math;
const TAU = 2 * PI;
const rand = (range) => random() * range;

function moveEntity(entity, x, y) {
  entity.nextState.x += x;
  entity.nextState.y += y;
}

function collides(a, b) {
  if (a === b || !a.nextState.size || !b.nextState.size) {
    return false;
  }

  let ax1 = a.nextState.x - a.nextState.size / 2;
  let ax2 = ax1 + a.nextState.size;
  let ay1 = a.nextState.y - a.nextState.size / 2;
  let ay2 = ay1 + a.nextState.size;

  let bx1 = b.nextState.x - b.nextState.size / 2;
  let bx2 = bx1 + b.nextState.size;
  let by1 = b.nextState.y - b.nextState.size / 2;
  let by2 = by1 + b.nextState.size;

  return !(ax1 > bx2 || bx1 > ax2 || ay1 > by2 || by1 > ay2);
}

function drawEntity(entity) {
  let {size} = entity.state;
  let half = -size / 2;
  ctx.fillStyle = entity.state.color;
  ctx.fillRect(half, half, size, size);
}

function constrain(entity) {
  entity.nextState.x = min(WIDTH, max(0, entity.nextState.x));
  entity.nextState.y = min(HEIGHT, max(0, entity.nextState.y));
}

class Player extends Entity {
  get initialState() {
    return {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      z: 10,
      speedX: 0,
      speedY: 0,
      size: 8,
      color: 'red',
      level: 1,
      invulnerableSteps: 0,
    };
  }

  enter() {
    copy(this.initialState, this.state);
    copy(this.initialState, this.nextState);
  }

  get hp() {
    return floor(log2(player.nextState.size))
  }

  get xp() {
    let hp = this.hp;
    let last = pow(2, hp)
    let next = last * 2;
    let current = this.nextState.size;

    return { current: current - last, next: next - last };
  }

  step() {
    if (this.nextState.invulnerableSteps > 0) {
      this.nextState.invulnerableSteps -= 1;
    }

    let {speedX, speedY} = this.nextState;
    let x = 0;
    let y = 0;

    if (isKeyDown('RIGHT')) {
      x += 1;
    }
    if (isKeyDown('LEFT')) {
      x -= 1;
    }
    if (isKeyDown('UP')) {
      y -= 1;
    }
    if (isKeyDown('DOWN')) {
      y += 1;
    }

    if (!x && speedX) {
      x += speedX > 0 ? -1 : 1;
    }

    if (!y && speedY) {
      y += speedY > 0 ? -1 : 1;
    }

    this.nextState.speedX = min(5, max(-5, speedX + x));
    this.nextState.speedY = min(5, max(-5, speedY + y));

    moveEntity(this, speedX, speedY);
  }

  check() {
    let collisions = entities.filter((entity) => collides(this, entity));

    if (!collisions.length) {
      return;
    }

    for (let collision of collisions) {
      if (collision instanceof Pellet) {
        let hp = this.hp;
        
        this.nextState.size += 1;
        this.nextState.level += 1;

        if (this.nextState.level > data.maxLevel) {
          data.maxLevel = this.nextState.level;
          saveData(data);
        }

        let bombs = max(0, floor(sqrt(this.nextState.level)) - 1);
        while (bombs--) {
          addEntity(new BombAnimateIn());
        }

        if (this.hp > hp) {
          playNote('C', 4, SIXTEENTH)
                  ('F', 4, SIXTEENTH)
                  ('G', 4, SIXTEENTH)
                  ('E', 4, SIXTEENTH);
        } else {
          playNote('C', 4, SIXTEENTH)
                  ('F', 4, SIXTEENTH);
        }

        this.nextState.invulnerableSteps += 15;

        collision.replace();
      } else if (collision instanceof Bomb && !this.state.invulnerableSteps) {
        this.nextState.size = floor(this.nextState.size / 2);
        this.nextState.invulnerableSteps = 60;

        if (!this.hp) {
          let {highScores} = data;
          let {level} = this.nextState;

          if (highScores.length < 5 || highScores[highScores.length - 1] < level) {
            data.highScores.push(level);
            data.highScores = data.highScores.sort((a, b) => b - a).slice(0, 5);
            saveData(data);
          }

          for (let i = 5; i > 0; i--) {
            addEntity(new Particle({ 
              x: this.nextState.x,
              y: this.nextState.y,
              color: 'red',
            }));
          }

          playNote('F', 1, EIGHTH)
                  ('C', 1, EIGHTH);
          
          deleteEntity(this);
          deleteEntity(collision);

          addEntity(new Timer(30, () => {
            reset();
          }));

          return;
        } else {
          playNote('D', 0, EIGHTH);

          collision.replace();
        }
      } else if (collision instanceof Block) {
        this.nextState.x = this.state.x;
        this.nextState.y = this.state.y;
        
        if (collides(this, collision)) {
          let {x, y, size} = this.state;
          let h = size / 2;
          let {x: bX, y: bY, size: bSize} = collision.state;
          let bH = bSize / 2;

          let dx = x - bX;
          let dy = y - bY;

          if (abs(dx) > abs(dy)) {
            if (x > bX) {
              x = bX + bH + h;
            } else {
              x = bX - bH - h;
            }
          } else {
            if (y > bY) {
              y = bY + bH + h + 1
            } else {
              y = bY - bH - h - 1
            }
          }

          this.nextState.x = x;
          this.nextState.y = y;
        }

        this.nextState.speedX = 0;
        this.nextState.speedY = 0;
      }
    }
  }

  draw() {
    let isInvulnerable = this.state.invulnerableSteps > 0;
    
    if (isInvulnerable) {
      ctx.lineWidth = 1;
      let size = this.state.size + 4;
      let half = -size / 2;
      ctx.strokeStyle = this.state.color;
      ctx.strokeRect(half, half, size, size);
      ctx.lineWidth = 0;
    }
    
    drawEntity(this);
  }
}

class Collectible extends Entity {
  constructor(state) {
    super(copy(state, { 
      x: rand(WIDTH),
      y: rand(HEIGHT),
      z: 1,
      speedX: 0,
      speedY: 0,
      size: 10,
      color: 'grey',
    }));
  }

  replace() {
    this.destroy();
    addEntity(new this.constructor());
  }

  destroy() {
    deleteEntity(this);
    for (let i = 5; i > 0; i--) {
      addEntity(new Particle({
        x: this.nextState.x,
        y: this.nextState.y,
        color: this.nextState.color,
      }));
    }
  }

  step() {
    this.nextState.speedX = rand(10) - 5;
    this.nextState.speedY = rand(10) - 5;
    moveEntity(this, this.nextState.speedX, this.nextState.speedY);
  }

  check() {
    let collisions = entities.filter(entity => collides(this, entity));
    constrain(this);

    for (let collision of collisions) {
      if (collision instanceof Block) {
        this.nextState.x = this.state.x - this.nextState.speedX;
        this.nextState.y = this.state.y - this.nextState.speedY;
        return;
      }
    }
  }
}

class Pellet extends Collectible {
  constructor() {
    super({ color: 'green'});
  }

  draw() {
    let {color, x, y, size} = this.state;
    let half = size / 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(half, half);
    ctx.lineTo(-half, half);
    ctx.fill();
  }
}

class Bomb extends Collectible {
  constructor(state) {
    super(copy(state, { color: 'black', size: 12 }));
  }

  draw() {
    ctx.fillStyle = this.state.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.state.size / 2, 0, TAU);
    ctx.closePath();
    ctx.fill();
  }
}

class StaticEntity extends Entity {
  constructor(state) {
    super(state);
    this.nextState = this.state;
  }

  update() {}
}

class BombAnimateIn extends StaticEntity {
  constructor(state) {
    super(copy(state, {
      x: rand(WIDTH),
      y: rand(HEIGHT),
      size: 30,
      stepsLeft: 30,
      color: 'darkgrey',
    }));

    this.stepSize = this.state.size / this.state.stepsLeft;
  }

  step() {
    this.nextState.stepsLeft -= 1;

    if (!this.nextState.stepsLeft) {
      deleteEntity(this);
      return;
    }

    if (this.nextState.size > this.stepSize) {
      this.nextState.size -= this.stepSize;
    }
  }

  leave() {
    let {x, y} = this.state;

    addEntity(new Bomb({x, y}));
  }

  draw() {
    if (!this.state.size) {
      return;
    }

    ctx.strokeStyle = this.state.color;
    ctx.lineWidth = SCALE;
    ctx.beginPath();
    ctx.arc(0, 0, this.state.size, 0, TAU);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 0;
  }
}

class Particle extends StaticEntity {
  constructor(state) {
    state = copy(state, {
      dirX: rand(10) - 5,
      dirY: rand(10) - 5,
      stepsLeft: 10,
      size: 2,
      color: 'grey',
    });
    super(state);
  }

  step() {
    this.nextState.stepsLeft -= 1;

    if (!this.nextState.stepsLeft) {
      deleteEntity(this);
      return;
    }

    this.nextState.x += this.state.dirX;
    this.nextState.y += this.state.dirY;
  }
}

class Block extends StaticEntity {
  constructor() {
    super({
      x: rand(WIDTH),
      y: rand(HEIGHT),
      z: 1,
      size: 20,
      color: 'grey',
    });
  }
}

class Timer extends StaticEntity {
  constructor(ticks=1, onComplete) {
    super({ ticks })
    if (onComplete instanceof Function) {
      this.leave = onComplete
    }
  }

  step() {
    this.nextState.ticks -= 1;
    if (!this.nextState.ticks) {
      deleteEntity(this);
    }
  }

  draw() {}
}

let player = new Player();

let camera = new Entity({ z: -1, baseZoom: 0.5, targetZoom: 0.5, zoom: 0.5 });

camera.enter = function() {
  this.follow();
  this.centerOnPlayer();
}

camera.follow = function() {
  if (player.state.exists) {
    this.state._x = player.state.x;
    this.state._y = player.state.y;
  }
}

camera.returnToOrigin = function() {
  if (this.state.centered) {
    this.state.centered = false;
    let {_x, _y, appliedZoom:s} = this.state;
    ctx.translate(-_x, -_y);
    ctx.scale(1/s, 1/s);
  } 
}

camera.centerOnPlayer = function() {
  if (player.state.exists && !this.state.centered) {
    this.state.centered = true;
    let s = this.state.zoom;
    let {x, y} = player.state;
    x = WIDTH / 2 / s - x;
    y = HEIGHT / 2 / s - y;
    
    ctx.scale(s, s);
    ctx.translate(x, y);
    
    this.state.appliedZoom = s;
    this.state._x = x;
    this.state._y = y;
  }
}

camera.update = function() {
  this.state.targetZoom = max(1, 4 - player.hp) * this.state.baseZoom;

  let {targetZoom, zoom} = this.state;
  if (targetZoom !== zoom) {
    let d = targetZoom - zoom;
    if (abs(d) < 0.1) {
      this.state.zoom = targetZoom;
    } else {
      this.state.zoom += (d / 2);
    }
  }
  this.returnToOrigin();
  this.follow();
}

camera.draw = function() {
  this.centerOnPlayer();
}

camera.leave = function() {
  this.returnToOrigin();
}

class Scene extends StaticEntity {
  enter() {
    clearEntities();
  }

  leave() {
    if (this.nextScene) {
      addEntity(this.nextScene);
    }
  }
}

let gameScene = new Scene({ x: 0, y: 0, z: 100 });

gameScene.enter = function() {
  clearEntities();
  addEntity(camera);
  addEntity(player);
  addEntity(new Pellet());
  addEntity(new BombAnimateIn());

  for (let i = 5; i > 0; i--) {
    addEntity(new Block());
  }
};

function forceLength(str) {
  if (str.length === 1) {
    str = ' ' + str;
  }
  return str;
}

gameScene.draw = function() {
  let {centered} = camera.state;

  if (centered) {
    camera.returnToOrigin();
  }

  let level = forceLength(player.state.level.toString());
  
  let maxLevel = forceLength(data.maxLevel.toString());
  
  let {current, next} = player.xp;
  current = forceLength(current);
  next = forceLength(next);

  ctx.textAlign = 'start';
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, WIDTH, 25);
  ctx.fillStyle = 'white';
  ctx.font = '14px monospace';
  ctx.fillText(`score: ${level} | high-score: ${maxLevel} | hp: ${player.hp} | +hp: ${current}/${next}`, 5, 17);
  if (centered) {
    camera.centerOnPlayer();
  }
}

let startScene = new Scene();

startScene.step = function() {
  if (isKeyPressed('X')) {
    deleteEntity(this);
  }
}

startScene.draw = function() {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = 'white';
  ctx.font = '20px Georgia';
  let y = HEIGHT / 2;
  let x = WIDTH / 2;
  ctx.fillText(`collect the green triangles!`, x, y);
  ctx.font = '14px Georgia';
  ctx.fillText(`↑←↓→ to move`, x, y += 40);
  ctx.fillText(`press x to start`, x, y += 20);
}

let scoreScene = new Scene();

scoreScene.step = function() {
  if (isKeyPressed('X')) {
    deleteEntity(this);
  }
}

scoreScene.draw = function() {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'black';
  ctx.font = '20px Georgia';
  let y = 100;
  let x = WIDTH / 2;
  ctx.fillText(`your score: ${player.state.level}`, x, y);
  ctx.fillText(`high scores, press X to restart`, x, y += 30);
  ctx.font = '14px Georgia';
  y += 20;

  for (let i = 0, l = data.highScores.length; i < l; i++) {
    ctx.fillText(`level ${data.highScores[i]}`, x, y += 20);
  }
}

startScene.nextScene = gameScene;
gameScene.nextScene = scoreScene;
scoreScene.nextScene = gameScene;

function reset(next) {
  deleteEntity(gameScene);
}

addEntity(startScene);
start();
