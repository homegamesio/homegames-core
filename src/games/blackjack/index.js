const { Game, GameNode, Shapes, ShapeUtils } = require('squish-142');
const { T, text, button, showButton, card, setCard, tableRoot } = require('./theme');

const SUITS = ['C','D','S','H'];
const SYMBOL = { C:'♣', D:'♦', S:'♠', H:'♥' };
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

class Blackjack extends Game {
    static metadata() {
        return {
            squishVersion:'142',
            name:'Blackjack',
            author:'Homegames',
            description:'A warm multiplayer blackjack table with chips, doubles, pair splitting, and dealer play.',
            aspectRatio:{x:1,y:1},
            maxPlayers:4,
            services:['multiplayer']
        };
    }

    constructor() {
        super();
        const table = tableRoot();
        this.base = table.root;
        this.players = {};
        this.seats = [null,null,null,null];
        this.phase = 'waiting';
        this.deck = [];
        this.dealer = [];
        this.dealerHidden = true;
        this.turnSeat = -1;
        this.round = 1;
        this.botToken = 0;
        this.lastEvent = '';

        this.title = text('Blackjack',50,6,4.2,T.cream);
        this.subtitle = text('Get closer to 21 than the dealer · Play chips only',50,11.5,1.8,T.muted);
        this.status = text('Welcome to the table',50,16,1.8,T.cream);
        this.base.addChildren(this.title,this.subtitle,this.status);

        this.dealerLabel = text('Dealer',50,22,1.25,T.soft);
        this.base.addChild(this.dealerLabel);
        this.dealerCards = this.makeCardRow(50,26,7,6.4,11);
        this.base.addChildren(...this.dealerCards);

        this.handCards = [];
        this.handTexts = [];
        this.seatTexts = [];
        const centers = [[50,66],[77,46],[50,43],[23,46]];
        for (let s=0;s<4;s++) {
            this.handCards[s] = [];
            this.handTexts[s] = [];
            for (let h=0;h<2;h++) {
                const y = centers[s][1] + h * 9.2;
                const row = this.makeCardRow(centers[s][0], y, 6, 4.7, 8.1);
                this.handCards[s][h] = row;
                this.base.addChildren(...row);
                const ht = text('', centers[s][0], y + 8.4, 0.9, T.muted);
                this.handTexts[s][h] = ht;
                this.base.addChild(ht);
            }
            const labelY = centers[s][1] + 18.4;
            this.seatTexts[s] = text('',centers[s][0],labelY,1.03,T.soft);
            this.base.addChild(this.seatTexts[s]);
        }

        this.nextButton = button(39,88,22,7,'Next round',(pid)=>this.nextRound(pid));
        this.nextButton.node.playerIds=[0];
        this.base.addChild(this.nextButton);
        this.render();
    }

    getLayers(){ return [{root:this.base}]; }

    makeCardRow(cx,y,count,w,h) {
        const out=[],gap=0.7,total=count*w+(count-1)*gap,start=cx-total/2;
        for(let i=0;i<count;i++){
            const c=card(start+i*(w+gap),y,w,h);
            c.node.playerIds=[0];
            out.push(c);
        }
        return out;
    }

