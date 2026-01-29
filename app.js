

const BUILD_ID = "mcb-build-20260129-2010";

// === HARDWIRED SYNC CONFIG (loaded from sync-config.js) ===
const __SYNC_CFG = (typeof window !== "undefined" && window.SYNC_CONFIG) ? window.SYNC_CONFIG : {};
const HARD_SYNC_URL = String(__SYNC_CFG.APPS_SCRIPT_URL || "").trim();
const HARD_COMPANY_KEY = String(__SYNC_CFG.COMPANY_KEY || "").trim();


try{
  const prev = localStorage.getItem("mcb_build_id") || "";
  if(prev !== BUILD_ID){
    localStorage.setItem("mcb_build_id", BUILD_ID);
    localStorage.setItem("mcb_app_last_update", new Date().toISOString());
  }
}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}



function isProgrammeTaskRemoved(t){
  return !!(t && (t.removed === true || t.disabled === true || t.deletedAt || t.removedAt));
}
function markProgrammeTaskRemoved(task, removed){
  const now = new Date().toISOString();
  if(removed){
    task.removed = true;
    task.removedAt = now;
  }else{
    delete task.removed;
    delete task.removedAt;
    task.removed = false;
  }
  return task;
}



const PRECON_REQUIRED_KEYS = ["scope_confirmed_written", "plans_received_current", "consent_required", "hs_hazards_created", "long_leads_identified", "programme_draft_created"];
function leadIsConverted(lead){
  const s = String((lead && (lead.status||lead.stage||""))).toLowerCase();
  return !!(lead && (lead.convertedAt || lead.converted || lead.isConverted)) || s.includes("convert");
}
function preconGateInfo(lead){
  const list = preconChecklistFromLead(lead);
  const map = new Map();
  (list||[]).forEach(it=>map.set(it.key, it));
  const missing = [];
  PRECON_REQUIRED_KEYS.forEach(k=>{
    const it = map.get(k);
    if(!it || !it.done) missing.push(it ? it.label : k);
  });
  const ok = missing.length === 0;
  return {ok, missing, list};
}



const PRECON_TEMPLATES = {
  "standard_nz": { name: "Standard NZ Residential", add: [] },
  "new_build": { name: "New Build", add: [{key:"survey_setout",label:"Survey / set-out confirmed (if required)",done:false},{key:"geotech",label:"Geotech / bearing info confirmed (if applicable)",done:false},{key:"bracing_strategy",label:"Bracing strategy confirmed",done:false},{key:"roofing_package",label:"Roofing package confirmed",done:false},{key:"cladding_package",label:"Cladding system confirmed",done:false},{key:"drainage_design",label:"Drainage design / as-builts planned",done:false},{key:"air_tightness",label:"Air/insulation plan confirmed (wrap, cavity, R-values)",done:false}] },
  "renovation": { name: "Renovation / Alteration", add: [{key:"asbestos_check",label:"Asbestos risk considered / testing plan (if applicable)",done:false},{key:"temporary_weatherproofing",label:"Temporary weatherproofing plan",done:false},{key:"existing_services_isolation",label:"Existing services isolation plan (water/power/gas)",done:false},{key:"temporary_support",label:"Temporary propping / support plan (if required)",done:false},{key:"staging_access",label:"Staging & access plan (clients living in?)",done:false}] },
  "extension": { name: "Extension / Addition", add: [{key:"tie_in_details",label:"Tie-in details confirmed (existing-to-new junctions)",done:false},{key:"weathertightness_junctions",label:"Weathertightness junctions reviewed",done:false},{key:"existing_foundations_checked",label:"Existing foundations assessed (if applicable)",done:false},{key:"temporary_weatherproofing",label:"Temporary weatherproofing plan",done:false}] },
  "bathroom": { name: "Bathroom / Wet Area", add: [{key:"waterproofing_system",label:"Waterproofing system & applicator confirmed",done:false},{key:"wet_area_inspections",label:"Wet-area inspection hold points set (pre/post waterproof)",done:false},{key:"tile_selection_confirmed",label:"Tiles/linings selections confirmed",done:false},{key:"plumbing_layout_confirmed",label:"Plumbing layout confirmed",done:false},{key:"ventilation_plan",label:"Ventilation plan confirmed (fans/ducting)",done:false}] },
  "deck": { name: "Deck / External", add: [{key:"deck_h4_h5",label:"H4/H5 timber requirements confirmed",done:false},{key:"ledger_flashing",label:"Ledger/flashing detailing confirmed",done:false},{key:"handrail_compliance",label:"Handrail/balustrade compliance confirmed (height/gaps)",done:false},{key:"pile_bearer_layout",label:"Pile/bearer/joist layout confirmed",done:false}] },
  "re_roof": { name: "Re-roof / Roofing", add: [{key:"scaffold_plan",label:"Scaffold / edge protection plan",done:false},{key:"roof_underlay_spec",label:"Underlay/flashings spec confirmed",done:false},{key:"spouting_plan",label:"Spouting/downpipe plan confirmed",done:false},{key:"weathertightness_details",label:"Weathertightness details reviewed (penetrations/valleys)",done:false}] }
};

function getLeadJobTypeKey(lead){
  const raw = (lead && (lead.jobType || lead.workType || lead.type || lead.tradeType || "")) || "";
  const t = String(raw).toLowerCase();
  if(t.includes("new")) return "new_build";
  if(t.includes("reno") || t.includes("alter")) return "renovation";
  if(t.includes("exten") || t.includes("addition")) return "extension";
  if(t.includes("bath")) return "bathroom";
  if(t.includes("deck")) return "deck";
  if(t.includes("roof")) return "re_roof";
  return "standard_nz";
}

function applyPreconTemplateToLead(lead, templateKey){
  const base = defaultPreconChecklist();
  const tpl = PRECON_TEMPLATES[templateKey] || PRECON_TEMPLATES.standard_nz;
  // add items at end, avoiding duplicates by key
  const existingKeys = new Set(base.map(i=>i.key));
  const add = Array.isArray(tpl.add) ? tpl.add : [];
  add.forEach(it=>{ if(!existingKeys.has(it.key)) base.push(it); });
  lead.preconTemplateKey = templateKey;
  lead.preconChecklistJson = JSON.stringify(base);
  if(typeof saveLead==='function'){ saveLead(lead); } else if(typeof updateLead==='function'){ updateLead(lead); }
  return base;
}



function setLeadTab2(tab){
  const btnO = document.getElementById("tabLeadOverview");
  const btnP = document.getElementById("tabLeadPrecon");
  const ov = document.getElementById("leadOverview");
  const pc = document.getElementById("preconCard");
  if(!ov || !pc) return;
  const isPre = tab === "precon";
  ov.style.display = isPre ? "none" : "";
  pc.style.display = isPre ? "" : "none";
  if(btnO) btnO.classList.toggle("active", !isPre);
  if(btnP) btnP.classList.toggle("active", isPre);
  window.__mcbLeadTab = tab;
}

// Delegated click for lead tabs
document.addEventListener("click", (ev)=>{
  const b = ev.target && ev.target.closest ? ev.target.closest("#tabLeadOverview,#tabLeadPrecon") : null;
  if(!b) return;
  ev.preventDefault();
  if(b.id === "tabLeadOverview") setLeadTab2("overview");
  if(b.id === "tabLeadPrecon") setLeadTab2("precon");
});



function setLeadTab(tab){
  try{
    const btnO = document.getElementById("leadTabOverview");
    const btnP = document.getElementById("leadTabPrecon");
    const ov = document.getElementById("leadOverview");
    const pc = document.getElementById("preconCard");
    if(!ov || !pc) return;
    const isPre = tab === "precon";
    ov.style.display = isPre ? "none" : "";
    pc.style.display = isPre ? "" : "none";
    if(btnO) btnO.classList.toggle("active", !isPre);
    if(btnP) btnP.classList.toggle("active", isPre);
    // remember last tab for this session
    window.__mcbLeadTab = tab;
  }catch(e){ console.warn(e); }
}

// Delegated tab handling (survives re-renders)
document.addEventListener("click", (ev)=>{
  const t = ev.target && (ev.target.closest ? ev.target.closest("#leadTabOverview,#leadTabPrecon") : null);
  if(!t) return;
  ev.preventDefault();
  if(t.id === "leadTabOverview") setLeadTab("overview");
  if(t.id === "leadTabPrecon") setLeadTab("precon");
});



function defaultPreconChecklist(){
  return [
    { key:"client_details_confirmed", label:"Client details confirmed (names/phone/email)", done:false },
    { key:"site_address_confirmed", label:"Site address confirmed (legal + physical)", done:false },
    { key:"scope_confirmed_written", label:"Scope confirmed (written)", done:false },
    { key:"exclusions_confirmed", label:"Exclusions / assumptions confirmed", done:false },
    { key:"existing_conditions_documented", label:"Existing conditions documented (photos taken)", done:false },
    { key:"access_restrictions", label:"Access / working hours restrictions confirmed", done:false },
    { key:"neighbours_partywall", label:"Neighbours / party wall considerations noted (if applicable)", done:false },
    { key:"plans_received_current", label:"Current plans/drawings received (latest revision)", done:false },
    { key:"specs_received", label:"Specifications received (or created)", done:false },
    { key:"structural_design_complete", label:"Structural design complete (if applicable)", done:false },
    { key:"producer_statements_list", label:"Producer statements list created (PS1/PS3/PS4 as applicable)", done:false },
    { key:"variations_process_agreed", label:"Variations / changes process agreed", done:false },
    { key:"consent_required", label:"Building consent required?", done:false, kind:"choice", value:"Unknown", choices:["Unknown","Yes","No"] },
    { key:"consent_lodged", label:"If required: consent lodged", done:false },
    { key:"consent_approved", label:"If required: consent approved / conditions reviewed", done:false },
    { key:"approved_docs_recorded", label:"Approved docs recorded (stamped set / conditions)", done:false },
    { key:"inspection_plan_selected", label:"Inspection plan selected (CCC tracker set)", done:false },
    { key:"critical_hold_points", label:"Critical tolerances / hold points noted", done:false },
    { key:"site_measure_verified", label:"Site measure verified", done:false },
    { key:"boundary_levels_confirmed", label:"Boundary/levels confirmed (as required)", done:false },
    { key:"services_located", label:"Underground services located (water/power/gas/stormwater)", done:false },
    { key:"temp_power_plan", label:"Temporary power plan confirmed", done:false },
    { key:"welfare_toilet", label:"Toilet / welfare arranged (if required)", done:false },
    { key:"waste_plan", label:"Rubbish / waste plan arranged (skip/bin)", done:false },
    { key:"storage_security", label:"Storage / security plan for materials & tools", done:false },
    { key:"hs_hazards_created", label:"Site-specific hazards identified (initial hazards list created)", done:false },
    { key:"emergency_plan", label:"Emergency plan confirmed (address / nearest hospital)", done:false },
    { key:"first_aid_ready", label:"First aid kit available / first aiders noted", done:false },
    { key:"ppe_requirements", label:"PPE requirements set", done:false },
    { key:"toolbox_schedule", label:"Toolbox meeting schedule set", done:false },
    { key:"induction_requirements", label:"Induction requirements set for subbies/visitors", done:false },
    { key:"public_protection", label:"Public protection plan (fencing/signage) if required", done:false },
    { key:"long_leads_identified", label:"Long-lead items identified", done:false },
    { key:"long_leads_ordered", label:"Long-lead items ordered / lead times confirmed", done:false },
    { key:"suppliers_confirmed", label:"Key suppliers confirmed", done:false },
    { key:"selections_confirmed", label:"Product selections confirmed (fixtures/finishes etc.)", done:false },
    { key:"delivery_access_confirmed", label:"Delivery location/access confirmed", done:false },
    { key:"required_trades_confirmed", label:"Required trades list confirmed", done:false },
    { key:"subbies_availability", label:"Subbies availability confirmed (rough dates)", done:false },
    { key:"lbp_checked", label:"LBP requirements checked (restricted work if applicable)", done:false },
    { key:"subbie_docs_requested", label:"Insurance / documentation requested from subbies (if needed)", done:false },
    { key:"programme_draft_created", label:"Draft programme created (key milestones)", done:false },
    { key:"client_comms_cadence", label:"Client communication cadence agreed (weekly update etc.)", done:false },
    { key:"site_meeting_schedule", label:"Site meeting schedule set", done:false },
    { key:"client_decision_deadlines", label:"Client decision deadlines created (selections by dates)", done:false },
    { key:"contract_status", label:"Contract status confirmed", done:false },
    { key:"payment_schedule", label:"Deposit/payment schedule confirmed", done:false },
    { key:"budget_allowances", label:"Budget allowances confirmed", done:false },
    { key:"time_tracking_method", label:"Time tracking method confirmed (Hnry export)", done:false }
  ];
}

function parseJsonSafe(v, fallback){
  try{
    if(v === null || v === undefined || v === "") return fallback;
    if(typeof v === "object") return v;
    return JSON.parse(v);
  }catch(e){
    return fallback;
  }
}

function preconChecklistFromLead(lead){
  const raw = lead && (lead.preconChecklistJson || lead.preconChecklist || lead.preconChecklistJSON);
  const parsed = parseJsonSafe(raw, null);
  if(Array.isArray(parsed) && parsed.length) return parsed;
  return defaultPreconChecklist();
}

function preconProgress(list){
  if(!Array.isArray(list) || !list.length) return {done:0,total:0,pct:0};
  const total = list.length;
  const done = list.filter(i=>!!i.done).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  return {done,total,pct};
}



function photosTakenFromJson(v){
  try{
    if(!v) return false;
    if(typeof v === "boolean") return v;
    if(typeof v === "string"){
      if(v === "true" || v === "1") return true;
      if(v === "false" || v === "0") return false;
      const parsed = JSON.parse(v);
      if(Array.isArray(parsed)) return parsed.length > 0;
      if(typeof parsed === "object") return Object.keys(parsed).length > 0;
    }
    if(Array.isArray(v)) return v.length > 0;
    if(typeof v === "object") return Object.keys(v).length > 0;
  }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  return false;
}



function escapeAttr(v){
  if(v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

const INSPECTION_TYPES_NZ = ["Pre-slab / Pre-pour (foundations)", "Set-out / Pre-foundation check", "Under-slab plumbing inspection", "Under-slab drainage inspection", "Foundation / footings inspection", "Blockwork / retaining wall inspection", "Slab pour observation", "Pre-wrap / Building wrap inspection", "Pre-cladding / cavity battens", "Pre-line (framing / bracing / fixings)", "Hold-downs / fixings / bracing check", "Mid-build framing check", "Pre-roof / roof framing", "Roofing / roof cladding inspection", "Pre-joinery / openings check", "Joinery installation inspection", "Pre-lining services (electrical/plumbing/HVAC)", "Insulation inspection", "Wet area waterproofing inspection", "Pre-tile inspection", "Smoke alarm / fire safety check", "Stairs / balustrade / barrier inspection", "Deck / balcony / handrail inspection", "Final inspection (CCC / code compliance)", "CCC documentation review", "Electrical (CoC) check", "Plumbing (PS3 / as-built) check", "Gasfitting check", "Drainage sign-off", "Other"];
// CCC planning order (NZ residential - common sequence)
const CCC_INSPECTION_ORDER = [
  "Pre-slab / Pre-pour (foundations)",
  "Foundation steel inspection",
  "Drainage inspection (under-slab / pre-cover)",
  "Underfloor / subfloor framing inspection",
  "Bracing inspection",
  "Framing / pre-line inspection",
  "Plumbing inspection (pre-line)",
  "Electrical inspection (pre-line)",
  "Insulation inspection",
  "Pre-lining inspection",
  "Building wrap / cladding cavity inspection",
  "Cladding inspection",
  "Waterproofing inspection (wet areas)",
  "Membrane / deck waterproofing inspection",
  "Final plumbing inspection",
  "Final electrical inspection",
  "Fireplace / solid fuel heater inspection",
  "Final building inspection / CCC final"
];
function cccSortTypes(types){
  const idx = new Map(CCC_INSPECTION_ORDER.map((t,i)=>[t,i]));
  return (types||[]).slice().sort((a,b)=>{
    const ia = idx.has(a) ? idx.get(a) : 9999;
    const ib = idx.has(b) ? idx.get(b) : 9999;
    if(ia!==ib) return ia-ib;
    return String(a).localeCompare(String(b));
  });
}
function patchProject(projectId, patch){
  const now = new Date().toISOString();
  state.projects = (state.projects||[]).map(p=>{
    if(String(p.id)!==String(projectId)) return p;
    return { ...p, ...patch, updatedAt: now };
  });
  saveState(state);
}




// ===== AUTO UPDATE (Option 1) =====
// BUILD V15_POPUP_MENU 20260122232949
function showUpdateBanner(onReload){
  // Small non-intrusive banner at top of page
  let el = document.getElementById("updateBanner");
  if(!el){
    el = document.createElement("div");
    el.id = "updateBanner";
    el.style.position = "fixed";
    el.style.left = "12px";
    el.style.right = "12px";
    el.style.top = "12px";
    el.style.zIndex = "99999";
    el.style.padding = "12px 14px";
    el.style.borderRadius = "14px";
    el.style.border = "1px solid var(--border)";
    el.style.background = "var(--toast-bg)";
    el.style.backdropFilter = "blur(10px)";
    el.style.webkitBackdropFilter = "blur(10px)";
    el.style.boxShadow = "0 18px 40px rgba(0,0,0,0.45)";
    el.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:700;letter-spacing:.2px">Update available</div>
          <div style="opacity:.75;font-size:13px">Reload to use the latest version.</div>
        </div>
        <button id="updateReloadBtn" style="min-height:42px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:linear-gradient(135deg, rgba(82,132,255,0.95), rgba(157,92,255,0.92));color:rgba(255,255,255,0.95);font-weight:700">Reload</button>
      </div>`;
    document.body.appendChild(el);
  }
  const btn = document.getElementById("updateReloadBtn");
  if(btn) btn.onclick = async ()=>{ try{ onReload && onReload(); }finally{ window.location.reload(); } };
}

(function registerServiceWorkerAutoUpdate(){
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").then((reg)=>{
    reg.addEventListener("updatefound", ()=>{
      const newWorker = reg.installing;
      if(!newWorker) return;
      newWorker.addEventListener("statechange", ()=>{
        // installed + existing controller means an update is ready
        if(newWorker.state === "installed" && navigator.serviceWorker.controller){
          showUpdateBanner();
        }
      });
    });
  }).catch(()=>{});

  // If the controller changes, reload once (new SW took control)
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    if(refreshing) return;
    refreshing = true;
    window.location.reload();
  });
})();
// ===== /AUTO UPDATE =====



async function forceRefreshApp(){
  try {
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch(e){ console.warn('SW unregister failed', e); }

  try {
    if(window.caches && caches.keys){
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch(e){ console.warn('Cache clear failed', e); }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('v', String(Date.now()));
    window.location.replace(url.toString());
  } catch(e) {
    window.location.reload();
  }
}

async function checkForUpdate(){
  try {
    if('serviceWorker' in navigator){
      const reg = await navigator.serviceWorker.getRegistration();
      if(reg) await reg.update();
    }
  } catch(e){ console.warn('SW update failed', e); }
}

// BUILD V15_POPUP_MENU 20260122232949

// Minimal toast (used by clipboard + sync messages). Safe fallback on iOS/Safari.
function toast(msg, ms=2200){
  try{
    const el = document.createElement("div");
    el.textContent = String(msg ?? "");
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "84px";
    el.style.transform = "translateX(-50%)";
    el.style.background = "var(--toast-bg)";
    el.style.color = "var(--toast-text)";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "12px";
    el.style.fontSize = "14px";
    el.style.zIndex = "99999";
    el.style.maxWidth = "92vw";
    el.style.textAlign = "center";
    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}
 }, ms);
  }catch(e){
    // absolute fallback
    alert(String(msg ?? ""));
  }
}
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// BUILD V15_POPUP_MENU 20260122232949
// PHASE 2 BUILD 20260119055027

/* ===== LOGIN GATE ===== */
const AUTH_USER = "mattyc";
const AUTH_PASS = "2323";

function isLoggedIn(){
  // If login UI is not present in this build, treat as logged in
  if(!document.getElementById("loginScreen") && !document.getElementById("loginBtn")) return true;
  return localStorage.getItem("mcb_logged_in")==="1";
}
function showApp(){
  const ls=document.getElementById("loginScreen"); if(ls) ls.style.display="none";
  const ap=document.getElementById("app"); if(ap) ap.style.display="block";
  render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}


function ensureFleetNav(){
  try{
    const nav = document.querySelector(".footerbar .nav");
    if(!nav) return;
    if(nav.querySelector('[data-nav="fleet"]')) return;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.dataset.nav = "fleet";
    btn.type = "button";
    btn.textContent = "Fleet";
    // insert before Equipment if present, else before Settings
    const before = nav.querySelector('[data-nav="equipment"]') || nav.querySelector('[data-nav="settings"]') || null;
    nav.insertBefore(btn, before);
    btn.addEventListener("click", ()=> navTo("fleet"));
  }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}

function ensureEquipmentNav(){
  try{
    const nav = document.querySelector(".footerbar .nav");
    if(!nav) return;
    if(nav.querySelector('[data-nav="equipment"]')) return;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.dataset.nav = "equipment";
    btn.type = "button";
    btn.textContent = "Equipment";
    // insert before Settings
    const before = nav.querySelector('[data-nav="settings"]') || null;
    nav.insertBefore(btn, before);
    btn.addEventListener("click", ()=> navTo("equipment"));
  }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}
function ensurePipelineNav(){
  try{
    const nav = document.querySelector(".footerbar .nav");
    if(!nav) return;
    if(nav.querySelector('[data-nav="pipeline"]')) return;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.dataset.nav = "pipeline";
    btn.type = "button";
    btn.textContent = "Pipeline";
    // insert before Projects
    const first = nav.querySelector('[data-nav="projects"]') || nav.firstChild;
    nav.insertBefore(btn, first);
    // bind click (same pattern as others)
    btn.addEventListener("click", ()=> navTo("pipeline"));
  }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}

document.addEventListener("DOMContentLoaded", ()=>{
  try{ initTheme(); }catch(e){}
    
  try{ initNavMenu(); }catch(e){}
try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  try{ initUpdateStamp(); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}



  try{ensurePipelineNav();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  try{ensureFleetNav();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  try{ensureEquipmentNav();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  
  // Auto-bypass login if login UI is not present
  if(!document.getElementById("loginBtn")){ try{ showApp(); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}
 }
if(isLoggedIn()){
    showApp();
  } else {
    const __loginBtn = document.getElementById("loginBtn");
if(__loginBtn){
  __loginBtn.onclick = ()=>{
      const u=document.getElementById("loginUser").value;
      const p=document.getElementById("loginPass").value;
      if(u===AUTH_USER && p===AUTH_PASS){
        localStorage.setItem("mcb_logged_in","1");
        showApp();
      } else {
        document.getElementById("loginError").style.display="block";
      }
    };
}

  }
});
/* ===== END LOGIN GATE ===== */
/* MCB Site Manager - offline-first single-file storage (localStorage)
   Modules: Projects, Tasks, Diary, Variations, Subbies, Deliveries, Inspections, Reports, Settings
   Root logo: ./logo.png (used in header + reports)
*/
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

// ===== PIN hashing (SHA-256) =====
async function hashPin(pin){
  const p = String(pin||"").trim();
  if(!p) return "";
  const enc = new TextEncoder().encode(p);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function verifyWorkerPin(worker, pin){
  try{
    const ph = await hashPin(pin);
    return !!ph && String(worker?.pinHash||"").trim() === ph;
  }catch(e){ return false; }
}

const STORE_KEY = "mcb_site_manager_v1_full";
const SETTINGS_KEY = "mcb_settings_v1";

const defaults = () => ({
  projects: [],
  tasks: [],
  diary: [],
  variations: [],
  subbies: [],
  deliveries: [],
  leads: [],
  inspections: [],
  programmeTasks: [],
  programmeHistoryStats: [],
  equipment: [],
  equipmentLogs: [],
  fleet: [],
  fleetLogs: [],
  activityLog: []
});


// ===== Programme Engine (Phase 12C.1) =====
const PROGRAMME_TEMPLATES = {
  standard_nz: {
    name: "Standard NZ Residential (Generic)",
    tasks: [
      // Pre-start
      { key:"prestart_admin", name:"Pre-start admin & setup", phase:"Pre-start", trade:"PM", baseDays:2, deps:[] },
      { key:"site_establish", name:"Site establishment (welfare, fencing, temp power)", phase:"Pre-start", trade:"Builder", baseDays:2, deps:["prestart_admin"] },

      // Foundations
      { key:"setout", name:"Set-out", phase:"Foundations", trade:"Survey/Builder", baseDays:1, deps:["site_establish"] },
      { key:"earthworks", name:"Earthworks / excavation", phase:"Foundations", trade:"Earthworks", baseDays:2, deps:["setout"] },
      { key:"footings_prep", name:"Footings/boxing/rebar prep", phase:"Foundations", trade:"Builder", baseDays:2, deps:["earthworks"] },
      { key:"foundations_pour", name:"Concrete pour", phase:"Foundations", trade:"Concrete", baseDays:1, deps:["footings_prep"] },
      { key:"foundations_cure", name:"Cure / wait time buffer", phase:"Foundations", trade:"", baseDays:3, deps:["foundations_pour"], bufferDays:2, weatherSensitive:true },
      { key:"foundation_insp", name:"Foundation inspection (milestone)", phase:"Foundations", trade:"Council", baseDays:0, deps:["foundations_cure"], isMilestone:true, milestoneType:"inspection" },

      // Framing
      { key:"floor_framing", name:"Floor framing", phase:"Framing", trade:"Builder", baseDays:2, deps:["foundation_insp"] },
      { key:"wall_framing", name:"Wall framing", phase:"Framing", trade:"Builder", baseDays:4, deps:["floor_framing"] },
      { key:"roof_framing", name:"Roof framing", phase:"Framing", trade:"Builder", baseDays:3, deps:["wall_framing"] },
      { key:"bracing_tiedown", name:"Bracing & tie-downs", phase:"Framing", trade:"Builder", baseDays:2, deps:["roof_framing"] },
      { key:"framing_insp", name:"Framing inspection (milestone)", phase:"Framing", trade:"Council", baseDays:0, deps:["bracing_tiedown"], isMilestone:true, milestoneType:"inspection" },

      // Envelope
      { key:"roof_on", name:"Roof on", phase:"Envelope", trade:"Roofer", baseDays:3, deps:["framing_insp"] },
      { key:"wrap_cavity", name:"Building wrap & cavity battens", phase:"Envelope", trade:"Builder", baseDays:2, deps:["roof_on"] },
      { key:"windows_doors", name:"Windows & exterior doors", phase:"Envelope", trade:"Joiner", baseDays:2, deps:["wrap_cavity"] },
      { key:"cladding", name:"Cladding install", phase:"Envelope", trade:"Cladder", baseDays:8, deps:["windows_doors"] },
      { key:"weathertight", name:"Weathertightness checkpoint", phase:"Envelope", trade:"PM", baseDays:0, deps:["cladding"], isMilestone:true, milestoneType:"milestone" },

      // Rough-in services
      { key:"plumb_rough", name:"Plumbing rough-in", phase:"Services", trade:"Plumber", baseDays:2, deps:["weathertight"] },
      { key:"elec_rough", name:"Electrical rough-in", phase:"Services", trade:"Sparky", baseDays:2, deps:["weathertight"] },
      { key:"hvac_rough", name:"HVAC / ventilation rough-in (if applicable)", phase:"Services", trade:"HVAC", baseDays:1, deps:["weathertight"] },
      { key:"preline_insp", name:"Pre-line inspection (milestone)", phase:"Services", trade:"Council", baseDays:0, deps:["plumb_rough","elec_rough","hvac_rough"], isMilestone:true, milestoneType:"inspection" },

      // Close-in
      { key:"insulation", name:"Insulation", phase:"Close-in", trade:"Insulation", baseDays:1, deps:["preline_insp"] },
      { key:"linings", name:"Gib/linings", phase:"Close-in", trade:"Liner", baseDays:4, deps:["insulation"] },
      { key:"stopping", name:"Stopping", phase:"Close-in", trade:"Stopper", baseDays:4, deps:["linings"] },
      { key:"waterproofing", name:"Waterproofing (wet areas)", phase:"Close-in", trade:"Waterproofer", baseDays:1, deps:["stopping"], bufferDays:1 },
      { key:"paint_first", name:"First coat paint", phase:"Close-in", trade:"Painter", baseDays:2, deps:["waterproofing"] },

      // Fit-off
      { key:"joinery_install", name:"Joinery install", phase:"Fit-off", trade:"Joiner", baseDays:2, deps:["paint_first"] },
      { key:"flooring", name:"Flooring", phase:"Fit-off", trade:"Flooring", baseDays:2, deps:["paint_first"] },
      { key:"plumb_fittoff", name:"Plumbing fit-off", phase:"Fit-off", trade:"Plumber", baseDays:2, deps:["joinery_install","flooring"] },
      { key:"elec_fittoff", name:"Electrical fit-off", phase:"Fit-off", trade:"Sparky", baseDays:2, deps:["joinery_install","flooring"] },
      { key:"paint_finish", name:"Final paint", phase:"Fit-off", trade:"Painter", baseDays:3, deps:["plumb_fittoff","elec_fittoff"] },

      // Completion
      { key:"final_insp", name:"Final inspection (milestone)", phase:"Completion", trade:"Council", baseDays:0, deps:["paint_finish"], isMilestone:true, milestoneType:"inspection" },
      { key:"snag_defects", name:"Defects / snagging", phase:"Completion", trade:"Builder", baseDays:2, deps:["final_insp"] },
      { key:"final_clean", name:"Final clean", phase:"Completion", trade:"Cleaner", baseDays:1, deps:["snag_defects"] },
      { key:"ccc_docs", name:"CCC documentation pack", phase:"Completion", trade:"PM", baseDays:2, deps:["final_clean"] },
      { key:"handover", name:"Handover", phase:"Completion", trade:"PM", baseDays:0, deps:["ccc_docs"], isMilestone:true, milestoneType:"milestone" }
    ]
  },

  new_build: { name:"New Build", inherits:"standard_nz", modifiers:{ baseMultiplier:1.15 } },
  renovation: { name:"Renovation / Alteration", inherits:"standard_nz", modifiers:{ baseMultiplier:0.7, occupiedBufferDays:3 } },
  extension: { name:"Extension / Addition", inherits:"standard_nz", modifiers:{ baseMultiplier:0.9 } },
  bathroom: { name:"Bathroom / Wet Area", inherits:"standard_nz", modifiers:{ baseMultiplier:0.35 } },
  deck: { name:"Deck / External", inherits:"standard_nz", modifiers:{ baseMultiplier:0.25 } },
  re_roof: { name:"Re-roof / Roofing", inherits:"standard_nz", modifiers:{ baseMultiplier:0.2 } }
};


function saveProject(p){
  // upsert into state.projects
  if(!p || !p.id) return;
  const list = alive(state.projects).filter(isAlive);
  const idx = list.findIndex(x=>String(x.id)===String(p.id));
  if(idx>=0) list[idx]=p; else list.unshift(p);
  state.projects = list;
  saveState(state);
}

function programmeTemplateResolve(key){
  const t = PROGRAMME_TEMPLATES[key] || PROGRAMME_TEMPLATES.standard_nz;
  if(t.tasks) return t;
  const base = programmeTemplateResolve(t.inherits || "standard_nz");
  const merged = { ...base, ...t, tasks: base.tasks.slice() };
  return merged;
}

function programmeTasksForProject(projectId){
  return aliveArr(state.programmeTasks).filter(x=>String(x.projectId)===String(projectId) && isAlive(x));
}


function saveProgrammeTasksForProject(projectId, tasks){
  // Replace all programmeTasks for this project with provided list, then persist state
  const pid = String(projectId);
  const keep = aliveArr(state.programmeTasks).filter(x=>String(x.projectId)!==pid);
  const next = keep.concat((tasks||[]).map(t=>{
    if(!t.projectId) t.projectId = pid;
    return t;
  }));
  state.programmeTasks = next;
  saveState(state);
}


function parseISODate(s){
  try{ if(!s) return null; const d=new Date(s); return isNaN(d)?null:d; }catch(e){ return null; }
}
function fmtISO(d){
  const dd = (d instanceof Date)? d : new Date(d);
  if(isNaN(dd)) return "";
  const y=dd.getFullYear(); const m=String(dd.getMonth()+1).padStart(2,"0"); const da=String(dd.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}
function addDays(d, days){
  const x=new Date(d); x.setDate(x.getDate() + (days||0)); return x;
}

function topoSortTasks(tasks){
  const map = new Map(tasks.map(t=>[t.key, t]));
  const indeg = new Map(tasks.map(t=>[t.key, 0]));
  tasks.forEach(t=>{
    (t.deps||[]).forEach(dep=>{
      if(indeg.has(t.key) && map.has(dep)) indeg.set(t.key, indeg.get(t.key)+1);
    });
  });
  const q = [];
  indeg.forEach((v,k)=>{ if(v===0) q.push(k); });
  const out=[];
  while(q.length){
    const k=q.shift();
    out.push(map.get(k));
    tasks.forEach(t=>{
      if((t.deps||[]).includes(k) && indeg.has(t.key)){
        indeg.set(t.key, indeg.get(t.key)-1);
        if(indeg.get(t.key)===0) q.push(t.key);
      }
    });
  }
  // if cycles, append remaining
  const seen=new Set(out.map(t=>t.key));
  tasks.forEach(t=>{ if(!seen.has(t.key)) out.push(t); });
  return out;
}

function computeSchedule(tasks, startDate){
  const map = new Map(tasks.map(t=>[t.key, t]));
  const starts = new Map();
  const ends = new Map();
  const ordered = topoSortTasks(tasks);
  ordered.forEach(t=>{
    const deps = (t.deps||[]).filter(k=>map.has(k));
    let s = new Date(startDate);
    if(deps.length){
      const maxEnd = deps.map(k=>ends.get(k)).filter(Boolean).sort((a,b)=>b-a)[0];
      if(maxEnd) s = new Date(maxEnd);
    }
    const dur = Math.max(0, Number(t.plannedDays ?? t.baseDays ?? 0));
    const buff = Math.max(0, Number(t.bufferDays ?? 0));
    const e = addDays(s, dur + buff);
    starts.set(t.key, s);
    ends.set(t.key, e);
    t.plannedStart = fmtISO(s);
    t.plannedEnd = fmtISO(e);
    t.totalDays = dur + buff;
  });
  return { starts, ends };
}

function computeCriticalPath(tasks){
  const map = new Map(tasks.map(t=>[t.key, t]));
  const ordered = topoSortTasks(tasks);
  const dist = new Map(); // longest duration to end of task
  const prev = new Map();
  ordered.forEach(t=>{
    const deps=(t.deps||[]).filter(k=>map.has(k));
    let best=0, bestDep=null;
    deps.forEach(dk=>{
      const v=dist.get(dk)||0;
      if(v>best){ best=v; bestDep=dk; }
    });
    const w = Math.max(0, Number(t.totalDays ?? t.plannedDays ?? t.baseDays ?? 0));
    dist.set(t.key, best + w);
    prev.set(t.key, bestDep);
  });
  // find end task with max dist
  let endKey=null, best=0;
  dist.forEach((v,k)=>{ if(v>=best){ best=v; endKey=k; }});
  const cp=new Set();
  let cur=endKey;
  while(cur){
    cp.add(cur);
    cur = prev.get(cur);
  }
  tasks.forEach(t=> t.isCritical = cp.has(t.key));
  return cp;
}

function generateProgrammeForProject(p, opts={}){
  const key = opts.templateKey || p.programmeTemplateKey || "standard_nz";
  const tpl = programmeTemplateResolve(key);
  const complexity = opts.complexity || p.programmeComplexity || "Moderate";
  const mult = (complexity==="Simple")?1.0:(complexity==="Complex")?1.4:1.2;
  const baseMult = (tpl.modifiers && tpl.modifiers.baseMultiplier) ? tpl.modifiers.baseMultiplier : 1.0;
  const start = parseISODate(p.programmeStartDate) || parseISODate(p.startDate) || new Date();
  const tasks = tpl.tasks.map(t=>({
    id: uid(),
    projectId: p.id,
    key: t.key,
    name: t.name,
    phase: t.phase,
    trade: t.trade,
    deps: (t.deps||[]).slice(),
    baseDays: Number(t.baseDays||0),
    bufferDays: Number(t.bufferDays||0),
    weatherSensitive: !!t.weatherSensitive,
    isMilestone: !!t.isMilestone,
    milestoneType: t.milestoneType || "",
    plannedDays: Math.round(Number(t.baseDays||0) * mult * baseMult),
    status: "Planned",
    notes: "",
    deletedAt: null
  }));
  // recompute schedule + critical path
  computeSchedule(tasks, start);
  computeCriticalPath(tasks);
  p.programmeTemplateKey = key;
  p.programmeComplexity = complexity;
  if(!p.programmeStartDate) p.programmeStartDate = fmtISO(start);
  saveProject(p);
  // replace existing tasks for this project (soft delete old)
  state.programmeTasks = aliveArr(state.programmeTasks).filter(x=>String(x.projectId)!==String(p.id));
  state.programmeTasks = [...aliveArr(state.programmeTasks), ...tasks];
  saveState(state);
  return tasks;
}


// ===== Custom Programme Sections =====
function ensureCustomProgramme(p){
  if(!p.customProgramme) p.customProgramme = [];
  if(!p.programmeMode) p.programmeMode = "template"; // "template" | "custom"
  // normalize items
  p.customProgramme = (p.customProgramme||[]).map(s=>{
    if(!s || typeof s!=="object") return null;
    const ns = { ...s };
    if(!ns.id) ns.id = uid();
    if(!ns.title) ns.title = "Section";
    ns.days = Number(ns.days || 1);
    if(ns.days < 1) ns.days = 1;
    if(!ns.startDate) ns.startDate = "";
    ns.manualStart = !!ns.manualStart;
    return ns;
  }).filter(Boolean);
  return p.customProgramme;
}
function computeCustomProgrammeSchedule(p){
  ensureCustomProgramme(p);
  const sections = p.customProgramme;
  const projStart = p.programmeStartDate || fmtISO(new Date());
  let cursor = projStart;

  const out = [];
  for(let i=0;i<sections.length;i++){
    const s = { ...sections[i] };
    const start = (s.manualStart && s.startDate) ? s.startDate : (s.startDate || cursor);
    s.plannedStart = start;
    const end = fmtISO(addDays(start, Math.max(0, Number(s.days||1)-1)));
    s.plannedEnd = end;
    out.push(s);

    // next cursor is day after end
    cursor = fmtISO(addDays(end, 1));

    // if next section is not manualStart, keep its startDate empty so it follows automatically
    if(i+1 < sections.length){
      if(!sections[i+1].manualStart){
        sections[i+1].startDate = "";
      }
    }
  }
  return out;
}
function totalDaysForCustomProgramme(schedule){
  return (schedule||[]).reduce((a,s)=>a + (Number(s.days||0)), 0);
}

function projectProgramme(p){
  // Ensure custom programme fields exist
  ensureCustomProgramme(p);

  const mode = p.programmeMode || "template"; // template | custom
  const templateTasks = programmeTasksForProject(p.id);
  const tplKey = p.programmeTemplateKey || "standard_nz";
  const complexity = p.programmeComplexity || "Moderate";
  const start = p.programmeStartDate || fmtISO(new Date());

  const customSchedule = computeCustomProgrammeSchedule(p);
  const customFinish = customSchedule.length ? customSchedule.map(s=>s.plannedEnd).filter(Boolean).sort().slice(-1)[0] : "";
  const customDays = totalDaysForCustomProgramme(customSchedule);

  const tplFinish = templateTasks.length ? templateTasks.map(t=>t.plannedEnd).filter(Boolean).sort().slice(-1)[0] : "";
  const tplDays = templateTasks.length ? templateTasks.reduce((a,t)=>a+(Number(t.totalDays||0)),0) : 0;

  const finish = mode==="custom" ? customFinish : tplFinish;
  const totalDays = mode==="custom" ? customDays : tplDays;

  return `
    <div class="card">
      <div class="row space noPrint" style="gap:10px; flex-wrap:wrap; align-items:flex-end">
        <div class="row" style="gap:10px; flex-wrap:wrap; align-items:center">
          <label class="sub">Mode</label>
          <select class="input" id="progMode" style="min-width:180px">
            <option value="template">Template programme</option>
            <option value="custom">Custom programme</option>
          </select>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; align-items:center">
          <label class="sub">Project start</label>
          <input class="input" id="progStart" type="date" value="${escapeAttr(start)}" />
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; align-items:center" id="tplControls">
          <label class="sub">Template</label>
          <select class="input" id="progTpl" style="min-width:220px">
            <option value="standard_nz">Standard NZ Residential</option>
            <option value="new_build">New Build</option>
            <option value="renovation">Renovation / Alteration</option>
            <option value="extension">Extension / Addition</option>
            <option value="bathroom">Bathroom / Wet Area</option>
            <option value="deck">Deck / External</option>
            <option value="re_roof">Re-roof / Roofing</option>
          </select>
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap; align-items:center" id="tplControls2">
          <label class="sub">Complexity</label>
          <select class="input" id="progCx" style="min-width:160px">
            <option>Simple</option>
            <option>Moderate</option>
            <option>Complex</option>
          </select>
        </div>

        <button class="btn primary" id="progGen" type="button">Generate programme</button>

        <div class="row" style="gap:10px; flex-wrap:wrap; align-items:center" id="customControls">
          <button class="btn" id="customAddSection" type="button">Add section</button>
          <button class="btn" id="customAutoFix" type="button">Auto-consecutive</button>
        </div>
      </div>

      <div class="row space" style="margin-top:10px">
        <div class="sub">Projected finish: <b>${escapeHtml(finish || "—")}</b></div>
        <div class="sub">Total planned days: <b>${totalDays || 0}</b></div>
      </div>

      <div id="customEditor" style="margin-top:10px"></div>
    </div>

    <div class="card" style="margin-top:12px">
      ${mode==="custom"
        ? customProgrammeGantt(customSchedule)
        : (templateTasks.length ? programmeGantt(templateTasks, p.id) : `<div class="sub">No programme yet. Use <b>Generate programme</b>.</div>`)}
    </div>

    <div class="card" style="margin-top:12px">
      <div class="row space noPrint"><div class="h3">Removed programme tasks</div><div class="sub">Restore tasks removed for this job</div></div>
      <div id="removedProgrammeList" style="margin-top:10px"></div>
    </div>
`;
}

function customProgrammeGantt(schedule){
  const rows = (schedule||[]).map((s,idx)=>{
    const dur = Number(s.days||1);
    const barW = Math.min(100, Math.max(3, dur*6));
    const badge = s.manualStart ? "badge" : "badge";
    return `
      <div class="gRow">
        <div class="gName">
          <div class="row" style="gap:8px; flex-wrap:wrap; align-items:center">
            <span class="${badge}">Section</span>
            <b>${escapeHtml(s.title||("Section "+(idx+1)))}</b>
          </div>
          <div class="sub">${s.manualStart ? "Custom start date" : "Consecutive by default"}</div>
        </div>
        <div class="gDates sub">${escapeHtml(s.plannedStart||"")} → ${escapeHtml(s.plannedEnd||"")}</div>
        <div class="gBar"><div class="bar" style="width:${barW}%"></div></div>
        <div class="gDur sub">${dur}d</div>
      </div>
    `;
  }).join("");
  return `<div class="gantt">${rows || `<div class="sub">No custom sections yet. Click <b>Add section</b>.</div>`}</div>`;
}


function renderCustomProgrammeEditor(p){
  ensureCustomProgramme(p);
  const wrap = document.getElementById("customEditor");
  if(!wrap) return;

  const schedule = computeCustomProgrammeSchedule(p);
  const rows = p.customProgramme.map((s,idx)=>{
    const sch = schedule[idx] || {};
    return `
      <div class="row" style="gap:10px; flex-wrap:wrap; align-items:flex-end; margin:10px 0; padding:10px; border:1px solid var(--border); border-radius:14px">
        <div style="min-width:220px; flex:2">
          <label class="sub">Title</label>
          <input class="input" data-cprog-title="${escapeAttr(s.id)}" value="${escapeAttr(s.title||"")}" />
        </div>
        <div style="min-width:120px">
          <label class="sub">Days</label>
          <input class="input" type="number" min="1" step="1" data-cprog-days="${escapeAttr(s.id)}" value="${escapeAttr(String(Number(s.days||1)))}" />
        </div>
        <div style="min-width:170px">
          <label class="sub">Start date</label>
          <input class="input" type="date" data-cprog-start="${escapeAttr(s.id)}" value="${escapeAttr(s.manualStart ? (s.startDate||sch.plannedStart||"") : (s.startDate||""))}" />
          <div class="smallmuted">
            ${s.manualStart ? "Manual" : "Auto"} • ${escapeHtml((sch.plannedStart||"—"))} → ${escapeHtml((sch.plannedEnd||"—"))}
          </div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn ghost sm" type="button" data-cprog-toggle="${escapeAttr(s.id)}">${s.manualStart?"Auto":"Manual"}</button>
          <button class="btn ghost sm danger" type="button" data-cprog-del="${escapeAttr(s.id)}">Delete</button>
        </div>
      </div>
    `;
  }).join("");

  wrap.innerHTML = rows || `<div class="sub">No custom sections yet. Click <b>Add section</b>.</div>`;

  // Bind inputs
  $$("[data-cprog-title]").forEach(el=> el.onchange = ()=>{
    const id = el.getAttribute("data-cprog-title");
    const it = p.customProgramme.find(x=>String(x.id)===String(id));
    if(!it) return;
    it.title = el.value.trim() || "Section";
    it.updatedAt = new Date().toISOString();
    saveProject(p);
    render();
  });
  $$("[data-cprog-days]").forEach(el=> el.onchange = ()=>{
    const id = el.getAttribute("data-cprog-days");
    const it = p.customProgramme.find(x=>String(x.id)===String(id));
    if(!it) return;
    it.days = Math.max(1, Number(el.value||1));
    it.updatedAt = new Date().toISOString();
    // Reflow subsequent non-manual sections
    saveProject(p);
    render();
  });
  $$("[data-cprog-start]").forEach(el=> el.onchange = ()=>{
    const id = el.getAttribute("data-cprog-start");
    const it = p.customProgramme.find(x=>String(x.id)===String(id));
    if(!it) return;
    const v = (el.value||"").trim();
    it.startDate = v;
    it.manualStart = !!v; // setting a date marks as manual
    it.updatedAt = new Date().toISOString();
    saveProject(p);
    render();
  });
  $$("[data-cprog-toggle]").forEach(btn=> btn.onclick = ()=>{
    const id = btn.getAttribute("data-cprog-toggle");
    const it = p.customProgramme.find(x=>String(x.id)===String(id));
    if(!it) return;
    it.manualStart = !it.manualStart;
    if(!it.manualStart) it.startDate = ""; // go back to auto
    it.updatedAt = new Date().toISOString();
    saveProject(p);
    render();
  });
  $$("[data-cprog-del]").forEach(btn=> btn.onclick = ()=>{
    const id = btn.getAttribute("data-cprog-del");
    if(!confirm("Delete this programme section?")) return;
    p.customProgramme = p.customProgramme.filter(x=>String(x.id)!==String(id));
    saveProject(p);
    render();
  });
}

function programmeGantt(tasks, projectId){
  // hide removed tasks from the active programme view
  tasks = (tasks||[]).filter(t=>!isProgrammeTaskRemoved(t));
  const phases = {};
  tasks.forEach(t=>{ (phases[t.phase] = phases[t.phase] || []).push(t); });
  const phaseKeys = Object.keys(phases);
  const rows = phaseKeys.map(ph=>{
    const list = phases[ph].sort((a,b)=>(a.plannedStart||"").localeCompare(b.plannedStart||""));
    const inner = list.map(t=>{
      const crit = t.isCritical ? "badge danger" : "badge";
      const dur = Number(t.totalDays||0);
      const barW = Math.min(100, Math.max(3, dur*6)); // visual only
      return `
        <div class="gRow">
          <div class="gName">
            <div class="row" style="gap:8px; flex-wrap:wrap; align-items:center">
              <span class="${crit}">${t.isCritical?"Critical":"Task"}</span>
              ${t.isMilestone? `<span class="badge">Milestone</span>`:""}
              <b>${escapeHtml(t.name)}</b>
            </div>
            <div class="sub">${escapeHtml(t.trade || "")}</div>
          </div>
          <div class="gDates sub">${escapeHtml(t.plannedStart||"")} → ${escapeHtml(t.plannedEnd||"")}</div>
          <div class="gBar"><div class="bar" style="width:${barW}%"></div></div>
          <div class="gDur sub">${dur}d</div>
          <div class="gAct noPrint">
            <button class="btn ghost sm" type="button"
              data-prog-remove="${escapeAttr(t.id)}"
              data-prog-project="${escapeAttr(projectId||"")}">Remove</button>
          </div>
        </div>
      `;
    }).join("");
    return `<div class="gPhase"><div class="h3">${escapeHtml(ph)}</div>${inner}</div>`;
  }).join("");

  return `<div class="gantt">${rows}</div>`;
}


const defaultSettings = () => ({
  theme: "dark",
  companyName: "Matty Campbell Building",
  labourRate: 90, // NZD/hr default - editable
  currency: "NZD",

  // Worker Profiles / Worker Mode
  workerMode: {
    enabled: false,
    currentWorkerId: "",
    requirePin: false
  },
  workers: [], // [{id,name,pinHash,isAdmin,perms:{module:{view,edit}}}]

  // Google Sheets / Apps Script sync (device can override)
  sync: { url:"", key:"" }
});


/* =============================
   IndexedDB Storage Layer (v2)
   - Primary persistence: IndexedDB
   - localStorage retained as a lightweight backup + migration source
   Goals:
   - One canonical state shape so forms/renders match fields
   - Auto-normalise records to prevent missing-field UI glitches
============================= */

const DB_NAME = "mcb_site_manager_db";
const DB_VERSION = 1;
const DB_STORE = "kv"; // key/value store for state + settings

let __idbPromise = null;
let __idbReady = false;

function openMCBDB(){
  if(__idbPromise) return __idbPromise;
  __idbPromise = new Promise((resolve, reject)=>{
    try{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        if(!db.objectStoreNames.contains(DB_STORE)){
          db.createObjectStore(DB_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error || new Error("IndexedDB open failed"));
    }catch(err){ reject(err); }
  });
  return __idbPromise;
}

async function idbGet(key){
  const db = await openMCBDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.get(key);
    req.onsuccess = ()=> resolve(req.result ? req.result.value : null);
    req.onerror = ()=> reject(req.error || new Error("IndexedDB get failed"));
  });
}
async function idbSet(key, value){
  const db = await openMCBDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    store.put({ key, value });
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error || new Error("IndexedDB set failed"));
  });
}

function nowISO(){ return new Date().toISOString(); }

// Canonical lists expected throughout the UI.
// If a list is missing, forms/renders can misalign (blank cells / errors).
const CANON_LIST_KEYS = [
  "projects","tasks","diary","variations","subbies","deliveries","leads","inspections",
  "programmeTasks","programmeHistoryStats",
  "equipment","equipmentLogs","fleet","fleetLogs","activityLog",
  "hsProfiles","hsInductions","hsHazards","hsToolboxes","hsIncidents"
];

// Ensure every record has a stable id and lifecycle fields.
function normaliseRecord(rec){
  if(!rec || typeof rec !== "object") return rec;
  const r = { ...rec };
  if(!r.id) r.id = uid();
  if(!r.createdAt) r.createdAt = nowISO();
  if(!r.updatedAt) r.updatedAt = r.createdAt;

  // Harden common foreign keys so filters don't fail on number vs string mismatch.
  if(r.projectId != null) r.projectId = String(r.projectId);
  if(r.leadId != null) r.leadId = String(r.leadId);
  if(r.taskId != null) r.taskId = String(r.taskId);

  return r;
}

function normaliseState(s){
  const base = { ...defaults(), ...(s||{}) };
  CANON_LIST_KEYS.forEach(k=>{
    if(!Array.isArray(base[k])) base[k] = [];
    base[k] = base[k].filter(Boolean).map(normaliseRecord);
  });

  // UI selections object is expected in multiple modules.
  if(!base.uiSelections) base.uiSelections = { tasks:{}, diary:{}, hs:{} };
  if(!base.uiSelections.tasks) base.uiSelections.tasks = {};
  if(!base.uiSelections.diary) base.uiSelections.diary = {};
  if(!base.uiSelections.hs) base.uiSelections.hs = {};

  return base;
}

// LocalStorage backup keys (legacy)

function loadStateFromLocalStorage(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function loadSettingsFromLocalStorage(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function saveStateToLocalStorage(s){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }catch(e){}
}
function saveSettingsToLocalStorage(s){
  try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }catch(e){}
}

// Debounced IDB writes to avoid performance issues when many UI actions occur quickly.
let __saveTimer = null;
let __pendingState = null;
let __pendingSettings = null;

function schedulePersist(){
  if(__saveTimer) return;
  __saveTimer = setTimeout(async ()=>{
    const ps = __pendingState; const pset = __pendingSettings;
    __pendingState = null; __pendingSettings = null;
    __saveTimer = null;
    try{
      if(ps) await idbSet("state", ps);
      if(pset) await idbSet("settings", pset);
    }catch(e){
      // If IDB fails (private mode / quota), localStorage backup still works.
    }
  }, 150);
}

function loadState(){
  // Synchronous boot: use localStorage (fast); IDB hydrates in initStorageHydrate().
  const local = loadStateFromLocalStorage();
  return normaliseState(local || defaults());
}
function saveState(s){
  const next = normaliseState(s);
  // Always keep a backup for easy export/debug and to survive IDB issues.
  saveStateToLocalStorage(next);
  __pendingState = next;
  schedulePersist();
}
function loadSettings(){
  const local = loadSettingsFromLocalStorage();
  const next = { ...defaultSettings(), ...(local || {}) };

  // Hardwire sync config (do not let Settings overwrite these).
  if(!next.sync) next.sync = {};
  next.sync.url = HARD_SYNC_URL;
  next.sync.key = HARD_COMPANY_KEY;

  return next;
}
function saveSettings(s){
  const next = { ...defaultSettings(), ...(s||{}) };

  // Hardwire sync config (do not let Settings overwrite these).
  if(!next.sync) next.sync = {};
  next.sync.url = HARD_SYNC_URL;
  next.sync.key = HARD_COMPANY_KEY;

  saveSettingsToLocalStorage(next);
  __pendingSettings = next;
  schedulePersist();
}

async function initStorageHydrate(){
  // Hydrate from IndexedDB if available; otherwise seed it from localStorage/defaults.
  try{
    await openMCBDB();
    __idbReady = true;

    const idbState = await idbGet("state");
    const idbSettings = await idbGet("settings");

    if(idbState){
      state = normaliseState(idbState);
      saveStateToLocalStorage(state);
    }else{
      await idbSet("state", state);
    }

    if(idbSettings){
      settings = { ...defaultSettings(), ...(idbSettings||{}) };
      saveSettingsToLocalStorage(settings);
    }else{
      await idbSet("settings", settings);
    }
  }catch(e){
    __idbReady = false;
    // fallback: already booted from localStorage
  }
}

let state = loadState();

// ===== PHASE A: Pipeline + Project Stage =====
const PROJECT_STAGES = ["Precon","Active Build","Handover","Warranty","Archived"];
const LEAD_STATUSES = ["New","Contacted","Site visit booked","Quote requested","Quoted","Won","Lost","Converted"];

function applyStateMigrations(){
  // migrate missing fields
  try{
    state.projects = (state.projects||[]).map(p=> p ? ({...p, stage: p.stage || "Active Build"}) : p);
    if(!Array.isArray(state.leads)) state.leads = [];
  }catch(e){}


  // Diary field alignment (older builds used summary; UI expects notes/weather/crew)
  try{
    state.diary = (state.diary||[]).map(d=>{
      if(!d || typeof d !== "object") return d;
      const nd = { ...d };
      if((nd.notes === undefined || nd.notes === null || nd.notes === "") && nd.summary) nd.notes = nd.summary;
      if((nd.summary === undefined || nd.summary === null || nd.summary === "") && nd.notes) nd.summary = nd.notes;
      if(nd.weather === undefined || nd.weather === null) nd.weather = "";
      if(nd.crew === undefined || nd.crew === null) nd.crew = "";
      return nd;
    });
  }catch(e){}
  // H&S defaults
  state.hsProfiles = state.hsProfiles || [];
  state.hsInductions = state.hsInductions || [];
  state.hsHazards = state.hsHazards || [];
  state.hsToolboxes = state.hsToolboxes || [];
  state.hsIncidents = state.hsIncidents || [];

  // UI selections (Fieldwire-style)
  state.uiSelections = state.uiSelections || { tasks:{}, diary:{}, hs:{} };

  // keep canonical shape tight
  try{ state = normaliseState(state); }catch(e){}
}
applyStateMigrations();

let settings = loadSettings();


/* =============================
   Worker Profiles (RBAC)
   - Enable "Worker mode" to restrict access by profile
   - Profiles can be Admin (full access) or custom perms
============================= */

const MODULE_KEYS = ["pipeline","projects","tasks","diary","reports","hs","equipment","fleet","settings"];

const PROJECT_TABS = [
  ["overview","Overview"],
  ["map","Live Map"],
  ["tasks","Tasks"],
  ["diary","Diary"],
  ["programme","Programme"],
  ["variations","Variations"],
  ["subbies","Subbies"],
  ["deliveries","Deliveries"],
  ["inspections","Inspections"],
  ["reports","Reports"],
];

function _defaultProjectTabPermsAll(){
  const o = {};
  for(const [k] of PROJECT_TABS) o[k] = true;
  return o;
}


function _defaultPermsAll(){
  const perms = {};
  for(const k of MODULE_KEYS) perms[k] = { view:true, edit:true };
  // Per-project tab access (used inside Project Detail)
  perms.projectTabs = _defaultProjectTabPermsAll();
  return perms;
}
function ensureWorkerSettings(){
  settings.workerMode = settings.workerMode || { enabled:false, currentWorkerId:"", requirePin:false };
  if(!Array.isArray(settings.workers)) settings.workers = [];
  // Ensure at least one admin exists if worker mode is enabled
  if(settings.workerMode.enabled && settings.workers.length===0){
    settings.workers.push({ id: uid(), name: "Admin", pinHash: "", isAdmin:true, blocked:false, perms: _defaultPermsAll(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
    settings.workerMode.currentWorkerId = settings.workers[0].id;
    saveSettings(settings);
  }
  // Normalize perms shape
  settings.workers = settings.workers.map(w=>{
    if(!w || typeof w!=="object") return w;
    const nw = { ...w };
    if(!nw.id) nw.id = uid();
    if(!nw.name) nw.name = "Worker";
    
    if(typeof nw.pinHash !== "string") nw.pinHash = String(nw.pinHash||"");
    if("pin" in nw) delete nw.pin;
    if(typeof nw.createdAt !== "string" || !nw.createdAt) nw.createdAt = new Date().toISOString();
    if(typeof nw.updatedAt !== "string" || !nw.updatedAt) nw.updatedAt = nw.createdAt;
if(typeof nw.blocked!=="boolean") nw.blocked = false;
    if(nw.isAdmin) nw.perms = _defaultPermsAll();
    nw.perms = nw.perms || {};
    for(const k of MODULE_KEYS){
      if(!nw.perms[k]) nw.perms[k] = { view:true, edit:true };
      if(typeof nw.perms[k].view!=="boolean") nw.perms[k].view = true;
      if(typeof nw.perms[k].edit!=="boolean") nw.perms[k].edit = true;
    }
    // Project tab restrictions (only used when inside a project)
    if(!nw.perms.projectTabs || typeof nw.perms.projectTabs!=="object") nw.perms.projectTabs = _defaultProjectTabPermsAll();
    for(const [tk] of PROJECT_TABS){
      if(typeof nw.perms.projectTabs[tk] !== "boolean") nw.perms.projectTabs[tk] = true;
    }
    return nw;
  }).filter(Boolean);
}
function workerModeEnabled(){ return !!(settings.workerMode && settings.workerMode.enabled); }
function currentWorker(){
  if(!workerModeEnabled()) return null;
  const id = settings.workerMode.currentWorkerId || "";
  const w = (settings.workers||[]).find(w=>w && w.id===id) || null;
  if(w && w.blocked) return null;
  return w;
}

function workerById(id){
  if(!id) return null;
  ensureWorkerSettings();
  return (settings.workers||[]).find(w=>w && String(w.id)===String(id)) || null;
}
function setCurrentWorker(id){
  ensureWorkerSettings();
  const w = (settings.workers||[]).find(x=>x && x.id===id) || null;
  if(w && w.blocked){
    alert("This user is blocked. Unblock them in Settings → Worker profiles.");
    return false;
  }
  settings.workerMode = settings.workerMode || { enabled:false, currentWorkerId:"", requirePin:false };
  settings.workerMode.currentWorkerId = id || "";
  saveSettings(settings);
  try{ updateNavVisibility(); }catch(e){}
  return true;
}
function canView(moduleKey){
  if(!workerModeEnabled()) return true;
  const w = currentWorker();
  if(!w) return false;
  if(w.isAdmin) return true;
  return !!(w.perms && w.perms[moduleKey] && w.perms[moduleKey].view);
}
function canEdit(moduleKey){
  if(!workerModeEnabled()) return true;
  const w = currentWorker();
  if(!w) return false;
  if(w.isAdmin) return true;
  return !!(w.perms && w.perms[moduleKey] && w.perms[moduleKey].edit);
}

function equipLocationOnly(){
  if(!workerModeEnabled()) return false;
  const w = currentWorker();
  if(!w || w.isAdmin) return false;
  return !!(w.perms && w.perms.equipment && w.perms.equipment.locationOnly);
}

// Convenience helpers for worker-mode data scoping
function restrictedWorker(){
  if(!workerModeEnabled()) return null;
  const w = currentWorker();
  if(!w || w.isAdmin) return null;
  return w;
}
function diaryVisibleToCurrentUser(d){
  const w = restrictedWorker();
  if(!w) return true;
  return String(d?.createdById||"") === String(w.id||"");
}
function taskVisibleToCurrentUser(t){
  const w = restrictedWorker();
  if(!w) return true;
  const wid = String(w.id||"");
  // Primary: tasks assigned to this worker
  if(String(t?.assignedWorkerId||"") === wid) return true;
  // Secondary: tasks they created (useful for legacy data / self-created tasks)
  if(String(t?.createdById||"") === wid) return true;
  return false;
}

function currentActor(){
  const w = workerModeEnabled() ? currentWorker() : null;
  if(w) return { id: String(w.id||""), name: String(w.name||"Worker") };
  return { id: "admin", name: "Admin" };
}

function addActivity(entry){
  try{
    state.activityLog = aliveArr(state.activityLog);
    const e = { id: uid(), at: nowISO(), ...entry };

    // Best-effort attribution to the currently selected worker (if any)
    try{
      const wid = (settings && settings.workerMode && settings.workerMode.currentWorkerId) ? String(settings.workerMode.currentWorkerId) : "";
      if(!e.workerId && wid) e.workerId = wid;
      if(!e.workerName && (e.workerId || wid)){
        const w = workerById(e.workerId || wid);
        if(w && w.name) e.workerName = w.name;
      }
    }catch(_){}

    state.activityLog.unshift(e);
    if(state.activityLog.length > 500) state.activityLog = state.activityLog.slice(0, 500);
  }catch(err){}
}

function routeToModule(path){
  if(path==="lead" || path==="pipeline") return "pipeline";
  if(path==="project" || path==="projects") return "projects";
  if(path==="tasks") return "tasks";
  if(path==="diary") return "diary";
  if(path==="reports") return "reports";
  if(path==="hs") return "hs";
  if(path==="equipment") return "equipment";
  if(path==="fleet") return "fleet";
  if(path==="settings") return "settings";
  return path;
}

function openWorkerPicker(opts={}){
  ensureWorkerSettings();
  const requirePin = !!(settings.workerMode && settings.workerMode.requirePin);
  const workers = (settings.workers||[]).slice();
  const rows = workers.map(w=>{
    const badge = w.isAdmin ? `<span class="badge">Admin</span>` : ``;
    const blocked = w.blocked ? `<span class="badge danger">Blocked</span>` : ``;
    return `
      <button class="listItem" type="button" data-worker-pick="${escapeAttr(w.id)}" ${w.blocked ? "disabled":""}>
        <div class="row space">
          <div>
            <div class="row" style="gap:8px; align-items:center"><b>${escapeHtml(w.name||"Worker")}</b>${badge}${blocked}</div>
            <div class="sub">${w.blocked ? "Access blocked" : (w.isAdmin ? "Full access" : "Restricted access")}</div>
          </div>
          <div class="chev">›</div>
        </div>
      </button>
    `;
  }).join("");

  openModal(`
    <div class="row space">
      <h2>${opts.title || "Select worker"}</h2>
      <button class="btn" id="closeModalBtn" type="button">Close</button>
    </div>
    <div class="sub" style="margin-top:6px">${workerModeEnabled() ? "Worker mode is ON." : "Worker mode is OFF."}</div>
    ${requirePin ? `<div class="smallmuted" style="margin-top:6px">PIN required (if set for the profile).</div>` : ``}
    <div class="list" style="margin-top:10px">${rows || `<div class="sub">No workers yet. Add one in Settings → Worker profiles.</div>`}</div>
  `);

  const modal = document.getElementById("modal");
  if(modal){
    modal.querySelectorAll("[data-worker-pick]").forEach(btn=>{
      btn.onclick = async ()=>{
        const id = btn.getAttribute("data-worker-pick");
        const w = (settings.workers||[]).find(x=>x && x.id===id);
        if(!w) return;
        if(w.blocked){
          alert("This user is blocked.");
          return;
        }
        if(requirePin && (w.pinHash||"").trim()){
          const pin = prompt(`Enter PIN for ${w.name}`);
          if(pin === null) return;
          const ok = await verifyWorkerPin(w, pin);
          if(!ok){ alert("Incorrect PIN."); return; }
        }
        setCurrentWorker(id);
        closeModal();
        render();
      };
    });
  }
}

async function verifyWorkerModeDeactivationPin(){
  // Require an Admin PIN (preferred) to disable Worker mode.
  // This prevents a restricted worker from disabling restrictions.
  ensureWorkerSettings();
  const workers = (settings.workers||[]);
  const adminHashes = workers
    .filter(w=>w && w.isAdmin && !w.blocked && String(w.pinHash||"").trim())
    .map(w=>w.pinHash);

  if(adminHashes.length){
    const pin = prompt("Enter ADMIN PIN to disable Worker mode");
    if(pin === null) return false;
    const ph = await hashPin(String(pin).trim());
    const ok = adminHashes.some(h=>String(h||"").trim() === ph);
    if(!ok) alert("Incorrect PIN.");
    return ok;
  }

  // Fallback: if the current worker is an Admin with a PIN set, allow that.
  const cw = currentWorker();
  if(cw && cw.isAdmin && String(cw.pinHash||"").trim()){
    const pin = prompt(`Enter PIN for ${cw.name} to disable Worker mode`);
    if(pin === null) return false;
    const ok = await verifyWorkerPin(cw, pin);
    if(!ok) alert("Incorrect PIN.");
    return ok;
  }

  alert("No Admin PIN is set. Set an Admin PIN in Settings → Worker profiles before Worker mode can be disabled.");
  return false;
}


function updateNavVisibility(){
  // Footer nav buttons
  const footerButtons = document.querySelectorAll('.footerbar .nav .btn[data-nav]');
  footerButtons.forEach(b=>{
    const r = b.getAttribute("data-nav");
    const mod = routeToModule(r||"");
    const ok = canView(mod);
    b.style.display = ok ? "" : "none";
  });

  // Header dropdown items
  const dropItems = document.querySelectorAll('#navDropdownList [data-nav]');
  dropItems.forEach(b=>{
    const r = b.getAttribute("data-nav");
    if(r==="switchWorker") return;
    const mod = routeToModule(r||"");
    const ok = canView(mod);
    b.style.display = ok ? "" : "none";
  });

  // Update header title suffix
  try{
    const ht = document.getElementById("headerTitle");
    if(ht){
      const base = "MCB Site Manager";
      if(workerModeEnabled()){
        const w = currentWorker();
        ht.textContent = w ? `${base} — ${w.name}` : base;
      }else{
        ht.textContent = base;
      }
    }
  }catch(e){}
}


function _renderWorkerList(){
  const list = document.getElementById("wm_list");
  if(!list) return;
  ensureWorkerSettings();
  const workers = (settings.workers||[]);
  const activeId = settings.workerMode?.currentWorkerId || "";
  if(!workers.length){
    list.innerHTML = `<div class="sub">No workers yet.</div>`;
    return;
  }
  list.innerHTML = workers.map(w=>{
    const badge = w.isAdmin ? `<span class="badge">Admin</span>` : `<span class="badge muted">Worker</span>`;
    const blocked = w.blocked ? `<span class="badge danger">Blocked</span>` : ``;
    const active = (w.id===activeId) ? `<span class="badge ok">Active</span>` : ``;
    return `
      <div class="listItem">
        <div class="row space">
          <div>
            <div class="row" style="gap:8px; align-items:center"><b>${escapeHtml(w.name||"Worker")}</b>${badge}${blocked}${active}</div>
            <div class="sub">${w.blocked ? "Access blocked" : (w.isAdmin ? "Full access" : "Restricted access")}</div>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn ghost sm" type="button" data-wm-set="${escapeAttr(w.id)}" ${w.blocked ? "disabled":""}>Use</button>
            <button class="btn ghost sm" type="button" data-wm-edit="${escapeAttr(w.id)}">Edit</button>
            <button class="btn danger sm" type="button" data-wm-del="${escapeAttr(w.id)}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-wm-set]").forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute("data-wm-set");
      setCurrentWorker(id);
      _renderWorkerList();
      alert("Active worker set.");
    };
  });
  list.querySelectorAll("[data-wm-edit]").forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute("data-wm-edit");
      const w = (settings.workers||[]).find(x=>x && x.id===id);
      if(w) openWorkerEditModal(w);
    };
  });
  list.querySelectorAll("[data-wm-del]").forEach(b=>{
    b.onclick = ()=>{
      const id = b.getAttribute("data-wm-del");
      const w = (settings.workers||[]).find(x=>x && x.id===id);
      if(!w) return;
      if(w.isAdmin){
        const admins = (settings.workers||[]).filter(x=>x && x.isAdmin);
        if(admins.length<=1){
          alert("You need at least one Admin profile.");
          return;
        }
      }
      if(!confirm(`Delete worker: ${w.name}?`)) return;
      settings.workers = (settings.workers||[]).filter(x=>x && x.id!==id);
      if(settings.workerMode?.currentWorkerId === id){
        settings.workerMode.currentWorkerId = (settings.workers[0]?.id || "");
      }
      saveSettings(settings);
      ensureWorkerSettings();
      try{ updateNavVisibility(); }catch(e){}
      _renderWorkerList();
    };
  });
}

function openWorkerEditModal(worker){
  ensureWorkerSettings();
  const isNew = !worker || !worker.id;
  const w = isNew ? { id: uid(), name:"", pinHash:"", isAdmin:false, perms:_defaultPermsAll() } : JSON.parse(JSON.stringify(worker));
  if(w.isAdmin) w.perms = _defaultPermsAll();
  w.perms = w.perms || _defaultPermsAll();

  const rows = MODULE_KEYS.map(k=>{
    const nice = (k==="hs") ? "H&S" : (k.charAt(0).toUpperCase()+k.slice(1));
    const v = w.perms[k]?.view ? "checked" : "";
    const e = w.perms[k]?.edit ? "checked" : "";
    // Settings is usually admin-only; keep it visible but editable.
    return `
      <div class="row space" style="padding:6px 0; border-bottom:1px solid var(--border)">
        <div class="sub">${escapeHtml(nice)}</div>
        <div class="row" style="gap:10px">
          <label class="row" style="gap:6px; align-items:center"><input type="checkbox" data-perm-view="${k}" ${v}/> <span class="sub">View</span></label>
          <label class="row" style="gap:6px; align-items:center"><input type="checkbox" data-perm-edit="${k}" ${e}/> <span class="sub">Edit</span></label>
        </div>
      </div>
    `;
  }).join("");

  openModal(`
    <div class="row space">
      <h2>${isNew ? "Add worker" : "Edit worker"}</h2>
      <button class="btn" id="closeModalBtn" type="button">Close</button>
    </div>

    <label>Name</label>
    <input class="input" id="wm_name" value="${escapeHtml(w.name||"")}" placeholder="e.g. Ben" />

    <label style="margin-top:10px">PIN (optional)</label>
    <input class="input" id="wm_pin" value="" placeholder="Set / change PIN (4 digits)" inputmode="numeric" />
    <div class="smallmuted">PINs are stored as a secure hash (pinHash). Leave blank to keep existing.</div>

    <div class="row" style="gap:10px; align-items:center; margin-top:10px">
      <label class="row" style="gap:8px; align-items:center">
        <input type="checkbox" id="wm_isAdmin" ${w.isAdmin ? "checked":""} />
        <span>Admin (full access)</span>
      </label>
    </div>

    <div class="row" style="gap:10px; align-items:center; margin-top:8px">
      <label class="row" style="gap:8px; align-items:center">
        <input type="checkbox" id="wm_blocked" ${w.blocked ? "checked":""} />
        <span>Blocked (no access)</span>
      </label>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="h">Permissions</div>
      <div class="sub">View controls whether the module appears. Edit controls whether forms/edit actions are allowed.</div>
      <div class="row" style="gap:10px; align-items:center; margin-top:10px">
        <label class="row" style="gap:8px; align-items:center">
          <input type="checkbox" id="wm_equipLocOnly" ${(w.perms && w.perms.equipment && w.perms.equipment.locationOnly) ? "checked":""} ${w.isAdmin ? "disabled":""} />
          <span class="sub">Equipment: location-only (can only update assigned site / location note)</span>
        </label>
      </div>
      <div class="card" style="margin-top:12px">
  <div class="h">Project tabs</div>
  <div class="sub">Choose which tabs this worker can access inside a project.</div>
  <div style="margin-top:10px">
    ${PROJECT_TABS.map(([k,label])=>{
      const ck = (w.perms && w.perms.projectTabs && w.perms.projectTabs[k]!==false) ? "checked" : "";
      return `<label class="row" style="gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid var(--border)">
        <input type="checkbox" data-ptab="${k}" ${ck} ${w.isAdmin ? "disabled":""}/>
        <span class="sub">${label}</span>
      </label>`;
    }).join("")}
  </div>
</div>


      <div style="margin-top:8px">${rows}</div>
    </div>

    <div class="row" style="gap:10px; margin-top:12px">
      <button class="btn primary" id="wm_save" type="button">Save</button>
      <button class="btn" id="cancelModalBtn" type="button">Cancel</button>
    </div>
  `);

  const isAdminEl = document.getElementById("wm_isAdmin");
  const refreshPermsDisabled = ()=>{
    const disabled = !!(isAdminEl && isAdminEl.checked);
    document.querySelectorAll('[data-perm-view],[data-perm-edit]').forEach(cb=>{
      cb.disabled = disabled;
      if(disabled) cb.checked = true;
    });
    const locCb = document.getElementById("wm_equipLocOnly");
    if(locCb){ locCb.disabled = disabled; if(disabled) locCb.checked = false; }
    document.querySelectorAll('[data-ptab]').forEach(cb=>{
      cb.disabled = disabled;
      if(disabled) cb.checked = true;
    });

  };
  if(isAdminEl) isAdminEl.onchange = refreshPermsDisabled;
  refreshPermsDisabled();

  const saveBtn = document.getElementById("wm_save");
  if(saveBtn) saveBtn.onclick = async ()=>{
    const name = (document.getElementById("wm_name")?.value || "").trim();
    const pin = (document.getElementById("wm_pin")?.value || "").trim();
    const isAdmin = !!(document.getElementById("wm_isAdmin")?.checked);
    const blocked = !!(document.getElementById("wm_blocked")?.checked);

    if(!name){
      alert("Please enter a name.");
      return;
    }

    const nw = { ...w, name, isAdmin, blocked };
    // PIN hashing (store pinHash only)
    if(pin){
      try{ nw.pinHash = await hashPin(pin); }
      catch(e){ alert("Could not hash PIN. Try again."); return; }
    }else{
      // If editing and leaving blank, keep existing pinHash.
      // If new worker and blank, ensure empty.
      if(isNew) nw.pinHash = "";
    }

    if(isAdmin){
      nw.perms = _defaultPermsAll();
    }else{
      nw.perms = nw.perms || _defaultPermsAll();
      for(const k of MODULE_KEYS){
        const vcb = document.querySelector(`[data-perm-view="${k}"]`);
        const ecb = document.querySelector(`[data-perm-edit="${k}"]`);
        nw.perms[k] = { view: !!(vcb && vcb.checked), edit: !!(ecb && ecb.checked) };
        // If can't view, force edit false.
        if(!nw.perms[k].view) nw.perms[k].edit = false;
      }
    }
    // Project tab restrictions
    nw.perms.projectTabs = nw.perms.projectTabs || _defaultProjectTabPermsAll();
    if(!isAdmin){
      PROJECT_TABS.forEach(([k])=>{
        const cb = document.querySelector(`[data-ptab="${k}"]`);
        if(cb) nw.perms.projectTabs[k] = !!cb.checked;
      });
    }else{
      nw.perms.projectTabs = _defaultProjectTabPermsAll();
    }


    // Equipment: location-only override
    const _locOnlyEl = document.getElementById("wm_equipLocOnly");
    const locOnly = !!(_locOnlyEl && _locOnlyEl.checked);
    if(locOnly && !isAdmin){
      nw.perms = nw.perms || _defaultPermsAll();
      nw.perms.equipment = nw.perms.equipment || { view:true, edit:true };
      nw.perms.equipment.view = true;
      nw.perms.equipment.edit = true;
      nw.perms.equipment.locationOnly = true;
    }else{
      if(nw.perms && nw.perms.equipment) delete nw.perms.equipment.locationOnly;
    }

    // Prevent blocking the last admin
    if(nw.isAdmin && nw.blocked){
      const admins = (settings.workers||[]).filter(x=>x && x.isAdmin && !x.blocked && x.id!==nw.id);
      if(admins.length===0){
        alert("You can’t block the last admin.");
        return;
      }
    }

    // Save back
    const list = settings.workers || [];
    const i = list.findIndex(x=>x && x.id===nw.id);
    if(i>=0) list[i] = nw; else list.push(nw);
    settings.workers = list;

    // If worker mode enabled and no active worker, set it.
    settings.workerMode = settings.workerMode || { enabled:false, currentWorkerId:"", requirePin:false };
    if(settings.workerMode.enabled && !settings.workerMode.currentWorkerId){
      settings.workerMode.currentWorkerId = nw.id;
    }
        nw.updatedAt = new Date().toISOString();
saveSettings(settings);
    ensureWorkerSettings();
    try{ updateNavVisibility(); }catch(e){}
    closeModal();
    _renderWorkerList();
  };
}

function bindWorkerSettingsUI(){
  ensureWorkerSettings();
  const en = document.getElementById("wm_enabled");
  const rp = document.getElementById("wm_requirePin");
  const add = document.getElementById("wm_add");
  if(en) en.onchange = async ()=>{
    settings.workerMode = settings.workerMode || { enabled:false, currentWorkerId:"", requirePin:false };
    const wasEnabled = !!settings.workerMode.enabled;
    if(wasEnabled && !en.checked){
      if(!(await verifyWorkerModeDeactivationPin())){
        en.checked = true;
        return;
      }
    }
    settings.workerMode.enabled = !!en.checked;
    // If turning on, ensure admin exists
    if(settings.workerMode.enabled){
      ensureWorkerSettings();
      if(!settings.workerMode.currentWorkerId){
        settings.workerMode.currentWorkerId = settings.workers[0]?.id || "";
      }
    }
    saveSettings(settings);
    ensureWorkerSettings();
    try{ updateNavVisibility(); }catch(e){}
    _renderWorkerList();
    if(settings.workerMode.enabled && !currentWorker()){
      openWorkerPicker({ title: "Select worker" });
    }
  };
  if(rp) rp.onchange = ()=>{
    settings.workerMode = settings.workerMode || { enabled:false, currentWorkerId:"", requirePin:false };
    settings.workerMode.requirePin = !!rp.checked;
    saveSettings(settings);
  };
  if(add) add.onclick = ()=> openWorkerEditModal({ id:"", name:"", pinHash:"", isAdmin:false, perms:_defaultPermsAll() });
  _renderWorkerList();
}



ensureWorkerSettings();
function applyTheme(){
  document.documentElement.setAttribute("data-theme", settings.theme || "dark");
}
applyTheme();

// Hydrate from IndexedDB (authoritative) then re-apply migrations and refresh UI.
initStorageHydrate().then(()=>{
  try{ applyStateMigrations(); }catch(e){}
  try{ applyTheme(); }catch(e){}
  try{ saveState(state); }catch(e){} // ensures normalised state is persisted
  try{
    // render may not exist yet, but function declarations are hoisted.
    render(); try{renderDeletedProjectsUI();}catch(e){}
  }catch(e){}
});

// Service worker
const __NO_SW__ = new URLSearchParams(location.search).has("nosw");
if("serviceWorker" in navigator){
  window.addEventListener("load", async ()=>{
    try{ await navigator.serviceWorker.register("./sw.js"); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  });
}

function setHeader(title){
  $("#headerTitle").textContent = title || "MCB Site Manager";
}

function navTo(route, params={}){
  const q = new URLSearchParams(params).toString();
  location.hash = q ? `#/${route}?${q}` : `#/${route}`;
}

function parseRoute(){
  const h = location.hash || "#/projects";
  const [path, query] = h.replace(/^#\//,"").split("?");
  const params = Object.fromEntries(new URLSearchParams(query || ""));
  return { path: path || "projects", params };
}

function money(n){
  const v = Number(n || 0);
  return new Intl.NumberFormat("en-NZ", { style:"currency", currency:"NZD" }).format(v);
}
function dateFmt(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleDateString("en-NZ", {year:"numeric", month:"short", day:"2-digit"});
  }catch(e){ return iso || "";}
}
function escapeHtml(s){
  s = String(s ?? "");

  return (String(s ?? "")).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function setBtnBusy(btn, busy, label="Saving…"){
  if(!btn) return;
  if(busy){
    btn.dataset._oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
  }else{
    btn.disabled = false;
    if(btn.dataset._oldText) btn.textContent = btn.dataset._oldText;
    delete btn.dataset._oldText;
  }
}
function showSavingHint(msg="Working…"){
  const el = document.createElement("div");
  el.className = "savingHint";
  el.textContent = msg;
  const modal = document.querySelector("#modal");
  if(modal) modal.appendChild(el);
  return el;
}
function statusBadgeClass(status){
  const s = String(status||"").toLowerCase();
  if(s.includes("done") || s.includes("complete")) return "ok";
  if(s.includes("overdue") || s.includes("urgent") || s.includes("high")) return "danger";
  if(s.includes("progress") || s.includes("active")) return "warn";
  return "muted";
}

function confirmDelete(label){
  return confirm(`Delete ${label}? This can't be undone.`);
}

function isoToday(){
  return new Date().toISOString().slice(0,10);
}
function inNextDays(dateStr, days){
  if(!dateStr) return false;
  const d0 = new Date(isoToday());
  const d1 = new Date(dateStr);
  const diff = (d1 - d0) / 86400000;
  return diff >= 0 && diff <= days;
}
function upcomingSummary(days=7, limit=12){
  const items = [];
  // Due tasks
  for(const t of (state.tasks||[])){
    if(t.dueDate && inNextDays(t.dueDate, days) && t.status !== "Done"){
      const p = projectById(t.projectId);
      items.push({ when: t.dueDate, kind:"Task", title:t.title, project:p?.name || "", badge:t.status||"To do", nav: {route:"project", params:{id:t.projectId, tab:"tasks"}} });
    }
  }
  // Deliveries
  for(const d of (state.deliveries||[])){
    if(d.date && inNextDays(d.date, days)){
      const p = projectById(d.projectId);
      items.push({ when: d.date, kind:"Delivery", title:(d.supplier||"Delivery"), project:p?.name || "", badge:d.status||"Expected", nav: {route:"project", params:{id:d.projectId, tab:"deliveries"}} });
    }
  }
  // Inspections
  for(const i of (state.inspections||[])){
    if(i.date && inNextDays(i.date, days)){
      const p = projectById(i.projectId);
      items.push({ when: i.date, kind:"Inspection", title:(i.type||"Inspection"), project:p?.name || "", badge:i.result||"Booked", nav: {route:"project", params:{id:i.projectId, tab:"inspections"}} });
    }
  }

  items.sort((a,b)=> (a.when||"").localeCompare(b.when||"") || a.kind.localeCompare(b.kind));
  return items.slice(0, limit);
}
function upcomingCardHTML(days=7){
  const items = upcomingSummary(days);
  if(!items.length){
    return `
      <div class="card">
        <h2>Upcoming (next ${days} days)</h2>
        <div class="sub">Nothing scheduled. You're having a good week.</div>
      </div>
    `;
  }
  const rows = items.map(it=>`
    <div class="item clickable" data-upnav="${encodeURIComponent(JSON.stringify(it.nav))}">
      <div class="row space">
        <div>
          <div class="title">${escapeHtml(dateFmt(it.when))} — ${escapeHtml(it.kind)}</div>
          <div class="meta">${escapeHtml(it.title)}${it.project ? ` • ${escapeHtml(it.project)}` : ""}</div>
        </div>
        <div class="meta"><span class="badge">${escapeHtml(it.badge||"")}</span></div>
      </div>
    </div>
  `).join("");
  return `
    <div class="card">
      <div class="row space">
        <h2>Upcoming (next ${days} days)</h2>
        <button class="btn small" id="upcomingRefresh" type="button">Refresh</button>
      </div>
      <div class="list" id="upcomingList">${rows}</div>
    </div>
  `;
}

// Modal
function showModal(html){
  $("#modal").innerHTML = html;
  $("#modalBack").classList.add("show");
}
function closeModal(){
  $("#modalBack").classList.remove("show");
  $("#modal").innerHTML = "";
}

function openModal(html){
  $("#modal").innerHTML = html || "";
  $("#modalBack").classList.add("show");

  // Close actions
  const closeBtn = $("#closeModalBtn", $("#modal"));
  const cancelBtn = $("#cancelModalBtn", $("#modal"));
  if(closeBtn) closeBtn.onclick = closeModal;
  if(cancelBtn) cancelBtn.onclick = closeModal;

  // Clicking the backdrop closes the modal
  $("#modalBack").onclick = (e)=>{
    if(e && e.target && e.target.id==="modalBack") closeModal();
  };
}

$("#modalBack").addEventListener("click", (e)=>{
  if(e.target.id === "modalBack") closeModal();
});

// File -> dataURL for offline
function filesToDataUrls(fileList){
  const files = [...(fileList || [])];
  if(!files.length) return Promise.resolve([]);
  return Promise.all(files.map(f => new Promise((res)=>{
    const r = new FileReader();
    r.onload = () => res({ id: uid(), name:f.name, type:f.type, size:f.size, dataUrl:r.result, createdAt:new Date().toISOString() });
    r.onerror = () => res(null); // never throw - some iOS formats (e.g. HEIC) can fail
    try{
      r.readAsDataURL(f);
    }catch(e){
      res(null);
    }
  }))).then(arr => arr.filter(Boolean));
}

// Geo (optional): try geocode with Nominatim (works on https; may be blocked on some hosts)
async function geocodeAddress(address){
  const q = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=nz`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if(!res.ok) throw new Error("geocode failed");
  const data = await res.json();
  if(!data || !data[0]) throw new Error("no result");
  return { lat: Number(data[0].lat), lng: Number(data[0].lon), display: data[0].display_name };
}

// Helpers
function projectById(id){ return state.projects.find(p=>p.id===id); }
function subbieById(id){ return state.subbies.find(s=>s.id===id); }

// =========================
// H&S MODULE (Phase 3 - test build)
// =========================
function hsGetActiveProjectId(){
  const sel = document.getElementById("hsProjectSelect");
  return sel ? sel.value : (state.hsActiveProjectId || state.activeProjectId || "");
}
function hsProjectOptionsHtml(selectedId){
  const projects = (state.projects||[]).filter(p=>!p.deletedAt);
  const opts = ['<option value="">Select a site…</option>']
    .concat(projects.map(p=>`<option value="${p.id}" ${String(p.id)===String(selectedId)?'selected':''}>${escapeHtml(p.name || p.address || ('Site '+p.id))}</option>`));
  return opts.join("");
}
function hsSubnav(active){
  const items = [
    ["dashboard","Dashboard"],
    ["hazards","Hazards"],
    ["profile","Safety Profile"],
    ["inductions","Inductions"],
    ["toolbox","Toolbox"],
    ["incidents","Incidents"],
  ];
  return `
    <div class="segmented" style="margin:10px 0;">
      ${items.map(([k,label])=>`<button class="segbtn ${active===k?'active':''}" data-hsview="${k}">${label}</button>`).join("")}
    </div>
  `;
}
function hsRiskLabel(score){
  if(score>=20) return "Extreme";
  if(score>=12) return "High";
  if(score>=6) return "Medium";
  return "Low";
}
function hsRiskBadge(label){
  const cls = label==="Extreme"?"badge danger":label==="High"?"badge danger":label==="Medium"?"badge warn":"badge ok";
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}
function hsIsOverdue(dateStr){
  if(!dateStr) return false;
  const d = new Date(String(dateStr).slice(0,10));
  if(isNaN(d)) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  return d < today;
}

function hsBindSubnav(){
  document.querySelectorAll("[data-hsview]").forEach(b=>{
    b.onclick = ()=>{
      state.hsActiveView = b.dataset.hsview;
      saveState(state);
      render();
    };
  });
}
function renderHS(){
  const activeView = state.hsActiveView || "dashboard";
  const pid = state.hsActiveProjectId || state.activeProjectId || "";
  return `
  <div class="card">
    <h2>H&S</h2>
    <div class="row" style="gap:10px;align-items:center">
      <div style="flex:1">
        <div class="label">Site</div>
        <select id="hsProjectSelect" class="input">${hsProjectOptionsHtml(pid)}</select>
      </div>
    </div>
    ${hsSubnav(activeView)}
    <div id="hsContent">${renderHSView(activeView, pid)}</div>
  </div>
  `;
}
function hsEnsureProjectSelected(pid){
  if(!pid){
    return `<div class="muted" style="padding:12px 0;">Select a site to manage Health & Safety.</div>`;
  }
  return "";
}
function renderHSView(view, pid){
  const need = hsEnsureProjectSelected(pid);
  if(need) return need;
  if(view==="dashboard") return renderHSDashboard(pid);
  if(view==="profile") return renderHSSafetyProfile(pid);
  if(view==="inductions") return renderHSInductions(pid);
  if(view==="toolbox") return renderHSToolbox(pid);
  if(view==="incidents") return renderHSIncidents(pid);
  const hid = state.uiSelections?.hs?.hazardId;
  if(hid){
    const hz = (state.hsHazards||[]).find(x=>!x.deletedAt && String(x.id)===String(hid) && String(x.projectId)===String(pid));
    if(hz) return renderHSHazardDetail(pid, hz);
  }
  return renderHSHazards(pid);
}
function hsGetProfile(pid){
  return (state.hsProfiles||[]).find(x=>String(x.projectId)===String(pid) && !x.deletedAt) || null;
}
function renderHSDashboard(pid){
  const proj = (state.projects||[]).find(p=>String(p.id)===String(pid)) || {};
  const hazards = (state.hsHazards||[]).filter(x=>!x.deletedAt && String(x.projectId)===String(pid));
  const openHaz = hazards.filter(h=>String(h.status||"Open")!=="Closed");
  const overdue = hazards.filter(h=>String(h.status||"Open")!=="Closed" && hsIsOverdue(h.reviewDate));
  const toolboxes = (state.hsToolboxes||[]).filter(x=>!x.deletedAt && String(x.projectId)===String(pid)).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const lastToolbox = toolboxes[0]?.date || "";
  const incidents = (state.hsIncidents||[]).filter(x=>!x.deletedAt && String(x.projectId)===String(pid));
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const incidentsThisMonth = incidents.filter(i=>String(i.date||"").startsWith(monthKey));

  const recentHaz = hazards.slice().sort((a,b)=>String(b.dateIdentified||"").localeCompare(String(a.dateIdentified||""))).slice(0,5);

  return `
    <div class="hsDash">
      <div class="muted" style="margin-bottom:10px">${escapeHtml(proj.name||proj.address||"")}</div>

      <div class="hsGrid">
        <div class="hsStat">
          <div class="hsStatLabel">Open hazards</div>
          <div class="hsStatValue">${openHaz.length}</div>
        </div>
        <div class="hsStat">
          <div class="hsStatLabel">Overdue reviews</div>
          <div class="hsStatValue ${overdue.length? "dangerText": ""}">${overdue.length}</div>
        </div>
        <div class="hsStat">
          <div class="hsStatLabel">Last toolbox</div>
          <div class="hsStatValue">${formatDateNZ(lastToolbox)}</div>
        </div>
        <div class="hsStat">
          <div class="hsStatLabel">Incidents this month</div>
          <div class="hsStatValue">${incidentsThisMonth.length}</div>
        </div>
      </div>

      <div class="row" style="gap:10px;flex-wrap:wrap;margin:12px 0;">
        <button class="btn primary" id="hsQuickHazard">+ Hazard</button>
        <button class="btn" id="hsQuickToolbox">+ Toolbox</button>
        <button class="btn" id="hsQuickIncident">+ Near Miss</button>
        <button class="btn" id="hsQuickInduction">+ Induction</button>
      </div>

      <div class="cardSub">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div class="title">Recent hazards</div>
          <button class="btn" id="hsGoHazards">View all</button>
        </div>
        <div class="list compact">
          ${recentHaz.map(h=>{
            const score = (Number(h.likelihood||0) * Number(h.consequence||0)) || Number(h.riskScore||0) || 0;
            const label = h.risk || hsRiskLabel(score);
            const overdueCls = (String(h.status||"Open")!=="Closed" && hsIsOverdue(h.reviewDate)) ? "dangerText" : "";
            return `
              <div class="listItem">
                <div style="flex:1">
                  <div class="title">${escapeHtml(h.hazard||"")}</div>
                  <div class="muted ${overdueCls}">${escapeHtml(h.status||"Open")} • Review ${formatDateNZ(h.reviewDate)}</div>
                </div>
                ${hsRiskBadge(label)}
              </div>
            `;
          }).join("") || `<div class="muted" style="padding:10px 0;">No hazards yet.</div>`}
        </div>
      </div>
    </div>
  `;
}

function renderHSSafetyProfile(pid){
  const p = (state.projects||[]).find(x=>String(x.id)===String(pid)) || {};
  const prof = hsGetProfile(pid) || {id:uid(), projectId: pid, pcbu:"Matty Campbell Building", supervisor:"", emergencyContact:"", assemblyPoint:"", nearestHospital:"", siteRules:"", ppe:"Hi-vis, Boots, Hard hat", inductionRequired:true, createdAt:nowIso(), updatedAt:nowIso()};
  return `
    <div class="row" style="justify-content:space-between;align-items:center">
      <div class="muted">${escapeHtml(p.name||p.address||"")}</div>
      <button class="btn primary" id="hsEditProfileBtn">${hsGetProfile(pid) ? "Edit" : "Create"}</button>
    </div>
    <div class="kv" style="margin-top:12px">
      ${kv("PCBU", prof.pcbu)}
      ${kv("Supervisor", prof.supervisor)}
      ${kv("Emergency contact", prof.emergencyContact)}
      ${kv("Assembly point", prof.assemblyPoint)}
      ${kv("Nearest hospital", prof.nearestHospital)}
      ${kv("PPE", prof.ppe)}
      ${kv("Induction required", prof.inductionRequired ? "Yes" : "No")}
      ${kv("Site rules", prof.siteRules || "—")}
    </div>
  `;
}
function renderHSInductions(pid){
  const list = (state.hsInductions||[]).filter(x=>!x.deletedAt && String(x.projectId)===String(pid))
    .sort((a,b)=>(String(b.date||"")).localeCompare(String(a.date||"")));
  return `
    <div class="row" style="justify-content:space-between;align-items:center">
      <div class="muted">${list.length} inducted</div>
      <button class="btn primary" id="hsAddInductionBtn">Add</button>
    </div>
    <div class="list">
      ${list.map(x=>`
        <div class="listItem">
          <div style="flex:1">
            <div class="title">${escapeHtml(x.name||"")}</div>
            <div class="muted">${escapeHtml(x.company||"")} • ${formatDateNZ(x.date)}</div>
          </div>
          <button class="btn" data-hsedit="induction" data-id="${h.id}">Edit</button>
          <button class="btn danger" data-hsdel="induction" data-id="${h.id}">Delete</button>
        </div>
      `).join("") || `<div class="muted" style="padding:12px 0;">No inductions yet.</div>`}
    </div>
  `;
}
function renderHSHazards(pid){
  const list = (state.hsHazards||[]).filter(x=>!x.deletedAt && String(x.projectId)===String(pid))
    .sort((a,b)=>(String(b.dateIdentified||"")).localeCompare(String(a.dateIdentified||"")));
  const openCount = list.filter(x=>String(x.status||"Open")!=="Closed").length;
  return `
    <div class="row" style="justify-content:space-between;align-items:center">
      <div class="fwMeta">${openCount} open</div>
      <button class="btn primary" id="hsAddHazardBtn">Add</button>
    </div>
    <div class="list">
      ${list.map(h=>{
        const score = (Number(h.likelihood||0) * Number(h.consequence||0)) || Number(h.riskScore||0) || 0;
        const label = h.risk || hsRiskLabel(score);
        const overdue = (String(h.status||"Open")!=="Closed" && hsIsOverdue(h.reviewDate));
        const overdueCls = overdue ? "dangerText" : "";
        const meta = `${escapeHtml(h.status||"Open")} • Review ${formatDateNZ(h.reviewDate)}${score?` • ${score}`:""}`;
        return `
          <div class="fwListItem" data-hsopen="hazard" data-id="${h.id}"><div class="fwMain">
              <div class="fwTitle">${escapeHtml(h.hazard||"")}</div>
              <div class="muted ${overdueCls}">${meta}</div>
            </div>
            ${hsRiskBadge(label)}
            <button class="btn" data-hsedit="hazard" data-id="${h.id}">Edit</button>
            <button class="btn danger" data-hsdel="hazard" data-id="${h.id}">Delete</button>
          </div>
        `;
      }).join("") || `<div class="muted" style="padding:12px 0;">No hazards yet.</div>`}
    </div>
  `;
}
function renderHSToolbox(pid){
  const list = (state.hsToolboxes||[]).filter(x=>!x.deletedAt && String(x.projectId)===String(pid))
    .sort((a,b)=>(String(b.date||"")).localeCompare(String(a.date||"")));
  return `
    <div class="row" style="justify-content:space-between;align-items:center">
      <div class="muted">${list.length} meetings</div>
      <button class="btn primary" id="hsAddToolboxBtn">Add</button>
    </div>
    <div class="list">
      ${list.map(x=>`
        <div class="listItem">
          <div style="flex:1">
            <div class="title">${formatDateNZ(x.date)} • ${escapeHtml(x.conductedBy||"")}</div>
            <div class="muted">${escapeHtml((x.topics||"").slice(0,80))}${(x.topics||"").length>80?"…":""}</div>
          </div>
          <button class="btn" data-hsedit="toolbox" data-id="${h.id}">Edit</button>
          <button class="btn danger" data-hsdel="toolbox" data-id="${h.id}">Delete</button>
        </div>
      `).join("") || `<div class="muted" style="padding:12px 0;">No toolbox meetings yet.</div>`}
    </div>
  `;
}
function renderHSIncidents(pid){
  const list = (state.hsIncidents||[]).filter(x=>!x.deletedAt && String(x.projectId)===String(pid))
    .sort((a,b)=>(String(b.date||"")).localeCompare(String(a.date||"")));
  return `
    <div class="row" style="justify-content:space-between;align-items:center">
      <div class="muted">${list.length} logged</div>
      <button class="btn primary" id="hsAddIncidentBtn">Add</button>
    </div>
    <div class="list">
      ${list.map(x=>`
        <div class="listItem">
          <div style="flex:1">
            <div class="title">${formatDateNZ(x.date)} • ${escapeHtml(x.type||"Incident")}</div>
            <div class="muted">${escapeHtml((x.description||"").slice(0,80))}${(x.description||"").length>80?"…":""}</div>
          </div>
          <button class="btn" data-hsedit="incident" data-id="${h.id}">Edit</button>
          <button class="btn danger" data-hsdel="incident" data-id="${h.id}">Delete</button>
        </div>
      `).join("") || `<div class="muted" style="padding:12px 0;">No incidents yet.</div>`}
    </div>
  `;
}

function renderHSHazardDetail(pid, x){
  const p = (state.projects||[]).find(z=>String(z.id)===String(pid)) || {};
  const riskLabel = x.riskLabel || x.risk || "—";
  const score = (x.riskScore!=null && x.riskScore!=="") ? String(x.riskScore) : "";
  const due = x.reviewDate ? formatDateNZ(x.reviewDate) : "—";
  const ident = x.dateIdentified ? formatDateNZ(x.dateIdentified) : "—";
  const badgeText = score ? `${riskLabel} (${score})` : riskLabel;
  return `
    <div class="fwDetail">
      <div class="fwDetailTop">
        <button class="btn" id="hsBackHaz" type="button">Back</button>
        <div class="fwDetailActions">
          <button class="btn" id="hsEditHaz" type="button">Edit</button>
          <button class="btn danger" id="hsDelHaz" type="button">Delete</button>
        </div>
      </div>
      <div class="card">
        <div class="fwH1">${escapeHtml(x.hazard||"Hazard")}</div>
        <div class="fwMeta">${escapeHtml(p.name||p.address||"")}</div>
        <div class="fwBadgeRow">
          <span class="fwBadge ${statusBadgeClass(String(riskLabel))}">${escapeHtml(badgeText)}</span>
          <span class="fwBadge muted">${escapeHtml(x.status||"Open")}</span>
          <span class="fwBadge muted">Review ${escapeHtml(due)}</span>
        </div>
        <div class="fwSection">
          <div class="fwSectionTitle">Assessment</div>
          <div class="fwKV">
            ${kv("Likelihood", x.likelihood || "—")}
            ${kv("Consequence", x.consequence || "—")}
            ${kv("Identified", ident)}
            ${kv("Responsible", x.responsible || "—")}
          </div>
        </div>
        <div class="fwSection">
          <div class="fwSectionTitle">Controls</div>
          <div class="fwKV">
            ${kv("Control measures", x.controls || "—")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function openHSProfileForm(pid){
  const existing = hsGetProfile(pid);
  const rec = existing ? {...existing} : {id:uid(), projectId:pid, pcbu:"Matty Campbell Building", supervisor:"", emergencyContact:"", assemblyPoint:"", nearestHospital:"", siteRules:"", ppe:"Hi-vis, Boots, Hard hat", inductionRequired:true, createdAt:nowIso(), updatedAt:nowIso()};
  showModal(`
    <h3>Site Safety Profile</h3>
    ${inputText("PCBU","hs_pcbu",rec.pcbu)}
    ${inputText("Supervisor","hs_supervisor",rec.supervisor)}
    ${inputText("Emergency contact","hs_emergency",rec.emergencyContact)}
    ${inputText("Assembly point","hs_assembly",rec.assemblyPoint)}
    ${inputText("Nearest hospital","hs_hospital",rec.nearestHospital)}
    ${inputText("PPE required","hs_ppe",rec.ppe)}
    ${inputCheckbox("Induction required","hs_induction_req",!!rec.inductionRequired)}
    ${inputTextarea("Site rules","hs_rules",rec.siteRules)}
    <div class="row" style="gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn" type="button" id="hsCancel">Cancel</button>
      <button class="btn primary" type="button" id="hsSave">Save</button>
    </div>
  `);
  document.getElementById("hsCancel").onclick=closeModal;
  document.getElementById("hsSave").onclick=()=>{
    rec.pcbu = val("hs_pcbu");
    rec.supervisor = val("hs_supervisor");
    rec.emergencyContact = val("hs_emergency");
    rec.assemblyPoint = val("hs_assembly");
    rec.nearestHospital = val("hs_hospital");
    rec.ppe = val("hs_ppe");
    rec.inductionRequired = !!document.getElementById("hs_induction_req").checked;
    rec.siteRules = val("hs_rules");
    rec.updatedAt = nowIso();
    if(existing){
      state.hsProfiles = (state.hsProfiles||[]).map(x=>String(x.id)===String(rec.id)?rec:x);
    }else{
      state.hsProfiles = state.hsProfiles || [];
      state.hsProfiles.push(rec);
    }
    saveState(state);
    closeModal();
    render();
  };
}
function openHSInductionForm(pid, id=null){
  const existing = id ? (state.hsInductions||[]).find(x=>String(x.id)===String(id)) : null;
  const rec = existing ? {...existing} : {id:uid(), projectId:pid, name:"", company:"", role:"", date:todayIso(), inductedBy:"", acknowledged:true, notes:"", createdAt:nowIso(), updatedAt:nowIso()};
  showModal(`
    <h3>Induction</h3>
    ${inputText("Name","hs_in_name",rec.name)}
    ${inputText("Company","hs_in_company",rec.company)}
    ${inputText("Role","hs_in_role",rec.role)}
    ${inputDate("Date","hs_in_date",rec.date)}
    ${inputText("Inducted by","hs_in_by",rec.inductedBy)}
    ${inputCheckbox("Acknowledged site rules","hs_in_ack",!!rec.acknowledged)}
    ${inputTextarea("Notes","hs_in_notes",rec.notes)}
    <div class="row" style="gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn" type="button" id="hsCancel">Cancel</button>
      <button class="btn primary" type="button" id="hsSave">Save</button>
    </div>
  `);
  document.getElementById("hsCancel").onclick=closeModal;
  document.getElementById("hsSave").onclick=()=>{
    rec.name=val("hs_in_name");
    rec.company=val("hs_in_company");
    rec.role=val("hs_in_role");
    rec.date=val("hs_in_date");
    rec.inductedBy=val("hs_in_by");
    rec.acknowledged=!!document.getElementById("hs_in_ack").checked;
    rec.notes=val("hs_in_notes");
    rec.updatedAt=nowIso();
    if(existing){
      state.hsInductions = (state.hsInductions||[]).map(x=>String(x.id)===String(rec.id)?rec:x);
    }else{
      state.hsInductions = state.hsInductions || [];
      state.hsInductions.push(rec);
    }
    saveState(state); closeModal(); render();
  };
}
function openHSHazardForm(pid, id=null){
  const existing = id ? (state.hsHazards||[]).find(x=>String(x.id)===String(id)) : null;
  const rec = existing ? {...existing} : {
    id:uid(), projectId:pid,
    hazard:"",
    likelihood: 3,
    consequence: 3,
    riskScore: 9,
    risk:"Medium",
    controls:"",
    responsible:"",
    reviewDate:todayIso(),
    status:"Open",
    dateIdentified:todayIso(),
    createdAt:nowIso(),
    updatedAt:nowIso()
  };

  // normalise older records
  rec.likelihood = Number(rec.likelihood||0) || 3;
  rec.consequence = Number(rec.consequence||0) || 3;
  rec.riskScore = Number(rec.riskScore||0) || (rec.likelihood * rec.consequence);
  rec.risk = rec.risk || hsRiskLabel(rec.riskScore);

  function renderRiskPreview(){
    const l = Number(document.getElementById("hs_hz_like").value||0);
    const c = Number(document.getElementById("hs_hz_cons").value||0);
    const score = l*c;
    const label = hsRiskLabel(score);
    const el = document.getElementById("hsRiskPreview");
    if(el) el.innerHTML = `${hsRiskBadge(label)} <span class="muted" style="margin-left:8px">Score: ${score}</span>`;
  }

  showModal(`
    <h3>Hazard</h3>

    ${inputText("Hazard","hs_hz_hazard",rec.hazard)}

    <div class="hsMatrixRow">
      <div class="field" style="flex:1">
        <div class="label">Likelihood</div>
        <select class="input" id="hs_hz_like">
          ${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===rec.likelihood?'selected':''}>${n}</option>`).join("")}
        </select>
        <div class="hint">1 Rare • 5 Almost certain</div>
      </div>
      <div class="field" style="flex:1">
        <div class="label">Consequence</div>
        <select class="input" id="hs_hz_cons">
          ${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===rec.consequence?'selected':''}>${n}</option>`).join("")}
        </select>
        <div class="hint">1 Minor • 5 Catastrophic</div>
      </div>
    </div>

    <div class="field">
      <div class="label">Risk rating</div>
      <div id="hsRiskPreview"></div>
    </div>

    ${inputSelect("Status","hs_hz_status",["Open","Controlled","Closed"],rec.status)}
    ${inputTextarea("Control measures","hs_hz_controls",rec.controls)}
    ${inputText("Responsible person","hs_hz_resp",rec.responsible)}
    ${inputDate("Review date","hs_hz_review",rec.reviewDate)}
    ${inputDate("Date identified","hs_hz_ident",rec.dateIdentified)}

    <div class="row" style="gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn" id="hsCancel">Cancel</button>
      <button class="btn primary" id="hsSave">Save</button>
    </div>
  `);

  renderRiskPreview();
  const likeEl = document.getElementById("hs_hz_like");
  const consEl = document.getElementById("hs_hz_cons");
  if(likeEl) likeEl.onchange = renderRiskPreview;
  if(consEl) consEl.onchange = renderRiskPreview;

  document.getElementById("hsCancel").onclick=closeModal;
  document.getElementById("hsSave").onclick=()=>{
    rec.hazard=val("hs_hz_hazard");
    rec.likelihood = Number(val("hs_hz_like")||0);
    rec.consequence = Number(val("hs_hz_cons")||0);
    rec.riskScore = rec.likelihood * rec.consequence;
    rec.risk = hsRiskLabel(rec.riskScore);

    rec.status=val("hs_hz_status");
    rec.controls=val("hs_hz_controls");
    rec.responsible=val("hs_hz_resp");
    rec.reviewDate=val("hs_hz_review");
    rec.dateIdentified=val("hs_hz_ident");
    rec.updatedAt=nowIso();

    if(existing){
      state.hsHazards = (state.hsHazards||[]).map(x=>String(x.id)===String(rec.id)?rec:x);
    }else{
      state.hsHazards = state.hsHazards || [];
      state.hsHazards.push(rec);
    }
    saveState(state); closeModal(); render();
  };
}

function openHSToolboxForm(pid, id=null){
  const existing = id ? (state.hsToolboxes||[]).find(x=>String(x.id)===String(id)) : null;
  const rec = existing ? {...existing} : {id:uid(), projectId:pid, date:todayIso(), conductedBy:"", topics:"", attendees:"", actions:"", createdAt:nowIso(), updatedAt:nowIso()};
  showModal(`
    <h3>Toolbox Meeting</h3>
    ${inputDate("Date","hs_tb_date",rec.date)}
    ${inputText("Conducted by","hs_tb_by",rec.conductedBy)}
    ${inputTextarea("Topics covered","hs_tb_topics",rec.topics)}
    ${inputTextarea("Attendees (names)","hs_tb_att",rec.attendees)}
    ${inputTextarea("Actions","hs_tb_actions",rec.actions)}
    <div class="row" style="gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn" type="button" id="hsCancel">Cancel</button>
      <button class="btn primary" type="button" id="hsSave">Save</button>
    </div>
  `);
  document.getElementById("hsCancel").onclick=closeModal;
  document.getElementById("hsSave").onclick=()=>{
    rec.date=val("hs_tb_date");
    rec.conductedBy=val("hs_tb_by");
    rec.topics=val("hs_tb_topics");
    rec.attendees=val("hs_tb_att");
    rec.actions=val("hs_tb_actions");
    rec.updatedAt=nowIso();
    if(existing){
      state.hsToolboxes = (state.hsToolboxes||[]).map(x=>String(x.id)===String(rec.id)?rec:x);
    }else{
      state.hsToolboxes = state.hsToolboxes || [];
      state.hsToolboxes.push(rec);
    }
    saveState(state); closeModal(); render();
  };
}
function openHSIncidentForm(pid, id=null){
  const existing = id ? (state.hsIncidents||[]).find(x=>String(x.id)===String(id)) : null;
  const rec = existing ? {...existing} : {id:uid(), projectId:pid, date:todayIso(), type:"Near miss", description:"", injury:false, medical:false, worksafe:false, immediateActions:"", followUp:"", createdAt:nowIso(), updatedAt:nowIso()};
  showModal(`
    <h3>Incident / Near Miss</h3>
    ${inputDate("Date","hs_ic_date",rec.date)}
    ${inputSelect("Type","hs_ic_type",["Incident","Near miss"],rec.type)}
    ${inputTextarea("Description","hs_ic_desc",rec.description)}
    ${inputCheckbox("Injury","hs_ic_injury",!!rec.injury)}
    ${inputCheckbox("Medical treatment required","hs_ic_med",!!rec.medical)}
    ${inputCheckbox("Reported to WorkSafe","hs_ic_ws",!!rec.worksafe)}
    ${inputTextarea("Immediate actions taken","hs_ic_im",rec.immediateActions)}
    ${inputTextarea("Follow-up","hs_ic_fu",rec.followUp)}
    <div class="row" style="gap:10px;justify-content:flex-end;margin-top:12px">
      <button class="btn" type="button" id="hsCancel">Cancel</button>
      <button class="btn primary" type="button" id="hsSave">Save</button>
    </div>
  `);
  document.getElementById("hsCancel").onclick=closeModal;
  document.getElementById("hsSave").onclick=()=>{
    rec.date=val("hs_ic_date");
    rec.type=val("hs_ic_type");
    rec.description=val("hs_ic_desc");
    rec.injury=!!document.getElementById("hs_ic_injury").checked;
    rec.medical=!!document.getElementById("hs_ic_med").checked;
    rec.worksafe=!!document.getElementById("hs_ic_ws").checked;
    rec.immediateActions=val("hs_ic_im");
    rec.followUp=val("hs_ic_fu");
    rec.updatedAt=nowIso();
    if(existing){
      state.hsIncidents = (state.hsIncidents||[]).map(x=>String(x.id)===String(rec.id)?rec:x);
    }else{
      state.hsIncidents = state.hsIncidents || [];
      state.hsIncidents.push(rec);
    }
    saveState(state); closeModal(); render();
  };
}
function hsBindActions(){
  const sel = document.getElementById("hsProjectSelect");
  if(sel){
    sel.onchange = ()=>{
      state.hsActiveProjectId = sel.value;
      saveState(state);
      render();
    };
  }
  const pid = hsGetActiveProjectId();
  const editProf = document.getElementById("hsEditProfileBtn");
  if(editProf) editProf.onclick = ()=> openHSProfileForm(pid);
  const addInd = document.getElementById("hsAddInductionBtn");
  if(addInd) addInd.onclick = ()=> openHSInductionForm(pid);
  const addHz = document.getElementById("hsAddHazardBtn");
  if(addHz) addHz.onclick = ()=> openHSHazardForm(pid);
  const addTb = document.getElementById("hsAddToolboxBtn");
  if(addTb) addTb.onclick = ()=> openHSToolboxForm(pid);
  const addIc = document.getElementById("hsAddIncidentBtn");
  if(addIc) addIc.onclick = ()=> openHSIncidentForm(pid);
  document.querySelectorAll("[data-hsedit]").forEach(b=>{
    const id = b.dataset.id;
    const type = b.dataset.hsedit;
    b.onclick = ()=>{
      if(type==="induction") return openHSInductionForm(pid, id);
      if(type==="hazard") return openHSHazardForm(pid, id);
      if(type==="toolbox") return openHSToolboxForm(pid, id);
      if(type==="incident") return openHSIncidentForm(pid, id);
    };
  });
  document.querySelectorAll("[data-hsdel]").forEach(b=>{
    const id=b.dataset.id;
    const type=b.dataset.hsdel;
    b.onclick = ()=>{
      if(!confirm("Delete this record?")) return;
      const ts = nowIso();
      const mark=(arr)=>arr.map(x=>String(x.id)===String(id)?({...x,deletedAt:ts,updatedAt:ts}):x);
      if(type==="induction") state.hsInductions = mark(state.hsInductions||[]);
      if(type==="hazard") state.hsHazards = mark(state.hsHazards||[]);
      if(type==="toolbox") state.hsToolboxes = mark(state.hsToolboxes||[]);
      if(type==="incident") state.hsIncidents = mark(state.hsIncidents||[]);
      saveState(state); render();
    };
  });

  document.querySelectorAll("[data-hsopen='hazard']").forEach(row=>{
    row.onclick = ()=>{
      state.uiSelections.hs = state.uiSelections.hs || {};
      state.uiSelections.hs.hazardId = row.dataset.id;
      saveState(state);
      render();
    };
  });
  const backHaz = document.getElementById("hsBackHaz");
  if(backHaz) backHaz.onclick = ()=>{
    state.uiSelections.hs = state.uiSelections.hs || {};
    delete state.uiSelections.hs.hazardId;
    saveState(state);
    render();
  };
  const editHaz = document.getElementById("hsEditHaz");
  if(editHaz) editHaz.onclick = ()=>{
    const hid = state.uiSelections?.hs?.hazardId;
    const hz = (state.hsHazards||[]).find(z=>String(z.id)===String(hid));
    if(hz) openHSHazardForm(pid, hz.id);
  };
  const delHaz = document.getElementById("hsDelHaz");
  if(delHaz) delHaz.onclick = ()=>{
    const hid = state.uiSelections?.hs?.hazardId;
    const hz = (state.hsHazards||[]).find(z=>String(z.id)===String(hid));
    if(hz && confirm("Delete this record?")){
      const ts = nowIso();
      state.hsHazards = (state.hsHazards||[]).map(z=>String(z.id)===String(hid)?({...z,deletedAt:ts,updatedAt:ts}):z);
      state.uiSelections.hs = state.uiSelections.hs || {};
      delete state.uiSelections.hs.hazardId;
      saveState(state);
      render();
    }
  };
  hsBindSubnav();
}

// Tiny helpers used by H&S (safe if already defined elsewhere)
function kv(k,v){ return `<div class="kvRow"><div class="kvK">${escapeHtml(k)}</div><div class="kvV">${escapeHtml(String(v??""))}</div></div>`; }
function inputText(label,id,value){ return `<div class="field"><div class="label">${escapeHtml(label)}</div><input class="input" id="${id}" value="${escapeHtml(String(value??""))}"/></div>`; }
function inputDate(label,id,value){ return `<div class="field"><div class="label">${escapeHtml(label)}</div><input class="input" type="date" id="${id}" value="${escapeHtml(String(value??""))}"/></div>`; }
function inputTextarea(label,id,value){ return `<div class="field"><div class="label">${escapeHtml(label)}</div><textarea class="input" id="${id}" rows="4">${escapeHtml(String(value??""))}</textarea></div>`; }
function inputCheckbox(label,id,checked){ return `<label class="field" style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="${id}" ${checked?"checked":""}/> <span>${escapeHtml(label)}</span></label>`; }
function inputSelect(label,id,opts,value){ return `<div class="field"><div class="label">${escapeHtml(label)}</div><select class="input" id="${id}">${opts.map(o=>`<option value="${escapeHtml(o)}" ${String(o)===String(value)?'selected':''}>${escapeHtml(o)}</option>`).join("")}</select></div>`; }
function val(id){ const el=document.getElementById(id); return el ? el.value : ""; }
function todayIso(){ const d=new Date(); const m=('0'+(d.getMonth()+1)).slice(-2); const da=('0'+d.getDate()).slice(-2); return `${d.getFullYear()}-${m}-${da}`; }
function nowIso(){ return new Date().toISOString(); }
function formatDateNZ(iso){
  if(!iso) return "—";
  const s = String(iso).slice(0,10);
  const parts = s.split("-");
  if(parts.length!==3) return s;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function hsHandleDelegatedClick(e){
  const t = e.target && (e.target.closest ? e.target.closest("button") : e.target);
  if(!t) return;
  const id = t.id || "";
  if(!id) return;

  // Only act when H&S screen is visible
  const hsRoot = document.querySelector(".hsDash") || document.getElementById("hsContent");
  if(!hsRoot) return;

  const pid = hsGetActiveProjectId ? hsGetActiveProjectId() : (state.hsActiveProjectId || state.activeProjectId || "");
  if(id==="hsQuickHazard"){ e.preventDefault(); openHSHazardForm(pid); }
  else if(id==="hsQuickToolbox"){ e.preventDefault(); openHSToolboxForm(pid); }
  else if(id==="hsQuickIncident"){ e.preventDefault(); openHSIncidentForm(pid); }
  else if(id==="hsQuickInduction"){ e.preventDefault(); openHSInductionForm(pid); }
  else if(id==="hsGoHazards"){ e.preventDefault(); state.hsActiveView="hazards"; saveState(state); render(); }
}
function hsEnsureDelegated(){
  if(window.__hsDelegated) return;
  window.__hsDelegated = true;
  document.addEventListener("click", hsHandleDelegatedClick, true);
}

function renderHSPage(app, params){
  setHeader("H&S");
  app.innerHTML = renderHS();
  // bind after DOM is injected
  try{ hsBindActions(); }catch(e){ console.warn("hsBindActions failed", e); }
  try{ hsEnsureDelegated(); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}

function render(){
  // LOGIN_RENDER_GUARD
  if(typeof isLoggedIn==="function" && !isLoggedIn()){
    const ls=document.getElementById("loginScreen");
    const appEl=document.getElementById("app");
    if(ls) ls.style.display="flex";
    if(appEl) appEl.style.display="none";
    return;
  }

  // Worker mode gate + nav visibility
  try{ ensureWorkerSettings(); }catch(e){}
  try{ updateNavVisibility(); }catch(e){}

  const { path, params } = parseRoute();
  const app = $("#app");
  // Worker mode: require profile selection
  if(workerModeEnabled() && !currentWorker()){
    setHeader("Worker");
    app.innerHTML = `
      <div class="card" style="margin-top:12px">
        <h2>Select a worker profile</h2>
        <div class="sub">Worker mode is enabled. Choose who is using the device.</div>
        <button class="btn primary" id="pickWorkerBtn" type="button" style="margin-top:10px">Select worker</button>
      </div>
    `;
    const b = document.getElementById("pickWorkerBtn");
    if(b) b.onclick = ()=> openWorkerPicker({ title: "Select worker" });
    return;
  }

  // Route access control
  const _mod = routeToModule(path);
  if(!canView(_mod)){
    setHeader("Access denied");
    app.innerHTML = `
      <div class="card" style="margin-top:12px">
        <h2>Access denied</h2>
        <div class="sub">This worker profile doesn’t have access to <b>${escapeHtml(_mod)}</b>.</div>
        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <button class="btn" id="switchWorkerBtn" type="button">Switch worker</button>
          <button class="btn" id="goHomeBtn" type="button">Go to Projects</button>
        </div>
      </div>
    `;
    const sw = document.getElementById("switchWorkerBtn");
    if(sw) sw.onclick = ()=> openWorkerPicker({ title: "Switch worker" });
    const gh = document.getElementById("goHomeBtn");
    if(gh) gh.onclick = ()=> navTo("projects");
    return;
  }

  // active nav styling
  $$(".nav .btn").forEach(b=>{
    b.classList.toggle("primary", b.dataset.nav === path);
  });

  if(path === "pipeline") return renderPipeline(app, params);
  if(path === "lead") return renderLeadDetail(app, params);
  if(path === "projects") return renderProjects(app, params);
  if(path === "project") return renderProjectDetail(app, params);
  if(path === "tasks") return renderTasks(app, params);
  if(path === "diary") return renderDiary(app, params);
  if(path === "reports") return renderReports(app, params);
  if(path === "hs") return renderHSPage(app, params);
    if(path === "equipment") return renderEquipmentPage(app, params);
  if(path === "fleet") return renderFleetPage(app, params);
if(path === "settings") return renderSettings(app, params);
  renderDeletedProjectsUI();
  // fallback
  navTo("projects");
}

window.addEventListener("hashchange", render);
window.addEventListener("load", ()=>{
  if(!location.hash) navTo("projects");
  render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

});

// Footer nav
$$(".nav .btn").forEach(b=>b.addEventListener("click", ()=>navTo(b.dataset.nav)));
// Ensure H&S button exists in footer nav (injected by JS to avoid HTML changes)
(function ensureHsNav(){
  const nav = document.querySelector(".footerbar .nav");
  if(!nav) return;
  if(nav.querySelector('[data-nav="hs"]')) return;
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.dataset.nav = "hs";
  btn.type = "button";
  btn.textContent = "H&S";
  const settingsBtn = nav.querySelector('[data-nav="settings"]');
  if(settingsBtn) nav.insertBefore(btn, settingsBtn);
  else nav.appendChild(btn);
  btn.addEventListener("click", ()=>navTo("hs"));
})();

// Header buttons (some buttons exist only on certain screens)
const _homeBtn = document.getElementById("homeBtn");
if(_homeBtn) _homeBtn.addEventListener("click", ()=>navTo("projects"));

const _themeBtn = document.getElementById("themeBtn");
if(_themeBtn) _themeBtn.addEventListener("click", ()=>{
  settings.theme = settings.theme === "dark" ? "light" : "dark";
  saveSettings(settings);
  applyTheme();
});

// Header Sync button (global)
const _syncBtn = document.getElementById("syncBtn");
if(_syncBtn){
  const refreshSyncBtnUI = ()=>{
    const hasCfg = !!(settings.sync && String(settings.sync.url||"").trim() && String(settings.sync.key||"").trim());
    _syncBtn.textContent = hasCfg ? "Sync" : "Sync setup";
    _syncBtn.title = hasCfg ? ("Sync now • Last: " + formatLastSync()) : "Set Apps Script URL + Company key in Settings";
    _syncBtn.classList.toggle("danger", !hasCfg);
    _syncBtn.disabled = !hasCfg;
  };
  refreshSyncBtnUI();
  // refresh UI when coming back from settings or after sync
  window.addEventListener("focus", ()=>{ try{ refreshSyncBtnUI(); }catch(e){} });
  _syncBtn.addEventListener("click", async ()=>{
    try{
      _syncBtn.disabled = true;
      _syncBtn.textContent = "Syncing…";
      await syncNowAll();
    }finally{
      try{ refreshSyncBtnUI(); }catch(e){}
    }
  });
}


function doExportAll(){
  const blob = new Blob([JSON.stringify({ state, settings, exportedAt: new Date().toISOString() }, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mcb-site-manager-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}

function bindImportExportButtons(){
  const ex = document.getElementById("exportBtn");
  if(ex) ex.addEventListener("click", doExportAll);
  const im = document.getElementById("importBtn");
  if(im) im.addEventListener("click", ()=>{ const f = document.getElementById("importFile"); if(f) f.click(); });
}

// Bind if present (Export/Import buttons moved to Settings page)
bindImportExportButtons();

$("#importFile").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);

    // Accept multiple export formats:
    // 1) { state, settings, exportedAt }
    // 2) { projects, tasks, diary, ... }   (older/raw state)
    // 3) { mcb: {state...} } or nested variants (best-effort)
    let nextState = null;
    let nextSettings = null;

    if(data && typeof data === "object"){
      if(data.state) nextState = data.state;
      if(data.settings) nextSettings = data.settings;

      // Raw state fallback
      const looksLikeState = ("projects" in data) || ("tasks" in data) || ("diary" in data) || ("variations" in data) || ("subbies" in data);
      if(!nextState && looksLikeState) nextState = data;

      // Nested fallback (rare)
      if(!nextState && data.mcb && typeof data.mcb === "object"){
        if(data.mcb.state) nextState = data.mcb.state;
        if(data.mcb.settings) nextSettings = data.mcb.settings;
      }
    }

    if(!nextState && !nextSettings){
      alert("Import failed: unrecognised file format.");
      return;
    }

    if(nextState) state = { ...defaults(), ...nextState };
    if(nextSettings) settings = { ...defaultSettings(), ...nextSettings };

    await saveState(state);
    await saveSettings(settings);
    applyTheme();
    render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    alert("Imported successfully.");
  }catch(err){
    console.error(err);
    alert("Import failed. Check the file.");
  }finally{
    e.target.value = "";
  }
});

// ----------------- Projects -----------------


function renderFleetPage(app){
  setHeader("Fleet");
  app.innerHTML = renderFleet();
  try{ bindFleetEvents(); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}

function renderEquipmentPage(app){
  setHeader("Equipment");
  // Render company-wide equipment register
  app.innerHTML = renderEquipment();
  // renderEquipment writes a full page; we still need to bind events
  try{ bindEquipmentEvents(); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}

function renderProjects(app){
  setHeader("Projects");
  const list = aliveArr(state.projects)
    .slice()
    .sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""));
  app.innerHTML = `
    <div class="grid two">
      ${upcomingCardHTML(7)}
      <div class="card">
        <div class="row space">
          <h2>Projects</h2>
          <button class="btn primary" id="newProject" type="button">New Project</button>
        </div>
        <div class="sub">Tap a project to manage: diary, tasks, variations, subbies, deliveries, inspections, reports.</div>
        <hr/>
        <div class="list" id="projectList">
          ${list.length ? list.map(p=>projectCard(p)).join("") : `<div class="sub">No projects yet. Create your first one.</div>`}
        </div>
      </div>
      <div class="card">
        <h2>Quick tips</h2>
        <div class="sub">
          • “Drive” opens Waze with the project destination.<br/>
          • “Live Map” shows the site location based on the saved address (and coordinates if geocoded).<br/>
          • Projects can be edited/deleted from inside a project (Admin only). Data is stored locally on this device.<br/>
        </div>
        <hr/>
        <button class="btn" id="demoBtn" type="button">Load demo data</button>
        <div class="smallmuted">Demo is optional — you can delete it later.</div>
      </div>
    </div>
  `;

  // Export/Import buttons live on this page
  try{ bindImportExportButtons(); }catch(e){}

  const renderProjectsList = (arr)=>{
    const el = $("#projectList");
    if(!el) return;
    el.innerHTML = arr.length ? arr.map(p=>projectCard(p)).join("") : `<div class="sub">No projects match your filter.</div>`;
  };
  const applyProjectFilters = ()=>{
    const q = ($("#projSearch")?.value || "").toLowerCase().trim();
    const stg = $("#projStageFilter")?.value || "";
    const all = aliveArr(state.projects).slice().sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""));
    const filtered = all.filter(p=>{
      const s = (p.stage || "Active Build");
      const hitsStage = !stg || s===stg;
      const hitsQ = !q || ((p.name||"").toLowerCase().includes(q) || (p.address||"").toLowerCase().includes(q) || (p.clientName||"").toLowerCase().includes(q));
      return hitsStage && hitsQ;
    });
    renderProjectsList(filtered);
  };
  if($("#projStageFilter")) $("#projStageFilter").onchange = applyProjectFilters;
  if($("#projSearch")) $("#projSearch").oninput = applyProjectFilters;

    const _np = $("#newProject");
  if(_np){
    if(!canEdit("projects")){ _np.style.display = "none"; }
    else _np.onclick = ()=> openProjectForm();
  }
  $("#demoBtn").onclick = ()=> loadDemo();
  $$("#projectList .item").forEach(el=>{
    el.addEventListener("click", (e)=>{
      if(e.target.closest("[data-action]")) return;
      const id = el.dataset.id;
      navTo("project", { id });
    });
  });
  $$("#projectList [data-action='drive']").forEach(btn=>btn.addEventListener("click",(e)=>{
    e.stopPropagation();
    const id = btn.dataset.id;
    openWazeForProject(projectById(id));
  }));
  $$("#projectList [data-action='edit']").forEach(btn=>btn.addEventListener("click",(e)=>{
    e.stopPropagation();
    openProjectForm(projectById(btn.dataset.id));
  }));
  $$("#projectList [data-action='delete']").forEach(btn=>btn.addEventListener("click",(e)=>{
    e.stopPropagation();
    const id = btn.dataset.id;
    const p = projectById(id);
    if(!p) return;
    if(confirmDelete(`project "${p.name}"`)){
      // also remove linked items
      state.projects = softDeleteById(state.projects, id);
// NOTE: soft delete handled elsewhere

      state.tasks = softDeleteWhere(state.tasks, x => x.projectId === id);
// NOTE: soft delete handled elsewhere

      state.diary = softDeleteWhere(state.diary, x => x.projectId === id);
// NOTE: soft delete handled elsewhere

      state.variations = softDeleteWhere(state.variations, x => x.projectId === id);
// NOTE: soft delete handled elsewhere

      state.deliveries = softDeleteWhere(state.deliveries, x => x.projectId === id);
// NOTE: soft delete handled elsewhere

      state.inspections = softDeleteWhere(state.inspections, x => x.projectId === id);
// NOTE: soft delete handled elsewhere

      // keep subbies global
      saveState(state);
      render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    }
  }));
  // Upcoming card navigation
  $$("#app [data-upnav]").forEach(el=>{
    el.addEventListener("click", ()=>{
      try{
        const nav = JSON.parse(decodeURIComponent(el.dataset.upnav));
        if(nav?.route) navTo(nav.route, nav.params || {});
      }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    });
  });
  $("#upcomingRefresh") && ($("#upcomingRefresh").onclick = ()=> render());

}

function projectCard(p){
  const addr = p.address ? escapeHtml(p.address) : "No address";
  const coords = (p.lat && p.lng) ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : "—";
  return `
    <div class="item" data-id="${p.id}">
      <div class="row space">
        <div>
          <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
            <div class="title">${escapeHtml(p.name || "Untitled project")}</div>
            <span class="badge">${escapeHtml(p.stage || "Active Build")}</span>
          </div>
          <div class="meta">${addr}</div>
          <div class="meta">Coords: ${coords}</div>
        </div>
        <div class="row">
          <button class="btn small" data-action="drive" data-id="${p.id}" type="button">Drive</button></div>
      </div>
    </div>
  `;
}

function openProjectForm(p=null){
  if(workerModeEnabled() && !canEdit("projects")){
    alert("This worker profile can't edit projects.");
    return;
  }

  const isEdit = !!p;
  const data = p || { id: uid(), name:"", address:"", clientName:"", clientPhone:"", notes:"", googlePhotos:"", googleDocs:"", lat:null, lng:null, stage:"Active Build" };
  showModal(`
    <div class="row space">
      <h2>${isEdit ? "Edit Project" : "New Project"}</h2>
      <button class="btn" id="closeM" type="button">Close</button>
    </div>
    <label>Project name</label>
    <input class="input" id="p_name" value="${escapeHtml(data.name)}" placeholder="e.g., 14 Kowhai Road Renovation" />
    <label>Address</label>
    <input class="input" id="p_address" value="${escapeHtml(data.address)}" placeholder="Street, suburb, city (NZ)" />
    <div class="row" style="margin-top:10px">
      <button class="btn" id="geoBtn" type="button">Geocode address</button>
      <span class="smallmuted" id="geoStatus">${(data.lat && data.lng) ? `Saved coords: ${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}` : "Optional (improves map + Waze accuracy)"}</span>
    </div>
    <div class="grid two">
      <div>
        <label>Client name</label>
        <input class="input" id="p_clientName" value="${escapeHtml(data.clientName||"")}" placeholder="Optional" />
      </div>
      <div>
        <label>Client phone</label>
        <input class="input" id="p_clientPhone" value="${escapeHtml(data.clientPhone||"")}" placeholder="Optional" />
      </div>
    </div>
    <label>Notes</label>
    <textarea class="input" id="p_notes" placeholder="Access, hazards, gate code, etc.">${escapeHtml(data.notes||"")}</textarea>
    <label>Google Photos folder link</label>
    <input class="input" id="p_googlePhotos" value="${escapeHtml(data.googlePhotos||"")}" placeholder="Paste Google Drive folder link (photos)" />
    <label>Google Docs folder link</label>
    <input class="input" id="p_googleDocs" value="${escapeHtml(data.googleDocs||"")}" placeholder="Paste Google Drive folder link (docs)" />

    <hr/>
    <div class="row space actionsSticky">
      <button class="btn ${isEdit ? "primary" : "primary"}" id="saveP" type="button">${isEdit ? "Save changes" : "Create project"}</button>
      ${isEdit ? `<button class="btn danger" id="delP" type="button">Delete</button>` : `<button class="btn" id="cancelP" type="button">Cancel</button>`}
    </div>
  `);
  $("#closeM").onclick = closeModal;
  $("#cancelP") && ($("#cancelP").onclick = closeModal);

  $("#geoBtn").onclick = async ()=>{
    const addr = $("#p_address").value.trim();
    if(!addr) alert("Enter an address first.");
    $("#geoStatus").textContent = "Geocoding…";
    try{
      const g = await geocodeAddress(addr);
      data.lat = g.lat; data.lng = g.lng;
      $("#geoStatus").textContent = `Saved coords: ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`;
    }catch(e){
      $("#geoStatus").textContent = "Geocode failed (try again later or just save address).";
    }
  };

  $("#saveP").onclick = ()=>{
    data.name = $("#p_name").value.trim();
    data.address = $("#p_address").value.trim();
    data.clientName = $("#p_clientName").value.trim();
    data.clientPhone = $("#p_clientPhone").value.trim();
    data.notes = $("#p_notes").value.trim();
    data.googlePhotos = $("#p_googlePhotos").value.trim();
    data.googleDocs = $("#p_googleDocs").value.trim();
    data.updatedAt = new Date().toISOString();
    if(!data.name) alert("Project name required.");
    if(isEdit){
      state.projects = alive(state.projects).filter(isAlive).map(x=>x.id===data.id ? data : x);
    }else{
      data.createdAt = new Date().toISOString();
      state.projects.unshift(data);
    }
    saveState(state);
    closeModal();
    render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  };

  $("#delP") && ($("#delP").onclick = ()=>{
    if(confirmDelete(`project "${data.name}"`)){
      state.projects = softDeleteById(state.projects, data.id);
// NOTE: soft delete handled elsewhere

      state.tasks = softDeleteWhere(state.tasks, x => x.projectId === data.id);
// NOTE: soft delete handled elsewhere

      state.diary = softDeleteWhere(state.diary, x => x.projectId === data.id);
// NOTE: soft delete handled elsewhere

      state.variations = softDeleteWhere(state.variations, x => x.projectId === data.id);
// NOTE: soft delete handled elsewhere

      state.deliveries = softDeleteWhere(state.deliveries, x => x.projectId === data.id);
// NOTE: soft delete handled elsewhere

      state.inspections = softDeleteWhere(state.inspections, x => x.projectId === data.id);
// NOTE: soft delete handled elsewhere

      saveState(state);
      closeModal();
      render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    }
  });
}

function openWazeForProject(p){
  if(!p) return;
  const hasCoords = p.lat && p.lng;
  const url = hasCoords
    ? `https://waze.com/ul?ll=${encodeURIComponent(p.lat + "," + p.lng)}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(p.address || p.name)}&navigate=yes`;
  window.open(url, "_blank");
}


function openExternalUrl(url){
  try{
    let u = String(url||"").trim();
    if(!u) return;
    if(!/^https?:\/\//i.test(u)) u = "https://" + u;
    window.open(u, "_blank");
  }catch(e){}
}

// ----------------- Project Detail (tabs) -----------------
function renderProjectDetail(app, params){
  const p = projectById(params.id);
  if(!p){ navTo("projects"); return; }
  setHeader(p.name || "Project");

let tab = params.tab || "overview";
let tabs = PROJECT_TABS.slice();

// Apply per-worker project tab restrictions (Worker mode only)
const w = workerModeEnabled() ? currentWorker() : null;
if(w && !w.isAdmin){
  const pt = (w.perms && w.perms.projectTabs) ? w.perms.projectTabs : null;
  if(pt){
    tabs = tabs.filter(([k])=> pt[k] !== false);
  }
}

// If the selected tab is not allowed, redirect to the first allowed tab.
const allowedKeys = new Set(tabs.map(([k])=>k));
if(!allowedKeys.has(tab)){
  if(tabs.length){
    navTo("project", { id:p.id, tab: tabs[0][0] });
    return;
  }else{
    app.innerHTML = `<div class="card"><h2>Access restricted</h2><div class="sub">This profile has no project tabs enabled.</div></div>`;
    return;
  }
}
  app.innerHTML = `
    <div class="card">
      <div class="row space">
        <div>
          <h2>${escapeHtml(p.name)}</h2>
          <div class="sub">${escapeHtml(p.address || "")}</div>
        </div>
        <div class="row noPrint">
          <button class="btn" id="driveBtn" type="button">Drive (Waze)</button>
          ${p.googlePhotos ? `<button class="btn" id="photosFolderBtn" type="button">Photos folder</button>` : ``}
          ${p.googleDocs ? `<button class="btn" id="docsFolderBtn" type="button">Docs folder</button>` : ``}
          <button class="btn" id="editProjBtn" type="button">Edit</button>
        </div>
      </div>
      <div class="tabs noPrint">
        ${tabs.map(([k,label])=>`<button class="btn small tab ${k===tab?"primary":""}" data-tab="${k}" type="button">${label}</button>`).join("")}
      </div>
    </div>

    <div id="tabContent" style="margin-top:12px"></div>
  `;
  $("#driveBtn").onclick = ()=> openWazeForProject(p);
  $("#editProjBtn").onclick = ()=> openProjectForm(p);
    if($("#photosFolderBtn")) $("#photosFolderBtn").onclick = ()=> openExternalUrl(p.googlePhotos);
  if($("#docsFolderBtn")) $("#docsFolderBtn").onclick = ()=> openExternalUrl(p.googleDocs);
$$(".tab").forEach(b=>b.onclick = ()=> navTo("project", { id:p.id, tab:b.dataset.tab }));

  const wrap = $("#tabContent");
  if(tab==="overview") wrap.innerHTML = projectOverview(p);
  if(tab==="map") wrap.innerHTML = projectMap(p);
  if(tab==="tasks") wrap.innerHTML = projectTasks(p);
  if(tab==="diary") wrap.innerHTML = projectDiary(p);
  if(tab==="programme") wrap.innerHTML = projectProgramme(p);
  if(tab==="variations") wrap.innerHTML = projectVariations(p);
  if(tab==="subbies") wrap.innerHTML = projectSubbies(p);
  if(tab==="deliveries") wrap.innerHTML = projectDeliveries(p);
  if(tab==="inspections") wrap.innerHTML = projectInspections(p);
  if(tab==="reports") wrap.innerHTML = projectReports(p);

  bindProjectTabEvents(p, tab);
}


function projectEquipmentCard(p){
  const assigned = aliveArr(state.equipment).filter(e=>!e.deletedAt && String(e.projectId)===String(p.id))
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  return `
    <div class="card">
      <div class="row space" style="align-items:center">
        <h2>Equipment</h2>
        <button class="btn" type="button" data-assign-equipment="${escapeAttr(p.id)}">Assign</button>
      </div>
      <div class="sub">Company equipment assigned to this site.</div>
      <hr/>
      ${assigned.length ? assigned.map(e=>`
        <div class="row space" style="gap:10px; margin:10px 0">
          <div>
            <div style="font-weight:800">${escapeHtml(e.name||"Equipment")}</div>
            <div class="sub">${escapeHtml(e.type||"")}${e.assetTag?` • ${escapeHtml(e.assetTag)}`:""}</div>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn ghost sm" type="button" data-unassign-equipment="${escapeAttr(e.id)}">Remove</button>
            <button class="btn ghost sm" type="button" data-eq-view="${escapeAttr(e.id)}">Open</button>
          </div>
        </div>
      `).join("") : `<div class="sub">No equipment assigned yet.</div>`}
    </div>
  `;
}
function assignEquipmentModal(projectId){
  const p = projectById(projectId);
  const all = aliveArr(state.equipment).filter(e=>!e.deletedAt && (e.status||"active")!=="retired")
    .sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  return `
    <div class="modal">
      <div class="modalCard">
        <div class="row space" style="align-items:center">
          <div>
            <div class="h2">Assign equipment</div>
            <div class="sub">Choose equipment to assign to <b>${escapeHtml(p?.name||"site")}</b>.</div>
          </div>
          <button class="iconBtn" id="closeModalBtn" type="button">✕</button>
        </div>
        <div class="list" style="margin-top:14px; max-height:55vh; overflow:auto">
          ${all.map(e=>{
            const assigned = String(e.projectId||"")===String(projectId);
            return `
            <div class="listItem">
              <div class="row space" style="gap:12px">
                <div>
                  <div style="font-weight:800">${escapeHtml(e.name||"Equipment")}</div>
                  <div class="sub">${escapeHtml(e.type||"")}${e.assetTag?` • ${escapeHtml(e.assetTag)}`:""}</div>
                </div>
                <button class="btn ${assigned?"ghost":"primary"} sm" type="button" data-assign-eq-item="${escapeAttr(e.id)}" data-project="${escapeAttr(projectId)}">${assigned?"Assigned":"Assign"}</button>
              </div>
            </div>`;
          }).join("")}
        </div>
        <div class="row" style="justify-content:flex-end; gap:10px; margin-top:16px">
          <button class="btn ghost" id="cancelModalBtn" type="button">Close</button>
        </div>
      </div>
    </div>`;
}


function bindAssignEquipmentModal(projectId){
  // Bind assign/unassign inside the modal
  const host = document.getElementById("modal");
  if(!host) return;

  // Toggle assign for each item
  host.querySelectorAll("[data-assign-eq-item]").forEach(btn=>{
    btn.onclick = ()=>{
      const eqId = btn.getAttribute("data-assign-eq-item");
      const pid = btn.getAttribute("data-project") || projectId;
      const e = equipmentById(eqId);
      if(!e) return;

      // In worker mode with location-only restriction, assignment is still a "location" change (allowed).
      const next = { ...e };
      const already = String(next.projectId||"") === String(pid);
      next.projectId = already ? "" : String(pid);
      // keep locationText as-is; users can adjust location note separately
      upsertEquipment(next);

      // Refresh modal + overview UI
      openModal(assignEquipmentModal(pid));
      bindAssignEquipmentModal(pid);

      try{
        const r = parseRoute();
        if(r.path === "project" && String(r.params?.id||"") === String(pid) && String(r.params?.tab||"overview")==="overview"){
          render();
        }
      }catch(e){}
    };
  });
}


function projectOverview(p){
  const openTasks = alive(state.tasks).filter(t=>t.projectId===p.id && t.status!=="Done" && isAlive(t)).length;
  const diaryCount = alive(state.diary).filter(d=>d.projectId===p.id && isAlive(d)).length;
  const varOpen = alive(state.variations).filter(v=>v.projectId===p.id && v.status!=="Approved" && isAlive(v)).length;
  const inspNext = aliveArr(state.inspections)
    .filter(i=>i.projectId===p.id && isAlive(i))
    .sort((a,b)=>(a.date||"").localeCompare(b.date||""))
    .find(i=> new Date(i.date) >= new Date(new Date().toISOString().slice(0,10)));
  return `
    <div class="grid two">
      <div class="card">
        <h2>Status</h2>
        <div class="kv"><div class="k">Open tasks</div><div class="v">${openTasks}</div></div>
        <div class="kv"><div class="k">Diary entries</div><div class="v">${diaryCount}</div></div>
        <div class="kv"><div class="k">Open variations</div><div class="v">${varOpen}</div></div>
        <div class="kv"><div class="k">Next inspection</div><div class="v">${inspNext ? `${escapeHtml(inspNext.type)} — ${dateFmt(inspNext.date)}` : "—"}</div></div>
        <hr/>
        <button class="btn primary" id="quickTask" type="button">New task</button>
        <button class="btn" id="quickDiary" type="button">New diary entry</button>
        <button class="btn" id="quickVar" type="button">New variation</button>
      </div>

      <div class="card">
        <h2>Contacts</h2>
        <div class="kv"><div class="k">Client</div><div class="v">${escapeHtml(p.clientName||"—")}</div></div>
        <div class="kv"><div class="k">Phone</div><div class="v">${p.clientPhone ? `<a href="tel:${escapeHtml(p.clientPhone)}">${escapeHtml(p.clientPhone)}</a>` : "—"}</div></div>
        <hr/>
        <h2>Notes</h2>
        <div class="sub">${escapeHtml(p.notes||"—")}</div>
      ${projectEquipmentCard(p)}</div>
    </div>
  `;
}

function projectMap(p){
  const addr = p.address || "";
  const hasCoords = p.lat && p.lng;
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?marker=${encodeURIComponent(p.lat)}%2C${encodeURIComponent(p.lng)}&zoom=16`
    : `https://www.openstreetmap.org/export/embed.html?search=${encodeURIComponent(addr)}&zoom=16`;
  // Note: OSM embed doesn't always support search param everywhere; fallback is showing map homepage with query in link.
  const link = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(p.lat)}&mlon=${encodeURIComponent(p.lng)}#map=16/${encodeURIComponent(p.lat)}/${encodeURIComponent(p.lng)}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(addr)}`;
  return `
    <div class="card">
      <div class="row space">
        <h2>Live Map</h2>
        <div class="row noPrint">
          <button class="btn" id="copyAddr" type="button">Copy address</button>
          <a class="btn" href="${link}" target="_blank" rel="noopener">Open map</a>
        </div>
      </div>
      <div class="sub">${escapeHtml(addr || "No address saved.")}</div>
      <div style="margin-top:12px; border-radius:16px; overflow:hidden; border:1px solid var(--border)">
        <iframe title="map" src="${mapSrc}" style="width:100%; height:420px; border:0"></iframe>
      </div>
      <div class="smallmuted" style="margin-top:10px">
        Tip: Use “Geocode address” in Edit Project for best accuracy.
      </div>
    </div>
  `;
}

function bindProjectTabEvents(p, tab){
  if(tab==="overview"){
    $("#quickTask").onclick = ()=> openTaskForm({ projectId:p.id });
    $("#quickDiary").onclick = ()=> openDiaryForm({ projectId:p.id });
    $("#quickVar").onclick = ()=> openVariationForm({ projectId:p.id });

    // Equipment assign/remove on project overview
    $$("#tabContent [data-assign-equipment]").forEach(b=> b.onclick = ()=>{
      const pid = b.getAttribute("data-assign-equipment") || p.id;
      openModal(assignEquipmentModal(pid));
      bindAssignEquipmentModal(pid);
    });
    $$("#tabContent [data-unassign-equipment]").forEach(b=> b.onclick = ()=>{
      const eqId = b.getAttribute("data-unassign-equipment");
      if(!eqId) return;
      const e = equipmentById(eqId);
      if(!e) return;
      const next = { ...e, projectId:"" };
      upsertEquipment(next);
      render();
    });
  }
  if(tab==="map"){
    $("#copyAddr") && ($("#copyAddr").onclick = async ()=>{
      try{ await navigator.clipboard.writeText(p.address || ""); alert("Copied."); }catch(e){ alert("Copy failed."); }
    });
  }
  if(tab==="tasks"){
    $("#addTaskProj").onclick = ()=> openTaskForm({ projectId:p.id });
    $$("#taskListProj [data-action='edit']").forEach(b=>b.onclick = ()=> openTaskForm(state.tasks.find(t=>String(t.id)===String(b.dataset.id))));
    $$("#taskListProj [data-action='delete']").forEach(b=>b.onclick = ()=>{
      const t = state.tasks.find(x=>String(x.id)===String(b.dataset.id));
      if(t && confirmDelete(`task "${t.title}"`)){
        state.tasks = softDeleteById(state.tasks, t.id);
// NOTE: soft delete handled elsewhere

        saveState(state); renderTasks(app, { projectId });
render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

      }
    });
  }
  if(tab==="diary"){
    $("#addDiaryProj").onclick = ()=> openDiaryForm({ projectId:p.id });
    $$("#diaryListProj [data-action='edit']").forEach(b=>b.onclick = ()=> openDiaryForm(state.diary.find(d=>String(d.id)===String(b.dataset.id))));
    $$("#diaryListProj [data-action='delete']").forEach(b=>b.onclick = ()=>{
      const d = state.diary.find(x=>String(x.id)===String(b.dataset.id));
      if(d && confirmDelete(`diary entry ${dateFmt(d.date)}`)){
        state.diary = softDeleteById(state.diary, d.id);
// NOTE: soft delete handled elsewhere

        saveState(state); renderDiary(app, { projectId });
render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

      }
    });
  }
  
  if(tab==="programme"){
    ensureCustomProgramme(p);

    // Set initial control values
    if($("#progMode")) $("#progMode").value = (p.programmeMode || "template");
    if($("#progStart")) $("#progStart").value = (p.programmeStartDate || fmtISO(new Date()));
    if($("#progTpl")) $("#progTpl").value = (p.programmeTemplateKey || "standard_nz");
    if($("#progCx")) $("#progCx").value = (p.programmeComplexity || "Moderate");

    const refreshProgrammeUI = ()=>{
      const mode = ($("#progMode") ? $("#progMode").value : (p.programmeMode || "template"));
      const tplOn = mode === "template";
      const tpl1 = document.getElementById("tplControls");
      const tpl2 = document.getElementById("tplControls2");
      const gen = document.getElementById("progGen");
      const cc = document.getElementById("customControls");
      const ed = document.getElementById("customEditor");
      if(tpl1) tpl1.style.display = tplOn ? "" : "none";
      if(tpl2) tpl2.style.display = tplOn ? "" : "none";
      if(gen) gen.style.display = tplOn ? "" : "none";
      if(cc) cc.style.display = tplOn ? "none" : "";
      if(ed) ed.style.display = tplOn ? "none" : "";
      if(!tplOn) renderCustomProgrammeEditor(p);
    };

    if($("#progMode")) $("#progMode").onchange = ()=>{
      p.programmeMode = $("#progMode").value;
      saveProject(p);
      render();
    };

    if($("#progStart")) $("#progStart").onchange = ()=>{
      p.programmeStartDate = ($("#progStart").value || fmtISO(new Date()));
      saveProject(p);
      render();
    };

    if($("#progGen")) $("#progGen").onclick = ()=>{
      const tpl = $("#progTpl") ? $("#progTpl").value : "standard_nz";
      const cx = $("#progCx") ? $("#progCx").value : "Moderate";
      const sd = $("#progStart") ? $("#progStart").value : fmtISO(new Date());
      p.programmeStartDate = sd || fmtISO(new Date());
      p.programmeMode = "template";
      p.programmeTemplateKey = tpl;
      p.programmeComplexity = cx;
      generateProgrammeForProject(p, { templateKey: tpl, complexity: cx });
      saveProject(p);
      render();
    };

    if($("#customAddSection")) $("#customAddSection").onclick = ()=>{
      ensureCustomProgramme(p);
      p.programmeMode = "custom";
      p.customProgramme.push({
        id: uid(),
        title: "Section",
        days: 3,
        startDate: "",
        manualStart: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      saveProject(p);
      render();
    };

    if($("#customAutoFix")) $("#customAutoFix").onclick = ()=>{
      ensureCustomProgramme(p);
      // Clear auto sections so they follow consecutively again
      p.customProgramme = (p.customProgramme||[]).map(s=>{
        const ns = { ...s };
        if(!ns.manualStart) ns.startDate = "";
        ns.updatedAt = new Date().toISOString();
        return ns;
      });
      saveProject(p);
      render();
    };

    refreshProgrammeUI();
  }
if(tab==="variations"){
    $("#addVarProj").onclick = ()=> openVariationForm({ projectId:p.id });
    $$("#varListProj [data-action='edit']").forEach(b=>b.onclick = ()=> openVariationForm(state.variations.find(v=>String(v.id)===String(b.dataset.id))));
    $$("#varListProj [data-action='delete']").forEach(b=>b.onclick = ()=>{
      const v = state.variations.find(x=>String(x.id)===String(b.dataset.id));
      if(v && confirmDelete(`variation "${v.title}"`)){
        state.variations = softDeleteById(state.variations, v.id);
// NOTE: soft delete handled elsewhere

        saveState(state); render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

      }
    });
  }
  if(tab==="subbies"){
    // Create subbie from within this project: default projectId to this project.
    $("#addSubbie").onclick = ()=> openSubbieForm({ projectId: p.id });
    $("#addSubbieBottom") && ($("#addSubbieBottom").onclick = ()=> openSubbieForm({ projectId: p.id }));
    $$("#subbieListProj [data-action='edit']").forEach(b=>b.onclick = ()=> openSubbieForm(subbieById(b.dataset.id)));
    $$("#subbieListProj [data-action='delete']").forEach(b=>b.onclick = ()=>{
      const s = subbieById(b.dataset.id);
      if(s && confirmDelete(`subbie "${s.name}"`)){
        state.subbies = softDeleteById(state.subbies, s.id);
// NOTE: soft delete handled elsewhere

        // unassign from tasks
        const now = new Date().toISOString();
        state.tasks = (state.tasks||[]).map(t => (t && t.assignedSubbieId===s.id)
          ? { ...t, assignedSubbieId: null, updatedAt: now }
          : t
        );
        saveState(state); render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

      }
    });
  }
  if(tab==="deliveries"){
    $("#addDelivery").onclick = ()=> openDeliveryForm({ projectId:p.id });
    $$("#deliveryListProj [data-action='edit']").forEach(b=>b.onclick = ()=> openDeliveryForm(state.deliveries.find(d=>String(d.id)===String(b.dataset.id))));
    $$("#deliveryListProj [data-action='delete']").forEach(b=>b.onclick = ()=>{
      const d = state.deliveries.find(x=>String(x.id)===String(b.dataset.id));
      if(d && confirmDelete(`delivery "${d.supplier || 'delivery'}"`)){
        state.deliveries = softDeleteById(state.deliveries, d.id);
// NOTE: soft delete handled elsewhere

        saveState(state); render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

      }
    });
  }
  if(tab==="inspections"){
    $("#addInspection").onclick = ()=> openInspectionForm({ projectId:p.id });
    $("#cccPlanBtn") && ($("#cccPlanBtn").onclick = ()=> openCCCPlanModal(p));
    $$("#inspectionListProj [data-action='edit']").forEach(b=>b.onclick = ()=> openInspectionForm(state.inspections.find(i=>String(i.id)===String(b.dataset.id))));
    $$("#inspectionListProj [data-action='delete']").forEach(b=>b.onclick = ()=>{
      const i = state.inspections.find(x=>String(x.id)===String(b.dataset.id));
      if(i && confirmDelete(`inspection "${i.type}"`)){
        state.inspections = softDeleteById(state.inspections, i.id);
// NOTE: soft delete handled elsewhere

        saveState(state); render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

      }
    });
  }
  if(tab==="reports"){
    $("#runProjectReport").onclick = ()=> runReportUI(p.id);
    $("#hnryExportProj").onclick = ()=> runHnryExportUI(p.id);
  }
}

// Project tab renderers
function projectTasks(p){
  const tasks = aliveArr(state.tasks)
    .filter(t=>t.projectId===p.id && isAlive(t))
    .filter(taskVisibleToCurrentUser)
    .sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
  return `
    <div class="card">
      <div class="row space">
        <h2>Tasks</h2>
        <button class="btn primary" id="addTaskProj" type="button">New task</button>
      </div>
      <div class="list" id="taskListProj">
        ${tasks.length ? tasks.map(taskRow).join("") : `<div class="sub">No tasks yet.</div>`}
      </div>
    </div>
  `;
}

function taskRow(t){
  const badgeClass = t.status==="Done" ? "ok" : (t.status==="In progress" ? "warn" : "");
  const subbie = t.assignedSubbieId ? subbieById(t.assignedSubbieId) : null;
  const worker = t.assignedWorkerId ? workerById(t.assignedWorkerId) : null;
  return `
    <div class="item">
      <div class="row space">
        <div>
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="meta">
            <span class="badge ${badgeClass}">${escapeHtml(t.status||"To do")}</span>
            ${worker ? `<span class="badge">🧑‍🔧 ${escapeHtml(worker.name)}</span>` : (t.assignedWorkerName ? `<span class="badge">🧑‍🔧 ${escapeHtml(t.assignedWorkerName)}</span>` : "")}
            ${subbie ? `<span class="badge">👷 ${escapeHtml(subbie.name)}</span>` : ""}
            ${t.dueDate ? `<span class="badge">📅 ${dateFmt(t.dueDate)}</span>` : ""}
          </div>
        </div>
        <div class="row">
          <button class="btn small" data-action="edit" data-id="${t.id}" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" data-id="${t.id}" type="button">Delete</button>
        </div>
      </div>
      ${t.photos?.length ? `<div class="thumbgrid">${t.photos.slice(0,6).map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
    </div>
  `;
}

function projectDiary(p){
  const entries = aliveArr(state.diary)
    .filter(d=>d.projectId===p.id && isAlive(d))
    .filter(diaryVisibleToCurrentUser)
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  return `
    <div class="card">
      <div class="row space">
        <h2>Diary</h2>
        <button class="btn primary" id="addDiaryProj" type="button">New entry</button>
      </div>
      <div class="list" id="diaryListProj">
        ${entries.length ? entries.map(diaryRow).join("") : `<div class="sub">No diary entries yet.</div>`}
      </div>
    </div>
  `;
}
function diaryRow(d){
  return `
    <div class="item">
      <div class="row space">
        <div>
          <div class="title">${dateFmt(d.date)}</div>
          <div class="meta">${escapeHtml((d.summary||"").slice(0,140))}</div>
          <div class="meta">
            ${d.hours ? `<span class="badge">⏱ ${escapeHtml(String(d.hours))}h</span>` : ""}
            ${d.billable ? `<span class="badge ok">Billable</span>` : `<span class="badge">Non‑billable</span>`}
            ${d.category ? `<span class="badge">${escapeHtml(d.category)}</span>` : ""}
          </div>
        </div>
        <div class="row">
          <button class="btn small" data-action="edit" data-id="${d.id}" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" data-id="${d.id}" type="button">Delete</button>
        </div>
      </div>
      ${d.photos?.length ? `<div class="thumbgrid">${d.photos.slice(0,6).map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
    </div>
  `;
}

function projectVariations(p){
  const vars = aliveArr(state.variations)
    .filter(v=>v.projectId===p.id && isAlive(v))
    .sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
  return `
    <div class="card">
      <div class="row space">
        <h2>Variations</h2>
        <button class="btn primary" id="addVarProj" type="button">New variation</button>
      </div>
      <div class="list" id="varListProj">
        ${vars.length ? vars.map(variationRow).join("") : `<div class="sub">No variations yet.</div>`}
      </div>
    </div>
  `;
}
function variationRow(v){
  const badgeClass = v.status==="Approved" ? "ok" : (v.status==="Sent" ? "warn" : "");
  return `
    <div class="item">
      <div class="row space">
        <div>
          <div class="title">${escapeHtml(v.title)}</div>
          <div class="meta">
            <span class="badge ${badgeClass}">${escapeHtml(v.status||"Draft")}</span>
            ${v.amount ? `<span class="badge">💲 ${money(v.amount)}</span>` : ""}
            ${v.date ? `<span class="badge">📅 ${dateFmt(v.date)}</span>` : ""}
          </div>
          <div class="meta">${escapeHtml((v.description||"").slice(0,160))}</div>
        </div>
        <div class="row">
          <button class="btn small" data-action="edit" data-id="${v.id}" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" data-id="${v.id}" type="button">Delete</button>
        </div>
      </div>
      ${v.photos?.length ? `<div class="thumbgrid">${v.photos.slice(0,6).map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
    </div>
  `;
}

function projectSubbies(p){
  // subbies are global; show with quick assign by using tasks, etc.
  const subbies = aliveArr(state.subbies).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const used = new Set(alive(state.tasks).filter(t=>t.projectId===p.id && isAlive(t)).map(t=>t.assignedSubbieId).filter(Boolean));
  return `
    <div class="card">
      <div class="row space">
        <h2>Subbies</h2>
        <button class="btn primary" id="addSubbie" type="button">Add subbie</button>
      </div>
      <div class="sub">Subbies are shared across projects. Assign them to tasks.</div>
      <hr/>
      <div class="list" id="subbieListProj">
        ${subbies.length ? subbies.map(s=>subbieRow(s, used.has(s.id))).join("") : `<div class="sub">No subcontractors saved yet.</div>`}
      </div>

      <div class="row" style="margin-top:12px">
        <button class="btn primary" id="addSubbieBottom" type="button" style="width:100%">Add subbie</button>
      </div>
    </div>
  `;
}
function subbieRow(s, used){
  return `
    <div class="item">
      <div class="row space">
        <div>
          <div class="title">${escapeHtml(s.name)}</div>
          <div class="meta">
            ${s.trade ? `<span class="badge">${escapeHtml(s.trade)}</span>` : ""}
            ${used ? `<span class="badge ok">Assigned on this job</span>` : ""}
          </div>
          <div class="meta">
            ${s.phone ? `<a href="tel:${escapeHtml(s.phone)}">${escapeHtml(s.phone)}</a>` : ""}
            ${s.email ? ` • <a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a>` : ""}
          </div>
          ${s.notes ? `<div class="meta">${escapeHtml(s.notes)}</div>` : ""}
        </div>
        <div class="row">
          <button class="btn small" data-action="edit" data-id="${s.id}" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" data-id="${s.id}" type="button">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function projectDeliveries(p){
  const deliveries = aliveArr(state.deliveries)
    .filter(d=>d.projectId===p.id && isAlive(d))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  return `
    <div class="card">
      <div class="row space">
        <h2>Deliveries</h2>
        <button class="btn primary" id="addDelivery" type="button">New delivery</button>
      </div>
      <div class="list" id="deliveryListProj">
        ${deliveries.length ? deliveries.map(deliveryRow).join("") : `<div class="sub">No deliveries logged yet.</div>`}
      </div>
    </div>
  `;
}
function deliveryRow(d){
  const badgeClass = d.status==="Delivered" ? "ok" : (d.status==="Missing/Damaged" ? "bad" : "warn");
  return `
    <div class="item">
      <div class="row space">
        <div>
          <div class="title">${escapeHtml(d.supplier || "Delivery")}</div>
          <div class="meta">
            <span class="badge ${badgeClass}">${escapeHtml(d.status||"Expected")}</span>
            ${d.date ? `<span class="badge">📅 ${dateFmt(d.date)}</span>` : ""}
          </div>
          <div class="meta">${escapeHtml((d.items||"").slice(0,180))}</div>
          ${d.dropPoint ? `<div class="meta">Drop: ${escapeHtml(d.dropPoint)}</div>` : ""}
        </div>
        <div class="row">
          <button class="btn small" data-action="edit" data-id="${d.id}" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" data-id="${d.id}" type="button">Delete</button>
        </div>
      </div>
      ${d.photos?.length ? `<div class="thumbgrid">${d.photos.slice(0,6).map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
    </div>
  `;
}

function projectInspections(p){
  const inspections = aliveArr(state.inspections)
    .filter(i=>i.projectId===p.id && isAlive(i))
    .sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const planned = (p.cccPlanTypes && Array.isArray(p.cccPlanTypes)) ? p.cccPlanTypes : [];
  const ccc = buildCCCStatus(p.id, inspections, planned);
  const plannedCount = planned.length;
  const plannedList = cccSortTypes(planned);
  return `
    <div class="grid two">
      <div class="card">
        <div class="row space">
          <h2>Inspections</h2>
          <button class="btn primary" id="addInspection" type="button">New inspection</button>
        </div>
        <div class="list" id="inspectionListProj">
          ${inspections.length ? inspections.map(inspectionRow).join("") : `<div class="sub">No inspections scheduled yet.</div>`}
        </div>
      </div>
      <div class="card">
        <h2>CCC tracker</h2>
        <div class="sub">Pick which inspections apply to this job (planning). Scheduling is optional.</div>
        <div class="row space noPrint" style="margin-top:10px">
          <div class="sub"><strong id="cccPlannedCount">${plannedCount}</strong> planned</div>
          <button class="btn" id="cccPlanBtn" type="button">Choose inspections</button>
        </div>
        ${plannedList.length ? `<div class="sub" style="margin-top:8px">Order: ${plannedList.map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join(" ")}</div>` : `<div class="sub" style="margin-top:8px">No planned inspections yet. Choose inspections to build your CCC plan.</div>`}
        <hr/>
        ${ccc}
      </div>
    </div>
  `;
}
function inspectionRow(i){
  const cls = i.result==="Pass" ? "ok" : (i.result==="Fail" ? "bad" : "warn");
  return `
    <div class="item">
      <div class="row space">
        <div>
          <div class="title">${escapeHtml(i.type || "Inspection")}</div>
          <div class="meta">
            <span class="badge ${cls}">${escapeHtml(i.result || "Booked")}</span>
            ${i.date ? `<span class="badge">📅 ${dateFmt(i.date)}</span>` : ""}
            ${i.inspector ? `<span class="badge">👤 ${escapeHtml(i.inspector)}</span>` : ""}
          </div>
          ${i.notes ? `<div class="meta">${escapeHtml(i.notes)}</div>` : ""}
        </div>
        <div class="row">
          <button class="btn small" data-action="edit" data-id="${i.id}" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" data-id="${i.id}" type="button">Delete</button>
        </div>
      </div>
      ${i.photos?.length ? `<div class="thumbgrid">${i.photos.slice(0,6).map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
    </div>
  `;
}
function buildCCCStatus(projectId, inspections, plannedTypes){
  const planned = Array.isArray(plannedTypes) && plannedTypes.length ? cccSortTypes(plannedTypes) : cccSortTypes(["Pre-slab / Pre-pour (foundations)","Framing / pre-line inspection","Insulation inspection","Final building inspection / CCC final"]);
  const norm = s=>String(s||"").trim().toLowerCase();
  const rows = planned.map(t=>{
    const hits = inspections.filter(i=> norm(i.type)===norm(t) && isAlive(i));
    let status = "Pending";
    let cls = "warn";
    if(hits.some(h=>h.result==="Pass")){ status="Passed"; cls="ok"; }
    else if(hits.some(h=>h.result==="Fail")){ status="Failed"; cls="bad"; }
    else if(hits.length){ status = hits[0].result || "Booked"; cls="warn"; }
    const badge = status==="Passed" ? `<span class="badge ok">✔ Passed</span>` :
                  status==="Failed" ? `<span class="badge bad">✖ Failed</span>` :
                  `<span class="badge warn">⏳ ${escapeHtml(status)}</span>`;
    return `<div class="row space"><div><strong>${escapeHtml(t)}</strong></div><div>${badge}</div></div>`;
  }).join("<hr/>");
  return rows;
}


function projectReports(p){
  return `
    <div class="card">
      <div class="row space">
        <h2>Reports</h2>
        <div class="row">
          <button class="btn" id="hnryExportProj" type="button">Hnry Invoice Export</button>
          <button class="btn primary" id="runProjectReport" type="button">Run Job Report</button>
        </div>
      </div>
      <div class="sub">
        Job Report = printable client/internal summary (diary + tasks + variations + deliveries + inspections).<br/>
        Hnry Export = copy/paste line items from diary entries.
      </div>
    </div>
  `;
}

// ----------------- Tasks (global) -----------------
function renderTasks(app, params){
  setHeader("Tasks");
  const projectId = params.projectId || "";
  const selectedId = params.id || "";
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const tasks = aliveArr(state.tasks)
    .filter(t=> !projectId || t.projectId===projectId)
    .filter(taskVisibleToCurrentUser)
    .slice()
    .sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
  
  if(selectedId){
    const tsel = aliveArr(state.tasks).find(t=>String(t.id)===String(selectedId));
    if(tsel){
      if(!taskVisibleToCurrentUser(tsel)){
        alert("You can only view your own tasks in worker mode.");
        navTo("tasks", projectId ? {projectId} : {});
        return;
      }
      state.uiSelections.tasks = state.uiSelections.tasks || {};
      // If we are in split-pane mode, update the side panel only.
      if(document.getElementById("taskDetailBody")){
        updateTaskDetailPanel(tsel, projectId);
        return;
      }
      // Otherwise (mobile / single-pane), render full detail view.
      app.innerHTML = renderTaskDetail(tsel);
      bindTaskDetail(tsel, projectId);
      return;
    } else {
      // stale selection
      state.uiSelections.tasks = state.uiSelections.tasks || {};
      delete state.uiSelections.tasks.selectedId;
      saveState(state);
    }
  
  // fill_taskDetailBody
  try{
    const sid = getSelected("tasks");
    const body = document.getElementById("taskDetailBody");
    if(body){
      const item = sid ? aliveArr(state.tasks).find(x=>String(x.id)===String(sid)) : null;
      body.innerHTML = renderTaskDetailPane(item);
      if(item) bindTaskDetailPane(item);
    }
  }catch(e){}

}
app.innerHTML = `
    <div class="card">
      <div class="row space">
        <h2>Tasks</h2>
        <button class="btn primary" id="newTask" type="button">New Task</button>
      </div>
      <div class="grid two">
        <div>
          <label>Filter by project</label>
          <select id="taskProjectFilter" class="input">
            <option value="">All projects</option>
            ${projects.map(p=>`<option value="${p.id}" ${p.id===projectId?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
          </select>
        </div>
        <div></div>
      </div>
      <hr/>
      <div class="list" id="taskList">${tasks.length ? tasks.map(taskRowWithProject).join("") : `<div class="sub">No tasks yet.</div>`}</div>
    </div>
  `;
  const _nt = $("#newTask");
  if(_nt){
    if(!canEdit("tasks")){ _nt.style.display = "none"; }
    else _nt.onclick = ()=> openTaskForm(projectId ? { projectId } : {});
  }
  $("#taskProjectFilter").onchange = (e)=>{
    const v = e.target.value;
    navTo("tasks", v ? {projectId:v} : {});
  };

  $$("#taskList [data-action='open']").forEach(row=>row.onclick = ()=>{
    const id = row.dataset.id;
    navTo("tasks", Object.assign({}, projectId ? {projectId} : {}, { id }));
  });
}
function taskRowWithProject(t){
  const p = projectById(t.projectId);
  const status = t.status || "Open";
  const due = t.dueDate ? dateFmt(t.dueDate) : "";
  const aw = t.assignedWorkerId ? (workerById(t.assignedWorkerId)?.name || t.assignedWorkerName || "") : (t.assignedWorkerName||"");
  const as = t.assignedSubbieId ? (subbieById(t.assignedSubbieId)?.name||"") : (t.subbieId ? (subbieById(t.subbieId)?.name||"") : "");
  const assigned = t.assignedToName || aw || as || "";
  const metaBits = [
    p ? escapeHtml(p.name||p.address||"") : "No project",
    due ? ("Due " + escapeHtml(due)) : "",
    assigned ? ("Assigned " + escapeHtml(assigned)) : ""
  ].filter(Boolean).join(" • ");
  const badge = `<span class="fwBadge ${statusBadgeClass(status)}">${escapeHtml(status)}</span>`;
  return `
    <div class="fwListItem" data-action="open" data-id="${t.id}">
      <div class="fwMain">
        <div class="fwTitleRow">
          <div class="fwTitle">${escapeHtml(t.title || "(Untitled task)")}</div>
          ${badge}
        </div>
        <div class="fwMeta">${escapeHtml(metaBits || " ")}</div>
      </div>
      <div class="fwChevron">›</div>
    </div>
  `;
}

function renderTaskDetail(t){
  const p = projectById(t.projectId);
  const status = t.status || "Open";
  const due = t.dueDate ? dateFmt(t.dueDate) : "";
  const created = t.createdAt ? dateFmt(String(t.createdAt).slice(0,10)) : "";
  const updated = t.updatedAt ? dateFmt(String(t.updatedAt).slice(0,10)) : "";
  const enteredBy = t.createdByName || "";
  const updatedBy = t.updatedByName || "";
  const photosTaken = !!(t.photosTaken || (t.photosJson && String(t.photosJson).trim()) || (t.photos && t.photos.length));
  return `
    <div class="fwDetail">
      <div class="fwDetailTop">
        <button class="btn" id="taskBack" type="button">Back</button>
        <div class="fwDetailActions">
          <button class="btn" id="taskEdit" type="button">Edit</button>
          <button class="btn danger" id="taskDelete" type="button">Delete</button>
        </div>
      </div>

      <div class="card">
        <div class="fwH1">${escapeHtml(t.title || "(Untitled task)")}</div>
        <div class="fwMeta">${p ? escapeHtml(p.name||p.address||"") : "No project"}</div>

        <div class="fwBadgeRow">
          <span class="fwBadge ${statusBadgeClass(status)}">${escapeHtml(status)}</span>
          ${due ? `<span class="fwBadge muted">Due ${escapeHtml(due)}</span>` : ``}
          ${photosTaken ? `<span class="fwBadge ok">Photos taken</span>` : `<span class="fwBadge muted">No photos</span>`}
        </div>

        <div class="fwSection">
          <div class="fwSectionTitle">Details</div>
          <div class="fwKV">
            ${kv("Details", (t.details || t.description || t.notes || "") || "—")}
            ${kv("Assigned", (t.assignedToName || (t.assignedWorkerId ? (workerById(t.assignedWorkerId)?.name || t.assignedWorkerName || "") : (t.assignedWorkerName||"")) || (t.assignedSubbieId ? (subbieById(t.assignedSubbieId)?.name||"") : (t.subbieId ? (subbieById(t.subbieId)?.name||"") : ""))) || "—")}
            ${kv("Due date", due || "—")}
            ${kv("Created", created || "—")}
            ${kv("Updated", updated || "—")}
          </div>
        </div>
      </div>
    </div>
  `;
}
function bindTaskDetail(t, projectId){
  $("#taskBack").onclick = ()=>{
    if(state.uiSelections?.tasks) delete state.uiSelections.tasks.selectedId;
    saveState(state);
    navTo("tasks", projectId ? {projectId} : {});
  };
  $("#taskEdit").onclick = ()=> openTaskForm(t);
  $("#taskDelete").onclick = ()=>{
    if(confirmDelete(`task "${t.title}"`)){
      state.tasks = softDeleteById(state.tasks, t.id);
      if(state.uiSelections?.tasks) delete state.uiSelections.tasks.selectedId;
      saveState(state);
      navTo("tasks", projectId ? {projectId} : {});
    }
  };
}

function openTaskForm(seed={}){
  if(workerModeEnabled() && !canEdit("tasks")){
    alert("This worker profile can't edit tasks.");
    return;
  }

  const isEdit = !!seed.id;
  const rw = restrictedWorker();
  const t = isEdit ? seed : {
    id: uid(),
    projectId: seed.projectId || (state.projects[0]?.id || ""),
    title: "",
    details: "",
    status: "To do",
    dueDate: "",
    assignedSubbieId: null,
    assignedWorkerId: rw ? String(rw.id||"") : null,
    assignedWorkerName: rw ? String(rw.name||"Worker") : "",
    photos: [],
    photosTaken: false,
    photosJson: "[]",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const subbies = aliveArr(state.subbies).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const workers = aliveArr((settings.workers||[])).filter(w=>w && !w.isAdmin).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const lockAssign = !!rw;
  showModal(`
    <div class="row space">
      <h2>${isEdit ? "Edit Task" : "New Task"}</h2>
      <button class="btn" id="closeM" type="button">Close</button>
    </div>
    <label>Project</label>
    <select id="t_project" class="input">
      ${projects.map(p=>`<option value="${p.id}" ${p.id===t.projectId?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
    </select>
    <label>Title</label>
    <input id="t_title" class="input" value="${escapeHtml(t.title)}" placeholder="e.g., Fit off bathroom, fix jamb, order LVL" />
    <label>Details</label>
    <textarea id="t_details" class="input" placeholder="Notes for you / subbie">${escapeHtml(t.details||"")}</textarea>
    <div class="grid two">
      <div>
        <label>Status</label>
        <select id="t_status" class="input">
          ${["To do","In progress","Blocked","Done"].map(s=>`<option ${s===t.status?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Due date</label>
        <input id="t_due" class="input" type="date" value="${escapeHtml(t.dueDate||"")}" />
      </div>
    </div>
    <label>Assign to worker (optional)</label>
    <select id="t_worker" class="input" ${lockAssign?"disabled":""}>
      <option value="">Unassigned</option>
      ${workers.map(w=>`<option value="${w.id}" ${String(w.id)===String(t.assignedWorkerId||"")?"selected":""}>${escapeHtml(w.name||"Worker")}</option>`).join("")}
    </select>
    <label>Assign to subbie (optional)</label>
    <select id="t_subbie" class="input" ${lockAssign?"disabled":""}>
      <option value="">Unassigned</option>
      ${subbies.map(s=>`<option value="${s.id}" ${s.id===t.assignedSubbieId?"selected":""}>${escapeHtml(s.name)}${s.trade?` — ${escapeHtml(s.trade)}`:""}</option>`).join("")}
    </select>
    ${lockAssign ? `<div class="small" style="opacity:.85">In worker mode you can't reassign tasks.</div>` : ``}

    <label class="checkboxRow">
      <input id="t_photosTaken" class="input" type="checkbox" ${((t.photosJson&&String(t.photosJson).trim()) || (t.photos&&t.photos.length)) ? "checked" : ""} />
      Photos taken
    </label>
    <div class="small" style="opacity:.8">Store photos externally (not uploaded in-app).</div>
<hr/>
    <div class="row space actionsSticky">
      <button class="btn primary" id="saveT" type="button">${isEdit ? "Save" : "Create"}</button>
      <button class="btn" id="cancelT" type="button">Cancel</button>
      ${isEdit ? `<button class="btn danger" id="delT" type="button">Delete</button>` : ""}
    </div>
  `);
  $("#closeM").onclick = closeModal;
  $("#cancelT").onclick = closeModal;

  $("#saveT").onclick = async ()=>{
    const __btn = $("#saveT");
    setBtnBusy(__btn, true);
    const __hint = showSavingHint("Saving…");
    try{
t.projectId = $("#t_project").value;
    t.title = $("#t_title").value.trim();
    t.details = $("#t_details").value.trim();
    t.status = $("#t_status").value;
    t.dueDate = $("#t_due").value;
    // Assignment: worker takes precedence; if set we clear subbie.
    const wid = $("#t_worker") ? ($("#t_worker").value || null) : null;
    const sid = $("#t_subbie") ? ($("#t_subbie").value || null) : null;
    if(wid){
      const w = workerById(wid);
      t.assignedWorkerId = String(wid);
      t.assignedWorkerName = String(w?.name || t.assignedWorkerName || "Worker");
      t.assignedSubbieId = null;
      t.assignedToName = t.assignedWorkerName;
    } else {
      t.assignedWorkerId = null;
      t.assignedWorkerName = "";
      t.assignedSubbieId = sid;
      if(sid){
        const s = subbieById(sid);
        t.assignedToName = String(s?.name || "");
      } else {
        t.assignedToName = "";
      }
    }

    t.photosJson = ($("#t_photosTaken") && $("#t_photosTaken").checked) ? "true" : "";
    const actor = currentActor();
    if(!isEdit){ t.createdById = actor.id; t.createdByName = actor.name; }
    t.updatedById = actor.id; t.updatedByName = actor.name;
t.updatedAt = new Date().toISOString();
    if(!t.title) alert("Title required.");
    if(isEdit){
      state.tasks = alive(state.tasks).filter(isAlive).map(x=>x.id===t.id ? t : x);
    }else{
      state.tasks.unshift(t);
    }
    addActivity({ kind:"task", action:(isEdit?"update":"create"), entityId:t.id, projectId:t.projectId, title:t.title, actorId:actor.id, actorName:actor.name });
    saveState(state);
    closeModal();
    render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    } finally {
      __hint && __hint.remove();
      setBtnBusy(__btn, false);
    }

  };

  $("#delT") && ($("#delT").onclick = ()=>{
    if(confirmDelete(`task "${t.title}"`)){
      state.tasks = softDeleteById(state.tasks, t.id);
// NOTE: soft delete handled elsewhere

      saveState(state);
      renderTasks(app, { projectId });
closeModal();
      render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    }
  });
}

// ----------------- Diary (global) -----------------

function openDiaryView(d){
  if(!d) return;
  const p = (state.projects||[]).find(x=>x.id===d.projectId);
  showModal(`
    <div class="row space">
      <h2>Diary Entry</h2>
      <div class="row">
        <button class="btn" id="closeM" type="button">Close</button>
        <button class="btn primary" id="editV" type="button">Edit</button>
      </div>
    </div>
    <div class="sub"><strong>${escapeHtml(p?.name || "Project")}</strong><br/>${escapeHtml(p?.address || "")}</div>
    <hr/>
    <div class="kv"><div class="k">Date</div><div class="v">${escapeHtml(dateFmt(d.date))}</div></div>
    <div class="kv"><div class="k">Category</div><div class="v">${escapeHtml(d.category||"")}</div></div>
    <div class="kv"><div class="k">Billable</div><div class="v">${d.billable ? "Yes" : "No"}</div></div>
    ${d.hours ? `<div class="kv"><div class="k">Hours</div><div class="v">${escapeHtml(String(d.hours))}</div></div>` : ""}
    ${d.rate ? `<div class="kv"><div class="k">Rate</div><div class="v">${escapeHtml(String(d.rate))}</div></div>` : ""}
    <hr/>
    <h2 style="margin-top:0">Notes</h2>
    <div class="sub" style="white-space:pre-wrap">${escapeHtml(d.summary||"—")}</div>
    ${d.photos?.length ? `<hr/><h2 style="margin-top:0">Photos</h2><div class="thumbgrid">${d.photos.map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
  `);
  $("#closeM").onclick = closeModal;
  $("#editV").onclick = ()=> openDiaryForm(d);
}
function renderDiary(app, params){
  setHeader("Diary");
  const projectId = params.projectId || "";
  const selectedId = params.id || "";
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const entries = aliveArr(state.diary)
    .filter(d=> !projectId || d.projectId===projectId)
    .filter(diaryVisibleToCurrentUser)
    .slice()
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  
  if(selectedId){
    const dsel = aliveArr(state.diary).find(d=>String(d.id)===String(selectedId));
    if(dsel){
      if(!diaryVisibleToCurrentUser(dsel)){
        alert("You can only view your own diary entries in worker mode.");
        navTo("diary", projectId ? {projectId} : {});
        return;
      }
      state.uiSelections.diary = state.uiSelections.diary || {};
      const hasPane = !!document.getElementById("diaryDetailBody");
      if(hasPane){
        updateDiaryDetailPanel(dsel, projectId);
        // Pane binding is handled by bindDiaryDetailPane inside updateDiaryDetailPanel()
      } else {
        app.innerHTML = renderDiaryDetail(dsel);
        bindDiaryDetail(dsel, projectId);
      }
      return;
    } else {
      state.uiSelections.diary = state.uiSelections.diary || {};
      delete state.uiSelections.diary.selectedId;
      saveState(state);
    }
  
  // fill_diaryDetailBody
  try{
    const sid = getSelected("diary");
    const body = document.getElementById("diaryDetailBody");
    if(body){
      const item = sid ? aliveArr(state.diary).find(x=>String(x.id)===String(sid)) : null;
      body.innerHTML = renderDiaryDetailPane(item);
      if(item) bindDiaryDetailPane(item);
    }
  }catch(e){}

}
app.innerHTML = `
    <div class="card">
      <div class="row space">
        <h2>Diary</h2>
        <button class="btn primary" id="newDiary" type="button">New Entry</button>
      </div>
      <div class="grid two">
        <div>
          <label>Filter by project</label>
          <select id="diaryProjectFilter" class="input">
            <option value="">All projects</option>
            ${projects.map(p=>`<option value="${p.id}" ${p.id===projectId?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
          </select>
        </div>
        <div></div>
      </div>
      <hr/>
      <div class="list" id="diaryList">${entries.length ? entries.map(diaryRowWithProject).join("") : `<div class="sub">No diary entries yet.</div>`}</div>
    </div>
  `;
    const _nd = $("#newDiary");
  if(_nd){
    if(!canEdit("diary")){ _nd.style.display = "none"; }
    else _nd.onclick = ()=> openDiaryForm(projectId ? { projectId } : {});
  }
  $("#diaryProjectFilter").onchange = (e)=>{
    const v = e.target.value;
    navTo("diary", v ? {projectId:v} : {});
  };

  $$("#diaryList [data-action='open']").forEach(row=>row.onclick = ()=>{
    const id = row.dataset.id;
    navTo("diary", Object.assign({}, projectId ? {projectId} : {}, { id }));
  });
  // (Fieldwire UI refactor) Delete is handled by detail view actions.
}
function diaryRowWithProject(d){
  const p = projectById(d.projectId);
  const date = d.date ? dateFmt(d.date) : "";
  const hours = (d.hours!=null && d.hours!=="") ? `${escapeHtml(String(d.hours))}h` : "";
  const photosTaken = !!(d.photosTaken || (d.photosJson && String(d.photosJson).trim()) || (d.photos && d.photos.length));
  const metaBits = [
    p ? escapeHtml(p.name||p.address||"") : "No project",
    hours,
    photosTaken ? "Photos taken" : ""
  ].filter(Boolean).join(" • ");
  return `
    <div class="fwListItem" data-action="open" data-id="${d.id}">
      <div class="fwMain">
        <div class="fwTitleRow">
          <div class="fwTitle">${escapeHtml(date || "Diary entry")}</div>
          ${hours ? `<span class="fwBadge muted">${hours}</span>` : ``}
        </div>
        <div class="fwMeta">${escapeHtml(metaBits || " ")}</div>
        ${d.notes ? `<div class="fwSub">${escapeHtml(String(d.notes).slice(0,90))}${String(d.notes).length>90?"…":""}</div>` : ``}
      </div>
      <div class="fwChevron">›</div>
    </div>
  `;
}

function renderDiaryDetail(d){
  const p = projectById(d.projectId);
  const date = d.date ? dateFmt(d.date) : "";
  const hours = (d.hours!=null && d.hours!=="") ? `${escapeHtml(String(d.hours))} hours` : "—";
  const photosTaken = !!(d.photosTaken || (d.photosJson && String(d.photosJson).trim()) || (d.photos && d.photos.length));
  return `
    <div class="fwDetail">
      <div class="fwDetailTop">
        <button class="btn" id="diaryBack" type="button">Back</button>
        <div class="fwDetailActions">
          <button class="btn" id="diaryEdit" type="button">Edit</button>
          <button class="btn danger" id="diaryDelete" type="button">Delete</button>
        </div>
      </div>

      <div class="card">
        <div class="fwH1">${escapeHtml(date || "Diary entry")}</div>
        <div class="fwMeta">${p ? escapeHtml(p.name||p.address||"") : "No project"}</div>

        <div class="fwBadgeRow">
          <span class="fwBadge muted">${hours}</span>
          ${photosTaken ? `<span class="fwBadge ok">Photos taken</span>` : `<span class="fwBadge muted">No photos</span>`}
        </div>

        <div class="fwSection">
          <div class="fwSectionTitle">Details</div>
          <div class="fwKV">
            ${kv("Entered by", d.createdByName || "—")}
            ${kv("Weather", d.weather || "—")}
            ${kv("Crew", d.crew || "—")}
            ${kv("Notes", (d.notes || d.summary) || "—")}
          </div>
        </div>
      </div>
    </div>
  `;
}
function bindDiaryDetail(d, projectId){
  $("#diaryBack").onclick = ()=>{
    if(state.uiSelections?.diary) delete state.uiSelections.diary.selectedId;
    saveState(state);
    navTo("diary", projectId ? {projectId} : {});
  };
  $("#diaryEdit").onclick = ()=> openDiaryForm(d);
  $("#diaryDelete").onclick = ()=>{
    if(confirmDelete(`diary entry ${dateFmt(d.date)}`)){
      state.diary = softDeleteById(state.diary, d.id);
      if(state.uiSelections?.diary) delete state.uiSelections.diary.selectedId;
      saveState(state);
      navTo("diary", projectId ? {projectId} : {});
    }
  };
}

function openDiaryForm(seed={}){
  if(workerModeEnabled() && !canEdit("diary")){
    alert("This worker profile can't edit diary.");
    return;
  }

  const isEdit = !!seed.id;
  const d = isEdit ? ({...seed}) : {
    id: uid(),
    projectId: seed.projectId || (state.projects[0]?.id || ""),
    date: new Date().toISOString().slice(0,10),
    summary: "",
    notes: "",
    weather: "",
    crew: "",
    hours: "",
    billable: true,
    category: "Labour",
    rate: "",
    photos: [],
    photosTaken: false,
    photosJson: "[]",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Align fields for older entries / different builds
  if(d.notes == null || d.notes === "") d.notes = (d.summary || "");
  if(d.summary == null || d.summary === "") d.summary = (d.notes || "");
  if(d.weather == null) d.weather = "";
  if(d.crew == null) d.crew = "";
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  showModal(`
    <div class="row space">
      <h2>${isEdit ? "Edit Diary Entry" : "New Diary Entry"}</h2>
      <button class="btn" id="closeM" type="button">Close</button>
    </div>
    <label>Project</label>
    <select id="d_project" class="input">
      ${projects.map(p=>`<option value="${p.id}" ${p.id===d.projectId?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
    </select>
    <div class="grid two">
      <div>
        <label>Date</label>
        <input id="d_date" class="input" type="date" value="${escapeHtml(d.date)}" />
      </div>
      <div>
        <label>Hours (optional)</label>
        <input id="d_hours" class="input" type="number" step="0.25" value="${escapeHtml(d.hours||"")}" placeholder="e.g., 7.5" />
      </div>
    </div>
    <div class="grid two">
      <div>
        <label>Category</label>
        <select id="d_cat" class="input">
          ${["Labour","Materials","Travel","Plant","Other"].map(c=>`<option ${c===d.category?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Billable</label>
        <select id="d_bill" class="input">
          <option value="true" ${d.billable?"selected":""}>Yes</option>
          <option value="false" ${!d.billable?"selected":""}>No</option>
        </select>
      </div>
    </div>
    <label>Rate (NZD/hr or item cost) — optional</label>
    <input id="d_rate" class="input" type="number" step="0.01" value="${escapeHtml(d.rate||"")}" placeholder="Leave blank to use default labour rate in Settings" />
    <div class="grid two">
      <div>
        <label>Weather</label>
        <input id="d_weather" class="input" type="text" value="${escapeHtml(d.weather||"")}" placeholder="e.g., Fine / Showers / Windy" />
      </div>
      <div>
        <label>Crew</label>
        <input id="d_crew" class="input" type="text" value="${escapeHtml(d.crew||"")}" placeholder="e.g., Matt + 2, or subcontractors" />
      </div>
    </div>
    <label>Notes</label>
    <textarea id="d_notes" class="input" placeholder="What was done today?">${escapeHtml((d.notes||d.summary||""))}</textarea>
    <label class="checkboxRow">
      <input id="d_photosTaken" class="input" type="checkbox" ${((d.photosJson&&String(d.photosJson).trim()) || (d.photos&&d.photos.length)) ? "checked" : ""} />
      Photos taken
    </label>
    <div class="small" style="opacity:.8">Store photos externally (not uploaded in-app).</div>
<hr/>
    <div class="row space actionsSticky">
      <button class="btn primary" id="saveD" type="button">${isEdit ? "Save" : "Create"}</button>
      <button class="btn" id="cancelD" type="button">Cancel</button>
      ${isEdit ? `<button class="btn danger" id="delD" type="button">Delete</button>` : ""}
    </div>
  `);
  $("#closeM").onclick = closeModal;
  $("#cancelD").onclick = closeModal;

  $("#saveD").onclick = async ()=>{
    const __btn = $("#saveD");
    setBtnBusy(__btn, true);
    const __hint = showSavingHint("Saving…");
    try{
d.projectId = $("#d_project").value;
    d.date = $("#d_date").value;
    d.hours = $("#d_hours").value;
    d.category = $("#d_cat").value;
    d.billable = $("#d_bill").value === "true";
    d.rate = $("#d_rate").value;
    d.weather = $("#d_weather").value.trim();
    d.crew = $("#d_crew").value.trim();
    d.notes = $("#d_notes").value.trim();
    d.summary = d.notes;
    const actor = currentActor();
    if(!isEdit){ d.createdById = actor.id; d.createdByName = actor.name; }
    d.updatedById = actor.id; d.updatedByName = actor.name;
d.updatedAt = new Date().toISOString();
    if(!d.projectId) alert("Project required.");
    if(!d.date) alert("Date required.");
    if(isEdit){
      state.diary = alive(state.diary).filter(isAlive).map(x=>x.id===d.id ? d : x);
    }else{
      state.diary.unshift(d);
    }
    addActivity({ kind:"diary", action:(isEdit?"update":"create"), entityId:d.id, projectId:d.projectId, date:d.date, actorId:actor.id, actorName:actor.name });
    saveState(state);
    closeModal();
    render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    } finally {
      __hint && __hint.remove();
      setBtnBusy(__btn, false);
    }

  };

  $("#delD") && ($("#delD").onclick = ()=>{
    if(confirmDelete(`diary entry ${dateFmt(d.date)}`)){
      state.diary = softDeleteById(state.diary, d.id);
// NOTE: soft delete handled elsewhere

      saveState(state);
      renderDiary(app, { projectId });
closeModal();
      render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    }
  });
}

// ----------------- Variations (global list is via project) -----------------
function openVariationForm(seed={}){
  const isEdit = !!seed.id;
  const v = isEdit ? seed : {
    id: uid(),
    projectId: seed.projectId || (state.projects[0]?.id || ""),
    date: new Date().toISOString().slice(0,10),
    title: "",
    description: "",
    amount: "",
    status: "Draft",
    photos: [],
    photosTaken: false,
    photosJson: "[]",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  showModal(`
    <div class="row space">
      <h2>${isEdit ? "Edit Variation" : "New Variation"}</h2>
      <button class="btn" id="closeM" type="button">Close</button>
    </div>
    <label>Project</label>
    <select id="v_project" class="input">
      ${projects.map(p=>`<option value="${p.id}" ${p.id===v.projectId?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
    </select>
    <div class="grid two">
      <div>
        <label>Date</label>
        <input id="v_date" class="input" type="date" value="${escapeHtml(v.date||"")}" />
      </div>
      <div>
        <label>Status</label>
        <select id="v_status" class="input">
          ${["Draft","Sent","Approved","Declined"].map(s=>`<option ${s===v.status?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
    </div>
    <label>Title</label>
    <input id="v_title" class="input" value="${escapeHtml(v.title||"")}" placeholder="e.g., Extra soffit lining / Change of tiles" />
    <label>Description</label>
    <textarea id="v_desc" class="input" placeholder="Scope change, photos, notes">${escapeHtml(v.description||"")}</textarea>
    <label>Amount (NZD)</label>
    <input id="v_amount" class="input" type="number" step="0.01" value="${escapeHtml(v.amount||"")}" />
    <label>Photos</label>
    <input id="v_photos" class="input" type="hidden" accept="image/*" multiple />
    ${v.photos?.length ? `<div class="thumbgrid">${v.photos.map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
    <hr/>
    <div class="row space actionsSticky">
      <button class="btn primary" id="saveV" type="button">${isEdit ? "Save" : "Create"}</button>
      <button class="btn" id="cancelV" type="button">Cancel</button>
      ${isEdit ? `<button class="btn danger" id="delV" type="button">Delete</button>` : ""}
    </div>
  `);
  $("#closeM").onclick = closeModal;
  $("#cancelV").onclick = closeModal;

  $("#saveV").onclick = async ()=>{
    const __btn = $("#saveV");
    setBtnBusy(__btn, true);
    const __hint = showSavingHint("Saving…");
    try{
    const added = await filesToDataUrls($("#v_photos").files);
    v.projectId = $("#v_project").value;
    v.date = $("#v_date").value;
    v.status = $("#v_status").value;
    v.title = $("#v_title").value.trim();
    v.description = $("#v_desc").value.trim();
    v.amount = $("#v_amount").value;
    v.photos = [...(v.photos||[]), ...added];
    v.updatedAt = new Date().toISOString();
    if(!v.title) alert("Title required.");
    if(isEdit){
      state.variations = alive(state.variations).filter(isAlive).map(x=>x.id===v.id ? v : x);
    }else{
      state.variations.unshift(v);
    }
    saveState(state);
    closeModal();
    render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    } finally {
      __hint && __hint.remove();
      setBtnBusy(__btn, false);
    }

  };

  $("#delV") && ($("#delV").onclick = ()=>{
    if(confirmDelete(`variation "${v.title}"`)){
      state.variations = softDeleteById(state.variations, v.id);
// NOTE: soft delete handled elsewhere

      saveState(state);
      closeModal();
      render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    }
  });
}

// ----------------- Subbies -----------------
function openSubbieForm(seed=null){
  const isEdit = !!seed?.id;
  // Subbies can be shared across projects (projectId = "") or linked to a specific project.
  const s = isEdit ? seed : {
    id: uid(),
    projectId: seed?.projectId || "",
    name:"", trade:"", phone:"", email:"", notes:"",
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  showModal(`
    <div class="row space">
      <h2>${isEdit ? "Edit Subbie" : "Add Subbie"}</h2>
      <button class="btn" id="closeM" type="button">Close</button>
    </div>
    <label>Name</label>
    <input id="s_name" class="input" value="${escapeHtml(s.name||"")}" placeholder="Company or person" />
    <label>Trade</label>
    <input id="s_trade" class="input" value="${escapeHtml(s.trade||"")}" placeholder="e.g., Plumber, Sparky, Gib, Painter" />
    <label>Project (optional)</label>
    <select id="s_project" class="input">
      <option value="" ${!s.projectId?"selected":""}>Shared (all projects)</option>
      ${projects.map(p=>`<option value="${p.id}" ${p.id===s.projectId?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
    </select>
    <div class="grid two">
      <div>
        <label>Phone</label>
        <input id="s_phone" class="input" value="${escapeHtml(s.phone||"")}" />
      </div>
      <div>
        <label>Email</label>
        <input id="s_email" class="input" value="${escapeHtml(s.email||"")}" />
      </div>
    </div>
    <label>Notes</label>
    <textarea id="s_notes" class="input">${escapeHtml(s.notes||"")}</textarea>
    <hr/>
    <div class="row space actionsSticky">
      <button class="btn primary" id="saveS" type="button">${isEdit ? "Save" : "Add"}</button>
      <button class="btn" id="cancelS" type="button">Cancel</button>
      ${isEdit ? `<button class="btn danger" id="delS" type="button">Delete</button>` : ""}
    </div>
  `);
  $("#closeM").onclick = closeModal;
  $("#cancelS").onclick = closeModal;

  $("#saveS").onclick = ()=>{
    s.name = $("#s_name").value.trim();
    s.trade = $("#s_trade").value.trim();
    s.projectId = $("#s_project") ? $("#s_project").value : (s.projectId || "");
    s.phone = $("#s_phone").value.trim();
    s.email = $("#s_email").value.trim();
    s.notes = $("#s_notes").value.trim();
    s.updatedAt = new Date().toISOString();
    if(!s.name) alert("Name required.");
    if(isEdit){
      state.subbies = alive(state.subbies).filter(isAlive).map(x=>x.id===s.id ? s : x);
    }else{
      state.subbies.unshift(s);
    }
    saveState(state);
    closeModal();
    render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  };

  $("#delS") && ($("#delS").onclick = ()=>{
    if(confirmDelete(`subbie "${s.name}"`)){
      state.subbies = softDeleteById(state.subbies, s.id);
// NOTE: soft delete handled elsewhere

      state.tasks = alive(state.tasks).filter(isAlive).map(t=> t.assignedSubbieId===s.id ? {...t, assignedSubbieId:null} : t);
      saveState(state);
      closeModal();
      render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    }
  });
}

// ----------------- Deliveries -----------------
function openDeliveryForm(seed={}){
  const isEdit = !!seed?.id;
  const d = isEdit ? seed : {
    id: uid(),
    projectId: seed.projectId || (state.projects[0]?.id || ""),
    supplier: "",
    date: new Date().toISOString().slice(0,10),
    status: "Expected",
    items: "",
    dropPoint: "",
    notes: "",
    photos: [],
    photosTaken: false,
    photosJson: "[]",
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  showModal(`
    <div class="row space">
      <h2>${isEdit ? "Edit Delivery" : "New Delivery"}</h2>
      <button class="btn" id="closeM" type="button">Close</button>
    </div>
    <label>Project</label>
    <select id="del_project" class="input">
      ${projects.map(p=>`<option value="${p.id}" ${p.id===d.projectId?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
    </select>
    <div class="grid two">
      <div>
        <label>Supplier</label>
        <input id="del_supplier" class="input" value="${escapeHtml(d.supplier||"")}" placeholder="PlaceMakers / Carters / Mitre10 / ITM / etc" />
      </div>
      <div>
        <label>Date</label>
        <input id="del_date" class="input" type="date" value="${escapeHtml(d.date||"")}" />
      </div>
    </div>
    <label>Status</label>
    <select id="del_status" class="input">
      ${["Expected","Delivered","Missing/Damaged"].map(s=>`<option ${s===d.status?"selected":""}>${s}</option>`).join("")}
    </select>
    <label>Items</label>
    <textarea id="del_items" class="input" placeholder="What’s coming / what arrived">${escapeHtml(d.items||"")}</textarea>
    <label>Drop point</label>
    <input id="del_drop" class="input" value="${escapeHtml(d.dropPoint||"")}" placeholder="Front gate / garage / upstairs / etc" />
    <label>Notes</label>
    <textarea id="del_notes" class="input">${escapeHtml(d.notes||"")}</textarea>
    <label>Photos</label>
    <input id="del_photos" class="input" type="hidden" accept="image/*" multiple />
    ${d.photos?.length ? `<div class="thumbgrid">${d.photos.map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
    <hr/>
    <div class="row space actionsSticky">
      <button class="btn primary" id="saveDel" type="button">${isEdit ? "Save" : "Create"}</button>
      <button class="btn" id="cancelDel" type="button">Cancel</button>
      ${isEdit ? `<button class="btn danger" id="delDel" type="button">Delete</button>` : ""}
    </div>
  `);
  $("#closeM").onclick = closeModal;
  $("#cancelDel").onclick = closeModal;

  $("#saveDel").onclick = async ()=>{
    const __btn = $("#saveDel");
    setBtnBusy(__btn, true);
    const __hint = showSavingHint("Saving…");
    try{
    const added = await filesToDataUrls($("#del_photos").files);
    d.projectId = $("#del_project").value;
    d.supplier = $("#del_supplier").value.trim();
    d.date = $("#del_date").value;
    d.status = $("#del_status").value;
    d.items = $("#del_items").value.trim();
    d.dropPoint = $("#del_drop").value.trim();
    d.notes = $("#del_notes").value.trim();
d.updatedAt = new Date().toISOString();
    if(!d.projectId) alert("Project required.");
    if(isEdit){
      state.deliveries = alive(state.deliveries).filter(isAlive).map(x=>x.id===d.id ? d : x);
    }else{
      state.deliveries.unshift(d);
    }
    saveState(state);
    closeModal();
    render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    } finally {
      __hint && __hint.remove();
      setBtnBusy(__btn, false);
    }

  };

  $("#delDel") && ($("#delDel").onclick = ()=>{
    if(confirmDelete(`delivery "${d.supplier||'delivery'}"`)){
      state.deliveries = softDeleteById(state.deliveries, d.id);
// NOTE: soft delete handled elsewhere

      saveState(state);
      closeModal();
      render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    }
  });
}

// ----------------- Inspections -----------------
function openInspectionForm(seed={}){
  const isEdit = !!seed?.id;
  const i = isEdit ? seed : {
    id: uid(),
    projectId: seed.projectId || (state.projects[0]?.id || ""),
    type: "Pre-line",
    date: "",
    result: "Booked",
    inspector: "",
    notes: "",
    photos: [],
    photosTaken: false,
    photosJson: "[]",
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  showModal(`
    <div class="row space">
      <h2>${isEdit ? "Edit Inspection" : "New Inspection"}</h2>
      <button class="btn" id="closeM" type="button">Close</button>
    </div>
    <label>Project</label>
    <select id="i_project" class="input">
      ${projects.map(p=>`<option value="${p.id}" ${p.id===i.projectId?"selected":""}>${escapeHtml(p.name)}</option>`).join("")}
    </select>
    <div class="grid two">
      <div>
        <label>Type</label>
        <select id="i_type" class="input">
          ${INSPECTION_TYPES_NZ.map(t=>`<option value="${escapeHtml(t)}" ${t===i.type?"selected":""}>${escapeHtml(t)}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Date</label>
        <input id="i_date" class="input" type="date" value="${escapeHtml(i.date||"")}" />
      </div>
    </div>
    <label>Result</label>
    <select id="i_result" class="input">
      ${["Booked","Pass","Fail","Conditional"].map(r=>`<option ${r===i.result?"selected":""}>${r}</option>`).join("")}
    </select>
    <label>Inspector</label>
    <input id="i_insp" class="input" value="${escapeHtml(i.inspector||"")}" placeholder="Optional" />
    <label>Notes</label>
    <textarea id="i_notes" class="input">${escapeHtml(i.notes||"")}</textarea>
    <div style="margin-top:10px">
      <label style="display:flex;align-items:center;gap:10px">
        <input id="i_photosTaken" type="checkbox" style="transform:scale(1.15)" ${ (i.photosTaken===true || (typeof i.photosJson==="string" && i.photosJson.trim() && i.photosJson.trim()!=="[]")) ? "checked" : "" } />
        <span>Photos taken</span>
      </label>
      <div class="sub">Tick if photos were taken on site (syncs via photosJson).</div>
    </div>
    <label>Photos</label>
    <input id="i_photos" class="input" type="hidden" accept="image/*" multiple />
    ${i.photos?.length ? `<div class="thumbgrid">${i.photos.map(ph=>`<div class="thumb"><img src="${ph.dataUrl}" alt="${escapeHtml(ph.name)}"/></div>`).join("")}</div>` : ""}
    <hr/>
    <div class="row space actionsSticky">
      <button class="btn primary" id="saveI" type="button">${isEdit ? "Save" : "Create"}</button>
      <button class="btn" id="cancelI" type="button">Cancel</button>
      ${isEdit ? `<button class="btn danger" id="delI" type="button">Delete</button>` : ""}
    </div>
  `);
  $("#closeM").onclick = closeModal;
  $("#cancelI").onclick = closeModal;

  $("#saveI").onclick = async ()=>{
    const __btn = $("#saveI");
    setBtnBusy(__btn, true);
    const __hint = showSavingHint("Saving…");
    try{
    const added = await filesToDataUrls($("#i_photos").files);
    i.projectId = $("#i_project").value;
    i.type = $("#i_type").value.trim();
    i.date = $("#i_date").value;
    i.result = $("#i_result").value;
    i.inspector = $("#i_insp").value.trim();
    i.notes = $("#i_notes").value.trim();
    i.photosTaken = !!$("#i_photosTaken")?.checked;
    i.photosJson = JSON.stringify(i.photosTaken ? [{taken:true, at:new Date().toISOString()}] : []);

    i.photos = [...(i.photos||[]), ...added];
    i.updatedAt = new Date().toISOString();
    if(!i.projectId) alert("Project required.");
    if(!i.type) alert("Type required.");
    if(isEdit){
      state.inspections = alive(state.inspections).filter(isAlive).map(x=>x.id===i.id ? i : x);
    }else{
      state.inspections.unshift(i);
    }
    saveState(state);
    closeModal();
    render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    } finally {
      __hint && __hint.remove();
      setBtnBusy(__btn, false);
    }

  };

  $("#delI") && ($("#delI").onclick = ()=>{
    if(confirmDelete(`inspection "${i.type}"`)){
      state.inspections = softDeleteById(state.inspections, i.id);
// NOTE: soft delete handled elsewhere

      saveState(state);
      closeModal();
      render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    }
  });
}

;
// ----------------- Reports -----------------
function openCCCPlanModal(project){
  const p = projectById(project.id || project);
  if(!p) return;
  const current = new Set(Array.isArray(p.cccPlanTypes) ? p.cccPlanTypes : []);
  const types = cccSortTypes(INSPECTION_TYPES_NZ);
  showModal(`
    <div class="modalCard">
      <div class="row space">
        <h2>CCC Planning – Applicable Inspections</h2>
        <button class="btn" id="closeM" type="button">Close</button>
      </div>
      <div class="sub">Select inspections that apply to this job. The CCC tracker will show them in recommended order. Scheduling is optional.</div>
      <hr/>
      <div class="row space">
        <button class="btn" id="cccSelectAll" type="button">Select all</button>
        <button class="btn" id="cccSelectNone" type="button">Clear</button>
      </div>
      <div class="list" id="cccTypeList" style="max-height:55vh; overflow:auto; margin-top:10px">
        ${types.map(t=>`
          <label class="item" style="display:flex; gap:10px; align-items:center">
            <input type="checkbox" class="cccTypeChk" value="${escapeHtml(t)}" ${current.has(t)?"checked":""}/>
            <div style="flex:1">
              <div class="title">${escapeHtml(t)}</div>
              <div class="meta">Included in CCC plan</div>
            </div>
          </label>
        `).join("")}
      </div>
      <hr/>
      <div class="row space">
        <div class="sub"><span id="cccCountLive">${current.size}</span> selected</div>
        <button class="btn primary" id="cccPlanSave" type="button">Save plan</button>
      </div>
    </div>
  `);
  $("#closeM").onclick = closeModal;

  function updateCount(){
    const n = $$(".cccTypeChk").filter(x=>x.checked).length;
    $("#cccCountLive").textContent = String(n);
  }
  $$(".cccTypeChk").forEach(ch=>ch.onchange = updateCount);
  updateCount();

  $("#cccSelectAll").onclick = ()=>{
    $$(".cccTypeChk").forEach(ch=>ch.checked = true);
    updateCount();
  };
  $("#cccSelectNone").onclick = ()=>{
    $$(".cccTypeChk").forEach(ch=>ch.checked = false);
    updateCount();
  };

  $("#cccPlanSave").onclick = ()=>{
    const selected = $$(".cccTypeChk").filter(x=>x.checked).map(x=>x.value);
    patchProject(p.id, { cccPlanTypes: selected });
    closeModal();
    // rerender same project tab
    navTo("project", { id: p.id, tab: "inspections" });
    render();
  };
}


function renderReports(app){
  setHeader("Reports");
  const projects = aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  app.innerHTML = `
    <div class="card">
      <div class="row space">
        <h2>Reports</h2>
        <div class="row">
          <button class="btn" id="hnryExport" type="button">Hnry Invoice Export</button>
          <button class="btn primary" id="runReport" type="button">Run Job Report</button>
        </div>
      </div>

      <div class="grid two">
        <div>
          <label>Project</label>
          <select id="r_project" class="input">
            <option value="__ALL__">All active sites (Hnry only)</option>
${projects.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
          </select>
        </div>
        <div></div>
      </div>

      <div class="grid two">
        <div>
          <label>Date from</label>
          <input id="r_from" class="input" type="date" value="${new Date(Date.now()-7*86400000).toISOString().slice(0,10)}" />
        </div>
        <div>
          <label>Date to</label>
          <input id="r_to" class="input" type="date" value="${new Date().toISOString().slice(0,10)}" />
        </div>
      </div>

      <div class="row" style="gap:10px; align-items:center; margin-top:10px">
        <label class="row" style="gap:8px; align-items:center">
          <input id="r_alltime" type="checkbox" />
          <span><strong>All time</strong></span>
        </label>
        <span class="sub">Ignore the date range and include everything for that project.</span>
      </div>

      <hr/>
      <div style="font-weight:800; margin-bottom:8px">Include in Job Report</div>
      <div class="grid two" style="gap:10px">
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_summary" type="checkbox" checked/> <span>Project summary</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_diary" type="checkbox" checked/> <span>Diary</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_tasks" type="checkbox" checked/> <span>Tasks (open & completed)</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_variations" type="checkbox" checked/> <span>Variations</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_deliveries" type="checkbox" checked/> <span>Deliveries</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_inspections" type="checkbox" checked/> <span>Inspections</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_leads" type="checkbox" checked/> <span>Leads</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_programme" type="checkbox" checked/> <span>Programme</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_equipment" type="checkbox" checked/> <span>Equipment (assigned/logs)</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_fleet" type="checkbox" checked/> <span>Fleet (assigned/logs)</span></label>
        <label class="row" style="gap:8px; align-items:center"><input id="r_inc_activity" type="checkbox" checked/> <span>Activity log</span></label>
        <div></div>
      </div>

      <div class="sub" style="margin-top:10px">Reports open in a printable preview. Use your browser share/print to save as PDF.</div>
    </div>
  `;

  const syncRangeUI = ()=>{
    const all = $("#r_alltime").checked;
    $("#r_from").disabled = all;
    $("#r_to").disabled = all;
    $("#r_from").style.opacity = all ? "0.55" : "1";
    $("#r_to").style.opacity = all ? "0.55" : "1";
  };
  $("#r_alltime").onchange = syncRangeUI;
  syncRangeUI();

  $("#runReport").onclick = ()=>{
    const pid = $("#r_project").value;
    if(pid==="__ALL__"){ alert("Select a specific project for Job Report."); return; }

    const opts = {
      allTime: $("#r_alltime").checked,
      sections: {
        summary: $("#r_inc_summary").checked,
        diary: $("#r_inc_diary").checked,
        tasks: $("#r_inc_tasks").checked,
        variations: $("#r_inc_variations").checked,
        deliveries: $("#r_inc_deliveries").checked,
        inspections: $("#r_inc_inspections").checked,
        leads: $("#r_inc_leads").checked,
        programme: $("#r_inc_programme").checked,
        equipment: $("#r_inc_equipment").checked,
        fleet: $("#r_inc_fleet").checked,
        activity: $("#r_inc_activity").checked
      }
    };

    runReportUI(pid, opts.allTime ? null : $("#r_from").value, opts.allTime ? null : $("#r_to").value, opts);
  };

  $("#hnryExport").onclick = ()=>{
    const pid = $("#r_project").value;
    runHnryExportUI(pid, $("#r_from").value, $("#r_to").value);
  };

  // HNRY SIMPLE export binding (override after render)
  const hnryBtn = document.getElementById("hnryExport");
  if(hnryBtn){
    hnryBtn.onclick = () => {
      runHnryDiaryExportSimple(
        document.getElementById("r_project").value,
        document.getElementById("r_from").value,
        document.getElementById("r_to").value
      );
    };
  }
}


function runReportUI(projectId, from=null, to=null, opts=null){
  const p = projectById(projectId);
  if(!p) return;

  const sections = (opts && opts.sections) ? opts.sections : {
    summary:true, diary:true, tasks:true, variations:true, deliveries:true, inspections:true, leads:true, programme:true, equipment:true, fleet:true, activity:true
  };

  const allTime = !!(opts && opts.allTime);
  const rangeFrom = allTime ? "0000-01-01" : (from || new Date(Date.now()-7*86400000).toISOString().slice(0,10));
  const rangeTo = allTime ? "9999-12-31" : (to || new Date().toISOString().slice(0,10));

  const inRange = (d)=> {
    const x = (d||"").slice(0,10);
    if(!x) return false;
    return x>=rangeFrom && x<=rangeTo;
  };

  // Pull data (only compute what we need)
  const tasks = sections.tasks ? alive(state.tasks).filter(t=>t.projectId===projectId && isAlive(t)) : [];
  const diary = sections.diary ? alive(state.diary).filter(d=>d.projectId===projectId && isAlive(d)).filter(d=> inRange(d.date)).sort((a,b)=>(a.date||"").localeCompare(b.date||"")) : [];
  const vars = sections.variations ? alive(state.variations).filter(v=>v.projectId===projectId && isAlive(v)).filter(v=> inRange(v.date||"")) : [];
  const delivs = sections.deliveries ? alive(state.deliveries).filter(d=>d.projectId===projectId && isAlive(d)).filter(d=> inRange(d.date||"")) : [];
  const insps = sections.inspections ? alive(state.inspections).filter(i=>i.projectId===projectId && isAlive(i)).filter(i=> inRange(i.date||"")) : [];
  const leads = sections.leads ? alive(state.leads).filter(l=>l.projectId===projectId && isAlive(l)).filter(l=> inRange(l.date||l.createdAt||"") || allTime) : [];

  // Programme tasks/history
  const programmeTasks = sections.programme ? aliveArr(state.programmeTasks).filter(t=>t.projectId===projectId && isAlive(t)) : [];
  const programmeStats = sections.programme ? aliveArr(state.programmeHistoryStats).filter(s=>s.projectId===projectId && isAlive(s)).filter(s=> inRange(s.date||"") || allTime) : [];

  // Equipment/Fleet logs (best-effort - schema varies)
  const equipment = sections.equipment ? aliveArr(state.equipment).filter(e=> (e.projectId===projectId || e.assignedProjectId===projectId) && isAlive(e)) : [];
  const equipmentLogs = sections.equipment ? aliveArr(state.equipmentLogs).filter(l=> l.projectId===projectId && isAlive(l)).filter(l=> inRange(l.date||l.createdAt||"") || allTime) : [];

  const fleet = sections.fleet ? aliveArr(state.fleet).filter(v=> (v.projectId===projectId || v.assignedProjectId===projectId) && isAlive(v)) : [];
  const fleetLogs = sections.fleet ? aliveArr(state.fleetLogs).filter(l=> l.projectId===projectId && isAlive(l)).filter(l=> inRange(l.date||l.createdAt||"") || allTime) : [];

  const activity = sections.activity ? aliveArr(state.activityLog).filter(a=> (a.projectId===projectId || a.pid===projectId) && isAlive(a)).filter(a=> inRange(a.date||a.createdAt||"") || allTime) : [];

// Activity helpers (details can be objects; include worker attribution if available)
const activityWorker = (a)=>{
  const n = a.workerName || a.byName || a.userName || a.enteredByName || "";
  if(n) return n;
  const wid = a.workerId || a.byId || a.userId || a.enteredById || "";
  const w = wid ? workerById(wid) : null;
  return (w && w.name) ? w.name : (a.by || "");
};
const activityDetailsText = (a)=>{
  const cand = a.details ?? a.detail ?? a.note ?? a.summary ?? a.meta ?? a.data ?? a.changes ?? a.payload ?? "";
  if(cand && typeof cand === "object"){
    try{ return JSON.stringify(cand); }catch(_){ return String(cand); }
  }
  if(String(cand||"").trim()) return String(cand);

  // Fallback: stringify remaining fields (excluding common headers)
  try{
    const skip = new Set(["id","at","createdAt","date","projectId","pid","action","type","workerId","workerName","by","byId","byName","userId","userName","enteredById","enteredByName"]);
    const o = {};
    Object.keys(a||{}).forEach(k=>{ if(!skip.has(k)) o[k]=a[k]; });
    const s = JSON.stringify(o);
    return s && s !== "{}" ? s : "";
  }catch(_){ return ""; }
};

  // --- Build sections HTML ---

  const blocks = [];

  // Header / cover
  blocks.push(`
    <div class="card printOnly" style="padding:18px">
      <div style="display:flex; gap:14px; align-items:center">
        <img src="./logo.png" alt="logo" style="height:44px; width:auto"/>
        <div>
          <div style="font-size:18px; font-weight:900">${escapeHtml(settings.companyName)}</div>
          <div style="color:var(--muted); font-size:12px">${escapeHtml(p.name)} • ${escapeHtml(p.address||"")}</div>
        </div>
      </div>
    </div>
  `);

  // Report top card
  blocks.push(`
    <div class="card">
      <div class="row space">
        <h2>Job Report</h2>
        <div class="row noPrint">
          <button class="btn" id="copyLink" type="button">Copy</button>
          <button class="btn primary" id="printBtn" type="button">Print / Save PDF</button>
        </div>
      </div>
      <div class="sub">${escapeHtml(p.name)} • ${escapeHtml(p.address||"")}<br/>Period: ${allTime ? "All time" : `${dateFmt(rangeFrom)} → ${dateFmt(rangeTo)}`}</div>
    </div>
  `);

  if(sections.summary){
    const rows = [];
    const add = (label, val)=>{ if(val!==undefined && val!==null && String(val).trim()!=="") rows.push(`<tr><th style="text-align:left; width:170px">${escapeHtml(label)}</th><td>${escapeHtml(String(val))}</td></tr>`); };
    add("Project", p.name);
    add("Address", p.address);
    add("Status", p.status);
    add("Client", p.clientName || p.client);
    add("Client phone", p.clientPhone || p.phone);
    add("Client email", p.clientEmail || p.email);
    add("Start date", p.startDate ? dateFmt(p.startDate) : "");
    add("Due date", p.dueDate ? dateFmt(p.dueDate) : "");
    add("Notes", p.notes);
    blocks.push(`
      <div class="card">
        <h2>Project summary</h2>
        ${rows.length ? `<table><tbody>${rows.join("")}</tbody></table>` : `<div class="sub">No project details saved.</div>`}
      </div>
    `);
  }

  if(sections.diary){
    blocks.push(`
      <div class="card">
        <h2>Diary</h2>
        ${diary.length ? diary.map(d=>{
          const who = d.enteredBy || d.workerName || d.createdBy || d.user || "";
          const whoBadge = who ? `<span class="badge">👤 ${escapeHtml(String(who))}</span>` : "";
          return `
            <div class="item">
              <div class="row space">
                <div>
                  <strong>${dateFmt(d.date)}</strong>
                  ${d.billable?`<span class="badge ok">Billable</span>`:`<span class="badge">Non‑billable</span>`}
                  ${d.hours?`<span class="badge">⏱ ${escapeHtml(String(d.hours))}h</span>`:""}
                  ${whoBadge}
                </div>
                <div class="smallmuted">${escapeHtml(d.category||"")}</div>
              </div>
              <div class="meta">${escapeHtml(d.summary||"")}</div>
            </div>
          `;
        }).join("") : `<div class="sub">No diary entries${allTime ? "." : " in range."}</div>`}
      </div>
    `);
  }

  if(sections.tasks){
    const openTasks = tasks.filter(t=> (t.status||"")!=="Done");
    const doneTasks = tasks.filter(t=> (t.status||"")==="Done");
    const renderTaskTable = (arr)=> arr.length ? `
      <table>
        <thead><tr><th>Task</th><th>Status</th><th>Due</th><th>Assigned</th></tr></thead>
        <tbody>
          ${arr.map(t=>{
            const s = t.assignedSubbieId ? subbieById(t.assignedSubbieId) : null;
            return `<tr><td>${escapeHtml(t.title||"")}</td><td>${escapeHtml(t.status||"")}</td><td>${t.dueDate?escapeHtml(dateFmt(t.dueDate)):""}</td><td>${s?escapeHtml(s.name):escapeHtml(t.assignedTo||"")}</td></tr>`;
          }).join("")}
        </tbody>
      </table>` : `<div class="sub">None.</div>`;
    blocks.push(`
      <div class="card">
        <h2>Tasks</h2>
        <div class="sub">Open</div>
        ${renderTaskTable(openTasks)}
        <hr/>
        <div class="sub">Completed</div>
        ${renderTaskTable(doneTasks)}
      </div>
    `);
  }

  if(sections.variations){
    blocks.push(`
      <div class="card">
        <h2>Variations</h2>
        ${vars.length ? `
          <table>
            <thead><tr><th>Title</th><th>Status</th><th>Date</th><th>Amount</th></tr></thead>
            <tbody>
              ${vars.map(v=>`<tr><td>${escapeHtml(v.title||"")}</td><td>${escapeHtml(v.status||"")}</td><td>${v.date?escapeHtml(dateFmt(v.date)):""}</td><td>${v.amount?escapeHtml(money(v.amount)):""}</td></tr>`).join("")}
            </tbody>
          </table>` : `<div class="sub">No variations${allTime ? "." : " in range."}</div>`}
      </div>
    `);
  }

  if(sections.deliveries){
    blocks.push(`
      <div class="card">
        <h2>Deliveries</h2>
        ${delivs.length ? `
          <table>
            <thead><tr><th>Supplier</th><th>Date</th><th>Status</th><th>Items</th></tr></thead>
            <tbody>
              ${delivs.map(d=>`<tr><td>${escapeHtml(d.supplier||"")}</td><td>${d.date?escapeHtml(dateFmt(d.date)):""}</td><td>${escapeHtml(d.status||"")}</td><td>${escapeHtml((d.items||"").slice(0,180))}</td></tr>`).join("")}
            </tbody>
          </table>` : `<div class="sub">No deliveries${allTime ? "." : " in range."}</div>`}
      </div>
    `);
  }

  if(sections.inspections){
    blocks.push(`
      <div class="card">
        <h2>Inspections</h2>
        ${insps.length ? `
          <table>
            <thead><tr><th>Type</th><th>Date</th><th>Result</th><th>Notes</th></tr></thead>
            <tbody>
              ${insps.map(i=>`<tr><td>${escapeHtml(i.type||"")}</td><td>${i.date?escapeHtml(dateFmt(i.date)):""}</td><td>${escapeHtml(i.result||"")}</td><td>${escapeHtml((i.notes||"").slice(0,180))}</td></tr>`).join("")}
            </tbody>
          </table>` : `<div class="sub">No inspections${allTime ? "." : " in range."}</div>`}
      </div>
    `);
  }

  if(sections.leads){
    blocks.push(`
      <div class="card">
        <h2>Leads</h2>
        ${leads.length ? `
          <table>
            <thead><tr><th>Date</th><th>Name</th><th>Stage</th><th>Notes</th></tr></thead>
            <tbody>
              ${leads.map(l=>`<tr><td>${escapeHtml(l.date?dateFmt(l.date):"")}</td><td>${escapeHtml(l.name||"")}</td><td>${escapeHtml(l.stage||l.status||"")}</td><td>${escapeHtml((l.notes||l.summary||"").slice(0,180))}</td></tr>`).join("")}
            </tbody>
          </table>` : `<div class="sub">No leads${allTime ? "." : " in range."}</div>`}
      </div>
    `);
  }

  if(sections.programme){
    blocks.push(`
      <div class="card">
        <h2>Programme</h2>
        ${programmeTasks.length ? `
          <table>
            <thead><tr><th>Task</th><th>Phase</th><th>Status</th><th>Start</th><th>Due</th></tr></thead>
            <tbody>
              ${programmeTasks.map(t=>`<tr><td>${escapeHtml(t.name||t.title||"")}</td><td>${escapeHtml(t.phase||"")}</td><td>${escapeHtml(t.status||"")}</td><td>${t.startDate?escapeHtml(dateFmt(t.startDate)):""}</td><td>${t.dueDate?escapeHtml(dateFmt(t.dueDate)):""}</td></tr>`).join("")}
            </tbody>
          </table>` : `<div class="sub">No programme tasks saved.</div>`}
        ${programmeStats.length ? `
          <hr/>
          <div class="sub">History / snapshots</div>
          <table>
            <thead><tr><th>Date</th><th>Summary</th></tr></thead>
            <tbody>
              ${programmeStats.map(s=>`<tr><td>${escapeHtml(s.date?dateFmt(s.date):"")}</td><td>${escapeHtml((s.summary||JSON.stringify(s)).slice(0,220))}</td></tr>`).join("")}
            </tbody>
          </table>` : ``}
      </div>
    `);
  }

  if(sections.equipment){
    blocks.push(`
      <div class="card">
        <h2>Equipment</h2>
        ${equipment.length ? `
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              ${equipment.map(e=>`<tr><td>${escapeHtml(e.name||"")}</td><td>${escapeHtml(e.type||"")}</td><td>${escapeHtml(e.status||"")}</td><td>${escapeHtml((e.notes||"").slice(0,160))}</td></tr>`).join("")}
            </tbody>
          </table>` : `<div class="sub">No equipment linked to this project.</div>`}
        ${equipmentLogs.length ? `
          <hr/>
          <div class="sub">Logs</div>
          <table>
            <thead><tr><th>Date</th><th>Item</th><th>Entry</th></tr></thead>
            <tbody>
              ${equipmentLogs.map(l=>`<tr><td>${escapeHtml(l.date?dateFmt(l.date):"")}</td><td>${escapeHtml(l.item||l.equipmentName||"")}</td><td>${escapeHtml((l.notes||l.entry||l.summary||"").slice(0,200))}</td></tr>`).join("")}
            </tbody>
          </table>` : ``}
      </div>
    `);
  }

  if(sections.fleet){
    blocks.push(`
      <div class="card">
        <h2>Fleet</h2>
        ${fleet.length ? `
          <table>
            <thead><tr><th>Vehicle</th><th>Type</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              ${fleet.map(v=>`<tr><td>${escapeHtml(v.name||v.vehicle||"")}</td><td>${escapeHtml(v.type||"")}</td><td>${escapeHtml(v.status||"")}</td><td>${escapeHtml((v.notes||"").slice(0,160))}</td></tr>`).join("")}
            </tbody>
          </table>` : `<div class="sub">No fleet linked to this project.</div>`}
        ${fleetLogs.length ? `
          <hr/>
          <div class="sub">Logs</div>
          <table>
            <thead><tr><th>Date</th><th>Vehicle</th><th>Entry</th></tr></thead>
            <tbody>
              ${fleetLogs.map(l=>`<tr><td>${escapeHtml(l.date?dateFmt(l.date):"")}</td><td>${escapeHtml(l.vehicle||l.name||"")}</td><td>${escapeHtml((l.notes||l.entry||l.summary||"").slice(0,200))}</td></tr>`).join("")}
            </tbody>
          </table>` : ``}
      </div>
    `);
  }

  if(sections.activity){
    blocks.push(`
      <div class="card">
        <h2>Activity log</h2>
        ${activity.length ? `
          <table>
            <thead><tr><th>Date</th><th>Worker</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              ${activity.sort((a,b)=>(a.date||a.createdAt||a.at||"").localeCompare(b.date||b.createdAt||b.at||"")).map(a=>{
                const d = a.date || a.createdAt || a.at || "";
                const who = activityWorker(a) || "—";
                const det = activityDetailsText(a);
                return `<tr>
                  <td>${escapeHtml(d ? dateFmt(d) : "")}</td>
                  <td>${escapeHtml(who)}</td>
                  <td>${escapeHtml(a.action||a.type||"")}</td>
                  <td>${escapeHtml((det||"").slice(0,900))}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>` : `<div class="sub">No activity logged${allTime ? "." : " in range."}</div>`}
      </div>
    `);
  }

  // Footer
  blocks.push(`
    <div class="card">
      <div class="smallmuted">Generated ${new Date().toLocaleString("en-NZ")}</div>
    </div>
  `);

  const html = blocks.join("\n");

  showModal(html);
  $("#copyLink").onclick = async ()=>{
    try{
      await navigator.clipboard.writeText(`Job Report: ${p.name} (${allTime ? "All time" : (rangeFrom + " to " + rangeTo)})`);
      alert("Copied.");
    }catch(e){ alert("Copy failed."); }
  };
  $("#printBtn").onclick = ()=> printModalOnly("Job Report");
}

function runHnryExportUI(projectId, from=null, to=null){
  const rangeFrom = from || new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const rangeTo = to || new Date().toISOString().slice(0,10);

  const isAll = projectId === "__ALL__";
  const p = isAll ? null : projectById(projectId);
  if(!isAll && !p) return;

  const diary = aliveArr(state.diary)
    .filter(d=>d.projectId===projectId && isAlive(d))
    .filter(d=>d.date>=rangeFrom && d.date<=rangeTo)
    .filter(d=>d.billable)
    .sort((a,b)=>(a.date||"").localeCompare(b.date||""));

  const totalBillableHours = diary.reduce((s,d)=> s + Number(d.hours || 0), 0);
  const labourHours = diary.filter(d=> (d.category||'')==='Labour').reduce((s,d)=> s + Number(d.hours || 0), 0);


  // Summarise into line items by category
  const lines = {};
  for(const d of diary){
    const cat = d.category || "Other";
    if(!lines[cat]) lines[cat] = { hours:0, amount:0, notes:[] };
    const hrs = Number(d.hours || 0);
    const rate = d.rate ? Number(d.rate) : (cat==="Labour" ? Number(settings.labourRate||0) : 0);
    lines[cat].hours += hrs;
    // amount: if materials/travel etc and no hours, interpret d.rate as amount if provided
    if(cat==="Labour"){
      lines[cat].amount += hrs * rate;
    }else{
      const amt = d.rate ? Number(d.rate) : 0;
      lines[cat].amount += amt;
    }
    if(d.summary) lines[cat].notes.push(d.summary);
  }

  const outLines = Object.entries(lines).map(([cat,v])=>{
    if(cat==="Labour"){
      return `${settings.companyName} – ${p.name}\n${cat} (${v.hours.toFixed(2)} hrs)    ${money(v.amount)}`;
    }
    return `${cat}    ${money(v.amount)}`;
  });

  
// Labour: break down hours by day (requested for Hnry)
const labourByDay = {};
for(const d of diary){
  if((d.category||"")!=="Labour") continue;
  const day = (d.date||"").slice(0,10);
  if(!labourByDay[day]) labourByDay[day] = { hours:0, amount:0, notes:[] };
  const hrs = Number(d.hours||0);
  const rate = d.rate ? Number(d.rate) : Number(settings.labourRate||0);
  labourByDay[day].hours += hrs;
  labourByDay[day].amount += hrs * rate;
  if(d.summary) labourByDay[day].notes.push(d.summary);
}

const total = Object.values(lines).reduce((s,v)=> s + (v.amount||0), 0);

  const block = [
    settings.companyName,
    `Project: ${isAll ? "All active sites" : p.name}`,
    isAll ? "" : (isAll ? "" : (p.address ? `Address: ${p.address}` : "")),
    `Period: ${rangeFrom} to ${rangeTo}`,
    "",
    ...(Object.keys(labourByDay).length ? ["Labour (hours by day):", ...Object.entries(labourByDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([day,v])=>`  ${day}  ${v.hours.toFixed(2)} hrs    ${money(v.amount)}`), ""] : []),
    "",
    ...(Object.keys(labourByDay).length ? ["Labour (hours by day):", ...Object.entries(labourByDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([day,v])=>`  ${day}  ${v.hours.toFixed(2)} hrs    ${money(v.amount)}`), ""] : []),
    "",
    ...Object.entries(lines).map(([cat,v])=>{
      if(cat==="Labour") return `Site labour – ${isAll ? "All sites" : p.name} (see daily breakdown below)    ${money(v.amount)}`;
      return `${cat}    ${money(v.amount)}`;
    }),
    "",
    `Total billable hours:    ${totalBillableHours.toFixed(2)} h`,
    `Labour hours:    ${labourHours.toFixed(2)} h`,
    `Total (ex GST):    ${money(total)}`
  ].filter(Boolean).join("\n");

  showModal(`
    <div class="row space">
      <h2>Hnry Invoice Export</h2>
      <div class="row">
        <button class="btn" id="copyH" type="button">Copy</button>
        <button class="btn" id="closeM" type="button">Close</button>
      </div>
    </div>
    <div class="sub">Copy/paste into Hnry invoice line items. Uses billable diary entries only.</div>
    <hr/>
    <textarea class="input" id="hnryBlock" style="min-height:260px">${escapeHtml(block)}</textarea>
    <div class="smallmuted">Billable hours: <strong>${totalBillableHours.toFixed(2)}h</strong> (Labour: ${labourHours.toFixed(2)}h). Tip: set your default labour rate in Settings.</div>
  `);
  $("#closeM").onclick = closeModal;
  $("#copyH").onclick = async ()=>{
    try{
      await navigator.clipboard.writeText(block);
      alert("Copied.");
    }catch(e){
      alert("Copy failed.");
    }
  };
}

// ----------------- Settings -----------------
function renderSettings(app){
  setHeader("Settings");
  updateAppUpdateStamp();

  app.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div class="row space">
          <h3>App refresh</h3>
          <span class="sub">If updates don’t come through, use this to force the newest GitHub build.</span>
        </div>
        <div class="row" style="gap:10px; flex-wrap:wrap">
        <select class="input" id="projStageFilter" style="min-width:180px">
          <option value="">All stages</option>
          ${PROJECT_STAGES.map(s=>`<option value="${s}">${s}</option>`).join("")}
        </select>
          <button class="btn" id="btnCheckUpdate" type="button">Check for update</button>
          <button class="btn danger" id="btnForceRefresh" type="button">Force refresh (update)</button>
        </div>
        <div class="smallmuted" style="margin-top:8px">
          Force refresh clears the PWA cache & service worker but keeps your local data (IndexedDB).
        </div>
        <div class="sub" id="appUpdateStamp" style="margin-top:8px">Last app update: —</div>
      </div>

    <div class="grid two">

      <div class="card">
        <h2>Google Sheets sync</h2>
        <div class="sub">Sync everything (projects, tasks, diary, variations, deliveries, inspections, H&amp;S, equipment, leads, and worker profiles).</div>
        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <button class="btn primary" id="settingsSyncBtn" type="button">Sync now</button>
          <button class="btn" id="settingsDownloadOnlyBtn" type="button">Download only</button>
        </div>
        <div class="smallmuted" id="settingsSyncStatus" style="margin-top:8px">Last synced: —</div>
      </div>
      

      <div class="card">
        <h2>Appearance</h2>
        <label>Theme</label>
        <select id="set_theme" class="input">
          <option value="dark" ${settings.theme==="dark"?"selected":""}>Dark (default)</option>
          <option value="light" ${settings.theme==="light"?"selected":""}>Light</option>
        </select>
        <hr/>
        <h2>Business</h2>
        <label>Company name</label>
        <input id="set_company" class="input" value="${escapeHtml(settings.companyName||"")}" />
        <label>Default labour rate (NZD/hr)</label>
        <input id="set_rate" class="input" type="number" step="0.01" value="${escapeHtml(String(settings.labourRate||""))}" />
        <div class="smallmuted">Logo is loaded from the root file: <strong>./logo.png</strong></div>
        <hr/>
        <button class="btn primary" id="saveSettings" type="button">Save settings</button>
      </div>
      <div class="card">
        <h2>Data</h2>
        <div class="sub">
          This app stores everything locally on your device (IndexedDB).<br/>
          Use Export/Import for backups or moving phones.
        </div>
        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <button class="btn" id="exportBtn" type="button">Export</button>
          <button class="btn" id="importBtn" type="button">Import</button>
        </div>
        <hr/>
        <button class="btn danger" id="wipeBtn" type="button">Wipe all data</button>
      </div>

      <div class="card">
        <h2>Worker profiles</h2>
        <div class="sub">Enable Worker mode to restrict what each profile can access and which forms they can edit.</div>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px">
          <label class="row" style="gap:8px; align-items:center">
            <input type="checkbox" id="wm_enabled" ${settings.workerMode?.enabled ? "checked":""} />
            <span>Worker mode</span>
          </label>
          <label class="row" style="gap:8px; align-items:center">
            <input type="checkbox" id="wm_requirePin" ${settings.workerMode?.requirePin ? "checked":""} />
            <span>Require PIN (if set)</span>
          </label>
        </div>

        <div class="row space" style="margin-top:12px">
          <div class="h">Profiles</div>
          <button class="btn" id="wm_add" type="button">Add worker</button>
        </div>

        <div class="list" id="wm_list" style="margin-top:10px"></div>
        <div class="smallmuted" style="margin-top:8px">Tip: keep an Admin profile so you can always access Settings.</div>
      </div>

      <hr/>
      <div class="h">Deleted Jobs</div>
      <div id="deletedProjects" class="list" style="margin-top:8px"></div>
</div>
  `;

  $("#saveSettings").onclick = ()=>{
    settings.theme = $("#set_theme").value;
    settings.companyName = $("#set_company").value.trim() || "Matty Campbell Building";
    settings.labourRate = Number($("#set_rate").value || 0);
    saveSettings(settings);
    applyTheme();
    alert("Saved.");
  };
  $("#wipeBtn").onclick = ()=>{
    if(confirm("Wipe ALL app data? This can't be undone.")){
      state = defaults();
      saveState(state);
      alert("Wiped.");
      navTo("projects");
    }
  };

  // Settings page: bind Export/Import buttons
  try{ bindImportExportButtons(); }catch(e){}
  try{ bindWorkerSettingsUI(); }catch(e){}
  // Google Sheets Sync (Settings)
  try{

    const btn = document.getElementById("settingsSyncBtn");
    const dl = document.getElementById("settingsDownloadOnlyBtn");
    if(btn) btn.onclick = ()=> syncNowAll();
    if(dl) dl.onclick = ()=> downloadOnlyAll();

    const st = document.getElementById("settingsSyncStatus");
    if(st) st.textContent = "Last synced: " + formatLastSync();
  }catch(e){}

  setTimeout(()=>{ try{ renderDeletedProjectsUI(); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}
 }, 0);

  // Settings: update helpers
  const _bfu = document.getElementById("btnForceRefresh");
  if(_bfu) _bfu.onclick = ()=>forceRefreshApp();
  const _bcu = document.getElementById("btnCheckUpdate");
  if(_bcu) _bcu.onclick = async ()=>{ await checkForUpdate(); alert("Checked for update. If one is available, reload the app."); };
}



/* ===== GOOGLE SHEETS SYNC (V3) =====
   - Push + pull all business tables + worker profiles (pinHash)
   - Requires an Apps Script endpoint that understands {key, action:"push"/"pull", full:true, payload:{...}}
*/
function getLastSync(){ try{ return localStorage.getItem("mcb_last_sync") || ""; }catch(e){ return ""; } }
function setLastSync(iso){ try{ localStorage.setItem("mcb_last_sync", iso || ""); }catch(e){} }
function formatLastSync(){
  const iso = getLastSync();
  if(!iso) return "—";
  try{ return fmtNZDateTime(iso); }catch(e){ return iso; }
}

function mergeById(local = [], remote = []){
  const map = new Map();
  (local || []).forEach(item => { if(item && item.id) map.set(item.id, item); });

  (remote || []).forEach(item => {
    if(!item || !item.id) return;
    const existing = map.get(item.id);

    // If either side is a tombstone, prefer the tombstone (prevents resurrection from clock skew)
    if(existing && existing.deletedAt && !item.deletedAt){
      map.set(item.id, existing);
      return;
    }
    if(item.deletedAt){
      map.set(item.id, item);
      return;
    }

    if(!existing){
      map.set(item.id, item);
      return;
    }

    const lt = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const rt = new Date(item.updatedAt || item.createdAt || 0).getTime();
    map.set(item.id, rt > lt ? item : existing);
  });

  return Array.from(map.values());
}

function _cleanSettingsForSync(){
  // Sync only the settings that should be shared across devices.
  // Keep device-local fields (currentWorkerId, theme) local.
  const wm = settings.workerMode || { enabled:false, currentWorkerId:"", requirePin:false };
  return {
    companyName: settings.companyName || "Matty Campbell Building",
    labourRate: Number(settings.labourRate || 0),
    currency: settings.currency || "NZD",
    workerMode: { enabled: !!wm.enabled, requirePin: !!wm.requirePin },
    workers: (settings.workers||[]).map(w=>{
      if(!w || typeof w!=="object") return null;
      const nw = { ...w };
      // Ensure no raw pin leaks
      if("pin" in nw) delete nw.pin;
      // Enforce pinHash field
      nw.pinHash = String(nw.pinHash||"");
      return nw;
    }).filter(Boolean)
  };
}

function _applySyncedSettings(s){
  if(!s || typeof s!=="object") return;
  settings.companyName = s.companyName || settings.companyName;
  settings.labourRate = Number(s.labourRate ?? settings.labourRate ?? 0);
  settings.currency = s.currency || settings.currency;

  settings.workerMode = settings.workerMode || { enabled:false, currentWorkerId:"", requirePin:false };
  settings.workerMode.enabled = !!(s.workerMode && s.workerMode.enabled);
  settings.workerMode.requirePin = !!(s.workerMode && s.workerMode.requirePin);

  // Merge workers by id
  const local = (settings.workers||[]).map(w=>{ const nw={...w}; if("pin" in nw) delete nw.pin; return nw; });
  const remote = (s.workers||[]).map(w=>{ const nw={...w}; if("pin" in nw) delete nw.pin; return nw; });
  settings.workers = mergeById(local, remote);

  // Keep currentWorkerId local (device choice), but ensure it's valid
  const cid = settings.workerMode.currentWorkerId || "";
  if(cid && !settings.workers.some(w=>w && w.id===cid)){
    settings.workerMode.currentWorkerId = settings.workers[0]?.id || "";
  }
  saveSettings(settings);
  try{ updateNavVisibility(); }catch(e){}
}

function _buildSyncPayload(){
  return {
    Projects: (state.projects||[]),
    Tasks: (state.tasks||[]),
    Diary: (state.diary||[]),
    Variations: (state.variations||[]),
    Deliveries: (state.deliveries||[]),
    Inspections: (state.inspections||[]),
    Leads: (state.leads||[]),
    Subbies: (state.subbies||[]),
    ProgrammeTasks: (state.programmeTasks||[]),
    ProgrammeHistoryStats: (state.programmeHistoryStats||[]),
    Equipment: (state.equipment||[]),
    EquipmentLogs: (state.equipmentLogs||[]),
    Fleet: (state.fleet||[]),
    FleetLogs: (state.fleetLogs||[]),
    HSProfiles: (state.hsProfiles||[]),
    HSInductions: (state.hsInductions||[]),
    HSHazards: (state.hsHazards||[]),
    HSToolboxes: (state.hsToolboxes||[]),
    HSIncidents: (state.hsIncidents||[]),
    ActivityLog: (state.activityLog||[]),
    Settings: _cleanSettingsForSync()
  };
}

function _applyPulledData(data){
  const pick = (name)=> data?.[name] ?? data?.[name.toLowerCase()] ?? data?.[name.toUpperCase()] ?? null;

  const mergeTable = (key, stateKey)=>{
    const remote = pick(key);
    if(Array.isArray(remote)){
      const local = aliveArr(state[stateKey]);
      state[stateKey] = mergeById(local, remote);
      return true;
    }
    return false;
  };

  let any = false;
  any = mergeTable("Projects","projects") || any;
  any = mergeTable("Tasks","tasks") || any;
  any = mergeTable("Diary","diary") || any;
  any = mergeTable("Variations","variations") || any;
  any = mergeTable("Deliveries","deliveries") || any;
  any = mergeTable("Inspections","inspections") || any;
  any = mergeTable("Leads","leads") || any;
  any = mergeTable("Subbies","subbies") || any;
  any = mergeTable("ProgrammeTasks","programmeTasks") || any;
  any = mergeTable("ProgrammeHistoryStats","programmeHistoryStats") || any;
  any = mergeTable("Equipment","equipment") || any;
  any = mergeTable("EquipmentLogs","equipmentLogs") || any;
  any = mergeTable("Fleet","fleet") || any;
  any = mergeTable("FleetLogs","fleetLogs") || any;
  any = mergeTable("HSProfiles","hsProfiles") || any;
  any = mergeTable("HSInductions","hsInductions") || any;
  any = mergeTable("HSHazards","hsHazards") || any;
  any = mergeTable("HSToolboxes","hsToolboxes") || any;
  any = mergeTable("HSIncidents","hsIncidents") || any;
  any = mergeTable("ActivityLog","activityLog") || any;

  const s = pick("Settings");
  if(s) { _applySyncedSettings(s); any = true; }

  if(any){
    saveState(state);
    try{ applyStateMigrations(); }catch(e){}
  }
  return any;
}

async function _syncRequest(action){
  if(!settings.sync) settings.sync = { url:"", key:"" };
  const url = String(settings.sync.url||"").trim();
  const key = String(settings.sync.key||"").trim();
  if(!url || !key) throw new Error("Set Apps Script URL and Company key in Settings first.");

  const payload = (action==="push") ? _buildSyncPayload() : null;

  const resp = await fetch(url, {
    method:"POST",
    headers: {"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify({
      key,
      action,
      lastSync: getLastSync() || null,
      full: true,
      payload
    })
  });

  const text = await resp.text();
  let json;
  try{ json = JSON.parse(text); }
  catch(e){ throw new Error("Non-JSON response: " + text.slice(0,200)); }
  if(json.error) throw new Error(json.error);

  return json;
}

async function syncNowAll(){
  const btn = document.getElementById("settingsSyncBtn");
  const dl = document.getElementById("settingsDownloadOnlyBtn");
  const status = document.getElementById("settingsSyncStatus");
  try{
    if(btn) btn.disabled = true;
    if(dl) dl.disabled = true;
    if(status) status.textContent = "Syncing…";

    // Push local snapshot then pull merged snapshot
    const pushed = await _syncRequest("push");
    const pulled = await _syncRequest("pull");
    const data = pulled.data || pulled.payload || pulled;
    const workersOnServer = (data && data.Settings && Array.isArray(data.Settings.workers)) ? data.Settings.workers.length : null;
    _applyPulledData(data);

    setLastSync(pulled.serverTime || data.serverTime || new Date().toISOString());
    if(status) status.textContent = "Last synced: " + formatLastSync();
    toast("Synced" + (workersOnServer!==null ? (" • Workers: " + workersOnServer) : "") + ".");
    render();
  }catch(err){
    console.error(err);
    alert("Sync failed: " + (err && err.message ? err.message : err));
    if(status) status.textContent = "Sync failed (see alert).";
  }finally{
    if(btn) btn.disabled = false;
    if(dl) dl.disabled = false;
  }
}

async function downloadOnlyAll(){
  const btn = document.getElementById("settingsDownloadOnlyBtn");
  const syncBtn = document.getElementById("settingsSyncBtn");
  const status = document.getElementById("settingsSyncStatus");
  try{
    if(btn) btn.disabled = true;
    if(syncBtn) syncBtn.disabled = true;
    if(status) status.textContent = "Downloading…";

    const pulled = await _syncRequest("pull");
    const data = pulled.data || pulled.payload || pulled;
    const workersOnServer = (data && data.Settings && Array.isArray(data.Settings.workers)) ? data.Settings.workers.length : null;
    const changed = _applyPulledData(data);

    setLastSync(pulled.serverTime || data.serverTime || new Date().toISOString());
    if(status) status.textContent = "Last synced: " + formatLastSync();
    if(changed) { toast("Downloaded updates" + (workersOnServer!==null ? (" • Workers: " + workersOnServer) : "") + "."); render(); }
    else toast("No changes" + (workersOnServer!==null ? (" • Workers: " + workersOnServer) : "") + ".");
  }catch(err){
    console.error(err);
    alert("Download failed: " + (err && err.message ? err.message : err));
    if(status) status.textContent = "Download failed (see alert).";
  }finally{
    if(btn) btn.disabled = false;
    if(syncBtn) syncBtn.disabled = false;
  }
}
/* ===== END GOOGLE SHEETS SYNC (V3) ===== */


// ----------------- Demo data -----------------
function loadDemo(){
  if(alive(state.projects).length) {
    if(!confirm("Load demo data (this will add demo records). Continue?")) return;
  }
  const pid = uid();
  state.projects.unshift({
    id: pid,
    name: "14 Kowhai Road Renovation",
    address: "14 Kowhai Road, Auckland, New Zealand",
    clientName: "Client Example",
    clientPhone: "0210000000",
    notes: "Gate code 1234. Watch the dog. Power in garage.",
    lat: -36.8485,
    lng: 174.7633,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  const sid = uid();
  state.subbies.unshift({ id:sid, name:"Sparkies Ltd", trade:"Electrician", phone:"0211111111", email:"spark@example.com", notes:"Prefers Fridays", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  state.tasks.unshift({ id:uid(), projectId:pid, title:"Book pre-line inspection", details:"Call council", status:"To do", dueDate:new Date(Date.now()+3*86400000).toISOString().slice(0,10), assignedSubbieId:null, photos: [],
    photosTaken: false,
    photosJson: "[]", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  state.diary.unshift({ id:uid(), projectId:pid, date:new Date().toISOString().slice(0,10), summary:"Framing progress in lounge + checked bracing fixings.", hours:"7.5", billable:true, category:"Labour", rate:"", photos: [],
    photosTaken: false,
    photosJson: "[]", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  state.variations.unshift({ id:uid(), projectId:pid, date:new Date().toISOString().slice(0,10), title:"Extra LVL beam", description:"Client requested opening widening; requires LVL + extra labour.", amount:"480", status:"Sent", photos: [],
    photosTaken: false,
    photosJson: "[]", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  state.deliveries.unshift({ id:uid(), projectId:pid, supplier:"PlaceMakers", date:new Date().toISOString().slice(0,10), status:"Expected", items:"Timber pack + fixings", dropPoint:"Driveway", notes:"Call ahead", photos: [],
    photosTaken: false,
    photosJson: "[]", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  state.inspections.unshift({ id:uid(), projectId:pid, type:"Pre-line", date:new Date(Date.now()+2*86400000).toISOString().slice(0,10), result:"Booked", inspector:"", notes:"Ensure smoke alarms locations confirmed", photos: [],
    photosTaken: false,
    photosJson: "[]", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  saveState(state);
  render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}







/* ===== SUBBIES PROJECTID MIGRATION ===== */
(function normalizeSubbiesProjectId(){
  // Ensure the field exists so sync can round-trip it.
  // We do NOT guess projectId for older subbies because they were historically shared.
  if(!state || !Array.isArray(state.subbies)) return;
  let changed = false;
  state.subbies = alive(state.subbies).filter(isAlive).map(s => {
    if(s && typeof s.projectId === "undefined"){
      changed = true;
      return { ...s, projectId: "" };
    }
    return s;
  });
  if(changed) saveState(state);
})();
/* ===== END SUBBIES PROJECTID MIGRATION ===== */




// ===== PHASE A: PIPELINE (Leads) =====
function leadCard(l){
  const name = escapeHtml(l.clientName || "Unnamed lead");
  const addr = escapeHtml(l.address || "No address");
  const status = escapeHtml(l.status || "New");
  const jobType = l.jobType ? ` • ${escapeHtml(l.jobType)}` : "";
  return `
    <div class="item" data-id="${l.id}">
      <div class="row space">
        <div>
          <div class="title">${name}</div>
          <div class="meta">${addr}</div>
          <div class="meta">${status}${jobType}</div>
        </div>
        <div class="row">
          <button class="btn small" data-action="open" data-id="${l.id}" type="button">Open</button>
          <button class="btn small" data-action="edit" data-id="${l.id}" type="button">Edit</button>
        </div>
      </div>
    </div>
  
    <div class="card" style="margin-top:12px">
      <div class="row space" style="align-items:center; gap:10px; flex-wrap:wrap">
        <div>
          <div class="h3">Company modules</div>
          <div class="sub">Access company-wide registers.</div>
        </div>
        <div class="row" style="gap:10px">
          <button class="btn" id="btnOpenEquipment" type="button">Open Equipment & Fleet</button>
        </div>
      </div>
    </div>
`;
}

function renderPreconItemRow(item, idx){
  const id = `precon_${item.key}`;
  const checked = item.done ? "checked" : "";
  const choice = item.kind === "choice"
    ? `<select class="input" data-precon-choice="${idx}" style="min-height:44px">
        ${item.choices.map(c=>`<option value="${escapeAttr(c)}" ${c===item.value?"selected":""}>${escapeAttr(c)}</option>`).join("")}
       </select>`
    : "";
  return `
    <div class="listItem" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; margin-bottom:10px">
      <label style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer">
        <input type="checkbox" data-precon-check="${idx}" ${checked} style="transform:scale(1.1)"/>
        <div style="display:flex; flex-direction:column; gap:4px">
          <div style="font-weight:700">${escapeAttr(item.label)}</div>
          ${item.kind==="choice" ? `<div class="smallmuted">Answer: <span style="opacity:.9">${escapeAttr(item.value||"Unknown")}</span></div>` : ""}
        </div>
      </label>
      ${choice}
    </div>
  `;
}

function bindLeadPrecon(lead){
  const host = document.getElementById("preconList");
  const badge = document.getElementById("preconProgressBadge");
  if(!host || !badge) return;

  let list = preconChecklistFromLead(lead);
  // template selector
  const sel = document.getElementById("preconTemplateSelect");
  const btnTpl = document.getElementById("preconApplyTemplate");
  const preconLocked = leadIsConverted(lead);
  const lockNote = document.getElementById("preconLockedNote");
  if(lockNote) lockNote.style.display = preconLocked ? "" : "none";

  if(preconLocked){
    if(sel) sel.disabled = true;
    if(btnTpl) btnTpl.disabled = true;
  }

  if(sel){
    // default selection from lead job type, but don't overwrite user choice
    sel.value = lead.preconTemplateKey || getLeadJobTypeKey(lead) || "standard_nz";
  }
  if(btnTpl && sel){
    btnTpl.onclick = ()=>{
      const key = sel.value || "standard_nz";
      if(!confirm("Apply this template? This will replace the current checklist for this lead.")) return;
      list = applyPreconTemplateToLead(lead, key);
      refresh();
    };
  }


  const refresh = ()=>{
    host.innerHTML = list.map((it, i)=>renderPreconItemRow(it, i)).join("");
    const prog = preconProgress(list);
    badge.textContent = `${prog.done}/${prog.total} (${prog.pct}%)`;
    // bind
    
    if(preconLocked){
      host.querySelectorAll("input,select,button").forEach(el=>{ 
        if(el.id==="preconMarkAll" || el.id==="preconReset") return;
      });
      host.querySelectorAll("[data-precon-check],[data-precon-choice]").forEach(el=>{ el.disabled = true; });
    }
host.querySelectorAll("[data-precon-check]").forEach(el=>{
      el.onchange = ()=>{
        const i = Number(el.getAttribute("data-precon-check"));
        list[i].done = !!el.checked;
        save();
        refresh();
      };
    });
    host.querySelectorAll("[data-precon-choice]").forEach(el=>{
      el.onchange = ()=>{
        const i = Number(el.getAttribute("data-precon-choice"));
        list[i].value = el.value;
        // if user answers, consider it done when not Unknown
        if(list[i].kind==="choice") list[i].done = (el.value !== "Unknown");
        save();
        refresh();
      };
    });
  };

  const save = ()=>{
    try{
      // persist back onto lead record (local-only lead store)
      lead.preconChecklistJson = JSON.stringify(list);
      if(typeof saveLead==='function'){ saveLead(lead); } else if(typeof updateLead==='function'){ updateLead(lead); }
    }catch(e){
      console.warn("precon save failed", e);
    }
  };

  const markAll = document.getElementById("preconMarkAll");
  if(preconLocked){ if(markAll) markAll.disabled=true; }

  if(markAll) markAll.onclick = ()=>{
    list = list.map(it=>{
      const c = {...it};
      c.done = true;
      if(c.kind==="choice" && (!c.value || c.value==="Unknown")) c.value = "Yes";
      return c;
    });
    save(); refresh();
  };

  const reset = document.getElementById("preconReset");
  if(preconLocked){ if(reset) reset.disabled=true; }

  if(reset) reset.onclick = ()=>{
    list = defaultPreconChecklist();
    save(); refresh();
  };

  refresh();
}

function renderPipeline(app){
  setHeader("Pipeline");
  const leads = aliveArr(state.leads).slice().sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""));
  app.innerHTML = `
    <div class="card">
      <div class="row space">
        <h2>Leads</h2>
        <button class="btn primary" id="newLead" type="button">New Lead</button>
      </div>
      <div class="sub">Track enquiries from first contact through to quote and conversion. Leads are local-only for now (sync later).</div>
      <hr/>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <select class="input" id="leadStatusFilter" style="min-width:200px">
          <option value="">All statuses</option>
          ${LEAD_STATUSES.map(s=>`<option value="${s}">${s}</option>`).join("")}
        </select>
        <input class="input" id="leadSearch" placeholder="Search leads (name / address)" style="flex:1;min-width:220px"/>
      </div>
      <div class="list" id="leadList">
        ${leads.length ? leads.map(l=>leadCard(l)).join("") : `<div class="sub">No leads yet. Add your first enquiry.</div>`}
      </div>
    </div>
  `;
  $("#newLead").onclick = ()=> openLeadForm({});
  const renderList = (arr)=>{
    const el=$("#leadList"); if(!el) return;
    el.innerHTML = arr.length ? arr.map(l=>leadCard(l)).join("") : `<div class="sub">No leads match your filter.</div>`;
  };
  const apply = ()=>{
    const st = $("#leadStatusFilter")?.value || "";
    const q = ($("#leadSearch")?.value || "").toLowerCase().trim();
    const all = aliveArr(state.leads).slice().sort((a,b)=> (b.updatedAt||"").localeCompare(a.updatedAt||""));
    const filtered = all.filter(l=>{
      const hitsSt = !st || (l.status||"New")===st;
      const hitsQ = !q || ((l.clientName||"").toLowerCase().includes(q) || (l.address||"").toLowerCase().includes(q));
      return hitsSt && hitsQ;
    });
    renderList(filtered);
  };
  if($("#leadStatusFilter")) $("#leadStatusFilter").onchange = apply;
  if($("#leadSearch")) $("#leadSearch").oninput = apply;

  // delegated actions
  $("#leadList").onclick = (e)=>{
    const btn = e.target.closest("button");
    if(!btn) return;
    const id = btn.dataset.id;
    if(btn.dataset.action==="open") return navTo("lead",{id});
    if(btn.dataset.action==="edit"){
      const l = state.leads.find(x=>x && x.id===id);
      if(l) openLeadForm(l);
    }
  };
}

function renderLeadDetail(app, params){
  const id = params.id;
  const l = (state.leads||[]).find(x=>x && x.id===id);
  if(!l){ app.innerHTML = `<div class="card"><div class="sub">Lead not found.</div></div>`; return; }
  app.innerHTML = `
    <div class="card">
      <div class="row space">
        <div>
          <h2>${escapeHtml(l.clientName||"Unnamed lead")}</h2>
          <div class="sub">${escapeHtml(l.status||"New")}</div>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <button class="btn" id="editLead" type="button">Edit</button>
          <button class="btn primary" id="convertLead" type="button">Convert to job</button>
          <button class="btn danger" id="deleteLead" type="button">Delete</button>
        </div>
      </div>
      <hr/>

      <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:12px">
        <button class="btn" id="tabLeadOverview" type="button">Overview</button>
        <button class="btn" id="tabLeadPrecon" type="button">Precon</button>
      </div>
      <div id="leadOverview" style="margin-top:12px">
      <div class="grid two">
        <div>
          <div class="label">Address</div>
          <div class="meta">${escapeHtml(l.address||"—")}</div>
          <div style="height:8px"></div>
          <div class="label">Contact</div>
          <div class="meta">${escapeHtml(l.phone||"")}${l.email ? ` • ${escapeHtml(l.email)}`:""}</div>
          <div style="height:8px"></div>
          <div class="label">Lead source</div>
          <div class="meta">${escapeHtml(l.leadSource||"—")}</div>
          <div style="height:8px"></div>
          <div class="label">Job type</div>
          <div class="meta">${escapeHtml(l.jobType||"—")}</div>
          <div style="height:8px"></div>
          <div class="label">Budget</div>
          <div class="meta">${escapeHtml(l.budget||"—")}</div>
        </div>
        <div>
          <div class="label">Notes</div>
          <div class="meta" style="white-space:pre-wrap">${escapeHtml(l.notes||"")}</div>
          <div style="height:8px"></div>
          <div class="label">Photos taken</div>
          <div class="meta">${(l.photosTaken||photosTakenFromJson(l.photosJson)) ? "Yes" : "No"}</div>
        </div>
      </div>
    </div>
  
      </div>

      <div class="card" id="preconCard" style="display:none;margin-top:12px">
        <div class="row space">
          <h3>Preconstruction checklist</h3>
          <span class="badge" id="preconProgressBadge">0/0</span>
        </div>
        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:12px">
          <select class="input" id="preconTemplateSelect" style="flex:1; min-width:220px">
            <option value="standard_nz">Standard NZ Residential</option>
            <option value="new_build">New Build</option>
            <option value="renovation">Renovation / Alteration</option>
            <option value="extension">Extension / Addition</option>
            <option value="bathroom">Bathroom / Wet Area</option>
            <option value="deck">Deck / External</option>
            <option value="re_roof">Re-roof / Roofing</option>
          </select>
          <button class="btn" type="button" id="preconApplyTemplate">Apply template</button>
        </div>

        <div class="sub" style="margin-top:6px">NZ residential preconstruction checklist (editable per lead).</div>
        <div class="smallmuted" id="preconLockedNote" style="margin-top:6px; display:none">Precon is locked after conversion.</div>

        <div style="margin-top:12px" id="preconList"></div>
        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:12px">
          <button class="btn" type="button" id="preconMarkAll">Mark all complete</button>
          <button class="btn ghost" type="button" id="preconReset">Reset</button>
        </div>
        <div class="smallmuted" style="margin-top:8px">This is stored inside the lead as <code>preconChecklistJson</code> (local-only for now).</div>
      </div>
`;
  $("#editLead").onclick = ()=> openLeadForm(l);
  $("#deleteLead").onclick = ()=>{
    if(!confirm("Delete this lead?")) return;
    state.leads = softDeleteById(state.leads, l.id);
    saveState(state);
    navTo("pipeline");
  };
  $("#convertLead").onclick = ()=> convertLeadToProject(l.id);
  try{ bindLeadPrecon(l); }catch(e){ console.warn(e); }
  try{ setLeadTab2(window.__mcbLeadTab || 'overview'); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}


}

function openLeadForm(seed={}){
  const isEdit = !!seed.id;
  const l = isEdit ? seed : {
    id: uid(),
    status: "New",
    clientName: "",
    phone: "",
    email: "",
    address: "",
    leadSource: "",
    jobType: "",
    budget: "",
    notes: "",
    photosTaken: false,
    photosJson: "[]",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
  showModal(`
    <div class="row space">
      <h2>${isEdit ? "Edit Lead" : "New Lead"}</h2>
      <button class="btn" id="closeLeadModal" type="button">Close</button>
    </div>
    <hr/>
    <label class="label">Status</label>
    <select class="input" id="leadStatus">
      ${LEAD_STATUSES.map(s=>`<option value="${s}" ${l.status===s?"selected":""}>${s}</option>`).join("")}
    </select>

    <label class="label">Client name</label>
    <input class="input" id="leadClientName" value="${escapeAttr(l.clientName||"")}" />

    <div class="grid two">
      <div>
        <label class="label">Phone</label>
        <input class="input" id="leadPhone" value="${escapeAttr(l.phone||"")}" />
      </div>
      <div>
        <label class="label">Email</label>
        <input class="input" id="leadEmail" value="${escapeAttr(l.email||"")}" />
      </div>
    </div>

    <label class="label">Address</label>
    <input class="input" id="leadAddress" value="${escapeAttr(l.address||"")}" placeholder="Site address" />

    <div class="grid two">
      <div>
        <label class="label">Lead source</label>
        <input class="input" id="leadSource" value="${escapeAttr(l.leadSource||"")}" placeholder="Referral, Website, etc." />
      </div>
      <div>
        <label class="label">Job type</label>
        <input class="input" id="leadJobType" value="${escapeAttr(l.jobType||"")}" placeholder="Renovation, deck, new build…" />
      </div>
    </div>

    <label class="label">Budget (optional)</label>
    <input class="input" id="leadBudget" value="${escapeAttr(l.budget||"")}" placeholder="$" />

    <label class="label">Notes</label>
    <textarea class="input" id="leadNotes" rows="4">${escapeHtml(l.notes||"")}</textarea>

    <div class="row" style="gap:10px; align-items:center; margin-top:10px">
      <input type="checkbox" id="leadPhotosTaken" ${ (l.photosTaken||photosTakenFromJson(l.photosJson)) ? "checked":"" } />
      <label for="leadPhotosTaken" class="label" style="margin:0">Photos taken</label>
    </div>

    <div class="row" style="gap:10px; margin-top:14px; justify-content:flex-end">
      <button class="btn" id="cancelLead" type="button">Cancel</button>
      <button class="btn primary" id="saveLead" type="button">${isEdit ? "Save" : "Create"}</button>
    </div>
  `);
  $("#closeLeadModal").onclick = closeModal;
  $("#cancelLead").onclick = closeModal;
  $("#saveLead").onclick = ()=>{
    const now = new Date().toISOString();
    const upd = {
      ...l,
      status: $("#leadStatus").value,
      clientName: $("#leadClientName").value.trim(),
      phone: $("#leadPhone").value.trim(),
      email: $("#leadEmail").value.trim(),
      address: $("#leadAddress").value.trim(),
      leadSource: $("#leadSource").value.trim(),
      jobType: $("#leadJobType").value.trim(),
      budget: $("#leadBudget").value.trim(),
      notes: $("#leadNotes").value,
      photosTaken: !!$("#leadPhotosTaken").checked,
      photosJson: ($("#leadPhotosTaken").checked ? "true" : "[]"),
      updatedAt: now
    };
    if(!upd.clientName && !upd.address){
      alert("Please enter at least a client name or an address.");
      return;
    }
    if(isEdit){
      state.leads = (state.leads||[]).map(x=> x && x.id===upd.id ? upd : x);
    } else {
      state.leads = [...(state.leads||[]), upd];
    }
    saveState(state);
    closeModal();
    // stay on pipeline
    if(location.hash.startsWith("#lead")) navTo("lead",{id: upd.id});
    else render();
  };
}

function convertLeadToProject(leadId){
  const lead = (state.leads||[]).find(x=>x && x.id===leadId);
  if(!lead) return;
  if(!confirm("Convert this lead into a job (project)?")) return;
  const now = new Date().toISOString();
  const projId = uid();
  const project = {
    id: projId,
    name: (lead.clientName ? `${lead.clientName} - ${lead.jobType||"Job"}` : (lead.jobType||"New Job")).trim(),
    address: lead.address || "",
    clientName: lead.clientName || "",
    clientPhone: lead.phone || "",
    notes: lead.notes || "",
    lat: null, lng: null,
    stage: "Precon",
    leadId: lead.id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
  state.projects = [...(state.projects||[]), project];
  state.leads = (state.leads||[]).map(x=> x && x.id===lead.id ? ({...x, status:"Converted", projectId: projId, updatedAt: now}) : x);
  saveState(state);
  closeModal();
  navTo("project",{id: projId});
}
// ===== /PHASE A =====


// ===== SOFT DELETE (sync-safe) =====
function softDeleteById(arr, id){
  const now = new Date().toISOString();
  try{ if(typeof window.render==='function'){ setTimeout(()=>window.render(),0); } }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

  return (arr||[]).map(item => {
    if(item && item.id === id){
      return { ...item, deletedAt: now, updatedAt: now };
    }
    return item;
  });
}
function softDeleteWhere(arr, predicate){
  const now = new Date().toISOString();
  return (arr||[]).map(item => {
    if(item && predicate(item)){
      return { ...item, deletedAt: now, updatedAt: now };
    }
    return item;
  });
}
function isAlive(x){ return x && !x.deletedAt; }
function aliveArr(arr){ return (arr||[]).filter(isAlive); }

function alive(arr){ return (arr||[]).filter(isAlive); }

function projectsActive(){
  // Active = not deleted. Sorted A→Z for selects.
  return aliveArr(state.projects).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||""));
}




/* ===== PHASE1_PHOTOS_CHECKBOX ===== */
function photosFlagFromCheckbox(id){
  const el=document.getElementById(id);
  return el && el.checked ? "true" : "";
}

/* ===== PHASE1_UNDELETE ===== */
function renderDeletedProjectsUI(){
  const box=document.getElementById("deletedProjects");
  if(!box) return;
  const deleted=(state.projects||[]).filter(p=>p.deletedAt);
  box.innerHTML = deleted.length ? deleted.map(p=>`
    <div class="row">
      <strong>${p.name||p.address||"Site"}</strong>
      <button onclick="restoreProject('${p.id}')">Restore</button>
    </div>
  `).join("") : "<em>No deleted sites</em>";
}
function restoreProject(id){
  const now=new Date().toISOString();
  state.projects=state.projects.map(p=>p.id===id?{...p,deletedAt:null,updatedAt:now}:p);
  saveState(state); render(); try{renderDeletedProjectsUI();}catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}

/* ===== PHASE1_TASK_FILTERS ===== */
let taskFilterSite="all", taskFilterStatus="all";
function filteredTasks(){
  return (state.tasks||[])
    .filter(t=>!t.deletedAt)
    .filter(t=>taskFilterSite==="all"||t.projectId===taskFilterSite)
    .filter(t=>taskFilterStatus==="all"||t.status===taskFilterStatus);
}

// ===== FORCE_PHOTOS_LABEL =====
function injectPhotosLabel(){
  document.querySelectorAll('input[type="checkbox"][data-photos]').forEach(cb=>{
    if(!cb.parentElement.querySelector('.photos-taken-label')){
      const span=document.createElement('span');
      span.className='photos-taken-label';
      span.innerHTML='Photos taken';
      cb.after(span);
    }
  });
}
// call after every render
const _render = render;
render = function(){
  _render();
  injectPhotosLabel();
};


// ===== PHASE 2: Print modal only (no page behind) =====
function printModalOnly(title="Report"){
  const modal = document.getElementById("modal");
  if(!modal) { window.print(); return; }
  const content = modal.innerHTML || "";
  const w = window.open("", "_blank");
  if(!w){ alert("Pop-up blocked. Allow pop-ups to print."); return; }
  const css = `
    <style>
      body{font-family:system-ui,-apple-system,BlinkMacSystemFont; padding:18px;}
      img{max-width:220px;height:auto}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #ddd;padding:6px;font-size:12px;vertical-align:top}
      th{background:#f5f5f5}
      button{display:none !important}
      .btn{display:none !important}
      .noPrint{display:none !important}
      .card{box-shadow:none !important;border:0 !important}
      @page{margin:12mm}
    </style>`;
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>${css}</head><body>${content}</body></html>`);
  w.document.close();
  w.focus();
  // Give images time to load (logo)
  setTimeout(()=>{ w.print(); }, 400);
}
// ===== END PHASE 2 =====



// ===== HNRY SIMPLE DIARY EXPORT (ACTIVE JOBS ONLY) =====
function formatDateNZ(iso){
  if(!iso) return "";
  const [y,m,d] = iso.slice(0,10).split("-");
  return `${d}/${m}/${y}`;
}

function runHnryDiaryExportSimple(projectId, from, to){
  const rangeFrom = from || new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const rangeTo   = to   || new Date().toISOString().slice(0,10);

  const activeProjects = aliveArr(state.projects).filter(p=>!p.deletedAt);
  const activeIds = activeProjects.map(p=>p.id);

  const diary = aliveArr(state.diary)
    .filter(d=>!d.deletedAt)
    .filter(d=>Number(d.hours||0)>0)
    .filter(d=>(d.date||"")>=rangeFrom && (d.date||"")<=rangeTo)
    .filter(d=> projectId==="__ALL__" ? activeIds.includes(d.projectId) : d.projectId===projectId)
    .sort((a,b)=>(a.date||"").localeCompare(b.date||""));

  const byDate = {};
  for(const d of diary){
    const day = (d.date||"").slice(0,10);
    if(!byDate[day]) byDate[day]=[];
    byDate[day].push(d);
  }

  let grandTotal = 0;
  const lines = [];
  lines.push("HNRY DIARY EXPORT");
  lines.push(`Period: ${rangeFrom} to ${rangeTo}`);
  lines.push("");

  Object.keys(byDate).sort().forEach(day=>{
    lines.push(formatDateNZ(day));
    let dailyTotal = 0;
    for(const d of byDate[day]){
      const proj = activeProjects.find(p=>p.id===d.projectId);
      if(!proj) continue;
      const hrs = Number(d.hours||0);
      dailyTotal += hrs;
      lines.push(`  ${proj.name} - ${hrs.toFixed(2)} hrs`);
    }
    lines.push(`  Daily total: ${dailyTotal.toFixed(2)} hrs`);
    lines.push("");
    grandTotal += dailyTotal;
  });

  lines.push("--------------------------------");
  lines.push(`TOTAL HOURS: ${grandTotal.toFixed(2)}`);

  const out = lines.join("\n");

  showModal(
    '<pre style="white-space:pre-wrap;font-size:13px">' + out + '</pre>' +
    '<button class="btn" id="copyH">Copy to clipboard</button>'
  );
  const c = document.getElementById("copyH");
  if(c){
    c.onclick = ()=>{
      navigator.clipboard.writeText(out);
      toast("Copied");
    };
  }
}



function toastSuccess(msg){ toast(msg); }
function toastError(msg){ toast(msg); }
function getProgrammeTasksForProject(projectId){ return programmeTasksForProject(projectId); }

function renderRemovedProgrammeTasks(projectId){
  const host = document.getElementById("removedProgrammeList");
  if(!host) return;
  try{
    const tasks = getProgrammeTasksForProject(projectId) || [];
    const removed = tasks.filter(t=>isProgrammeTaskRemoved(t));
    if(!removed.length){
      host.innerHTML = `<div class="sub">None</div>`;
      return;
    }
    host.innerHTML = removed.map(t=>`
      <div class="listItem" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;margin-bottom:10px">
        <div>
          <div style="font-weight:700">${escapeHtml(t.name||"Task")}</div>
          <div class="sub">${escapeHtml(t.phase||"")}</div>
        </div>
        <button class="btn ghost sm" type="button" data-prog-restore="${escapeAttr(t.id)}" data-prog-project="${escapeAttr(projectId)}">Restore</button>
      </div>
    `).join("");
  }catch(e){
    host.innerHTML = `<div class="sub">Unable to load removed tasks</div>`;
  }
}

document.addEventListener("click", (ev)=>{
  const btn = ev.target && (ev.target.closest ? ev.target.closest("[data-prog-remove],[data-prog-restore]") : null);
  if(!btn) return;
  ev.preventDefault();
  const id = btn.getAttribute("data-prog-remove") || btn.getAttribute("data-prog-restore");
  const projectId = btn.getAttribute("data-prog-project");
  if(!id || !projectId) return;
  try{
    const tasks = getProgrammeTasksForProject(projectId) || [];
    const task = tasks.find(x=>String(x.id)===String(id));
    if(!task) return;
    if(btn.hasAttribute("data-prog-remove")){
      if(!confirm("Remove this programme task from this job? You can restore it later.")) return;
      markProgrammeTaskRemoved(task, true);
    }else{
      markProgrammeTaskRemoved(task, false);
    }
    saveProgrammeTasksForProject(projectId, tasks);
    // refresh current view
    refreshProgrammeTab(projectId);
    renderRemovedProgrammeTasks(projectId);
  }catch(e){
    console.warn(e);
    alert("Could not update programme task.");
  }
});

function refreshProgrammeTab(projectId){
  try{
    const r = (typeof parseRoute==="function") ? parseRoute() : {path:"", params:{}};
    if(r.path!=="project") return;
    if(String((r.params||{}).id)!==String(projectId)) return;
    if(String((r.params||{}).tab||"overview")!=="programme") return;
    const p = projectById(projectId);
    const wrap = document.getElementById("tabContent");
    if(!p || !wrap) return;
    wrap.innerHTML = projectProgramme(p);
    bindProjectTabEvents(p, "programme");
    renderRemovedProgrammeTasks(projectId);
  }catch(e){ console.warn(e); }
}


try{ localStorage.setItem("mcb_last_update_applied","2026-01-22T09:06:55.786767"); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}


function updateAppUpdateStamp(){
  try{
    const el = document.getElementById("appUpdateStamp");
    if(!el) return;
    const iso = localStorage.getItem("mcb_app_last_update") || "";
    el.textContent = "Last app update: " + (iso ? fmtNZDateTime(iso) : "—") + "  •  Build: " + BUILD_ID;
  }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}

function equipmentById(id){ return aliveArr(state.equipment).find(e=>String(e.id)===String(id)); }
function equipmentLogsFor(id){ return aliveArr(state.equipmentLogs).filter(l=>String(l.equipmentId)===String(id) && !l.deletedAt).sort((a,b)=>(b.date||"").localeCompare(a.date||"")); }
function upsertEquipment(e){
  state.equipment = aliveArr(state.equipment);
  const idx = state.equipment.findIndex(x=>String(x.id)===String(e.id));
  const prev = idx>=0 ? state.equipment[idx] : null;
  const isNew = idx < 0;

  const actor = currentActor();
  const next = { ...e };

  if(isNew){
    if(!next.createdAt) next.createdAt = nowISO();
    next.createdById = next.createdById || actor.id;
    next.createdByName = next.createdByName || actor.name;
  }
  next.updatedAt = nowISO();
  next.updatedById = actor.id;
  next.updatedByName = actor.name;

  // Detect important changes (especially location)
  const changed = [];
  const keys = ["name","category","assetTag","status","projectId","locationText","testTagDue","notes"];
  keys.forEach(k=>{
    const a = prev ? String(prev[k] ?? "") : "";
    const b = String(next[k] ?? "");
    if(a !== b) changed.push(k);
  });

  if(idx>=0) state.equipment[idx]=next; else state.equipment.unshift(next);

  const locChanged = changed.includes("projectId") || changed.includes("locationText");
  addActivity({
    kind:"equipment",
    action: isNew ? "create" : (locChanged ? "location_update" : "update"),
    entityId: next.id,
    projectId: next.projectId || "",
    changedFields: changed,
    actorId: actor.id,
    actorName: actor.name
  });

  saveState(state);
}
function softDeleteEquipment(id){
  const e = equipmentById(id);
  if(!e) return;
  e.deletedAt = new Date().toISOString();
  upsertEquipment(e);
}
function upsertEquipmentLog(l){
  state.equipmentLogs = aliveArr(state.equipmentLogs);
  const idx = state.equipmentLogs.findIndex(x=>String(x.id)===String(l.id));
  if(idx>=0) state.equipmentLogs[idx]=l; else state.equipmentLogs.unshift(l);
  saveState(state);
}
function softDeleteEquipmentLog(id){
  const l = aliveArr(state.equipmentLogs).find(x=>String(x.id)===String(id));
  if(!l) return;
  l.deletedAt = new Date().toISOString();
  upsertEquipmentLog(l);
}
function fleetStatusBadges(e){
  const today = new Date();
  const soonDays = 30;
  const parse = (s)=>{ try{ return s ? new Date(s) : null; }catch(e){ return null; } };
  const badges = [];
  const check = (label, dateStr)=>{
    const d = parse(dateStr);
    if(!d) return;
    const diff = Math.ceil((d - today)/(1000*60*60*24));
    if(diff < 0) badges.push(`<span class="badge danger">${label} overdue</span>`);
    else if(diff <= soonDays) badges.push(`<span class="badge warn">${label} ${diff}d</span>`);
    else badges.push(`<span class="badge">${label} ok</span>`);
  };
  check("Service", e.nextServiceDate);
  check("WOF", e.wofExpiry);
  check("Reg", e.regExpiry);
  return badges.join(" ");
}

function fmtNZDateTime(iso){
  try{
    const d = new Date(iso);
    const pad = (n)=> String(n).padStart(2,"0");
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }catch(e){ return iso || "—"; }
}

// Ensure equipment tables exist
try{ state.equipment = aliveArr(state.equipment); state.equipmentLogs = aliveArr(state.equipmentLogs); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}







function equipmentFormModal(e){
  const isNew = !e;
  const eq = e ? {...e} : { id: uid(), status:"active", name:"", type:"", assetTag:"", projectId:"", locationText:"", notes:"", nextServiceDate:"", wofExpiry:"", regExpiry:"" };
  const projs = aliveArr(state.projects).filter(p=>!p.deletedAt).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const fmtIn = (s)=> (s && String(s).length>=10) ? String(s).slice(0,10) : "";
  return `
  <div class="modal">
    <div class="modalCard">
      <div class="row space" style="align-items:center">
        <div>
          <div class="h2">${isNew?"Add equipment":"Edit equipment"}</div>
          <div class="sub">Track location + servicing/WOF/registration.</div>
        </div>
        <button class="iconBtn" id="closeModalBtn" type="button">✕</button>
      </div>

      <div class="grid2" style="margin-top:14px">
        <div>
          <label class="label">Name</label>
          <input class="input" id="eqName" value="${escapeAttr(eq.name)}" placeholder="e.g. Hilux Ute, Makita Kit, Mixer" />
        </div>
        <div>
          <label class="label">Type</label>
          <input class="input" id="eqType" value="${escapeAttr(eq.type)}" placeholder="Vehicle / Tool / Plant" />
        </div>
        <div>
          <label class="label">Asset tag / plate</label>
          <input class="input" id="eqAsset" value="${escapeAttr(eq.assetTag)}" placeholder="e.g. MCB-012 or ABC123" />
        </div>
        <div>
          <label class="label">Status</label>
          <select class="input" id="eqStatus">
            <option value="active" ${eq.status==="active"?"selected":""}>Active</option>
            <option value="maintenance" ${eq.status==="maintenance"?"selected":""}>Maintenance</option>
            <option value="retired" ${eq.status==="retired"?"selected":""}>Retired</option>
          </select>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="h3">Location</div>
        <div class="grid2" style="margin-top:10px">
          <div>
            <label class="label">Assigned site (optional)</label>
            <select class="input" id="eqProject">
              <option value="">— Not linked to a site —</option>
              ${projs.map(p=>`<option value="${escapeAttr(p.id)}" ${String(eq.projectId)===String(p.id)?"selected":""}>${escapeHtml(p.name||"Project")} • ${escapeHtml(p.address||"")}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="label">Location note (optional)</label>
            <input class="input" id="eqLocText" value="${escapeAttr(eq.locationText||"")}" placeholder="e.g. Yard, Workshop, With sparky" />
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="h3">Fleet compliance</div>
        <div class="grid3" style="margin-top:10px">
          <div>
            <label class="label">Service due</label>
            <input class="input" id="eqServiceDue" type="date" value="${escapeAttr(fmtIn(eq.nextServiceDate))}" />
          </div>
          <div>
            <label class="label">WOF expiry</label>
            <input class="input" id="eqWof" type="date" value="${escapeAttr(fmtIn(eq.wofExpiry))}" />
          </div>
          <div>
            <label class="label">Registration expiry</label>
            <input class="input" id="eqReg" type="date" value="${escapeAttr(fmtIn(eq.regExpiry))}" />
          </div>
        </div>
      </div>

      <div style="margin-top:14px">
        <label class="label">Fleet notes</label>
        <textarea class="input" id="eqNotes" rows="4" placeholder="Tyres, upcoming repairs, service history notes…">${escapeHtml(eq.notes||"")}</textarea>
      </div>

      <div class="row" style="justify-content:flex-end; gap:10px; margin-top:16px">
        <button class="btn ghost" id="cancelModalBtn" type="button">Cancel</button>
        <button class="btn" id="saveEqBtn" type="button">${isNew?"Create":"Save"}</button>
      </div>

      <div class="sub" style="margin-top:10px; opacity:.8">Tip: You can log services/repairs inside the equipment record after saving.</div>
    </div>
  </div>`;
}
function equipmentViewModal(eqId){
  const e = equipmentById(eqId);
  if(!e) return "";
  const logs = equipmentLogsFor(eqId);
  const fmt = (s)=> s ? String(s).slice(0,10).split("-").reverse().join("/") : "—";
  const proj = e.projectId ? projectById(e.projectId) : null;
  const loc = proj ? `Site: ${proj.name} (${proj.address||""})` : (e.locationText||"—");
  return `
  <div class="modal">
    <div class="modalCard">
      <div class="row space" style="align-items:center">
        <div>
          <div class="h2">${escapeHtml(e.name||"Equipment")}</div>
          <div class="sub">${escapeHtml(e.type||"")}${e.assetTag?` • ${escapeHtml(e.assetTag)}`:""} • Status: <b>${escapeHtml(e.status||"active")}</b></div>
        </div>
        <button class="iconBtn" id="closeModalBtn" type="button">✕</button>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="row space" style="align-items:center">
          <div class="h3">Overview</div>
          <div class="row" style="gap:8px">${fleetStatusBadges(e)}</div>
        </div>
        <div class="sub" style="margin-top:8px"><b>Location:</b> ${escapeHtml(loc)}</div>
        <div class="sub" style="margin-top:6px">Service due: <b>${fmt(e.nextServiceDate)}</b> • WOF: <b>${fmt(e.wofExpiry)}</b> • Reg: <b>${fmt(e.regExpiry)}</b></div>
        ${e.notes?`<div class="sub" style="margin-top:8px">${escapeHtml(e.notes)}</div>`:""}
      </div>

      <div class="card" style="margin-top:14px">
        <div class="row space" style="align-items:center">
          <div class="h3">Maintenance log</div>
          <button class="btn ghost sm" type="button" data-eq-addlog="${escapeAttr(eqId)}">Add log</button>
        </div>
        ${logs.length ? logs.map(l=>`
          <div class="listItem" style="margin-top:10px">
            <div class="row space" style="gap:10px; flex-wrap:wrap">
              <div>
                <div style="font-weight:800">${escapeHtml(l.kind||"Log")}</div>
                <div class="sub">${fmt(l.date)}${l.cost?` • $${escapeHtml(l.cost)}`:""}</div>
                ${l.notes?`<div class="sub" style="margin-top:6px">${escapeHtml(l.notes)}</div>`:""}
              </div>
              <div class="row" style="gap:8px">
                <button class="btn ghost sm" type="button" data-eq-editlog="${escapeAttr(l.id)}">Edit</button>
                <button class="btn ghost sm" type="button" data-eq-dellog="${escapeAttr(l.id)}">Delete</button>
              </div>
            </div>
          </div>
        `).join("") : `<div class="sub" style="margin-top:10px">No log entries yet.</div>`}
      </div>

      <div class="row" style="justify-content:flex-end; gap:10px; margin-top:16px">
        <button class="btn ghost" id="cancelModalBtn" type="button">Close</button>
        <button class="btn" type="button" data-eq-edit="${escapeAttr(eqId)}">Edit</button>
      </div>
    </div>
  </div>`;
}
function equipmentLogModal(equipmentId, logId){
  const existing = logId ? aliveArr(state.equipmentLogs).find(x=>String(x.id)===String(logId)) : null;
  const l = existing ? {...existing} : { id: uid(), equipmentId, date: new Date().toISOString().slice(0,10), kind:"Service", cost:"", notes:"" };
  return `
  <div class="modal">
    <div class="modalCard">
      <div class="row space" style="align-items:center">
        <div>
          <div class="h2">${existing?"Edit log":"Add log"}</div>
          <div class="sub">Record servicing, repairs, WOF/reg actions.</div>
        </div>
        <button class="iconBtn" id="closeModalBtn" type="button">✕</button>
      </div>

      <div class="grid3" style="margin-top:14px">
        <div>
          <label class="label">Date</label>
          <input class="input" id="eqLogDate" type="date" value="${escapeAttr(String(l.date).slice(0,10))}" />
        </div>
        <div>
          <label class="label">Type</label>
          <select class="input" id="eqLogKind">
            ${["Service","Repair","WOF","Registration","Tyres","Other"].map(k=>`<option value="${k}" ${l.kind===k?"selected":""}>${k}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="label">Cost (optional)</label>
          <input class="input" id="eqLogCost" value="${escapeAttr(l.cost||"")}" placeholder="e.g. 320" />
        </div>
      </div>
      <div style="margin-top:12px">
        <label class="label">Notes</label>
        <textarea class="input" id="eqLogNotes" rows="4" placeholder="What was done, where, who…">${escapeHtml(l.notes||"")}</textarea>
      </div>

      <div class="row" style="justify-content:flex-end; gap:10px; margin-top:16px">
        <button class="btn ghost" id="cancelModalBtn" type="button">Cancel</button>
        <button class="btn" id="saveEqLogBtn" type="button">${existing?"Save":"Add"}</button>
      </div>
    </div>
  </div>`;
}



function bindEquipmentEvents(){
  state.ui = state.ui || {};
  const q = document.getElementById("equipmentSearch");
  const st = document.getElementById("equipmentStatus");
  const add = document.getElementById("btnAddEquipment");
  if(q){
    q.oninput = ()=>{ state.ui.equipmentQuery = q.value; saveState(state); document.getElementById("app").innerHTML = renderEquipment(); bindEquipmentEvents(); };
  }
  if(st){
    st.onchange = ()=>{ state.ui.equipmentStatus = st.value; saveState(state); document.getElementById("app").innerHTML = renderEquipment(); bindEquipmentEvents(); };
  }
  if(add){
    add.onclick = ()=>{ openModal(equipmentFormModal(null)); bindEquipmentModal(null); };
  }
}
function bindEquipmentModal(eqId){
  const existing = eqId ? equipmentById(eqId) : null;
  const saveBtn = document.getElementById("saveEqBtn");
  if(saveBtn){
    saveBtn.onclick = ()=>{
      const e = existing ? {...existing} : { id: uid(), status:"active" };
      e.name = (document.getElementById("eqName").value||"").trim();
      e.type = (document.getElementById("eqType").value||"").trim();
      e.assetTag = (document.getElementById("eqAsset").value||"").trim();
      e.status = document.getElementById("eqStatus").value;
      e.projectId = document.getElementById("eqProject").value || "";
      e.locationText = (document.getElementById("eqLocText").value||"").trim();
      e.nextServiceDate = document.getElementById("eqServiceDue").value || "";
      e.wofExpiry = document.getElementById("eqWof").value || "";
      e.regExpiry = document.getElementById("eqReg").value || "";
      e.notes = (document.getElementById("eqNotes").value||"").trim();
      if(!e.name){
        alert("Please enter a name.");
        return;
      }
      upsertEquipment(e);
      closeModal();
      requestRender();
      // re-render equipment tab if visible
      try{
        const r = parseRoute();
        if(r.path==="equipment"){
          document.getElementById("app").innerHTML = renderEquipment();
          bindEquipmentEvents();
        }
      }catch(err){}
    };
  }
}


document.addEventListener("click", (ev)=>{
  const btn = ev.target && ev.target.closest ? ev.target.closest("[data-tab]") : null;
  if(!btn) return;
  const tab = btn.getAttribute("data-tab");
  if(tab==="equipment"){
    location.hash = "#/equipment";
  }
});



function fleetById(id){ return aliveArr(state.fleet).find(v=>String(v.id)===String(id)); }
function upsertFleet(v){
  state.fleet = aliveArr(state.fleet);
  const idx = state.fleet.findIndex(x=>String(x.id)===String(v.id));
  if(idx>=0) state.fleet[idx]=v; else state.fleet.unshift(v);
  saveState(state);
}
function softDeleteFleet(id){
  const v = fleetById(id);
  if(!v) return;
  v.deletedAt = new Date().toISOString();
  upsertFleet(v);
}





function migrateFleetEquipmentSplit(){
  try{
    state.equipment = aliveArr(state.equipment);
    state.equipmentLogs = aliveArr(state.equipmentLogs);
    state.fleet = aliveArr(state.fleet);
    state.fleetLogs = aliveArr(state.fleetLogs);
    if(state.fleet.length>0) return;
    const eq = state.equipment;
    const newEquip = [];
    const newFleet = [];
    for(const e of eq){
      const hasCompliance = !!(e.wofExpiry || e.regExpiry || e.nextServiceDate);
      const type = String(e.type||e.category||"").toLowerCase();
      const isVehicle = ["vehicle","ute","van","truck","trailer"].some(k=>type.includes(k));
      if(hasCompliance || isVehicle){
        newFleet.push({
          id:e.id, status:e.status||"active", name:e.name||"", vehicleType:e.type||e.category||"",
          plate:e.assetTag||e.plate||"", projectId:e.projectId||"", locationText:e.locationText||"",
          notes:e.notes||"", nextServiceDate:e.nextServiceDate||"", wofExpiry:e.wofExpiry||"", regExpiry:e.regExpiry||"",
          odometerKm:e.odometerKm||"", deletedAt:e.deletedAt||""
        });
      } else {
        newEquip.push({
          id:e.id, status:e.status||"active", name:e.name||"", category:e.type||e.category||"",
          assetTag:e.assetTag||"", projectId:e.projectId||"", locationText:e.locationText||"",
          notes:e.notes||"", testTagDue:e.testTagDue||"", deletedAt:e.deletedAt||""
        });
      }
    }
    state.fleet = newFleet;
    state.equipment = newEquip;
    saveState(state);
  }catch(e){ console.warn("split migrate failed", e); }
}
try{ migrateFleetEquipmentSplit(); }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}






function renderFleet(){
  const items = aliveArr(state.fleet).filter(v=>!v.deletedAt);
  const q = (state.ui && state.ui.fleetQuery) ? String(state.ui.fleetQuery).toLowerCase() : "";
  const statusFilter = (state.ui && state.ui.fleetStatus) ? state.ui.fleetStatus : "active";
  const filtered = items.filter(v=>{
    const st = (v.status||"active");
    if(statusFilter==="active" && st!=="active") return false;
    if(statusFilter==="all") return true;
    if(statusFilter==="retired" && st!=="retired") return false;
    if(statusFilter==="maintenance" && st!=="maintenance") return false;
    return true;
  }).filter(v=>{
    if(!q) return true;
    const hay = `${v.name||""} ${v.vehicleType||""} ${v.plate||""} ${v.locationText||""}`.toLowerCase();
    return hay.includes(q);
  }).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const projMap = new Map(aliveArr(state.projects).map(p=>[String(p.id), p]));
  const fmt = (s)=> s ? String(s).slice(0,10).split("-").reverse().join("/") : "—";
  const badge = (label, dateStr)=>{
    if(!dateStr) return `<span class="badge">${label} —</span>`;
    const d=new Date(dateStr);
    const diff = Math.ceil((d - new Date())/(1000*60*60*24));
    if(diff<0) return `<span class="badge danger">${label} overdue</span>`;
    if(diff<=30) return `<span class="badge warn">${label} ${diff}d</span>`;
    return `<span class="badge">${label} ok</span>`;
  };
  return `
  <div class="page">
    <div class="pageHeader">
      <div>
        <div class="h1">Fleet</div>
        <div class="sub">Vehicles & compliance (WOF/COF, rego, servicing, odometer).</div>
      </div>
      <div class="row" style="gap:10px">
        <button class="btn" id="btnAddFleet" type="button">Add vehicle</button>
      </div>
    </div>
    <div class="card">
      <div class="row" style="gap:10px; flex-wrap:wrap">
        <input class="input" id="fleetSearch" placeholder="Search fleet…" value="${escapeAttr(q)}" style="flex:1; min-width:220px" />
        <select class="input" id="fleetStatus" style="max-width:180px">
          <option value="active" ${statusFilter==="active"?"selected":""}>Active</option>
          <option value="maintenance" ${statusFilter==="maintenance"?"selected":""}>Maintenance</option>
          <option value="retired" ${statusFilter==="retired"?"selected":""}>Retired</option>
          <option value="all" ${statusFilter==="all"?"selected":""}>All</option>
        </select>
      </div>
    </div>
    <div class="list">
      ${filtered.length ? filtered.map(v=>{
        const proj = v.projectId ? projMap.get(String(v.projectId)) : null;
        const loc = proj ? `Site: ${escapeHtml(proj.name)} (${escapeHtml(proj.address||"")})` : (v.locationText ? escapeHtml(v.locationText) : "—");
        return `
        <div class="listItem">
          <div class="row space" style="align-items:flex-start; gap:12px; flex-wrap:wrap">
            <div style="min-width:220px">
              <div style="font-weight:800; font-size:1.05rem">${escapeHtml(v.name||"Unnamed vehicle")}</div>
              <div class="sub">${escapeHtml(v.vehicleType||"")}${v.plate?` • ${escapeHtml(v.plate)}`:""}</div>
              <div class="sub" style="margin-top:6px"><b>Location:</b> ${loc}</div>
              ${e.updatedByName?`<div class="sub" style="margin-top:4px">Last update: <b>${escapeHtml(e.updatedByName)}</b></div>`:""}
            </div>
            <div style="flex:1; min-width:240px">
              <div class="row" style="gap:8px; flex-wrap:wrap">
                ${badge("Service", v.nextServiceDate)}
                ${badge("WOF", v.wofExpiry)}
                ${badge("Reg", v.regExpiry)}
              </div>
              <div class="sub" style="margin-top:6px">
                Service due: <b>${fmt(v.nextServiceDate)}</b> • WOF: <b>${fmt(v.wofExpiry)}</b> • Reg: <b>${fmt(v.regExpiry)}</b>
                ${v.odometerKm?` • Odo: <b>${escapeHtml(v.odometerKm)}km</b>`:""}
              </div>
            </div>
            <div class="row" style="gap:8px; align-items:center">
              <button class="btn ghost sm" type="button" data-fleet-edit="${escapeAttr(v.id)}">Edit</button>
              
            </div>
          </div>
        </div>`;
      }).join("") : `<div class="card"><div class="sub">No fleet yet. Tap <b>Add vehicle</b> to start your fleet register.</div></div>`}
    </div>
  </div>`;
}



function renderEquipment(){
  const items = aliveArr(state.equipment).filter(e=>!e.deletedAt);
  const q = (state.ui && state.ui.equipQuery) ? String(state.ui.equipQuery).toLowerCase() : "";
  const statusFilter = (state.ui && state.ui.equipStatus) ? state.ui.equipStatus : "active";
  const locOnly = equipLocationOnly();
  const addBtnHtml = locOnly ? "" : `<button class="btn" id="btnAddEquip" type="button">Add equipment</button>`;
  const filtered = items.filter(e=>{
    const st = (e.status||"active");
    if(statusFilter==="active" && st!=="active") return false;
    if(statusFilter==="all") return true;
    if(statusFilter==="retired" && st!=="retired") return false;
    if(statusFilter==="maintenance" && st!=="maintenance") return false;
    return true;
  }).filter(e=>{
    if(!q) return true;
    const hay = `${e.name||""} ${e.category||""} ${e.assetTag||""} ${e.locationText||""}`.toLowerCase();
    return hay.includes(q);
  }).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const projMap = new Map(aliveArr(state.projects).map(p=>[String(p.id), p]));
  const fmt = (s)=> s ? String(s).slice(0,10).split("-").reverse().join("/") : "—";
  const badgeTT = (dateStr)=>{
    if(!dateStr) return `<span class="badge">Test & Tag —</span>`;
    const d=new Date(dateStr);
    const diff = Math.ceil((d - new Date())/(1000*60*60*24));
    if(diff<0) return `<span class="badge danger">T&T overdue</span>`;
    if(diff<=30) return `<span class="badge warn">T&T ${diff}d</span>`;
    return `<span class="badge">T&T ok</span>`;
  };
  return `
  <div class="page">
    <div class="pageHeader">
      <div>
        <div class="h1">Equipment</div>
        <div class="sub">Tools, plant & assets (location, assignment, test & tag).</div>
      </div>
      <div class="row" style="gap:10px">
        ${addBtnHtml}
      </div>
    </div>
    <div class="card">
      <div class="row" style="gap:10px; flex-wrap:wrap">
        <input class="input" id="equipSearch" placeholder="Search equipment…" value="${escapeAttr(q)}" style="flex:1; min-width:220px" />
        <select class="input" id="equipStatus" style="max-width:180px">
          <option value="active" ${statusFilter==="active"?"selected":""}>Active</option>
          <option value="maintenance" ${statusFilter==="maintenance"?"selected":""}>Maintenance</option>
          <option value="retired" ${statusFilter==="retired"?"selected":""}>Retired</option>
          <option value="all" ${statusFilter==="all"?"selected":""}>All</option>
        </select>
      </div>
    </div>
    <div class="list">
      ${filtered.length ? filtered.map(e=>{
        const proj = e.projectId ? projMap.get(String(e.projectId)) : null;
        const loc = proj ? `Site: ${escapeHtml(proj.name)} (${escapeHtml(proj.address||"")})` : (e.locationText ? escapeHtml(e.locationText) : "—");
        return `
        <div class="listItem">
          <div class="row space" style="align-items:flex-start; gap:12px; flex-wrap:wrap">
            <div style="min-width:220px">
              <div style="font-weight:800; font-size:1.05rem">${escapeHtml(e.name||"Unnamed equipment")}</div>
              <div class="sub">${escapeHtml(e.category||"")}${e.assetTag?` • ${escapeHtml(e.assetTag)}`:""}</div>
              <div class="sub" style="margin-top:6px"><b>Location:</b> ${loc}</div>
            </div>
            <div style="flex:1; min-width:240px">
              <div class="row" style="gap:8px; flex-wrap:wrap">${badgeTT(e.testTagDue)}</div>
              <div class="sub" style="margin-top:6px">Test & Tag due: <b>${fmt(e.testTagDue)}</b></div>
            </div>
            <div class="row" style="gap:8px; align-items:center">
              ${locOnly ? `<button class="btn ghost sm" type="button" data-equip-loc="${escapeAttr(e.id)}">Update location</button>` : `<button class="btn ghost sm" type="button" data-equip-edit="${escapeAttr(e.id)}">Edit</button>`}
              
            </div>
          </div>
        </div>`;
      }).join("") : `<div class="card"><div class="sub">No equipment yet. Tap <b>Add equipment</b> to start your asset register.</div></div>`}
    </div>
  </div>`;
}



function fleetFormModal(v){
  const isNew = !v;
  const veh = v ? {...v} : { id: uid(), status:"active", name:"", vehicleType:"", plate:"", projectId:"", locationText:"", notes:"", nextServiceDate:"", wofExpiry:"", regExpiry:"", odometerKm:"" };
  const projs = aliveArr(state.projects).filter(p=>!p.deletedAt).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const fmtIn = (s)=> (s && String(s).length>=10) ? String(s).slice(0,10) : "";
  return `
  <div class="modal"><div class="modalCard">
    <div class="row space" style="align-items:center">
      <div><div class="h2">${isNew?"Add vehicle":"Edit vehicle"}</div><div class="sub">Fleet compliance + servicing.</div></div>
      <button class="iconBtn" id="closeModalBtn" type="button">✕</button>
    </div>
    <div class="grid2" style="margin-top:14px">
      <div><label class="label">Name</label><input class="input" id="fleetName" value="${escapeAttr(veh.name)}" placeholder="e.g. Hilux Ute" /></div>
      <div><label class="label">Type</label><input class="input" id="fleetType" value="${escapeAttr(veh.vehicleType)}" placeholder="Ute / Van / Truck / Trailer" /></div>
      <div><label class="label">Plate / Identifier</label><input class="input" id="fleetPlate" value="${escapeAttr(veh.plate)}" placeholder="e.g. ABC123" /></div>
      <div><label class="label">Status</label>
        <select class="input" id="fleetStatusIn">
          <option value="active" ${veh.status==="active"?"selected":""}>Active</option>
          <option value="maintenance" ${veh.status==="maintenance"?"selected":""}>Maintenance</option>
          <option value="retired" ${veh.status==="retired"?"selected":""}>Retired</option>
        </select>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="h3">Location</div>
      <div class="grid2" style="margin-top:10px">
        <div><label class="label">Assigned site (optional)</label>
          <select class="input" id="fleetProject">
            <option value="">— Not linked to a site —</option>
            ${projs.map(p=>`<option value="${escapeAttr(p.id)}" ${String(veh.projectId)===String(p.id)?"selected":""}>${escapeHtml(p.name||"Project")} • ${escapeHtml(p.address||"")}</option>`).join("")}
          </select>
        </div>
        <div><label class="label">Location note (optional)</label><input class="input" id="fleetLocText" value="${escapeAttr(veh.locationText||"")}" placeholder="e.g. Yard / With foreman" /></div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="h3">Compliance</div>
      <div class="grid3" style="margin-top:10px">
        <div><label class="label">Service due</label><input class="input" id="fleetServiceDue" type="date" value="${escapeAttr(fmtIn(veh.nextServiceDate))}" /></div>
        <div><label class="label">WOF/COF expiry</label><input class="input" id="fleetWof" type="date" value="${escapeAttr(fmtIn(veh.wofExpiry))}" /></div>
        <div><label class="label">Registration expiry</label><input class="input" id="fleetReg" type="date" value="${escapeAttr(fmtIn(veh.regExpiry))}" /></div>
      </div>
      <div style="margin-top:10px"><label class="label">Odometer (km)</label><input class="input" id="fleetOdo" value="${escapeAttr(veh.odometerKm||"")}" placeholder="e.g. 128000" /></div>
    </div>
    <div style="margin-top:14px"><label class="label">Notes</label><textarea class="input" id="fleetNotes" rows="4">${escapeHtml(veh.notes||"")}</textarea></div>
    <div class="row" style="justify-content:flex-end; gap:10px; margin-top:16px">
      <button class="btn ghost" id="cancelModalBtn" type="button">Cancel</button>
      <button class="btn ghost" id="deleteFleetBtn" type="button" style="${isNew?'display:none':''}">Delete</button>
      <button class="btn" id="saveFleetBtn" type="button">${isNew?"Create":"Save"}</button>
    </div>
  </div></div>`;
}
function equipmentFormModal(e){
  const isNew = !e;
  const eq = e ? {...e} : { id: uid(), status:"active", name:"", category:"", assetTag:"", projectId:"", locationText:"", notes:"", testTagDue:"" };
  const projs = aliveArr(state.projects).filter(p=>!p.deletedAt).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  const fmtIn = (s)=> (s && String(s).length>=10) ? String(s).slice(0,10) : "";
  return `
  <div class="modal"><div class="modalCard">
    <div class="row space" style="align-items:center">
      <div><div class="h2">${isNew?"Add equipment":"Edit equipment"}</div><div class="sub">Asset tracking + test & tag.</div></div>
      <button class="iconBtn" id="closeModalBtn" type="button">✕</button>
    </div>
    <div class="grid2" style="margin-top:14px">
      <div><label class="label">Name</label><input class="input" id="equipNameIn" value="${escapeAttr(eq.name)}" placeholder="e.g. Laser level" /></div>
      <div><label class="label">Category</label><input class="input" id="equipCat" value="${escapeAttr(eq.category)}" placeholder="Tool / Plant / Safety gear" /></div>
      <div><label class="label">Asset tag</label><input class="input" id="equipTag" value="${escapeAttr(eq.assetTag)}" placeholder="e.g. MCB-TOOL-14" /></div>
      <div><label class="label">Status</label>
        <select class="input" id="equipStatusIn">
          <option value="active" ${eq.status==="active"?"selected":""}>Active</option>
          <option value="maintenance" ${eq.status==="maintenance"?"selected":""}>Maintenance</option>
          <option value="retired" ${eq.status==="retired"?"selected":""}>Retired</option>
        </select>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="h3">Location</div>
      <div class="grid2" style="margin-top:10px">
        <div><label class="label">Assigned site (optional)</label>
          <select class="input" id="equipProject">
            <option value="">— Not linked to a site —</option>
            ${projs.map(p=>`<option value="${escapeAttr(p.id)}" ${String(eq.projectId)===String(p.id)?"selected":""}>${escapeHtml(p.name||"Project")} • ${escapeHtml(p.address||"")}</option>`).join("")}
          </select>
        </div>
        <div><label class="label">Location note (optional)</label><input class="input" id="equipLocText" value="${escapeAttr(eq.locationText||"")}" placeholder="e.g. In container / With apprentice" /></div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="h3">Compliance</div>
      <div class="grid2" style="margin-top:10px">
        <div><label class="label">Test & Tag due</label><input class="input" id="equipTT" type="date" value="${escapeAttr(fmtIn(eq.testTagDue))}" /></div>
        <div class="sub" style="align-self:end; opacity:.8">Optional for non-electrical gear.</div>
      </div>
    </div>
    <div style="margin-top:14px"><label class="label">Notes</label><textarea class="input" id="equipNotes" rows="4">${escapeHtml(eq.notes||"")}</textarea></div>
    <div class="row" style="justify-content:flex-end; gap:10px; margin-top:16px">
      <button class="btn ghost" id="cancelModalBtn" type="button">Cancel</button>
      <button class="btn ghost" id="deleteEquipBtn" type="button" style="${isNew?'display:none':''}">Delete</button>
      <button class="btn" id="saveEquipBtn" type="button">${isNew?"Create":"Save"}</button>
    </div>
  </div></div>`;
}







function equipLocationOnly(){
  if(!workerModeEnabled()) return false;
  const w = currentWorker();
  if(!w || w.isAdmin) return false;
  return !!(w.perms && w.perms.equipment && w.perms.equipment.locationOnly);
}

function currentActor(){
  const w = workerModeEnabled() ? currentWorker() : null;
  if(w) return { id: String(w.id||""), name: String(w.name||"Worker") };
  return { id: "admin", name: "Admin" };
}

function addActivity(entry){
  try{
    state.activityLog = aliveArr(state.activityLog);
    const e = { id: uid(), at: nowISO(), ...entry };

    // Best-effort attribution to the currently selected worker (if any)
    try{
      const wid = (settings && settings.workerMode && settings.workerMode.currentWorkerId) ? String(settings.workerMode.currentWorkerId) : "";
      if(!e.workerId && wid) e.workerId = wid;
      if(!e.workerName && (e.workerId || wid)){
        const w = workerById(e.workerId || wid);
        if(w && w.name) e.workerName = w.name;
      }
    }catch(_){}

    state.activityLog.unshift(e);
    if(state.activityLog.length > 500) state.activityLog = state.activityLog.slice(0, 500);
  }catch(err){}
}
function bindFleetEvents(){
  state.ui = state.ui || {};
  const q = document.getElementById("fleetSearch");
  const st = document.getElementById("fleetStatus");
  const add = document.getElementById("btnAddFleet");
  if(q){
    q.oninput = ()=>{ state.ui.fleetQuery = q.value; saveState(state); requestRender(); };
  }
  if(st){
    st.onchange = ()=>{ state.ui.fleetStatus = st.value; saveState(state); requestRender(); };
  }
  if(add){
    add.onclick = ()=>{ openModal(fleetFormModal(null)); bindFleetModal(null); };
  }
}
function bindFleetModal(id){
  const existing = id ? fleetById(id) : null;
  const btn = document.getElementById("saveFleetBtn");
  if(btn){
    btn.onclick = ()=>{
      const v = existing ? {...existing} : { id: uid(), status:"active" };
      v.name = (document.getElementById("fleetName").value||"").trim();
      v.vehicleType = (document.getElementById("fleetType").value||"").trim();
      v.plate = (document.getElementById("fleetPlate").value||"").trim();
      v.status = document.getElementById("fleetStatusIn").value;
      v.projectId = document.getElementById("fleetProject").value || "";
      v.locationText = (document.getElementById("fleetLocText").value||"").trim();
      v.nextServiceDate = document.getElementById("fleetServiceDue").value || "";
      v.wofExpiry = document.getElementById("fleetWof").value || "";
      v.regExpiry = document.getElementById("fleetReg").value || "";
      v.odometerKm = (document.getElementById("fleetOdo").value||"").trim();
      v.notes = (document.getElementById("fleetNotes").value||"").trim();
      if(!v.name){ alert("Please enter a name."); return; }
      upsertFleet(v);
      closeModal();
      try{ const r=parseRoute(); if(r.path==="fleet"){ requestRender(); } }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

    };
  }
  const del = document.getElementById("deleteFleetBtn");
  if(del && existing){
    del.onclick = ()=>{
      if(!confirm("Delete this vehicle?")) return;
      softDeleteFleet(existing.id);
      closeModal();
      requestRender();
    };
  }

}
function bindEquipmentEvents(){
  state.ui = state.ui || {};
  const q = document.getElementById("equipSearch");
  const st = document.getElementById("equipStatus");
  const add = document.getElementById("btnAddEquip");
  if(q){
    q.oninput = ()=>{ state.ui.equipQuery = q.value; saveState(state); requestRender(); };
  }
  if(st){
    st.onchange = ()=>{ state.ui.equipStatus = st.value; saveState(state); requestRender(); };
  }
  if(add){
    add.onclick = ()=>{ openModal(equipmentFormModal(null)); bindEquipModal(null); };
  }
}
function bindEquipModal(id){
  const existing = id ? equipmentById(id) : null;
  const btn = document.getElementById("saveEquipBtn");
  if(btn){
    btn.onclick = ()=>{
      const e = existing ? {...existing} : { id: uid(), status:"active" };
      e.name = (document.getElementById("equipNameIn").value||"").trim();
      e.category = (document.getElementById("equipCat").value||"").trim();
      e.assetTag = (document.getElementById("equipTag").value||"").trim();
      e.status = document.getElementById("equipStatusIn").value;
      e.projectId = document.getElementById("equipProject").value || "";
      e.locationText = (document.getElementById("equipLocText").value||"").trim();
      e.testTagDue = document.getElementById("equipTT").value || "";
      e.notes = (document.getElementById("equipNotes").value||"").trim();
      if(!e.name){ alert("Please enter a name."); return; }
      upsertEquipment(e);
      closeModal();
      try{ const r=parseRoute(); if(r.path==="equipment"){ requestRender(); } }catch(e2){}
    };
  }
}

function equipmentLocationModal(e){
  const existing = e || {};
  return `
  <div class="modal">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title">Update location</div>
        <button class="btn btn-ghost" id="closeModalBtn">Close</button>
      </div>
      <div class="modal-body">
        <div class="muted" style="margin-bottom:10px;">${escapeHtml(existing.name||"Equipment")}</div>

        <label class="label">Assigned site</label>
        <select id="equipLocProject" class="input">
          <option value="">— Not assigned —</option>
          ${projectsActive().map(p=>`<option value="${p.id}" ${p.id===existing.projectId?"selected":""}>${escapeHtml(p.name||"")}</option>`).join("")}
        </select>

        <label class="label" style="margin-top:12px;">Location note</label>
        <input id="equipLocTextIn" class="input" placeholder="e.g. Site container, Van, Garage" value="${escapeAttr(existing.locationText||"")}" />

        <div class="divider" style="margin:14px 0;"></div>
        <button class="btn btn-primary" id="saveEquipLocBtn">Save location</button>
      </div>
    </div>
  </div>`;
}

function bindEquipLocationModal(id){
  const c = document.getElementById("closeModalBtn");
  if(c) c.onclick = ()=>closeModal();

  const existing = id ? equipmentById(id) : null;
  const btn = document.getElementById("saveEquipLocBtn");
  if(btn){
    btn.onclick = ()=>{
      if(!existing){ alert("Equipment not found."); return; }
      const e = {...existing};
      e.projectId = document.getElementById("equipLocProject").value || "";
      e.locationText = (document.getElementById("equipLocTextIn").value||"").trim();
      upsertEquipment(e, { locationOnly:true });
      closeModal();
      requestRender();
    };
  }
}

// Helper used by modal
function escapeAttr(s){ return escapeHtml(String(s||"")).replace(/"/g,"&quot;"); }




document.addEventListener("click",(ev)=>{
  const b = ev.target && ev.target.closest ? ev.target.closest("[data-tab]") : null;
  if(!b) return;
  const tab = b.getAttribute("data-tab");
  if(tab==="fleet") location.hash = "#/fleet";
  if(tab==="equipment") location.hash = "#/equipment";
});

function requestRender(){
  try{
    if(typeof render==="function"){ render(); return; }
    if(typeof showApp==="function"){ showApp(); return; }
  }catch(e){ console.warn("requestRender failed", e); }
}

function postRenderBindings(){
  try{
    const r = (typeof parseRoute==="function") ? parseRoute() : {path:""};
    if(r && r.path==="fleet" && typeof bindFleetEvents==="function") bindFleetEvents();
    if(r && r.path==="equipment" && typeof bindEquipmentEvents==="function") bindEquipmentEvents();
  }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}

// MCB_EDIT_ONLY_DELEGATE_V6
document.addEventListener("click",(ev)=>{
  const ef = ev.target && ev.target.closest ? ev.target.closest("[data-fleet-edit]") : null;
  if(ef){
    const id = ef.getAttribute("data-fleet-edit");
    openModal(fleetFormModal(fleetById(id)));
    bindFleetModal(id);
    return;
  }
  const ee = ev.target && ev.target.closest ? ev.target.closest("[data-equip-edit]") : null;
  if(ee){
    const id = ee.getAttribute("data-equip-edit");
    if(equipLocationOnly()){
      openModal(equipmentLocationModal(equipmentById(id)));
      bindEquipLocationModal(id);
    }else{
      openModal(equipmentFormModal(equipmentById(id)));
      bindEquipModal(id);
    }
    return;
  }
  const el = ev.target && ev.target.closest ? ev.target.closest("[data-equip-loc]") : null;
  if(el){
    const id = el.getAttribute("data-equip-loc");
    openModal(equipmentLocationModal(equipmentById(id)));
    bindEquipLocationModal(id);
    return;
  }
});

function setUpdateStatus(msg){
  const el = document.getElementById("updateStatus");
  if(el) el.textContent = msg;
}

async function forceAppRefresh(){
  setUpdateStatus("Refreshing app… clearing cache & reloading");
  try{
    if("caches" in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
  }catch(e){ console.warn("cache clear failed", e); }
  try{
    if(navigator.serviceWorker){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
  }catch(e){ console.warn("sw unregister failed", e); }
  // Bust the URL so GitHub Pages serves latest
  const u = new URL(location.href);
  u.searchParams.set("v", String(Date.now()));
  location.href = u.toString();
}
async function softAppRefresh(){
  setUpdateStatus("Checking for updates… reloading");
  const u = new URL(location.href);
  u.searchParams.set("v", String(Date.now()));
  location.href = u.toString();
}

// MCB_SETTINGS_REFRESH_DELEGATE_V7
document.addEventListener("click",(ev)=>{
  const b = ev.target && ev.target.closest ? ev.target.closest("#btnSoftRefresh,#btnHardRefresh") : null;
  if(!b) return;
  if(b.id==="btnSoftRefresh") softAppRefresh();
  if(b.id==="btnHardRefresh") forceAppRefresh();
});

function initUpdateStamp(){
  try{
    const prev = localStorage.getItem("mcb_last_build") || "";
    if(prev !== BUILD_ID){
      localStorage.setItem("mcb_last_build", BUILD_ID);
      localStorage.setItem("mcb_last_update_at", new Date().toISOString());
    }
  }catch(e){}
    try{
      const lu = document.getElementById('lastUpdateStamp');
      if(lu) lu.textContent = getLastUpdateStamp();
    }catch(e){}

}
function fmtDDMMYYYY(dateStr){
  try{
    if(!dateStr) return "—";
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }catch(e){ return "—"; }
}
function getLastUpdateStamp(){
  try{
    const iso = localStorage.getItem("mcb_last_update_at") || "";
    return fmtDDMMYYYY(iso) + (iso?(" " + new Date(iso).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})):"");
  }catch(e){ return "—"; }
}

function setSelected(section, id){
  state.uiSelections = state.uiSelections || {};
  state.uiSelections[section] = state.uiSelections[section] || {};
  state.uiSelections[section].selectedId = String(id||"");
  saveState(state);
}
function getSelected(section){
  try{
    return String(((state.uiSelections||{})[section]||{}).selectedId || "");
  }catch(e){ return ""; }
}

function renderTaskDetailPane(t){
  if(!t) return `<div class="sub">Tap a task to see details.</div>`;
  const p = projectById(t.projectId);
  const status = t.status || "Open";
  const due = t.dueDate ? dateFmt(t.dueDate) : "";
  // priority deprecated; using due date instead
  const assigned = t.assignedTo || t.assignee || t.owner || "";
  const category = t.category || t.trade || "";
  const created = t.createdAt ? dateFmt(String(t.createdAt).slice(0,10)) : "";
  const updated = t.updatedAt ? dateFmt(String(t.updatedAt).slice(0,10)) : "";
  const photosTaken = !!(t.photosTaken || (t.photosJson && String(t.photosJson).trim()));
  const fields = [
    ["Status", status],
    ["Due", due],    ["Assigned", assigned],
    ["Category", category],
    ["Created", created],
    ["Entered by", enteredBy],
    ["Updated", updated],
    ["Updated by", updatedBy],
    ["Photos taken", photosTaken ? "Yes" : "No"]
  ].filter(x=>x[1]);
  return `
    <div class="row space" style="align-items:flex-start; gap:10px; flex-wrap:wrap">
      <div style="min-width:220px">
        <div class="h3" style="margin:0">${escapeHtml(t.title||"(Untitled task)")}</div>
        <div class="sub">${p ? escapeHtml(p.name||p.address||"") : "No project"}</div>
      </div>
      <div class="row" style="gap:10px">
        <button class="btn ghost sm" id="taskDetailEdit" type="button">Edit</button>
      </div>
    </div>
    <div class="card" style="margin-top:10px">
      <div class="grid two" style="gap:10px">
        ${fields.map(([k,v])=>`<div><div class="sub">${escapeHtml(k)}</div><div style="margin-top:2px">${escapeHtml(String(v))}</div></div>`).join("")}
      </div>
    </div>
    <div class="card" style="margin-top:10px">
      <div class="sub">Details</div>
      <div style="margin-top:6px; white-space:pre-wrap">${escapeHtml((t.details || t.description || t.notes || "")) || "—"}</div>
    </div>
  `;
}
function bindTaskDetailPane(t){
  const b = document.getElementById("taskDetailEdit");
  if(b) b.onclick = ()=> openTaskForm(t);
}

function renderDiaryDetailPane(d){
  if(!d) return `<div class="sub">Tap a diary entry to see details.</div>`;
  const p = projectById(d.projectId);
  const date = d.date ? dateFmt(d.date) : "";
  const hours = (d.hours || d.totalHours || d.hoursWorked || "");
  const workType = d.workType || d.activity || d.trade || "";
  const crew = d.crew || d.workers || d.subbies || d.people || "";
  const weather = d.weather || "";
  const created = d.createdAt ? dateFmt(String(d.createdAt).slice(0,10)) : "";
  const updated = d.updatedAt ? dateFmt(String(d.updatedAt).slice(0,10)) : "";
  const enteredBy = d.createdByName || "";
  const updatedBy = d.updatedByName || "";
  const photosTaken = !!(d.photosTaken || (d.photosJson && String(d.photosJson).trim()));
  const fields = [
    ["Date", date],
    ["Hours", hours!=="" ? String(hours) : ""],
    ["Work type", workType],
    ["Crew", crew],
    ["Weather", weather],
    ["Photos taken", photosTaken ? "Yes" : "No"],
    ["Entered by", enteredBy],
    ["Updated by", updatedBy],
    ["Created", created],
    ["Updated", updated]
  ].filter(x=>x[1]);
  return `
    <div class="row space" style="align-items:flex-start; gap:10px; flex-wrap:wrap">
      <div style="min-width:220px">
        <div class="h3" style="margin:0">${escapeHtml(date||"(No date)")}</div>
        <div class="sub">${p ? escapeHtml(p.name||p.address||"") : "No project"}</div>
      </div>
      <div class="row" style="gap:10px">
        <button class="btn ghost sm" id="diaryDetailEdit" type="button">Edit</button>
      </div>
    </div>
    <div class="card" style="margin-top:10px">
      <div class="grid two" style="gap:10px">
        ${fields.map(([k,v])=>`<div><div class="sub">${escapeHtml(k)}</div><div style="margin-top:2px">${escapeHtml(String(v))}</div></div>`).join("")}
      </div>
    </div>
    <div class="card" style="margin-top:10px">
      <div class="sub">Notes</div>
      <div style="margin-top:6px; white-space:pre-wrap">${escapeHtml(d.notes || d.note || d.description || "") || "—"}</div>
    </div>
  `;
}
function bindDiaryDetailPane(d){
  const b = document.getElementById("diaryDetailEdit");
  if(b) b.onclick = ()=> openDiaryForm(d);
}

// MCB_V12_TAP_DETAILS
document.addEventListener("click",(ev)=>{
  const row = ev.target && ev.target.closest ? ev.target.closest("[data-action='open']") : null;
  if(!row) return;
  const id = row.dataset.id;
  const route = (typeof parseRoute==="function") ? parseRoute() : {path:""};
  if(route.path==="tasks" || route.path==="tasks/"){
    setSelected("tasks", id);
    const t = aliveArr(state.tasks).find(x=>String(x.id)===String(id));
    const body = document.getElementById("taskDetailBody");
    if(body){
      body.innerHTML = renderTaskDetailPane(t);
      bindTaskDetailPane(t);
      body.classList.remove("flash"); void body.offsetWidth; body.classList.add("flash");
    }
  }
  if(route.path==="diary" || route.path==="diary/"){
    setSelected("diary", id);
    const d = aliveArr(state.diary).find(x=>String(x.id)===String(id));
    const body = document.getElementById("diaryDetailBody");
    if(body){
      body.innerHTML = renderDiaryDetailPane(d);
      bindDiaryDetailPane(d);
      body.classList.remove("flash"); void body.offsetWidth; body.classList.add("flash");
    }
  }
});

(function(){
  const css = `.flash{ animation: flashKeyframesV12 .25s ease-out; }
  @keyframes flashKeyframesV12 { from { transform: translateY(2px); opacity:.85; } to { transform: translateY(0); opacity:1; } }`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
})();

function updateTaskDetailPanel(t, projectId){
  const body = document.getElementById("taskDetailBody");
  if(!body) return;
  body.innerHTML = (typeof renderTaskDetailPane==="function") ? renderTaskDetailPane(t) : "";
  try{ if(typeof bindTaskDetailPane==="function") bindTaskDetailPane(t, projectId); }catch(e){}
  try{ body.classList.remove("flash"); void body.offsetWidth; body.classList.add("flash"); }catch(e){}
}
function updateDiaryDetailPanel(d, projectId){
  const body = document.getElementById("diaryDetailBody");
  if(!body) return;
  body.innerHTML = (typeof renderDiaryDetailPane==="function") ? renderDiaryDetailPane(d) : "";
  try{ if(typeof bindDiaryDetailPane==="function") bindDiaryDetailPane(d, projectId); }catch(e){}
  try{ body.classList.remove("flash"); void body.offsetWidth; body.classList.add("flash"); }catch(e){}
}

function initNavMenu(){
  const btn = document.getElementById("navBtn");
  const panel = document.getElementById("navDropdown");
  const wrap = document.getElementById("navDropdownWrap");
  if(!btn || !panel) return;

  const closeMenu = ()=>{
    panel.classList.remove("show");
    panel.setAttribute("aria-hidden","true");
    btn.setAttribute("aria-expanded","false");
  };
  const openMenu = ()=>{
    try{ updateNavVisibility(); }catch(e){}
    panel.classList.add("show");
    panel.setAttribute("aria-hidden","false");
    btn.setAttribute("aria-expanded","true");
  };
  const toggleMenu = ()=>{
    if(panel.classList.contains("show")) closeMenu();
    else openMenu();
  };

  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener("click", (e)=>{
    // close if clicked outside
    if(panel.classList.contains("show")){
      const t = e.target;
      if(wrap && (wrap===t || (wrap.contains && wrap.contains(t)))) return;
      closeMenu();
    }
  }, true);

  // add Switch worker item if not present
  try{
    const list = document.getElementById("navDropdownList");
    if(list && !list.querySelector('[data-nav="switchWorker"]')){
      const div = document.createElement("div");
      div.style.cssText = "height:1px;background:var(--border);margin:6px 0;";
      const btn2 = document.createElement("button");
      btn2.className = "dropdownItem";
      btn2.type = "button";
      btn2.setAttribute("data-nav","switchWorker");
      btn2.textContent = "Switch worker";
      list.appendChild(div);
      list.appendChild(btn2);
    }
  }catch(e){}

  // menu item navigation
  panel.addEventListener("click", (e)=>{
    const b = e.target && e.target.closest ? e.target.closest("[data-nav]") : null;
    if(!b) return;
    const route = b.getAttribute("data-nav");
    if(!route) return;
    closeMenu();
    if(route === "switchWorker"){
      try{ openWorkerPicker({ title: "Switch worker" }); }catch(err){}
      return;
    }
    try{ navTo(route); }catch(err){}
  });
}
