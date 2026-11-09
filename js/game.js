/* ============ Dark Shy — Relationship Clicker · Girl B ============ */
(() => {
'use strict';

/* ---------------- Config ---------------- */
const {CONFIG, TIERS, COSTUMES, UPGRADES, BOOSTS, PERMS, MISSIONS, RARITY_RATE, DUP_COINS, THEMES} = window.CONTENT;
const {SAVE_KEY, ENERGY_MAX, ENERGY_MS, FREE_PULL_MS, xpNeed} = CONFIG;
TIERS.forEach(t=>{t.art+='.webp'; t.bg+='.webp'; t.lines=DIALOGUE.lines(t.id);});
COSTUMES.forEach(c=>{if(c.img)c.img+='.webp'; c.line=DIALOGUE.COSTUME_LINES[c.id];});
const mobile = () => matchMedia('(max-width:767px)').matches;
window.imgFallback = (img, png) => { if(!img.dataset.failed){img.dataset.failed='1';img.src=png;}else{img.onerror=null;img.src='assets/icons/silhouette.svg';} };
document.addEventListener('error',e=>{if(e.target.tagName==='IMG')imgFallback(e.target,e.target.src.replace(/\.webp$/,'.png'));},true);
/* ---------------- State ---------------- */
const today = () => new Date().toISOString().slice(0,10);
const yesterday = () => new Date(Date.now()-86400e3).toISOString().slice(0,10);

function def(){
  return {
    v:1, coins:0, gems:0, energy:ENERGY_MAX, energyTs:Date.now(),
    level:1, xp:0,
    up:{tap1:0,tap2:0,tap3:0,tap4:0,fan:0,pap:0,mgr:0,agy:0,emp:0},
    boost:{id:null,until:0},
    perm2:false, perm3:false, perm5:false,
    owned:['base'], equip:'base',
    streak:{last:'',count:0},
    daily:{date:today(),d_taps:0,d_earned:0,d_pulls:0,claimed:{}},
    freePull:0, pity:{sr:0,ssr:0},
    stats:{taps:0,coins:0,pulls:0},
    prestige:0, settings:{motion:true},
    friend:'B-'+Math.floor(1000+Math.random()*9000),
    lastSeen:Date.now(), bubbleAt:0, tapTalk:0,
  };
}
let S = def();

function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    S = Object.assign(def(), d);
    S.up = Object.assign(def().up, d.up||{});
    S.stats = Object.assign(def().stats, d.stats||{});
    S.settings = Object.assign(def().settings, d.settings||{});
    S.pity = Object.assign(def().pity, d.pity||{});
    S.daily = Object.assign(def().daily, d.daily||{});
    if(S.daily.date !== today()) S.daily = {date:today(),d_taps:0,d_earned:0,d_pulls:0,claimed:{}};
  }catch(e){ console.warn('save broken', e); }
}
let lastSave=0,saveT;
function save(){ if(!saveT) saveT=setTimeout(()=>{saveT=null;saveNow();},Math.max(0,CONFIG.SAVE_MS-(Date.now()-lastSave))); }
function saveNow(){ S.lastSeen=Date.now(); try{localStorage.setItem(SAVE_KEY,JSON.stringify(S));lastSave=Date.now();$('save-flash').classList.add('show');setTimeout(()=>$('save-flash').classList.remove('show'),700);}catch(e){} }
/* ---------------- Derived ---------------- */
const $ = id => document.getElementById(id);
function fmt(n){
  n = Math.floor(n);
  if(n < 1000) return ''+n;
  const u = ['K','M','B','T','Qa'];
  let i = -1; let x = n;
  while(x >= 1000 && i < u.length-1){ x/=1000; i++; }
  return (x>=100?x.toFixed(0):x>=10?x.toFixed(1):x.toFixed(1))+u[i];
}
function permMult(){ return S.perm5?5 : S.perm3?3 : S.perm2?2 : 1; }
function boostMult(){
  if(S.boost.id && Date.now() < S.boost.until){
    const b = BOOSTS.find(b=>b.id===S.boost.id); return b?b.mult:1;
  }
  return 1;
}
const totalMult = () => Math.max(permMult(), boostMult());
function tapPower(){ let p=1; for(const u of UPGRADES) if(u.kind==='tap') p += S.up[u.id]*u.eff; return p; }
function baseCps(){ let c=0; for(const u of UPGRADES) if(u.kind==='auto') c += S.up[u.id]*u.eff; return c; }
function cps(){ return baseCps() * totalMult(); }
function coinsPerTap(){ return tapPower() * totalMult(); }
const tierOf = lv => TIERS.find(t => lv>=t.min && lv<=t.max) || TIERS[0];
const costOf = (u,lvl) => Math.ceil(u.base * Math.pow(u.rate, lvl));
const autoOn = () => S.auto !== false;

