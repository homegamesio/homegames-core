const { Game, GameNode, Shapes, ShapeUtils } = require('squish-150');
const { T, text, button, showButton, card, setCard, tableRoot } = require('./theme');

const SUITS = ['C','D','S','H'];
const SYMBOL = { C:'♣', D:'♦', S:'♠', H:'♥' };
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUE = Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));
const PASS_NAMES = ['Pass left', 'Pass right', 'Pass across', 'Hold'];

class Hearts extends Game {
    static metadata() {
        return {
            isTest: true, // Showcase review: docs/game-curation.json.

            thumbnail: './assets/thumbnail.png',
            squishVersion: '150',
            name: 'Hearts',
            author: "Joseph Garcia",
            description: 'A warm four-player Hearts table with passing, private hands, and shooting the moon.',
            aspectRatio: { x: 1, y: 1 },
            maxPlayers: 4,
            services: ['multiplayer']
        };
    }

    constructor() {
        super();
        const table = tableRoot();
        this.base = table.root;
        this.felt = table.felt;
        this.players = {};
        this.seats = [
            { playerId:null, isBot:false, name:'Open seat' },
            { playerId:null, isBot:true, name:'Mabel' },
            { playerId:null, isBot:true, name:'Arthur' },
            { playerId:null, isBot:true, name:'June' }
        ];
        this.scores = [0,0,0,0];
        this.round = 0;
        this.phase = 'waiting';
        this.turn = 0;
        this.leader = 0;
        this.heartsBroken = false;
        this.trickNumber = 0;
        this.hands = [[],[],[],[]];
        this.taken = [[],[],[],[]];
        this.trick = [];
        this.passSelections = [[],[],[],[]];
        this.passReady = [false,false,false,false];
        this.botToken = 0;
        this.botPending = false;
        this.lastEvent = '';

        this.subtitle = text('Lowest score wins · Avoid hearts and the queen of spades', 50, 11.5,1.8, T.muted);
        this.status = text('Welcome to the table', 50, 16, 1.8, T.cream);
        this.scoreLine = text('', 50, 20, 1.15, T.muted);
        this.base.addChildren(this.subtitle, this.status, this.scoreLine);

        this.seatTexts = [
            text('', 50, 25, 1.25, T.soft),
            text('', 86, 46, 1.25, T.soft),
            text('', 50, 60, 1.25, T.soft),
            text('', 14, 46, 1.25, T.soft)
        ];
        this.base.addChildren(...this.seatTexts);

        const trickPos = [[45,30],[58,39],[45,48],[32,39]];
        this.trickCards = [];
        for (let i=0;i<4;i++) {
            const [x,y] = trickPos[i];
            const c = card(x,y,10,15, undefined);
            c.node.playerIds = [0];
            this.trickCards.push(c);
            this.base.addChild(c);
        }
        this.nextButton = button(39,61.5,22,6,'Next hand',()=>this.nextHand());
        this.nextButton.node.playerIds = [0];
        this.base.addChild(this.nextButton);
        this.render();
    }

    getLayers() { return [{ root:this.base }]; }

