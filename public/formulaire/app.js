import {
  cleanFieldValue as clean,
  expandFormYear as expandYear,
  normalizeTime,
  parseFormDate as parseD,
  timeMinutes as minutes,
  timePart as part,
  timeText,
  clampTimeMinutes as clampTimeToRange,
} from './form-value-utils.js';
import { countWorkedHolidays, cycleInfoFor } from './form-calendar.js';
import {
  findPdfHeader,
  humanFileSize as human,
  readFileArrayBuffer as readArrayBuffer,
  readImageAttachment as readImage,
} from './form-file-utils.js';
import { createSignatureController, drawSignature } from './form-signature-controller.js';

(function(){
"use strict";
var INK = [11,59,175], SS = 3;

var paper = document.getElementById('paper');
var stage = document.getElementById('stage');
var bg    = document.getElementById('bg');
var msgEl = document.getElementById('msg');
var sig   = document.getElementById('sig'), sctx = sig.getContext('2d');
var hint  = document.getElementById('sighint');
var clr   = document.getElementById('sigclear');
var sigSaveManual = document.getElementById('sigSaveManual');
var sigSavedDelete = document.getElementById('sigSavedDelete');
var editBox = document.getElementById('edit');
var editInp = document.getElementById('editInp');
var editLab = document.getElementById('editLab');
var timeModal = document.getElementById('timeModal');
var timeFrom = document.getElementById('timeFrom'), timeTo = document.getElementById('timeTo');
var timeTitle = document.getElementById('timeTitle'), timeError = document.getElementById('timeError');
var timeRow = null, timeOpenField = -1;
var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

var toastTimer=null;
function say(t){ msgEl.textContent = t || ''; }
function showToast(t){
  var el=document.getElementById('actionToast'); if(!el) return;
  clearTimeout(toastTimer); el.textContent=t||''; el.classList.add('on');
  toastTimer=setTimeout(function(){el.classList.remove('on');},2400);
}

/* ================= etat du feuillet courant ================= */
var M, IW, IH, PW, PH, K;
var inputs = [], IF = [], byName = {}, cells = [], cellOf = {}, extras = [];
var hasInk = false, pdfDone = false, cur = -1;
var checkState = {};
var files = {};        // justificatifs joints, en memoire uniquement
var pageSnapshots = [null], pageIndex = 0, pageCount = 1;
var observation = document.getElementById('observation');
observation.addEventListener('input', scheduleSave);

/* ================= stockage ================= */
var store = (function(){
  if(window.storage && typeof window.storage.get === 'function'){
    return { get:function(k){ return window.storage.get(k).then(function(r){ return r && r.value; }); },
             set:function(k,v){ return window.storage.set(k,v); } };
  }
  try{
    var t='__t__'; window.localStorage.setItem(t,'1'); window.localStorage.removeItem(t);
    return { get:function(k){ return Promise.resolve(window.localStorage.getItem(k)); },
             set:function(k,v){ window.localStorage.setItem(k,v); return Promise.resolve(); } };
  }catch(e){}
  return { get:function(){ return Promise.resolve(null); }, set:function(){ return Promise.resolve(); } };
})();
function key(){ return 'demandes:v4:' + M.id; }
/* Demande d'échange : la personne dont le repos vient en premier occupe la
   première ligne. Quand c'est le collègue, son nom et sa signature passent
   en haut et ceux de l'agent en bas ; les dates restent à leur place. */
/* Pendant la fabrication du PDF, l'ordre des lignes est celui de la page
   imprimée, pas celui de la page affichée. */
var pdfSnap = null;
function swapped(){
  var i=byName.ordre;
  if(i===undefined) return false;
  return (pdfSnap ? (pdfSnap.v && pdfSnap.v[i]) : (inputs[i] && inputs[i].value)) === '2';
}
function boxOf(f){ return swapped() && f.b2 ? f.b2 : f.b; }
function sheetModel(){ return M && swapped() ? Object.assign({},M,{sig:M.sig2,clr:M.clr2}) : M; }
function planningOwnerSuffix(){
  var owner=(typeof planningImport!=='undefined' && planningImport && planningImport.ownerKey) || '';
  return owner ? ':'+encodeURIComponent(String(owner).trim().toLowerCase()) : '';
}
function profileRead(){
  try{ return JSON.parse(localStorage.getItem('demandes:v6:profil'+planningOwnerSuffix()) || '{}'); }catch(e){ return {}; }
}
function profileWrite(){
  if(!M) return;
  var d = profileRead();
  if(byName.nom !== undefined) d.nom = inputs[byName.nom].value.trim();
  if(byName.groupe !== undefined) d.groupe = inputs[byName.groupe].value.trim();
  try{ localStorage.setItem('demandes:v6:profil'+planningOwnerSuffix(), JSON.stringify(d)); }catch(e){}
}
function applyProfile(){
  var d = profileRead();
  ['nom','groupe'].forEach(function(n){
    var i=byName[n]; if(i !== undefined && d[n] && !inputs[i].value) setVal(i,d[n],true);
  });
}

function recalcRow(r){
  var si = byName[r.s];
  if(si === undefined) return;
  if(inputs[si].dataset.manual === '1') return;
  var a = parseD(inputs[byName[r.f]].value);
  /* Une ligne horaire n'est complete qu'avec sa date ET ses deux heures. */
  var h1 = r.de ? minutes(inputs[byName[r.de]].value) : null;
  var h2 = r.ar ? minutes(inputs[byName[r.ar]].value) : null;
  var heuresCompletes = !r.de || !r.ar || (h1 !== null && h2 !== null) || (r.k === 'half' && !inputs[byName[r.de]].value && !inputs[byName[r.ar]].value);
  if(r.k === 'half'){ setVal(si, (a && heuresCompletes) ? '0,5' : '', true); return; }
  if(r.k === 'dur'){
    var m1 = r.de !== null ? minutes(inputs[byName[r.de]].value) : null;
    var m2 = r.ar !== null ? minutes(inputs[byName[r.ar]].value) : null;
    if(!a || m1 === null || m2 === null || m2 <= m1){ setVal(si, '', true); return; }
    var t = m2 - m1;
    setVal(si, Math.floor(t/60) + 'h' + ('0'+(t%60)).slice(-2), true);
    return;
  }
  var b = r.t ? parseD(inputs[byName[r.t]].value) : null;
  if(!a){ setVal(si, '', true); return; }
  /* Tant que la ligne n'est pas complete, « soit » reste vide : renseigner
     « du » sans « au » ne doit pas afficher 1 jour. Les lignes qui n'ont
     qu'une seule date (pas de champ « au ») restent calculees normalement. */
  if(r.t){
    if(!b){ setVal(si, '', true); return; }
  } else {
    b = a;
  }
  if(b < a){ setVal(si, '', true); return; }
  var n = Math.round((b - a) / 86400000) + 1;   // jours calendaires, bornes incluses
  setVal(si, String(n), true);
}
function recalcAll(){ M.rows.forEach(recalcRow); }

/* ================= valeurs ================= */
function paintCells(name, v){
  var cs = cellOf[name];
  if(!cs) return;
  cs.forEach(function(c){
    var t = part(v, c.src[1]);
    c.el.textContent = t;
    c.el.classList.toggle('has', t !== '');
  });
}
function setVal(i, v, silent){
  var el = inputs[i], f = IF[i];
  if(f.n === 'groupe'){
    var gm=String(v||'').match(/(?:^|\D)([123])(?:\D|$)/);
    v=gm ? gm[1] : '';
  }
  el.value = v;
  el.classList.toggle('has', v !== '');
  if(f.k === 'time') paintCells(f.n, v);
  if(cur === i) editInp.value = v;
  if(!silent) scheduleSave();
}
function onEdit(i, raw){
  var f = IF[i], v = clean(f, raw), avant = inputs[i].value;
  inputs[i].value = v;
  inputs[i].classList.toggle('has', v !== '');
  if(f.k === 'time') paintCells(f.n, v);
  if(f.k === 'soit') inputs[i].dataset.manual = v ? '1' : '0';
  if(f.zn) f.zn.classList.remove('err');
  M.rows.forEach(function(r){
    if(r.f === f.n || r.t === f.n || r.de === f.n || r.ar === f.n) recalcRow(r);
  });
  refreshAtt();
  if(f.n === 'nom' || f.n === 'groupe') profileWrite();
  /* Demande d'échange : les dates et horaires de la première partie se
     reportent dans celle du collègue, tant qu'elle n'a pas été modifiée. */
  var copie = M.mirror && byName[M.mirror[f.n]];
  if(copie !== undefined && (!inputs[copie].value || inputs[copie].value === avant)) onEdit(copie, v);
  scheduleSave();
  return v;
}

/* ================= construction du feuillet ================= */
var attBox = document.getElementById('att');
var attNote = document.getElementById('attNote');

function attNeeded(a){
  return a.when.some(function(n){
    var i = byName[n];
    return i !== undefined && inputs[i].value.trim() !== '';
  });
}
function refreshAtt(){
  var any = false;
  (M.attach || []).forEach(function(a){
    var need = attNeeded(a), row = a.row;
    row.style.display = need ? 'flex' : 'none';
    if(!need) return;
    any = true;
    var f = files[a.id];
    row.classList.toggle('ok', !!f);
    row.classList.toggle('manque', !f);
    a.nameEl.textContent = f ? f.name + '  (' + f.size + ')' : 'aucun fichier joint';
    /* Ne jamais remplacer le textContent du label lui-même : cela supprimerait
       le champ <input type="file"> qu'il contient et rendrait le bouton inactif. */
    var boutonTexte = f ? 'Remplacer' : 'Joindre un fichier';
    a.addTextEl.textContent = boutonTexte;
    a.addEl.setAttribute('aria-label', boutonTexte + ' pour ' + a.l);
    a.delEl.style.display = f ? '' : 'none';
  });
  attNote.textContent = any
    ? "Le justificatif est ajouté en page suivante du PDF. Il reste sur cet appareil et n'est pas conservé si tu recharges la page."
    : '';
}
async function takeFile(a, file){
  if(!file) return;
  say('Lecture du justificatif\u2026');
  try{
    var data;
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    var isImage = /^image\/(jpeg|png|webp)$/i.test(file.type || '') || /\.(jpe?g|png|webp)$/i.test(file.name || '');
    if(isPdf){
      /* Le moteur PDF est chargé à la demande. Les photos n'en ont pas besoin,
         ce qui expliquait pourquoi elles fonctionnaient alors que les PDF
         échouaient avec « PDFLib is not defined ». */
      await loadPdfEngine();
      var raw = await readArrayBuffer(file);
      var bytes = new Uint8Array(raw);
      var pdfOffset = findPdfHeader(bytes);
      if(pdfOffset < 0) throw new Error('le fichier sélectionné ne contient pas un PDF valide');
      if(pdfOffset > 0) bytes = bytes.slice(pdfOffset);

      /* Validation sans réécriture : la réécriture immédiate faisait échouer
         certains PDF pourtant valides (scanners, Outlook, exports administratifs).
         On conserve maintenant les octets d'origine et on les fusionne seulement
         lors de la création du document final. */
      var controle = await PDFLib.PDFDocument.load(bytes.slice(), {
        ignoreEncryption:true,
        updateMetadata:false
      });
      if(controle.getPageCount() < 1) throw new Error('PDF sans page');
      data = { kind:'pdf', bytes:bytes };
    } else if(isImage){
      data = await readImage(file);
    } else {
      throw new Error('format non pris en charge');
    }
    data.name = file.name;
    data.size = human(file.size);
    files[a.id] = data;
    say('Justificatif joint : ' + file.name); showToast('Justificatif ajouté');
  }catch(e){
    console.error('Erreur justificatif :', e);
    delete files[a.id];
    var msg = String(e && e.message ? e.message : e);
    if(/encrypt|password|prot.ge|chiffr/i.test(msg)){
      say("Ce PDF est protégé par un mot de passe. Enregistre une copie non protégée puis joins-la.");
    } else if(/format non pris en charge/i.test(msg)){
      say('Format non pris en charge. Choisis un PDF, un JPG, un PNG ou un WebP.');
    } else {
      say("Ce document n'a pas pu être lu. Essaie de l'ouvrir puis de l'enregistrer à nouveau en PDF, ou joins une photo.");
    }
  }
  refreshAtt();
}
function buildAtt(){
  attBox.innerHTML = '';
  (M.attach || []).forEach(function(a, index){
    // Chaque justificatif doit avoir sa propre clé (garde d'enfant / congé exceptionnel).
    a.id = a.id || a.n || ('justificatif-' + index);
    var row = document.createElement('div'); row.className = 'att-row';
    var lab = document.createElement('span'); lab.className = 'att-lab';
    lab.textContent = 'Justificatif — ' + a.l;
    var nm = document.createElement('span'); nm.className = 'att-name';
    var inp = document.createElement('input');
    var inputId = 'att-file-' + String(M.id || 'formulaire') + '-' + String(a.id).replace(/[^a-z0-9_-]/gi, '-');
    inp.type = 'file'; inp.id = inputId; inp.className = 'att-file-input';
    inp.accept = 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp';
    inp.setAttribute('aria-label', 'Choisir un justificatif pour ' + a.l);
    inp.addEventListener('change', function(){
      var selected = inp.files && inp.files.length ? inp.files[0] : null;
      takeFile(a, selected);
      /* Autorise la sélection du même fichier une deuxième fois. */
      inp.value = '';
    });
    /* Le vrai champ fichier reste dans le label et recouvre toute sa surface.
       Le texte est placé dans un span séparé afin que refreshAtt() puisse le
       modifier sans supprimer accidentellement le champ fichier. */
    var add = document.createElement('label');
    add.className = 'att-btn'; add.htmlFor = inputId; add.setAttribute('role', 'button'); add.tabIndex = 0;
    var addText = document.createElement('span'); addText.className = 'att-btn-text';
    add.appendChild(addText);
    add.appendChild(inp);
    add.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); inp.click(); }
    });
    var del = document.createElement('button');
    del.type = 'button'; del.className = 'att-btn ghost'; del.textContent = 'Retirer';
    del.addEventListener('click', function(){ delete files[a.id]; refreshAtt(); say('Justificatif retiré.'); });
    row.appendChild(lab); row.appendChild(nm); row.appendChild(add); row.appendChild(del);
    attBox.appendChild(row);
    a.row = row; a.nameEl = nm; a.addEl = add; a.addTextEl = addText; a.inputEl = inp; a.delEl = del;
  });
  refreshAtt();
}

function paintCheck(c){
  if(!checkState[c.n]){ c.el.innerHTML = ''; return; }
  var w = c.b[2]-c.b[0], h = c.b[3]-c.b[1];
  var m = Math.min(w,h)*0.14, lw = Math.min(w,h)*0.20;
  c.el.innerHTML =
    '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" aria-hidden="true">' +
    '<line x1="'+m+'" y1="'+m+'" x2="'+(w-m)+'" y2="'+(h-m)+'" stroke="#0b3baf" ' +
      'stroke-width="'+lw+'" stroke-linecap="round"/>' +
    '<line x1="'+(w-m)+'" y1="'+m+'" x2="'+m+'" y2="'+(h-m)+'" stroke="#0b3baf" ' +
      'stroke-width="'+lw+'" stroke-linecap="round"/></svg>';
}
function clearSheet(){
  extras.forEach(function(e){ if(e.parentNode) e.parentNode.removeChild(e); });
  extras = []; inputs = []; IF = []; byName = {}; cells = []; cellOf = {};
  cur = -1; editBox.classList.remove('on');
  if(timeModal) closeTimePicker();
}
function track(el){ extras.push(el); paper.appendChild(el); }