/* ---------------- Toast / FX ---------------- */
let toastT;
function toast(html){
  const el = $('toast'); el.innerHTML = html; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(()=>el.classList.remove('show'), 3200);
}
function floatText(x,y,txt,cls){
  const el = document.createElement('div');
  el.className = 'float-txt'+(cls?' '+cls:'');
  el.textContent = txt; el.style.left = x+'px'; el.style.top = y+'px';
  $('fx-layer').appendChild(el); setTimeout(()=>el.remove(), 950);
}
function burst(x,y){
  for(let i=0;i<(mobile()?2:8);i++){
    if($('fx-layer').querySelectorAll('.spark').length >= (mobile()?2:16))break;
    const s = document.createElement('div');
    s.className='spark';
    const a = (Math.PI*2*i)/8 + Math.random()*.5;
    const d = 46+Math.random()*36;
    s.style.setProperty('--dx', Math.cos(a)*d+'px');
    s.style.setProperty('--dy', Math.sin(a)*d+'px');
    s.style.left=x+'px'; s.style.top=y+'px';
    $('fx-layer').appendChild(s); setTimeout(()=>s.remove(), 650);
  }
}
function levelFx(){
  const el = $('level-fx'); el.classList.remove('hidden');
  el.style.animation='none'; void el.offsetWidth; el.style.animation='';
  setTimeout(()=>el.classList.add('hidden'), 1150);
}

/* ---------------- Economy ---------------- */
function addCoins(n){
  S.coins += n; S.stats.coins += n;
  if(S.daily.date===today()) S.daily.d_earned += n;
}
function addXp(n){
  S.xp += n;
  let leveled = false;
  while(S.level < 100 && S.xp >= xpNeed(S.level)){
    S.xp -= xpNeed(S.level); S.level++; leveled = true;
  }
  if(S.level >= 100) S.xp = Math.min(S.xp, xpNeed(100)-1);
  if(leveled){ $('heart-fill').animate([{filter:'brightness(2)'},{filter:'brightness(1)'}],700);levelFx(); checkTier(); }
}
function checkTier(){
  const t = tierOf(S.level);
  if(t.id !== S.tier){
    S.tier = t.id;
    crossfade(t);
    showTierEvent(t);
    if(S.tier===3 || S.tier===5) say(t.lines[0], 4200);
    save();
  }
}

/* ---------------- Art / BG crossfade ---------------- */
let artFlip = false;
function showArt(src, ssr){
  const a = $('char-a'), b = $('char-b');
  const inc = artFlip ? a : b, out = artFlip ? b : a;
  artFlip = !artFlip;
  mountArt(inc,src);
  inc.classList.toggle('ssr-anim', !!ssr);
  requestAnimationFrame(()=>{ inc.classList.add('show'); out.classList.remove('show'); });
}
let bgFlip = false;
function showBg(src){
  const a = $('bg-a'), b = $('bg-b');
  const inc = bgFlip?a:b, out = bgFlip?b:a;
  bgFlip = !bgFlip;
  inc.style.backgroundImage = `url('${src}')`;
  requestAnimationFrame(()=>{ inc.classList.add('show'); out.classList.remove('show'); });
}
function currentArt(){
  if(S.equip!=='base'){
    const c = COSTUMES.find(c=>c.id===S.equip);
    if(c && c.img) return {src:c.img, ssr:c.ssrAnim};
  }
  const t = tierOf(S.level);
  return {src:t.art, ssr:false};
}
function refreshArt(){ const a = currentArt(); showArt(a.src, a.ssr); }

function showTierEvent(t){ navigator.vibrate?.(50);
  $('te-tier').textContent = t.name;
  $('te-line').textContent = '“'+t.lines[0]+'”';
  $('te-place').textContent = t.place;
  const ev = $('tier-event'); ev.classList.remove('hidden');
  setTimeout(()=>ev.classList.add('hidden'), 3000);
  ev.onclick = ()=>ev.classList.add('hidden');
}
function crossfade(t){
  showArt(currentArt().src, currentArt().ssr);
  showBg(t.bg);
}

