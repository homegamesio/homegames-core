'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('/Users/josephgarcia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='/Users/josephgarcia/homegames/homegames-core/docs/review-evidence/live-deployment-2026-10-18';
const base='https://homegames.io';
const results={at:new Date().toISOString(),checks:[],errors:[],httpFailures:[],requestFailures:[],issues:[],rtc:[]};
const sanitize=value=>{try{const u=new URL(value);return u.origin+u.pathname;}catch{return String(value).slice(0,120);}};
async function instrument(context){
 context.on('page',p=>{p.setDefaultTimeout(25000);p.on('pageerror',e=>results.errors.push({page:sanitize(p.url()),message:e.message}));p.on('response',r=>{if(r.status()>=400)results.httpFailures.push({url:sanitize(r.url()),status:r.status()});});p.on('requestfailed',r=>{const msg=r.failure()?.errorText;if(msg!=='net::ERR_ABORTED')results.requestFailures.push({url:sanitize(r.url()),message:msg});});p.on('dialog',d=>d.accept());});
 await context.addInitScript(()=>{
  window.testLabels=[];window.testDraws=0;window.testAudio=0;window.testEnergy=0;window.testPeers=[];
  const clear=CanvasRenderingContext2D.prototype.clearRect,fill=CanvasRenderingContext2D.prototype.fill,rect=CanvasRenderingContext2D.prototype.fillRect,text=CanvasRenderingContext2D.prototype.fillText,start=AudioBufferSourceNode.prototype.start;
  CanvasRenderingContext2D.prototype.clearRect=function(...a){window.testLabels=[];return clear.apply(this,a);};
  CanvasRenderingContext2D.prototype.fill=function(...a){window.testDraws++;return fill.apply(this,a);};
  CanvasRenderingContext2D.prototype.fillRect=function(...a){window.testDraws++;return rect.apply(this,a);};
  CanvasRenderingContext2D.prototype.fillText=function(t,...a){window.testDraws++;window.testLabels.push(String(t));return text.call(this,t,...a);};
  AudioBufferSourceNode.prototype.start=function(...a){window.testAudio++;const b=this.buffer?.getChannelData(0);if(b)for(let i=0;i<b.length;i+=32)window.testEnergy+=Math.abs(b[i]);return start.apply(this,a);};
  const Peer=window.RTCPeerConnection;if(Peer)window.RTCPeerConnection=class extends Peer{constructor(...args){super(...args);window.testPeers.push(this);}};
 });
}
async function gameFrame(p,text){const end=Date.now()+35000;while(Date.now()<end){for(const f of p.frames()){if(await f.evaluate(text=>window.testDraws>0&&document.querySelector('canvas')&&(!text||window.testLabels.includes(text)),text).catch(()=>false))return f;}await p.waitForTimeout(100);}throw Error('Game did not render: '+sanitize(p.url()));}
async function tap(f,x,y){const b=await f.locator('canvas').first().boundingBox();await f.page().touchscreen.tap(b.x+b.width*x/100,b.y+b.height*y/100);await f.page().waitForTimeout(150);}
async function waitText(f,text){await f.waitForFunction(text=>window.testLabels.some(t=>t.includes(text)),text);}
async function download(p,label,filename){const b=p.getByRole('button',{name:label,exact:true});if(!await b.isVisible())await p.getByRole('button',{name:'More',exact:true}).click({delay:100});const promise=p.waitForEvent('download');await b.click({delay:100});const file=path.join(output,filename);await(await promise).saveAs(file);return file;}
async function rtcStats(p,label){for(const f of p.frames()){const peers=await f.evaluate(async()=>Promise.all((window.testPeers||[]).map(async pc=>{const stats=[...(await pc.getStats()).values()];return {state:pc.connectionState,ice:pc.iceConnectionState,servers:pc.getConfiguration().iceServers.map(s=>s.urls),selected:stats.filter(s=>s.type==='candidate-pair'&&s.state==='succeeded').map(s=>({nominated:s.nominated,bytesSent:s.bytesSent,bytesReceived:s.bytesReceived,localType:stats.find(c=>c.id===s.localCandidateId)?.candidateType,remoteType:stats.find(c=>c.id===s.remoteCandidateId)?.candidateType})),channels:stats.filter(s=>s.type==='data-channel').map(s=>({state:s.state,messagesSent:s.messagesSent,messagesReceived:s.messagesReceived}))};}))).catch(()=>[]);if(peers.length)results.rtc.push({label,peers});}}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});results.browser=browser.version();let current;
 try{
  const ctx=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true,acceptDownloads:true});await instrument(ctx);
  const p=current=await ctx.newPage();await p.goto(base);assert.match(await p.locator('body').innerText(),/Homegames is a free and open source platform that lets you play, make and share games without an account/);
  assert.equal(await p.locator('.game-card').count(),12);await p.screenshot({path:path.join(output,'homepage-desktop.png'),fullPage:true});
  await p.setViewportSize({width:390,height:844});for(const page of ['/','/about.html','/catalog.html']){await p.goto(base+page);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:path.join(output,(page==='/'?'homepage':page.slice(1,-5))+'-mobile.png'),fullPage:true});}results.checks.push('Homepage user copy, 12 featured cards, phone-width home/about/catalog without horizontal overflow');console.log('PASS public pages');
  await p.setViewportSize({width:1280,height:900});await p.goto(base+'/studio.html?examples=1');await p.locator('#studio-examples').waitFor();await p.waitForFunction(()=>!document.getElementById('example-copy').disabled);await gameFrame(p);await p.screenshot({path:path.join(output,'studio-examples.png')});results.checks.push('Live Studio examples open and preview draws');console.log('PASS Studio examples');
  const catalog=await(await ctx.request.get(base+'/games.json')).json();
  for(const id of catalog.featuredGames){try{await p.goto(base+'/play.html?game='+id);const f=await gameFrame(p);await p.waitForTimeout(750);results.checks.push({game:id,rendered:true,labels:await f.evaluate(()=>window.testLabels.slice(0,9))});await p.screenshot({path:path.join(output,id+'-live.png')});console.log('PASS featured startup:',id);}catch(e){results.issues.push({stage:'startup',game:id,message:e.message});}}
  await p.goto(base+'/play.html?game=house-band');let f=await gameFrame(p,'DRUMS');await p.locator('#offline-status').filter({hasText:/^Ready offline/}).waitFor();
  await tap(f,32.5,67);await waitText(f,'Saved');const savePath=await download(p,'Download save','house-band-live-save.json');const saved=JSON.parse(fs.readFileSync(savePath)).data;assert.equal(saved.drums[0][1],1);
  await tap(f,18,19);await f.waitForFunction(()=>window.testAudio>4&&window.testEnergy>10);await p.keyboard.press(' ');await waitText(f,'PLAY');assert.equal(await p.getByRole('dialog',{name:'Game options',exact:true}).isVisible(),false);
  await p.reload();f=await gameFrame(p,'DRUMS');await waitText(f,'PLAY');const restored=JSON.parse(fs.readFileSync(await download(p,'Download save','house-band-live-restored.json'))).data;assert.deepEqual(restored,saved);
  const openDialog=p.getByRole('dialog',{name:'Game options',exact:true});if(await openDialog.isVisible())await openDialog.getByRole('button',{name:'Done',exact:true}).click();
  results.checks.push('Published client touch-to-keyboard focus, House Band audio/edit/save/reload');console.log('PASS released Client focus and save/reload');
  await p.getByRole('button',{name:'Invite',exact:true}).click({delay:100});const invite=await f.getByRole('textbox',{name:'Invitation link'}).inputValue();await f.getByRole('button',{name:'Done',exact:true}).click();
  const gc=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});await instrument(gc);const guest=await gc.newPage();await guest.goto(invite);
  try{
   await gameFrame(guest,'DRUMS');await waitText(f,'2 / 8');await tap(guest.mainFrame(),25,8);await tap(f,18,19);await guest.waitForFunction(()=>window.testAudio>4&&window.testEnergy>10);await f.waitForFunction(()=>window.testAudio>4&&window.testEnergy>10);await rtcStats(p,'host');await rtcStats(guest,'guest');
   await guest.screenshot({path:path.join(output,'house-band-guest-phone.png')});await guest.reload();await gameFrame(guest,'DRUMS');await waitText(f,'2 / 8');results.checks.push('Live API private invitation, remote scene/audio on separate browser context, guest rejoin');console.log('PASS live RTC invite and rejoin');
  }catch(e){await rtcStats(p,'host failure');await rtcStats(guest,'guest failure');results.issues.push({stage:'live RTC',message:e.message,guestText:await guest.locator('body').innerText()});console.log('FAIL live RTC:',e.message);}
  const html=await download(p,'Download game file (HTML)','house-band-live.html');await p.close();await guest.waitForTimeout(1500);results.hostClosedMessage=await guest.locator('#status').textContent().catch(()=>null);await gc.close();
  const offline=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,acceptDownloads:true});await instrument(offline);await offline.setOffline(true);const copy=current=await offline.newPage();await copy.goto(pathToFileURL(html).href);const cf=await gameFrame(copy,'DRUMS');await tap(cf,18,19);await cf.waitForFunction(()=>window.testAudio>4&&window.testEnergy>10);await copy.screenshot({path:path.join(output,'house-band-downloaded-offline.png')});results.checks.push('Downloaded live HTML plays with network disabled');console.log('PASS live download opened offline');await offline.close();await ctx.close();
 }catch(e){results.issues.push({stage:'browser flow',message:e.stack});if(current&&!current.isClosed())await current.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});console.error(e);}
 finally{await browser.close();fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({checks:results.checks.length,errors:results.errors,httpFailures:results.httpFailures,requestFailures:results.requestFailures,issues:results.issues,rtc:results.rtc},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