function loadSheet(idx){
  closeSigSavePrompt();
  clearSheet();
  calRangeHelpShown = false;
  hideRangeHelp();
  calLastView = null;
  M = SHEETS[idx];
  IW = M.img[0]; IH = M.img[1]; PW = M.page[0]; PH = M.page[1]; K = PW / IW;
  bg.src = M.bg;
  document.title = M.name;

  (M.stamps || []).forEach(function(q){
    var im = document.createElement('img');
    im.className = 'patch'; im.src = q.d; im.alt = '';
    track(im); q.el = im;
  });
  (M.patches || []).forEach(function(q){
    var d = document.createElement('div');
    d.className = 'patch';
    d.style.background = 'rgb(' + q.p[0] + ',' + q.p[1] + ',' + q.p[2] + ')';
    track(d); q.el = d;
  });

  M.fields.forEach(function(f){
    var el;
    if(f.i){
      if(f.n === 'groupe'){
        el = document.createElement('select');
        el.className = 'fld left group-select';
        [['','Sélectionner'],['1','1'],['2','2'],['3','3']].forEach(function(o){
          var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; el.appendChild(op);
        });
      } else {
        el = document.createElement('input');
        el.type = 'text';
        el.className = 'fld' + (f.a === 'left' ? ' left' : '') + ((f.k === 'time' || f.k === 'timerange') ? ' grp' : '') + (f.n === 'motif' ? ' motif-field' : '');
        el.setAttribute('autocomplete','off'); el.setAttribute('autocorrect','off');
        el.setAttribute('spellcheck','false');
        if(f.k === 'date'){ el.setAttribute('inputmode','numeric'); el.maxLength = 10; el.readOnly = true; }
        if(f.k === 'time'){ el.setAttribute('inputmode','none'); el.maxLength = 5; el.readOnly = true; }
        if(f.k === 'timerange'){ el.setAttribute('inputmode','none'); el.maxLength = 15; el.readOnly = true; }
        if(f.k === 'soit'){ el.setAttribute('inputmode','decimal'); el.maxLength = 6; }
        if(f.k === 'flag') el.hidden = true;
      }
      el.setAttribute('aria-label', f.l);
      byName[f.n] = inputs.length;
      inputs.push(el);
    } else if(f.txt !== undefined){
      el = document.createElement('div');
      el.className = 'cell ink';
      el.textContent = f.txt;
    } else {
      el = document.createElement('div');
      el.className = 'cell';
      cells.push(f);
      if(!cellOf[f.src[0]]) cellOf[f.src[0]] = [];
      cellOf[f.src[0]].push(f);
    }
    var z = document.createElement('div');
    z.className = 'zone' + ((f.k === 'time' || f.k === 'timerange') ? ' z0' : '');
    if(f.k === 'flag') z.hidden = true;
    track(el); track(z);
    f.el = el; f.zn = z;
  });
  IF = M.fields.filter(function(f){ return f.i; });
  [sig2, hint2, clr2].forEach(function(el){ el.hidden = !M.sig2; });
  clearSig2();
  refreshFerieSheets();


  checkState = {};
  (M.checks || []).forEach(function(c){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chk';
    b.setAttribute('aria-label', c.l);
    b.title = c.l;
    b.addEventListener('click', function(e){
      e.preventDefault();
      var on = !checkState[c.n];
      if(on && c.grp){
        (M.checks || []).forEach(function(o){
          if(o !== c && o.grp === c.grp){ checkState[o.n] = false; paintCheck(o); }
        });
      }
      checkState[c.n] = on;
      paintCheck(c);
      closeEditor(); scheduleSave();
    });
    track(b); c.el = b;
    paintCheck(c);
  });

  inputs.forEach(function(el, i){
    el.addEventListener('input', function(){ editInp.value = onEdit(i, el.value); });
    if(IF[i].n === 'groupe'){
      el.addEventListener('change', function(){
        onEdit(i, el.value);
        updateCycleInfo();
        if(calModal.classList.contains('on')) renderCal();
      });
    }
    el.addEventListener('focus', function(){
      if(IF[i].n === 'groupe'){ closeEditor(); return; }
      if(IF[i].k === 'date'){ el.blur(); openCalendar(i); }
      else if(IF[i].k === 'time' || IF[i].k === 'timerange'){ el.blur(); openTimePicker(i); }
      else { openEditor(i); }
    });
    el.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); go(1); } });
    if(IF[i].k === 'time'){
      el.addEventListener('blur', function(){
        var v = normalizeTime(el.value);
        if(v !== el.value) setVal(i, v);
      });
    }
  });

  files = {};
  if(observation) observation.value = '';
  buildAtt();
  clearSig(); pdfDone = false;
  applyZoom(); layout();
  pageSnapshots = [null]; pageIndex = 0; pageCount = 1; updatePageUI();
  return restore().then(function(){ return restoreSavedSignature(); }).then(function(){
    applyProfile(); prefill(); recalcAll(); refreshAtt(); layout(); updateSignaturePersistenceUI(); fillAccountName();
  });
}

/* ================= placement ================= */
/* Metriques de la police des cellules, mesurees une fois a grande taille
   pour eviter les arrondis. Servent a poser les heures sur la meme ligne
   de base que les « h » et « a » imprimes du formulaire. */
var _metriquesCell = null;
function metriquesCell(el){
  if(_metriquesCell) return _metriquesCell;
  var cs = getComputedStyle(el), ref = 400;
  var c = document.createElement('canvas').getContext('2d');
  c.font = cs.fontWeight + ' ' + ref + 'px ' + cs.fontFamily;
  var m = c.measureText('0123456789');
  _metriquesCell = { asc: m.fontBoundingBoxAscent/ref, desc: m.fontBoundingBoxDescent/ref };
  return _metriquesCell;
}
function layout(){
  if(!M) return;
  var w = paper.clientWidth || bg.clientWidth;
  if(!w) return;
  var s = w / IW;
  M.fields.forEach(function(f){
    var b = boxOf(f), h = (b[3]-b[1])*s, fs = h*(f.r || 0.70)*0.97, el = f.el, z = f.zn;
    var L = b[0]*s, T = (b[1] + (f.dy || 0))*s, Wd = (b[2]-b[0])*s;
    // Les horaires utilisent exactement la même taille, graisse et hauteur que les dates.
    var hourDrop = 0;
    if(f.k === 'hour'){
      fs = h*0.70*0.97;
      /* Les chiffres flottaient au-dessus des lettres imprimees : on les
         descend pour que leur ligne de base coincide avec celle du « h ». */
      if(f.bl){
        var mc = metriquesCell(el);
        var baseDansBoite = (h - (mc.asc + mc.desc)*fs)/2 + mc.asc*fs;
        hourDrop = f.bl*s - (T + baseDansBoite);
      }
    }
    // le fond reste cale sur la zone imprimee
    z.style.left = L+'px'; z.style.top = T+'px';
    z.style.width = Wd+'px'; z.style.height = h+'px';
    // Les dates restent alignées sur les pointillés, avec un léger retrait vers la droite
    // pour un rendu plus équilibré dans toutes les rubriques.
    var dateLead = (f.k === 'date' && f.a === 'left') ? 9*s : 0;
    var textLeft = (f.cx ? f.cx[0]*s : L) - dateLead;
    var textWidth = (f.cx ? (f.cx[1]-f.cx[0])*s : Wd) + dateLead;
    el.style.left = textLeft+'px';
    el.style.width = textWidth+'px';
    el.style.height = h+'px'; el.style.fontSize = fs+'px';
    el.style.lineHeight = h+'px';   // verticalement : centre sur toute la hauteur de la case
    el.style.top = (T + hourDrop)+'px';
  });
  (M.checks || []).forEach(function(c){
    var b = c.b, h = (b[3]-b[1])*s;
    c.el.style.left = (b[0]*s)+'px'; c.el.style.top = (b[1]*s)+'px';
    c.el.style.width = ((b[2]-b[0])*s)+'px'; c.el.style.height = h+'px';

  });
  [].concat(M.patches || [], M.stamps || []).forEach(function(q){
    q.el.style.left = (q.b[0]*s)+'px'; q.el.style.top = (q.b[1]*s)+'px';
    q.el.style.width = ((q.b[2]-q.b[0])*s)+'px'; q.el.style.height = ((q.b[3]-q.b[1])*s)+'px';
  });

  sizeSig(s);
  if(M.sig2) sizeSig2(s);
  if(M.swap) Array.prototype.forEach.call(lineOrder.querySelectorAll('button'), function(b){
    b.setAttribute('aria-pressed', String(b.getAttribute('data-order') === (swapped() ? '2' : '')));
  });
}
function applyZoom(){
  var v = document.getElementById('zoom').value;
  if(v === 'fit') paper.style.width = 'min(100%, 1000px)';
  else paper.style.width = Math.round(Math.min(stage.clientWidth-20, 1000)*parseFloat(v)) + 'px';
  setTimeout(layout, 30);
}
document.getElementById('zoom').addEventListener('change', applyZoom);
function relayoutAfterResize(){
  clearTimeout(window.__rz);
  window.__rz = setTimeout(function(){
    applyZoom();
    requestAnimationFrame(function(){ layout(); requestAnimationFrame(layout); });
    setTimeout(layout, 180);
    setTimeout(layout, 420);
  }, 70);
}
window.addEventListener('resize', relayoutAfterResize);
if(window.ResizeObserver){
  var layoutObserver = new ResizeObserver(function(){
    requestAnimationFrame(layout);
  });
  layoutObserver.observe(stage);
  layoutObserver.observe(paper);
}
document.body.classList.remove('dark','clean');

/* ================= barre d'edition ================= */
function leaveField(i){
  if(i < 0 || !IF[i]) return;
  var k = IF[i].k;
  if(k !== 'date' && k !== 'time') return;
  var v = k === 'date' ? expandYear(inputs[i].value) : normalizeTime(inputs[i].value);
  if(v !== inputs[i].value) setVal(i, v);
}
function openEditor(i){
  leaveField(cur);
  cur = i;
  var f = IF[i];
  editLab.textContent = f.l + '   (' + (i+1) + '/' + inputs.length + ')';
  editInp.value = inputs[i].value;
  editInp.setAttribute('inputmode',
    (f.k === 'date' || f.k === 'time') ? 'numeric' : (f.k === 'soit' ? 'decimal' : 'text'));
  editInp.maxLength = f.k === 'date' ? 10 : (f.k === 'time' ? 5 : (f.k === 'soit' ? 6 : 120));
  editInp.placeholder = f.k === 'time' ? '0900' : '';
  editBox.classList.add('on');
  if(coarse){ inputs[i].blur(); setTimeout(function(){ editInp.focus(); editInp.select(); }, 0); }
}
function closeEditor(){ editBox.classList.remove('on'); cur = -1; }
function go(step){
  var i = cur < 0 ? 0 : cur + step;
  while(IF[i] && IF[i].k === 'flag') i += step < 0 ? -1 : 1;
  if(i < 0) i = 0;
  if(i >= inputs.length) i = inputs.length - 1;
  while(i > 0 && IF[i].k === 'flag') i--;
  inputs[i].scrollIntoView({block:'center', behavior:'smooth'});
  openEditor(i);
  if(!coarse) inputs[i].focus();
}
editInp.addEventListener('input', function(){ if(cur >= 0) editInp.value = onEdit(cur, editInp.value); });
editInp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); go(1); } });
document.getElementById('navPrev').addEventListener('click', function(){ go(-1); });
document.getElementById('navNext').addEventListener('click', function(){ go(1); });
document.getElementById('navDone').addEventListener('click', function(){ editInp.blur(); leaveField(cur); closeEditor(); });
document.addEventListener('pointerdown', function(e){
  if(cur < 0) return;
  if(e.target.closest('.edit') || e.target.classList.contains('fld') || e.target.id === 'sig') return;
  closeEditor();
}, true);


/* ================= choix des horaires ================= */
function clampTimeMinutes(value, fallback){
  return clampTimeToRange(minutes(value), fallback, 9*60, 19*60+30, 15);
}
var DEBUT_MIN = 9*60, FIN_MAX = 19*60+30, PAS = 15;
function buildTimeOptions(){
  if(timeFrom.options.length) return;
  for(var t=DEBUT_MIN; t<=FIN_MAX; t+=PAS){
    var label = timeText(t);
    /* Un début à 19h30 ne laisserait aucune fin possible : on ne le propose pas. */
    if(t < FIN_MAX) timeFrom.add(new Option(label, t));
    timeTo.add(new Option(label, t));
  }
}
/* La liste « À » ne propose que les créneaux postérieurs à l'heure de début.
   Les autres sont masqués, y compris dans la roue native du téléphone. */
function limiterHeuresDeFin(){
  var debut = +timeFrom.value;
  var premierValide = null;
  Array.prototype.forEach.call(timeTo.options, function(o){
    var invalide = +o.value <= debut;
    o.disabled = invalide;
    o.hidden = invalide;
    if(!invalide && premierValide === null) premierValide = o.value;
  });
  if(+timeTo.value <= debut && premierValide !== null) timeTo.value = premierValide;
}
function rowForTime(name){
  for(var i=0;i<M.rows.length;i++){
    var r=M.rows[i];
    if(r.de === name || r.ar === name) return r;
  }
  return null;
}
function openTimePicker(i){
  closeEditor(); closeCalendar();
  buildTimeOptions();
  timeOpenField = i;
  var f = IF[i];
  timeRow = rowForTime(f.n);
  var deName = timeRow && timeRow.de ? timeRow.de : f.n;
  var arName = timeRow && timeRow.ar ? timeRow.ar : f.n;
  var deVal = byName[deName] !== undefined ? inputs[byName[deName]].value : '';
  var arVal = byName[arName] !== undefined ? inputs[byName[arName]].value : '';
  if(f.k === 'timerange'){
    var rm = /^\s*(\d{1,2})h(\d{2})\s*(?:-|à|au)\s*(\d{1,2})h(\d{2})\s*$/i.exec(deVal);
    if(rm){ deVal=('0'+rm[1]).slice(-2)+'h'+rm[2]; arVal=('0'+rm[3]).slice(-2)+'h'+rm[4]; }
    else { deVal=''; arVal=''; }
  }
  timeFrom.value = Math.min(clampTimeMinutes(deVal, DEBUT_MIN), FIN_MAX - PAS);
  timeTo.value = clampTimeMinutes(arVal, 17*60);
  limiterHeuresDeFin();
  var lab = f.l.replace(/ — (de|à) \(heure\)$/,'');
  timeTitle.textContent = lab || 'Choisir les horaires';
  timeError.textContent = '';
  timeModal.classList.add('on');
  document.body.style.overflow = 'hidden';
  fitTimeToVisualViewport();
  setTimeout(function(){ timeFrom.focus(); },0);
}
function closeTimePicker(){
  timeModal.classList.remove('on');
  document.body.style.overflow = '';
  timeModal.style.left=''; timeModal.style.top=''; timeModal.style.width=''; timeModal.style.height='';
  timeModal.style.right=''; timeModal.style.bottom='';
  document.getElementById('timePanel').style.zoom='';
  timeRow = null; timeOpenField = -1; timeError.textContent = '';
}
function applyTimePicker(clear){
  if(timeOpenField < 0) return closeTimePicker();
  var f = IF[timeOpenField];
  var deName = timeRow && timeRow.de ? timeRow.de : f.n;
  var arName = timeRow && timeRow.ar ? timeRow.ar : f.n;
  var fromValue = timeText(+timeFrom.value);
  var toValue = timeText(+timeTo.value);
  if(!clear && +timeTo.value <= +timeFrom.value){
    timeError.textContent = "L'heure de fin doit être après l'heure de début.";
    timeTo.focus(); return;
  }
  if(f.k === 'timerange'){
    onEdit(timeOpenField, clear ? '' : (fromValue + ' - ' + toValue));
  } else {
    if(byName[deName] !== undefined) onEdit(byName[deName], clear ? '' : fromValue);
    if(byName[arName] !== undefined && arName !== deName) onEdit(byName[arName], clear ? '' : toValue);
  }
  closeTimePicker();
}

