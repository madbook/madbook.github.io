"use strict";

var _slicedToArray = function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) { _arr.push(_step.value); if (i && _arr.length === i) break; } return _arr; } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } };

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

// build => babel -o simple-game-engine.js simple-game-engine.jsx

if (window.Map.length === 0) {
  (function () {
    // hack to polyfill Safari's jank
    var _trueMap = window.Map;
    window.Map = function (init) {
      var map = new _trueMap();
      init.forEach(function (item) {
        var _item = _slicedToArray(item, 2);

        var key = _item[0];
        var value = _item[1];

        map.set(key, value);
      });
      return map;
    };
  })();
}

// utils
function copy(from, to) {
  for (var key in from) {
    var fromVal = from[key];
    if (Array.isArray(fromVal)) {
      to[key] = from[key].slice();
    } else if (fromVal !== null && typeof fromVal === "Object") {
      to[key] = copy(fromVal, {});
    }
    to[key] = fromVal;
  }
  return to;
}

// input handing
var KEYDOWN = 1;
var KEYDOWN_PREV = 2;

var keys = {};

function getKeyName(keyCode, identifier) {
  if (identifier.slice(0, 2) === "U+") {
    return String.fromCharCode(keyCode);
  } else {
    return identifier.toUpperCase();
  }
}

function stepKeys() {
  for (var key in keys) {
    if (isKeyDown(key)) {
      keys[key] |= KEYDOWN_PREV;
    } else {
      keys[key] &= ~KEYDOWN_PREV;
    }
  }
}

window.addEventListener("keydown", function (e) {
  var keyName = getKeyName(e.keyCode, e.keyIdentifier || e.key);
  keys[keyName] |= KEYDOWN;
});

window.addEventListener("keyup", function (e) {
  var keyName = getKeyName(e.keyCode, e.keyIdentifier || e.key);
  keys[keyName] &= ~KEYDOWN;
});

var isKeyDown = function (key) {
  return keys[key] & KEYDOWN;
};

var isKeyPressed = function (key) {
  return keys[key] === KEYDOWN;
};

var isKeyReleased = function (key) {
  return keys[key] === KEYDOWN_PREV;
};

// rendering logic
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");

