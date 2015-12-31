var cellsize = 10;
var halfcell = cellsize / 2;
var rows = 480 / cellsize;
var cols = 800 / cellsize;

function WithContext(ctx, params, fun) {
    ctx.save();
    try {
        if (params.translateX != null) {
            ctx.translate(params.translateX, params.translateY);
        }
        if (params.scale != null) {
            ctx.scale(params.scale, params.scale);
        }
        if (params.rotate != null) {
            ctx.rotate(params.rotate);
        }
        fun.call();
    } finally {
        ctx.restore();
    }
}

function distance_squared(a, b) {
    var xd = a.x - b.x;
    var yd = a.y - b.y;
    return xd * xd + yd * yd;
}

function distance(a, b) {
    return Math.sqrt(distance_squared(a, b));
}

function Tree(x, y) {
    var tree = this;
    tree.x = x;
    tree.y = y;
    tree.size = halfcell;

    tree.update = function () {
    }
    
    tree.draw = function(canvas, ctx) {
        WithContext(ctx, { translateX: tree.x, translateY: tree.y,
                           scale: halfcell / 10 },
                    function () {
                        ctx.beginPath();
                        ctx.arc(0, 0,
                                10,
                                0, 2*Math.PI);
                        ctx.fillStyle = "green";
                        ctx.fill();
                        ctx.strokeStyle = "darkgreen";
                        ctx.stroke();
                    });
    }

    tree.hit = function () {
        tree.exploded = true;
    }

}

function MissileType() {
    var type = this;
    type.explosionScale = 0;
    type.speed = 1;
    type.warheads = 1;

    type.name = function() {
        return "sz=" + type.explosionScale + " eng=" + type.speed + " wh=" + type.warheads;
    };
};

function Missile(missileType, launcher, x, y, dx, dy, angle) {
    var missile = this;
    missile.type = missileType;
    missile.launcher = launcher;
    missile.x = x;
    missile.y = y;
    missile.dx = dx;
    missile.dy = dy;
    missile.engineOn = false;
    missile.launchAngle = angle;
    missile.size = 1;

    missile.update = function () {
        if (missile.exploding) {
            if (missile.explodeCounter == 0) {
                missile.exploded = true;
            } else {
                missile.explodeCounter--;
                missile.size = (10 - missile.explodeCounter * 2) * missile.type.explosionScale;
            }
            if (missile.exploding) {
                _(game.objects).each(function(other) {
                    if (other === missile || other.exploding) {
                        return;
                    }
                    var d = distance(missile, other);
                    if (d < missile.size + other.size) {
                        other.hit()
                    }
                });
            }
        } else {
            missile.x += missile.dx;
            missile.y += missile.dy;
            missile.dy += 0.05;
            if (missile.engineOn) {
                missile.dx += 0.1 * Math.sin(missile.launchAngle) * missile.type.speed;
                missile.dy -= 0.1 * Math.cos(missile.launchAngle) * missile.type.speed;
            }
            if (missile.x <= 0 ||
                missile.x >= 800) {
                missile.exploded = true;
            } else if (missile.y >= 480) {
                missile.explode();
            } else {
                var row = Math.floor(missile.y / cellsize);
                var col = Math.floor(missile.x / cellsize);
                if (row > 0 && col > 0 && row < rows && col < cols) {
                    var tile = game.tiles[row][col];
                    if (tile == 1) {
                        missile.explode();
                    } else if (tile == 2) {
                        missile.dontExplode = true;
                    }
                }
            }
        }
    }
    missile.draw = function(canvas, ctx) {
        if (missile.exploding) {
            missile.drawExploding(canvas, ctx);
        } else {
            missile.drawNormal(canvas, ctx);
        }
    };

    missile.drawNormal = function(canvas, ctx) {
        var angle = Math.atan2(missile.dy, missile.dx);
        WithContext(ctx, { translateX: missile.x, translateY: missile.y,
                           rotate: angle,
                           scale: halfcell / 10 },
                    function () {
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(25, 0);
                        ctx.lineWidth = 6;
                        ctx.strokeStyle = "black";
                        ctx.stroke();
                        ctx.closePath();
                        
                        if (missile.engineOn) {
                            ctx.beginPath();
                            ctx.moveTo(0, 0);
                            ctx.lineTo(-8, 0);
                            ctx.lineWidth = 5;
                            ctx.strokeStyle = "orange";
                            ctx.stroke();
                        }
                    });
    }
    missile.drawExploding = function(canvas, ctx) {
        WithContext(ctx, { translateX: missile.x, translateY: missile.y,
                           scale: halfcell / 5 },
                    function () {
                        ctx.beginPath();
                        ctx.arc(0, 0,
                                (10 - missile.explodeCounter * 2) * missile.type.explosionScale,
                                0, 2*Math.PI);
                        ctx.lineWidth = 1;
                        ctx.fillStyle = "orange";
                        ctx.strokeStyle = "red";
                        ctx.fill();
                        ctx.stroke();
                        ctx.closePath();
                    });
    }

    missile.explode = function() {
        if (missile.dontExplode) {
            missile.exploded = true;
        } else {
            missile.exploding = true;
            missile.explodeCounter = 5;
        }
    };

    missile.hit = function() {
        missile.explode();
    };

    missile.turnEngineOff = function () {
        if (missile.engineOn) {
            var scale = 0.95;
            for (var i = 1; i < missile.type.warheads; i++) {
                var copy = game.addMissile(missile.type,
                                           missile.launcher,
                                           missile.x,
                                           missile.y,
                                           missile.angle);
                copy.dx = missile.dx * scale;
                copy.dy = missile.dy * scale;
                scale = scale * scale;
                missile.launcher.missiles.push(copy);
            }
            missile.engineOn = false;
        }
    };
};

