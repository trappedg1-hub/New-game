/* ============ CONTENT: tiers, costumes, upgrades, config ============ */
window.CONTENT = (() => {
  const TIERS = [
    { id:1, min:1,  max:10, name:'Stranger', art:'assets/characters/tier1', bg:'assets/backgrounds/bg1_classroom',
      place:'Classroom' },
    { id:2, min:11, max:25, name:'Friend', art:'assets/characters/tier2', bg:'assets/backgrounds/bg2_cafe',
      place:'Café' },
    { id:3, min:26, max:50, name:'Close', art:'assets/characters/tier3', bg:'assets/backgrounds/bg3_private_pool',
      place:'Private Pool · Summer Resort' },
    { id:4, min:51, max:75, name:'Intimate', art:'assets/characters/tier4', bg:'assets/backgrounds/bg3_bedroom',
      place:'Private Bedroom · Dusk' },
    { id:5, min:76, max:100, name:'Devoted', art:'assets/characters/tier5', bg:'assets/backgrounds/bg5_beach',
      place:'Private Beach · Sunset' },
  ];

  const COSTUMES = [
    { id:'base',     name:'Tier Outfit',    rarity:'N',  img:null },
    { id:'cardigan', name:'Cozy Cardigan',  rarity:'N',  img:'assets/characters/costume_cardigan' },
    { id:'track',    name:'Track Star',     rarity:'N',  img:'assets/characters/costume_track' },
    { id:'apron',    name:'Café Apron',     rarity:'N',  img:'assets/characters/costume_apron' },
    { id:'maid',     name:'French Maid',    rarity:'R', img:'assets/characters/costume_maid' },
    { id:'pool',     name:'Poolside',       rarity:'R', img:'assets/characters/costume_pool' },
    { id:'barefoot', name:'Barefoot Sundress', rarity:'R', img:'assets/characters/costume_barefoot' },
    { id:'gown',     name:'Silk Nightgown', rarity:'SSR',img:'assets/characters/costume_gown', ssrAnim:true },
    { id:'bunny',    name:'Midnight Bunny', rarity:'SSR',img:'assets/characters/costume_bunny', ssrAnim:true },
    { id:'ribbon',   name:'Ribbon Sandals', rarity:'SSR',img:'assets/characters/costume_ribbon', ssrAnim:true },
  ];

  const UPGRADES = [
    { id:'tap1', name:'+1 Power',     kind:'tap',  base:100,    rate:1.5, eff:1,   unlock:()=>true,          desc:'+1 coin per tap' },
    { id:'tap2', name:'+2 Charm',     kind:'tap',  base:800,    rate:1.5, eff:2,   unlock:s=>s.up.tap1>=5,   desc:'+2 coins per tap' },
    { id:'tap3', name:'+5 Passion',   kind:'tap',  base:6000,   rate:1.5, eff:5,   unlock:s=>s.up.tap2>=5,   desc:'+5 coins per tap' },
    { id:'tap4', name:'+10 Devotion', kind:'tap',  base:50000,  rate:1.5, eff:10,  unlock:s=>s.up.tap3>=5,   desc:'+10 coins per tap' },
    { id:'fan',  name:'Fan Club',     kind:'auto', base:100,    rate:1.4, eff:1,   unlock:()=>true,          desc:'+1 coin /s' },
    { id:'pap',  name:'Paparazzi',    kind:'auto', base:900,    rate:1.4, eff:5,   unlock:s=>s.up.fan>=3,    desc:'+5 coins /s' },
    { id:'mgr',  name:'Manager',      kind:'auto', base:12000,  rate:1.4, eff:20,  unlock:s=>s.up.pap>=3,    desc:'+20 coins /s' },
    { id:'agy',  name:'Agency',       kind:'auto', base:150000, rate:1.4, eff:100, unlock:s=>s.up.mgr>=3,    desc:'+100 coins /s' },
    { id:'emp',  name:'Empire',       kind:'auto', base:2000000,rate:1.4, eff:500, unlock:s=>s.up.agy>=3,    desc:'+500 coins /s' },
  ];

  const BOOSTS = [
    { id:'x2',  mult:2,  secs:30, cost:1000,  label:'×2 for 30s' },
    { id:'x5',  mult:5,  secs:15, cost:8000,  label:'×5 for 15s' },
    { id:'x10', mult:10, secs:5,  cost:40000, label:'×10 for 5s' },
  ];

  const PERMS = [
    { id:'perm2', need:null,    gems:5,  mult:2, label:'Eternal Bond ×2', desc:'Permanent ×2 coin multiplier' },
    { id:'perm3', need:'perm2',  gems:20, mult:3, label:'Eternal Bond ×3', desc:'Permanent ×3 coin multiplier' },
    { id:'perm5', need:'perm3',  gems:50, mult:5, label:'Eternal Bond ×5', desc:'Permanent ×5 coin multiplier' },
  ];

  const MISSIONS = [
    { id:'taps',   label:'Tap B 1,000 times', goal:1000, reward:{coins:500},  key:'d_taps' },
    { id:'earned', label:'Earn 5,000 coins',  goal:5000, reward:{coins:1500}, key:'d_earned' },
    { id:'pull',   label:'Do 1 gacha pull',   goal:1,    reward:{gems:1},     key:'d_pulls' },
  ];

  const RARITY_RATE = { N:.60, R:.30, SR:.09, SSR:.01 };
  const DUP_COINS  = { N:50, R:200, SR:1000, SSR:5000 };

  /* consolidated magic numbers */
  const CONFIG = {
    SAVE_KEY:'waifuB_save_v1',
    ENERGY_MAX:100,
    ENERGY_MS:30000,
    FREE_PULL_MS:24*3600e3,
    TAP_MIN_MS:50,            /* max20 taps /s */
    SAVE_MS:3000,             /* throttle localStorage */
    HUD_MS:400,
    BUBBLE_MS:4000,
    OFFLINE_CAP_MS:8*3600e3,
    OFFLINE_MIN_MS:60000,
    PARTICLES_DESKTOP:8,
    PARTICLES_MOBILE:3,
    PARTICLE_POOL:6,
    PRESTIGE_MIN_LEVEL:50,
    REFILL_COST:2000,
    xpNeed: l => 20 + l*7,
  };

  const THEMES = [
    { id:'pink',   pink:'#ff6b9d', soft:'#ff9ec4', label:'Pink' },
    { id:'purple', pink:'#c44dff', soft:'#dd9bff', label:'Purple' },
    { id:'gold',   pink:'#ffb347', soft:'#ffd98a', label:'Gold' },
  ];

  // Every owned outfit selects a coherent scene, without changing relationship XP.
  const COSTUME_CONTEXT = {cardigan:1,track:1,apron:2,maid:2,pool:3,gown:4,bunny:5,ribbon:2,barefoot:5};
  const ENVIRONMENTS = {1:'classroom',2:'cafe',3:'pool',4:'bedroom',5:'beach'};
  return { COSTUME_CONTEXT, ENVIRONMENTS, TIERS, COSTUMES, UPGRADES, BOOSTS, PERMS, MISSIONS, RARITY_RATE, DUP_COINS, CONFIG, THEMES };
})();