function fitTimeToVisualViewport(){
  var vv=window.visualViewport;
  if(vv){
    timeModal.style.left=vv.offsetLeft+'px'; timeModal.style.top=vv.offsetTop+'px';
    timeModal.style.width=vv.width+'px'; timeModal.style.height=vv.height+'px';
    timeModal.style.right='auto'; timeModal.style.bottom='auto';
  }
  applyModalZoom('timePanel');
}
function timeVVUpdate(){ if(timeModal.classList.contains('on')) fitTimeToVisualViewport(); }
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', timeVVUpdate);
  window.visualViewport.addEventListener('scroll', timeVVUpdate);
}

document.getElementById('timeOk').addEventListener('click', function(){ applyTimePicker(false); });
document.getElementById('timeClear').addEventListener('click', function(){ applyTimePicker(true); });
document.getElementById('timeCancel').addEventListener('click', closeTimePicker);
timeModal.addEventListener('pointerdown', function(e){ if(e.target === timeModal) closeTimePicker(); });
timeFrom.addEventListener('change', limiterHeuresDeFin);
[timeFrom,timeTo].forEach(function(el){
  el.addEventListener('change', function(){ timeError.textContent=''; });
});

/* ================= zoom des fenetres ================= */
var modalZoomLevels = { sigPanel:1, calPanel:1, timePanel:1 };
function applyModalZoom(id){
  var panel=document.getElementById(id), z=modalZoomLevels[id]||1;
  if(panel){
    var vv=window.visualViewport;
    var modal=panel.parentElement;
    var isOpen=modal && modal.classList.contains('on');
    var browserScale=(isOpen && vv && vv.scale) ? vv.scale : 1;
    var effective=Math.max(.25, z/browserScale);
    panel.style.transform='none';
    panel.style.zoom=effective;
  }
  document.querySelectorAll('.modalZoom[data-zoom-target="'+id+'"]').forEach(function(bar){
    var out=bar.querySelector('.zoomValue'); if(out) out.textContent=Math.round(z*100)+' %';
    var minus=bar.querySelector('.zoomOut'), plus=bar.querySelector('.zoomIn');
    if(minus) minus.disabled=z<=0.55; if(plus) plus.disabled=z>=1.20;
  });
}
document.querySelectorAll('.modalZoom').forEach(function(bar){
  var id=bar.getAttribute('data-zoom-target');
  bar.querySelector('.zoomOut').addEventListener('click',function(){modalZoomLevels[id]=Math.max(.55,Math.round((modalZoomLevels[id]-.10)*100)/100);applyModalZoom(id);if(id==='sigPanel')requestAnimationFrame(sizeBig);});
  bar.querySelector('.zoomIn').addEventListener('click',function(){modalZoomLevels[id]=Math.min(1.20,Math.round((modalZoomLevels[id]+.10)*100)/100);applyModalZoom(id);if(id==='sigPanel')requestAnimationFrame(sizeBig);});
  bar.querySelector('.zoomReset').addEventListener('click',function(){modalZoomLevels[id]=1;applyModalZoom(id);if(id==='sigPanel')requestAnimationFrame(sizeBig);});
  applyModalZoom(id);
});

/* ================= signature ================= */
var sigModal = document.getElementById('sigModal');
var signatureController = createSignatureController({
  win:window,
  doc:document,
  elements:{
    canvas:sig,
    hint:hint,
    clearButton:clr,
    saveButton:sigSaveManual,
    deleteButton:sigSavedDelete,
    modal:sigModal,
    bigCanvas:document.getElementById('sigBig'),
    modeBar:document.getElementById('sigModeBar'),
    typeBox:document.getElementById('sigTypeBox'),
    drawHint:document.getElementById('sigDrawHint'),
    typedName:document.getElementById('sigTypedName'),
    typedFont:document.getElementById('sigTypedFont'),
    strokeControl:document.getElementById('strokeControl'),
    canvasWrap:document.getElementById('sigCanvasWrap'),
    modeTypeButton:document.getElementById('sigModeType'),
    modeDrawButton:document.getElementById('sigModeDraw'),
    modalClearButton:document.getElementById('sigModalClear'),
    modalCancelButton:document.getElementById('sigModalCancel'),
    modalOkButton:document.getElementById('sigModalOk'),
    savePrompt:document.getElementById('sigSavePrompt'),
    savePromptBox:document.getElementById('sigSavePromptBox'),
    saveYesButton:document.getElementById('sigSaveYes'),
    saveNoButton:document.getElementById('sigSaveNo')
  },
  canvasScale:SS,
  getModel:sheetModel,
  getHasInk:function(){ return hasInk; },
  setHasInk:function(value){ hasInk=value; },
  getPdfDone:function(){ return pdfDone; },
  setPdfDone:function(value){ pdfDone=value; },
  getOwnerSuffix:planningOwnerSuffix,
  getPlanningProfile:function(){
    return (typeof planningImport!=='undefined' && planningImport && planningImport.profile) || {};
  },
  getFieldValue:function(name){
    var index=byName[name];
    return index!==undefined && inputs[index] ? inputs[index].value.trim() : '';
  },
  onPlanningProfileSynced:function(profile){
    if(typeof planningImport==='undefined' || !planningImport) return;
    planningImport.profile=profile;
    try{ localStorage.setItem(PLANNING_HANDOFF_KEY,JSON.stringify(planningImport)); }catch(e){}
  },
  closeEditor:closeEditor,
  scheduleSave:scheduleSave,
  say:say,
  showToast:showToast,
  getModalZoom:function(){ return modalZoomLevels.sigPanel || 1; },
  applyModalZoom:applyModalZoom
});
function mobileSignaturePersistence(){ return signatureController.mobilePersistence(); }
function updateSignaturePersistenceUI(){ signatureController.updatePersistenceUI(); }
/* « Prénom - Nom » vide : le nom du profil de l'application, sinon celui du
   compte Netlify. Il n'écrase jamais un nom déjà saisi. */
function fillAccountName(){
  if(byName.nom === undefined || inputs[byName.nom].value) return;
  signatureController.accountPayload().then(function(payload){
    var profile = payload && payload.form_profile;
    var name = (profile && typeof profile.full_name === 'string' && profile.full_name.trim()) ||
      (payload && typeof payload.account_name === 'string' && payload.account_name.trim()) || '';
    var i = byName.nom;
    if(name && i !== undefined && !inputs[i].value) onEdit(i, name.slice(0, 120));
  });
}
function restoreSavedSignature(){
  /* D'abord la signature gardée sur cet appareil, sinon celle du compte. */
  return signatureController.restoreSaved().then(function(){ return signatureController.restoreFromAccount(); });
}
function updateClr(){ signatureController.updateClearButton(); }
function sizeSig(scale){ signatureController.size(scale); }
function clearSig(){ signatureController.clear(); }
function sizeBig(){ signatureController.sizeBig(); }
function openSigModal(){ signatureController.openModal(); }
function closeSigModal(){ signatureController.closeModal(); }
function closeSigSavePrompt(){ signatureController.closeSavePrompt(); }

/* Seconde signature (le collègue d'un échange) : elle passe par la même
   fenêtre, mais reste propre à ce formulaire. */
var sig2 = document.getElementById('sig2'), sctx2 = sig2.getContext('2d');
/* Échange : qui occupe la première ligne, l'agent ou le collègue. */
var lineOrder = document.getElementById('lineOrder');
lineOrder.addEventListener('click', function(e){
  var b = e.target.closest('button[data-order]');
  if(!b || !M || byName.ordre === undefined) return;
  onEdit(byName.ordre, b.getAttribute('data-order'));
  layout();
  say(swapped() ? 'Le collègue est en première ligne.' : 'Vous êtes en première ligne.');
});
/* Échange de fériés : deux demandes de remplacement, une par férié. La
   feuille 1 porte votre férié, la feuille 2 celui du collègue, où vous
   passez en seconde ligne. */
var FERIE_PAIR_KEY = 'demandes:ferie-pair-v1', ferieSheets = document.getElementById('ferieSheets');
function readFeriePair(){
  try{ var d = JSON.parse(sessionStorage.getItem(FERIE_PAIR_KEY) || 'null'); return d && d.agreementDate && d.returnDate ? d : null; }
  catch(e){ return null; }
}
function feriePairOn(){ return !!(M && M.id === 'ferie' && readFeriePair() && pageCount === 2); }
function refreshFerieSheets(){
  var on = feriePairOn();
  ferieSheets.hidden = !on;
  lineOrder.hidden = !M.swap || on;
  document.getElementById('pageNav').classList.toggle('on', pageCount > 1 && !on);
  if(on) Array.prototype.forEach.call(ferieSheets.querySelectorAll('button'), function(b){
    b.setAttribute('aria-pressed', String(b.getAttribute('data-part') === String(pageIndex + 1)));
  });
}
/* Les signatures figurent sur les deux feuilles : la vôtre et, s'il a signé,
   celle du collègue, chacune à sa ligne. */
function syncFerieSignatures(){
  if(!feriePairOn()) return;
  var a = pageSnapshots[0] || {}, b = pageSnapshots[1] || {};
  ['s','s2'].forEach(function(k){ var v = a[k] || b[k]; if(v){ a[k] = v; b[k] = v; } });
  pageSnapshots[0] = a; pageSnapshots[1] = b;
}
function fillFerieSheet(data, part){
  var mine = part !== 2;
  ['rep_date','rep_de','rep_a','col_plan','col_de','col_a'].forEach(function(n){
    var i = byName[n]; if(i !== undefined){ delete inputs[i].dataset.manual; setVal(i, '', true); }
  });
  function put(name, value){ var i = byName[name]; if(i !== undefined && value) onEdit(i, value); }
  if(byName.ordre !== undefined) onEdit(byName.ordre, mine ? '' : '2');
  put('collegue', data.partnerName);
  put('rep_date', isoToFormDate(mine ? data.agreementDate : data.returnDate));
  put('rep_de', planningTime(mine ? data.agreementStart : data.returnStart));
  put('rep_a', planningTime(mine ? data.agreementEnd : data.returnEnd));
  refreshFerieSheets(); layout(); scheduleSave();
}
ferieSheets.addEventListener('click', function(e){
  var b = e.target.closest('button[data-part]'), pair = readFeriePair();
  if(!b || !pair || !M || M.id !== 'ferie') return;
  var part = +b.getAttribute('data-part');
  if(!feriePairOn() || part - 1 === pageIndex) return;
  pageSnapshots[pageIndex] = capturePage();
  syncFerieSignatures();
  pageIndex = part - 1; applyPageState(pageSnapshots[pageIndex]); updatePageUI(); refreshFerieSheets();
  say(part === 2 ? 'Feuille 2 : le férié du collègue, vous en seconde ligne.' : 'Feuille 1 : votre férié.');
});
var hint2 = document.getElementById('sighint2'), clr2 = document.getElementById('sigclear2');
var hasInk2 = false;
function sig2Box(){ return swapped() ? M.sig : M.sig2; }
function clr2Box(){ return swapped() ? M.clr : M.clr2; }
function paintSig2(ink){
  hasInk2 = ink;
  sig2.classList.toggle('has', ink);
  hint2.style.display = ink ? 'none' : '';
  clr2.style.display = ink ? 'block' : 'none';
  if(!ink) fitHint2();
}
// Selon les polices du téléphone, l'invite peut déborder : on la réduit,
// puis, si elle ne tient toujours pas, elle se raccourcit en « Collègue ».
var hint2Size = 12;
function fitHint2(){
  hint2.textContent = 'Signature du collègue';
  for(var z = hint2Size; (hint2.style.fontSize = z+'px') && z > 7 && hint2.scrollWidth > hint2.clientWidth + 1; z -= .5);
  if(hint2.scrollWidth > hint2.clientWidth + 1) hint2.textContent = 'Collègue';
}
function clearSig2(){ sctx2.clearRect(0,0,sig2.width,sig2.height); paintSig2(false); }
function drawSig2(data){
  if(!data) return;
  var im = new Image();
  im.onload = function(){ sctx2.clearRect(0,0,sig2.width,sig2.height); sctx2.drawImage(im,0,0,sig2.width,sig2.height); paintSig2(true); };
  im.src = data;
}
function sizeSig2(s){
  var b = sig2Box(), c = clr2Box();
  [sig2, hint2].forEach(function(el){
    el.style.left = (b[0]*s)+'px'; el.style.top = (b[1]*s)+'px';
    el.style.width = ((b[2]-b[0])*s)+'px'; el.style.height = ((b[3]-b[1])*s)+'px';
  });
  hint2.style.lineHeight = ((b[3]-b[1])*s)+'px';
  hint2Size = Math.max(7, Math.min(12, 30*s));
  fitHint2();
  clr2.style.left = (c[0]*s+5)+'px'; clr2.style.top = (c[1]*s)+'px';
  clr2.style.width = Math.max(46,(c[2]-c[0])*s-10)+'px';
  clr2.style.fontSize = Math.max(7, Math.min(13, 19*s))+'px';
  var w = (b[2]-b[0])*SS, h = (b[3]-b[1])*SS;
  if(sig2.width !== w || sig2.height !== h){
    var data = hasInk2 ? sig2.toDataURL('image/png') : '';
    sig2.width = w; sig2.height = h;
    if(data) drawSig2(data);
  }
}
sig2.addEventListener('pointerdown', function(e){
  e.preventDefault(); closeEditor();
  signatureController.openModal({
    canvas:sig2, hasInk:hasInk2,
    name:(byName.collegue !== undefined ? inputs[byName.collegue].value.trim() : ''),
    done:function(ink){ paintSig2(ink); pdfDone=false; scheduleSave(); }
  });
});
clr2.addEventListener('click', function(e){
  e.preventDefault(); clearSig2(); pdfDone=false; scheduleSave();
  say('Signature du collègue effacée.');
});