function Launcher(x, y, angle) {
    var launcher = this;
    launcher.x = x;
    launcher.y = y;
    launcher.angle = angle;
    launcher.missiles = [];
    launcher.turningRight = false;
    launcher.turningLeft = false;
    launcher.size = (3 * cellsize) / 2;
    launcher.maxHp = 30;
    launcher.hp = launcher.maxHp;
    launcher.missileTypes = [];
    launcher.missileTypeIndex = 0;

    launcher.turnRight = function(value) {
        launcher.turningRight = value;
    }
    launcher.turnLeft = function(value) {
        launcher.turningLeft = value;
    }

    launcher.draw = function(canvas, ctx) {
        WithContext(ctx, { translateX: launcher.x, translateY: launcher.y,
                           scale: halfcell / 5 },
                    function () {
                        ctx.save();
                        ctx.beginPath();
                        ctx.lineWidth = 3;
                        ctx.rotate(Math.PI + launcher.angle);
                        ctx.moveTo(0, 13);
                        ctx.lineTo(0, 25);
                        ctx.stroke();
                        ctx.restore();

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(0, 0, 15, 1*Math.PI, 0);
                        ctx.lineWidth = 1;
                        ctx.fillStyle = "gray";
                        ctx.strokeStyle = "black";
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                        ctx.restore();

                        ctx.save();
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(-15, 4);
                        ctx.lineTo(15, 4);
                        ctx.strokeStyle = "red";
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(-15, 4);
                        ctx.lineTo(-15 + 30 * (launcher.hp / launcher.maxHp), 4);
                        ctx.strokeStyle = "blue";
                        ctx.stroke();
                        ctx.restore();

                    });
        launcher.drawMissileTypes(canvas, ctx);
    };

    launcher.drawMissileTypes = function(canvas, ctx) {
        WithContext(ctx, { translateX: launcher.x,
                           translateY: 20 },
                    function() {
                        ctx.font = "10px Sans";
                        ctx.lineWidth = 0.1;
                        ctx.fillStyle = "black";
                        ctx.strokeStyle = "white";

                        var text = launcher.currentMissileType().name();
                        ctx.fillText(text, 0, 0);
                        ctx.strokeText(text, 0, 0);

                        var next = launcher.nextMissileType();
                        if (next) {
                            text = next.name();
                            ctx.fillText(text, 0, 14);
                            ctx.strokeText(text, 0, 14);
                        }
                        
                        ctx.beginPath();
                        ctx.moveTo(-7, -5);
                        ctx.lineTo(-2, -3);
                        ctx.lineTo(-7, -1);
                        ctx.fill();
                    });        
    };

    launcher.update = function() {
        if (launcher.turningRight) {
            launcher.angle += 0.05;
        }
        if (launcher.turningLeft) {
            launcher.angle -= 0.05;
        }
        launcher.restrictAngle();
        launcher.missiles = _(launcher.missiles).filter(function(object) {
            return object.exploded != true;
        });
    };

    launcher.restrictAngle = function() {
        var max = Math.PI * 0.45;
        var min = -max;
        if (launcher.angle > max) {
            launcher.angle = max;
        }
        if (launcher.angle < min) {
            launcher.angle = min;
        }
    };

    launcher.hit = function() {
        launcher.hp--;
    };

    launcher.currentMissileType = function() {
        return launcher.missileTypes[launcher.missileTypeIndex];
    }

    launcher.nextMissileType = function() {
        var size = launcher.missileTypes.length;
        if (size < 2) {
            return null;
        }
        return launcher.missileTypes[(launcher.missileTypeIndex + 1) % size];
    }

    launcher.advanceMissileType = function() {
        launcher.missileTypeIndex = (launcher.missileTypeIndex + 1) % (launcher.missileTypes.length);
    }
    
    launcher.addMissileType = function(type) {
        launcher.missileTypes.push(type);
    }

    launcher.launchMissile = function (game) {
        var type = launcher.currentMissileType()
        var newMissile = game.addMissile(type,
                                         launcher,
                                         launcher.x,
                                         launcher.y,
                                         launcher.angle);
        newMissile.engineOn = true;
        launcher.missiles.push(newMissile);
    }
}

