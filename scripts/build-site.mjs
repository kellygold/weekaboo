import {readFile, writeFile, mkdir, cp, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist-site');
const config = JSON.parse(await readFile(path.join(root, 'website/site.config.json'), 'utf8'));
for (const link of [config.sourceUrl, ...Object.values(config.downloads)]) {
  if (link && new URL(link).protocol !== 'https:') throw new Error('Public site links must use HTTPS.');
}
if (config.domain && !/^[a-z0-9.-]+$/.test(config.domain)) throw new Error('Invalid site domain.');
await rm(output, {recursive:true, force:true});
await mkdir(path.join(output,'assets/audio'), {recursive:true});
for (const file of ['index.html','privacy.html','credits.html','site.css','site.js']) {
  await cp(path.join(root,'website',file), path.join(output,file));
}
for (const file of ['android.svg','google-calendar.webp','Lucide-LICENSE.txt']) await cp(path.join(root,'website/assets',file),path.join(output,'assets',file));
for (const file of ['weekaboo-mark.svg','weekaboo-peek.svg']) {
  const svg = (await readFile(path.join(root,'public/brand',file),'utf8')).replace(/@font-face\{[^}]*\}/g, '');
  await writeFile(path.join(output,'assets',file),svg);
}
await cp(path.join(root,'public/fonts/Nunito-Variable.ttf'),path.join(output,'assets/Nunito-Variable.ttf'));
await cp(path.join(root,'licenses/Nunito-OFL.txt'),path.join(output,'assets/Nunito-OFL.txt'));
// Reuse only Kelly's approved sound list; never publish the rejected candidates.
const manifest=await readFile(path.join(root,'src/mascotSounds.ts'),'utf8');
const sounds=[...manifest.matchAll(/'\/brand\/audio\/([^']+)'/g)].map(match=>match[1]);
for(const sound of sounds) await cp(path.join(root,'public/brand/audio',sound),path.join(output,'assets/audio',sound));
await writeFile(path.join(output,'site-config.js'),`window.WEEKABOO_SITE = ${JSON.stringify({...config,sounds},null,2)};\n`);
await writeFile(path.join(output,'.nojekyll'),'');
if(config.domain) await writeFile(path.join(output,'CNAME'),config.domain+'\n');
console.log('Static Weekaboo site built in dist-site/ (no app data, credentials, or binaries copied).');
