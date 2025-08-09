/* --------- Minimal client-side router + state --------- */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];
const state = {
  config: JSON.parse(localStorage.getItem('iac.config') || '{}'),
  exports: JSON.parse(localStorage.getItem('iac.exports') || '[]')
};

function saveState(){
  localStorage.setItem('iac.config', JSON.stringify(state.config));
  localStorage.setItem('iac.exports', JSON.stringify(state.exports));
}

/* --------- Router --------- */
const routes = {
  '#/dashboard': document.getElementById('route-dashboard'),
  '#/new': document.getElementById('route-new'),
  '#/templates': document.getElementById('route-templates'),
  '#/exports': document.getElementById('route-exports'),
  '#/settings': document.getElementById('route-settings'),
};

function setActiveNav(hash){
  $$('.nav a').forEach(a=>{
    if(a.getAttribute('href') === hash) a.classList.add('active');
    else a.classList.remove('active');
  });
}

function render(hash){
  const view = routes[hash] ? hash : '#/dashboard';
  Object.values(routes).forEach(el => el.hidden = true);
  routes[view].hidden = false;
  document.getElementById('breadcrumbs').textContent = ({
    '#/dashboard':'Dashboard',
    '#/new':'New App',
    '#/templates':'Templates',
    '#/exports':'Exports',
    '#/settings':'Settings'
  })[view];
  setActiveNav(view);
}
window.addEventListener('hashchange', ()=>render(location.hash));
window.addEventListener('load', ()=>{
  if(!location.hash) location.hash = '#/dashboard';
  render(location.hash);
  hydrate();
});

/* --------- Navigation helpers --------- */
$$('[data-route]').forEach(a=>a.addEventListener('click',e=>{
  // Links just change hash; router handles view.
}));
$$('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>{
  location.hash = btn.getAttribute('data-nav');
}));

/* --------- Wizard / Config --------- */
function formToConfig(form){
  const data = new FormData(form);
  const features = data.getAll('features');
  return {
    appName: data.get('appName') || 'My App',
    goal: data.get('goal'),
    tagline: data.get('tagline') || '',
    theme: {
      color: data.get('color') || '#4f46e5',
      accent: data.get('accent') || '#14b8a6',
      emoji: data.get('emoji') || '∞'
    },
    integrations: {
      stripeLink: data.get('stripeLink') || '',
      calendlyLink: data.get('calendlyLink') || '',
      webhook: data.get('webhook') || ''
    },
    features: features
  };
}

function hydrate(){
  // Recent exports
  const list = document.getElementById('recentExports');
  list.innerHTML = state.exports.slice(-5).reverse().map(x=>(
    `<li><strong>${x.appName}</strong> • ${new Date(x.createdAt).toLocaleString()}</li>`
  )).join('') || '<li class="muted">No exports yet.</li>';

  // Exports route
  const el = document.getElementById('exportsList');
  el.innerHTML = state.exports.slice().reverse().map((x,i)=>(
    `<li>
      <div><strong>${x.appName}</strong> <span class="muted">(${x.goal})</span></div>
      <div>
        <button class="btn" data-dl="${x.id}">Download JSON</button>
      </div>
    </li>`
  )).join('') || '<li class="muted">Nothing exported yet.</li>';

  // Download handlers
  $$('[data-dl]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-dl');
      const item = state.exports.find(e=>e.id===id);
      if(!item) return;
      const blob = new Blob([JSON.stringify(item, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(item.appName)}-config.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
  });

  // Save & Export buttons
  document.getElementById('saveBtn').onclick = ()=>{
    // Save current wizard values if on New App
    const form = document.getElementById('wizard');
    if(form){
      state.config = formToConfig(form);
      saveState();
      toast('Saved!');
    }
  };
  document.getElementById('exportBtn').onclick = ()=>{
    const payload = {
      id: crypto.randomUUID(),
      ...state.config,
      createdAt: Date.now(),
      version: '1.0.0',
      generator: 'Infinite App Composer'
    };
    if(!payload.appName){ toast('Nothing to export. Open New App and fill it in.'); return; }
    state.exports.push(payload);
    saveState();
    hydrate();
    toast('Exported!');
  };

  // Wizard events
  const form = document.getElementById('wizard');
  if(form){
    // Preview
    document.getElementById('previewBtn').onclick = ()=>{
      const cfg = formToConfig(form);
      const box = document.getElementById('previewBox');
      box.textContent = JSON.stringify(cfg, null, 2);
      box.hidden = false;
    };
    // Submit → Generate scaffold (stores as current config + adds an export)
    form.onsubmit = (e)=>{
      e.preventDefault();
      const cfg = formToConfig(form);
      state.config = cfg;
      state.exports.push({
        id: crypto.randomUUID(),
        ...cfg,
        createdAt: Date.now(),
        version: '1.0.0',
        generator: 'Infinite App Composer'
      });
      saveState();
      hydrate();
      location.hash = '#/exports';
      toast('Scaffold generated. Download config from Exports.');
    };
  }

  // Template buttons → prefill wizard
  $$('[data-template]').forEach(btn=>{
    btn.onclick = ()=>{
      const t = btn.getAttribute('data-template');
      const defaults = templateDefaults(t);
      location.hash = '#/new';
      setTimeout(()=>{
        fillWizard(defaults);
        toast(`Template loaded: ${pretty(t)}`);
      }, 50);
    };
  });

  // Clear data
  const clearBtn = document.getElementById('clearBtn');
  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      if(confirm('Clear all local data? This cannot be undone.')){
        localStorage.removeItem('iac.config');
        localStorage.removeItem('iac.exports');
        state.config = {};
        state.exports = [];
        hydrate();
        toast('Local data cleared.');
      }
    });
  }
}

function templateDefaults(key){
  switch(key){
    case 'quote-engine':
      return {
        appName:'QuoteForge',
        goal:'quote-engine',
        tagline:'Generate clean, itemized quotes in minutes.',
        color:'#4f46e5', accent:'#14b8a6', emoji:'⚙️',
        features:['client-side-router','forms','pricing-engine','pdf-export','webhooks']
      };
    case 'lead-capture':
      return {
        appName:'LeadBeam',
        goal:'lead-capture',
        tagline:'Capture, qualify, and book calls on autopilot.',
        color:'#1e40af', accent:'#22d3ee', emoji:'🚀',
        features:['client-side-router','forms','calendly','webhooks']
      };
    case 'crm-lite':
      return {
        appName:'Trackr',
        goal:'crm-lite',
        tagline:'Contacts. Notes. Follow-ups. Simple pipeline.',
        color:'#0ea5e9', accent:'#f59e0b', emoji:'📇',
        features:['client-side-router','forms','webhooks']
      };
    default:
      return {};
  }
}

function fillWizard(d){
  const form = document.getElementById('wizard'); if(!form) return;
  form.appName.value = d.appName || '';
  form.goal.value = d.goal || 'quote-engine';
  form.tagline.value = d.tagline || '';
  form.color.value = d.color || '#4f46e5';
  form.accent.value = d.accent || '#14b8a6';
  form.emoji.value = d.emoji || '∞';
  $$('input[name="features"]').forEach(cb=>{
    cb.checked = d.features ? d.features.includes(cb.value) : cb.checked;
  });
}

function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function pretty(s){ return s.replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase()); }

/* --------- tiny toast --------- */
function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style,{
    position:'fixed',right:'16px',bottom:'16px',padding:'10px 14px',borderRadius:'10px',
    background:'linear-gradient(135deg,var(--brand),#6d28d9)',color:'#fff',fontWeight:'600',zIndex:99
  });
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),1800);
}