function Game() {
    this.objects = []
    this.tiles = {}
    this.turnCounter = 0;

    this.init = function(callback) {
        this.callback = callback;
        var left = 10 + Math.random() * (rows - 5);
        var right = 5 + Math.random() * (rows - 5);
        var terrain = this.generate(left, right, rows / 2);
        for (var c = 0; c < cols; c++) {
            var level = terrain[c];
            if (level >= rows - 1) {
                level = rows - 2;
            }
            for (var r = 0; r < rows; r++) {
                if (!this.tiles[r]) {
                    this.tiles[r] = {};
                }
                if (level >= r) {
                    this.tiles[r][c] = 0;
                } else {
                    this.tiles[r][c] = 1;
                }
            }
        }
        
        for (var c = 5; c < cols; c++) {
            var level1 = this.groundLevelForColumns(c, c);
            if (level1 >= this.groundLevelForColumns(c + 1, c + 1)) {
                continue;
            }
            for (var c2 = c + 1; c2 < cols - 5 && c2 < c + 20; c2++) {
                var level2 = this.groundLevelForColumns(c2, c2);
                if (level2 <= level1) {
                    if (c2 >= c + 7) {
                        this.makeLake(c, c2, level1 / cellsize);
                        c = c2;
                    }
                    break;
                }
            }
        }
    }

    this.makeLake = function(c1, c2, level) {
        for (var c = c1; c <= c2; ++c) {
            for (var r = level; r < rows; ++r) {
                if (this.tiles[r][c] == 0) {
                    this.tiles[r][c] = 2;
                }
            }
        }
    }

    this.generate = function(left, right, v) {
        var middle = this.split(left, right, v);
        if (v >= 1) {
            var m1 = this.generate(left, middle, v * 0.5);
            var m2 = this.generate(middle, right, v * 0.5);
            return m1.concat(m2);
        }
        return [left, middle, right];
    }

    this.split = function(left, right, v) {
        var r = Math.random() * v * 2 - v;
        var middle =
            Math.min(Math.max(2, (left + right) / 2 + r),
                     rows - 2);
        return middle;
    };
    
    this.groundLevelForColumns = function(min, max) {
        for (var r = 0; r < rows; r++) {
            for (var c = min; c <= max; c++) {
                var tile = this.tiles[r][c];
                if (tile == 1) {
                    for (var cc = min; cc <= max; ++cc) {
                        this.tiles[r][cc] = 1;
                    }
                    return cellsize * (r);
                }
            }
        }
    }

    this.flattenGround = function(cmin, cmax) {
        var level = rows;
        for (var c = cmin; c <= cmax; ++c) {
            for (var r = 0; r < rows; r++) {
                var tile = this.tiles[r][c];
                if (tile == 1) {
                    level = Math.min(r, level);
                }
            }
        }
        for (var c = cmin; c <= cmax; ++c) {
            for (var r = level; r < rows; r++) {
                if (this.tiles[r][c] != 1) {
                    this.tiles[r][c] = 1;
                }
            }
        }        
    }

    this.addMissile = function(type, launcher, x, y, angle) {
        var sin = Math.sin(angle);
        var cos = Math.cos(angle);
        var dx = sin * 3;
        var dy = cos * -3;
        var missile = new Missile(type, launcher, x, y, dx, dy, angle);
        return this.addObject(missile);
    };

    this.addObject = function(object) {
        this.objects.push(object);
        return object;
    };

    this.start = function(interval) {
        if (this.timer) {
            this.pause();
        }
        this.timer = setInterval(this.callback, interval);
    };

    this.pause = function() {
        clearInterval(this.timer);
        this.timer = null;
    };
    
    this.update = function() {
        if (this.gameOver) {
            return;
        }
        this.turnCounter++;
        if (this.turnCounter % 900 == 0) {
            game.addNewMissileType(this.turnCounter,
                                   [ui.left, ui.right]);
        }        
        _(this.objects).each(function(object) {
            object.update();
        });
        this.objects = _(this.objects).filter(function(object) {
            return object.exploded != true;
        });
    };

    this.draw = function (canvas, ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        _(this.objects).each(function(object) {
            object.draw(canvas, ctx);
        });

        if (this.gameOver) {
            ctx.save();
            ctx.scale(canvas.width / 300,
                      canvas.height / 300);
            ctx.font = "40px Sans";
            ctx.lineWidth = 2;
            ctx.fillStyle = "red";
            ctx.strokeStyle = "black";
            var text = "GAME OVER";
            ctx.fillText(text, 20, 33);
            ctx.strokeText(text, 20, 33);
            ctx.restore();
        }
    };

    this.addNewMissileType = function(turn, launchers) {
        var type = new MissileType();
        type.explosionScale = 1 + turn / 900;
        _(launchers).each(function (launcher) {
            launcher.addMissileType(type);
        });
        return type;
    };
}

