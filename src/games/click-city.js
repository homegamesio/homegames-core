let { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const Asset = require('../common/Asset');
console.log("hello!!!!!");

let randomColor = Colors.randomColor;
Colors = Colors.COLORS;

class ClickCity extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            tickRate: 10
        };
    }

    constructor() {
        super();

        this.atkPow = 10;
        this.score = 10000;
        this.critChance = .01;
        this.clicks = 0;
        this.kills = 0;

        this.base = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: Colors.WHITE
            }
        );

        this.menu = new GameNode.Shape(
            [174, 67, 232, 255],
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 20),
                fill: [174, 67, 232, 255] 
            }
        );

        this.cityButton = new GameNode.Shape(
            Colors.HG_BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(70, 6, 10, 8),
                fill: Colors.HG_BLUE
            },
            null,
            (player) => {
                this.playerStates[player.id] = {
                    view: 'city'
                };
                this.updatePlayerView(player.id);
            }
        );

        const cityButtonText = new GameNode.Text({
            text: 'City',
            x: 75,
            y: 8.5,
            align: 'center',
            color: Colors.WHITE,
            size: 2
        });

        this.cityButton.addChild(cityButtonText);

        this.clickerButton = new GameNode.Shape(
            Colors.HG_RED,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(85, 6, 10, 8),
                fill: Colors.HG_RED
            }, 
            null,
            (player) => {
                this.playerStates[player.id] = {
                    view: 'clicker'
                };
                this.updatePlayerView(player.id);
            }
        );

        this.clickerStats = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(85, 30, 12.5, 60),
                fill: Colors.HG_YELLOW
            }
        );

        const clickerStatsText = new GameNode.Text({
            text: 'Stats',
            x: 91.2,
            y: 24.5,
            align: 'center',
            color: Colors.WHITE,
            size: 3
        });

        const clickerButtonText = new GameNode.Text({
            text: 'Clicker',
            x: 90,
            y: 8.5,
            align: 'center',
            color: Colors.WHITE,
            size: 2
        });

        this.clickerButton.addChild(clickerButtonText);

        this.clickerRoot = new GameNode.Shape(
            Colors.HG_RED,
            Shapes.POLGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 20, 100, 80),
                fill: Colors.HG_RED
            },
            [0]
        );
        this.clickerRoot.addChildren(this.clickerStats, clickerStatsText);

        this.cityRoot = new GameNode.Shape(
            Colors.HG_BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 20, 100, 80),
                fill: Colors.HG_BLUE
            },
            [0]
        );

        this.scoreNode = new GameNode.Text({
            text: this.score + '',
            align: 'center',
            x: 50, 
            y: 6,
            color: Colors.HG_YELLOW,
            size: 5
        });

        this.menu.addChildren(this.cityButton, this.clickerButton, this.scoreNode);

        this.base.addChild(this.menu);
        this.base.addChild(this.clickerRoot);
        this.base.addChild(this.cityRoot);
        
        this.initClickerMenu();

        this.playerStates = {};
        this.gameStates = {
            'clicker': {
                'automaters': {}
            },
            'city': {
                'buildings': {}
            }
        };

        this.timedEvents = {};
    }

    updateClickerStats() {
        this.clickerStats.node.clearChildren();
        let yCoord = 35;
        this.statsNodes = {
            clicks: this.clicks,
            kills: this.kills,
            atkPow: this.atkPow,
            critChance: Math.floor(this.critChance * 100) + '%'
        };

        for (const key in this.statsNodes) {
            const textNode = new GameNode.Text({
                text: key + ': ' + this.statsNodes[key],
                x: 86,
                y: yCoord,
                size: 1,
                color: Colors.BLACK
            });

            this.clickerStats.addChild(textNode);
            yCoord += 6;
        }
    }

    initClickerMenu() {
        const upgradeMenu = new GameNode.Shape(
            [175, 255, 163, 255],
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(1, 21, 10, 78),
                fill: [175, 255, 163, 255]
            }
        );

        const upgradeAtk = new GameNode.Shape(
            Colors.BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(2, 22, 8, 8),
                fill: Colors.BLACK
            },
            null,
            (player) => {
                if (this.score >= 100) {
                    this.atkPow += 10;
                    this.addScore(-100);
                }
            }
        );

        const upgradeAtkText = new GameNode.Text({
            text: 'Attack power',
            x: 6,
            y: 25,
            align: 'center',
            color: Colors.WHITE,
            size: 1
        });

        upgradeAtk.addChild(upgradeAtkText);

        const addAutoClicker = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(2, 32, 8, 8),
                fill: Colors.WHITE
            },
            null,
            (player) => {
                if (this.score >= 1000) {
                    this.addScore(-1000);
                    if (!this.gameStates.clicker.automaters['auto-clicker']) {
                        this.gameStates.clicker.automaters['auto-clicker'] = {
                            state: 'idle',
                            interval: 2500,
                            onTrigger: () => {
                                this.attack(this.gameStates.clicker.dude, 5 * this.gameStates.clicker.automaters['auto-clicker'].count);
                            },
                            count: 0
                        };
                    }
                    this.gameStates.clicker.automaters['auto-clicker'].count++;
                }
            }
        );

        const autoClickerText = new GameNode.Text({
            text: "Auto Clicker",
            x: 6,
            y: 35,
            color: Colors.BLACK,
            size: 1,
            align: 'center'
        }); 

        const upgradeCrit = new GameNode.Shape(
            Colors.ORANGE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(2, 42, 8, 8),
                fill: Colors.ORANGE
            },
            null,
            (player) => {
                if (this.score >= 1000) {
                    this.addScore(-1000);
                    this.critChance += 0.01;
                }
            }
        );

        const upgradeCritText = new GameNode.Text({
            text: "Upgrade crit",
            x: 6,
            y: 45,
            color: Colors.WHITE,
            size: 1,
            align: 'center'
        });

        upgradeCrit.addChild(upgradeCritText);

        addAutoClicker.addChild(autoClickerText);
        
        upgradeMenu.addChild(addAutoClicker);
        upgradeMenu.addChild(upgradeAtk);
        upgradeMenu.addChild(upgradeCrit);

        this.clickerRoot.addChildren(upgradeMenu);
    }

    addScore(points) {
        this.score += points;
        const newText = this.scoreNode.node.text;
        newText.text = this.score + '';
        this.scoreNode.node.text = newText;

        this.scoreNode.clearChildren();

        const sign = points > 0 ? '+' : '-';

        const scoreChangeNode = new GameNode.Text({
            text: sign + Math.abs(points),
            size: 2,
            x: 50,
            y: 15,
            align: 'center',
            color: Colors.WHITE
        });

        this.scoreNode.addChild(scoreChangeNode);
        setTimeout(() => {
            this.scoreNode.node.removeChild(scoreChangeNode.node.id);
        }, 750)
    }

    showDamage(num) {
        let quads = [];
        const getQuad = (xMin, xMax, yMin, yMax) => {
            return [xMin, xMax, yMin, yMax];
        };

        // right bar
        quads.push(getQuad(65, 75, 30, 60));

        // bottom bar
        quads.push(getQuad(25, 65, 65, 75)); 

        // left bar
        quads.push(getQuad(25, 35, 30, 60));

        // top bar
        quads.push(getQuad(25, 65, 30, 40)); 

        const ran = 100 * Math.random();
        const quadIndex = Math.floor(ran % quads.length);

        const quad = quads[quadIndex]

        const randomX = quad[0] + Math.floor((100 * Math.random()) % (quad[1] - quad[0]));
        const randomY = quad[2] + Math.floor((100 * Math.random()) % (quad[3] - quad[2]));

        const dmgText = new GameNode.Text({
            text: '-' + num,
            x: randomX,
            y: randomY,
            size: 2,
            align: 'center',
            color: Colors.BLACK
        });
        this.clickerRoot.addChild(dmgText);
        setTimeout(() => {
            this.clickerRoot.removeChild(dmgText.node.id);
        }, 500);
    }

    attack(thing, atkPow) {
        thing.health -= atkPow;
        this.showDamage(atkPow);
        if (thing.health <= 0) {
            this.kills += 1;
            this.clickerRoot.removeChild(thing.node.id);
            this.gameStates['clicker'].dude = null;
            this.addScore(thing.points);
        }
    }

    spawnEnemy(enemyType) {
        if (enemyType == 'dude1') {
            const thing = {
                points: 420,
                node: new GameNode.Asset(
                    () => {
                        this.clicks += 1;
                        const critRoll = Math.random();
                        const isCrit = critRoll <= this.critChance;
                        const atkPow = isCrit ? 3 * this.atkPow : this.atkPow;
                        this.attack(thing, atkPow);
                    },
                    ShapeUtils.rectangle(40, 40, 20, 20),
                    {
                        'triangle-dude': {
                            pos: {
                                x: 40,
                                y: 40
                            },
                            size: {
                                x: 20,
                                y: 20
                            }
                        }
                    }
                ),
                health: 400,
                attack: 2,
                attackRate: .2
            };
            
            this.gameStates['clicker'].dude = thing;
            this.clickerRoot.addChild(thing.node);
        } else if (enemyType == 'dude2') {
            const thing = {
                points: 200,
                node: new GameNode.Asset(
                    () => {
                        this.clicks += 1;
                        const critRoll = Math.random();
                        const isCrit = critRoll <= this.critChance;
                        const atkPow = isCrit ? 3 * this.atkPow : this.atkPow;
                        this.attack(thing, atkPow);
                    },
                    ShapeUtils.rectangle(40, 40, 20, 20),
                    {
                        'hexagon-dude': {
                            pos: {
                                x: 40,
                                y: 40
                            },
                            size: {
                                x: 20,
                                y: 20
                            }
                        }
                    }
                ),
                health: 200,
                attack: 2,
                attackRate: .2
            }
            this.gameStates['clicker'].dude = thing;
            this.clickerRoot.addChild(thing.node);
        }
    }

    tick() {
        this.updateClickerStats();
        if (!this.gameStates['clicker'].dude) {
            const ran = Math.random();
            const enemyType = ran > .5 ? 'dude1' : 'dude2';
            this.spawnEnemy(enemyType);
        } 

        for (const automaterKey in this.gameStates.clicker['automaters']) {
            const automater = this.gameStates.clicker['automaters'][automaterKey];
            const timeToCheck = Date.now() + automater.interval;
            if (automater.state === 'idle') {
                automater.state = 'working'
                if (!this.timedEvents[timeToCheck]) {
                    this.timedEvents[timeToCheck] = [];
                }
                this.timedEvents[timeToCheck].push(automater);
            }
            if (!this.gameStates.city['buildings'][automaterKey]) {
                const buildingColor = Colors.BLACK;//randomColor();
                this.gameStates.city['buildings'][automaterKey] = new GameNode.Shape(
                    buildingColor,
                    Shapes.POLYGON,
                    {
                        coordinates2d: ShapeUtils.rectangle(20, 30, 10, 10),
                        fill: buildingColor
                    },
                    this.cityRoot.node.playerIds
                );

                const buildingLabel = new GameNode.Text({
                    text: automaterKey,
                    size: 2,
                    x: 25,
                    y: 42,
                    align: 'center',
                    color: Colors.BLACK
                });
                this.cityRoot.addChild(buildingLabel);
//                this.gameStates.city['buildings'][automaterKey].addChild(buildingLabel);
                this.cityRoot.addChild(this.gameStates.city['buildings'][automaterKey]);
            } 
        }
        // TODO: FIX THIS PLS
        for (const nodeIndex in this.cityRoot.node.children) {
            this.cityRoot.node.children[nodeIndex].node.playerIds = this.cityRoot.node.playerIds;
        }

        for (const nodeIndex in this.clickerRoot.node.children) {
            this.clickerRoot.node.children[nodeIndex].node.playerIds = this.clickerRoot.node.playerIds;
        }

        let toRemove = [];
        for (const timestamp in this.timedEvents) {
            if (timestamp <= Date.now()) {
                toRemove.push(timestamp);        
            }
        }

        for (const timestampIndex in toRemove) {
            const timestamp = toRemove[timestampIndex];
            for (const funcIndex in this.timedEvents[timestamp]) {
                this.timedEvents[timestamp][funcIndex].onTrigger();
                this.timedEvents[timestamp][funcIndex].state = 'idle';
            }
            delete this.timedEvents[timestamp];
        }
    }

    getRoot() {
        return this.base;
    }

    updatePlayerView(playerId) {
        for (let playerId in this.playerStates) {
            if (this.playerStates[playerId].view == 'clicker') {
                if (!this.playerStates[playerId].realView || this.playerStates[playerId].realView !== 'clicker') {
                    const playerIdCityIndex = this.cityRoot.node.playerIds.indexOf(playerId);
                    if (playerIdCityIndex >= 0) {
                        let newPlayerIds = this.cityRoot.node.playerIds;
                        newPlayerIds.splice(playerIdCityIndex, 1);
                        if (newPlayerIds.length === 0) {
                            newPlayerIds = [0];
                        }
                        this.cityRoot.node.playerIds = newPlayerIds;
                    }

                    this.playerStates[playerId].realView = 'clicker';
                    if (this.clickerRoot.node.playerIds[0] === 0) {
                        this.clickerRoot.node.playerIds.splice(0, 1);
                    }
                    this.clickerRoot.node.playerIds.push(playerId);
                    // hack to invoke update listener
                    this.clickerRoot.node.playerIds = this.clickerRoot.node.playerIds;
                } 
            }
            else if (this.playerStates[playerId].view == 'city') {
                if (!this.playerStates[playerId].realView || this.playerStates[playerId].realView !== 'city') {
                    const playerIdClickerIndex = this.clickerRoot.node.playerIds.indexOf(playerId);
                    if (playerIdClickerIndex >= 0) {
                        let newPlayerIds = this.clickerRoot.node.playerIds;
                        newPlayerIds.splice(playerIdClickerIndex, 1);
                        if (newPlayerIds.length === 0) {
                            newPlayerIds = [0];
                        }

                        this.clickerRoot.node.playerIds = newPlayerIds;
                    }

                    if (this.cityRoot.node.playerIds[0] === 0) {
                        this.cityRoot.node.playerIds.splice(0, 1);
                    }

                    this.playerStates[playerId].realView = 'city';
                    this.cityRoot.node.playerIds.push(playerId);
                    // hack to invoke update listener
                    this.cityRoot.node.playerIds = this.cityRoot.node.playerIds;
                }
            }

        }
    }

    handleNewPlayer(player) {
        this.playerStates[player.id] = {
            view: 'clicker'
        };
        this.updatePlayerView(player.id);
    }

    getAssets() {
        return {
            'triangle-dude': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/triangle.png',
                'type': 'image'
            }),
            'hexagon-dude': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/hexagon.png',
                'type': 'image'
            })
        }
    }

}

module.exports = ClickCity;