/* ================= calendrier ================= */
var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var JOURS_FR = ['L','M','M','J','V','S','D'];
var calModal = document.getElementById('calModal');
var calMonthSel = document.getElementById('calMonth'), calYearSel = document.getElementById('calYear');
var calGrid = document.getElementById('calGrid'), calWeekdays = document.getElementById('calWeekdays');
var calField = -1, calView = null, calSel = null, calLastView = null;
var calRangeRow = null, calRangeStart = null, calRangeEnd = null, calRangeAwaitingEnd = false;
var calRangeHelpShown = false;
var CAL_RANGE_HELP_TEXT = 'Sélectionnez maintenant la date de fin, ou à nouveau la même date pour valider une seule journée.';

MOIS_FR.forEach(function(nom, i){
  var o = document.createElement('option'); o.value = i; o.textContent = nom;
  calMonthSel.appendChild(o);
});
JOURS_FR.forEach(function(j){
  var s = document.createElement('span'); s.textContent = j; calWeekdays.appendChild(s);
});
(function(){
  var y0 = new Date().getFullYear();
  for(var y = y0 - 2; y <= y0 + 6; y++){
    var o = document.createElement('option'); o.value = y; o.textContent = y;
    calYearSel.appendChild(o);
  }
})();

function activeGroup(){
  var i=byName.groupe;
  /* Sans case « Groupe » sur la feuille, le groupe du profil donne le cycle. */
  var v=i === undefined || !inputs[i] ? profileRead().groupe : inputs[i].value;
  var m=String(v||'').match(/(?:^|\D)([123])(?:\D|$)/);
  return m ? +m[1] : 0;
}
function cycleInfo(d){
  return cycleInfoFor(d, activeGroup());
}
/* Le groupe choisi dans le calendrier nourrit la case « Groupe » quand la
   feuille en a une, sinon le profil : les feuilles d'échange et de
   remplacement de jour férié n'ont pas cette case, et leur cycle doit pouvoir
   être corrigé là où on s'en sert. */
function chooseCycleGroup(g){
  var i=byName.groupe;
  if(i !== undefined && inputs[i]) onEdit(i, String(g));
  else {
    var d=profileRead();
    d.groupe=String(g);
    try{ localStorage.setItem('demandes:v6:profil'+planningOwnerSuffix(), JSON.stringify(d)); }catch(e){}
  }
  updateCycleInfo();
  if(calModal.classList.contains('on')) renderCal();
}
/* Le choix du groupe n'est proposé que sur le site autonome Congé CP, qui n'a
   pas l'application derrière lui pour régler le planning. Sous /formulaire/ de
   Planning Solo, la case « Groupe » des feuilles reste la seule entrée. */
var standaloneSite=(document.querySelector('meta[name="planning-api"]') || {}).content === 'none';
var calGroupChoice=document.getElementById('calGroupChoice');
if(!standaloneSite && calGroupChoice){ calGroupChoice.remove(); calGroupChoice=null; }
var calGroupButtons=calGroupChoice ? [].slice.call(calGroupChoice.querySelectorAll('.calgroup')) : [];
calGroupButtons.forEach(function(b){
  b.addEventListener('click', function(){ chooseCycleGroup(+b.dataset.group); });
});
function updateCycleInfo(){
  var g=activeGroup(), el=document.getElementById('calCycleText');
  el.textContent=g ? ('Planning groupe '+g)
                   : (standaloneSite ? 'Choisissez votre groupe pour afficher le cycle.'
                                     : 'Indiquez 1, 2 ou 3 dans le champ « Groupe » pour activer le planning.');
  calGroupButtons.forEach(function(b){
    var on=+b.dataset.group === g;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  var hc=document.getElementById('calHolidayCount');
  if(hc) hc.textContent=g && calView ? countWorkedHolidays(calView.y,g)+' jours fériés travaillés en '+calView.y : '';
}
/* Jours que la case de date permet de choisir : par défaut les jours
   travaillés, seulement les jours de repos pour la date d'échange, et tous
   les jours pour celles du collègue, dont le cycle n'est pas connu, et
   seulement les fériés travaillés pour un remplacement de jour férié. */
function daySelectable(ci){
  var f=calField >= 0 ? IF[calField] : null;
  var mode=!f ? '' : (swapped() && 'cal2' in f ? f.cal2 : f.cal);
  if(mode === 'any') return true;
  if(mode === 'off') return ci.kind === 'off' || ci.kind === 'unknown';
  if(mode === 'holiday') return !!ci.holiday && ci.kind !== 'off';
  return ci.selectable;
}
function sameCalendarDay(a,b){
  return !!a && !!b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function calendarDayValue(d){
  return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
}
function rangeRowForField(i){
  if(i<0 || !IF[i] || !M || !M.rows) return null;
  var n=IF[i].n;
  for(var j=0;j<M.rows.length;j++){
    var r=M.rows[j];
    if(r.k==='range' && r.f && r.t && (r.f===n || r.t===n)) return r;
  }
  return null;
}
function firstRangeRow(){
  if(!M || !M.rows) return null;
  for(var i=0;i<M.rows.length;i++) if(M.rows[i].k==='range' && M.rows[i].f && M.rows[i].t) return M.rows[i];
  return null;
}
function hideRangeHelp(){
  var help=document.getElementById('calRangeHelp');
  if(help) help.classList.remove('on');
}
function fitRangeHelpToVisualViewport(){
  var box=document.getElementById('calRangeHelpBox');
  if(!box) return;
  var vv=window.visualViewport;
  var browserScale=vv && vv.scale ? vv.scale : 1;
  var layoutWidth=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
  var desiredWidth=Math.min(340,Math.max(250,layoutWidth-32));
  box.style.width=desiredWidth+'px';
  /* Le zoom tactile agrandit chaque pixel CSS. L'échelle inverse conserve
     une fenêtre et un texte confortables quelle que soit la vue du document. */
  box.style.transform=browserScale>1.01 ? 'scale('+(1/browserScale)+')' : '';
}
function showRangeHelpIfNeeded(){
  var first=firstRangeRow();
  if(calRangeHelpShown || !calRangeRow || calRangeRow!==first) return;
  calRangeHelpShown=true;
  var help=document.getElementById('calRangeHelp');
  /* Réinjecté à chaque ouverture afin que le mobile affiche toujours le même
     texte, notamment après avoir vidé puis réutilisé le formulaire. */
  document.getElementById('calRangeHelpText').textContent=CAL_RANGE_HELP_TEXT;
  fitRangeHelpToVisualViewport();
  help.classList.add('on');
  requestAnimationFrame(function(){ document.getElementById('calRangeHelpOk').focus(); });
}
function updateRangeHint(){
  var el=document.getElementById('calRangeHint');
  el.innerHTML='';
  if(!calRangeRow){ el.classList.remove('on','awaiting'); return; }
  el.classList.add('on');
  var step=document.createElement('span'); step.className='rangeStep';
  var date=document.createElement('strong'); date.className='rangeDate';
  var instruction=document.createElement('span'); instruction.className='rangeInstruction';
  if(calRangeAwaitingEnd && calRangeStart){
    el.classList.add('awaiting');
    step.textContent='Étape 2 sur 2';
    date.textContent='Date de début sélectionnée : '+calendarDayValue(calRangeStart);
    instruction.textContent=CAL_RANGE_HELP_TEXT;
  } else {
    el.classList.remove('awaiting');
    step.textContent='Étape 1 sur 2';
    date.textContent='Sélection de la période';
    instruction.textContent='Sélectionnez d’abord la date de début.';
  }
  el.appendChild(step); el.appendChild(date); el.appendChild(instruction);
}
function renderCal(){
  calLastView = { y: calView.y, m: calView.m };
  updateCycleInfo();
  calMonthSel.value = calView.m; calYearSel.value = calView.y;
  var first = new Date(calView.y, calView.m, 1);
  var startDow = (first.getDay() + 6) % 7;              // lundi = 0
  var daysInMonth = new Date(calView.y, calView.m + 1, 0).getDate();
  var today = new Date(); today.setHours(0,0,0,0);
  calGrid.innerHTML = '';

  // Les cases précédant le premier jour restent vides : aucune date du mois précédent.
  for(var blank = 0; blank < startDow; blank++){
    var spacer = document.createElement('span');
    spacer.className = 'calblank';
    spacer.setAttribute('aria-hidden','true');
    calGrid.appendChild(spacer);
  }

  // On affiche uniquement les jours du mois courant, sans aperçu du mois suivant.
  for(var day = 1; day <= daysInMonth; day++){
    var d = new Date(calView.y, calView.m, day);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'calday'; b.textContent = day;
    if(d.getTime() === today.getTime()) b.classList.add('today');
    var ci=cycleInfo(d);
    b.title=ci.label;
    b.setAttribute('aria-label', day+' '+MOIS_FR[d.getMonth()]+' '+d.getFullYear()+' — '+ci.label);
    if(ci.holiday){
      b.classList.add('holiday');
      var hm=document.createElement('span'); hm.className='holidayMark'; hm.textContent='F'; hm.setAttribute('aria-hidden','true'); b.appendChild(hm);
    }
    if(ci.kind==='training') b.classList.add('training');
    if(ci.kind==='off'){
      b.classList.add('off');
      if(ci.special) b.classList.add('special-off');
    }
    if(!daySelectable(ci)){
      b.disabled=true;
      b.setAttribute('aria-disabled','true');
    }
    if(calRangeRow){
      var edge=sameCalendarDay(d,calRangeStart) || sameCalendarDay(d,calRangeEnd);
      var time=d.getTime(), startTime=calRangeStart ? calRangeStart.getTime() : NaN, endTime=calRangeEnd ? calRangeEnd.getTime() : NaN;
      if(calRangeStart && calRangeEnd && time>Math.min(startTime,endTime) && time<Math.max(startTime,endTime)) b.classList.add('in-range');
      if(edge){ b.classList.add('range-edge'); b.setAttribute('aria-pressed','true'); }
    } else if(calSel && sameCalendarDay(d,calSel)) {
      b.classList.add('sel'); b.setAttribute('aria-pressed','true');
    }
    (function(dd, info){ b.addEventListener('click', function(){ if(daySelectable(info)) pickDay(dd); }); })(d,ci);
    calGrid.appendChild(b);
  }
}
function pickDay(d){
  if(!d) return;
  if(!daySelectable(cycleInfo(d))) return;
  if(calRangeRow){
    if(!calRangeAwaitingEnd || !calRangeStart){
      calRangeStart=new Date(d.getFullYear(),d.getMonth(),d.getDate());
      calRangeEnd=null;
      calRangeAwaitingEnd=true;
      onEdit(byName[calRangeRow.f],calendarDayValue(calRangeStart));
      onEdit(byName[calRangeRow.t],'');
      calSel=calRangeStart;
      updateRangeHint();
      renderCal();
      showRangeHelpIfNeeded();
      return;
    }
    var start=calRangeStart, end=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    if(end.getTime()<start.getTime()){ var swap=start; start=end; end=swap; }
    onEdit(byName[calRangeRow.f],calendarDayValue(start));
    onEdit(byName[calRangeRow.t],calendarDayValue(end));
    closeCalendar();
    return;
  }
  if(calField >= 0) onEdit(calField,calendarDayValue(d));
  closeCalendar();
}
function fitCalendarToVisualViewport(){
  var vv = window.visualViewport;
  if(vv){
    calModal.style.left   = vv.offsetLeft + 'px';
    calModal.style.top    = vv.offsetTop + 'px';
    calModal.style.width  = vv.width + 'px';
    calModal.style.height = vv.height + 'px';
    calModal.style.right  = 'auto'; calModal.style.bottom = 'auto';
  } else {
    calModal.style.left = ''; calModal.style.top = '';
    calModal.style.width = ''; calModal.style.height = '';
    calModal.style.right = ''; calModal.style.bottom = '';
  }
  applyModalZoom('calPanel');
  fitRangeHelpToVisualViewport();
}
function calVVUpdate(){ if(calModal.classList.contains('on')) fitCalendarToVisualViewport(); }
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', calVVUpdate);
  window.visualViewport.addEventListener('scroll', calVVUpdate);
}
function sameDateSource(i){
  if(i < 0 || !IF[i]) return null;
  var n = IF[i].n;
  for(var j=0;j<M.rows.length;j++){
    var r=M.rows[j];
    if(r.t === n && r.f && byName[r.f] !== undefined) return r.f;
  }
  return null;
}
function updateSameDateButton(){
  var b=document.getElementById('calSame'), src=sameDateSource(calField);
  var v=src && byName[src] !== undefined ? inputs[byName[src]].value.trim() : '';
  var box=document.getElementById('calSameBox');
  box.classList.toggle('on', !calRangeRow && !!v);
  b.textContent = v ? 'Dupliquer la date du ' + v : 'Dupliquer la date « du »';
}
function openCalendar(i){
  if(!activeGroup() && byName.groupe !== undefined){
    alert('Renseignez d’abord le groupe pour faire apparaître votre cycle de travail.');
    var gi=byName.groupe;
    if(gi !== undefined && inputs[gi]){
      inputs[gi].focus();
      inputs[gi].scrollIntoView({block:'center',behavior:'smooth'});
    }
    return;
  }
  calField = i;
  calRangeRow = rangeRowForField(i);
  calRangeStart = null;
  calRangeEnd = null;
  calRangeAwaitingEnd = false;
  var cur = parseD(inputs[i].value);
  calSel = cur || null;
  if(calRangeRow){
    var fromValue=inputs[byName[calRangeRow.f]].value;
    var toValue=inputs[byName[calRangeRow.t]].value;
    calRangeStart=parseD(fromValue) || null;
    calRangeEnd=parseD(toValue) || null;
    if(IF[i].n===calRangeRow.t && calRangeStart) calRangeAwaitingEnd=true;
  }
  var base = cur || calRangeStart || (calLastView ? new Date(calLastView.y, calLastView.m, 1) : new Date());
  // Remplacement de jour férié : ouverture sur le prochain férié travaillé.
  if(!cur && IF[i].cal === 'holiday')
    for(var d = new Date(), k = 0; k < 400; k++, d.setDate(d.getDate() + 1))
      if(daySelectable(cycleInfo(d))){ base = d; break; }
  calView = { y: base.getFullYear(), m: base.getMonth() };
  updateRangeHint();
  renderCal();
  updateSameDateButton();
  calModal.classList.add('on');
  document.body.style.overflow = 'hidden';
  fitCalendarToVisualViewport();
}
function closeCalendar(){
  hideRangeHelp();
  calModal.classList.remove('on');
  document.body.style.overflow = '';
  calModal.style.left = ''; calModal.style.top = '';
  calModal.style.width = ''; calModal.style.height = '';
  calModal.style.right = ''; calModal.style.bottom = '';
  document.getElementById('calPanel').style.transform = ''; document.getElementById('calPanel').style.zoom = '';
  calField = -1;
  calRangeRow = null; calRangeStart = null; calRangeEnd = null; calRangeAwaitingEnd = false;
  updateRangeHint();
}
function calNav(delta){
  var d = new Date(calView.y, calView.m + delta, 1);
  calView = { y: d.getFullYear(), m: d.getMonth() };
  glisserCal(delta);
}
/* Le mois suivant arrive par la droite, le precedent par la gauche. */
var calAnim = null;
function glisserCal(delta){
  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!delta || reduit){ renderCal(); return; }
  if(calAnim){ clearTimeout(calAnim); calAnim = null; }
  var sortie = delta > 0 ? 'slide-out-left' : 'slide-out-right';
  var entree = delta > 0 ? 'slide-in-right' : 'slide-in-left';
  var g = calGrid;
  g.classList.remove('slide-in-left','slide-in-right','slide-out-left','slide-out-right');
  g.classList.add(sortie);
  calAnim = setTimeout(function(){
    renderCal();
    g.classList.remove(sortie);
    g.classList.add(entree);          // place la nouvelle grille hors champ, sans transition
    void g.offsetWidth;               // force le navigateur a prendre en compte cette position
    g.classList.remove(entree);       // puis la laisse revenir en place, avec transition
    calAnim = null;
  }, 160);
}
document.getElementById('calPrev').addEventListener('click', function(){ calNav(-1); });
document.getElementById('calNext').addEventListener('click', function(){ calNav(1); });
/* swipe tactile : glisser à gauche/droite sur la grille pour changer de mois */
(function(){
  var sx=0, sy=0, active=false;
  calGrid.addEventListener('touchstart', function(e){
    if(e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; active = true;
  }, {passive:true});
  calGrid.addEventListener('touchend', function(e){
    if(!active) return;
    active = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - sx, dy = t.clientY - sy;
    if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) calNav(dx < 0 ? 1 : -1);
  }, {passive:true});
  calGrid.addEventListener('touchcancel', function(){ active = false; }, {passive:true});
})();
calMonthSel.addEventListener('change', function(){ calView.m = +this.value; renderCal(); });
calYearSel.addEventListener('change', function(){ calView.y = +this.value; renderCal(); });
document.getElementById('calSame').addEventListener('click', function(){
  var src=sameDateSource(calField);
  if(src && byName[src] !== undefined && inputs[byName[src]].value) pickDay(parseD(inputs[byName[src]].value));
});
document.getElementById('calToday').addEventListener('click', function(){ pickDay(new Date()); });
document.getElementById('calClear').addEventListener('click', function(){
  if(calRangeRow){
    onEdit(byName[calRangeRow.f], '');
    onEdit(byName[calRangeRow.t], '');
  } else if(calField >= 0) onEdit(calField, '');
  closeCalendar();
});
document.getElementById('calClose').addEventListener('click', closeCalendar);
document.getElementById('calRangeHelpOk').addEventListener('click', hideRangeHelp);
document.getElementById('calRangeHelp').addEventListener('pointerdown', function(e){ if(e.target===this) hideRangeHelp(); });
calModal.addEventListener('pointerdown', function(e){ if(e.target === calModal) closeCalendar(); });
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState==='hidden'){
    calRangeHelpShown=false;
    hideRangeHelp();
  }
});
window.addEventListener('pageshow', function(){
  calRangeHelpShown=false;
  hideRangeHelp();
});
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  if(document.getElementById('calRangeHelp').classList.contains('on')){ hideRangeHelp(); return; }
  if(sigModal.classList.contains('on')) closeSigModal();
  if(calModal.classList.contains('on')) closeCalendar();
  if(timeModal.classList.contains('on')) closeTimePicker();
});