    buildDeck() {
        const d=[];
        for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r,symbol:SYMBOL[s],id:`${r}${s}`});
        return d;
    }

    shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
    draw(){ if(!this.deck.length)this.deck=this.shuffle(this.buildDeck()); return this.deck.pop(); }

    newHand(cards, bet, fromSplit=false) {
        return { cards: cards || [], bet, stood:false, doubled:false, outcome:'', fromSplit, splitAces:false };
    }

    handleNewPlayer({playerId,info}) {
        if(this.players[playerId])return;
        const seat=this.seats.findIndex(x=>x===null);
        const name=info&&info.name?String(info.name).trim().slice(0, 14):`Player ${playerId}`;
        const view=this.createView(playerId);
        this.players[playerId]={seat,name,view,bankroll:100,bet:10,ready:false,hands:[],activeHand:0,inRound:false};
        this.base.addChild(view.root);
        if(seat>=0)this.seats[seat]=playerId;
        if(this.phase==='waiting')this.phase='betting';
        this.render();
    }

    createView(playerId) {
        const root=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:ShapeUtils.rectangle(0,0,0,0),playerIds:[playerId]});
        const hint=text('',50,82,1.1,T.soft,[playerId]);
        root.addChild(hint);
        const chip5=button(10,90,11,6,'5',(pid)=>this.setBet(pid,5),[playerId],T.wood);
        const chip10=button(23,90,11,6,'10',(pid)=>this.setBet(pid,10),[playerId],T.wood);
        const chip25=button(36,90,11,6,'25',(pid)=>this.setBet(pid,25),[playerId],T.wood);
        const chip50=button(49,90,11,6,'50',(pid)=>this.setBet(pid,50),[playerId],T.wood);
        const deal=button(65,90,18,6,'Deal',(pid)=>this.ready(pid),[playerId],T.good);
        const fresh=button(37,90,26,6,'New stack',(pid)=>this.newStack(pid),[0],T.gold);
        const hit=button(18,90,16,6,'Hit',(pid)=>this.hit(pid),[0],T.wood);
        const stand=button(36,90,16,6,'Stand',(pid)=>this.stand(pid),[0],T.wood);
        const dbl=button(54,90,16,6,'Double',(pid)=>this.double(pid),[0],T.gold);
        const split=button(72,90,16,6,'Split',(pid)=>this.split(pid),[0],T.wood);
        root.addChildren(chip5,chip10,chip25,chip50,deal,fresh,hit,stand,dbl,split);
        return{root,hint,chip5,chip10,chip25,chip50,deal,fresh,hit,stand,dbl,split};
    }

    handlePlayerDisconnect(playerId) {
        const p=this.players[playerId]; if(!p)return;
        this.base.removeChild(p.view.root.id);
        if(p.seat>=0&&this.seats[p.seat]===playerId)this.seats[p.seat]=null;
        const wasActing=this.phase==='playing'&&p.inRound&&p.seat===this.turnSeat;
        delete this.players[playerId];
        if(wasActing)this.advancePlayer();
        if(!Object.keys(this.players).length)this.phase='waiting';
        this.render();
    }

    activePlayers(){ return Object.values(this.players).filter(p=>p.seat>=0); }
    setBet(playerId,amount){const p=this.players[playerId];if(!p||this.phase!=='betting'||p.ready||p.bankroll<amount)return;p.bet=amount;this.render();}
    newStack(playerId){const p=this.players[playerId];if(!p||this.phase!=='betting'||p.ready||p.bankroll>=5)return;p.bankroll=100;p.bet=10;this.lastEvent=`${p.name} takes a fresh stack`;this.render();}
    ready(playerId){const p=this.players[playerId];if(!p||this.phase!=='betting'||p.ready||p.bankroll<p.bet||p.bet<5)return;p.ready=true;this.render();const joined=this.activePlayers();if(joined.length&&joined.every(x=>x.ready))this.dealRound();}

    dealRound() {
        this.deck=this.shuffle(this.buildDeck());
        this.dealer=[];
        this.dealerHidden=true;
        for(const p of this.activePlayers()){
            p.hands=[];p.activeHand=0;p.inRound=p.ready;
            if(p.inRound){p.bankroll-=p.bet;p.hands=[this.newHand([],p.bet,false)];}
        }
        const active=this.activePlayers().filter(p=>p.inRound).sort((a,b)=>a.seat-b.seat);
        for(let n=0;n<2;n++){
            for(const p of active)p.hands[0].cards.push(this.draw());
            this.dealer.push(this.draw());
        }
        for(const p of active){
            const h=p.hands[0];
            if(this.isNatural(h)){h.stood=true;h.outcome='Blackjack';}
        }
        this.phase='playing';
        const first=active.find(p=>this.hasActionableHand(p));
        if(first){this.turnSeat=first.seat;this.lastEvent=`${first.name}'s hand`;}
        else this.startDealer();
        this.render();
    }

    handValue(handOrCards) {
        const cards=Array.isArray(handOrCards)?handOrCards:handOrCards.cards;
        let total=0,aces=0;
        for(const c of cards){if(c.rank==='A'){total+=11;aces++;}else if(['K','Q','J'].includes(c.rank))total+=10;else total+=Number(c.rank);}
        while(total>21&&aces){total-=10;aces--;}
        return{total,soft:aces>0};
    }

    isNatural(hand){return !hand.fromSplit&&hand.cards.length===2&&this.handValue(hand).total===21;}
    hasActionableHand(p){return p.inRound&&p.hands.some(h=>!h.stood);}
    currentPlayer(playerId){const p=this.players[playerId];return p&&this.phase==='playing'&&p.inRound&&p.seat===this.turnSeat?p:null;}
    currentHand(p){if(!p)return null;return p.hands[p.activeHand]||null;}

    hit(playerId) {
        const p=this.currentPlayer(playerId),h=this.currentHand(p); if(!h||h.stood)return;
        h.cards.push(this.draw());
        const v=this.handValue(h).total;
        if(v>=21){h.stood=true;h.outcome=v>21?'Bust':'';this.advanceHandOrPlayer(p);}else{this.lastEvent=`${p.name} takes a card`;this.render();}
    }

    stand(playerId){const p=this.currentPlayer(playerId),h=this.currentHand(p);if(!h||h.stood)return;h.stood=true;this.lastEvent=`${p.name} stands`;this.advanceHandOrPlayer(p);}

    double(playerId) {
        const p=this.currentPlayer(playerId),h=this.currentHand(p);
        if(!h||h.stood||h.cards.length!==2||p.bankroll<h.bet)return;
        p.bankroll-=h.bet;h.bet*=2;h.doubled=true;h.cards.push(this.draw());h.stood=true;
        if(this.handValue(h).total>21)h.outcome='Bust';
        this.lastEvent=`${p.name} doubles`;
        this.advanceHandOrPlayer(p);
    }

    splitValue(card) {
        if (!card) return -1;
        if (card.rank === 'A') return 11;
        if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10;
        return Number(card.rank);
    }

    canSplit(p,h) {
        return !!(p&&h&&!h.stood&&p.hands.length===1&&h.cards.length===2&&this.splitValue(h.cards[0])===this.splitValue(h.cards[1])&&p.bankroll>=h.bet);
    }

    split(playerId) {
        const p=this.currentPlayer(playerId),h=this.currentHand(p);
        if(!this.canSplit(p,h))return;
        p.bankroll-=h.bet;
        const second=this.newHand([h.cards.pop()],h.bet,true);
        h.fromSplit=true;
        h.cards.push(this.draw());
        second.cards.push(this.draw());
        p.hands.push(second);
        p.activeHand=0;
        if(h.cards[0].rank==='A'){
            h.splitAces=true;second.splitAces=true;h.stood=true;second.stood=true;h.outcome='Split aces';second.outcome='Split aces';
            this.lastEvent=`${p.name} splits aces`;
            this.advancePlayer();
        }else{
            this.lastEvent=`${p.name} splits the pair`;
            this.render();
        }
    }

    advanceHandOrPlayer(p) {
        for(let i=p.activeHand+1;i<p.hands.length;i++)if(!p.hands[i].stood){p.activeHand=i;this.lastEvent=`${p.name} · hand ${i+1}`;this.render();return;}
        this.advancePlayer();
    }

    advancePlayer() {
        const active=this.activePlayers().filter(p=>p.inRound).sort((a,b)=>a.seat-b.seat);
        for(const p of active){
            if(p.seat<=this.turnSeat)continue;
            const idx=p.hands.findIndex(h=>!h.stood);
            if(idx>=0){p.activeHand=idx;this.turnSeat=p.seat;this.lastEvent=`${p.name}'s hand`;this.render();return;}
        }
        this.startDealer();
    }

    startDealer(){this.phase='dealer';this.turnSeat=-1;this.dealerHidden=false;this.lastEvent='Dealer reveals the hole card';this.render();this.dealerStep();}
    dealerStep(){const token=++this.botToken;this.setTimeout(()=>{if(token!==this.botToken||this.phase!=='dealer')return;const v=this.handValue(this.dealer);if(v.total<17){this.dealer.push(this.draw());this.lastEvent='Dealer takes a card';this.render();this.dealerStep();}else this.settle();},420);}

    settle() {
        const dealer=this.handValue(this.dealer).total,dealerBJ=this.dealer.length===2&&dealer===21;
        for(const p of this.activePlayers().filter(p=>p.inRound)){
            for(const h of p.hands){
                const val=this.handValue(h).total;let pay=0;
                if(val>21)h.outcome='Bust';
                else if(this.isNatural(h)&&!dealerBJ){pay=h.bet*2.5;h.outcome='Blackjack';}
                else if(dealer>21){pay=h.bet*2;h.outcome='Win';}
                else if(dealerBJ&&!this.isNatural(h))h.outcome='Dealer blackjack';
                else if(val>dealer){pay=h.bet*2;h.outcome='Win';}
                else if(val===dealer){pay=h.bet;h.outcome='Push';}
                else h.outcome='Dealer wins';
                p.bankroll+=pay;
            }
        }
        this.phase='roundOver';
        this.lastEvent=dealer>21?'Dealer busts':`Dealer has ${dealer}`;
        this.render();
    }

    nextRound(playerId) {
        if(this.phase!=='roundOver'||!this.players[playerId])return;
        for(const p of this.activePlayers()){
            p.ready=false;p.inRound=false;p.hands=[];p.activeHand=0;
            p.bet=p.bankroll>=10?10:(p.bankroll>=5?5:0);
        }
        this.dealer=[];this.phase='betting';this.round++;this.lastEvent='';this.render();
    }

    render() {
        let status='Welcome to the table';
        if(this.phase==='betting')status='Place your bet';
        else if(this.phase==='playing'){const pid=this.seats[this.turnSeat],p=pid?this.players[pid]:null;status=p?`${p.name}'s turn`:'Playing';}
        else if(this.phase==='dealer')status='Dealer plays';
        else if(this.phase==='roundOver')status=this.lastEvent;
        this.status.node.text={text:status,x:50,y:16,size:2.5,align:'center',color:this.phase==='roundOver'?T.gold:T.cream,font:'default'};

        for(let i=0;i<this.dealerCards.length;i++){
            const c=this.dealer[i],n=this.dealerCards[i];
            if(!c){n.node.playerIds=[0];continue;}
            n.node.playerIds=[];
            if(i===1&&this.dealerHidden){n.node.fill=[74,92,72,255];n.node.color=T.gold;n._rank.node.text={text:'',x:n._rank.node.text.x,y:n._rank.node.text.y,size:n._rank.node.text.size,align:'left',color:T.ink,font:'default'};n._suit.node.text={text:'◆',x:n._suit.node.text.x,y:n._suit.node.text.y,size:n._suit.node.text.size,align:'center',color:T.gold,font:'default'};}
            else setCard(n,c);
        }

        const centers=[[50,85.2],[77,64.4],[50,61.4],[23,64.4]];
        for(let s=0;s<4;s++){
            const pid=this.seats[s],p=pid?this.players[pid]:null;
            for(let h=0;h<2;h++){
                const hand=p&&p.inRound?p.hands[h]:null;
                for(let i=0;i<this.handCards[s][h].length;i++){
                    const n=this.handCards[s][h][i],c=hand?hand.cards[i]:null;
                    if(c){n.node.playerIds=[];setCard(n,c,h===p.activeHand&&p.seat===this.turnSeat&&this.phase==='playing');}
                    else n.node.playerIds=[0];
                }
                const label=this.handTexts[s][h];
                let txt='';
                if(hand){const value=this.handValue(hand).total;txt=`${value}${hand.outcome?` · ${hand.outcome}`:''}${p.hands.length>1?` · hand ${h+1}`:''}`;}
                label.node.text={text:txt,x:label.node.text.x,y:label.node.text.y,size:0.9,align:'center',color:hand&&h===p.activeHand&&p.seat===this.turnSeat&&this.phase==='playing'?T.gold:T.muted,font:'default'};
            }
            this.seatTexts[s].node.text={text:p?`${p.name} · ${Math.floor(p.bankroll)} chips`:'',x:centers[s][0],y:centers[s][1],size:1.6,align:'center',color:p&&p.seat===this.turnSeat?T.gold:T.soft,font:'default'};
        }

        this.nextButton.node.playerIds=this.phase==='roundOver'?[]:[0];
        for(const key of Object.keys(this.players)){
            const p=this.players[key],v=p.view,pid=Number(key);
            const betting=this.phase==='betting'&&!p.ready&&p.seat>=0&&p.bankroll>=5;
            showButton(v.chip5,betting&&p.bankroll>=5?[pid]:[0]);
            showButton(v.chip10,betting&&p.bankroll>=10?[pid]:[0]);
            showButton(v.chip25,betting&&p.bankroll>=25?[pid]:[0]);
            showButton(v.chip50,betting&&p.bankroll>=50?[pid]:[0]);
            showButton(v.deal,betting?[pid]:[0]);
            showButton(v.fresh,this.phase==='betting'&&!p.ready&&p.bankroll<5?[pid]:[0]);
            const acting=this.phase==='playing'&&p.inRound&&p.seat===this.turnSeat;
            const h=acting?this.currentHand(p):null;
            showButton(v.hit,acting&&h&&!h.stood?[pid]:[0]);
            showButton(v.stand,acting&&h&&!h.stood?[pid]:[0]);
            showButton(v.dbl,acting&&h&&!h.stood&&h.cards.length===2&&p.bankroll>=h.bet?[pid]:[0]);
            showButton(v.split,acting&&this.canSplit(p,h)?[pid]:[0]);
            let hint='';
            if(this.phase==='betting'&&!p.ready&&p.bankroll<5)hint='Your stack is empty';
            else if(betting)hint=`Choose play chips, then Deal · ${p.bet} selected`;
            else if(this.phase==='betting'&&p.ready)hint='Waiting for the table…';
            else if(acting&&h)hint=p.hands.length>1?`Hand ${p.activeHand+1} of ${p.hands.length} · ${this.handValue(h).total}`:`${this.handValue(h).total} total · Hit: another card · Stand: keep your hand`;
            else if(this.phase==='roundOver'&&p.inRound)hint=p.hands.map((h,i)=>`${p.hands.length>1?`H${i+1} `:''}${h.outcome}`).join(' · ');
            v.hint.node.text={text:hint,x:50,y:82,size:1.9,align:'center',color:T.soft,font:'default'};
        }
        this.base.node.onStateChange();
    }
}

module.exports=Blackjack;
