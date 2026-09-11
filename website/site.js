const config = window.WEEKABOO_SITE || {sounds:[],downloads:{}};
const mascotButton = document.querySelector('.mascot-button');
let audio, previous = -1, replay = 0;
mascotButton?.addEventListener('click', () => {
  const mascot = document.getElementById('mascot');
  mascot.src = `./assets/weekaboo-peek.svg?hello=${++replay}`;
  audio?.pause();
  const sounds = config.sounds || [];
  if (!sounds.length) return;
  let choice = Math.floor(Math.random() * sounds.length);
  if (sounds.length > 1 && choice === previous) choice = (choice + 1) % sounds.length;
  previous = choice;
  audio = new Audio(`./assets/audio/${sounds[choice]}`);
  audio.volume = .55;
  audio.play().catch(() => { document.getElementById('mascot-status').textContent = 'A little wave from Weekaboo.'; });
});
document.addEventListener('visibilitychange', () => { if(document.hidden) audio?.pause(); });
const fictional = [
  [{title:'A slow start ☕', time:'9:00', duration:45,type:'personal'},{title:'Design catch-up',time:'10:30',duration:60,type:'work'},{title:'A walk, just because',time:'13:00',duration:45,type:'green'}],
  [{title:'Make something good',time:'9:30',duration:90,type:'work'},{title:'Lunch with a friend',time:'12:00',duration:60,type:'personal'}],
  [{title:'A little focus time',time:'9:00',duration:90,type:'work'},{title:'Flowers for home',time:'12:30',duration:45,type:'personal'}],
  [{title:'Team check-in',time:'10:00',duration:60,type:'work'},{title:'An afternoon off',time:'12:00',duration:120,type:'green'}],
  [{title:'Finish a little early',time:'12:00',duration:90,type:'green'}],
  [{title:'Market morning',time:'9:30',duration:90,type:'personal'}],
  [{title:'Absolutely nothing',time:'11:00',duration:90,type:'green'}],
];
const calendar = document.getElementById('calendar-demo');
function eventPosition(event) {
  const [hour, minute] = event.time.split(':').map(Number);
  return `--top:${((hour - 9) * 60 + minute) / 3}%;--height:${event.duration / 3}%`;
}
function readableTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2,'0')}`;
}
function showCalendar(view) {
  if(!calendar) return;
  calendar.dataset.view=view;
  document.querySelectorAll('[data-view]').forEach(button => {if(button.tagName==='BUTTON') button.setAttribute('aria-pressed',String(button.dataset.view===view));});
  if(view==='month') {
    document.getElementById('preview-range').textContent='A little look at the whole month';
    calendar.innerHTML=`<div class="month-preview">${Array.from({length:35},(_,i)=>{const date=i===0?31:i>30?i-30:i;const event={3:'Coffee with Sam',8:'Design catch-up',14:'A slow start ☕',16:'Flowers for home',19:'Market morning',24:'An afternoon off',27:'Lunch with Mum'}[i];return `<div class="month-cell ${i===14?'current':''}"><b>${date}</b>${event?`<span>${event}</span>`:''}</div>`;}).join('')}</div>`;
    return;
  }
  const count=view==='day'?1:view==='week'?7:4;
  document.getElementById('preview-range').textContent=count===1?'Monday, 14 September':`14–${13+count} September`;
  calendar.innerHTML=`<div class="demo-grid" style="--days:${count}"><div class="time-gutter"><span>9 am</span><span>10 am</span><span>11 am</span><span>12 pm</span><span>1 pm</span><span>2 pm</span></div>${fictional.slice(0,count).map((events,index)=>`<div class="day-column ${index===0?'today':''}"><div class="demo-day-title">${['MON','TUE','WED','THU','FRI','SAT','SUN'][index]} <strong>${14+index}</strong></div><div class="day-events">${events.map(e=>`<div class="demo-event ${e.type}" style="${eventPosition(e)}" title="${e.title}, ${readableTime(e.time)}"><strong>${e.title}</strong><span>${readableTime(e.time)}</span></div>`).join('')}${index===0?'<div class="now-line"></div>':''}</div></div>`).join('')}</div>`;
}
document.querySelectorAll('.view-switch button').forEach(button=>button.addEventListener('click',()=>showCalendar(button.dataset.view)));
showCalendar('four');
document.querySelectorAll('.demo-task input').forEach(input=>input.addEventListener('change',()=>{document.getElementById('task-count').textContent=document.querySelectorAll('.demo-task input:not(:checked)').length;}));
function safeLink(value) {try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch {return null;} }
const source = safeLink(config.sourceUrl);
if(source) for(const link of document.querySelectorAll('[data-source-link]')) {link.href=source;link.hidden=false;}
for(const item of document.querySelectorAll('[data-download]')) {
  const url=safeLink(config.downloads?.[item.dataset.download]);if(!url) continue;
  const link=document.createElement('a');link.href=url;link.className='availability';link.textContent={android:'Get Weekaboo for Android ↗',ios:'Get Weekaboo for iPhone & iPad ↗',macos:'Get Weekaboo for Mac ↗'}[item.dataset.download];item.replaceWith(link);
}