/* ================= feuilles multiples (jusqu'a 5) ================= */
function capturePage(){
  return { v:inputs.map(function(el){return el.value;}),
           m:inputs.map(function(el){return el.dataset.manual==='1'?1:0;}),
           c:Object.assign({},checkState), s:hasInk?sig.toDataURL('image/png'):'',
           s2:hasInk2?sig2.toDataURL('image/png'):'' };
}
function applyPageState(d){
  d=d||{v:[],m:[],c:{},s:''};
  inputs.forEach(function(el,i){ var v=(d.v&&d.v[i])||''; el.value=v; el.classList.toggle('has',v!=='');
    if(IF[i].k==='time') paintCells(IF[i].n,v); if(d.m&&d.m[i]) el.dataset.manual='1'; else delete el.dataset.manual; });
  (M.checks||[]).forEach(function(c){checkState[c.n]=!!(d.c&&d.c[c.n]);paintCheck(c);});
  sctx.clearRect(0,0,sig.width,sig.height); hasInk=false; sig.classList.remove('has'); hint.style.display='';
  if(d.s){ var im=new Image(); im.onload=function(){sctx.drawImage(im,0,0,sig.width,sig.height);hasInk=true;sig.classList.add('has');hint.style.display='none';updateClr();}; im.src=d.s; }
  clearSig2(); drawSig2(d.s2);
  recalcAll(); refreshAtt(); layout();
}
function blankPageFrom(first){
  var v=inputs.map(function(){return '';});
  ['nom','groupe','date_sig'].forEach(function(n){var i=byName[n];if(i!==undefined)v[i]=(first.v&&first.v[i])||'';});
  return {v:v,m:[],c:Object.assign({},first.c||{}),s:first.s||''};
}
function updatePageUI(){
  var nav=document.getElementById('pageNav'), b=document.getElementById('btnSecond');
  nav.classList.toggle('on',pageCount>1);
  if(M && M.id === 'ferie') refreshFerieSheets();
  /* Seuls les libellés changent : l'icône du bouton reste en place. */
  b.querySelector('.tool-long').textContent=pageCount>=5?'5 feuilles maximum':'Ajouter une feuille';
  b.querySelector('.tool-short').textContent=pageCount>=5?'5 max':'Feuille';
  b.disabled=pageCount>=5;
  document.getElementById('pageStatus').textContent='Feuille '+(pageIndex+1)+' / '+pageCount;
  document.getElementById('pagePrev').disabled=pageIndex===0;
  document.getElementById('pageNext').disabled=pageIndex===pageCount-1;
  document.getElementById('pageRemove').disabled=pageCount===1;
}
function switchPage(n){
  if(n<0 || n>=pageCount || n===pageIndex) return;
  pageSnapshots[pageIndex]=capturePage(); pageIndex=n; applyPageState(pageSnapshots[n]); updatePageUI(); say('Feuille '+(n+1)+' affichée.');
}
document.getElementById('btnSecond').addEventListener('click',function(){
  if(pageCount>=5){say('Le PDF peut contenir au maximum 5 feuilles.');return;}
  pageSnapshots[pageIndex]=capturePage();
  var source=pageSnapshots[0]||pageSnapshots[pageIndex];
  pageSnapshots.push(blankPageFrom(source)); pageCount++; pageIndex=pageCount-1;
  applyPageState(pageSnapshots[pageIndex]); updatePageUI(); say('Feuille '+pageCount+' ajoutée.');
});
document.getElementById('pagePrev').addEventListener('click',function(){switchPage(pageIndex-1);});
document.getElementById('pageNext').addEventListener('click',function(){switchPage(pageIndex+1);});
document.getElementById('pageRemove').addEventListener('click',function(){
  if(pageCount===1) return;
  if(!confirm('Supprimer la feuille '+(pageIndex+1)+' du PDF ?')) return;
  pageSnapshots[pageIndex]=capturePage(); pageSnapshots.splice(pageIndex,1); pageCount--;
  if(pageIndex>=pageCount) pageIndex=pageCount-1;
  applyPageState(pageSnapshots[pageIndex]); updatePageUI(); say('Feuille supprimée.');
});

/* ================= sauvegarde ================= */
var tmr;
function scheduleSave(){
  clearTimeout(tmr);
  tmr = setTimeout(function(){
    if(!M) return;
    var base = { v: inputs.map(function(el){ return el.value; }),
                 m: inputs.map(function(el){ return el.dataset.manual === '1' ? 1 : 0; }),
                 c: checkState,
                 o: observation ? observation.value : '' };
    function put(withSig){
      /* Sur mobile, la signature n'est conservée que dans l'emplacement dédié
         après un consentement explicite. Le formulaire courant ne la sauvegarde pas en parallèle. */
      base.s = withSig && hasInk && !mobileSignaturePersistence() ? sig.toDataURL('image/png') : '';
      base.s2 = withSig && hasInk2 ? sig2.toDataURL('image/png') : '';
      return store.set(key(), JSON.stringify(base));
    }
    try{
      var r = put(true);
      if(r && r.catch) r.catch(function(){ try{ put(false); }catch(e){} });
    }catch(e){ try{ put(false); }catch(e2){} }
  }, 700);
}
function restore(){
  return store.get(key()).then(function(raw){
    if(!raw) return;
    var d = JSON.parse(raw);
    if(observation) observation.value = d.o || '';
    (d.v || []).forEach(function(v, i){
      if(!inputs[i]) return;
      inputs[i].value = v;
      inputs[i].classList.toggle('has', v !== '');
      if(IF[i].k === 'time') paintCells(IF[i].n, v);
      if(d.m && d.m[i]) inputs[i].dataset.manual = '1';
    });
    (M.checks || []).forEach(function(c){
      checkState[c.n] = !!(d.c && d.c[c.n]);
      paintCheck(c);
    });
    drawSig2(d.s2);
    if(d.s && !mobileSignaturePersistence()){
      var im = new Image();
      im.onload = function(){
        sctx.drawImage(im, 0, 0, sig.width, sig.height);
        hasInk = true; sig.classList.add('has'); hint.style.display = 'none';
        updateClr();
      };
      im.src = d.s;
    }
  }).catch(function(){});
}
function today(){
  var n = new Date();
  return ('0'+n.getDate()).slice(-2)+'/'+('0'+(n.getMonth()+1)).slice(-2)+'/'+n.getFullYear();
}
/* La date sous la signature est celle du jour de la demande. On la repose
   systematiquement apres un « Vider » (force), et on remplace une date
   perimee restauree d'une session precedente. */
function prefill(force){
  var i = byName['date_sig'];
  if(i === undefined) return;
  var actuelle = inputs[i].value;
  if(force || !actuelle || estDatePassee(actuelle)) setVal(i, today(), true);
}
function estDatePassee(v){
  var d = parseD(v);
  if(!d) return false;
  var auj = new Date();
  auj.setHours(0,0,0,0);
  return d < auj;
}
/* « Vider » se confirme d'un second appui sur le même bouton : la fenêtre de
   confirmation du navigateur est bloquée dans certaines applications et
   répondait « non » sans s'afficher, ce qui laissait tout en place. */
var resetArmed = null;
function disarmReset(){
  var b = document.getElementById('btnReset');
  clearTimeout(resetArmed); resetArmed = null;
  b.classList.remove('armed'); b.querySelector('span').textContent = 'Vider';
}
document.getElementById('btnReset').addEventListener('click', function(){
  var b = this;
  if(!resetArmed){
    b.classList.add('armed'); b.querySelector('span').textContent = 'Confirmer';
    say('Touchez à nouveau pour vider « ' + M.name + ' ».');
    resetArmed = setTimeout(disarmReset, 4000);
    return;
  }
  disarmReset();
  inputs.forEach(function(el, i){
    el.value = ''; el.classList.remove('has'); delete el.dataset.manual;
  });
  cells.forEach(function(c){ c.el.textContent = ''; c.el.classList.remove('has'); });
  (M.checks || []).forEach(function(c){ checkState[c.n] = false; paintCheck(c); });
  files = {};
  if(observation) observation.value = '';
  calLastView = null;
  calRangeHelpShown = false;
  hideRangeHelp();
  effacerErreurs();
  try{ sessionStorage.removeItem(FERIE_PAIR_KEY); }catch(e){}
  clearSig(); clearSig2(); closeEditor(); applyProfile(); prefill(true); recalcAll(); refreshAtt(); layout();
  restoreSavedSignature();
  if(pageCount>1) pageSnapshots[pageIndex]=capturePage(); scheduleSave();
  say('Formulaire vidé.'); showToast('Formulaire vidé');
});

/* ================= PDF ================= */
/* Le moteur est pdf-lib seul (pdf-engine.js) : la feuille est dessinée
   directement avec lui — fond, tampons, aplats, champs, croix, signatures —
   puis l'observation et les justificatifs s'y ajoutent. Les mêmes
   positions qu'avec jsPDF autrefois : le repère est converti (origine en
   bas à gauche) et la ligne de base « au milieu » reprend sa formule
   (milieu + 0,35 × corps, interligne 1,15). */
var pdfEnginePromise = null;
var PDF_ENGINE_VERSION = '20261020-v80';
function loadPdfEngine(){
  if(window.PDFLib) return Promise.resolve();
  if(pdfEnginePromise) return pdfEnginePromise;
  pdfEnginePromise = new Promise(function(resolve,reject){
    var ancien=document.getElementById('pdfEngineScript');
    if(ancien) ancien.remove();
    var sc=document.createElement('script');
    sc.id='pdfEngineScript';
    sc.src=new URL('./pdf-engine.js?v='+PDF_ENGINE_VERSION, window.location.href).href;
    sc.async=true;
    sc.onload=function(){
      if(window.PDFLib) resolve();
      else { pdfEnginePromise=null; reject(new Error('Moteur PDF chargé mais incomplet')); }
    };
    sc.onerror=function(){
      pdfEnginePromise=null;
      reject(new Error('Impossible de charger le moteur PDF : '+sc.src));
    };
    document.head.appendChild(sc);
  });
  return pdfEnginePromise;
}
function valueOf(f, snap){
  if(f.txt !== undefined) return f.txt;
  if(f.i){
    var idx=byName[f.n], v = snap ? ((snap.v&&snap.v[idx])||'').trim() : inputs[idx].value.trim();
    return f.k === 'date' ? expandYear(v) : v;
  }
  var si=byName[f.src[0]], sv=snap ? ((snap.v&&snap.v[si])||'') : inputs[si].value;
  return part(sv, f.src[1]);
}
/* Les octets d'une image : adresse (fond de la feuille) ou data URL (tampon,
   signature). Le fond est relu une fois par adresse. */
var pdfImageBytes = {};
function pdfBytesOf(src){
  if(pdfImageBytes[src]) return pdfImageBytes[src];
  var promise;
  if(src.indexOf('data:') === 0){
    var b = atob(src.slice(src.indexOf(',')+1)), out = new Uint8Array(b.length);
    for(var i=0;i<b.length;i++) out[i] = b.charCodeAt(i);
    promise = Promise.resolve(out);
  } else {
    promise = fetch(new URL(src, window.location.href).href).then(function(r){
      if(!r.ok) throw new Error('Fond de formulaire introuvable : '+src);
      return r.arrayBuffer();
    }).then(function(buf){ return new Uint8Array(buf); });
  }
  pdfImageBytes[src] = promise;
  promise.catch(function(){ delete pdfImageBytes[src]; });
  return promise;
}
/* Ce qu'un document partage entre ses feuilles : la police et les images
   déjà incorporées (le fond, les tampons), pour ne les écrire qu'une fois. */
async function pdfContext(doc){
  var images = {};
  return {
    doc: doc,
    font: await doc.embedFont(PDFLib.StandardFonts.HelveticaBold),
    image: async function(src, png){
      if(!images[src]){
        var bytes = await pdfBytesOf(src);
        images[src] = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      }
      return images[src];
    }
  };
}
function pdfColor(c){ return PDFLib.rgb(c[0]/255, c[1]/255, c[2]/255); }
/* Les polices standard n'écrivent que le jeu WinAnsi : un caractère hors de
   ce jeu est remplacé plutôt que de faire échouer le PDF. */