/* ---------------- Dialogue ---------------- */
let bubbleT;
function say(text, ms=4000){
  $('bubble-text').textContent = text;
  $('bubble').classList.add('show');
  clearTimeout(bubbleT);
  bubbleT = setTimeout(()=>$('bubble').classList.remove('show'), ms);
}
function idleTalk(){
  const t = tierOf(S.level);
  say(t.lines[Math.floor(Math.random()*t.lines.length)]);
}

/* ---------------- Tapping ---------------- */
let lastTap=-Infinity;
function tap(x, y){
  if(performance.now()-lastTap<CONFIG.TAP_MIN_MS)return; lastTap=performance.now();
  navigator.vibrate?.(10); $('bubble').classList.remove('show');
  window.CharacterAnimation?.react();
  $('coins').animate([{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:180});
  const gain = coinsPerTap();
  addCoins(gain);
  addXp(1 + Math.floor(tapPower()/2));
  S.stats.taps++;
  if(S.daily.date===today()) S.daily.d_taps++;
  if(x!=null){ floatText(x, y-14, '+'+fmt(gain)); burst(x,y); }
  // squash
  const img = document.querySelector('.char.show');
  if(img){ img.classList.remove('tapped'); void img.offsetWidth; img.classList.add('tapped');
    setTimeout(()=>img.classList.remove('tapped'),170); }
  const sh = $('char-shadow'); sh.classList.add('pop'); setTimeout(()=>sh.classList.remove('pop'),150);
  // dialogue pacing
  S.tapTalk++;
  if(S.tapTalk % 25 === 0) idleTalk();
  else if(Math.random()<0.12){
    const t = tierOf(S.level);
    say(t.lines[Math.floor(Math.random()*t.lines.length)], 2600);
  }
  save();
}

/* ---------------- Energy / regen tick ---------------- */
function tickEnergy(){
  const now = Date.now();
  if(S.energy >= ENERGY_MAX){ S.energyTs = now; return; }
  const gained = Math.floor((now - S.energyTs)/ENERGY_MS);
  if(gained > 0){
    S.energy = Math.min(ENERGY_MAX, S.energy + gained);
    S.energyTs += gained*ENERGY_MS;
  }
}

/* ---------------- Gacha ---------------- */
function rollRarity(){
  if(S.pity.ssr >= 49){ S.pity.ssr = 0; S.pity.sr = 0; return 'SSR'; }
  if(S.pity.sr >= 9){ S.pity.sr = 0; S.pity.ssr++; return 'SR'; }
  const r = Math.random();
  let acc = 0, hit = 'N';
  for(const k of ['N','R','SR','SSR']){ acc += RARITY_RATE[k]; if(r<acc){ hit=k; break; } }
  if(hit==='SR'){ S.pity.sr=0; S.pity.ssr++; }
  else if(hit==='SSR'){ S.pity.ssr=0; S.pity.sr=0; }
  else { S.pity.sr++; S.pity.ssr++; }
  return hit;
}
function pull(n){
  if(n===1){
    const free = Date.now()-S.freePull >= FREE_PULL_MS;
    if(!free && S.energy < 10){ toast('Not enough ⚡ — wait for a refill!'); return; }
    if(free) S.freePull = Date.now(); else S.energy -= 10;
  }else{
    if(S.energy < 100){ toast('Need100 ⚡ for a ×10 pull'); return; }
    S.energy -= 100;
  }
  const results = [];
  for(let i=0;i<n;i++){
    const rar = rollRarity();
    const pool = COSTUMES.filter(c=>c.id!=='base' && c.rarity===rar);
    const pick = pool[Math.floor(Math.random()*pool.length)];
    const owned = S.owned.includes(pick.id);
    if(!owned) S.owned.push(pick.id);
    results.push({c:pick, dup:owned});
    S.stats.pulls++; S.pity.sr = S.pity.sr;
    if(S.daily.date===today()) S.daily.d_pulls++;
  }
  save();
  renderAll();
  showReveal(results);
}
function showReveal(results){
  const grid = $('reveal-grid'); grid.innerHTML='';
  results.forEach((r,i)=>{
    const card = document.createElement('div');
    card.className = 'reveal-card'+(r.dup?' dup':'')+' '+r.c.rarity;
    card.innerHTML = `
      <div class="back">🎴</div>
      <div class="inner">
        <img src="${r.c.img||'assets/characters/tier1.png'}" alt="${r.c.name}">
        <div class="rr rar ${r.c.rarity}">${r.c.rarity} · ${r.c.name.toUpperCase()}</div>
        ${r.dup?`<div class="dup-tag">DUP +${DUP_COINS[r.c.rarity]}💰</div>`:''}
      </div>`;
    if(r.dup) addCoins(DUP_COINS[r.c.rarity]);
    grid.appendChild(card);
    setTimeout(()=>{card.classList.add('flipped');if(r.c.rarity==='SSR')burst(innerWidth/2,innerHeight/3);},1000+i*300);
  });
  $('modal-gacha').classList.remove('open');
  $('modal-reveal').classList.add('open');
  renderAll(); save();
}

/* ---------------- Prestige ---------------- */
const prestigeGain = () => S.level>=50 ? Math.floor((S.level-50)/5)+1 : 0;
function doPrestige(){
  const g = prestigeGain();
  if(g<=0) return;
  $('modal-prestige').classList.remove('open');
  const keep = { gems:S.gems+g, perm2:S.perm2, perm3:S.perm3, perm5:S.perm5,
    owned:S.owned, equip:S.equip, streak:S.streak, daily:S.daily, freePull:S.freePull,
    pity:S.pity, stats:S.stats, prestige:S.prestige+1, settings:S.settings,
    friend:S.friend, energy:S.energy, energyTs:S.energyTs, lastSeen:Date.now() };
  S = Object.assign(def(), keep);
  S.tier = 1;
  refreshArt(); showBg(TIERS[0].bg);
  say("It's... really okay? Then — from the start. But closer this time.", 5000);
  toast(`💞 Confession complete! <b>+${g} 💎</b>`);
  renderAll(); saveNow();
}

/* ---------------- Missions / streak ---------------- */
function claimMission(id){
  const m = MISSIONS.find(m=>m.id===id);
  if(!m || S.daily.claimed[id]) return;
  const p = S.daily[m.key]||0;
  if(p < m.goal) return;
  S.daily.claimed[id] = true;
  if(m.reward.coins) addCoins(m.reward.coins);
  if(m.reward.gems) S.gems += m.reward.gems;
  toast(`📜 Mission complete: <b>${m.label}</b>`); addXp(25);levelFx();
  renderAll(); save();
}
function newDayCheck(){
  const t = today();
  if(S.streak.last !== t){
    if(S.streak.last === yesterday()){ S.streak.count++; }
    else S.streak.count = 1;
    S.streak.last = t;
    const bonus = S.streak.count*200;
    addCoins(bonus);
    let extra = '';
    if(S.streak.count % 7 === 0){ S.gems += 1; extra = ' +1 💎'; }
    $('daily-streak').textContent=`Day ${S.streak.count} streak`; $('daily-rewards').textContent=`+${fmt(bonus)} 💰${extra}`; setTimeout(()=>openModal('daily'),500);
  }
  if(S.daily.date !== t){
    S.daily = {date:t,d_taps:0,d_earned:0,d_pulls:0,claimed:{}};
  }
}

/* ---------------- Rendering ---------------- */
function renderHUD(){
  const t = tierOf(S.level);
  $('coins').textContent = fmt(S.coins);
  $('gems').textContent = fmt(S.gems);
  $('energy').textContent = Math.floor(S.energy);
  $('hud-level').textContent = S.level;
  $('rel-level').textContent = S.level;
  $('tier-name').textContent = t.name;
  $('hud-title').textContent = t.name;
  const need = xpNeed(S.level);
  const pct = S.level>=100 ? 100 : Math.min(100, S.xp/need*100);
  $('heart-fill').style.transform = `scaleX(${pct/100})`;
  $('heart-xp').textContent = S.level>=100 ? 'MAX' : `${Math.floor(S.xp)} / ${need} XP`;
  $('stat-cps').textContent = fmt(cps());
  $('stat-tap').textContent = '+'+fmt(coinsPerTap());
  const rem = Math.max(0, ENERGY_MS - (Date.now()-S.energyTs)) ;
  $('energy-timer').textContent = S.energy<ENERGY_MAX ? Math.ceil(rem/1000)+'s' : '';
  // boost pill
  if(S.boost.id && Date.now()<S.boost.until){
    const b = BOOSTS.find(b=>b.id===S.boost.id);
    $('boost-pill').classList.remove('hidden');
    $('boost-text').textContent = '×'+b.mult;
    $('boost-time').textContent = Math.ceil((S.boost.until-Date.now())/1000)+'s';
  } else $('boost-pill').classList.add('hidden');
}
function renderUpgrades(){
  const list = $('upgrade-list'); list.innerHTML='';
  for(const u of UPGRADES){
    const lvl = S.up[u.id], cost = costOf(u,lvl), ok = u.unlock(S);
    const row = document.createElement('div');
    row.className = 'up-item'+(ok?'':' locked');
    row.innerHTML = `
      <div class="up-name">${u.name}<span class="lv">Lv ${lvl}</span></div>
      <button class="up-buy" ${S.coins<cost||!ok?'disabled':''}>${fmt(cost)} 💰</button>
      <div class="up-eff">${u.desc} · next: ${u.kind==='tap'?('+'+(u.eff*(lvl+1))+' base/tap'):('+'+fmt(u.eff*(lvl+1))+'/s')} ${!ok?'· 🔒':''}</div>`;
    row.querySelector('.up-buy').onclick = ()=>{
      if(S.coins < cost || !ok) return;
      S.coins -= cost; S.up[u.id]++;
      renderAll(); save();
    };
    list.appendChild(row);
  }
  const g = prestigeGain();
  $('prestige-gems').textContent = g;
  $('prestige-req').textContent = S.level>=50 ? `Lv ${S.level}` : 'Unlocks at Lv 50';
  $('btn-prestige').disabled = g<=0;
}
function renderMissions(){
  $('streak-count').textContent = S.streak.count;
  const list = $('mission-list'); list.innerHTML='';
  for(const m of MISSIONS){
    const p = Math.min(m.goal, S.daily[m.key]||0);
    const done = p>=m.goal, claimed = !!S.daily.claimed[m.id];
    const rw = m.reward.coins ? `+${m.reward.coins}💰` : `+${m.reward.gems}💎`;
    const el = document.createElement('div');
    el.className='mission'+(claimed?' done':'');
    el.innerHTML = `
      <div class="m-head"><span>${m.label}</span><span class="m-reward">${rw}</span></div>
      <div class="m-bar"><div class="m-fill" style="width:${p/m.goal*100}%"></div></div>
      <div class="m-foot"><span class="m-prog">${fmt(p)} / ${fmt(m.goal)}</span>
      <button class="m-claim" ${(!done||claimed)?'disabled':''}>${claimed?'CLAIMED':'CLAIM'}</button></div>`;
    if(done && !claimed) el.querySelector('.m-claim').onclick = ()=>claimMission(m.id);
    list.appendChild(el);
  }
}
function renderShop(){
  const b = $('shop-boosts'); b.innerHTML='';
  for(const bo of BOOSTS){
    const el = document.createElement('div');
    el.className='shop-item';
    el.innerHTML = `<div><div class="si-name">⚡ ${bo.label}</div><div class="si-desc">Coin multiplier while active</div></div>
      <button class="si-buy" ${S.coins<bo.cost?'disabled':''}>${fmt(bo.cost)} 💰</button>`;
    el.querySelector('button').onclick = ()=>{
      if(S.coins<bo.cost) return;
      S.coins-=bo.cost; S.boost={id:bo.id,until:Date.now()+bo.secs*1000};
      toast(`⚡ Boost <b>${bo.label}</b> activated!`);
      renderAll(); save();
    };
    b.appendChild(el);
  }
  const p = $('shop-perm'); p.innerHTML='';
  for(const pe of PERMS){
    const owned = S[pe.id], locked = pe.need && !S[pe.need];
    const el = document.createElement('div');
    el.className='shop-item'+(owned?' owned':'');
    el.innerHTML = `<div><div class="si-name">${pe.label}</div><div class="si-desc">${pe.desc}${locked?' · 🔒 requires ×'+PERMS.find(x=>x.id===pe.need).mult:''}</div></div>
      <button class="si-buy" ${owned||locked||S.gems<pe.gems?'disabled':''}>${owned?'OWNED':pe.gems+' 💎'}</button>`;
    if(!owned) el.querySelector('button').onclick = ()=>{
      if(S.gems<pe.gems||locked) return;
      S.gems-=pe.gems; S[pe.id]=true;
      toast(`💞 ${pe.label} permanent!`);
      renderAll(); save();
    };
    p.appendChild(el);
  }
  const u = $('shop-util'); u.innerHTML='';
  const refill = document.createElement('div');
  refill.className='shop-item';
  refill.innerHTML = `<div><div class="si-name">⚡ Energy Refill</div><div class="si-desc">Back to full energy</div></div>
    <button class="si-buy gold" ${S.energy>=ENERGY_MAX||S.coins<2000?'disabled':''}>2,000 💰</button>`;
  refill.querySelector('button').onclick = ()=>{
    if(S.coins<2000||S.energy>=ENERGY_MAX) return;
    S.coins-=2000; S.energy=ENERGY_MAX; S.energyTs=Date.now();
    renderAll(); save();
  };
  u.appendChild(refill);
}
function renderGacha(){
  $('pity-sr').textContent = S.pity.sr;
  $('pity-ssr').textContent = S.pity.ssr;
  $('gacha-energy').textContent = Math.floor(S.energy);
  const free = Date.now()-S.freePull >= FREE_PULL_MS;
  $('free-timer').textContent = free ? 'NOW' :
    Math.ceil((FREE_PULL_MS-(Date.now()-S.freePull))/60000)+'m';
  const ownedN = S.owned.length-1, total = COSTUMES.length-1;
  $('gacha-owned').textContent = `Collection: ${ownedN}/${total} costumes`;
  const g = $('gacha-owned');
  if(ownedN===total) g.textContent = '✨ Collection complete!';
}
function costumeThumb(c, small){
  const owned = S.owned.includes(c.id);
  const equipped = S.equip===c.id;
  const el = document.createElement('div');
  el.className = 'costume-thumb'+(owned?'':' locked')+(equipped?' equipped':'');
  const src = c.id==='base' ? tierOf(S.level).art : c.img;
  el.innerHTML = `<img src="${src}" alt="${c.name}" loading="lazy" decoding="async">
    ${owned?'':'<div class="lock">🔒</div>'}
    <div class="rar ${c.rarity}">${c.rarity}</div>`;
  el.title = c.name + (owned?'':' (locked)');
  el.onclick = ()=>equip(c, owned);
  return el;
}
function renderRails(){
  const list = $('costume-list'); list.innerHTML='';
  for(const c of COSTUMES) list.appendChild(costumeThumb(c));
  const inv = $('inv-grid'); inv.innerHTML='';
  for(const c of COSTUMES){
    const owned = S.owned.includes(c.id);
    const el = document.createElement('div');
    el.className = 'inv-item'+(owned?'':' locked')+(S.equip===c.id?' equipped':'');
    const src = c.id==='base' ? tierOf(S.level).art : c.img;
    el.innerHTML = `<div class="inv-img"><img src="${src}" alt="${c.name}" loading="lazy" decoding="async"></div>
      <div class="inv-name">${owned?c.name:'🔒 ???'}<br><small class="rar ${c.rarity}" style="color:${c.rarity==='SSR'?'#ffd700':c.rarity==='SR'?'#c44dff':c.rarity==='R'?'#6bb6ff':'#c9c9d6'}">${c.rarity}</small></div>`;
    el.onclick = ()=>equip(c, owned);
    inv.appendChild(el);
  }
}
function equip(c, owned){
  if(!owned){ toast('🔒 Locked — pull her from the gacha!'); return; }
  S.equip = c.id;
  refreshArt();
  if(c.line) say(c.line, 4200);
  renderAll(); save();
}
function renderSettings(){ applyTheme();
  $('set-motion').classList.toggle('on', !!S.settings.motion);
  document.body.classList.toggle('no-motion', !S.settings.motion);
}
function renderAll(){ renderHUD(); renderUpgrades(); renderMissions(); renderShop(); renderGacha(); renderRails(); renderSettings(); }

/* ---------------- Main loop ---------------- */
let acc = 0, last = Date.now();
function loop(){
  const now = Date.now(), dt = Math.min(CONFIG.OFFLINE_CAP_MS,now-last); last = now;
  tickEnergy();
  if(autoOn() && baseCps()>0){
    const gain = cps()*dt/1000;
    if(gain>0) addCoins(gain);
  }
  // passive relationship XP from auto
  if(autoOn() && baseCps()>0) addXp(baseCps()*totalMult()*dt/1000/4);
  acc += dt;
  if(acc > 400){ acc = 0; renderHUD(); if(Math.random()<0.08) idleTalk(); }
  if(now - (S.bubbleAt||0) > 8000){ S.bubbleAt = now; idleTalk(); }
  renderGachaTimers();
  requestAnimationFrame(loop);
}
function renderGachaTimers(){
  const free = Date.now()-S.freePull >= FREE_PULL_MS;
  $('free-timer').textContent = free ? 'NOW' :
    Math.ceil((FREE_PULL_MS-(Date.now()-S.freePull))/60000)+'m';
}

/* ---------------- Events ---------------- */
function bind(){
  // character + tap button
  $('character-wrap').onclick = e => tap(e.clientX, e.clientY);
  $('tap-btn').onclick = e => {
    $('tap-btn').classList.add('pressed');
    setTimeout(()=>$('tap-btn').classList.remove('pressed'),120);
    const r = $('tap-btn').getBoundingClientRect();
    tap(r.left+r.width/2, r.top+r.height/2-10);
  };
  for(const id of ['character-wrap','tap-btn']){
    $(id).addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];tap(t.clientX,t.clientY);},{passive:false});
    $(id).addEventListener('contextmenu',e=>e.preventDefault());
  }
  for(const kind of ['sfx','music']){
    $('set-'+kind).value=S.settings[kind]??(kind==='sfx'?70:40);
    $('set-'+kind).oninput=e=>{S.settings[kind]=+e.target.value;$(kind+'-val').textContent=e.target.value+'%';save();};
  }
  document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{S.settings.theme=b.dataset.theme;applyTheme();save();});
  let edge=null;
  document.addEventListener('touchstart',e=>{edge={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  document.addEventListener('touchend',e=>{if(!edge)return;const dx=e.changedTouches[0].clientX-edge.x;if(Math.abs(e.changedTouches[0].clientY-edge.y)<80){if(edge.x<28&&dx>60)$('left-rail').classList.add('open');if(edge.x>innerWidth-28&&dx< -60)$('right-rail').classList.add('open');}edge=null;},{passive:true});
  // rails
  document.querySelectorAll('.rail-btn').forEach(b=>{
    b.onclick = ()=>{ openModal(b.dataset.modal); $('left-rail').classList.remove('open'); };
  });
  $('toggle-left').onclick = ()=>$('left-rail').classList.toggle('open');
  $('toggle-right').onclick = ()=>$('right-rail').classList.toggle('open');
  // modals
  document.querySelectorAll('.modal-close').forEach(b=>{
    b.onclick = ()=>b.closest('.modal').classList.remove('open');
  });
  document.querySelectorAll('.modal').forEach(m=>{
    m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('open'); });
  });
  $('btn-upgrades').onclick = ()=>openModal('upgrades');
  $('btn-auto').onclick = ()=>{
    S.auto = !autoOn();
    $('auto-state').textContent = autoOn()?'ON':'OFF';
    $('btn-auto').classList.toggle('on', autoOn());
    toast('Auto-clicker <b>'+(autoOn()?'ON':'OFF')+'</b>');
    save();
  };
  $('pull-x1').onclick = ()=>pull(1);
  $('pull-x10').onclick = ()=>pull(10);
  $('reveal-close').onclick = ()=>{ $('modal-reveal').classList.remove('open'); openModal('gacha'); };
  $('btn-prestige').onclick = ()=>{ $('prestige-preview').textContent=`Lv ${S.level} · ${fmt(S.coins)} coins → +${prestigeGain()} 💎`;openModal('prestige');};
  $('prestige-confirm').onclick=doPrestige; $('prestige-cancel').onclick=()=>$('modal-prestige').classList.remove('open');
  $('offline-claim').onclick=()=>$('modal-offline').classList.remove('open');
  $('daily-claim').onclick=()=>$('modal-daily').classList.remove('open');
  $('copy-friend').onclick = ()=>{
    navigator.clipboard?.writeText(S.friend).then(()=>toast('Friend code copied!'));
  };
  $('set-motion').onclick = ()=>{
    S.settings.motion = !S.settings.motion;
    renderSettings(); save();
  };
  $('set-export').onclick = ()=>{
    navigator.clipboard?.writeText(JSON.stringify(S)).then(()=>toast('Save JSON copied!'));
  };
  $('set-import').onclick = ()=>{
    const txt = prompt('Paste your save JSON:');
    if(!txt) return;
    try{const d=JSON.parse(txt);if(d.v!==1||!Number.isFinite(d.coins)||!Number.isInteger(d.level)||d.level<1||d.level>100)throw Error();localStorage.setItem(SAVE_KEY,txt);location.reload();}
    catch(e){ toast('Invalid save JSON'); }
  };
  $('set-reset').onclick = ()=>{
    if(!confirm('WIPE ALL PROGRESS? This cannot be undone.')) return;
    if(!confirm('Really sure? Your waifu will forget everything...')) return;
    localStorage.removeItem(SAVE_KEY); location.reload();
  };
  // parallax
  const stage = $('stage');
  stage.addEventListener('pointermove', e=>{
    if(!S.settings.motion || mobile() || navigator.hardwareConcurrency<4) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX-r.left)/r.width-.5, y = (e.clientY-r.top)/r.height-.5;
    $('bg-a').style.transform = `translate(${-x*14}px,${-y*10}px) scale(1.03)`;
    $('bg-b').style.transform = `translate(${-x*14}px,${-y*10}px) scale(1.03)`;
  });
  // keyboard
  document.addEventListener('keydown', e=>{
    if(e.code==='Space' && !document.querySelector('.modal.open')){
      e.preventDefault();
      const r = $('tap-btn').getBoundingClientRect();
      tap(r.left+r.width/2, r.top-30);
    }
    if(e.key==='Escape') document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));
  });
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) saveNow(); });
}
function openModal(name){
  const m = $('modal-'+name); if(!m) return;
  m.classList.add('open');
  if(name==='gacha') renderGacha();
  if(name==='missions') renderMissions();
  if(name==='upgrades')renderUpgrades();if(name==='shop')renderShop();
}

