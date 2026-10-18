const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { questions } = require('./questions');
const { WHITE, BLACK } = Colors.COLORS;
const MAX_POINTS_PER_STROKE = 55;
const MAX_POINTS_PER_FRAME = 600;
const MAX_STROKES_PER_FRAME = 32;
const STROKE_LINK_MS = 400;
const MIN_POINT_DIST = 0.25;
const ASPECT = 2 / 3;
const PEN_WIDTH = 2;
const CREATOR_CANVAS = { x: 5, y: 15, w: 90, h: 60 };
const MAX_PHRASE_LENGTH = 60;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

class Hangman extends Game {
    static metadata() {
        return {
            name: 'Hangman',
            description: 'Classic hangman',
            aspectRatio: {x: 2, y: 3},
            author: "Joseph Garcia",
            thumbnail: './assets/thumbnail.png',
            tickRate: 60,
            assets: {
                'amateur': new Asset({
                    'type': 'font',
                    path: "./assets/026a26ef0dd340681f62565eb5bf08fb.bin"
                }),
                'heavy-amateur': new Asset({
                    'type': 'font',
                    path: "./assets/9f11fac62df9c1559f6bd32de1382c20.bin"
                }), 
                'hangman_0': new Asset({
                    'type': 'image',
                    path: "./assets/f5c92180db47539d4a92ee947b137aae.png"
                }),
                'hangman_1': new Asset({
                    'type': 'image',
                    path: "./assets/6e89789a60d9cc55c490eee96b0a8bfe.png"
                }),
                'hangman_2': new Asset({
                    'type': 'image',
                    path: "./assets/413d6a8e94bdb81bac8cc02debbe0c11.png"
                }),
                'hangman_3': new Asset({
                    'type': 'image',
                    path: "./assets/a816e4b84ae74df580c7b93c15e2f2ae.png"
                }),
                'hangman_4': new Asset({
                    'type': 'image',
                    path: "./assets/af52c4ad108055ec0099d9246bc04516.png"
                }),
                'hangman_5': new Asset({
                    'type': 'image',
                    path: "./assets/59d08314d9184f8e3f1b54bd65b230a9.png"
                }),
                'strikethrough_0': new Asset({
                    'type': 'image',
                    path: "./assets/bf83d4c187d7f997c5a93547150482b8.png"
                }),
                'strikethrough_1': new Asset({
                    'type': 'image',
                    path: "./assets/433ebba7ceea900df41e825fe6445fe5.png"
                }),
                'strikethrough_2': new Asset({
                    'type': 'image',
                    path: "./assets/25fa2a38b52580789082a224a66f3ad7.png"
                }),
                'scribbles_1': new Asset({
                    'type': 'audio',
                    path: "./assets/28f764486fc2e5d6747d0d7a872cc760.mp3"
                }),
                'scribbles_2': new Asset({
                    'type': 'audio',
                    path: "./assets/ec68b3be88ba9d892ff29103385fd401.mp3"
                }),
                'scribbles_3': new Asset({
                    'type': 'audio',
                    path: "./assets/baf78f36dcd7a49390e77e88738e7203.mp3"
                })
            },
            gameId: "1494ecd3-d322-5f69-ae07-f331bfde9303",
            maxPlayers: 8
        };
    }


    constructor() {
        super();
        this.players = {};
        this.overrideRoots = {};
        this.customHangmen = {};
        this.needsMouseUp = {};
        this.creatorMouseUps = {};
        this.playerIndex = 0;
        this.playerOrder = [];
        this.base = this.shape(0,0,100,100,WHITE);
        this.gameBase = this.shape();
        this.soundRoot = this.shape();
        this.playerOverrideRoot = this.shape();
        this.base.addChildren(this.gameBase,this.playerOverrideRoot,this.soundRoot);
        this.layers = [{root:this.base}];
    }

