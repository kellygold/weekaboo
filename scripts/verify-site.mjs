// Exercise the built static site under a GitHub Pages-style project prefix.
import {chromium, webkit, expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'output/site-validation');
await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.ttf':'font/ttf','.mp3':'audio/mpeg','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/weekaboo/')){res.writeHead(404).end();return;}
  const relative=pathname.slice('/weekaboo/'.length)||'index.html';
  const filename=path.resolve(root,'dist-site',relative);
  if(!filename.startsWith(path.join(root,'dist-site')+path.sep)){res.writeHead(404).end();return;}
  try{const body=await readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream'}).end(body);}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const result=[];
const sourceUrl=JSON.parse(await readFile(path.join(root,'website/site.config.json'),'utf8')).sourceUrl;
try {
  for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]) {
    const browser=await type.launch();
    try {
      for(const [device,width,height] of [['desktop',1440,1000],['tablet',768,1024],['phone',390,844],['small-phone',320,740]]) {
        const page=await browser.newPage({viewport:{width,height}});
        const failures=[],external=[],audioRequests=[];
        page.on('pageerror',error=>failures.push(error.message));
        page.on('response',response=>{if(response.status()>=400) failures.push(`${response.status()} ${response.url()}`);});
        page.on('request',request=>{if(!request.url().startsWith(origin+'/')) external.push(request.url());if(request.url().includes('.mp3'))audioRequests.push(request.url());});
        await page.goto(origin+'/weekaboo/');
        await page.evaluate(()=>document.fonts.ready);
        await expect(page.locator('h1')).toContainText('Your business.');
        if(sourceUrl) {
          await expect(page.locator('[data-source-link]')).toHaveCount(2);
          for(const link of await page.locator('[data-source-link]').all()) await expect(link).toHaveAttribute('href',sourceUrl);
          await expect(page.getByRole('link',{name:'Explore the source on GitHub ↗',exact:true})).toBeVisible();
        } else {
          await expect(page.locator('[data-source-link]:not([hidden])')).toHaveCount(0);
        }
        await expect(page.locator('.day-column')).toHaveCount(4);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        expect(audioRequests).toEqual([]);
        for(const [view,count] of [['day',1],['week',7],['month',35],['four',4]]) {
          const button=page.locator(`button[data-view="${view}"]`);
          await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
          await expect(page.locator(view==='month'?'.month-cell':'.day-column')).toHaveCount(count);
          expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        }
        await page.locator('.demo-task input').first().check();
        await expect(page.locator('#task-count')).toHaveText('2');
        await page.locator('.demo-task input').first().uncheck();
        await expect(page.locator('#task-count')).toHaveText('3');
        await page.locator('.mascot-button').click();
        await expect(page.locator('#mascot')).toHaveAttribute('src',/hello=1/);
        await expect.poll(()=>audioRequests.length).toBeGreaterThan(0);
        await page.evaluate(()=>{audio?.pause();});
        await page.emulateMedia({reducedMotion:'reduce'});
        expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.screenshot({path:path.join(output,`${engine}-${device}.png`),fullPage:true});
        await page.locator('footer a[href="./privacy.html"]').click();
        await expect(page.locator('h1')).toContainText('privacy');
        await page.locator('footer a[href="./credits.html"]').click();
        await expect(page.locator('h1')).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        expect(failures).toEqual([]);expect(external).toEqual([]);
        result.push({engine,device,width,status:'passed',checks:'configured GitHub source links, navigation, views, tasks, mascot audio, reduced motion, asset loads, no external requests, no horizontal overflow'});
        await page.close();
      }
    } finally {await browser.close();}
  }
  await writeFile(path.join(output,'results.json'),JSON.stringify({at:new Date().toISOString(),results:result},null,2)+'\n');
  console.log(`Static site: ${result.length} browser/viewport combinations passed.`);
} finally {server.close();}
