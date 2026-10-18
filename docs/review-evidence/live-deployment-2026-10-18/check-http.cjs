'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='/Users/josephgarcia/homegames/homegamesio',out='/Users/josephgarcia/homegames/homegames-core/docs/review-evidence/live-deployment-2026-10-18';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results={at:new Date().toISOString(),files:[],api:[],issues:[]};
async function get(url,options={}){const r=await fetch(url,{signal:AbortSignal.timeout(20000),...options});return{status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())};}
(async()=>{
 const manifest=await get('https://homegames.io/site-build.json');const build=JSON.parse(manifest.body);results.build=build;
 const catalogResponse=await get('https://homegames.io/games.json');const catalog=JSON.parse(catalogResponse.body);results.catalog=catalog;
 const installed=fs.readFileSync(path.join(root,'node_modules/homegames-client/dist/homegames-client.js'));
 results.clientVersion=require(path.join(root,'node_modules/homegames-client/package.json')).version;
 results.clientNameMatchesInstalled=build.client===`homegames-client.${sha(installed).slice(0,16)}.js`;
 if(!results.clientNameMatchesInstalled)results.issues.push('Client filename does not match installed release');
 const paths=['/','/site-build.json','/games.json','/site-config.js','/'+build.client,'/about.html','/catalog.html','/docs.html','/how_it_works.html','/self-hosting.html','/terms.html','/privacy.html','/studio.html','/studio.js','/studio-portable.js','/studio-offline.js','/studio-update.js','/studio-sw.js','/game-app-sw.js','/game-app.html','/game-app.js','/game-app-storage.js','/play.html','/play.js','/bundle.js','/app.css','/authoring-guide.md','/license.txt','/runtime-notices.txt'];
 for(const game of catalog.games)paths.push('/games/'+game.id+'.html',game.archive,game.thumbnail);
 for(let i=0;i<paths.length;i+=3){await Promise.all(paths.slice(i,i+3).map(async p=>{try{const r=await get('https://homegames.io'+p);const local=path.join(root,'web',p==='/'?'index.html':p);const same=fs.existsSync(local)&&sha(r.body)===sha(fs.readFileSync(local));results.files.push({path:p,status:r.status,bytes:r.body.length,sha256:sha(r.body),matchesLocalBuild:same,cache:r.headers['cache-control'],type:r.headers['content-type']});if(r.status!==200||!same)results.issues.push({path:p,status:r.status,matchesLocalBuild:same});}catch(e){results.issues.push({path:p,error:e.message});}}));}
 for(const p of ['/health','/cert-status','/rooms','/games','/auth/me','/studio/templates','/assets','/docs/ask']){const r=await get('https://api.homegames.io'+p);results.api.push({path:p,status:r.status,body:p==='/cert-status'?JSON.stringify({...JSON.parse(r.body),certIp:'[redacted]',certDomain:'[redacted]'}):r.body.toString(),cache:r.headers['cache-control']});}
 const ip=(await get('https://api.homegames.io/ip')).body.toString().trim();
 const spoof=(await get('https://api.homegames.io/ip',{headers:{'X-Forwarded-For':'203.0.113.23','X-Real-IP':'203.0.113.23'}})).body.toString().trim();
 results.forwardedAddress={consistent:ip===spoof,spoofAccepted:spoof==='203.0.113.23',loopback:/^(127\.|::1$)/.test(ip)};
 if(ip!==spoof||results.forwardedAddress.loopback)results.issues.push('API forwarded address misconfiguration');
 for(const host of ['homegames.io','api.homegames.io']){const r=await fetch('http://'+host,{redirect:'manual',signal:AbortSignal.timeout(15000)});results.api.push({url:'http://'+host,status:r.status,location:r.headers.get('location')});await r.body?.cancel();}
 const missing=await get('https://homegames.io/launch-review-missing-page');results.missingPage={status:missing.status,hasBrowseGames:missing.body.includes('Browse games')};
 fs.writeFileSync(path.join(out,'http-results.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({clientVersion:results.clientVersion,clientNameMatchesInstalled:results.clientNameMatchesInstalled,checkedFiles:results.files.length,api:results.api,forwardedAddress:results.forwardedAddress,missingPage:results.missingPage,issues:results.issues},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