    buildDeck() {
        const deck=[];
        for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank, value:RANK_VALUE[rank], symbol:SYMBOL[suit], id:`${rank}${suit}` });
        return deck;
    }
    shuffle(a) { for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
    sortHand(hand) { hand.sort((a,b)=>SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit) || a.value-b.value); }

    handleNewPlayer({ playerId, info }) {
        if (this.players[playerId]) return;
        let seat = this.seats.findIndex(s=>s.playerId===null && !s.isBot);
        if (seat < 0) seat = this.seats.findIndex(s=>s.isBot);
        const name = info && info.name ? String(info.name).trim().slice(0, 14) : `Player ${playerId}`;
        const view = this.createView(playerId, seat);
        this.players[playerId] = { seat, view };
        this.base.addChild(view.root);
        if (seat >= 0) {
            if (this.seats[seat].isBot) this.invalidateBot();
            this.seats[seat] = { playerId, isBot:false, name };
            if (this.phase === 'passing') { this.passSelections[seat]=[]; this.passReady[seat]=false; }
            if (this.phase === 'waiting') this.startHand();
        }
        this.render();
        this.scheduleBot();
    }

    createView(playerId, seat) {
        const root = new GameNode.Shape({ shapeType:Shapes.POLYGON, coordinates2d:ShapeUtils.rectangle(0,0,0,0), playerIds:[playerId] });
        if (seat < 0) { root.addChild(text('Watching this table',50,91,1.25,T.muted,[playerId])); return { root, slots:[] }; }
        const hint = text('',50,69,1.15,T.soft,[playerId]);
        root.addChild(hint);
        const slots=[];
        for (let i=0;i<13;i++) {
            const row = i<7 ? 0 : 1;
            const col = row===0 ? i : i-7;
            const count = row===0 ? 7 : 6;
            const w=11.4, gap=1.0;
            const total = count*w + (count-1)*gap;
            const start = (100-total)/2;
            const x=start+col*(w+gap), y=72+row*12.2;
            const c=card(x,y,w,11,(pid)=>this.handleCardClick(pid,i),[playerId]);
            slots.push(c); root.addChild(c);
        }
        const pass = button(37,61.5,26,6,'Pass three',(pid)=>this.confirmPass(pid),[0],T.wood);
        root.addChild(pass);
        return { root, hint, slots, pass };
    }

    handlePlayerDisconnect(playerId) {
        const p=this.players[playerId]; if (!p) return;
        this.base.removeChild(p.view.root.id); delete this.players[playerId];
        if (p.seat>=0) {
            this.seats[p.seat]={ playerId:null, isBot:true, name:['Mabel','Arthur','June','Theo'][p.seat] };
            if (this.phase==='passing' && !this.passReady[p.seat]) this.chooseBotPass(p.seat);
        }
        this.render(); this.scheduleBot();
    }

    startHand() {
        this.invalidateBot();
        const deck=this.shuffle(this.buildDeck());
        this.hands=[[],[],[],[]]; this.taken=[[],[],[],[]]; this.trick=[];
        for (let i=0;i<52;i++) this.hands[i%4].push(deck[i]);
        for (const h of this.hands) this.sortHand(h);
        this.heartsBroken=false; this.trickNumber=0; this.lastEvent='';
        this.passSelections=[[],[],[],[]]; this.passReady=[false,false,false,false];
        const direction=this.round%4;
        if (direction===3) {
            this.phase='playing';
            this.leader=this.findTwoClubsSeat(); this.turn=this.leader;
        } else {
            this.phase='passing';
            for (let s=0;s<4;s++) if (this.seats[s].isBot) this.chooseBotPass(s);
        }
        this.render();
        if (this.phase==='passing') this.finishPassIfReady(); else this.scheduleBot();
    }

    findTwoClubsSeat() { for (let s=0;s<4;s++) if (this.hands[s].some(c=>c.id==='2C')) return s; return 0; }

    chooseBotPass(side) {
        if (this.phase!=='passing') return;
        const ranked=this.hands[side].map((c,i)=>({i,score:(c.suit==='S'&&c.rank==='Q'?100:0)+(c.suit==='H'?20+c.value:0)+c.value+(c.suit==='S'&&c.value>=11?8:0)})).sort((a,b)=>b.score-a.score);
        this.passSelections[side]=ranked.slice(0,3).map(x=>x.i).sort((a,b)=>a-b);
        this.passReady[side]=true;
    }

    handleCardClick(playerId, slot) {
        const p=this.players[playerId]; if (!p || p.seat<0) return;
        const side=p.seat;
        if (this.phase==='passing') {
            if (this.passReady[side]) return;
            if (slot>=this.hands[side].length) return;
            const at=this.passSelections[side].indexOf(slot);
            if (at>=0) this.passSelections[side].splice(at,1);
            else if (this.passSelections[side].length<3) this.passSelections[side].push(slot);
            this.render(); return;
        }
        if (this.phase!=='playing' || this.turn!==side || this.seats[side].isBot) return;
        const legal=this.legalIndices(side);
        if (!legal.includes(slot)) return;
        this.playCard(side,slot);
    }

    confirmPass(playerId) {
        if (this.phase!=='passing') return;
        const p=this.players[playerId]; if (!p || p.seat<0 || this.passSelections[p.seat].length!==3) return;
        this.passReady[p.seat]=true; this.render(); this.finishPassIfReady();
    }

    finishPassIfReady() {
        if (this.phase!=='passing' || !this.passReady.every(Boolean)) return;
        const dir=this.round%4;
        const offset=dir===0?1:dir===1?3:2;
        const outgoing=[[],[],[],[]];
        for (let s=0;s<4;s++) {
            const inds=this.passSelections[s].slice().sort((a,b)=>b-a);
            for (const i of inds) outgoing[s].push(this.hands[s].splice(i,1)[0]);
        }
        for (let s=0;s<4;s++) this.hands[(s+offset)%4].push(...outgoing[s]);
        for (const h of this.hands) this.sortHand(h);
        this.phase='playing'; this.leader=this.findTwoClubsSeat(); this.turn=this.leader;
        this.lastEvent='Cards passed'; this.render(); this.scheduleBot();
    }

    legalIndices(side) {
        if (this.trick.length >= 4) return [];
        const hand=this.hands[side];
        if (!hand.length) return [];
        if (this.trick.length===0) {
            if (this.trickNumber===0) return hand.map((c,i)=>c.id==='2C'?i:-1).filter(i=>i>=0);
            const nonHearts=hand.map((c,i)=>c.suit!=='H'?i:-1).filter(i=>i>=0);
            if (!this.heartsBroken && nonHearts.length) return nonHearts;
            return hand.map((_,i)=>i);
        }
        const leadSuit=this.trick[0].card.suit;
        const follow=hand.map((c,i)=>c.suit===leadSuit?i:-1).filter(i=>i>=0);
        if (follow.length) return follow;
        if (this.trickNumber===0) {
            const safe=hand.map((c,i)=>(c.suit!=='H' && c.id!=='QS')?i:-1).filter(i=>i>=0);
            if (safe.length) return safe;
        }
        return hand.map((_,i)=>i);
    }

    playCard(side,index) {
        if (this.phase!=='playing' || side!==this.turn) return false;
        const legal=this.legalIndices(side); if (!legal.includes(index)) return false;
        const card=this.hands[side].splice(index,1)[0];
        if (card.suit==='H') this.heartsBroken=true;
        this.trick.push({ side, card });
        this.lastEvent=`${this.seats[side].name} played ${card.rank}${card.symbol}`;
        if (this.trick.length<4) {
            this.turn=(side+1)%4; this.render(); this.scheduleBot(); return true;
        }
        const lead=this.trick[0].card.suit;
        let winner=this.trick[0];
        for (const play of this.trick) if (play.card.suit===lead && play.card.value>winner.card.value) winner=play;
        const captured=this.trick.map(p=>p.card);
        this.taken[winner.side].push(...captured);
        this.leader=winner.side; this.turn=winner.side; this.trickNumber++;
        this.lastEvent=`${this.seats[winner.side].name} took the trick`;
        this.render();
        const token=++this.botToken;
        this.setTimeout(()=>{
            if (token!==this.botToken || this.phase!=='playing') return;
            this.trick=[];
            if (this.trickNumber>=13) this.finishHand();
            else { this.render(); this.scheduleBot(); }
        },1000);
        return true;
    }

    cardPoints(c) { return c.suit==='H'?1:(c.id==='QS'?13:0); }
    finishHand() {
        const pts=this.taken.map(cards=>cards.reduce((n,c)=>n+this.cardPoints(c),0));
        const moon=pts.findIndex(n=>n===26);
        if (moon>=0) { for (let s=0;s<4;s++) if (s!==moon) this.scores[s]+=26; this.lastEvent=`${this.seats[moon].name} shot the moon`; }
        else for (let s=0;s<4;s++) this.scores[s]+=pts[s];
        const high=Math.max(...this.scores);
        if (high>=100) {
            const low=Math.min(...this.scores); const winners=[]; for (let s=0;s<4;s++) if (this.scores[s]===low) winners.push(this.seats[s].name);
            this.phase='gameOver'; this.lastEvent=`${winners.join(' & ')} win the table`;
        } else this.phase='roundOver';
        this.render();
    }

    nextHand() {
        if (this.phase==='roundOver') { this.round++; this.startHand(); }
        else if (this.phase==='gameOver') { this.scores=[0,0,0,0]; this.round=0; this.startHand(); }
    }

    chooseBotCard(side) {
        const legal=this.legalIndices(side);
        if (!legal.length) return -1;
        if (this.trick.length===0) {
            return legal.slice().sort((a,b)=>this.hands[side][a].value-this.hands[side][b].value)[0];
        }
        const lead=this.trick[0].card.suit;
        const follows=legal.filter(i=>this.hands[side][i].suit===lead);
        if (!follows.length) {
            return legal.slice().sort((a,b)=>this.cardPoints(this.hands[side][b])-this.cardPoints(this.hands[side][a]) || this.hands[side][b].value-this.hands[side][a].value)[0];
        }
        const current=Math.max(...this.trick.filter(p=>p.card.suit===lead).map(p=>p.card.value));
        const under=follows.filter(i=>this.hands[side][i].value<current).sort((a,b)=>this.hands[side][b].value-this.hands[side][a].value);
        if (under.length) return under[0];
        return follows.slice().sort((a,b)=>this.hands[side][a].value-this.hands[side][b].value)[0];
    }

    scheduleBot() {
        if (this.phase!=='playing' || this.botPending || !this.seats[this.turn].isBot) return;
        this.botPending=true; const token=++this.botToken; const side=this.turn;
        this.setTimeout(()=>{
            if (token!==this.botToken) return; this.botPending=false;
            if (this.phase!=='playing' || this.turn!==side || !this.seats[side].isBot) return;
            const i=this.chooseBotCard(side); if (i>=0) this.playCard(side,i);
        },340);
    }
    invalidateBot() { this.botToken++; this.botPending=false; }

    render() {
        const passing=this.phase==='passing';
        let status='Welcome to the table';
        if (passing) status=PASS_NAMES[this.round%4];
        else if (this.phase==='playing') status=`${this.seats[this.turn].name}'s turn`;
        else if (this.phase==='roundOver') status='Hand complete';
        else if (this.phase==='gameOver') status='Game complete';
        this.status.node.text={ text:status, x:50,y:16,size:2.5,align:'center',color:T.cream,font:'default' };
        this.scoreLine.node.text={ text:this.seats.map((s,i)=>`${s.name} ${this.scores[i]}`).join('   ·   '), x:50,y:20,size:1.6,align:'center',color:T.muted,font:'default' };
        const positions=[[50,25],[86,46],[50,60],[14,46]];
        for (let s=0;s<4;s++) this.seatTexts[s].node.text={ text:this.seats[s].name, x:positions[s][0], y:positions[s][1], size:1.6, align:'center', color:s===this.turn&&this.phase==='playing'?T.gold:T.soft, font:'default' };

        for (let i=0;i<4;i++) {
            const play=this.trick.find(p=>p.side===i);
            if (play) { this.trickCards[i].node.playerIds=[]; setCard(this.trickCards[i],play.card,false,true); }
            else this.trickCards[i].node.playerIds=[0];
        }
        this.nextButton.node.playerIds=(this.phase==='roundOver'||this.phase==='gameOver')?[]:[0];
        if (this.nextButton._label) this.nextButton._label.node.text={ text:this.phase==='gameOver'?'New game':'Next hand', x:50,y:63,size:1.8,align:'center',color:T.cream,font:'default' };

        for (const key of Object.keys(this.players)) {
            const p=this.players[key]; if (p.seat<0) continue;
            const side=p.seat, view=p.view;
            const legal=new Set(this.phase==='playing'&&this.turn===side?this.legalIndices(side):[]);
            const selected=new Set(this.passSelections[side]);
            for (let i=0;i<13;i++) {
                const c=this.hands[side][i];
                if (!c) { view.slots[i].node.playerIds=[0]; continue; }
                view.slots[i].node.playerIds=[Number(key)];
                setCard(view.slots[i],c,passing && selected.has(i),passing || legal.has(i));
            }
            let hint='';
            if (passing) hint=this.passReady[side]?'Waiting for the table…':`Choose 3 cards to give away · ${this.passSelections[side].length} / 3 selected`;
            else if (this.phase==='playing'&&this.turn===side) hint=this.trick.length===4?'Trick complete · Next play coming up':this.trick.length?'Play a • card · Follow the lead suit if you can':'Play a • card to start the trick';
            else if (this.lastEvent) hint=this.lastEvent;
            view.hint.node.text={ text:hint, x:50,y:69,size:1.9,align:'center',color:T.soft,font:'default' };
            showButton(view.pass,(passing&&!this.passReady[side]&&this.passSelections[side].length===3)?[Number(key)]:[0]);
        }
        this.base.node.onStateChange();
    }
}

module.exports = Hearts;
