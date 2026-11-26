/* Accounts: sign in with e-mail (Firebase Authentication) and keep every save in sync across devices (Cloud Firestore).
 *
 * What syncs: every localStorage key that starts with "rlsim" (tournaments, all career save slots, custom teams,
 * roster edits, settings, sound) except a few per-device UI keys.
 *
 * Cloud layout (one tree per account, readable and writable only by that account, see firestore.rules):
 *   users/{uid}                     manifest: { updatedAt, device, keys: { <storage key>: { h: hash, n: parts, z: gzipped } } }
 *   users/{uid}/blobs/{key}~{part}  { d: bytes (gzip) or text }  - big saves are split into parts under Firestore's 1 MiB limit
 *
 * Needs js/firebase-config.js (not committed, see js/firebase-config.example.js). Without it the site works exactly as before
 * and the account screen explains that accounts aren't set up.
 */
(function (global) {
  'use strict';
  const META_KEY = 'rl.acct.sync';               // this device's sync bookkeeping (not synced itself)
  const EXCLUDE = new Set(['rlsim.homeTab']);     // per-device UI state
  const PART_BYTES = 900 * 1024, PART_CHARS = 280 * 1024;
  const VENDOR = ['js/vendor/firebase/firebase-app-compat.js', 'js/vendor/firebase/firebase-auth-compat.js', 'js/vendor/firebase/firebase-firestore-compat.js'];

  let ui = null;            // { openModal, closeModal, modalHead, toast, esc, onChange }
  let fb = null, auth = null, db = null, user = null;
  let status = 'off';       // off | loading | ready | error
  let syncing = false, timer = 0, muted = 0, lastErr = '', unsub = null, seenRemote = 0;
  const listeners = [];

  /* ---------------- small helpers ---------------- */
  const configured = () => !!(global.RL_FIREBASE_CONFIG && global.RL_FIREBASE_CONFIG.apiKey && global.RL_FIREBASE_CONFIG.projectId);
  const syncable = (k) => typeof k === 'string' && k.startsWith('rlsim') && !EXCLUDE.has(k);
  const ls = global.localStorage;
  function readMeta() { try { return JSON.parse(ls.getItem(META_KEY) || 'null') || {}; } catch (e) { return {}; } }
  function writeMeta(m) { try { ls.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* storage full */ } }
  function localKeys() { const out = []; try { for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (syncable(k)) out.push(k); } } catch (e) { /* blocked */ } return out.sort(); }
  /** FNV-1a: cheap change detection for a stored value. */
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; }
  function localHashes() { const o = {}; localKeys().forEach((k) => { o[k] = hash(ls.getItem(k) || ''); }); return o; }
  const sameMap = (a, b) => { a = a || {}; b = b || {}; const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => a[k] === b[k]); };
  function deviceName() {
    const u = navigator.userAgent || '';
    const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Browser';
    const os = /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac OS X/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : 'device';
    return br + ' on ' + os;
  }
  const ago = (t) => { if (!t) return 'never'; const s = Math.round((Date.now() - t) / 1000); return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(t).toLocaleDateString(); };
  const docId = (k, i) => k.replace(/\//g, '_') + '~' + i;
  const notify = () => { listeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); if (ui && ui.onChange) ui.onChange(); };
  const canZip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function gzip(str) { return new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); }
  async function gunzip(u8) { return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }

  /* ---------------- watch local saves: any change to a synced key schedules an upload ---------------- */
  try {
    const P = global.Storage && global.Storage.prototype;
    if (P && !P.__rlAcct) {
      const set = P.setItem, rem = P.removeItem;
      P.setItem = function (k, v) { set.call(this, k, v); if (this === ls && syncable(k)) changed(); };
      P.removeItem = function (k) { rem.call(this, k); if (this === ls && syncable(k)) changed(); };
      P.__rlAcct = true;
    }
  } catch (e) { /* storage patching not allowed: Sync now still works */ }
  function changed() { if (muted || !user) return; clearTimeout(timer); timer = setTimeout(() => push(), 4000); }
  // leaving the page: send what's pending
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer && user) { clearTimeout(timer); timer = 0; push(); } });

  /* ---------------- Firebase loading ---------------- */
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
  let loading = null;
  function boot() {
    if (!configured()) { status = 'off'; return Promise.resolve(false); }
    if (loading) return loading;
    status = 'loading'; notify();
    loading = VENDOR.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve()).then(() => {
      fb = global.firebase;
      if (!fb.apps.length) fb.initializeApp(global.RL_FIREBASE_CONFIG);
      auth = fb.auth(); db = fb.firestore();
      status = 'ready';
      auth.onAuthStateChanged((u) => {
        const was = user && user.uid; user = u || null;
        if (unsub) { unsub(); unsub = null; }
        if (user) { if (was !== user.uid) firstSync(); watchRemote(); }
        notify();
      });
      return true;
    }).catch((e) => { status = 'error'; lastErr = e.message || String(e); notify(); return false; });
    return loading;
  }

  /* ---------------- cloud I/O ---------------- */
  const manifestRef = () => db.collection('users').doc(user.uid);
  const blobRef = (k, i) => manifestRef().collection('blobs').doc(docId(k, i));
  async function readValue(k, info) {
    const parts = [];
    for (let i = 0; i < info.n; i++) { const d = await blobRef(k, i).get(); if (!d.exists) throw new Error('A part of "' + k + '" is missing in the cloud.'); parts.push(d.data().d); }
    if (!info.z) return parts.join('');
    const bytes = parts.map((b) => b.toUint8Array()), len = bytes.reduce((a, b) => a + b.length, 0), all = new Uint8Array(len);
    let o = 0; bytes.forEach((b) => { all.set(b, o); o += b.length; });
    return gunzip(all);
  }
  async function writeValue(k, str, oldN) {
    let parts, z = false;
    if (canZip) { const u8 = await gzip(str); z = true; parts = []; for (let i = 0; i < u8.length || i === 0; i += PART_BYTES) parts.push(fb.firestore.Blob.fromUint8Array(u8.subarray(i, i + PART_BYTES))); }
    else { parts = []; for (let i = 0; i < str.length || i === 0; i += PART_CHARS) parts.push(str.slice(i, i + PART_CHARS)); }
    for (let i = 0; i < parts.length; i++) await blobRef(k, i).set({ d: parts[i] });
    for (let i = parts.length; i < (oldN || 0); i++) await blobRef(k, i).delete();
    return { n: parts.length, z };
  }

  /** Upload this device's saves (only the keys that changed). */
  async function push(force) {
    if (!user || syncing) { if (user && syncing) { clearTimeout(timer); timer = setTimeout(() => push(force), 3000); } return; }
    timer = 0;
    const meta = readMeta(), now = localHashes();
    // this device hasn't lined up with the account yet (first sign-in still choosing): never upload over the cloud
    if (!force && meta.uid !== user.uid) return;
    if (!force && sameMap(now, meta.hashes)) return;
    syncing = true; notify();
    try {
      const snap = await manifestRef().get(), man = snap.exists ? snap.data() : { keys: {} };
      // someone else wrote since we last synced: don't overwrite blindly
      if (!force && snap.exists && meta.uid === user.uid && man.updatedAt > (meta.rev || 0)) { syncing = false; notify(); conflict(man); return; }
      const keys = {};
      for (const k of Object.keys(now)) {
        const old = man.keys && man.keys[k];
        if (old && old.h === now[k]) { keys[k] = old; continue; }
        const r = await writeValue(k, ls.getItem(k) || '', old && old.n);
        keys[k] = { h: now[k], n: r.n, z: r.z };
      }
      for (const k of Object.keys(man.keys || {})) if (!keys[k]) for (let i = 0; i < man.keys[k].n; i++) await blobRef(k, i).delete();
      const updatedAt = Date.now();
      seenRemote = updatedAt; // our own write must not come back as "changed on another device"
      await manifestRef().set({ updatedAt, device: deviceName(), keys, email: user.email || '' });
      writeMeta({ uid: user.uid, rev: updatedAt, hashes: now, at: updatedAt });
      lastErr = '';
    } catch (e) { lastErr = friendly(e); } finally { syncing = false; notify(); }
  }

  /** Replace this device's saves with the cloud's, then reload so every screen picks them up. */
  async function pull(man, why) {
    if (!user) return;
    syncing = true; notify();
    try {
      if (!man) { const s = await manifestRef().get(); if (!s.exists) { syncing = false; notify(); return push(true); } man = s.data(); }
      const cur = localHashes(), vals = {};
      for (const k of Object.keys(man.keys || {})) if (cur[k] !== man.keys[k].h) vals[k] = await readValue(k, man.keys[k]);
      muted++;
      try {
        Object.entries(vals).forEach(([k, v]) => ls.setItem(k, v));
        localKeys().forEach((k) => { if (!man.keys[k]) ls.removeItem(k); });
      } finally { muted--; }
      writeMeta({ uid: user.uid, rev: man.updatedAt, hashes: localHashes(), at: Date.now() });
      try { sessionStorage.setItem('rl.acct.msg', why || ('Saves synced from ' + (man.device || 'your other device') + '.')); } catch (e) { /* ignore */ }
      location.reload();
    } catch (e) { lastErr = friendly(e); syncing = false; notify(); }
  }

  /** Does this device hold anything worth keeping (a career, a tournament, custom teams or roster edits)? A fresh browser only has defaults. */
  function meaningful() {
    if (localKeys().some((k) => /^rlsim\.career\.v1/.test(k))) return true;
    try { const s = JSON.parse(ls.getItem('rlsim.v1') || '{}'); return !!(s.T || (s.customTeams && s.customTeams.length) || (s.teamEdits && Object.keys(s.teamEdits).length)); } catch (e) { return false; }
  }
  /** Signed in (on this device for the first time, or the page just opened): line local and cloud up. */
  async function firstSync() {
    try {
      const meta = readMeta(), snap = await manifestRef().get();
      const local = localHashes(), hasLocal = meaningful();
      if (!snap.exists) return push(true);                                // brand-new account: this device seeds it
      const man = snap.data(); seenRemote = man.updatedAt;
      if (meta.uid !== user.uid) {                                        // first time this account is used here
        const cloudSame = Object.keys(man.keys || {}).every((k) => local[k] === man.keys[k].h) && Object.keys(local).every((k) => man.keys[k]);
        if (cloudSame) { writeMeta({ uid: user.uid, rev: man.updatedAt, hashes: local, at: Date.now() }); return; }
        if (!hasLocal) return pull(man);
        return choose(man);
      }
      const dirty = !sameMap(local, meta.hashes), newer = man.updatedAt > (meta.rev || 0);
      if (newer && dirty) return conflict(man);
      if (newer) return pull(man);
      if (dirty) return push();
    } catch (e) { lastErr = friendly(e); notify(); }
  }

  /** While the page is open, hear about saves made on another device. */
  function watchRemote() {
    try {
      unsub = manifestRef().onSnapshot((s) => {
        if (!s.exists) return; const man = s.data();
        if (man.updatedAt <= Math.max(seenRemote, readMeta().rev || 0)) return;
        seenRemote = man.updatedAt;
        if (ui) ui.toast('Your saves changed on ' + (man.device || 'another device') + '.', { label: 'Load them', fn: () => { const dirty = !sameMap(localHashes(), readMeta().hashes); if (dirty) conflict(man); else pull(man); } });
      }, () => { /* offline: Sync now retries */ });
    } catch (e) { /* ignore */ }
  }

  /* ---------------- choices ---------------- */
  function summary(keys) {
    const has = (k) => keys.some((x) => x === k || x.startsWith(k));
    const careers = keys.filter((k) => /^rlsim\.career\.v1(\.s\d+)?$/.test(k)).length;
    return [careers ? careers + ' career save' + (careers === 1 ? '' : 's') : 'no career', has('rlsim.v1') ? 'tournaments & settings' : ''].filter(Boolean).join(', ');
  }
  function choose(man) {
    if (!ui) return;
    ui.openModal(`${ui.modalHead('Which saves should this account use?', 'This device and your account both have saves.')}
      <div class="modal-body acct-choose">
        <button class="acct-opt" type="button" data-acct="pull"><b>Use my account's saves</b><small>From ${ui.esc(man.device || 'another device')} · ${ago(man.updatedAt)} · ${ui.esc(summary(Object.keys(man.keys || {})))}</small><em>This device's current saves are replaced.</em></button>
        <button class="acct-opt" type="button" data-acct="push"><b>Upload this device's saves</b><small>${ui.esc(summary(localKeys()))}</small><em>The saves in your account are replaced.</em></button>
        <p class="help">Tip: Settings › Back up all data first if you want to keep both.</p>
      </div>`, { size: 'md' });
    bindChoice(man);
  }
  function conflict(man) {
    if (!ui) return;
    ui.openModal(`${ui.modalHead('Saves changed in two places', 'Since the last sync, this device and ' + ui.esc(man.device || 'another device') + ' both changed your saves.')}
      <div class="modal-body acct-choose">
        <button class="acct-opt" type="button" data-acct="pull"><b>Keep the account's version</b><small>${ui.esc(man.device || 'Other device')} · ${ago(man.updatedAt)}</small><em>Changes made here since the last sync are lost.</em></button>
        <button class="acct-opt" type="button" data-acct="push"><b>Keep this device's version</b><small>${ui.esc(deviceName())} · now</small><em>The other device's latest changes are replaced.</em></button>
      </div>`, { size: 'md' });
    bindChoice(man);
  }
  function bindChoice(man) {
    document.querySelectorAll('#modalRoot [data-acct]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('#modalRoot [data-acct]').forEach((x) => (x.disabled = true));
      if (b.dataset.acct === 'pull') pull(man, 'Loaded the saves from your account.');
      else { ui.closeModal(); push(true).then(() => ui.toast(lastErr ? 'Upload failed: ' + lastErr : 'This device\'s saves are now in your account.')); }
    }));
  }

  /* ---------------- sign in / sign up screens ---------------- */
  const ERR = {
    'auth/invalid-email': 'That e-mail address doesn’t look right.',
    'auth/missing-password': 'Enter a password.',
    'auth/weak-password': 'Use a password of at least 6 characters.',
    'auth/email-already-in-use': 'There is already an account with this e-mail. Sign in instead.',
    'auth/invalid-credential': 'Wrong e-mail or password.',
    'auth/wrong-password': 'Wrong e-mail or password.',
    'auth/user-not-found': 'No account with this e-mail. Create one instead.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
    'auth/network-request-failed': 'No connection to the account server. Check your internet.',
    'auth/operation-not-allowed': 'E-mail sign-in isn’t switched on for this site yet (Firebase console › Authentication › Sign-in method).',
    'permission-denied': 'The cloud refused access. The Firestore security rules may not be set up yet.',
    'unavailable': 'The cloud can’t be reached right now. Your saves stay on this device and sync later.',
  };
  function friendly(e) { const c = (e && e.code) || ''; return ERR[c] || ERR[c.replace(/^firestore\//, '')] || (e && e.message) || String(e); }

  function open(tab) {
    if (!ui) return;
    if (!configured()) {
      ui.openModal(`${ui.modalHead('Accounts', 'Sync your saves across devices with an e-mail account.')}<div class="modal-body"><p>Accounts aren’t set up on this copy of the simulator yet.</p><p class="help">The site owner needs to add a Firebase project (see <code>js/firebase-config.example.js</code>). Until then everything is saved in this browser, and Settings › Back up all data moves saves between devices.</p></div>`, { size: 'sm' });
      return;
    }
    if (status !== 'ready') {
      ui.openModal(`${ui.modalHead('Accounts', '')}<div class="modal-body"><p>${status === 'error' ? 'Couldn’t load the account service: ' + ui.esc(lastErr) : 'Connecting…'}</p></div>`, { size: 'sm' });
      boot().then((ok) => { if (ok && document.querySelector('#modalRoot .modal')) open(tab); });
      return;
    }
    if (user) return openAccount();
    const up = tab === 'up';
    ui.openModal(`${ui.modalHead(up ? 'Create an account' : 'Sign in', 'Use the same account on every device: your careers, tournaments and settings follow you.')}
      <form class="modal-body acct-form" id="acctForm" novalidate>
        <div class="seg acct-tabs" role="tablist"><button type="button" class="${up ? '' : 'active'}" data-acct-tab="in" role="tab" aria-selected="${!up}">Sign in</button><button type="button" class="${up ? 'active' : ''}" data-acct-tab="up" role="tab" aria-selected="${up}">Create account</button></div>
        <div class="field"><label for="acctEmail">E-mail</label><input class="input" id="acctEmail" type="email" autocomplete="email" required /></div>
        <div class="field"><label for="acctPw">Password</label><input class="input" id="acctPw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="6" required />${up ? '<p class="help" style="margin:4px 0 0">At least 6 characters.</p>' : ''}</div>
        ${up ? '<div class="field"><label for="acctPw2">Repeat password</label><input class="input" id="acctPw2" type="password" autocomplete="new-password" required /></div>' : ''}
        <p class="acct-err" id="acctErr" role="alert"></p>
        <div class="acct-row"><button class="btn primary" type="submit" id="acctGo">${up ? 'Create account' : 'Sign in'}</button>${up ? '' : '<button class="btn" type="button" id="acctForgot">Forgot password?</button>'}</div>
        <p class="help">Only your e-mail and your saves are stored. Your saves stay in this browser too, so the simulator still works offline.</p>
      </form>`, { size: 'sm' });
    const $ = (s) => document.querySelector(s), err = (m) => { $('#acctErr').textContent = m || ''; };
    document.querySelectorAll('[data-acct-tab]').forEach((b) => b.addEventListener('click', () => { const em = $('#acctEmail').value; open(b.dataset.acctTab); const n = $('#acctEmail'); if (n) n.value = em; }));
    if ($('#acctForgot')) $('#acctForgot').addEventListener('click', () => {
      const em = $('#acctEmail').value.trim(); if (!em) { err('Enter your e-mail first, then press Forgot password.'); $('#acctEmail').focus(); return; }
      auth.sendPasswordResetEmail(em).then(() => { err(''); ui.toast('If there’s an account for ' + em + ', a reset link is on its way.'); }, (e) => err(friendly(e)));
    });
    $('#acctForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const em = $('#acctEmail').value.trim(), pw = $('#acctPw').value;
      if (up && pw !== $('#acctPw2').value) { err('The passwords don’t match.'); return; }
      const go = $('#acctGo'); go.disabled = true; go.textContent = up ? 'Creating…' : 'Signing in…'; err('');
      (up ? auth.createUserWithEmailAndPassword(em, pw) : auth.signInWithEmailAndPassword(em, pw)).then((cred) => {
        if (up && cred.user && cred.user.sendEmailVerification) cred.user.sendEmailVerification().catch(() => { /* optional */ });
        ui.closeModal(); ui.toast(up ? 'Account created. Your saves are being uploaded.' : 'Signed in as ' + em + '.');
      }, (e) => { go.disabled = false; go.textContent = up ? 'Create account' : 'Sign in'; err(friendly(e)); });
    });
  }
  function openAccount() {
    const meta = readMeta(), dirty = !sameMap(localHashes(), meta.hashes);
    ui.openModal(`${ui.modalHead('Your account', '')}
      <div class="modal-body">
        <div class="acct-card"><span class="acct-av" aria-hidden="true">${ui.esc((user.email || '?')[0].toUpperCase())}</span><div><b>${ui.esc(user.email || '')}</b><small>${user.emailVerified ? 'E-mail verified' : 'E-mail not verified yet'}</small></div></div>
        <div class="kv"><span>Sync</span><b>${syncing ? 'Syncing…' : lastErr ? 'Problem' : dirty ? 'Changes waiting to upload' : 'Up to date'}</b></div>
        <div class="kv"><span>Last synced</span><span>${ago(meta.at)}</span></div>
        <div class="kv"><span>This device</span><span>${ui.esc(deviceName())}</span></div>
        ${lastErr ? `<p class="acct-err">${ui.esc(lastErr)}</p>` : ''}
        <p class="help">Saves upload a few seconds after every change and when you leave the page. On another device, sign in with the same e-mail to pick them up.</p>
      </div>
      <div class="modal-foot">${user.emailVerified ? '' : '<button class="btn" type="button" data-acct-do="verify">Resend verification</button>'}<button class="btn" type="button" data-acct-do="out">Sign out</button><button class="btn primary" type="button" data-acct-do="sync">Sync now</button></div>`, { size: 'sm' });
    document.querySelectorAll('[data-acct-do]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.acctDo;
      if (a === 'out') { const em = user.email; clearTimeout(timer); (timer ? push() : Promise.resolve()).then(() => auth.signOut()).then(() => { ui.closeModal(); ui.toast('Signed out of ' + em + '. Your saves stay on this device.'); }); }
      else if (a === 'verify') user.sendEmailVerification().then(() => ui.toast('Verification e-mail sent.'), (e) => ui.toast(friendly(e)));
      else { b.disabled = true; b.textContent = 'Syncing…'; firstSync().then(() => push()).then(() => { if (document.querySelector('#modalRoot .modal') && user) openAccount(); ui.toast(lastErr ? 'Sync problem: ' + lastErr : 'Saves synced.'); }); }
    }));
  }

  global.RLAccount = {
    init(o) {
      ui = o;
      try { const m = sessionStorage.getItem('rl.acct.msg'); if (m) { sessionStorage.removeItem('rl.acct.msg'); setTimeout(() => ui.toast(m), 400); } } catch (e) { /* ignore */ }
      if (configured()) boot();
    },
    open, configured,
    /** For the account buttons: 'off' (not configured), 'out', 'syncing', 'error' or 'in'. */
    state: () => (!configured() ? 'off' : !user ? 'out' : syncing ? 'syncing' : lastErr ? 'error' : 'in'),
    email: () => (user && user.email) || '',
    onChange: (f) => listeners.push(f),
  };
})(window);
