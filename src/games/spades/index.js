const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const { T, text, button, showButton, card, setCard, tableRoot } = require('./theme');

const SUITS=['C','D','H','S'];
const SYMBOL={C:'♣',D:'♦',H:'♥',S:'♠'};
const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const VALUE=Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));

class Spades extends Game {
    static metadata(){return{ squishVersion:'142', name:'Spades', author:'Homegames', description:'Partnership Spades with full bidding, nils, bags, and private hands.', aspectRatio:{x:1,y:1}, maxPlayers:4, services:['multiplayer']};}
    constructor(){
        super(); const table=tableRoot(); this.base=table.root;
        this.players={}; this.seats=[
            {playerId:null,isBot:false,name:'Open seat'}, {playerId:null,isBot:true,name:'Rose'},
            {playerId:null,isBot:true,name:'Walter'}, {playerId:null,isBot:true,name:'Nina'}
        ];
        this.teamScores=[0,0]; this.bags=[0,0]; this.round=0; this.phase='waiting';
        this.hands=[[],[],[],[]]; this.bids=[null,null,null,null]; this.tricksWon=[0,0,0,0];
        this.trick=[]; this.turn=0; this.leader=0; this.spadesBroken=false; this.trickNumber=0;
        this.dealer=0; this.bidCount=0; this.botToken=0; this.botPending=false; this.lastEvent='';
        this.title=text('Spades',50,6,4.2,T.cream); this.subtitle=text('Team up with the player opposite · Spades beat other suits',50,11.5,1.8,T.muted);
        this.status=text('Welcome to the table',50,16,1.8,T.cream); this.score=text('',50,20,1.15,T.muted);
        this.base.addChildren(this.title,this.subtitle,this.status,this.score);
        this.seatTexts=[text('',50,25,1.2,T.soft),text('',86,46,1.2,T.soft),text('',50,65,1.2,T.soft),text('',14,46,1.2,T.soft)];
        this.base.addChildren(...this.seatTexts);
        const pos=[[45,30],[58,39],[45,48],[32,39]]; this.trickCards=[];
        for(let i=0;i<4;i++){const c=card(pos[i][0],pos[i][1],10,15);c.node.playerIds=[0];this.trickCards.push(c);this.base.addChild(c);}
        this.nextButton=button(39,56,22,7,'Next hand',()=>this.nextHand()); this.nextButton.node.playerIds=[0]; this.base.addChild(this.nextButton);
        this.render();
    }
    getLayers(){return[{root:this.base}];}
    buildDeck(){const d=[];for(const s of SUITS)for(const r of RANKS)d.push({suit:s,rank:r,value:VALUE[r],symbol:SYMBOL[s],id:`${r}${s}`});return d;}
    shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
    sortHand(h){h.sort((a,b)=>SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)||a.value-b.value);}
    handleNewPlayer({playerId,info}){
        if(this.players[playerId])return; let seat=this.seats.findIndex(s=>s.playerId===null&&!s.isBot); if(seat<0)seat=this.seats.findIndex(s=>s.isBot);
        const name=info&&info.name?String(info.name).trim().slice(0, 14):`Player ${playerId}`; const view=this.createView(playerId,seat); this.players[playerId]={seat,view}; this.base.addChild(view.root);
        if(seat>=0){if(this.seats[seat].isBot)this.invalidateBot();this.seats[seat]={playerId,isBot:false,name};if(this.phase==='waiting')this.startHand();}
        this.render();this.scheduleBot();
    }
    createView(playerId,seat){
        const root=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(0,0,0,0),playerIds:[playerId]});
        if(seat<0){root.addChild(text('Watching this table',50,91,1.2,T.muted,[playerId]));return{root,slots:[]};}
        const hint=text('',50,68.5,1.08,T.soft,[playerId]);root.addChild(hint);const slots=[];
        for(let i=0;i<13;i++){const row=i<7?0:1,col=row===0?i:i-7,count=row===0?7:6,w=11.4,gap=1,total=count*w+(count-1)*gap,start=(100-total)/2,x=start+col*(w+gap),y=72+row*12.2;const c=card(x,y,w,11,(pid)=>this.handleCard(pid,i),[playerId]);slots.push(c);root.addChild(c);}
        const bidButtons=[];for(let b=0;b<=13;b++){const row=b<7?0:1,col=b<7?b:b-7,x=15+col*11.7,y=34+row*5.6,label=b===0?'Nil':String(b);const btn=button(x,y,10.4,4.8,label,(pid)=>this.makeBid(pid,b),[0],b===0?[110,70,58,255]:T.wood);bidButtons.push(btn);root.addChild(btn);}
        return{root,hint,slots,bidButtons};
    }
    handlePlayerDisconnect(playerId){const p=this.players[playerId];if(!p)return;this.base.removeChild(p.view.root.id);delete this.players[playerId];if(p.seat>=0)this.seats[p.seat]={playerId:null,isBot:true,name:['Rose','Walter','Nina','Frank'][p.seat]};this.render();this.scheduleBot();}
    startHand(){
        this.invalidateBot();const deck=this.shuffle(this.buildDeck());this.hands=[[],[],[],[]];for(let i=0;i<52;i++)this.hands[i%4].push(deck[i]);for(const h of this.hands)this.sortHand(h);
        this.bids=[null,null,null,null];this.tricksWon=[0,0,0,0];this.trick=[];this.spadesBroken=false;this.trickNumber=0;this.dealer=this.round%4;this.turn=(this.dealer+1)%4;this.leader=this.turn;this.bidCount=0;this.phase='bidding';this.lastEvent='';
        this.render();this.scheduleBot();
    }
    makeBid(playerId,bid){if(this.phase!=='bidding'||bid<0||bid>13)return;const p=this.players[playerId];if(!p||p.seat!==this.turn||this.seats[p.seat].isBot)return;this.acceptBid(p.seat,bid);}
    acceptBid(side,bid){if(this.phase!=='bidding'||side!==this.turn||this.bids[side]!==null)return false;this.bids[side]=bid;this.bidCount++;this.lastEvent=`${this.seats[side].name} bid ${bid===0?'nil':bid}`;if(this.bidCount===4){this.phase='playing';this.turn=(this.dealer+1)%4;this.leader=this.turn;}else this.turn=(side+1)%4;this.render();this.scheduleBot();return true;}
    botBid(side){const h=this.hands[side];let score=0;for(const c of h){if(c.suit==='S'){if(c.value>=11)score+=0.9;else if(c.value>=9)score+=0.45;}else if(c.value===14)score+=0.8;else if(c.value===13)score+=0.45;}const bid=Math.max(1,Math.min(6,Math.round(score)));const low=h.filter(c=>c.value<=9).length;if(score<1.2&&low>=9)return 0;return bid;}
    legalIndices(side){if(this.trick.length>=4)return[];const h=this.hands[side];if(!h.length)return[];if(!this.trick.length){if(!this.spadesBroken){const non=h.map((c,i)=>c.suit!=='S'?i:-1).filter(i=>i>=0);if(non.length)return non;}return h.map((_,i)=>i);}const lead=this.trick[0].card.suit;const follow=h.map((c,i)=>c.suit===lead?i:-1).filter(i=>i>=0);return follow.length?follow:h.map((_,i)=>i);}
    handleCard(playerId,index){if(this.phase!=='playing')return;const p=this.players[playerId];if(!p||p.seat!==this.turn||this.seats[p.seat].isBot)return;if(!this.legalIndices(p.seat).includes(index))return;this.playCard(p.seat,index);}
    playCard(side,index){if(this.phase!=='playing'||side!==this.turn||!this.legalIndices(side).includes(index))return false;const c=this.hands[side].splice(index,1)[0];if(c.suit==='S')this.spadesBroken=true;this.trick.push({side,card:c});this.lastEvent=`${this.seats[side].name} played ${c.rank}${c.symbol}`;if(this.trick.length<4){this.turn=(side+1)%4;this.render();this.scheduleBot();return true;}const lead=this.trick[0].card.suit;let winner=this.trick[0];for(const p of this.trick){if(p.card.suit==='S'&&winner.card.suit!=='S')winner=p;else if(p.card.suit===winner.card.suit&&p.card.value>winner.card.value)winner=p;else if(winner.card.suit!=='S'&&p.card.suit===lead&&winner.card.suit!==lead)winner=p;}this.tricksWon[winner.side]++;this.turn=winner.side;this.leader=winner.side;this.trickNumber++;this.lastEvent=`${this.seats[winner.side].name} took the trick`;this.render();const token=++this.botToken;this.setTimeout(()=>{if(token!==this.botToken||this.phase!=='playing')return;this.trick=[];if(this.trickNumber>=13)this.finishHand();else{this.render();this.scheduleBot();}},1000);return true;}
    finishHand(){
        for(let team=0;team<2;team++){const members=team===0?[0,2]:[1,3];let bid=0,tricks=0,delta=0;for(const s of members){tricks+=this.tricksWon[s];if(this.bids[s]===0){delta+=this.tricksWon[s]===0?100:-100;}else bid+=this.bids[s];}if(tricks>=bid){delta+=bid*10+(tricks-bid);this.bags[team]+=tricks-bid;}else delta-=bid*10;while(this.bags[team]>=10){this.bags[team]-=10;delta-=100;}this.teamScores[team]+=delta;}
        if(Math.max(...this.teamScores)>=500||Math.min(...this.teamScores)<=-200)this.phase='gameOver';else this.phase='roundOver';this.lastEvent='Hand scored';this.render();
    }
    nextHand(){if(this.phase==='roundOver'){this.round++;this.startHand();}else if(this.phase==='gameOver'){this.teamScores=[0,0];this.bags=[0,0];this.round=0;this.startHand();}}
    chooseBotCard(side){const legal=this.legalIndices(side);if(!legal.length)return-1;if(!this.trick.length)return legal.slice().sort((a,b)=>this.hands[side][a].value-this.hands[side][b].value)[0];const lead=this.trick[0].card.suit;let winning=this.trick[0].card;for(const p of this.trick){if(p.card.suit==='S'&&winning.suit!=='S')winning=p.card;else if(p.card.suit===winning.suit&&p.card.value>winning.value)winning=p.card;}const canWin=legal.filter(i=>{const c=this.hands[side][i];if(c.suit==='S'&&winning.suit!=='S')return true;return c.suit===winning.suit&&c.value>winning.value;}).sort((a,b)=>this.hands[side][a].value-this.hands[side][b].value);const bid=this.bids[side]||0;if(this.tricksWon[side]<bid&&canWin.length)return canWin[0];return legal.slice().sort((a,b)=>this.hands[side][a].value-this.hands[side][b].value)[0];}
    scheduleBot(){if((this.phase!=='playing'&&this.phase!=='bidding')||this.botPending||!this.seats[this.turn].isBot)return;this.botPending=true;const token=++this.botToken,side=this.turn;this.setTimeout(()=>{if(token!==this.botToken)return;this.botPending=false;if(!this.seats[side].isBot||this.turn!==side)return;if(this.phase==='bidding')this.acceptBid(side,this.botBid(side));else if(this.phase==='playing'){const i=this.chooseBotCard(side);if(i>=0)this.playCard(side,i);}},330);}
    invalidateBot(){this.botToken++;this.botPending=false;}
    render(){
        let status='Welcome to the table';if(this.phase==='bidding')status=`${this.seats[this.turn].name} is bidding`;else if(this.phase==='playing')status=`${this.seats[this.turn].name}'s turn`;else if(this.phase==='roundOver')status='Hand complete';else if(this.phase==='gameOver')status=this.teamScores[0]===this.teamScores[1]?'Table tied':`${this.teamScores[0]>this.teamScores[1]?'North & South':'East & West'} win`;
        this.status.node.text={text:status,x:50,y:16,size:2.5,align:'center',color:T.cream,font:'default'};this.score.node.text={text:`North & South  ${this.teamScores[0]}  ·  ${this.bags[0]} bags     East & West  ${this.teamScores[1]}  ·  ${this.bags[1]} bags`,x:50,y:20,size:1.6,align:'center',color:T.muted,font:'default'};
        const pos=[[50,25],[86,46],[50,65],[14,46]];for(let s=0;s<4;s++){const bid=this.bids[s]===null?'':` · ${this.bids[s]===0?'nil':this.bids[s]}`;this.seatTexts[s].node.text={text:`${this.seats[s].name}${bid}`,x:pos[s][0],y:pos[s][1],size:1.6,align:'center',color:s===this.turn&&(this.phase==='playing'||this.phase==='bidding')?T.gold:T.soft,font:'default'};}
        for(let i=0;i<4;i++){const p=this.trick.find(x=>x.side===i);if(p){this.trickCards[i].node.playerIds=[];setCard(this.trickCards[i],p.card);}else this.trickCards[i].node.playerIds=[0];}
        this.nextButton.node.playerIds=(this.phase==='roundOver'||this.phase==='gameOver')?[]:[0];if(this.nextButton._label)this.nextButton._label.node.text={text:this.phase==='gameOver'?'New game':'Next hand',x:50,y:57.8,size:1.8,align:'center',color:T.cream,font:'default'};
        for(const key of Object.keys(this.players)){const p=this.players[key];if(p.seat<0)continue;const side=p.seat,view=p.view,legal=new Set(this.phase==='playing'&&this.turn===side?this.legalIndices(side):[]);for(let i=0;i<13;i++){const c=this.hands[side][i];if(!c){view.slots[i].node.playerIds=[0];continue;}view.slots[i].node.playerIds=[Number(key)];setCard(view.slots[i],c,false,legal.has(i));}let hint=this.lastEvent;if(this.phase==='bidding'&&this.turn===side)hint='How many tricks can you win? Nil means zero';else if(this.phase==='playing'&&this.turn===side)hint=this.trick.length===4?'Trick complete · Next play coming up':this.trick.length?'Play a • card · Follow the lead suit if you can':'Play a • card to start the trick';view.hint.node.text={text:hint||'',x:50,y:(this.phase==='bidding'&&this.turn===side?30.5:68.5),size:1.9,align:'center',color:T.soft,font:'default'};for(let b=0;b<view.bidButtons.length;b++)showButton(view.bidButtons[b],this.phase==='bidding'&&this.turn===side?[Number(key)]:[0]);}
        this.base.node.onStateChange();
    }
}
module.exports=Spades;
