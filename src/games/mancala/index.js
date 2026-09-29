const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');
const { COLORS } = Colors;

const P0 = 0;
const P1 = 1;
const SIDE_NAMES = ['Blue', 'Gold'];
const SIDE_COLORS = [[91, 123, 137, 255], [197, 157, 75, 255]];
const EMPTY_COLOR = [74, 57, 45, 255];
const PIT_COLOR = [126, 91, 60, 255];
const PIT_HIGHLIGHT = [153, 116, 74, 255];

const ellipse = (cx, cy, rx, ry, sides = 20) => {
    const pts = [];
    for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
};

class Mancala extends Game {
    static metadata() {
        return {
            squishVersion: '142',
            name: 'Mancala',
            author: 'Homegames',
            description: 'Classic Kalah mancala with captures and extra turns.',
            aspectRatio: { x: 16, y: 9 },
            maxPlayers: 2,
            services: ['multiplayer']
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [28, 24, 21, 255]
        });
        this.tableSurface = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(3, 3, 94, 94),
            fill: [48, 76, 57, 255],
            color: [130, 94, 66, 255],
            border: 6
        });
        this.base.addChild(this.tableSurface);

        this.board = this.makeStartingBoard();
        this.startingSide = P0;
        this.turn = this.startingSide;
        this.phase = 'waiting';
        this.animating = false;
        this.lastPit = null;
        this.lastLanding = null;
        this.scores = [0, 0];
        this.players = {};
        this.seats = [
            { playerId: null, isBot: false, name: 'Open seat' },
            { playerId: null, isBot: true, name: 'Computer' }
        ];
        this.botToken = 0;
        this.botPending = false;

        this.titleText = this.makeText('Mancala', 50, 4, 3.5, [244, 237, 216, 255]);
        this.statusText = this.makeText('Welcome to the table', 50, 11, 1.7, [244, 237, 216, 255]);
        this.scoreText = this.makeText('Blue 0   —   0 Gold', 50, 17, 1.25, [224, 216, 193, 255]);
        this.hintText = this.makeText('Land in your store for an extra turn', 50, 83, 1.15, [224, 216, 193, 255]);
        this.leftSeatText = this.makeText('Blue · Open seat', 21, 91, 1.1, SIDE_COLORS[P0]);
        this.rightSeatText = this.makeText('Gold · Computer', 79, 91, 1.1, SIDE_COLORS[P1]);

        this.boardBack = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(8, 24, 84, 52),
            fill: [92, 66, 46, 255],
            color: [52, 38, 29, 255],
            border: 5
        });
        this.base.addChild(this.boardBack);

        this.pitNodes = {};
        this.countNodes = {};
        this.stoneNodes = {};
        this.storeNodes = {};
        this.storeCountNodes = {};

        const xs = [24, 34, 44, 54, 64, 74];
        for (let pit = 0; pit < 6; pit++) {
            const idx0 = pit;
            const x0 = xs[pit];
            const y0 = 59;
            const node0 = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ellipse(x0, y0, 4.2, 8),
                fill: PIT_COLOR,
                color: [61, 44, 34, 255],
                border: 3,
                onClick: (playerId) => this.handlePitClick(playerId, idx0)
            });
            const text0 = this.makeText('4', x0, y0 - 1.3, 2.0, COLORS.WHITE);
            this.pitNodes[idx0] = node0;
            this.countNodes[idx0] = text0;
            this.addStones(node0, idx0, x0, y0);
            this.base.addChildren(node0, text0);

            const idx1 = 12 - pit;
            const x1 = xs[pit];
            const y1 = 39;
            const node1 = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ellipse(x1, y1, 4.2, 8),
                fill: PIT_COLOR,
                color: [61, 44, 34, 255],
                border: 3,
                onClick: (playerId) => this.handlePitClick(playerId, idx1)
            });
            const text1 = this.makeText('4', x1, y1 - 1.3, 2.0, COLORS.WHITE);
            this.pitNodes[idx1] = node1;
            this.countNodes[idx1] = text1;
            this.addStones(node1, idx1, x1, y1);
            this.base.addChildren(node1, text1);
        }

        const store0 = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ellipse(84, 49, 5.2, 19),
            fill: [65, 92, 112, 255],
            color: SIDE_COLORS[P0],
            border: 5
        });
        const store1 = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ellipse(16, 49, 5.2, 19),
            fill: [112, 94, 49, 255],
            color: SIDE_COLORS[P1],
            border: 5
        });
        const storeText0 = this.makeText('0', 84, 45.5, 2.4, COLORS.WHITE);
        const storeText1 = this.makeText('0', 16, 45.5, 2.4, COLORS.WHITE);
        this.storeNodes[6] = store0;
        this.storeNodes[13] = store1;
        this.storeCountNodes[6] = storeText0;
        this.storeCountNodes[13] = storeText1;
        this.base.addChildren(store0, store1, storeText0, storeText1);

        this.bottomLabel = this.makeText('Blue → to the right store', 50, 71, 1.8, [244, 237, 216, 255]);
        this.topLabel = this.makeText('Gold ← to the left store', 50, 26, 1.8, [244, 237, 216, 255]);

        this.rematchButton = this.makeButton(36, 92.5, 28, 6, 'Play again', [116, 82, 53, 255], () => {
            if (this.phase === 'over') this.resetRound();
        });
        this.rematchButton.node.playerIds = [0];
        this.base.addChildren(this.titleText, this.statusText, this.scoreText, this.hintText, this.leftSeatText, this.rightSeatText, this.bottomLabel, this.topLabel, this.rematchButton);
        this.render();
    }

    getLayers() { return [{ root: this.base }]; }
    addStones(pit, index, x, y) {
        const colors = [[239, 208, 146, 255], [149, 204, 198, 255], [231, 151, 118, 255]];
        this.stoneNodes[index] = Array.from({ length: 8 }, (_, i) => {
            const angle = i * Math.PI / 4;
            const stone = new GameNode.Shape({ shapeType: Shapes.POLYGON,
                coordinates2d: ellipse(x + Math.cos(angle) * 2.8, y + Math.sin(angle) * 5.4, 0.48, 0.9),
                fill: colors[i % colors.length], color: [61, 44, 34, 255], border: 3 });
            pit.addChild(stone);
            return stone;
        });
    }
    makeText(text,x,y,size,color,playerIds){ return new GameNode.Text({textInfo:{text,x,y,size,align:'center',color,font:'default'},playerIds}); }
    makeButton(x,y,w,h,label,fill,onClick){
        const bg=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(x,y,w,h),fill,color:COLORS.WHITE,border:3,onClick});
        bg.addChild(this.makeText(label,x+w/2,y+1.1,1.8,COLORS.WHITE));
        return bg;
    }

    makeStartingBoard() {
        const b = new Array(14).fill(4);
        b[6] = 0;
        b[13] = 0;
        return b;
    }

    ownsPit(side, index) {
        return side === P0 ? index >= 0 && index <= 5 : index >= 7 && index <= 12;
    }

    storeIndex(side) { return side === P0 ? 6 : 13; }
    opponentStore(side) { return side === P0 ? 13 : 6; }
    sidePits(side) { return side === P0 ? [0,1,2,3,4,5] : [7,8,9,10,11,12]; }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        let seat=-1;
        if (this.seats[P0].playerId===null) seat=P0;
        else if (this.seats[P1].isBot) { seat=P1; this.invalidateBot(); }
        if (seat<0) return;
        this.seats[seat]={playerId,isBot:false,name};
        const youText=this.makeText(`Playing as ${SIDE_NAMES[seat]}`,50,87, 1.8, [244, 237, 216, 255],[playerId]);
        this.players[playerId]={seat,youText};
        this.base.addChild(youText);
        if(this.phase==='waiting') this.phase='playing';
        this.render();
        this.scheduleBotIfNeeded();
    }

    handlePlayerDisconnect(playerId){
        const p=this.players[playerId]; if(!p)return;
        this.base.removeChild(p.youText.id);
        delete this.players[playerId];
        this.seats[p.seat]={playerId:null,isBot:true,name:'Computer'};
        this.render();
        this.scheduleBotIfNeeded();
    }

    handlePitClick(playerId,index){
        if(this.phase!=='playing'||this.animating)return;
        const p=this.players[playerId];
        if(!p||p.seat!==this.turn||this.seats[this.turn].isBot)return;
        this.playPit(index,p.seat);
    }

    playPit(index,side){
        if(this.phase!=='playing'||this.animating||side!==this.turn||!this.ownsPit(side,index)||this.board[index]<=0)return false;
        const stones=this.board[index];
        const path=[];
        let cursor=index;
        for(let n=0;n<stones;n++){
            do{cursor=(cursor+1)%14;}while(cursor===this.opponentStore(side));
            path.push(cursor);
        }
        this.board[index]=0;
        this.lastPit=index;
        this.lastLanding=null;
        this.animating=true;
        this.render();
        const sow=(step)=>{
            if(!this.animating)return;
            if(step>=path.length){
                const last=path[path.length-1];
                this.lastLanding=last;
                if(this.ownsPit(side,last)&&this.board[last]===1){
                    const opposite=12-last;
                    if(opposite>=0&&opposite<14&&this.board[opposite]>0){
                        const store=this.storeIndex(side);
                        this.board[store]+=this.board[opposite]+1;
                        this.board[opposite]=0;
                        this.board[last]=0;
                    }
                }
                const extraTurn=last===this.storeIndex(side);
                if(this.sideEmpty(P0)||this.sideEmpty(P1)){
                    this.sweepRemaining();
                    this.phase='over';
                    if(this.board[6]>this.board[13])this.scores[P0]+=1;
                    else if(this.board[13]>this.board[6])this.scores[P1]+=1;
                    this.invalidateBot();
                }else if(!extraTurn)this.turn=1-this.turn;
                this.animating=false;
                this.render();
                this.scheduleBotIfNeeded();
                return;
            }
            const dest=path[step];
            this.board[dest]+=1;
            this.lastLanding=dest;
            this.render();
            this.setTimeout(()=>sow(step+1),70);
        };
        this.setTimeout(()=>sow(0),55);
        return true;
    }

    simulateMove(board,index,side){
        const b=board.slice();
        let stones=b[index];
        b[index]=0;
        let cursor=index;
        while(stones>0){
            cursor=(cursor+1)%14;
            if(cursor===this.opponentStore(side))continue;
            b[cursor]+=1;
            stones--;
        }
        if(this.ownsPit(side,cursor)&&b[cursor]===1){
            const opposite=12-cursor;
            if(opposite>=0&&opposite<14&&b[opposite]>0){
                const store=this.storeIndex(side);
                b[store]+=b[opposite]+1;
                b[opposite]=0;
                b[cursor]=0;
            }
        }
        return {board:b,last:cursor,extraTurn:cursor===this.storeIndex(side)};
    }

    sideEmpty(side){ return this.sidePits(side).every(i=>this.board[i]===0); }
    sweepRemaining(){
        for(const side of [P0,P1]){
            const store=this.storeIndex(side);
            for(const pit of this.sidePits(side)){
                this.board[store]+=this.board[pit];
                this.board[pit]=0;
            }
        }
    }

    legalPits(board,side){ return this.sidePits(side).filter(i=>board[i]>0); }

    chooseBotPit(side){
        const legal=this.legalPits(this.board,side);
        if(!legal.length)return -1;
        let best=-Infinity,bestPits=[];
        for(const pit of legal){
            const result=this.simulateMove(this.board,pit,side);
            const score=this.minimax(result.board,4,result.extraTurn?side:1-side,side,-Infinity,Infinity);
            if(score>best){best=score;bestPits=[pit];}
            else if(score===best)bestPits.push(pit);
        }
        return bestPits[Math.floor(Math.random()*bestPits.length)];
    }

    minimax(board,depth,sideToMove,botSide,alpha,beta){
        const empty0=this.sidePits(P0).every(i=>board[i]===0);
        const empty1=this.sidePits(P1).every(i=>board[i]===0);
        if(depth===0||empty0||empty1)return this.evaluateBoard(board,botSide);
        const legal=this.legalPits(board,sideToMove);
        if(sideToMove===botSide){
            let value=-Infinity;
            for(const pit of legal){
                const r=this.simulateMove(board,pit,sideToMove);
                value=Math.max(value,this.minimax(r.board,depth-1,r.extraTurn?sideToMove:1-sideToMove,botSide,alpha,beta));
                alpha=Math.max(alpha,value); if(alpha>=beta)break;
            }
            return value;
        }
        let value=Infinity;
        for(const pit of legal){
            const r=this.simulateMove(board,pit,sideToMove);
            value=Math.min(value,this.minimax(r.board,depth-1,r.extraTurn?sideToMove:1-sideToMove,botSide,alpha,beta));
            beta=Math.min(beta,value); if(alpha>=beta)break;
        }
        return value;
    }

    evaluateBoard(board,side){
        const store=this.storeIndex(side), oppStore=this.storeIndex(1-side);
        let score=(board[store]-board[oppStore])*12;
        const own=this.sidePits(side).reduce((a,i)=>a+board[i],0);
        const opp=this.sidePits(1-side).reduce((a,i)=>a+board[i],0);
        score += own-opp;
        for(const pit of this.legalPits(board,side)){
            const r=this.simulateMove(board,pit,side);
            if(r.extraTurn)score+=4;
        }
        return score;
    }

    scheduleBotIfNeeded(){
        if(this.phase!=='playing'||this.animating||this.botPending||!this.hasHuman())return;
        const seat=this.seats[this.turn]; if(!seat||!seat.isBot)return;
        this.botPending=true;
        const token=++this.botToken;
        const side=this.turn;
        this.setTimeout(()=>{
            if(token!==this.botToken)return;
            this.botPending=false;
            if(this.phase!=='playing'||this.turn!==side||!this.seats[side].isBot)return;
            const pit=this.chooseBotPit(side);
            if(pit>=0)this.playPit(pit,side);
        },350);
    }

    invalidateBot(){this.botToken+=1;this.botPending=false;}
    hasHuman(){return Object.keys(this.players).length>0;}
    resetRound(){
        this.invalidateBot();
        this.board=this.makeStartingBoard();
        this.startingSide=1-this.startingSide;
        this.turn=this.startingSide;
        this.animating=false;
        this.phase=this.hasHuman()?'playing':'waiting';
        this.lastPit=null;
        this.lastLanding=null;
        this.render();
        this.scheduleBotIfNeeded();
    }

    render(){
        const legal=new Set(this.phase==='playing'?this.legalPits(this.board,this.turn):[]);
        for(const idx of [...this.sidePits(P0),...this.sidePits(P1)]){
            const node=this.pitNodes[idx];
            const count=this.board[idx];
            this.stoneNodes[idx].forEach((stone, i) => { stone.node.playerIds = i < Math.min(count, 8) ? [] : [0]; });
            const active=legal.has(idx);
            node.node.fill=active?PIT_HIGHLIGHT:(count===0?EMPTY_COLOR:PIT_COLOR);
            node.node.color=active||this.lastPit===idx?COLORS.WHITE:[61,44,34,255];
            node.node.border=active?10:(this.lastPit===idx?6:3);
            const text=this.countNodes[idx].node.text;
            this.countNodes[idx].node.text={text:String(count),x:text.x,y:text.y,size:2.0,align:'center',color:active?COLORS.WHITE:[244, 237, 216, 255],font:'default'};
        }
        for(const store of [6,13]){
            const t=this.storeCountNodes[store].node.text;
            this.storeCountNodes[store].node.text={text:String(this.board[store]),x:t.x,y:t.y,size:2.4,align:'center',color:COLORS.WHITE,font:'default'};
            this.storeNodes[store].node.border=this.lastLanding===store?9:5;
            this.storeNodes[store].node.color=this.lastLanding===store?COLORS.WHITE:(store===6?SIDE_COLORS[P0]:SIDE_COLORS[P1]);
        }

        let status='Welcome to the table';
        let hint='Land in your store for an extra turn';
        if(this.phase==='playing'){
            const seat=this.seats[this.turn];
            status=seat.isBot?'Computer is choosing…':`${SIDE_NAMES[this.turn]} · ${seat.name}'s turn`;
            hint=this.animating?'One stone in each pit along the way…':(seat.isBot?'Finish in your store to take another turn':'Choose an outlined pit · Collect the most stones');
        }else if(this.phase==='over'){
            if(this.board[6]>this.board[13]){status='Blue wins';hint=`${this.seats[P0].name} finishes with ${this.board[6]}`;}
            else if(this.board[13]>this.board[6]){status='Gold wins';hint=`${this.seats[P1].name} finishes with ${this.board[13]}`;}
            else{status='Draw';hint='The stores end even';}
        }
        this.statusText.node.text={text:status,x:50,y:11,size:2.6,align:'center',color:[244, 237, 216, 255],font:'default'};
        this.scoreText.node.text={text:`${this.board[6]} in Blue store   ·   ${this.board[13]} in Gold store`,x:50,y:17,size:1.9,align:'center',color:[224, 216, 193, 255],font:'default'};
        this.hintText.node.text={text:hint,x:50,y:83,size:2.0,align:'center',color:this.phase==='over'?[244, 237, 216, 255]:[224, 216, 193, 255],font:'default'};
        this.leftSeatText.node.text={text:`Blue · ${this.seats[P0].name} · ${this.scores[P0]}`,x:21,y:91,size:1.8,align:'center',color:[244, 237, 216, 255],font:'default'};
        this.rightSeatText.node.text={text:`Gold · ${this.seats[P1].name} · ${this.scores[P1]}`,x:79,y:91,size:1.8,align:'center',color:[244, 237, 216, 255],font:'default'};
        this.rematchButton.node.playerIds=this.phase==='over'?[]:[0];
        this.base.node.onStateChange();
    }
}

module.exports = Mancala;