function applyTheme(){ const t=THEMES.find(t=>t.id===S.settings.theme)||THEMES[0];document.documentElement.style.setProperty('--pink',t.pink);document.documentElement.style.setProperty('--pink-soft',t.soft); }
function mountArt(el,src){
  window.CharacterAnimation.mount(el,src);
}

let installEvent;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;$('install-bar').classList.remove('hidden');});
window.addEventListener('load',()=>{
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
 $('install-btn').onclick=async()=>{await installEvent?.prompt();$('install-bar').classList.add('hidden');};
 $('install-dismiss').onclick=()=>$('install-bar').classList.add('hidden');
});
/* ---------------- Boot ---------------- */
function boot(){
  load();
  newDayCheck();
  bind();
  // offline earnings
  const away = Math.min(8*3600e3, Date.now()-(S.lastSeen||Date.now()));
  if(away > 60000 && baseCps()>0){
    const gain = cps()*away/1000;
    addCoins(gain);
    $('offline-gain').textContent=`+${fmt(gain)} 💰`;$('offline-away').textContent=`Away ${Math.floor(away/60000)} minutes`;setTimeout(()=>openModal('offline'),800);
  }
  // art & bg
  const t = tierOf(S.level);
  const a = currentArt();
  mountArt($('char-a'),a.src); $('char-a').classList.add('show'); $('char-a').classList.toggle('ssr-anim', !!a.ssr);
  mountArt($('char-b'),a.src);
  $('bg-a').style.backgroundImage = `url('${t.bg}')`;
  $('bg-a').classList.add('show');
  $('auto-state').textContent = autoOn()?'ON':'OFF';
  $('btn-auto').classList.toggle('on', autoOn());
  $('friend-code').textContent = S.friend;
  // preload
  [...TIERS.map(t=>t.art), ...TIERS.map(t=>t.bg)]
    .forEach(src=>{ const i=new Image(); i.src=src; });
  renderAll();
  setTimeout(()=>say(`...you came back. Don't just stand there.`, 4500), 700);
  setInterval(save, CONFIG.SAVE_MS);
  setInterval(newDayCheck, 60000);
  requestAnimationFrame(loop);
}
document.addEventListener('DOMContentLoaded', boot);
})();
