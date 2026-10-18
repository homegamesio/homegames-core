'use strict';
const { performance } = require('node:perf_hooks');
const Dispatcher = require(process.argv[2] + '/game-dispatch');
const measure = fn => {
    for (let n=0;n<100;n++) fn();
    const times=[];
    for (let n=0;n<500;n++) { const start=performance.now(); fn(); times.push(performance.now()-start); }
    times.sort((a,b)=>a-b);
    return { medianMs:times[250], p95Ms:times[475] };
};
const results=[];
for (const count of [1000,10000]) {
    const children=Array.from({length:count},(_,i)=>({node:{id:i+2,children:[]}}));
    const target=children.at(-1);
    Object.assign(target.node,{input:{type:'text',oninput(){}},coordinates2d:[[10,10],[90,10],[90,90],[10,90]],handleClick(){}});
    const root={node:{id:1,children,playerIds:[]}};
    const dispatch=new Dispatcher({getLayers:()=>[{root}]});
    const input=()=>dispatch.handleInput(1,{type:'input',nodeId:target.node.id,input:'a'});
    const visible=measure(input);
    root.node.playerIds=[2]; const privateBranch=measure(input); root.node.playerIds=[];
    dispatch.handleInput(1,{type:'click',data:{x:50,y:50,press:true}});
    const heldPress=measure(()=>dispatch.checkActivePresses());
    results.push({nodes:count+1,visibleTargetAtEnd:visible,privateBranch,heldPress});
}
console.log(JSON.stringify({node:process.version,samples:500,scope:'local dispatch only; flat synthetic tree; not mobile/network latency',results},null,2));