function draw(entity) {
  var _entity$state = entity.state;
  var x = _entity$state.x;
  var y = _entity$state.y;

  ctx.translate(x, y);
  entity.draw();
  ctx.translate(-x, -y);
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// audio logic
window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioCtx = new window.AudioContext();
var audioGain = audioCtx.createGain();
audioGain.connect(audioCtx.destination);

var getFrequency = function (n) {
  return pow(2, (n - 49) / 12) * 440;
};

var audioKeys = new Map([["A", 1], ["A#", 2], ["B@", 2], ["B", 3], ["C", 4], ["C#", 5], ["D@", 5], ["D", 6], ["D#", 7], ["E@", 7], ["E", 8], ["F", 9], ["F#", 10], ["G@", 10], ["G", 11], ["G#", 12], ["A@", 12]]);

var FULL = 1;
var HALF = 1 / 2;
var QUARTER = 1 / 4;
var EIGHTH = 1 / 8;
var SIXTEENTH = 1 / 16;

function playNote(key, octave, duration) {
  var delay = arguments[3] === undefined ? 0 : arguments[3];
  var currentTime = audioCtx.currentTime;

  currentTime += delay;

  function next() {
    var key = arguments[0] === undefined ? "C" : arguments[0];
    var octave = arguments[1] === undefined ? 4 : arguments[1];
    var duration = arguments[2] === undefined ? 0.25 : arguments[2];

    var frequency = audioKeys.get(key) + octave * 12;
    var o = audioCtx.createOscillator();
    o.type = "sawtooth";
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
var entities = [];
var entitiesToAdd = [];
var entitiesByUid = {};

var getUid = getUidGenerator();

function clearEntities() {
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = entities.slice()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var entity = _step.value;

      deleteEntity(entity);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator["return"]) {
        _iterator["return"]();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }
}

function getUidGenerator() {
  var id = 1;
  return function () {
    return id++;
  };
}

function addEntity(entity) {
  var uid = entity.uid;

  if (!entity.state.exists && !entity.nextState.exists) {
    entity.enter();
    entitiesByUid[uid] = entity;
    entitiesToAdd.push(entity);
    entity.nextState.exists = true;
  }
}

function deleteEntity(entity) {
  var uid = entity.uid;

  if (entity.state.exists && entity.nextState.exists) {
    entitiesByUid[uid] = null;
    entity.nextState.exists = false;
    entity.leave();
  }
}

function stepEntities() {
  entities = entities.concat(entitiesToAdd).filter(function (a) {
    return a.nextState.exists;
  });
  entitiesToAdd.length = 0;
  entities.sort(function (a, b) {
    return a.state.z - b.state.z;
  });
}

var Entity = (function () {
  function Entity() {
    var initialState = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Entity);

    this.uid = getUid();
    this.state = copy(initialState, { x: 0, y: 0, z: 0, exists: false });
    this.nextState = copy(this.state, {});
  }

  _createClass(Entity, {
    step: {
      value: function step() {}
    },
    check: {
      value: function check() {}
    },
    update: {
      value: function update() {
        copy(this.nextState, this.state);
      }
    },
    draw: {
      value: function draw() {
        drawEntity(this);
      }
    },
    enter: {
      value: function enter() {}
    },
    leave: {
      value: function leave() {}
    }
  });

  return Entity;
})();

function loop() {
  var iterEntities = entities.slice();
  iterEntities.forEach(function (entity) {
    return entity.step();
  });
  iterEntities.forEach(function (entity) {
    return entity.check();
  });
  iterEntities.forEach(function (entity) {
    return entity.update();
  });
  stepEntities();

  stepKeys();

  clearCanvas();
  entities.forEach(function (entity) {
    return draw(entity);
  });

  requestAnimationFrame(loop);
}

function start() {
  document.body.appendChild(canvas);
  loop();
}

// localstorage
function saveData(data) {
  var key = arguments[1] === undefined ? "game" : arguments[1];

  localStorage[key] = JSON.stringify(data);
}

function loadData() {
  var defaultObj = arguments[0] === undefined ? {} : arguments[0];
  var key = arguments[1] === undefined ? "game" : arguments[1];

  if (!localStorage[key]) {
    localStorage[key] = "{}";
  }

  return copy(JSON.parse(localStorage[key]), defaultObj) || defaultObj;
}

/* ======== GAME_CODE ======== */

var data = loadData({
  maxLevel: 1,
  highScores: [] });

var SCALE = 2;
var WIDTH = 600;
var HEIGHT = 400;

canvas.width = WIDTH * SCALE;
canvas.height = HEIGHT * SCALE;
canvas.style.width = "" + WIDTH + "px";
canvas.style.height = "" + HEIGHT + "px";
ctx.scale(SCALE, SCALE);

var random = Math.random;
var min = Math.min;
var max = Math.max;
var sqrt = Math.sqrt;
var floor = Math.floor;
var pow = Math.pow;
var log2 = Math.log2;
var PI = Math.PI;
var abs = Math.abs;

var TAU = 2 * PI;
var rand = function (range) {
  return random() * range;
};

function moveEntity(entity, x, y) {
  entity.nextState.x += x;
  entity.nextState.y += y;
}

function collides(a, b) {
  if (a === b || !a.nextState.size || !b.nextState.size) {
    return false;
  }

  var ax1 = a.nextState.x - a.nextState.size / 2;
  var ax2 = ax1 + a.nextState.size;
  var ay1 = a.nextState.y - a.nextState.size / 2;
  var ay2 = ay1 + a.nextState.size;

  var bx1 = b.nextState.x - b.nextState.size / 2;
  var bx2 = bx1 + b.nextState.size;
  var by1 = b.nextState.y - b.nextState.size / 2;
  var by2 = by1 + b.nextState.size;

  return !(ax1 > bx2 || bx1 > ax2 || ay1 > by2 || by1 > ay2);
}

function drawEntity(entity) {
  var size = entity.state.size;

  var half = -size / 2;
  ctx.fillStyle = entity.state.color;
  ctx.fillRect(half, half, size, size);
}

function constrain(entity) {
  entity.nextState.x = min(WIDTH, max(0, entity.nextState.x));
  entity.nextState.y = min(HEIGHT, max(0, entity.nextState.y));
}

var Player = (function (_Entity) {
  function Player() {
    _classCallCheck(this, Player);

    if (_Entity != null) {
      _Entity.apply(this, arguments);
    }
  }

  _inherits(Player, _Entity);

  _createClass(Player, {
    initialState: {
      get: function () {
        return {
          x: WIDTH / 2,
          y: HEIGHT / 2,
          z: 10,
          speedX: 0,
          speedY: 0,
          size: 8,
          color: "red",
          level: 1,
          invulnerableSteps: 0 };
      }
    },
    enter: {
      value: function enter() {
        copy(this.initialState, this.state);
        copy(this.initialState, this.nextState);
      }
    },
    hp: {
      get: function () {
        return floor(log2(player.nextState.size));
      }
    },
    xp: {
      get: function () {
        var hp = this.hp;
        var last = pow(2, hp);
        var next = last * 2;
        var current = this.nextState.size;

        return { current: current - last, next: next - last };
      }
    },
    step: {
      value: function step() {
        if (this.nextState.invulnerableSteps > 0) {
          this.nextState.invulnerableSteps -= 1;
        }

        var _nextState = this.nextState;
        var speedX = _nextState.speedX;
        var speedY = _nextState.speedY;

        var x = 0;
        var y = 0;

        if (isKeyDown("RIGHT")) {
          x += 1;
        }
        if (isKeyDown("LEFT")) {
          x -= 1;
        }
        if (isKeyDown("UP")) {
          y -= 1;
        }
        if (isKeyDown("DOWN")) {
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
    },
    check: {
      value: function check() {
        var _this = this;

        var collisions = entities.filter(function (entity) {
          return collides(_this, entity);
        });

        if (!collisions.length) {
          return;
        }

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = collisions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var collision = _step.value;

            if (collision instanceof Pellet) {
              var hp = this.hp;

              this.nextState.size += 1;
              this.nextState.level += 1;

              if (this.nextState.level > data.maxLevel) {
                data.maxLevel = this.nextState.level;
                saveData(data);
              }

              var bombs = max(0, floor(sqrt(this.nextState.level)) - 1);
              while (bombs--) {
                addEntity(new BombAnimateIn());
              }

              if (this.hp > hp) {
                playNote("C", 4, SIXTEENTH)("F", 4, SIXTEENTH)("G", 4, SIXTEENTH)("E", 4, SIXTEENTH);
              } else {
                playNote("C", 4, SIXTEENTH)("F", 4, SIXTEENTH);
              }

              this.nextState.invulnerableSteps += 15;

              collision.replace();
            } else if (collision instanceof Bomb && !this.state.invulnerableSteps) {
              this.nextState.size = floor(this.nextState.size / 2);
              this.nextState.invulnerableSteps = 60;

              if (!this.hp) {
                var highScores = data.highScores;
                var level = this.nextState.level;

                if (highScores.length < 5 || highScores[highScores.length - 1] < level) {
                  data.highScores.push(level);
                  data.highScores = data.highScores.sort(function (a, b) {
                    return b - a;
                  }).slice(0, 5);
                  saveData(data);
                }

                for (var i = 5; i > 0; i--) {
                  addEntity(new Particle({
                    x: this.nextState.x,
                    y: this.nextState.y,
                    color: "red" }));
                }

                playNote("F", 1, EIGHTH)("C", 1, EIGHTH);

                deleteEntity(this);
                deleteEntity(collision);

                addEntity(new Timer(30, function () {
                  reset();
                }));

                return;
              } else {
                playNote("D", 0, EIGHTH);

                collision.replace();
              }
            } else if (collision instanceof Block) {
              this.nextState.x = this.state.x;
              this.nextState.y = this.state.y;

              if (collides(this, collision)) {
                var _state = this.state;
                var x = _state.x;
                var y = _state.y;
                var size = _state.size;

                var h = size / 2;
                var _collision$state = collision.state;
                var bX = _collision$state.x;
                var bY = _collision$state.y;
                var bSize = _collision$state.size;

                var bH = bSize / 2;

                var dx = x - bX;
                var dy = y - bY;

                if (abs(dx) > abs(dy)) {
                  if (x > bX) {
                    x = bX + bH + h;
                  } else {
                    x = bX - bH - h;
                  }
                } else {
                  if (y > bY) {
                    y = bY + bH + h + 1;
                  } else {
                    y = bY - bH - h - 1;
                  }
                }

                this.nextState.x = x;
                this.nextState.y = y;
              }

              this.nextState.speedX = 0;
              this.nextState.speedY = 0;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator["return"]) {
              _iterator["return"]();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
    },
    draw: {
      value: function draw() {
        var isInvulnerable = this.state.invulnerableSteps > 0;

        if (isInvulnerable) {
          ctx.lineWidth = 1;
          var size = this.state.size + 4;
          var half = -size / 2;
          ctx.strokeStyle = this.state.color;
          ctx.strokeRect(half, half, size, size);
          ctx.lineWidth = 0;
        }

        drawEntity(this);
      }
    }
  });

  return Player;
})(Entity);

var Collectible = (function (_Entity2) {
  function Collectible(state) {
    _classCallCheck(this, Collectible);

    _get(Object.getPrototypeOf(Collectible.prototype), "constructor", this).call(this, copy(state, {
      x: rand(WIDTH),
      y: rand(HEIGHT),
      z: 1,
      speedX: 0,
      speedY: 0,
      size: 10,
      color: "grey" }));
  }

  _inherits(Collectible, _Entity2);

  _createClass(Collectible, {
    replace: {
      value: function replace() {
        this.destroy();
        addEntity(new this.constructor());
      }
    },
    destroy: {
      value: function destroy() {
        deleteEntity(this);
        for (var i = 5; i > 0; i--) {
          addEntity(new Particle({
            x: this.nextState.x,
            y: this.nextState.y,
            color: this.nextState.color }));
        }
      }
    },
    step: {
      value: function step() {
        this.nextState.speedX = rand(10) - 5;
        this.nextState.speedY = rand(10) - 5;
        moveEntity(this, this.nextState.speedX, this.nextState.speedY);
      }
    },
    check: {
      value: function check() {
        var _this = this;

        var collisions = entities.filter(function (entity) {
          return collides(_this, entity);
        });
        constrain(this);

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = collisions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var collision = _step.value;

            if (collision instanceof Block) {
              this.nextState.x = this.state.x - this.nextState.speedX;
              this.nextState.y = this.state.y - this.nextState.speedY;
              return;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator["return"]) {
              _iterator["return"]();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
    }
  });

  return Collectible;
})(Entity);

var Pellet = (function (_Collectible) {
  function Pellet() {
    _classCallCheck(this, Pellet);

    _get(Object.getPrototypeOf(Pellet.prototype), "constructor", this).call(this, { color: "green" });
  }

  _inherits(Pellet, _Collectible);

  _createClass(Pellet, {
    draw: {
      value: function draw() {
        var _state = this.state;
        var color = _state.color;
        var x = _state.x;
        var y = _state.y;
        var size = _state.size;

        var half = size / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -half);
        ctx.lineTo(half, half);
        ctx.lineTo(-half, half);
        ctx.fill();
      }
    }
  });

  return Pellet;
})(Collectible);

var Bomb = (function (_Collectible2) {
  function Bomb(state) {
    _classCallCheck(this, Bomb);

    _get(Object.getPrototypeOf(Bomb.prototype), "constructor", this).call(this, copy(state, { color: "black", size: 12 }));
  }

  _inherits(Bomb, _Collectible2);

  _createClass(Bomb, {
    draw: {
      value: function draw() {
        ctx.fillStyle = this.state.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.state.size / 2, 0, TAU);
        ctx.closePath();
        ctx.fill();
      }
    }
  });

  return Bomb;
})(Collectible);

var StaticEntity = (function (_Entity3) {
  function StaticEntity(state) {
    _classCallCheck(this, StaticEntity);

    _get(Object.getPrototypeOf(StaticEntity.prototype), "constructor", this).call(this, state);
    this.nextState = this.state;
  }

  _inherits(StaticEntity, _Entity3);

  _createClass(StaticEntity, {
    update: {
      value: function update() {}
    }
  });

  return StaticEntity;
})(Entity);

var BombAnimateIn = (function (_StaticEntity) {
  function BombAnimateIn(state) {
    _classCallCheck(this, BombAnimateIn);

    _get(Object.getPrototypeOf(BombAnimateIn.prototype), "constructor", this).call(this, copy(state, {
      x: rand(WIDTH),
      y: rand(HEIGHT),
      size: 30,
      stepsLeft: 30,
      color: "darkgrey" }));

    this.stepSize = this.state.size / this.state.stepsLeft;
  }

  _inherits(BombAnimateIn, _StaticEntity);

  _createClass(BombAnimateIn, {
    step: {
      value: function step() {
        this.nextState.stepsLeft -= 1;

        if (!this.nextState.stepsLeft) {
          deleteEntity(this);
          return;
        }

        if (this.nextState.size > this.stepSize) {
          this.nextState.size -= this.stepSize;
        }
      }
    },
    leave: {
      value: function leave() {
        var _state = this.state;
        var x = _state.x;
        var y = _state.y;

        addEntity(new Bomb({ x: x, y: y }));
      }
    },
    draw: {
      value: function draw() {
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
  });

  return BombAnimateIn;
})(StaticEntity);

var Particle = (function (_StaticEntity2) {
  function Particle(state) {
    _classCallCheck(this, Particle);

    state = copy(state, {
      dirX: rand(10) - 5,
      dirY: rand(10) - 5,
      stepsLeft: 10,
      size: 2,
      color: "grey" });
    _get(Object.getPrototypeOf(Particle.prototype), "constructor", this).call(this, state);
  }

  _inherits(Particle, _StaticEntity2);

  _createClass(Particle, {
    step: {
      value: function step() {
        this.nextState.stepsLeft -= 1;

        if (!this.nextState.stepsLeft) {
          deleteEntity(this);
          return;
        }

        this.nextState.x += this.state.dirX;
        this.nextState.y += this.state.dirY;
      }
    }
  });

  return Particle;
})(StaticEntity);

var Block = (function (_StaticEntity3) {
  function Block() {
    _classCallCheck(this, Block);

    _get(Object.getPrototypeOf(Block.prototype), "constructor", this).call(this, {
      x: rand(WIDTH),
      y: rand(HEIGHT),
      z: 1,
      size: 20,
      color: "grey" });
  }

  _inherits(Block, _StaticEntity3);

  return Block;
})(StaticEntity);

var Timer = (function (_StaticEntity4) {
  function Timer(_x, onComplete) {
    var ticks = arguments[0] === undefined ? 1 : arguments[0];

    _classCallCheck(this, Timer);

    _get(Object.getPrototypeOf(Timer.prototype), "constructor", this).call(this, { ticks: ticks });
    if (onComplete instanceof Function) {
      this.leave = onComplete;
    }
  }

  _inherits(Timer, _StaticEntity4);

  _createClass(Timer, {
    step: {
      value: function step() {
        this.nextState.ticks -= 1;
        if (!this.nextState.ticks) {
          deleteEntity(this);
        }
      }
    },
    draw: {
      value: function draw() {}
    }
  });

  return Timer;
})(StaticEntity);

var player = new Player();

var camera = new Entity({ z: -1, baseZoom: 0.5, targetZoom: 0.5, zoom: 0.5 });

camera.enter = function () {
  this.follow();
  this.centerOnPlayer();
};

camera.follow = function () {
  if (player.state.exists) {
    this.state._x = player.state.x;
    this.state._y = player.state.y;
  }
};

camera.returnToOrigin = function () {
  if (this.state.centered) {
    this.state.centered = false;
    var _state = this.state;
    var _x = _state._x;
    var _y = _state._y;
    var s = _state.appliedZoom;

    ctx.translate(-_x, -_y);
    ctx.scale(1 / s, 1 / s);
  }
};

camera.centerOnPlayer = function () {
  if (player.state.exists && !this.state.centered) {
    this.state.centered = true;
    var s = this.state.zoom;
    var _player$state = player.state;
    var x = _player$state.x;
    var y = _player$state.y;

    x = WIDTH / 2 / s - x;
    y = HEIGHT / 2 / s - y;

    ctx.scale(s, s);
    ctx.translate(x, y);

    this.state.appliedZoom = s;
    this.state._x = x;
    this.state._y = y;
  }
};

camera.update = function () {
  this.state.targetZoom = max(1, 4 - player.hp) * this.state.baseZoom;

  var _state = this.state;
  var targetZoom = _state.targetZoom;
  var zoom = _state.zoom;

  if (targetZoom !== zoom) {
    var d = targetZoom - zoom;
    if (abs(d) < 0.1) {
      this.state.zoom = targetZoom;
    } else {
      this.state.zoom += d / 2;
    }
  }
  this.returnToOrigin();
  this.follow();
};

camera.draw = function () {
  this.centerOnPlayer();
};

camera.leave = function () {
  this.returnToOrigin();
};

var Scene = (function (_StaticEntity5) {
  function Scene() {
    _classCallCheck(this, Scene);

    if (_StaticEntity5 != null) {
      _StaticEntity5.apply(this, arguments);
    }
  }

  _inherits(Scene, _StaticEntity5);

  _createClass(Scene, {
    enter: {
      value: function enter() {
        clearEntities();
      }
    },
    leave: {
      value: function leave() {
        if (this.nextScene) {
          addEntity(this.nextScene);
        }
      }
    }
  });

  return Scene;
})(StaticEntity);

var gameScene = new Scene({ x: 0, y: 0, z: 100 });

gameScene.enter = function () {
  clearEntities();
  addEntity(camera);
  addEntity(player);
  addEntity(new Pellet());
  addEntity(new BombAnimateIn());

  for (var i = 5; i > 0; i--) {
    addEntity(new Block());
  }
};

function forceLength(str) {
  if (str.length === 1) {
    str = " " + str;
  }
  return str;
}

gameScene.draw = function () {
  var centered = camera.state.centered;

  if (centered) {
    camera.returnToOrigin();
  }

  var level = forceLength(player.state.level.toString());

  var maxLevel = forceLength(data.maxLevel.toString());

  var _player$xp = player.xp;
  var current = _player$xp.current;
  var next = _player$xp.next;

  current = forceLength(current);
  next = forceLength(next);

  ctx.textAlign = "start";
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, WIDTH, 25);
  ctx.fillStyle = "white";
  ctx.font = "14px monospace";
  ctx.fillText("score: " + level + " | high-score: " + maxLevel + " | hp: " + player.hp + " | +hp: " + current + "/" + next, 5, 17);
  if (centered) {
    camera.centerOnPlayer();
  }
};

var startScene = new Scene();

startScene.step = function () {
  if (isKeyPressed("X")) {
    deleteEntity(this);
  }
};

startScene.draw = function () {
  ctx.textAlign = "center";
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "white";
  ctx.font = "20px Georgia";
  var y = HEIGHT / 2;
  var x = WIDTH / 2;
  ctx.fillText("collect the green triangles!", x, y);
  ctx.font = "14px Georgia";
  ctx.fillText("↑←↓→ to move", x, y += 40);
  ctx.fillText("press x to start", x, y += 20);
};

var scoreScene = new Scene();

scoreScene.step = function () {
  if (isKeyPressed("X")) {
    deleteEntity(this);
  }
};

scoreScene.draw = function () {
  ctx.textAlign = "center";
  ctx.fillStyle = "black";
  ctx.font = "20px Georgia";
  var y = 100;
  var x = WIDTH / 2;
  ctx.fillText("your score: " + player.state.level, x, y);
  ctx.fillText("high scores, press X to restart", x, y += 30);
  ctx.font = "14px Georgia";
  y += 20;

  for (var i = 0, l = data.highScores.length; i < l; i++) {
    ctx.fillText("level " + data.highScores[i], x, y += 20);
  }
};

startScene.nextScene = gameScene;
gameScene.nextScene = scoreScene;
scoreScene.nextScene = gameScene;

function reset(next) {
  deleteEntity(gameScene);
}

addEntity(startScene);
start();
