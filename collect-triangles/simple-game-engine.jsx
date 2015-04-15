// build => babel -o simple-game-engine.js simple-game-engine.jsx

let gameContainer = document.getElementById('game-container');

const {random, min, max, sqrt, floor, pow, log2, PI, abs, atan2} = Math;
const TAU = 2 * PI;
const rand = (range) => random() * range;

// vector math 
const VECTOR_ORIGIN = {x: 0, y: 0};

const Vector = {
  create(x, y) { 
    return {x, y};
  },
  
  length(v) {
    let {x, y} = v;
    return Math.sqrt(x * x + y * y);
  },

  scale(v, s) {
    return Vector.create(v.x * s, v.y * s);
  },

  normalize(v) {
    let l = Vector.length(v);
    return l ? Vector.scale(v, 1 / l) : VECTOR_ORIGIN;
  },

  cross(a, b=VECTOR_ORIGIN) {
    return Vector.create(a.y - b.y, b.x - a.x);
  },

  add(a, b) {
    return Vector.create(a.x + b.x, a.y + b.y);
  },

  subract(a, b) {
    return Vector.add(a, Vector.scale(b, -1));
  },

  distance(a, b) {
    return Vector.length(Vector.subtract(a, b));
  },

  dot(a, b) {
    // 1 == same dir, 0 == perpendicular, -1 == opposite dir
    return a.x * b.x + a.y * b.y;
  },
}

const directionNames = new Map([
  ['UP', Vector.create(0, -1)],
  ['DOWN', Vector.create(0, 1)],
  ['LEFT', Vector.create(-1, 0)],
  ['RIGHT', Vector.create(1, 0)],
  ['NONE', VECTOR_ORIGIN],
]);


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

let keyboardKeys = {}
let keyNames = new Map([
  ['ARROWUP', 'UP'],
  ['ARROWDOWN', 'DOWN'],
  ['ARROWLEFT', 'LEFT'],
  ['ARROWRIGHT', 'RIGHT'],
]);


function getKeyName(keyCode, identifier) {
  if (identifier.slice(0, 2) === 'U+') {
    return String.fromCharCode(keyCode);
  }

  identifier = identifier.toUpperCase();
  let mappedIdentifier = keyNames.get(identifier);
  
  return mappedIdentifier ? mappedIdentifier : identifier;
}

function stepKeys() {
  for (let key in keyboardKeys) {
    if (isKeyDown(key)) {
      keyboardKeys[key] |= KEYDOWN_PREV;
    } else {
      keyboardKeys[key] &= ~KEYDOWN_PREV;
    }
  }
}

window.addEventListener('keydown', (e) => {
  let keyName = getKeyName(e.keyCode, e.keyIdentifier || e.key); 
  keyboardKeys[keyName] |= KEYDOWN;
});

window.addEventListener('keyup', (e) => {
  let keyName = getKeyName(e.keyCode, e.keyIdentifier || e.key);
  keyboardKeys[keyName] &= ~KEYDOWN;
});

let isKeyDown = (key) => keyboardKeys[key] & KEYDOWN;

let isKeyPressed = (key) =>  keyboardKeys[key] === KEYDOWN;

let isKeyReleased = (key) => keyboardKeys[key] === KEYDOWN_PREV;

// mouse logics
let cursor = {
  x: 0,
  y: 0,
  ACTIVE: 0,
};

let isCursorDown = () => cursor.ACTIVE & KEYDOWN;

let isCursorPressed = () => cursor.ACTIVE === KEYDOWN;

let isCursorReleased = () => cursor.ACTIVE === KEYDOWN_PREV;

const mouseEvents = new Map([
  ['down', 'mousedown'],
  ['up', 'mouseup'],
  ['move', 'mousemove'],
  ['cancel', 'mouseleave'],
]);

const touchEvents = new Map([
  ['down', 'touchstart'],
  ['up', 'touchend'],
  ['move', 'touchmove'],
  ['cancel', 'touchcancel'],
]);

let cursorEvents = 'ontouchstart' in window ? touchEvents : mouseEvents;