    shape(x=0,y=0,w=0,h=0,fill) {
        return new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(x,y,w,h),fill});
    }

    label(text,x,y,size=4,align='center',color=BLACK,font='amateur') {
        return new GameNode.Text({textInfo:{text,x,y,size,align,color,font}});
    }

    button(text,x,y,w,h,onClick,size=4) {
        const n=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(x,y,w,h),fill:BLACK,onClick});
        n.addChild(this.label(text,x+w/2,y+h/2-size/3,size,'center',WHITE,'heavy-amateur'));
        return n;
    }

    takePress(playerId) {
        if (!this.players[playerId] || this.needsMouseUp[playerId]) return false;
        this.needsMouseUp[playerId]=true;
        return true;
    }

    playerName(id) {
        const name=this.players[id]?.info?.name || 'Player';
        return name.length > 22 ? name.slice(0,21)+'…' : name;
    }

    showHangmanOptions(playerId) {
        const owner=this.players[playerId];
        if (!owner || owner.ready) return;
        if (this.overrideRoots[playerId]) this.playerOverrideRoot.removeChild(this.overrideRoots[playerId].id);
        const root=this.shape(0,0,100,100,WHITE);root.node.playerIds=[playerId];
        root.addChildren(
            this.button('Play',15,20,70,20,id => {if(this.players[id]===owner)this.activatePlayer(id);}),
            this.button('Draw your own',15,60,70,20,id => {
                if(this.players[id]!==owner || owner.ready || !this.takePress(id))return;
                root.clearChildren();root.addChild(this.hangmanCreator(id));
            }),
            this.label('or',50,47,8)
        );
        this.overrideRoots[playerId]=root;
        this.playerOverrideRoot.addChild(root);
    }

    handleNewPlayer({playerId,info={}}) {
        if (!Number.isSafeInteger(playerId) || playerId<1 || this.players[playerId] || Object.keys(this.players).length>=8) return;
        this.players[playerId]={playerId,ready:false,correctGuesses:0,incorrectGuesses:0,kills:0,
            info:{name:typeof info.name==='string' && info.name.trim() ? info.name.trim().slice(0,80) : `Player ${playerId}`}};
        this.showHangmanOptions(playerId);
    }

    activatePlayer(playerId) {
        const p=this.players[playerId];
        if (!p || p.ready) return;
        p.ready=true;
        delete this.creatorMouseUps[playerId];
        if(this.overrideRoots[playerId])this.playerOverrideRoot.removeChild(this.overrideRoots[playerId].id);
        delete this.overrideRoots[playerId];
        this.playerOrder.push(String(playerId));
        if (!this.currentRound) this.startNextRound();
        else if(this.currentRound.player != playerId && !this.currentRound.guessers.includes(String(playerId)))this.currentRound.guessers.push(String(playerId));
    }

    handlePlayerDisconnect(playerId) {
        if (!this.players[playerId]) return;
        if(this.overrideRoots[playerId])this.playerOverrideRoot.removeChild(this.overrideRoots[playerId].id);
        for(const map of [this.players,this.overrideRoots,this.customHangmen,this.needsMouseUp,this.creatorMouseUps])delete map[playerId];
        this.playerOrder=this.playerOrder.filter(id=>id!=playerId);
        const round=this.currentRound;
        if(round) round.guessers=round.guessers.filter(id=>id!=playerId);
        if(!this.readyPlayers().length) {
            this.clearRound();this.currentRound=null;
        } else if(round && ['choosing','playing'].includes(round.phase) &&
            (round.player==playerId || !round.guessers.length)) {
            this.clearRound();this.currentRound=null;this.startNextRound();
        } else if(round?.phase==='scores')this.renderScores();
    }

    readyPlayers() { return Object.keys(this.players).filter(id=>this.players[id].ready); }
    getLayers() { return this.layers; }

    handleMouseUp(playerId) {
        if(!this.players[playerId])return;
        this.needsMouseUp[playerId]=false;
        this.creatorMouseUps[playerId]?.();
    }

    handleKeyDown(playerId,key) {
        if(typeof key==='string' && /^[a-z]$/i.test(key))this.guess(playerId,key);
    }

    hangmanCreator(playerId) {
        const container = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        const canvasContainer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(4, 14, 92, 62),
            fill: BLACK
        });

        let currentStep = 0;
        const owner = this.players[playerId];
        const isActive = () => this.players[playerId] === owner && !owner.ready && this.creatorMouseUps[playerId];

        const frameStrokes = { 0: [] };
        let activeStroke = null;
        let lastStrokeAt = 0;

        const startStroke = (x, y) => {
            if (frameStrokes[currentStep].length >= MAX_STROKES_PER_FRAME) {
                status.node.text.text = 'Frame full: Undo, Clear or Next';
                status.node.onStateChange();
                return null;
            }
            const stroke = { points: [[x, y]], thickness: PEN_WIDTH, node: null };
            frameStrokes[currentStep].push(stroke);
            return stroke;
        };

        const drawStroke = (x, y) => {
            if (!isActive() || !Number.isFinite(x) || !Number.isFinite(y)) return;
            if (frameStrokes[currentStep].reduce((sum,s) => sum+s.points.length,0) >= MAX_POINTS_PER_FRAME) {
                status.node.text.text = 'Frame full: Undo, Clear or Next';
                status.node.onStateChange();
                return;
            }
            const halfX = PEN_WIDTH / 2;
            const halfY = halfX * ASPECT;
            const cx = Math.max(CREATOR_CANVAS.x + halfX, Math.min(CREATOR_CANVAS.x + CREATOR_CANVAS.w - halfX, x));
            const cy = Math.max(CREATOR_CANVAS.y + halfY, Math.min(CREATOR_CANVAS.y + CREATOR_CANVAS.h - halfY, y));

            const now = Date.now();
            const linked = activeStroke && (now - lastStrokeAt) < STROKE_LINK_MS;
            lastStrokeAt = now;

            if (linked) {
                const last = activeStroke.points[activeStroke.points.length - 1];
                if (Math.hypot(cx - last[0], (cy - last[1]) / ASPECT) < MIN_POINT_DIST) {
                    return;
                }
                if (activeStroke.points.length >= MAX_POINTS_PER_STROKE) {
                    if (frameStrokes[currentStep].reduce((sum,s) => sum+s.points.length,0) > MAX_POINTS_PER_FRAME-2) return;
                    // Chain a new stroke starting where the full one ended so the line stays continuous
                    activeStroke = startStroke(last[0], last[1]);
                }
                if (!activeStroke) return;
                activeStroke.points.push([cx, cy]);
            } else {
                activeStroke = startStroke(cx, cy);
            }

            if (!activeStroke) return;
            if (activeStroke.node) {
                activeStroke.node.node.coordinates2d = this.buildStrokeCoordinates(activeStroke.points, activeStroke.thickness);
                activeStroke.node.node.onStateChange();
            } else {
                activeStroke.node = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    fill: BLACK,
                    coordinates2d: this.buildStrokeCoordinates(activeStroke.points, activeStroke.thickness)
                });
                canvas.addChild(activeStroke.node);
            }
        };

        const canvas = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: WHITE,
            coordinates2d: ShapeUtils.rectangle(CREATOR_CANVAS.x, CREATOR_CANVAS.y, CREATOR_CANVAS.w, CREATOR_CANVAS.h),
            onClick: (_, x, y) => drawStroke(x, y)
        });
        // Squish 1.5 sends movement during a held press to onDrag.
        canvas.node.onDrag = (_, x, y) => drawStroke(x, y);
        canvas.node.offClick = () => { activeStroke = null; };

        canvasContainer.addChild(canvas);

        this.creatorMouseUps[playerId] = () => {
            activeStroke = null;
        };

        const currentTextLabel = new GameNode.Text({
            textInfo: {
                x: 50,
                y: 5,
                text: `Frame ${currentStep + 1} of 6`,
                color: BLACK,
                size: 5,
                align: 'center',
                font: 'heavy-amateur'
            }
        });

        const doneText = new GameNode.Text({
            textInfo: {
                x: 83,
                y: 85,
                font: 'heavy-amateur',
                text: 'Next',
                color: WHITE,
                size: 4,
                align: 'center'
            }
        });

        const doneButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: BLACK,
            coordinates2d: ShapeUtils.rectangle(70, 82, 26, 10),
            onClick: () => {
                if (isActive() && !this.needsMouseUp[playerId]) {
                    this.needsMouseUp[playerId] = true;
                    activeStroke = null;
                    if (currentStep === 5) {
                        // Store plain stroke data; the render nodes stay behind in the creator
                        const frames = {};
                        Object.keys(frameStrokes).forEach(step => {
                            frames[step] = frameStrokes[step].map(s => ({ points: s.points, thickness: s.thickness }));
                        });
                        this.customHangmen[playerId] = frames;
                        delete this.creatorMouseUps[playerId];
                        this.activatePlayer(playerId);
                    } else {
                        currentStep += 1;
                        frameStrokes[currentStep] = [];
                        const newText = Object.assign({}, currentTextLabel.node.text);
                        newText.text = `Frame ${currentStep + 1} of 6`;
                        currentTextLabel.node.text = newText;
                        currentTextLabel.node.onStateChange();
                        doneText.node.text.text = currentStep === 5 ? 'Done' : 'Next';
                        status.node.text.text = '';
                        status.node.onStateChange();
                        doneText.node.onStateChange();
                    }
                }
            }
        });

        doneButton.addChild(doneText);

        const status = this.label('',50,77,2.8);
        const undo = this.button('Undo',4,82,26,10,id => {
            if (!isActive() || !this.takePress(id)) return;
            activeStroke = null;
            const removed = frameStrokes[currentStep].pop();
            if (removed?.node) canvas.removeChild(removed.node.id);
            status.node.text.text = '';status.node.onStateChange();
        });
        const clear = this.button('Clear',37,82,26,10,id => {
            if (!isActive() || !this.takePress(id)) return;
            activeStroke = null;
            for (const s of frameStrokes[currentStep]) if(s.node) canvas.removeChild(s.node.id);
            frameStrokes[currentStep] = [];
            status.node.text.text = '';status.node.onStateChange();
        });
        const cancel = this.button('Use original',25,93,50,7,id => {
            if (!isActive() || !this.takePress(id)) return;
            delete this.customHangmen[playerId];this.activatePlayer(playerId);
        },3);
        container.addChildren(canvasContainer, currentTextLabel, doneButton, undo, clear, cancel, status);

        return container;
    }

    buildStrokeCoordinates(points, thickness) {
        const half = thickness / 2;
        if (points.length === 1) {
            const [px, py] = points[0];
            return ShapeUtils.rectangle(px - half, py - half * ASPECT, thickness, thickness * ASPECT);
        }
        const top = [];
        const bottom = [];
        for (let i = 0; i < points.length; i++) {
            const prev = points[Math.max(0, i - 1)];
            const next = points[Math.min(points.length - 1, i + 1)];
            const dx = next[0] - prev[0];
            const dy = (next[1] - prev[1]) / ASPECT;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            top.push([points[i][0] + nx * half, points[i][1] + ny * half * ASPECT]);
            bottom.push([points[i][0] - nx * half, points[i][1] - ny * half * ASPECT]);
        }
        bottom.reverse();
        const strip = top.concat(bottom);
        strip.push([strip[0][0], strip[0][1]]);
        return strip;
    }


    clearRound() {
        this.gameBase.clearChildren();this.soundRoot.clearChildren();
        if(this.roundPromptRoot)this.playerOverrideRoot.removeChild(this.roundPromptRoot.id);
        this.roundPromptRoot=null;this.timerNodeInfo=null;this.soundEndsAt=null;
        this.nextRoundStartTime=null;
    }

    newGame() { this.startNextRound(); }

    startNextRound() {
        const ready=this.readyPlayers();
        if(!ready.length){this.clearRound();this.currentRound=null;return;}
        const order=this.playerOrder.filter(id=>this.players[id]?.ready).concat('cpu');
        const setter=ready.length===1 ? 'cpu' : order[this.playerIndex++ % order.length];
        this.startRound(setter);
    }

    startRound(playerKey) {
        this.clearRound();
        const ready=this.readyPlayers();
        if(!ready.length){this.currentRound=null;return;}
        const player=ready.length<2 || !ready.includes(String(playerKey)) ? 'cpu' : String(playerKey);
        const drawingPlayer=player==='cpu' ? (ready.length===1 ? ready[0] : null) : player;
        const round=this.currentRound={player,drawingPlayer,setterName:player==='cpu'?'CPU':this.playerName(player),
            guessers:ready.filter(id=>id!==player),phase:'choosing',correctGuesses:[],incorrectGuesses:[],strikethroughs:{}};
        if(player==='cpu'){this.useRandomPhrase(round);return;}
        const timer=this.label('30',50,82,8);
        this.gameBase.addChildren(this.label('Waiting for',50,42,5),this.label(round.setterName,50,52,4),timer);
        const prompt=this.shape(0,0,100,80,WHITE);prompt.node.playerIds=[Number(player)];
        const input=this.shape(10,33,80,16,BLACK);
        input.node.input={type:'text',oninput:(id,text)=>this.submitPhrase(id,text,round)};
        input.addChild(this.label('Enter your secret phrase',50,39,3.5,'center',WHITE,'heavy-amateur'));
        const error=this.label('',50,56,2.6);
        prompt.addChildren(input,error,this.button('Random word',20,66,60,10,id=>{
            if(id==round.player && this.currentRound===round && round.phase==='choosing')this.useRandomPhrase(round);
        },3.5));
        this.roundPromptRoot=prompt;round.errorNode=error;
        this.playerOverrideRoot.addChild(prompt);
        this.timerNodeInfo={node:timer,expireAt:Date.now()+30000,round,lastRemaining:30};
    }

    submitPhrase(playerId,text,round=this.currentRound) {
        if(this.currentRound!==round || round?.phase!=='choosing' || round.player!=playerId || !this.players[playerId]?.ready)return false;
        const phrase=typeof text==='string' ? text.replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim() : '';
        if(!phrase || phrase.length>MAX_PHRASE_LENGTH || /[^\x20-\x7e]/.test(phrase) || !/[a-z]/i.test(phrase)) {
            if(round.errorNode){round.errorNode.node.text.text='Use 1–60 characters, including A–Z.';round.errorNode.node.onStateChange();}
            return false;
        }
        round.secretPhrase=phrase;this.beginGuessing(round);return true;
    }

    useRandomPhrase(round) {
        if(this.currentRound!==round || round.phase!=='choosing')return;
        round.secretPhrase=questions[Math.floor(Math.random()*questions.length)].replace(/[‘’]/g,"'");
        round.player='cpu';round.setterName='CPU';round.guessers=this.readyPlayers();
        this.beginGuessing(round);
    }

    beginGuessing(round) {
        this.timerNodeInfo=null;
        if(this.roundPromptRoot)this.playerOverrideRoot.removeChild(this.roundPromptRoot.id);
        this.roundPromptRoot=null;delete round.errorNode;
        round.phase='playing';this.nextTurn();
    }

    phraseLines(phrase) {
        // Fixed letter cells keep long words and revealed answers inside the phone canvas.
        const lines=[];let line='';
        for(const word of phrase.split(' ')) {
            if(line && line.length+1+word.length>22){lines.push(line);line='';}
            let remaining=word;
            while(remaining.length>22){lines.push(remaining.slice(0,22));remaining=remaining.slice(22);}
            line+=(line?' ':'')+remaining;
        }
        if(line)lines.push(line);
        return lines;
    }

    renderHangmanSection(reveal=false) {
        const round=this.currentRound,container=this.shape();
        const lines=this.phraseLines(round.secretPhrase);
        const size=Math.min(3.8,14/lines.length);
        lines.forEach((line,row)=>{
            const step=4, start=50-(line.length-1)*step/2;
            [...line].forEach((char,col)=>{
                const shown=/[a-z]/i.test(char)&&!reveal&&!round.correctGuesses.includes(char.toLowerCase())?'_':char;
                if(shown!==' ')container.addChild(this.label(shown,start+col*step,33+row*(16/lines.length),size));
            });
        });
        const frames=this.customHangmen[round.drawingPlayer];
        if(!frames) {
            const key=`hangman_${round.incorrectGuesses.length}`;
            container.addChild(new GameNode.Asset({coordinates2d:ShapeUtils.rectangle(30,4,30,25),assetInfo:{[key]:{pos:{x:30,y:4},size:{x:30,y:25}}}}));
        } else {
            for(let i=0;i<=round.incorrectGuesses.length;i++)for(const stroke of frames[i]||[]) {
                const points=stroke.points.map(([x,y])=>[32+(x-CREATOR_CANVAS.x)*.4,5+(y-CREATOR_CANVAS.y)*.4]);
                const n=this.shape();n.node.fill=BLACK;n.node.coordinates2d=this.buildStrokeCoordinates(points,stroke.thickness*.4);container.addChild(n);
            }
        }
        container.addChild(this.label(round.setterName,50,1,3));
        return container;
    }

    renderLettersSection() {
        const round=this.currentRound,container=this.shape();
        [...LETTERS].forEach((a,i)=>{
            const x=7+(i%7)*14.3,y=51+Math.floor(i/7)*12;
            const key=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(x-6.5,y,13,11),onClick:id=>{
                if(this.currentRound===round)this.guess(id,a);
            }});
            key.addChild(this.label(a.toUpperCase(),x,y,9));
            if(round.correctGuesses.includes(a)||round.incorrectGuesses.includes(a)) {
                const asset=round.strikethroughs[a] ||= `strikethrough_${Math.floor(Math.random()*3)}`;
                key.addChild(new GameNode.Asset({coordinates2d:ShapeUtils.rectangle(x-6,y-1,13,12),assetInfo:{[asset]:{pos:{x:x-6,y:y-1},size:{x:13,y:12}}}}));
            }
            container.addChild(key);
        });
        return container;
    }

    guess(playerId,guessChar) {
        const round=this.currentRound,p=this.players[playerId];
        if(!p?.ready || round?.phase!=='playing' || round.player==playerId || !round.guessers.includes(String(playerId)) ||
            typeof guessChar!=='string' || !/^[a-z]$/i.test(guessChar))return;
        const char=guessChar.toLowerCase();
        if(round.correctGuesses.includes(char)||round.incorrectGuesses.includes(char))return;
        if(round.secretPhrase.toLowerCase().includes(char)){round.correctGuesses.push(char);p.correctGuesses++;}
        else {
            round.incorrectGuesses.push(char);p.incorrectGuesses++;
            if(round.incorrectGuesses.length===5){round.killer=playerId;round.killerName=this.playerName(playerId);p.kills++;}
        }
        this.soundRoot.clearChildren();
        this.soundRoot.addChild(new GameNode.Asset({coordinates2d:ShapeUtils.rectangle(0,0,0,0),assetInfo:{
            [`scribbles_${Math.floor(Math.random()*3)+1}`]:{pos:{x:0,y:0},size:{x:0,y:0},startTime:0,loop:false}
        }}));
        this.soundEndsAt=Date.now()+1000;
        this.nextTurn();
    }

    nextTurn() {
        const round=this.currentRound;
        if(round?.phase!=='playing')return;
        const solved=[...round.secretPhrase.toLowerCase()].filter(c=>/[a-z]/.test(c)).every(c=>round.correctGuesses.includes(c));
        const lost=round.incorrectGuesses.length===5;
        this.gameBase.clearChildren();
        this.hangmanSection=this.renderHangmanSection(lost);this.gameBase.addChild(this.hangmanSection);
        if(solved||lost) {
            round.phase='result';round.resultEndsAt=Date.now()+3000;
            this.gameBase.addChild(this.label(lost?'R.I.P':'Solved',50,60,6,'center',BLACK,'heavy-amateur'));
            if(lost&&round.killerName)this.gameBase.addChild(this.label(`killed by ${round.killerName}`,50,73,3.5));
            this.gameBase.addChild(this.button('Scores',25,86,50,10,id=>{
                if(this.currentRound===round&&round.phase==='result'&&this.players[id]?.ready&&this.takePress(id))this.endRound();
            }));
        } else {
            this.lettersSection=this.renderLettersSection();this.gameBase.addChild(this.lettersSection);
        }
    }

    endRound() {
        const round=this.currentRound;
        if(!round || round.phase==='scores')return;
        round.phase='scores';this.timerNodeInfo=null;
        this.nextRoundStartTime=Date.now()+5000;
        this.renderScores();
    }

    renderScores() {
        const round=this.currentRound;
        this.gameBase.clearChildren();
        this.gameBase.addChildren(this.label('Player',18,4,4,'center',BLACK,'heavy-amateur'),
            this.label('Score',60,4,4,'center',BLACK,'heavy-amateur'),this.label('Kills',88,4,4,'center',BLACK,'heavy-amateur'));
        this.readyPlayers().forEach((id,i)=>{
            const p=this.players[id],y=14+i*8.5;
            const name=this.playerName(id),split=name.lastIndexOf(' ',12);
            const cut=split>0 && name.length-split-1<=12?split:12;
            const lines=name.length>12?[name.slice(0,cut),name.slice(cut).trim()]:[name];
            lines.forEach((line,row)=>this.gameBase.addChild(this.label(line,5,y+row*3.2,2.4,'left')));
            this.gameBase.addChildren(
                this.label(`-${p.incorrectGuesses}`,53,y,3.5),this.label(`+${p.correctGuesses}`,67,y,3.5),this.label(String(p.kills),88,y,3.5));
        });
        this.gameBase.addChild(this.button('Next round',25,86,50,10,id=>{
            if(this.currentRound===round&&round.phase==='scores'&&this.players[id]?.ready&&this.takePress(id))this.startNextRound();
        }));
    }

    tick() {
        const now=Date.now(),round=this.currentRound;
        if(this.soundEndsAt && now>=this.soundEndsAt){this.soundRoot.clearChildren();this.soundEndsAt=null;}
        if(!round)return;
        if(round.phase==='choosing' && this.timerNodeInfo?.round===round) {
            const timer=this.timerNodeInfo,remaining=Math.max(0,Math.ceil((timer.expireAt-now)/1000));
            if(!remaining)this.useRandomPhrase(round);
            else if(remaining!==timer.lastRemaining){timer.lastRemaining=remaining;timer.node.node.text.text=String(remaining);timer.node.node.onStateChange();}
        } else if(round.phase==='result' && now>=round.resultEndsAt)this.endRound();
        else if(round.phase==='scores' && now>=this.nextRoundStartTime)this.startNextRound();
    }
}
module.exports = Hangman;