function pdfText(font, v){
  try{ font.encodeText(v); return v; }
  catch(e){
    return v.split('').map(function(ch){ try{ font.encodeText(ch); return ch; } catch(e2){ return '?'; } }).join('');
  }
}
async function drawPdfPage(ctx, snap){
  pdfSnap = snap || null;
  try{ await drawPdfSheet(ctx, snap); } finally { pdfSnap = null; }
}
async function drawPdfSheet(ctx, snap){
  var doc = ctx.doc, font = ctx.font;
  var page = doc.addPage([PW, PH]);
  /* Repère : y mesuré depuis le haut, comme à l'écran ; pdf-lib compte
     depuis le bas. */
  function top(y){ return PH - y; }
  function image(img, x, y, w, h){ page.drawImage(img, { x:x, y:top(y+h), width:w, height:h }); }
  function fill(x, y, w, h, c){ page.drawRectangle({ x:x, y:top(y+h), width:w, height:h, color:pdfColor(c), borderWidth:0 }); }
  image(await ctx.image(M.bg, M.bg.indexOf('.png') > 0), 0, 0, PW, PH);
  for(var qi = 0; qi < (M.stamps || []).length; qi++){
    var q = M.stamps[qi];
    image(await ctx.image(q.d, true), q.b[0]*K, q.b[1]*K, (q.b[2]-q.b[0])*K, (q.b[3]-q.b[1])*K);
  }
  (M.patches || []).forEach(function(q){
    fill(q.b[0]*K, q.b[1]*K, (q.b[2]-q.b[0])*K, (q.b[3]-q.b[1])*K, q.p);
  });
  M.fields.forEach(function(f){
    if(!f.d) return;
    var v = valueOf(f, snap);
    if(!v) return;
    v = pdfText(font, v);
    var fb=boxOf(f), x0=fb[0]*K, y0=(fb[1] + (f.dy || 0))*K, x1=fb[2]*K, y1=(fb[3] + (f.dy || 0))*K;
    if(f.e) fill(x0, y0, x1-x0, y1-y0, f.p);
    // largeur de centrage : toute la colonne (f.cx) si definie, sinon la zone propre du champ
    var cx0 = f.cx ? f.cx[0]*K : x0, cx1 = f.cx ? f.cx[1]*K : x1;
    var mx = (cx0+cx1)/2, availW = (cx1-cx0) - 10*K;
    var size = (y1-y0)*(f.r || 0.70);
    if(f.k === 'hour') size = (y1-y0)*0.70;
    while(size > 3 && font.widthOfTextAtSize(v, size) > availW) size -= 0.25;
    var width = font.widthOfTextAtSize(v, size);
    var color = pdfColor(f.c || INK);
    var midY = (y0+y1)/2;
    /* Ligne de base « au milieu » : le milieu plus 0,35 fois le corps. */
    var x, baseline;
    /* Les heures s'asseyent sur la ligne de base imprimée du formulaire,
       comme à l'écran, pour rester alignées avec les « h » et les « à ». */
    if(f.k === 'hour' && f.bl){
      x = mx - width/2; baseline = (f.bl + (f.dy || 0))*K;
    } else if(f.a === 'left'){
      // Même alignement que sur l'écran : les dates démarrent au début du trait pointillé.
      var lead = f.k === 'date' ? 16*K : 0;
      x = x0+5*K-lead; baseline = midY + size*0.35;
    } else {
      x = mx - width/2; baseline = midY + size*0.35;
    }
    page.drawText(v, { x:x, y:top(baseline), size:size, font:font, color:color });
  });
  (M.checks || []).forEach(function(c){
    var checks=snap ? (snap.c||{}) : checkState;
    if(!checks[c.n]) return;               // la case est deja imprimee sur le formulaire
    var x0=c.b[0]*K, y0=c.b[1]*K, x1=c.b[2]*K, y1=c.b[3]*K;
    var mn = Math.min(x1-x0, y1-y0), m = mn*0.14;
    var stroke = { thickness:mn*0.20, color:pdfColor(INK), lineCap:PDFLib.LineCapStyle.Round };
    page.drawLine(Object.assign({ start:{x:x0+m, y:top(y0+m)}, end:{x:x1-m, y:top(y1-m)} }, stroke));
    page.drawLine(Object.assign({ start:{x:x1-m, y:top(y0+m)}, end:{x:x0+m, y:top(y1-m)} }, stroke));
  });
  var sigData=snap ? snap.s : (hasInk?sig.toDataURL('image/png'):'');
  if(sigData){
    var SB = sheetModel().sig;
    image(await ctx.image(sigData, true), SB[0]*K, SB[1]*K, (SB[2]-SB[0])*K, (SB[3]-SB[1])*K);
  }
  var sig2Data=snap ? snap.s2 : (hasInk2?sig2.toDataURL('image/png'):'');
  if(sig2Data && M.sig2){
    var S2 = sig2Box();
    image(await ctx.image(sig2Data, true), S2[0]*K, S2[1]*K, (S2[2]-S2[0])*K, (S2[3]-S2[1])*K);
  }
}
/* ---------- controle de saisie avant enregistrement ---------- */
function valeur(n){ var i = byName[n]; return i === undefined ? '' : inputs[i].value.trim(); }
function dateValide(v){ return parseD(v) !== null; }
function heureValide(v){ return minutes(v) !== null; }
function intituleLigne(r){
  var i = byName[r.f];
  return i === undefined ? '' : IF[i].l.replace(/ — [^—]*$/, '');
}
function effacerErreurs(){
  M.fields.forEach(function(f){ if(f.zn) f.zn.classList.remove('err'); });
  sig.classList.remove('err');
  (M.attach || []).forEach(function(a){ if(a.row) a.row.classList.remove('err'); });
}
function controler(){
  effacerErreurs();
  var P = [], cible = null;
  function faute(txt, champ, row){
    P.push(txt);
    if(champ && byName[champ] !== undefined){
      var f = IF[byName[champ]];
      if(f.zn) f.zn.classList.add('err');
      if(!cible) cible = inputs[byName[champ]];
    } else if(row){
      row.classList.add('err');
      if(!cible) cible = row;
    }
  }

  if(!valeur('nom'))    faute('le nom et le prénom', 'nom');
  if(byName.groupe !== undefined && !valeur('groupe')) faute('le groupe', 'groupe');
  if(byName.collegue !== undefined && !valeur('collegue')) faute('le prénom et le nom du collègue', 'collegue');

  var remplies = 0;
  M.rows.forEach(function(r){
    var vf = valeur(r.f), vt = r.t ? valeur(r.t) : '', vd = r.de ? valeur(r.de) : '',
        va = r.ar ? valeur(r.ar) : '', vs = valeur(r.s);
    if(r.q && !vf){ faute(intituleLigne(r) + ' : date non renseignée', r.f); return; }
    if(!(vf || vt || vd || va)) return;
    remplies++;
    var lab = intituleLigne(r);
    if(!dateValide(vf))            faute(lab + ' : date absente ou incomplète', r.f);
    if(r.t && vt && !dateValide(vt)) faute(lab + ' : date de fin incomplète', r.t);
    var heureReq = (r.k === 'dur');
    if(r.de && (heureReq ? !heureValide(vd) : (vd && !heureValide(vd))))
      faute(lab + ' : heure de début ' + (vd ? 'incomplète' : 'non renseignée'), r.de);
    if(r.ar && (heureReq ? !heureValide(va) : (va && !heureValide(va))))
      faute(lab + ' : heure de fin ' + (va ? 'incomplète' : 'non renseignée'), r.ar);
    if(r.de && r.ar && heureValide(vd) && heureValide(va) && minutes(va) <= minutes(vd))
      faute(lab + ' : l’heure de fin doit être après l’heure de début', r.ar);
    if(r.s && !vs)                 faute(lab + ' : colonne « soit » vide', r.s);
    if(r.m && !valeur(r.m))        faute(lab + ' : motif non renseigné', r.m);
  });
  if(!remplies){
    var premiere = M.rows[0] && byName[M.rows[0].f] !== undefined ? inputs[byName[M.rows[0].f]] : null;
    P.push("aucune ligne n'est remplie");
    if(!cible) cible = premiere;
  }

  var ch = (M.checks || []);
  if(ch.length && !ch.some(function(c){ return checkState[c.n]; })){
    P.push('cocher « congés » ou « récupérations » dans le titre');
    if(!cible) cible = ch[0].el;
  }

  if(!hasInk){
    P.push("la signature de l'agent");
    sig.classList.add('err');
    if(!cible) cible = sig;
  }

  (M.attach || []).forEach(function(a){
    if(attNeeded(a) && !files[a.id]) faute('le justificatif « ' + a.l + ' »', null, a.row);
  });

  return { P: P, cible: cible };
}
function avertissementsPlanning(){
  var warnings=[], g=activeGroup();
  if(!g) return warnings;
  M.rows.forEach(function(r){
    var vf=valeur(r.f), vt=r.t?valeur(r.t):vf;
    var d1=parseD(vf), d2=parseD(vt||vf);
    if(!d1 || !d2) return;
    if(d2<d1){ var tmp=d1; d1=d2; d2=tmp; }
    /* Échange : le repos demandé tombe un jour travaillé, et le jour pris
       en échange un jour de repos. */
    if(r.k==='ech'){
      var kind=cycleInfo(d1).kind, w=swapped() ? r.w2 : r.w;
      if(w==='holiday' && !cycleInfo(d1).holiday) warnings.push(intituleLigne(r)+' : ce jour n’est pas férié');
      if((w==='work' || w==='holiday') && kind==='off') warnings.push(intituleLigne(r)+' : vous êtes déjà en repos ce jour-là');
      if(w==='off' && kind!=='off' && kind!=='unknown') warnings.push(intituleLigne(r)+' : vous travaillez déjà ce jour-là');
      return;
    }
    var off=[], feries=[];
    for(var d=new Date(d1.getTime()), guard=0; d<=d2 && guard<370; d.setDate(d.getDate()+1),guard++){
      var ci=cycleInfo(d);
      if(ci.kind==='off'){
        var ds=('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2);
        if(ci.holiday) feries.push(ds); else off.push(ds);
      }
    }
    if(off.length || feries.length){
      var parts=[];
      if(off.length) parts.push(off.length+' jour(s) de repos');
      if(feries.length) parts.push(feries.length+' jour(s) férié(s) non travaillé(s)');
      warnings.push(intituleLigne(r)+' : '+parts.join(' et '));
    }
  });
  return warnings;
}
function titreAvertissement(){
  return M.id === 'ferie' ? 'Attention : vérifiez le jour férié.\n\n'
    : M.id === 'echange' ? 'Attention : vérifiez les dates de l’échange.\n\n'
    : 'Attention : la période sélectionnée contient des jours non travaillés.\n\n';
}
function confirmerAvantPdf(){
  var r = controler();
  if(!r.P.length){
    var w0=avertissementsPlanning();
    if(w0.length){
      return confirm(titreAvertissement()
        + w0.slice(0,6).map(function(t){return '• '+t;}).join('\n')
        + (w0.length>6?'\n• …':'' )
        + '\n\nOK : continuer.\nAnnuler : revenir au formulaire.');
    }
    return true;
  }
  var MAX = 8;
  var liste = r.P.slice(0, MAX).map(function(t){ return '\u2022 ' + t; }).join('\n');
  if(r.P.length > MAX) liste += '\n\u2022 … et ' + (r.P.length - MAX) + ' autre(s)';
  var ok = confirm(
    (r.P.length === 1 ? 'Un élément manque :' : r.P.length + ' éléments manquent :')
    + '\n\n' + liste
    + '\n\nOK : enregistrer quand même le PDF en l\u2019état.'
    + '\nAnnuler : revenir au formulaire pour compléter.');
  if(!ok){
    say('Enregistrement annulé — ce qui manque est surligné en rouge.');
    if(r.cible) r.cible.scrollIntoView({ block:'center', behavior:'smooth' });
  } else {
    effacerErreurs();
    var w=avertissementsPlanning();
    if(w.length){
      ok=confirm(titreAvertissement()
        + w.slice(0,6).map(function(t){return '• '+t;}).join('\n')
        + (w.length>6?'\n• …':'' )
        + '\n\nOK : continuer.\nAnnuler : revenir au formulaire.');
    }
  }
  return ok;
}
async function buildPdfBytes(){
  var doc = await PDFLib.PDFDocument.create();
  var ctx = await pdfContext(doc);
  if(pageCount>1){
    pageSnapshots[pageIndex]=capturePage();
    syncFerieSignatures();
    for(var pi=0;pi<pageCount;pi++) await drawPdfPage(ctx, pageSnapshots[pi]);
  } else await drawPdfPage(ctx, null);
  var obsText = observation ? observation.value.trim() : '';
  var joints = (M.attach || []).filter(function(a){ return files[a.id] && attNeeded(a); });
  if(obsText){
    /* L'observation reste sur le formulaire : elle est placée dans l'espace
       central libre entre les deux zones de signature, sans créer de page. */
    var obsPage = doc.getPages()[0];
    var obsBold = ctx.font;
    var ps = obsPage.getSize();
    /* Sur la demande de congés, le cadre Observation reprend exactement
       la hauteur des deux cadres de signature. Il reste centré dans l'espace
       libre, avec un petit retrait de chaque côté pour ne toucher aucun cadre. */
    var boxW = (M.id === 'conges') ? 101.5 : Math.min(112, ps.width * .19);
    var boxH = (M.id === 'conges') ? 84.8 : 48;
    var boxX = (M.id === 'conges') ? 257.1 : (ps.width - boxW) / 2;
    var boxY = (M.id === 'conges') ? 36.9 : 46;
    /* Une feuille peut fixer son cadre : x, y depuis le bas, largeur, hauteur
       et hauteur du bandeau de titre. */
    if(M.obs){ boxX = M.obs[0]; boxY = M.obs[1]; boxW = M.obs[2]; boxH = M.obs[3]; }
    obsPage.drawRectangle({
      x:boxX, y:boxY, width:boxW, height:boxH,
      /* Même trait que les cadres de signature voisins, plus appuyé. */
      borderWidth:1.3,
      borderColor:PDFLib.rgb(.08,.08,.08),
      color:PDFLib.rgb(1,1,1), opacity:.97
    });
    /* Ligne de séparation du titre, alignée sur celles des cadres voisins. */
    var obsHeaderY = (M.id === 'conges') ? 94.3 : boxY + boxH - (M.obs ? M.obs[4] : 15);
    obsPage.drawLine({
      start:{x:boxX,y:obsHeaderY}, end:{x:boxX+boxW,y:obsHeaderY},
      thickness:1.1, color:PDFLib.rgb(.08,.08,.08)
    });
    /* Le titre suit ceux des cadres voisins (« SIGNATURE DE L'AGENT : ») :
       même graisse, même taille, centré dans sa bande, avec ses deux-points. */
    var obsTitle = 'OBSERVATION :';
    var obsTitleSize = 8.2;
    var obsTitleWidth = obsBold.widthOfTextAtSize(obsTitle, obsTitleSize);
    var obsBandTop = boxY + boxH;
    obsPage.drawText(obsTitle, {
      x:boxX + (boxW - obsTitleWidth) / 2,
      y:(obsHeaderY + obsBandTop) / 2 - obsTitleSize * .35,
      size:obsTitleSize, font:obsBold,
      color:PDFLib.rgb(.08,.08,.08)
    });
    var clean=obsText.replace(/\s+/g,' ').trim();
    var words=clean.split(' '), lines=[], line='', fontSize=5.9, usable=boxW-10;
    for(var wi=0;wi<words.length;wi++){
      var test=line ? line+' '+words[wi] : words[wi];
      if(obsBold.widthOfTextAtSize(test,fontSize) > usable && line){ lines.push(line); line=words[wi]; }
      else line=test;
    }
    if(line) lines.push(line);
    var maxLines=(M.id === 'conges') ? 8 : M.obs ? Math.floor((obsHeaderY - boxY - 14) / 6.2) + 1 : 6;
    if(lines.length>maxLines){
      lines=lines.slice(0,maxLines);
      var last=lines[maxLines-1];
      while(last && obsBold.widthOfTextAtSize(last+'…',fontSize)>usable) last=last.slice(0,-1);
      lines[maxLines-1]=last+'…';
    }
    var y=(M.id === 'conges' || M.obs) ? obsHeaderY-11 : boxY+boxH-18;
    lines.forEach(function(t){
      obsPage.drawText(t,{x:boxX+7,y:y,size:fontSize,font:obsBold,color:PDFLib.rgb(INK[0]/255,INK[1]/255,INK[2]/255)});
      y-=6.2;
    });
  }
  var font = ctx.font;
  for(var i = 0; i < joints.length; i++){
    var a = joints[i], f = files[a.id];
    if(f.kind === 'pdf'){
      /* Charger une copie fraîche : certains moteurs JS peuvent conserver une vue
         interne sur le tableau utilisé lors du premier contrôle. */
      var src = await PDFLib.PDFDocument.load(new Uint8Array(f.bytes), {
        ignoreEncryption:true,
        updateMetadata:false
      });
      var pages = await doc.copyPages(src, src.getPageIndices());
      pages.forEach(function(pg){ doc.addPage(pg); });
    } else {
      var img = await doc.embedJpg(f.bytes);
      var PWa = 595.28, PHa = 841.89, m = 30, capH = 26;
      var page = doc.addPage([PWa, PHa]);
      var sc = Math.min((PWa-2*m)/img.width, (PHa-2*m-capH)/img.height);
      var w = img.width*sc, h = img.height*sc;
      page.drawImage(img, { x:(PWa-w)/2, y:(PHa-capH-h)/2, width:w, height:h });
      page.drawText('Justificatif — ' + a.l, {
        x:m, y:PHa-m-2, size:11, font:font,
        color: PDFLib.rgb(11/255, 59/255, 175/255) });
    }
  }
  return await doc.save();
}
async function makeBlob(){
  return new Blob([await buildPdfBytes()], { type:'application/pdf' });
}
function fileName(){
  /* Sur ordinateur comme sur mobile, proposer un nom simple et lisible
     à partir du champ « NOM - Prénom ». */
  return outlookFileName();
}
function outlookFileName(){
  var i = byName['nom'];
  var nom = (i !== undefined ? inputs[i].value : '').trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '');
  return 'Congé' + (nom ? ' - ' + nom : '') + '.pdf';
}
function downloadBlob(blob, name){
  /* L'attribut download force l'enregistrement du fichier au lieu de
     l'afficher dans un nouvel onglet du navigateur. L'ouverture suivante
     dépend ensuite de l'application PDF choisie par l'utilisateur. */
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
}
function demanderNomPdf(nomPropose){
  var sansExtension = nomPropose.replace(/\.pdf$/i, '');
  var choisi = window.prompt('Nom du fichier PDF :', sansExtension);
  if(choisi === null) return null;
  choisi = choisi.trim()
    .replace(/[<>:\"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '');
  if(!choisi) choisi = sansExtension;
  if(!/\.pdf$/i.test(choisi)) choisi += '.pdf';
  return choisi;
}
async function preparePdf(customName){
  await loadPdfEngine();
  return { name:customName || fileName(), blob:await makeBlob() };
}
document.getElementById('btnPdf').addEventListener('click', async function(){
  if(!confirmerAvantPdf()) return;
  var nomChoisi = demanderNomPdf(fileName());
  if(!nomChoisi){ say('Enregistrement annulé.'); return; }
  var b = this; b.disabled = true; say('Préparation du PDF…');
  try{
    var pdf = await preparePdf(nomChoisi);
    await completePlanningRequest(pdf);
    downloadBlob(pdf.blob, pdf.name);
    pdfDone = true; updateClr();
    say(planningImport ? 'Demande enregistrée. Retour au planning…' : 'PDF enregistré : ' + pdf.name);
    if(planningImport) returnToPlanningAfterSuccess(); else showToast('PDF créé');
  }catch(e){
    console.error(e);
    if(!finishSavedRequestAfterDeliveryIssue('Le PDF n’a pas pu être téléchargé automatiquement.'))
      say(e && e.message ? e.message : "La demande n’a pas pu être enregistrée. Vérifiez votre connexion puis réessayez.");
  }
  b.disabled = false;
});
function ouvrirFenetreImpression(){
  var w = null;
  try{
    w = window.open('', '_blank');
    if(w){
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Préparation de l\'impression…</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#333}p{padding:20px;text-align:center}</style></head><body><p>Préparation du document pour impression…</p></body></html>');
      w.document.close();
    }
  }catch(e){ w = null; }
  return w;
}
function imprimerBlobPdf(blob, printWindow){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(blob);
    var w = printWindow;
    if(!w || w.closed){
      URL.revokeObjectURL(url);
      reject(new Error('Fenêtre d’impression bloquée'));
      return;
    }
    var fini = false;
    function nettoyer(){
      if(fini) return;
      fini = true;
      setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
      resolve();
    }
    try{
      w.location.replace(url);
    }catch(e){
      URL.revokeObjectURL(url);
      reject(e);
      return;
    }
    var essais = 0;
    var timer = setInterval(function(){
      essais++;
      try{
        if(w.closed){ clearInterval(timer); reject(new Error('Fenêtre fermée')); return; }
        w.focus();
        if(typeof w.print === 'function'){
          clearInterval(timer);
          setTimeout(function(){
            try{ w.focus(); w.print(); nettoyer(); }
            catch(e){ reject(e); }
          }, 700);
        }
      }catch(e){
        /* Le PDF chargé dans un onglet peut devenir cross-origin. Dans ce cas,
           l'onglet reste ouvert avec le PDF et le navigateur affiche ses outils d'impression. */
        clearInterval(timer);
        nettoyer();
      }
      if(essais > 20){ clearInterval(timer); nettoyer(); }
    }, 250);
  });
}
document.getElementById('btnPrint').addEventListener('click', async function(){
  if(!confirmerAvantPdf()) return;
  /* La fenêtre est ouverte immédiatement pour conserver le geste utilisateur,
     indispensable sur téléphone où les pop-up sont sinon bloquées après la génération du PDF. */
  var printWindow = ouvrirFenetreImpression();
  if(!printWindow){
    say("Le navigateur a bloqué la fenêtre d’impression. Autorisez les fenêtres contextuelles puis réessayez.");
    return;
  }
  var b=this, dl=document.getElementById('btnPdf');
  b.disabled=true; dl.disabled=true; say('Préparation du PDF pour impression…');
  try{
    var pdf=await preparePdf(fileName());
    await completePlanningRequest(pdf);
    await imprimerBlobPdf(pdf.blob, printWindow);
    pdfDone=true; updateClr();
    say(planningImport ? 'Demande enregistrée. Retour au planning…' : 'Document prêt à imprimer.');
    if(planningImport) returnToPlanningAfterSuccess();
  }catch(e){
    console.error(e); pdfEnginePromise=null;
    try{ if(printWindow && !printWindow.closed) printWindow.close(); }catch(closeError){}
    if(!finishSavedRequestAfterDeliveryIssue("L’impression n’a pas pu être ouverte."))
      say("L’impression n’a pas pu être ouverte. Vérifiez que les fenêtres contextuelles sont autorisées.");
  }
  b.disabled=false; dl.disabled=false;
});
async function partagerPdfMobile(pdf){
  var file=new File([pdf.blob],pdf.name,{type:'application/pdf',lastModified:Date.now()});
  if(!navigator.share) throw new Error('Partage de fichiers non pris en charge');
  if(navigator.canShare && !navigator.canShare({files:[file]})) throw new Error('Partage de PDF non pris en charge');
  /* Ne pas télécharger avant le partage : le fichier renommé est transmis directement
     au menu de partage Android, qui permet ensuite de sélectionner Outlook. */
  await navigator.share({files:[file]});
}
/* Envoi par Outlook : sur appareil tactile uniquement, quelle que soit la
   largeur de l'ecran (telephone, pliable ouvert, tablette). Seul le menu de
   partage du systeme peut joindre le PDF au message. Sur PC le bouton
   n'existe pas, car un navigateur ne peut pas attacher un fichier a un
   mail : l'agent telecharge le PDF puis l'ajoute lui-meme en piece jointe. */