function stepCursor() {
  if (isCursorDown()) {
    cursor.ACTIVE |= KEYDOWN_PREV;
  } else {
    cursor.ACTIVE &= ~KEYDOWN_PREV;
  }
}

gameContainer.addEventListener(cursorEvents.get('down'), (e) => {
  cursor.ACTIVE |= KEYDOWN;
  cursor.x = e.layerX;
  cursor.y = e.layerY;
});

gameContainer.addEventListener(cursorEvents.get('up'), (e) => {
  cursor.ACTIVE &= ~KEYDOWN;
  cursor.x = e.layerX;
  cursor.y = e.layerY;
});

gameContainer.addEventListener(cursorEvents.get('move'), (e) => {
  cursor.x = e.layerX;
  cursor.y = e.layerY;
});

gameContainer.addEventListener(cursorEvents.get('cancel'), (e) => {
  cursor.ACTIVE &= ~KEYDOWN;
});

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
let audioCtx = new window.AudioContext();
let audioGain = audioCtx.createGain();
audioGain.connect(audioCtx.destination);

let getFrequency = (n) => pow(2, (n - 49) / 12) * 440;

const audioKeys = [
  ['A', 1], ['A#', 2], ['B@', 2], ['B', 3], ['C', 4], ['C#', 5], ['D@', 5],
  ['D', 6], ['D#', 7], ['E@', 7], ['E', 8], ['F', 9], ['F#', 10], ['G@', 10],
  ['G', 11], ['G#', 12], ['A@', 12],
];

const octaves = [0, 1, 2, 3, 4, 5, 6, 7];

let noteList = [].concat.apply([], audioKeys.map(key => {
  let [key, number] = key;
  return octaves.map(octave => {
    return [key + octave, getFrequency(number + octave * 12)];
  });
}));

const noteFrequencies = new Map(noteList);

const FULL = 1;
const HALF = 1 / 2;
const QUARTER = 1 / 4;
const EIGHTH = 1 / 8;
const SIXTEENTH = 1 / 16;

function playNote(frequency, start, stop) {
  let o = audioCtx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = frequency;
  o.connect(audioGain);
  o.start(start);
  o.stop(stop);
}

