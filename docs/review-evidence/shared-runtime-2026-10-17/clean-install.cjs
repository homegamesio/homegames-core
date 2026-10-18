'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createRequire}=require('node:module');
const base='/Users/josephgarcia/homegames', result={};
for(const name of ['homegames-common','homegames-core','homegamesio']) {
    const dir=fs.mkdtempSync(path.join(__dirname,'clean-'+name+'-'));
    for(const file of ['package.json','package-lock.json']) fs.copyFileSync(path.join(base,name,file),path.join(dir,file));
    const original=fs.readFileSync(path.join(dir,'package-lock.json'));
    fs.writeFileSync(path.join(__dirname,name+'-clean-install.log'),execFileSync(process.execPath,
        ['/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js','ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund',
         '--prefer-offline','--fetch-retries=0','--fetch-timeout=20000','--cache','/tmp/hg-runtime-npm-cache'],
        {cwd:dir,encoding:'utf8',maxBuffer:16*1024*1024}));
    if(!fs.readFileSync(path.join(dir,'package-lock.json')).equals(original)) throw Error('Lock changed: '+name);
    const req=createRequire(path.join(dir,'package.json'));
    const shared=name==='homegames-common'?req:createRequire(req.resolve('homegames-common/package.json'));
    result[name]={homepad:shared('homepad/package.json').version,ws:shared('ws/package.json').version,
        common:name==='homegames-common'?req('./package.json').version:req('homegames-common/package.json').version};
    if(name!=='homegames-common')result[name].client=req('homegames-client/package.json').version;
    if(result[name].homepad!=='0.2.1'||result[name].ws!=='7.5.13')throw Error('Dependency mismatch: '+name);
}
console.log(JSON.stringify({purpose:'fresh production lockfile installs; registry baseline, not unpublished security code',result},null,2));