function drawMap(game, canvas, ctx) {
    WithContext(ctx, {}, function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var r = 0; r < rows; ++r) {
            for (var c = 0; c < cols; ++c) {
                var colors = { 0: "lightblue",
                               1: "olive",
                               2: "blue",
                             }
                ctx.fillStyle=colors[game.tiles[r][c]];
                ctx.fillRect(c * cellsize, r * cellsize, cellsize, cellsize);
            }
        }
    });
}

function clamp(value, min, max) {
    if (min > max) { var tmp = min; min = max; max = tmp; }
    if (value < min) { return min }
    if (value > max) { return max }
    return value;
}

function distance_squared(a, b) {
    var xd = a.x - b.x;
    var yd = a.y - b.y;
    return xd * xd + yd * yd;
}

function distance(a, b) {
    return Math.sqrt(distance_squared(a, b));
}

function findClosest(object, list) {
    var best = null;
    var best_d = null;
    _(list).each(function (other) {
        var d = distance_squared(object, other);
        if (best == null || d < best_d) {
            best = other;
            best_d = d;
        }
    });

    return best;
}

function angleFrom(a, b) {
    return normalizeAngle(Math.atan2(a.x - b.x,
                                     b.y - a.y));
}

function normalizeAngle(angle) {
    var full = Math.PI * 2;
    while (angle < 0) {
        angle += full;
    }
    while (angle > full) {
        angle -= full;
    }
    return angle;
}