function playAudio(notes) {
  let {currentTime} = audioCtx;

  for (let note of notes) {
    let [key, time] = note;
    time = time || SIXTEENTH;
    if (!key) {
      currentTime += time;
    } else {
      let frequency = noteFrequencies.get(key);
      playNote(frequency, currentTime, currentTime += time);
    }
  }
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

let collisionData = new WeakMap();

function updateCollisionData(entity) {
  let {x, y, size} = entity.nextState;
  
  if (!size) {
    return collisionData.delete(entity);
  }

  let halfSize = size / 2;

  collisionData.set(entity, {
    x1: x - halfSize,
    x2: x + halfSize,
    y1: y - halfSize,
    y2: y + halfSize,
  });
}

function stepCollision() {
  entities.forEach(entity => updateCollisionData(entity));
}

function collides(a, b) {
  a = collisionData.get(a);
  b = collisionData.get(b);
  
  if (a === b || !a || !b) {
    return false;
  }

  return !(a.x1 > b.x2 || b.x1 > a.x2 || a.y1 > b.y2 || b.y1 > a.y2);
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
  stepCollision();
  iterEntities.forEach(entity => entity.check());
  iterEntities.forEach(entity => entity.update());
  stepEntities();

  stepKeys();
  stepCursor();

  clearCanvas();
  entities.forEach(entity => draw(entity));
  
  requestAnimationFrame(loop);
}  

function start() {
  gameContainer.appendChild(canvas);
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

function moveEntity(entity, x, y) {
  entity.nextState.x += x;
  entity.nextState.y += y;
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

let hpUpSound = [['C4'], ['F4'], ['G4'], ['E4']];
let collectSound = [['C4'], ['F4']];
let deathSound = [['F1', EIGHTH], ['C1', EIGHTH]];
let hitSound = [['D0', EIGHTH]];
let attackSound = [['C6'], ['G6'], ['G5']];

class Player extends Entity {
  get initialState() {
    return {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      z: 10,
      speed: 0,
      size: 8,
      color: 'red',
      level: 1,
      invulnerableSteps: 0,
      dir: Vector.create(0, 0),
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

    let {speed} = this.nextState;
    let dir = Vector.create(0, 0);

    for (let key of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
      if (isKeyDown(key)) {
        let directionVector = directionNames.get(key);
        dir = Vector.add(dir, directionVector);
      }
    }

    dir = Vector.normalize(dir);

    let l = Vector.length(dir);
    speed = min(5, max(0, speed + (l ? 1 : -1)));
    this.nextState.speed = speed;
    
    let move = Vector.scale(dir, speed);
    moveEntity(this, move.x, move.y);
    
    if (l) {
      this.nextState.dir = dir;
    }

    let hp = this.hp;

    if (isCursorPressed() && hp >= 2) {
      let {size} = this.state;
      let dir = Vector.normalize(Vector.subract(cursor, {x: WIDTH/2, y: HEIGHT/2}, cursor));
      let offset = Vector.scale(dir, size + 5 + this.state.speed);
      let point = Vector.add(this.state, offset);
      if (hp >= 3) {
        dir = Vector.scale(dir, hp * 2);
      }
      point.dir = dir;
      playAudio(attackSound);
      addEntity(new PlayerAttack(point));
    }
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
          playAudio(hpUpSound);
        } else {
          playAudio(collectSound);
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

          playAudio(deathSound);
          
          deleteEntity(this);
          deleteEntity(collision);

          addEntity(new Timer(30, () => {
            reset();
          }));

          return;
        } else {
          playAudio(hitSound)

          collision.replace();
        }
      } else if (collision instanceof Block) {
        this.nextState.x = this.state.x;
        this.nextState.y = this.state.y;
        updateCollisionData(this);

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

        this.nextState.speed = 0;
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
  constructor(state) {
    super(copy(state, { color: 'green'}));
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

  destroy() {
    super.destroy();
    addEntity(new BombAnimateOut({x: this.state.x, y: this.state.y}));
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

class BombAnimateOut extends BombAnimateIn {
  constructor(state) {
    super(copy(state, {
      x: rand(WIDTH),
      y: rand(HEIGHT),
      size: 5,
      stepsLeft: 10,
      color: 'yellow',
      targetSize: 50,
    }));
    let {size, targetSize, stepsLeft} = this.state;

    this.stepSize = (targetSize - size) / stepsLeft;
  }

  step() {
    this.nextState.stepsLeft -= 1;

    if (!this.nextState.stepsLeft) {
      deleteEntity(this);
      return;
    }

    if (this.nextState.size < this.state.targetSize) {
      this.nextState.size += this.stepSize;
    }
  }

  check() {
    entities.forEach(entity => {
      if (!collides(this, entity)) {
        return;
      }

      if (entity instanceof Bomb) {
        entity.destroy();
        playAudio(deathSound);
      }
    });
  }

  draw() {
    ctx.fillStyle = this.state.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.state.size, 0, TAU);
    ctx.closePath();
    ctx.fill();
  }

  leave() {
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
      z: 100,
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

class PlayerAttack extends Particle {
  constructor(state) {
    super(copy(state, {
      dirX: state.dir.x,
      dirY: state.dir.y,
      size: 10,
      stepsLeft: 5,
      color: 'silver',
    }));
  }

  check() {
    entities.forEach(entity => {
      if (!collides(this, entity)) {
        return;
      }

      if (entity instanceof Bomb) {
        entity.destroy();
        playAudio(deathSound);
      }
    })
  }

  draw() {
    let {dir} = this.state;
    let PI2 = PI / 2;
    let angle = atan2(-dir.x, dir.y) + PI2;
    ctx.fillStyle = this.state.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.state.size, angle - PI2, angle + PI2);
    ctx.closePath();
    ctx.fill();
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
  ctx.fillText(`x to attack`, x, y += 20);
  ctx.fillText(`press x to start`, x, y += 40);
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
