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

function Missile(x, y, dx, dy, angle) {
    var missile = this;
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
                missile.size = (10 - missile.explodeCounter * 2) * game.explosionScale;
            }
            if (missile.exploded) {
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
                missile.dx += 0.1 * Math.sin(missile.launchAngle);
                missile.dy -= 0.1 * Math.cos(missile.launchAngle);
            }
            if (missile.x <= 0 ||
                missile.x >= 800) {
                missile.exploded = true;
            } else if (missile.y >= 480) {
                missile.explode();
            } else {
                var row = Math.floor(missile.y / cellsize);
                var col = Math.floor(missile.x / cellsize);
                if (row > 0 && col > 0 && row < rows && col < cols &&
                    game.tiles[row][col] == 1) {
                    missile.explode();
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
        WithContext(ctx, { translateX: missile.x, translateY: missile.y,
                           scale: halfcell / 10 },
                    function () {
                        ctx.beginPath();
                        ctx.arc(0, 0, 3, 0, 2*Math.PI);
                        ctx.lineWidth = .1;
                        if (missile.engineOn) {
                            ctx.fillStyle = "red";
                        } else {
                            ctx.fillStyle = "black";
                        }
                        ctx.strokeStyle = "blue";
                        ctx.fill();
                        ctx.stroke();
                        ctx.closePath();
                    });
    }
    missile.drawExploding = function(canvas, ctx) {
        WithContext(ctx, { translateX: missile.x, translateY: missile.y,
                           scale: halfcell / 5 },
                    function () {
                        ctx.beginPath();
                        ctx.arc(0, 0,
                                (10 - missile.explodeCounter * 2) * game.explosionScale,
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
        missile.exploding = true;
        missile.explodeCounter = 5;
    };

    missile.hit = function() {
        missile.explode();
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
    launcher.hp = 10;

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
                        ctx.lineTo(-15 + 30 * (launcher.hp / 10), 4);
                        ctx.strokeStyle = "blue";
                        ctx.stroke();
                        ctx.restore();

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

}

function Game() {
    this.objects = []
    this.tiles = {}
    this.explosionScale = 1;
    this.turnCounter = 0;

    this.init = function(callback) {
        this.callback = callback;
        var level = rows - 2;
        for (var c = 0; c < cols; c++) {
            var r = Math.random() * 3;
            var change = Math.round(r - 1.5);
            level += change;
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
    }

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

    this.addMissile = function(x, y, angle) {
        var sin = Math.sin(angle);
        var cos = Math.cos(angle);
        var dx = sin * 3;
        var dy = cos * -3;
        var missile = new Missile(x, y, dx, dy, angle);
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
            this.explosionScale++;
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
        drawMap(this, canvas, ctx);
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
}

function drawMap(game, canvas, ctx) {
    WithContext(ctx, {}, function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var r = 0; r < rows; ++r) {
            for (var c = 0; c < cols; ++c) {
                var colors = { 0: "lightblue",
                               1: "olive",
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
    ui.paused = false;
    ui.speed = 1;

    ui.togglePause = function() {
        if (ui.paused) {
            ui.unpause();
        } else {
            ui.pause();
        }
    }

    ui.pause = function() {
        ui.game.pause();
        $('#pause').text("Unpause");
        ui.paused = true;
    }

    ui.unpause = function() {
        ui.game.start(1000/30);
        $('#pause').text("Pause");
        ui.paused = false;
    }

    ui.restart = function() {
        ui.game.pause();
        init(_(ui.game.plan.commands).map(function(record) {
            return record.command;
        }));
    }

    ui.reset = function() {
        ui.game.pause();
        init();
    }

    ui.changeSpeed = function() {
        var value = parseInt($('#speed').val());
        var speeds = {
            1: 1,
            2: 2,
            3: 5,
            4: 100,
            5: 1000,
            6: 10000,
        };
        ui.speed = speeds[value];
    }

    ui.init = function(game) {
        if (ui.game) {
            ui.game.pause();
        }
        ui.game = game;
        $('#main').each(function (index, canvas) {
            if (!canvas.getContext) {
                return;
            }
            var ctx = canvas.getContext("2d");

            cellsize = Math.floor(Math.min(canvas.width / cols,
                                           canvas.height / rows));
            halfcell = cellsize / 2;
            
            $(canvas).on('click', function (event) {
                mapClickHandler(event);
            });
            
            ui.redraw = function() {
                // Then draw the last state
                WithContext(ctx, {},
                            function () {
                                ui.game.draw(canvas, ctx);
                            });
            };
            function updateAndDraw() {
                // Run physics N times depending on speed setting
                for (var i = 0; i < ui.speed; ++i) {
                    game.update();
                    if (ui.left.hp <= 0 ||
                        ui.right.hp <= 0) {
                        game.gameOver = true;
                        break;
                    }
                }
                ui.redraw();
            };
            game.init(updateAndDraw);
            ui.left = new Launcher(cellsize * 5.5,
                                   game.groundLevelForColumns(4, 6),
                                   0.3);
            ui.right = new Launcher(cellsize * 75.5,
                                    game.groundLevelForColumns(74, 76),
                                    1.6);
            game.addObject(ui.left);
            game.addObject(ui.right);
            ui.redraw();
            ui.pause();
        });
        ui.unpause();
    }

    this.keyup = function(event) {
        this.checkKeyUp(event, ui.left, 87, 83, 65, 68);
        this.checkKeyUp(event, ui.right, 38, 40, 37, 39);
    };

    this.checkKeyUp = function(event, launcher, up, down, left, right) {
        if (event.keyCode == up) {
            var lastMissile = launcher.missiles[launcher.missiles.length - 1];
            if (lastMissile) {
                lastMissile.engineOn = false;
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
                var newMissile = ui.game.addMissile(launcher.x,
                                                    launcher.y,
                                                    launcher.angle);
                newMissile.engineOn = true;
                launcher.missiles.push(newMissile);
            }
        } else if (event.keyCode == down) {
            _(launcher.missiles).each(function(missile) {
                missile.explode();
            });
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