function as_row(x) {
    return Math.floor(x / cellsize);
}

function as_column(y) {
    return Math.floor(y / cellsize);
}

function row(r) {
    return r * cellsize;
}

function column(c) {
    return c * cellsize;
}

function UserInterface(game) {
    var ui = this;
    ui.game = game;

    ui.init = function(game) {
        ui.game = game;

        var map_canvas = document.getElementById("canvas-map");
        cellsize = Math.floor(Math.min(map_canvas.width / cols,
                                       map_canvas.height / rows));
        halfcell = cellsize / 2;
            
        ui.redraw = function() {
            var objects_canvas = document.getElementById("canvas-objects");
            var ctx = objects_canvas.getContext("2d");
            WithContext(ctx, {},
                        function () {
                            ui.game.draw(objects_canvas, ctx);
                        });
        };
        function updateAndDraw() {
            // Run physics N times
            for (var i = 0; i < 1; ++i) {
                game.update();
                if (ui.left.hp <= 0 ||
                    ui.right.hp <= 0) {
                    game.gameOver = true;
                    break;
                }
            }
            // Then draw the last state
            ui.redraw();
        };
        game.init(updateAndDraw);

        var leftCol = 5;
        ui.left = new Launcher(cellsize * (leftCol + 0.5),
                               game.groundLevelForColumns(leftCol - 1,
                                                          leftCol + 1),
                               Math.PI / 2);
        game.flattenGround(leftCol - 1, leftCol + 1);
        var rightCol = cols - 1 - 5;
        ui.right = new Launcher(cellsize * (rightCol + 0.5),
                                game.groundLevelForColumns(rightCol - 1,
                                                           rightCol + 1),
                                Math.PI / 2);
        game.flattenGround(rightCol - 1, rightCol + 1);
        game.addObject(ui.left);
        game.addObject(ui.right);
        for (var i = 0; i < 100; ++i) {
            var x = Math.random() * 800;
            var c = as_column(x);
            var y = game.groundLevelForColumns(c, c);
            var row = y / cellsize;
            if (game.tiles[row - 1][c] != 2) {
                var tree = new Tree(x, y);
                game.addObject(tree);
            }
        }
        drawMap(game, map_canvas,
                map_canvas.getContext("2d"));
        game.addNewMissileType(0, [ui.left, ui.right]);
        ui.redraw();
        game.start(1000/30);
    }

    this.keyup = function(event) {
        this.checkKeyUp(event, ui.left, 87, 83, 65, 68);
        this.checkKeyUp(event, ui.right, 38, 40, 37, 39);
    };

    this.checkKeyUp = function(event, launcher, up, down, left, right) {
        if (event.keyCode == up) {
            var lastMissile = launcher.missiles[launcher.missiles.length - 1];
            if (lastMissile) {
                lastMissile.turnEngineOff();
            }
        } else if (event.keyCode == right) {
            launcher.turnRight(false);
        } else if (event.keyCode == left) {
            launcher.turnLeft(false);
        }
    };

    this.keydown = function(event) {
        this.checkKeyDown(event, ui.left, 87, 83, 65, 68);
        this.checkKeyDown(event, ui.right, 38, 40, 37, 39);
    };
    
    this.checkKeyDown = function(event, launcher, up, down, left, right) {
        if (event.keyCode == up) {
            var lastMissile = launcher.missiles[launcher.missiles.length - 1];
            if (!lastMissile || !lastMissile.engineOn) {
                launcher.launchMissile(ui.game);
            }
        } else if (event.keyCode == down) {
            if (launcher.missiles.length == 0) {
                launcher.advanceMissileType();
            } else {
                _(launcher.missiles).each(function(missile) {
                    missile.explode();
                });
            }
        } else if (event.keyCode == right) {
            launcher.turnRight(true);
        } else if (event.keyCode == left) {
            launcher.turnLeft(true);
        }
    };
}

var game;
var ui;

function init(initialPlan) {
    if (game) {
        game.pause();
    }
    game = new Game();
    
    if (!ui) {
        ui = new UserInterface(game);
    }
    ui.init(game);
    return game;
}
