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
                        ctx.lineWidth = 1;
                        ctx.fillStyle = "black";
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

function Game() {
    this.missile = []

    this.init = function(callback) {
        this.callback = callback;
    }

    this.addMissile = function() {
        var missile = new Missile(30, 400, 2, -4);
        this.missile.push(missile);
        return missile;
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
        _(this.missile).each(function(missile) {
            missile.update();
        });
        this.missile = _(this.missile).filter(function(missile) {
            return missile.exploded != true;
        });
    };

    this.draw = function (canvas, ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        _(this.missile).each(function(missile) {
            missile.draw(canvas, ctx);
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
        ui.left = { missiles: [] };
        ui.right = { missiles: [] };
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
                WithContext(ctx, { translateX: halfcell,
                                   translateY: halfcell },
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

    this.keydown = function(event) {
        if (event.keyCode == 87) {
            ui.left.missiles.push(ui.game.addMissile(30, 400, 4, 4));
        } else if (event.keyCode == 83) {
            console.log(ui.left.missiles);
            _(ui.left.missiles).each(function(missile) {
                missile.explode();
            });
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