document.getElementById('btnOutlook').addEventListener('click', async function(){
  /* Le critere est l'appareil, pas la largeur : un pliable ouvert reste
     tactile et sait partager, meme au-dela de 761 px. */
  if(!document.documentElement.classList.contains('device-touch')) return;
  var b=this, dl=document.getElementById('btnPdf'), pr=document.getElementById('btnPrint');
  if(!confirmerAvantPdf()) return;
  var nomChoisi = outlookFileName();
  b.disabled=true; dl.disabled=true; pr.disabled=true; say('Préparation du PDF pour Outlook…');
  try{
    var pdf=await preparePdf(nomChoisi);
    await completePlanningRequest(pdf);
    await partagerPdfMobile(pdf);
    pdfDone=true; updateClr(); say(planningImport ? 'Demande enregistrée. Retour au planning…' : 'PDF transmis au menu de partage. Sélectionnez Outlook.');
    if(planningImport) returnToPlanningAfterSuccess();
  }catch(e){
    if(finishSavedRequestAfterDeliveryIssue(e && e.name === 'AbortError' ? 'Le partage a été annulé.' : 'Le partage du PDF n’a pas pu être ouvert.')){}
    else if(e && e.name === 'AbortError') say('Partage annulé.');
    else {
      console.error(e);
      say("Le navigateur ne permet pas de joindre automatiquement ce PDF. Ouvrez le site dans Chrome ou Samsung Internet, puis réessayez.");
    }
  }
  b.disabled=false; dl.disabled=false; pr.disabled=false;
});
/* ================= import depuis le planning ================= */
var PLANNING_HANDOFF_KEY='planning:form-handoff-v1';
var PLANNING_DEMO_COMPLETED_KEY='planning:demo-completed-request-v1';
var planningSyncPromise=null;
var planningSyncDone=false;
var planningArchiveDone=false;
function readPlanningImport(){
  try{
    var params=new URLSearchParams(location.search);
    if(params.get('planning')!=='1') return null;
    var raw=localStorage.getItem(PLANNING_HANDOFF_KEY);
    if(!raw) return null;
    var data=JSON.parse(raw);
    if(!data || data.version!==1 || !data.requestId || (data.requestKind!=='leave' && data.requestKind!=='recovery')) return null;
    return data;
  }catch(e){ return null; }
}
function planningSheetIndex(data){
  var wanted=data && data.requestKind==='recovery' ? 'recup' : 'conges';
  for(var i=0;i<SHEETS.length;i++) if(SHEETS[i].id===wanted) return i;
  return 0;
}
function isoToFormDate(value){
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  return m ? m[3]+'/'+m[2]+'/'+m[1] : '';
}
function planningTime(value){
  var m=/^(\d{2}):(\d{2})$/.exec(String(value||''));
  return m ? m[1]+'h'+m[2] : '';
}
/* Dessine directement la signature transmise par le planning sur le canevas :
   contrairement a restoreSavedSignature, elle ne vient pas du stockage local
   de cet appareil mais du profil enregistre cote planning. */
function drawPlanningSignature(data){
  return new Promise(function(resolve){
    if(!data){ resolve(); return; }
    var im=new Image();
    im.onload=function(){
      sctx.clearRect(0,0,sig.width,sig.height);
      drawSignature(sctx,im,sig.width,sig.height,M.sigFit);
      hasInk=true; sig.classList.add('has'); hint.style.display='none'; pdfDone=false;
      updateClr(); resolve();
    };
    im.onerror=function(){ resolve(); };
    im.src=data;
  });
}
async function applyPlanningImport(data){
  if(!data) return;
  /* On repart d'une demande propre tout en conservant l'identite et la date de
     signature deja presentes sur le feuillet. */
  inputs.forEach(function(el,i){
    var name=IF[i] && IF[i].n;
    if(name==='nom' || name==='groupe' || name==='date_sig') return;
    delete el.dataset.manual;
    setVal(i,'',true);
  });
  (M.checks||[]).forEach(function(c){
    checkState[c.n]=(data.requestKind==='leave' && c.n==='opt_conges') ||
      (data.requestKind==='recovery' && c.n==='opt_recup');
    paintCheck(c);
  });
  files={};
  if(observation) observation.value='';

  function put(name,value){
    var i=byName[name];
    if(i===undefined || !value) return;
    onEdit(i,value);
  }
  if(data.profile && data.profile.fullName) put('nom',data.profile.fullName);
  if(data.profile && data.profile.group) put('groupe',data.profile.group);
  if(data.profile && data.profile.signature) await drawPlanningSignature(data.profile.signature);
  var buckets={ca:[],artt:[],cet:[],frac:[],half:[],gard:[],exc:[],rjour:[],rdemi:[],rheur:[],rferi:[]};
  (data.periods||[]).forEach(function(period){
    var prefix=period.type==='annual'?'ca':(period.type==='cet'?'cet':(period.type==='rtt'?'artt':(period.type==='fraction'?'frac':(period.type==='childcare'?'gard':(period.type==='exceptional'?'exc':(period.type==='recovery_day'?'rjour':''))))));
    if(!prefix) return;
    buckets[prefix].push(period);
  });
  (data.timed||[]).forEach(function(item){
    if(item.halfBalance==='exceptional'){ buckets.exc.push({from:item.date,to:item.date,half:1}); return; }
    var prefix=item.type==='half'?'half':(item.type==='recovery_day'?'rjour':(item.type==='recovery_half'?'rdemi':((item.type==='recovery_hours'||item.type==='recovery_training')?'rheur':(item.type==='recovery_holiday'?'rferi':''))));
    if(!prefix) return;
    buckets[prefix].push(item);
  });
  /* Toutes les rubriques présentes dans buckets doivent avoir une capacité.
     Sans celle du CET, 0 / undefined produisait NaN : la boucle de création
     des feuilles ne s'exécutait plus et aucune date n'était préremplie. */
  var capacities={ca:5,artt:4,cet:4,frac:2,half:4,gard:2,exc:1,rjour:5,rdemi:5,rheur:5,rferi:5};
  var needed=1;
  Object.keys(buckets).forEach(function(prefix){
    needed=Math.max(needed,Math.ceil(buckets[prefix].length/capacities[prefix]));
  });
  needed=Math.min(5,needed);
  var base=capturePage(), built=[];
  for(var page=0;page<needed;page++){
    applyPageState(blankPageFrom(base));
    put('groupe',String(data.group||''));
    Object.keys(buckets).forEach(function(prefix){
      var cap=capacities[prefix];
      buckets[prefix].slice(page*cap,(page+1)*cap).forEach(function(item,row){
        put(prefix+row+'_from',isoToFormDate(item.from||item.date));
        if(item.to) put(prefix+row+'_to',isoToFormDate(item.to));
        if(item.start) put(prefix+row+'_de',planningTime(item.start));
        if(item.end) put(prefix+row+'_a',planningTime(item.end));
      });
    });
    recalcAll();
    buckets.exc.slice(page,page+1).forEach(function(item){ var si=byName.exc0_soit; if(item.half && si!==undefined){ setVal(si,'0,5',true); inputs[si].dataset.manual='1'; } });
    var snapshot=capturePage();
    snapshot.s=base.s;
    built.push(snapshot);
  }
  pageSnapshots=built; pageCount=built.length; pageIndex=0;
  applyPageState(pageSnapshots[0]); updatePageUI();
  refreshAtt(); profileWrite(); scheduleSave(); layout();
  /* La transmission reste disponible jusqu'à la validation finale. Elle ne
     sera supprimée qu'après l'enregistrement confirmé côté planning. */
  var pageMessage=pageCount>1?' sur '+pageCount+' feuilles':'';
  say('Les dates choisies dans le planning ont ete integrees au formulaire'+pageMessage+'.');
  showToast('Demande integree'+pageMessage);
}

