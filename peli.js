var cellsize = 40;
var halfcell = cellsize / 2;
var rows = 12;
var cols = 20;

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

function Missile(x, y, dx, dy) {
    var missile = this;
    missile.x = x;
    missile.y = y;
    missile.dx = dx;
    missile.dy = dy;
    missile.engineOn = false;

    missile.update = function () {
        if (missile.exploding) {
            if (missile.explodeCounter == 0) {
                missile.exploded = true;
            } else {
                missile.explodeCounter--;
            }
        } else {
            missile.x += missile.dx;
            missile.y += missile.dy;
            missile.dy += 0.05;
            if (missile.engineOn) {
                missile.dx += 0.1;
                missile.dy -= 0.1;
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
                        ctx.arc(0, 0, 1, 0, 2*Math.PI);
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
                           scale: halfcell / 10 },
                    function () {
                        ctx.beginPath();
                        ctx.arc(0, 0, 10 - missile.explodeCounter * 2,
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
};

function Launcher(x, y, angle) {
    var launcher = this;
    launcher.x = x;
    launcher.y = y;
    launcher.angle = angle;
    launcher.missiles = [];
    launcher.turningRight = false;
    launcher.turningLeft = false;

    launcher.turnRight = function(value) {
        launcher.turningRight = value;
    }
    launcher.turnLeft = function(value) {
        launcher.turningLeft = value;
    }

    launcher.draw = function(canvas, ctx) {
        WithContext(ctx, { translateX: launcher.x, translateY: launcher.y,
                           scale: halfcell / 10 },
                    function () {
                        ctx.save();
                        ctx.beginPath();
                        ctx.lineWidth = 3;
                        ctx.rotate(Math.PI + launcher.angle);
                        ctx.moveTo(0, 8);
                        ctx.lineTo(0, 17);
                        ctx.stroke();
                        ctx.restore();
                        
                        ctx.beginPath();
                        ctx.arc(0, 0, 10, 1*Math.PI, 0);
                        ctx.lineWidth = 1;
                        ctx.fillStyle = "gray";
                        ctx.strokeStyle = "black";
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                        
                    });
    };

    launcher.update = function() {
        if (launcher.turningRight) {
            launcher.angle += 0.1;
        }
        if (launcher.turningLeft) {
            launcher.angle -= 0.1;
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
}

function Game() {
    this.objects = []

    this.init = function(callback) {
        this.callback = callback;
    }

    this.addMissile = function(x, y, angle) {
        var sin = Math.asin(angle);
        var cos = Math.acos(angle);
        var tan = Math.atan(angle);
        console.log(angle, sin, cos, tan);
        var dx = sin * 5;
        var dy = cos * -5;
        var missile = new Missile(30, 400, dx, dy);
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
    };
}

function drawMap(canvas, ctx) {
    WithContext(ctx, {}, function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var r = 0; r < rows; ++r) {
            for (var c = 0; c < cols; ++c) {
                var colors = { 0: "darkgreen",
                               2: "red",
                               3: "lightblue",
                               10: "yellow",
                               11: "lightgray",
                               12: "olive",
                               13: "gray",
                             }
                ctx.fillStyle=colors[game.tiles[r][c]];
                ctx.fillRect(c * cellsize - halfcell, r * cellsize - halfcell,
                             cellsize, cellsize);
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
        ui.game.start(50);
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
        ui.left = new Launcher(30, 400, 0.3);
        ui.right = new Launcher(600, 400, 1.6);
        ui.game = game;
        game.addObject(ui.left);
        game.addObject(ui.right);
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
                    if (game.gameover) {
                        break;
                    }
                }
                ui.redraw();
            };
            game.init(updateAndDraw);
            ui.redraw();
            ui.pause();
        });
        ui.unpause();
    }

    this.keyup = function(event) {
        if (event.keyCode == 87) {
            var lastMissile = ui.left.missiles[ui.left.missiles.length - 1];
            if (lastMissile) {
                lastMissile.engineOn = false;
            }
        } else if (event.keyCode == 68) {
            ui.left.turnRight(false);
        } else if (event.keyCode == 65) {
            ui.left.turnLeft(false);
        }
    };

    this.keydown = function(event) {
        if (event.keyCode == 87) {
            var lastMissile = ui.left.missiles[ui.left.missiles.length - 1];
            if (!lastMissile || !lastMissile.engineOn) {
                var newMissile = ui.game.addMissile(30, 400, ui.left.angle);
                newMissile.engineOn = true;
                ui.left.missiles.push(newMissile);
            }
        } else if (event.keyCode == 83) {
            console.log(ui.left.missiles);
            _(ui.left.missiles).each(function(missile) {
                missile.explode();
            });
        } else if (event.keyCode == 68) {
            ui.left.turnRight(true);
        } else if (event.keyCode == 65) {
            ui.left.turnLeft(true);
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
