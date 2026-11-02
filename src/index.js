import puppeteer from '@cloudflare/puppeteer';
import {scenarios,sixAM,payload} from './rules.js';
const target='https://betmines.com/football-prediction-generator';
async function api(env,path,body={},run){
 const origin=new URL(env.SITE_URL).origin;if(origin!=='https://daily-picks-ledger.gideonkyei906.chatgpt.site')throw Error('Unexpected private Site origin');
 if(!env.SITE_TOKEN)throw Error('SITE_TOKEN secret not configured');
 const r=await fetch(origin+path,{method:'POST',headers:{'OAI-Sites-Authorization':'Bearer '+env.SITE_TOKEN,'Content-Type':'application/json','X-Daily-Picks':'collect',...(run?{'X-Daily-Picks-Run':run}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 const d=await r.json();if(!r.ok||d.error)throw Error('Site '+r.status+': '+String(d.error||'request failed'));return d;
}
export default {
 async scheduled(event,env,ctx){const stub=env.CAPTURE.get(env.CAPTURE.idFromName('daily'));ctx.waitUntil(stub.fetch('https://internal/arm',{method:'POST',body:JSON.stringify({now:Date.now()})}));},
 async fetch(request,env){const path=new URL(request.url).pathname;if(path==='/health')return Response.json({service:'Daily Picks collector',configured:!!env.SITE_TOKEN,schedule:'06:00 Africa/Accra',manualCollection:false});if(path==='/status'&&env.ADMIN_TOKEN&&request.headers.get('Authorization')==='Bearer '+env.ADMIN_TOKEN)return env.CAPTURE.get(env.CAPTURE.idFromName('daily')).fetch('https://internal/status');return new Response('Not found',{status:404});}
};
export class DailyCapture {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){if(new URL(request.url).pathname==='/status')return Response.json(await this.state.storage.get('status')||{state:'not_started'});const now=Date.now(),at=sixAM(now);if(now>=at)return Response.json({error:'Preparation arrived after 06:00; capture skipped.'},{status:409});await this.state.storage.put('status',{state:'armed',due:new Date(at).toISOString()});await this.state.storage.setAlarm(at);return Response.json({armed:true});}
 async alarm(){const day=new Date().toISOString().slice(0,10);if(await this.state.storage.get('attempt:'+day))return;await this.state.storage.put('attempt:'+day,true);let run,browser,watchdog;const saved=[],failures=[];
 try{
  if(Date.now()>=sixAM(Date.now())+60000)throw Error('Missed strict 06:00 start window; no late capture attempted.');
  const start=await api(this.env,'/api/scheduled-collection');if(start.alreadyStarted)throw Error('Site already started today; existing record left untouched.');run=start.run_id;
  let snapshot=start.snapshot;for(let i=0;snapshot.collectionPending&&i<30;i++)snapshot=await api(this.env,'/api/continue-source',{},run);
  browser=await puppeteer.launch(this.env.BROWSER);watchdog=setTimeout(()=>browser.close().catch(()=>{}),480000);
  for(const rule of scenarios){try{
   const result=await generate(browser,rule,day);await api(this.env,'/api/betmines-capture',payload(rule,day,result),run);saved.push({scenario:rule.key,picks:result.picks?.length||0});
  }catch(e){failures.push({scenario:rule.key,error:String(e.message)});if(/blocked|captcha|verify.*human|access denied/i.test(e.message))break;}}
 }catch(e){failures.push({error:String(e.message)});}
 finally{if(watchdog)clearTimeout(watchdog);if(browser)await browser.close().catch(()=>{});if(run)await api(this.env,'/api/finish-collection',{},run).catch(e=>failures.push({error:String(e.message)}));}
 await api(this.env,'/api/results').catch(e=>failures.push({error:String(e.message)}));
 const status={day,finishedAt:new Date().toISOString(),state:failures.length?'attention':'complete',saved,failures};await this.state.storage.put('status',status);console.log(JSON.stringify(status));
 }
}
async function generate(browser,rule,day){const page=await browser.newPage();page.setDefaultTimeout(30000);try{
 await page.goto(target,{waitUntil:'domcontentloaded'});await page.waitForSelector('#bm-select');
 const text=await page.$eval('body',e=>e.innerText);if(/verify you are human|checking your browser|access denied|captcha/i.test(text))throw Error('Betmines browser blocked; no bypass attempted.');
 const buttons=await page.$$('button');for(const b of buttons){if((await b.evaluate(e=>e.innerText.trim()))==='AGREE'){await b.click();break;}}
 if(rule.events.length>1){await page.select('#bm-select','1X');await page.select('#bm-select','X2');}
 const count=await page.$('[role="slider"][aria-valuemax="20"]');await count.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
 const sliders=await page.$$('[role="slider"][aria-valuemax="4"]');await sliders[0].focus();await page.keyboard.press('Home');for(let n=0;n<Math.round((rule.min-1)*10);n++)await page.keyboard.press('ArrowRight');await sliders[1].focus();await page.keyboard.press('Home');for(let n=0;n<Math.round((rule.max-rule.min)*10);n++)await page.keyboard.press('ArrowRight');
 const verified=await page.evaluate(()=>({sliders:Array.from(document.querySelectorAll('[role="slider"][aria-valuemax="4"]')).map(e=>Number(e.getAttribute('aria-valuenow'))),count:Number(document.querySelector('[role="slider"][aria-valuemax="20"]').getAttribute('aria-valuenow')),today:Array.from(document.querySelectorAll('button')).find(e=>/TODAY/i.test(e.textContent)&&e.className.includes('!tw-bg-bm-primary'))?.innerText,text:document.body.innerText}));
 const expected=day.slice(8,10)+'/'+day.slice(5,7);if(!verified.today?.includes(expected)||verified.count!==2||Math.abs(verified.sliders[0]-rule.min)>0.001||Math.abs(verified.sliders[1]-rule.max)>0.001)throw Error('Visible filters do not match saved scenario');
 if(rule.events.length>1&&(!/Double Chance\s*:\s*1X/i.test(verified.text)||!/Double Chance\s*:\s*X2/i.test(verified.text)))throw Error('Selected event chips unverified');
 await page.click('#bm_button');await page.waitForFunction(()=>{const b=document.querySelector('#bm_button');return b&&b.innerText.trim()==='Search'&&(document.body.innerText.includes('Sorry, there are no available matches.')||Array.from(document.querySelectorAll('a[href*="/matches/predictions-"]')).some(e=>e.querySelectorAll('p').length===2));},{timeout:60000});
 return await page.evaluate(()=>{const evidence=document.body.innerText.slice(0,29000),empty=evidence.includes('Sorry, there are no available matches.');if(empty)return {empty:true,evidence,picks:[]};const picks=[];for(const a of document.querySelectorAll('a[href*="/matches/predictions-"]')){const teams=Array.from(a.querySelectorAll('p')).map(e=>e.textContent.trim());if(teams.length!==2)continue;let row=a.parentElement;for(let i=0;i<4&&row;i++,row=row.parentElement){const links=Array.from(row.querySelectorAll('a')),market=links.find(e=>/^(1X|X2|Over 2\.5|\+2\.5)$/.test(e.innerText.trim())),price=links.find(e=>/^\d+\.\d+$/.test(e.innerText.trim())),time=row.innerText.match(/\b\d{2}:\d{2}\b/);if(market&&price&&time){picks.push({fixture:teams.join(' v '),prediction:/^(\+2\.5|Over 2\.5)$/.test(market.innerText.trim())?'Over 2.5':market.innerText.trim(),odds:Number(price.innerText.trim()),time:time[0],url:a.href});break;}}}return {empty:false,evidence,picks};});
 }finally{await page.close().catch(()=>{});}}