/* ================= échange enregistré dans le planning ================= */
/* Un férié : la demande de remplacement, feuille 1 remplie ; s'il y a un
   férié rendu, la feuille 2 se prépare depuis le choix au-dessus. */
function applyFerieImport(data){
  inputs.forEach(function(el,i){
    var n=IF[i].n;
    if(n==='nom' || n==='date_sig') return;
    delete el.dataset.manual;
    setVal(i,'',true);
  });
  clearSig2();
  if(observation) observation.value='';
  var p=data.profile||{};
  if(p.group){
    var d=profileRead(); d.groupe=String(p.group);
    try{ localStorage.setItem('demandes:v6:profil'+planningOwnerSuffix(),JSON.stringify(d)); }catch(e){}
  }
  if(p.fullName && byName.nom!==undefined) onEdit(byName.nom,p.fullName);
  try{
    if(data.returnDate) sessionStorage.setItem(FERIE_PAIR_KEY,JSON.stringify({
      partnerName:data.partnerName, agreementDate:data.agreementDate, returnDate:data.returnDate,
      agreementStart:data.agreementStart, agreementEnd:data.agreementEnd, returnStart:data.returnStart, returnEnd:data.returnEnd
    }));
    else sessionStorage.removeItem(FERIE_PAIR_KEY);
  }catch(e){}
  /* Échange de fériés : la feuille 2 est préparée en seconde page, la
     feuille 1 reste affichée. */
  pageSnapshots = [null]; pageIndex = 0; pageCount = 1;
  if(data.returnDate){
    fillFerieSheet(data,2);
    var second = capturePage();
    fillFerieSheet(data,1);
    pageSnapshots = [null, second]; pageCount = 2;
  } else fillFerieSheet(data,1);
  updatePageUI(); refreshFerieSheets();
  try{
    localStorage.removeItem(EXCHANGE_HANDOFF_KEY);
    history.replaceState(null,'',location.pathname);
  }catch(e){}
  return (p.signature ? drawPlanningSignature(p.signature) : Promise.resolve()).then(function(){
    if(pageCount === 2){ pageSnapshots[0] = capturePage(); syncFerieSignatures(); pageSnapshots[0] = null; }
    layout(); scheduleSave();
    say(data.returnDate ? 'Les deux feuilles sont remplies : votre férié, puis celui du collègue. Le PDF les contient toutes les deux.'
      : 'Le remplacement enregistré dans le planning a été intégré au formulaire.');
    showToast(data.returnDate ? 'Deux feuilles prêtes' : 'Remplacement intégré');
  });
}
var EXCHANGE_HANDOFF_KEY='planning:exchange-handoff-v1';
function readExchangeImport(){
  try{
    if(new URLSearchParams(location.search).get('echange')!=='1') return null;
    var data=JSON.parse(localStorage.getItem(EXCHANGE_HANDOFF_KEY)||'null');
    return data && data.version===1 && data.agreementDate && (data.returnDate || data.sheet==='ferie') ? data : null;
  }catch(e){ return null; }
}
/* Les dates et horaires de l'échange remplissent la feuille. Le repos le plus
   proche occupe la première ligne : si c'est celui du collègue, il passe en
   haut et l'agent en bas. Les horaires d'une date sont ceux de la personne
   qui y travaille en remplacement. */
function applyExchangeImport(data){
  if(data.sheet==='ferie') return applyFerieImport(data);
  inputs.forEach(function(el,i){
    var n=IF[i].n;
    if(n==='nom' || n==='date_sig') return;
    delete el.dataset.manual;
    setVal(i,'',true);
  });
  clearSig2();
  if(observation) observation.value='';
  function put(name,value){ var i=byName[name]; if(i!==undefined && value) onEdit(i,value); }
  var p=data.profile||{};
  if(p.group){
    var d=profileRead(); d.groupe=String(p.group);
    try{ localStorage.setItem('demandes:v6:profil'+planningOwnerSuffix(),JSON.stringify(d)); }catch(e){}
  }
  if(p.fullName) put('nom',p.fullName);
  var a=data.agreementDate, r=data.returnDate, mineFirst=a<=r;
  var d1=mineFirst?a:r, d2=mineFirst?r:a;
  function hours(date){ return date===a ? [data.agreementStart,data.agreementEnd] : [data.returnStart,data.returnEnd]; }
  if(!mineFirst) put('ordre','2');
  put('collegue',data.partnerName);
  put('rep_date',isoToFormDate(d1)); put('ech_date',isoToFormDate(d2));
  put('ech_de',planningTime(hours(d2)[0])); put('ech_a',planningTime(hours(d2)[1]));
  put('col_plan',isoToFormDate(d1)); put('col_repos',isoToFormDate(d2));
  put('col_de',planningTime(hours(d1)[0])); put('col_a',planningTime(hours(d1)[1]));
  try{
    localStorage.removeItem(EXCHANGE_HANDOFF_KEY);
    history.replaceState(null,'',location.pathname);
  }catch(e){}
  return (p.signature ? drawPlanningSignature(p.signature) : Promise.resolve()).then(function(){
    layout(); scheduleSave();
    say('L’échange enregistré dans le planning a été intégré au formulaire.');
    showToast('Échange intégré');
  });
}

function archivePlanningRequest(pdf){
  if(!pdf || !pdf.blob || !planningImport) return Promise.resolve(false);
  return new Promise(function(resolve){
    try{
      var open=indexedDB.open('planning-request-archive',1);
      open.onupgradeneeded=function(){
        if(!open.result.objectStoreNames.contains('requests'))
          open.result.createObjectStore('requests',{keyPath:'id'});
      };
      open.onerror=function(){ resolve(false); };
      open.onsuccess=function(){
        var db=open.result, now=new Date().toISOString();
        var tx=db.transaction('requests','readwrite');
        tx.objectStore('requests').put({
          id:planningImport.requestId,
          ownerKey:String(planningImport.ownerKey||'').trim().toLowerCase(),
          name:pdf.name,
          createdAt:planningImport.createdAt || now,
          updatedAt:now,
          blob:pdf.blob
        });
        tx.oncomplete=function(){ db.close(); resolve(true); };
        tx.onerror=function(){ db.close(); resolve(false); };
      };
    }catch(e){ resolve(false); }
  });
}
function syncPlanningRequest(){
  if(!planningImport || planningSyncDone) return Promise.resolve();
  if(planningSyncPromise) return planningSyncPromise;
  planningSyncPromise=(async function(){
    var publicDemoUntil=localStorage.getItem('planning:public-demo-until');
    var publicDemo=publicDemoUntil && Number.isFinite(Date.parse(publicDemoUntil)) && Date.now()<=Date.parse(publicDemoUntil);
    var e2eDemo=publicDemo || ((location.hostname==='127.0.0.1'||location.hostname==='localhost')&&localStorage.getItem('planning:e2e-demo-enabled')==='1');
    if(e2eDemo){
      localStorage.setItem(PLANNING_DEMO_COMPLETED_KEY,JSON.stringify(planningImport));
      planningSyncDone=true;
      return;
    }
    var controller=typeof AbortController!=='undefined' ? new AbortController() : null;
    var timer=controller ? setTimeout(function(){controller.abort();},20000) : null;
    try{
      var response=await fetch('/api/calendar',{
        method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          action:'save-request',
          requestId:planningImport.requestId,
          requestKind:planningImport.requestKind,
          group:planningImport.group,
          periods:planningImport.periods || [],
          timed:planningImport.timed || []
        }),
        signal:controller ? controller.signal : undefined
      });
      var result=await response.json().catch(function(){return null;});
      if(!response.ok) throw new Error(result && result.error ? result.error : 'La sauvegarde du congé a échoué.');
      planningSyncDone=true;
    }catch(error){
      planningSyncPromise=null;
      if(error && error.name==='AbortError')
        throw new Error('La synchronisation a pris trop de temps. Aucune confirmation n’a été enregistrée : vérifiez votre connexion puis réessayez.');
      throw error;
    }finally{ if(timer) clearTimeout(timer); }
  })();
  return planningSyncPromise;
}
async function completePlanningRequest(pdf){
  if(!planningImport) return;
  say(planningImport.requestKind==='recovery'?'Enregistrement de la récupération dans Planning Solo…':'Enregistrement du congé dans Planning Solo…');
  await syncPlanningRequest();
  planningArchiveDone=await archivePlanningRequest(pdf);
  try{ localStorage.removeItem(PLANNING_HANDOFF_KEY); }catch(e){}
}
function savedPlanningMessage(extra){
  var archiveMessage=planningArchiveDone
    ? 'Le formulaire est archivé sur cet appareil.'
    : "La demande est enregistrée, mais le PDF n’a pas pu être archivé sur cet appareil.";
  return 'Demande enregistrée. '+archiveMessage+(extra ? ' '+extra : '');
}
function finishSavedRequestAfterDeliveryIssue(extra){
  if(!planningImport || !planningSyncDone) return false;
  pdfDone=true; updateClr();
  say(savedPlanningMessage(extra));
  showToast(planningImport.requestKind==='recovery'?'Récupération enregistrée dans le planning':'Congé enregistré dans le planning');
  returnToPlanningAfterSuccess();
  return true;
}
function returnToPlanningAfterSuccess(){
  if(!planningImport) return;
  showToast(planningImport.requestKind==='recovery'?'Récupération enregistrée dans le planning':'Congé enregistré dans le planning');
  setTimeout(function(){ location.href='/?request=saved'; },900);
}

/* ================= choix du feuillet ================= */
var sel = document.getElementById('sheet');
SHEETS.forEach(function(s, i){
  var o = document.createElement('option');
  o.value = i; o.textContent = s.name;
  sel.appendChild(o);
});
sel.addEventListener('change', function(){
  var i = +sel.value;
  var paperEl = document.getElementById('paper');
  paperEl.classList.add('form-switching');
  say('Chargement…');
  var finishSwitch = function(){
    layout();
    window.requestAnimationFrame(function(){ paperEl.classList.remove('form-switching'); });
    say('');
  };
  bg.onload = function(){ bg.onload = null; finishSwitch(); };
  loadSheet(i).then(function(){
    finishSwitch();
    try{ store.set('demandes:v4:last', SHEETS[i].id); }catch(e){}
  });
});

if('serviceWorker' in navigator && location.protocol.indexOf('http') === 0){
  window.addEventListener('load', function(){
    /* La version du cache vit uniquement dans sw.js. Le navigateur vérifie le
       worker et ses imports sans cache HTTP, ce qui évite deux numéros de
       version susceptibles de diverger tout en conservant le shell hors ligne. */
    navigator.serviceWorker.register('sw.js', {updateViaCache:'none'})
      .catch(function(e){ console.warn('sw', e); });
  });
}

var planningImport=readPlanningImport();
var planningImportActive=!!planningImport;
var lastSheetFast='0';
try{ lastSheetFast=localStorage.getItem('demandes:v4:last') || '0'; }catch(e){}
/* La dernière feuille est retenue par son identifiant. Un ancien numéro
   renvoie à l'ordre d'avant la demande d'échange. */
function storedSheetIndex(v){
  var id=/^\d+$/.test(String(v)) ? ['conges','recup','annul'][+v] : v;
  for(var i=0;i<SHEETS.length;i++) if(SHEETS[i].id===id) return i;
  return 0;
}
var exchangeImport=planningImportActive ? null : readExchangeImport();
var firstIndex=planningImportActive ? planningSheetIndex(planningImport)
  : storedSheetIndex(exchangeImport ? (exchangeImport.sheet==='ferie' ? 'ferie' : 'echange') : lastSheetFast);
sel.value=firstIndex;
bg.onload=function(){ bg.onload=null; layout(); };
loadSheet(firstIndex).then(function(){
  if(planningImportActive) return applyPlanningImport(planningImport);
  if(exchangeImport){
    try{ store.set('demandes:v4:last',exchangeImport.sheet==='ferie' ? 'ferie' : 'echange'); }catch(e){}
    return applyExchangeImport(exchangeImport);
  }
});
/* Le stockage asynchrone est consulté après le premier affichage pour ne pas bloquer l'ouverture. */
var afterFirstPaint=window.requestIdleCallback || function(fn){ setTimeout(fn,80); };
afterFirstPaint(function(){
  if(planningImportActive || exchangeImport) return;
  store.get('demandes:v4:last').then(function(v){
    var i=v ? storedSheetIndex(v) : firstIndex;
    if(i!==firstIndex){ sel.value=i; bg.onload=function(){ bg.onload=null; layout(); }; loadSheet(i); }
  }).catch(function(){});
});
})();

/* ================= bouton PDF flottant (telephone) =================
   Sur ecran etroit, l'en-tete defile avec la feuille. Des que le bouton
   « Telecharger le PDF » sort de l'ecran, une copie fixee en haut prend le
   relais : elle declenche le vrai bouton et reprend son etat desactive. */
(function(){
  var pdf=document.getElementById('btnPdf');
  if(!pdf || !window.IntersectionObserver) return;
  var floating=document.createElement('button');
  floating.type='button';
  floating.className='btn pdf-floating';
  floating.innerHTML=pdf.innerHTML;
  floating.addEventListener('click',function(){ pdf.click(); });
  document.body.appendChild(floating);
  new MutationObserver(function(){ floating.disabled=pdf.disabled; })
    .observe(pdf,{attributes:true,attributeFilter:['disabled']});
  new IntersectionObserver(function(entries){
    document.documentElement.classList.toggle('pdf-out-of-view', !entries[0].isIntersecting);
  }).observe(pdf);
})();
