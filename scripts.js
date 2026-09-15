/* ====== Auth / Login Screen Module ======
   Architectural principles:
   - We do not touch the existing ActiveDialogsApp: just hide .shell until a token exists.
   - Isolation via immediate invocation and exporting window.Auth (minimal).
   - Store the "token" in localStorage (mock). Replace loginRequest() for real integration.
*/
(function AuthController(){
  const STORAGE_KEY = 'authToken';
  const loginScreen = document.getElementById('loginScreen');
  const loginForm = document.getElementById('loginForm');
  const shell = document.querySelector('body > .shell');
  if(!loginScreen || !loginForm || !shell) return; // fail-safe

  const submitBtn = document.getElementById('loginSubmit');
  const globalError = document.getElementById('loginGlobalError');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');

  // ====== STATE MACHINE ======
  // phases: unauthenticated | auth-loading | auth-failed | authenticated
  let authPhase = 'unauthenticated';
  let lastAuthError = null;

  function setAuthPhase(phase, { error = null } = {}){
    if(authPhase === phase && error === lastAuthError) return;
    authPhase = phase; lastAuthError = error;
    const root = document.documentElement;
    // remove old phase classes
    root.classList.remove('auth-phase--unauthenticated','auth-phase--auth-loading','auth-phase--auth-failed','auth-phase--authenticated');
    root.classList.add(`auth-phase--${phase}`);
    // visual apply
    applyPhase();
    // event
    window.dispatchEvent(new CustomEvent('auth:change', { detail:{ phase: authPhase, error:lastAuthError }}));
  }

  function applyPhase(){
    const isLoading = authPhase === 'auth-loading';
    const isAuthed = authPhase === 'authenticated';
    if(isAuthed){
      loginScreen.hidden = true;
      shell.removeAttribute('inert');
      shell.style.pointerEvents = '';
    } else {
      loginScreen.hidden = false;
      // block the background only once if inert is not yet set
      if(!shell.hasAttribute('inert')) shell.setAttribute('inert','');
      shell.style.pointerEvents = 'none';
    }
    if(submitBtn){
      submitBtn.disabled = isLoading || !isFormValid();
      submitBtn.classList.toggle('is-ready', !submitBtn.disabled && !isLoading && !isAuthed);
    }
    [usernameInput, passwordInput].forEach(inp=>{
      if(!inp) return;
      if(isLoading){ inp.setAttribute('disabled',''); }
      else { inp.removeAttribute('disabled'); }
    });
    if(globalError){
      if(authPhase === 'auth-failed' && lastAuthError){
        globalError.hidden = false; globalError.textContent = lastAuthError;
      } else {
        globalError.hidden = true; globalError.textContent = '';
      }
    }
  }

  function isAuthed(){ return !!localStorage.getItem(STORAGE_KEY); }

  function showLogin(){
    document.documentElement.classList.add('login-active');
    setAuthPhase('unauthenticated');
    setTimeout(()=> usernameInput?.focus(), 30);
    // Fallbacks for render/style race conditions
    requestAnimationFrame(()=>{
      if(document.documentElement.classList.contains('login-active') && loginScreen.hidden){
        console.warn('[Auth] rf fallback: force show login');
        loginScreen.hidden = false;
      }
    });
    setTimeout(()=>{
      if(document.documentElement.classList.contains('login-active') && loginScreen.hidden){
        console.warn('[Auth] timeout fallback: force show login');
        loginScreen.hidden = false;
      }
    },120);
  }

  function showApp(){
    document.documentElement.classList.remove('login-active');
    setAuthPhase('authenticated');
    // Do not set focus explicitly so no outline appears around the list
  }

  function setLoading(flag){
    const spinner = submitBtn?.querySelector('.btn__spinner');
    if(spinner) spinner.hidden = !flag;
    setAuthPhase(flag ? 'auth-loading' : (isAuthed()? 'authenticated':'unauthenticated'));
  }

  function setFieldError(id,msg){
    const el = loginForm.querySelector(`.login-card__error[data-error-for="${id}"]`);
    if(el) el.textContent = msg || '';
    const input = document.getElementById(id);
    if(input){
      if(msg) input.setAttribute('aria-invalid','true'); else input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(){
    loginForm.querySelectorAll('.login-card__error').forEach(e=>e.textContent='');
    [ 'loginUsername','loginPassword' ].forEach(id=>document.getElementById(id)?.removeAttribute('aria-invalid'));
    if(globalError){ globalError.hidden = true; globalError.textContent=''; }
    lastAuthError = null;
  }

  // ====== VALIDATION ======
  const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;
  function validateUsername(raw){
    const value = raw.trim();
    if(!value) return 'Введите логин';
    if(value.length < 3) return 'Минимум 3 символа';
    if(!USERNAME_RE.test(value)) return 'Допустимы лат. буквы, цифры, . _ -';
    return null;
  }
  function validatePassword(raw){
    if(!raw) return 'Введите пароль';
    if(raw.length < 6) return 'Минимум 6 символов';
    return null;
  }
  function isFormValid(){
    const uErr = validateUsername(usernameInput?.value || '');
    const pErr = validatePassword(passwordInput?.value || '');
    return !uErr && !pErr;
  }

  function runLiveValidation(){
    if(!usernameInput || !passwordInput) return;
    const uErr = validateUsername(usernameInput.value);
    const pErr = validatePassword(passwordInput.value);
    setFieldError('loginUsername', uErr || '');
    setFieldError('loginPassword', pErr || '');
    // Do not show the global error from live validation
    if(submitBtn && authPhase !== 'auth-loading' && authPhase !== 'authenticated'){
      submitBtn.disabled = !!(uErr || pErr);
      submitBtn.classList.toggle('is-ready', !submitBtn.disabled);
    }
  }

  usernameInput?.addEventListener('input', runLiveValidation);
  passwordInput?.addEventListener('input', runLiveValidation);

  async function loginRequest(username,password){
    console.log('[Auth] loginRequest start', { uLen: username.length, pLen: password.length });
    // MOCK: simulates a real request
    await new Promise(r=>setTimeout(r,400));
    // Success if the form is valid (strict validation)
    if(!validateUsername(username) && !validatePassword(password)){
      const tokenObj = { token: 'mock-'+Date.now() };
      console.log('[Auth] loginRequest success', tokenObj);
      return tokenObj;
    }
    console.log('[Auth] loginRequest fail (empty field)');
    throw new Error('Введите логин и пароль');
  }

  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    clearErrors();
    // Get elements by id (fields have different name attributes, so direct access loginForm.loginUsername does not work)
    const usernameEl = document.getElementById('loginUsername');
    const passwordEl = document.getElementById('loginPassword');
    const username = usernameEl ? usernameEl.value.trim() : '';
    const password = passwordEl ? passwordEl.value : '';
    const userErr = validateUsername(username);
    const passErr = validatePassword(password);
    if(userErr) setFieldError('loginUsername', userErr);
    if(passErr) setFieldError('loginPassword', passErr);
    if(userErr || passErr){
      console.log('[Auth] validation blocked submit', { userErr, passErr });
      // focus the first invalid field
      if(userErr) usernameInput?.focus(); else if(passErr) passwordInput?.focus();
      return;
    }
    setLoading(true);
    try {
      const { token } = await loginRequest(username,password);
      localStorage.setItem(STORAGE_KEY, token);
      console.log('[Auth] token stored, calling showApp');
      showApp();
    } catch(err){
      console.warn('[Auth] login error', err);
      if(globalError){ globalError.hidden = false; globalError.textContent = err.message || 'Ошибка входа'; }
      setAuthPhase('auth-failed', { error: err.message || 'Ошибка входа' });
      // DEV fallback: if the hash is #forceLogin, login still works
      if(location.hash === '#forceLogin'){
        console.log('[Auth] #forceLogin fallback engaged');
        localStorage.setItem(STORAGE_KEY, 'forced-'+Date.now());
        showApp();
      }
    } finally { setLoading(false); }
  });

  const logoutBtn = document.getElementById('btnLogout');
  if(logoutBtn){
    logoutBtn.addEventListener('click', ()=>{
      // Now logout is confirmed by the LogoutConfirm modal
      if(window.LogoutConfirm && typeof window.LogoutConfirm.open === 'function'){
        window.LogoutConfirm.open({ trigger:'headerBtn' });
      } else {
        // Fallback: if the module was not initialized, perform an immediate logout
        performLogout();
      }
    });
  }

  function performLogout(){
    try { localStorage.removeItem(STORAGE_KEY); } catch(_){ /* noop */ }
    showLogin();
  }

  // INIT
  if(isAuthed()) { console.log('[Auth] already authed, showing app'); showApp(); }
  else { console.log('[Auth] not authed, showing login'); showLogin(); }

  window.Auth = { showLogin, showApp, isAuthed, getPhase: ()=>authPhase, performLogout };
})();
/*
  ====== UI Module: Active dialogs ======
  Purpose:
    - Rendering of the active dialog list with pagination
    - Managing the custom select (project)
    - Project popup menu and dialog context menu
    - Focus management and ARIA for accessibility

  Key principles:
    - Single state + cached DOM references
    - Event delegation on containers (list/document)
    - All visual colors come from CSS only; JS handles classes/ARIA
*/
(function ActiveDialogsApp() {
  'use strict';

  /* ====== Mock data ======
     In a real integration, replace with backend loading and reactive re-render.
  */
  const MOCK_DIALOGS = [
    { id: 1, name: 'user_1', time: '10:15', platform: 'Android 13 • ФРИИ 1.3.7', origin: 'bot' },
    { id: 2, name: 'user_2', time: '09:42', platform: 'iOS 16.7 • ФРИИ 2.8.6', origin: 'operator' },
    { id: 3, name: 'user_3', time: '08:30', platform: 'Android 12 • ФРИИ 1.2.1', origin: 'bot' },
    { id: 4, name: 'user_4', time: '07:55', platform: 'iOS 16.9 • ФРИИ 1.6.0', origin: 'operator' },
    { id: 5, name: 'user_5', time: '07:12', platform: 'Android 11 • ФРИИ 2.4.7', origin: 'bot' },
    { id: 6, name: 'user_6', time: '06:48', platform: 'iOS 15.4 • ФРИИ 1.1.0', origin: 'bot' },
    { id: 7, name: 'user_7', time: '06:20', platform: 'Android 13 • ФРИИ 1.3.7', origin: 'operator' },
    { id: 8, name: 'user_8', time: '05:59', platform: 'iOS 16.8 • ФРИИ 2.4.7', origin: 'bot' },
    { id: 9, name: 'user_9', time: '05:30', platform: 'Android 10 • ФРИИ 1.0.0', origin: 'bot' },
    { id: 10, name: 'user_10', time: '05:01', platform: 'iOS 16.7 • ФРИИ 1.6.9', origin: 'operator' },
    { id: 11, name: 'user_11', time: '04:45', platform: 'Android 13 • ФРИИ 2.8.6', origin: 'bot' },
    { id: 12, name: 'user_12', time: '04:20', platform: 'iOS 16.9 • ФРИИ 1.6.0', origin: 'operator' },
    { id: 13, name: 'user_13', time: '03:58', platform: 'Android 12 • ФРИИ 1.2.1', origin: 'bot' },
    { id: 14, name: 'user_14', time: '03:40', platform: 'iOS 15.4 • ФРИИ 1.1.0', origin: 'bot' },
    { id: 15, name: 'user_15', time: '03:20', platform: 'Android 11 • ФРИИ 2.4.7', origin: 'operator' },
    { id: 16, name: 'user_16', time: '03:05', platform: 'iOS 16.7 • ФРИИ 2.8.6', origin: 'bot' },
    { id: 17, name: 'user_17', time: '02:50', platform: 'Android 13 • ФРИИ 1.3.7', origin: 'bot' },
    { id: 18, name: 'user_18', time: '02:35', platform: 'iOS 16.8 • ФРИИ 2.4.7', origin: 'operator' },
    { id: 19, name: 'user_19', time: '02:20', platform: 'Android 10 • ФРИИ 1.0.0', origin: 'bot' },
    { id: 20, name: 'user_20', time: '02:05', platform: 'iOS 16.7 • ФРИИ 1.6.9', origin: 'bot' },
    { id: 21, name: 'user_21', time: '01:50', platform: 'Android 13 • ФРИИ 2.8.6', origin: 'operator' },
    { id: 22, name: 'user_22', time: '01:35', platform: 'iOS 16.9 • ФРИИ 1.6.0', origin: 'bot' },
    { id: 23, name: 'user_23', time: '01:20', platform: 'Android 12 • ФРИИ 1.2.1', origin: 'bot' },
    { id: 24, name: 'user_24', time: '01:05', platform: 'iOS 15.4 • ФРИИ 1.1.0', origin: 'operator' },
    { id: 25, name: 'user_25', time: '00:50', platform: 'Android 11 • ФРИИ 2.4.7', origin: 'bot' },
  ];

  // Archived dialogs (demo data). id > 1000 to avoid collisions
  const ARCHIVE_DIALOGS = [
    { id: 1001, name: 'archived_user_1', time: 'Вчера', platform: 'Android 13 • ФРИИ 1.3.7', origin: 'operator' },
    { id: 1002, name: 'archived_user_2', time: 'Вчера', platform: 'iOS 16.7 • ФРИИ 2.8.6', origin: 'bot' },
    { id: 1003, name: 'archived_user_3', time: '2 дн. назад', platform: 'Android 12 • ФРИИ 1.2.1', origin: 'operator' },
    { id: 1004, name: 'archived_user_4', time: '3 дн. назад', platform: 'iOS 15.4 • ФРИИ 1.1.0', origin: 'bot' },
    { id: 1005, name: 'archived_user_5', time: '5 дн. назад', platform: 'Android 11 • ФРИИ 2.4.7', origin: 'operator' },
  ];

  // Lazy archive message seed flag
  let archiveSeeded = false;

  /* ====== State ======
     Single source of truth for pagination and the selected dialog.
  */
  const state = {
    pageSize: 10,
    currentPage: 1,
    selectedId: null,
    viewMode: 'active', // 'active' | 'archive'
  };

  /* ====== DOM ======
     All required elements are cached here for performance.
  */
  const dom = {
    list: document.getElementById('dialogList'),
    pageInfo: document.getElementById('pageInfo'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    totalCounter: document.getElementById('totalCounter'),
    // Right chat panel
    workspaceEmpty: document.querySelector('.workspace__empty'),
    chatPanel: document.getElementById('chatPanel'),
    chatUser: document.getElementById('chatUser'),
    chatMeta: document.getElementById('chatMeta'),
    chatBadge: document.getElementById('chatBadge'),
    chatBody: document.getElementById('chatBody'),
    projectSelect: document.getElementById('projectSelect'),
    projectDisplay: document.getElementById('projectDisplay'),
    selectRoot: document.querySelector('.select'),
    dropdown: document.getElementById('projectDropdown'),
    logout: document.getElementById('btnLogout'),
    projectMenuBtn: document.getElementById('projectMenuBtn'),
    projectMenu: document.getElementById('projectMenu'),
    dialogMenu: null,
    chatFooter: document.getElementById('chatFooter'),
  };

  let dialogMenuAnchorBtn = null; // anchor button for positioning the dialog menu

  /* ====== Messages (store v2 — normalized) ======
     Message (extensible format):
       id: string (may be 'temp:<n>' for local drafts)
       dialogId: number
       author: 'client'|'bot'|'operator'|'system'
       text: string
       attachments?: Array<{
         id:string|number,
         name:string,
         size?:string,              // string like '256 KB' — parsed best-effort
         contentType?:string,       // MIME (used for image/* classification)
         downloadUrl?:string,       // download link (may equal url)
         url?:string,               // source URL (e.g. CDN for the image)
         displayHint?:'inline-image'|'file' // EXPLICIT hint from the backend on how to render
       }>
       createdAt: string|Date
       status?: 'pending'|'sent'|'delivered'|'read'|'failed'
       seq?: number (monotonic sequence number from the server — reserved)
     Storage:
       store[dialogId] = { byId:{}, order:[ids], lowestSeq, highestSeq }
     Goals: fast updates, deduplication, future pagination (append/prepend).

     displayHint — extensible contract with the backend. If set:
       'inline-image' — force rendering as an inline image
       'file'         — force file card
     If missing, the heuristic applies: isInlineImage(att) => inline-image, otherwise file.
     This lets the backend override the automatic logic (e.g. disable inline for very long panoramas or SVG).
  */
  const MessageStore = (() => {
    const dialogs = Object.create(null); // dialogId -> bucket
    let tempCounter = 1; // for generating temporary ids (demo)
    const listeners = new Set();

    function ensure(dialogId){
      if(!dialogs[dialogId]){
        dialogs[dialogId] = {
          byId: Object.create(null),
          order: [],
          lowestSeq: null,
          highestSeq: null,
          hasMoreBackward: true,
          hasMoreForward: false,
        };
      }
      return dialogs[dialogId];
    }

    function nextTempId(){ return 'temp:' + (tempCounter++); }

    function notify(evt){ listeners.forEach(l=>{ try{ l(evt); }catch(e){ /* silent */ } }); }

    function sortOrder(bucket){
      bucket.order.sort((a,b)=>{
        const A = bucket.byId[a];
        const B = bucket.byId[b];
        if(!A || !B) return 0;
        const ak = A.seq != null ? A.seq : new Date(A.createdAt).getTime();
        const bk = B.seq != null ? B.seq : new Date(B.createdAt).getTime();
        return ak - bk;
      });
    }

    function ingestBatch(dialogId, list, { position='append', replace=false } = {}){
      const bucket = ensure(dialogId);
      if(replace){ bucket.byId = Object.create(null); bucket.order = []; }
      const added = [];
      for(const msg of list){
        if(!msg || !msg.id) continue;
        const id = String(msg.id);
        if(!bucket.byId[id]){
          bucket.byId[id] = msg;
          if(position === 'prepend') bucket.order.unshift(id); else bucket.order.push(id);
          added.push(id);
        } else {
          bucket.byId[id] = { ...bucket.byId[id], ...msg }; // merge
        }
      }
      if(added.length) sortOrder(bucket);
      notify({ type:'batch', dialogId, added });
      return added;
    }

    function addLocal(dialogId, { author, text, attachments = [], createdAt = new Date(), status='pending' }){
      const bucket = ensure(dialogId);
      const id = nextTempId();
      const msg = { id, dialogId, author, text, attachments, createdAt, status };
      bucket.byId[id] = msg;
      bucket.order.push(id);
      notify({ type:'add', dialogId, id, local:true });
      return msg;
    }

    function updateStatus(dialogId, id, status){
      const bucket = ensure(dialogId);
      if(bucket.byId[id]){
        bucket.byId[id] = { ...bucket.byId[id], status };
        notify({ type:'status', dialogId, id, status });
      }
    }

    // Targeted update of attachment fields inside a message
    function updateAttachment(dialogId, msgId, attId, patch){
      const bucket = ensure(dialogId);
      const msg = bucket.byId[msgId];
      if(!msg || !Array.isArray(msg.attachments)) return false;
      let changed = false;
      msg.attachments = msg.attachments.map(att => {
        if(String(att.id) === String(attId)){
          changed = true;
          return { ...att, ...patch };
        }
        return att;
      });
      if(changed){
        notify({ type:'attachment-update', dialogId, msgId, attId, patch });
      }
      return changed;
    }

    function getList(dialogId){
      const bucket = ensure(dialogId);
      return bucket.order.map(i => bucket.byId[i]).filter(Boolean);
    }

    function subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }

    return { ingestBatch, addLocal, updateStatus, getList, subscribe, updateAttachment };
  })();

  function escapeHtml(str){
    return str
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function formatMsgDate(date){
    try {
      const d = date instanceof Date ? date : new Date(date);
      // Format: September 13, 15:41
      // toLocaleString with ru-RU and day+month+time gives the desired register.
      const opts = { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' };
      let s = d.toLocaleString('ru-RU', opts);
      // Strip possible commas (some environments insert them)
      s = s.replace(/,/g,'');
      return s;
    } catch(e){ return ''; }
  }

  function buildAuthorIcon(author){
    if(author === 'bot'){
      return `<svg class="msg__author-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
    }
    // operator
    return `<svg class="msg__author-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  }

  function createAttachmentBlock(att){
    const nameEsc = escapeHtml(att.name);
    const sizeEsc = escapeHtml(att.size || '');
    return createFileAttachment(att);
  }

  /* ====== Attachments v2 ======
     Display types:
       - Inline image (photo) if contentType image/* and size <= INLINE_IMAGE_MAX_BYTES
       - File block (universal) for all other cases
     Threshold and extensibility are extracted into constants
  */
  const INLINE_IMAGE_MAX_BYTES = 800 * 1024; // 800KB threshold (adjustable)
  const IMAGE_MIME_PREFIX = 'image/';
  const IMAGE_EXTENSIONS = ['jpg','jpeg','png','webp','gif'];

  function isImageAttachment(att){
    if(!att) return false;
    if(att.contentType && att.contentType.startsWith(IMAGE_MIME_PREFIX)) return true;
    // fallback by extension
    if(att.name){
      const m = att.name.toLowerCase().match(/\.([a-z0-9]+)$/);
      if(m && IMAGE_EXTENSIONS.includes(m[1])) return true;
    }
    return false;
  }

  function parseSizeToBytes(sizeStr){
    if(!sizeStr) return null;
    // expect formats like "123 KB" / "2.4 MB"
    const m = sizeStr.trim().match(/([0-9]+(?:\.[0-9]+)?)\s*(kb|mb|b)/i);
    if(!m) return null;
    const num = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if(unit === 'b') return num;
    if(unit === 'kb') return num * 1024;
    if(unit === 'mb') return num * 1024 * 1024;
    return null;
  }

  function isInlineImage(att){
    if(!isImageAttachment(att)) return false;
    const bytes = parseSizeToBytes(att.size);
    if(bytes != null && bytes > INLINE_IMAGE_MAX_BYTES) return false;
    return true;
  }

  function createInlineImageAttachment(att){
    const rawUrl = att.downloadUrl || att.url || '';
    const safeUrl = escapeHtml(rawUrl);
    const alt = escapeHtml(att.name || 'image');
    const nameEsc = escapeHtml(att.name || 'image');
    return `<figure class="msg-image msg-image--clickable" data-attachment-id="${att.id}" data-variant="inline-image" data-url="${safeUrl}" data-name="${nameEsc}">
      <img src="${safeUrl}" alt="${alt}" loading="lazy" decoding="async" />
      <a class="msg-image__download" href="${safeUrl}" download="${nameEsc}" aria-label="Скачать изображение" title="Скачать изображение">
        <svg class="msg-image__download-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" x2="12" y1="15" y2="3"/>
        </svg>
      </a>
    </figure>`;
  }

  function createFileAttachment(att){
    const nameEsc = escapeHtml(att.name || 'Файл');
    const sizeEsc = escapeHtml(att.size || '');
    const rawUrl = att.downloadUrl || att.url || '#';
    const downloadUrl = escapeHtml(rawUrl);
    const safeUrlAttr = escapeHtml(rawUrl === '#' ? '' : rawUrl);
    return `<div class="msg-file" data-attachment-id="${att.id}" data-variant="file" data-url="${safeUrlAttr}">
      <div class="msg-file__icon" aria-hidden="true"><img src="images/image.svg" alt="" /></div>
      <div class="msg-file__body">
        <div class="msg-file__name" title="${nameEsc}">${nameEsc}</div>
        <div class="msg-file__size">${sizeEsc}</div>
      </div>
      <a class="msg-file__download" href="${downloadUrl}" download title="Скачать">
        <img src="images/download.svg" alt="" />
      </a>
    </div>`;
  }

  /* ====== Attachment Variant Resolver ======
     Display source priority:
       1. att.displayHint (explicitly set by the backend: 'inline-image' | 'file')
       2. Auto-classification (isInlineImage → inline-image, otherwise file)
     Returns the string value of the variant for unified handling.
  */
  function classifyAttachmentVariant(att){
    if(!att) return 'file';
    if(att.displayHint === 'inline-image') return 'inline-image';
    if(att.displayHint === 'file') return 'file';
    return isInlineImage(att) ? 'inline-image' : 'file';
  }

  function buildAttachmentHtml(att){
    const variant = classifyAttachmentVariant(att);
    if(variant === 'inline-image') return createInlineImageAttachment(att);
    return createFileAttachment(att);
  }
  function createMessageHtml(msg){
    const textHtml = `<div class="msg__text">${escapeHtml(msg.text)}</div>`;
    const metaHtml = `<div class="msg__meta"><time datetime="${new Date(msg.createdAt).toISOString()}">${formatMsgDate(msg.createdAt)}</time></div>`;
    if(msg.author === 'client'){
      // New attachment support for client messages.
      // Architectural policy is uniform: attachments render inside the bubble between text and meta.
      let attachmentsHtml = '';
      if(Array.isArray(msg.attachments) && msg.attachments.length){
        const parts = [];
        for(const att of msg.attachments){
          parts.push(buildAttachmentHtml(att));
        }
        attachmentsHtml = `<div class="msg__attachments">${parts.join('')}</div>`;
      }
      return `<div class="msg msg--client" data-msg-id="${msg.id}">
        <div class="msg__bubble">
          ${textHtml}
          ${attachmentsHtml}
          ${metaHtml}
        </div>
      </div>`;
    }
    const isBot = msg.author === 'bot';
    const authorLabel = isBot ? 'Нейросеть' : 'Оператор';
    const authorHtml = `<div class="msg__author">${buildAuthorIcon(isBot ? 'bot' : 'operator')}<span class="msg__author-label">${authorLabel}</span></div>`;
    let attachmentsHtml = '';
    if(Array.isArray(msg.attachments) && msg.attachments.length){
      const parts = [];
      for(const att of msg.attachments){
        parts.push(buildAttachmentHtml(att));
      }
      attachmentsHtml = `<div class="msg__attachments">${parts.join('')}</div>`;
    }
    return `<div class="msg msg--agent ${isBot ? 'msg--bot':'msg--operator'}" data-msg-id="${msg.id}">
      ${authorHtml}
      <div class="msg__bubble">
        ${textHtml}
        ${attachmentsHtml}
        ${metaHtml}
      </div>
    </div>`;
  }

  function appendMessageToDom(dialogId, msg){
    if(!dom.chatBody || state.selectedId !== dialogId) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = createMessageHtml(msg);
    dom.chatBody.appendChild(wrap.firstElementChild);
    dom.chatBody.scrollTop = dom.chatBody.scrollHeight;
    const el = dom.chatBody.querySelector(`[data-msg-id="${msg.id}"]`);
    if(el) processMessageAttachments(dialogId, msg, el);
  }

  // Backward-compatible interface for the current composer
  function addMessage(dialogId, { author, text, attachments = [], createdAt = new Date() }){
    const msg = MessageStore.addLocal(dialogId, { author, text, attachments, createdAt, status: author === 'operator' ? 'pending':'sent' });
    appendMessageToDom(dialogId, msg);
    return msg;
  }

  function renderMessagesForDialog(dialogId){
    if(!dom.chatBody) return;
    dom.chatBody.innerHTML = '';
    if(dialogId == null) return;
    const list = MessageStore.getList(dialogId);
    const frag = document.createDocumentFragment();
    for(const m of list){
      const w = document.createElement('div');
      w.innerHTML = createMessageHtml(m);
      frag.appendChild(w.firstElementChild);
    }
    dom.chatBody.appendChild(frag);
    dom.chatBody.scrollTop = dom.chatBody.scrollHeight;
    // Post-process attachments (upgrade/fallback)
    for(const m of list){
      const node = dom.chatBody.querySelector(`[data-msg-id="${m.id}"]`);
      if(node) processMessageAttachments(dialogId, m, node);
    }
  }

  /* ====== Runtime Attachment Capability Check ======
     Goal: guarantee the "either inline image or file card" rule. If:
       - We tried inline rendering and the image failed to load → fall back to a file card.
       - We have a file card, but the URL potentially points to an image (by extension/MIME) → try loading it and upgrade to inline.
     This makes the behavior more robust against inaccurate contentTypes.
  */
  function looksLikeImageUrl(url){
    if(!url) return false;
    return /\.(png|jpe?g|gif|webp|avif)$/i.test(url.split('?')[0]);
  }

  function processMessageAttachments(dialogId, msg, msgEl){
    if(!msg || !Array.isArray(msg.attachments) || !msg.attachments.length) return;
    const attNodes = msgEl.querySelectorAll('[data-attachment-id]');
    if(!attNodes.length) return;
    for(const att of msg.attachments){
      const node = msgEl.querySelector(`[data-attachment-id="${att.id}"]`);
      if(!node) continue;
      const currentVariant = node.getAttribute('data-variant');
      const url = att.url || att.downloadUrl || node.getAttribute('data-url') || '';
      // === Case 1: inline → check onerror (install handler if not installed)
      if(currentVariant === 'inline-image'){
        const img = node.querySelector('img');
        if(img && !img.dataset._handler){
          img.dataset._handler = '1';
          img.addEventListener('error', ()=>{
            // Fallback: replace with file-attachment
            const fallbackHtml = createFileAttachment({ ...att, displayHint:'file' });
            const wrap = document.createElement('div');
            wrap.innerHTML = fallbackHtml;
            node.replaceWith(wrap.firstElementChild);
            MessageStore.updateAttachment(dialogId, msg.id, att.id, { displayHint:'file' });
          }, { once:true });
        }
        continue; // for inline, check error only
      }
      // === Case 2: file → we can try to upgrade if it is potentially an image
      if(currentVariant === 'file'){
        // Scenario: displayHint='file' — never upgrade
        if(att.displayHint === 'file') continue;
        if(!(att.displayHint === 'inline-image') && !(att.contentType && att.contentType.startsWith('image/')) && !looksLikeImageUrl(url)) continue;
        if(!url || url === '#') continue;
        try {
            const testImg = new Image();
            testImg.loading = 'eager';
            testImg.decoding = 'async';
            testImg.addEventListener('load', ()=>{
              // Upgrade to inline-image
              const html = createInlineImageAttachment({ ...att, displayHint:'inline-image' });
              const wrap = document.createElement('div');
              wrap.innerHTML = html;
              node.replaceWith(wrap.firstElementChild);
              MessageStore.updateAttachment(dialogId, msg.id, att.id, { displayHint:'inline-image' });
            }, { once:true });
            testImg.addEventListener('error', ()=>{ /* stay in file mode */ }, { once:true });
            testImg.src = url;
        } catch(e){ /* silent */ }
      }
    }
  }

  function seedDemoMessages(){
    // If the first dialog already has messages — consider the seed done
    if(MessageStore.getList(1).length) return;

    const intro = [
      'Здравствуйте, у меня вопрос по заказу',
      'Добрый день! Подскажите статус по заказу',
      'Привет! Нужна помощь по заказу',
      'Добрый вечер. Хочу уточнить информацию по заказу',
      'Здравствуйте! Не пришло уведомление по заказу'
    ];
    const follow = [
      'Пока ничего не изменилось.',
      'Сейчас нахожусь в пункте выдачи.',
      'Приложил(а) скриншот, посмотрите.',
      'Если нужно — могу прислать ещё данные.',
      'В приложении файл, там подробности.'
    ];
    const thanks = [ 'Спасибо!', 'Благодарю за оперативность!', 'Отлично, жду.', 'Спасибо, буду ждать обновления.', 'Супер, благодарю.' ];
    const botReplies = [
      'Здравствуйте! Я виртуальный помощник, сейчас уточню детали.',
      'Проверяю информацию, это может занять минуту…',
      'Секунду, собираю данные по вашему запросу.',
      'Уточняю статусы доставки — сообщу как только узнаю.'
    ];
    const opReplies = [
      'Добрый день! Сейчас посмотрю информацию по вашему заказу.',
      'Принял запрос, проверяю у логистики.',
      'Перепроверяю статусы в системе, минутку.',
      'Занёс запрос в очередь, скоро вернусь с ответом.'
    ];

    const now = Date.now();
    let inlineImageCount = 0;
    let fileCount = 0;
    for(const dlg of MOCK_DIALOGS){
      const seed = dlg.id * 13;
      const pick = (arr, sOff=0) => arr[(seed + sOff) % arr.length];
      const t = (mins) => new Date(now - mins*60000).toISOString();
      const agentAuthor = dlg.origin === 'bot' ? 'bot' : 'operator';
      const batch = [
        { id:`m${dlg.id}a`, dialogId:dlg.id, author:'client', text:pick(intro), createdAt:t(120+dlg.id), status:'sent' },
        // Agent message demonstrating TWO attachment types (fixed for the first few dialogs)
        { id:`m${dlg.id}b`, dialogId:dlg.id, author:agentAuthor, text:pick(agentAuthor==='bot'?botReplies:opReplies,1), createdAt:t(118+dlg.id), status:'sent', attachments: (dlg.id <= 3) ? [
          { id:`f${dlg.id}img1`, name:`preview-${dlg.id}.png`, size:'120 KB', contentType:'image/png', url:'https://picsum.photos/seed/inline'+dlg.id+'/300/180', displayHint:'inline-image' },
          { id:`f${dlg.id}file1`, name:`report-${dlg.id}.pdf`, size:'256 KB', contentType:'application/pdf', displayHint:'file' }
        ] : undefined },
        { id:`m${dlg.id}c`, dialogId:dlg.id, author:'client', text:pick(follow,2), createdAt:t(90+dlg.id), status:'sent' },
        { id:`m${dlg.id}d`, dialogId:dlg.id, author:agentAuthor, text:'Передаю дальше, уточняю детали…', createdAt:t(70+dlg.id), status:'sent' },
        { id:`m${dlg.id}e`, dialogId:dlg.id, author:'client', text:pick(thanks,3), createdAt:t(10+dlg.id), status:'sent' }
      ];
      // Extra message with only an inline-image for every fifth dialog
      if(dlg.id % 5 === 0){
        batch.splice(3,0,{ id:`m${dlg.id}imgOnly`, dialogId:dlg.id, author:agentAuthor, text:'Вот изображение по вашему вопросу.', createdAt:t(80+dlg.id), status:'sent', attachments:[{ id:`f${dlg.id}imgOnly`, name:`photo-${dlg.id}.jpg`, size:'200 KB', contentType:'image/jpeg', url:'https://picsum.photos/seed/photo'+dlg.id+'/240/160', displayHint:'inline-image' }] });
      }
      // Extra message with only a file attachment for every third dialog (if no file was in the previous insert)
      if(dlg.id % 3 === 0){
        batch.splice(4,0,{ id:`m${dlg.id}fileOnly`, dialogId:dlg.id, author:agentAuthor, text:'Прикрепляю файл с деталями.', createdAt:t(75+dlg.id), status:'sent', attachments:[{ id:`f${dlg.id}fileOnly`, name:`details-${dlg.id}.xlsx`, size:'512 KB', contentType:'application/vnd.ms-excel', displayHint:'file' }] });
      }
      // Count attachment statistics
      for(const m of batch){
        if(Array.isArray(m.attachments)){
          for(const a of m.attachments){
            const v = a.displayHint || (a.contentType && a.contentType.startsWith('image/')) ? 'inline-image' : 'file';
            // Use our own classification for accuracy
            const variant = (a.displayHint) ? a.displayHint : (a.contentType && a.contentType.startsWith('image/') ? 'inline-image':'file');
            if(variant === 'inline-image') inlineImageCount++; else fileCount++;
          }
        }
      }
      MessageStore.ingestBatch(dlg.id, batch, { position:'append' });
    }
    console.log('[seedDemoMessages] Attachments summary:', { inlineImage: inlineImageCount, file: fileCount });
  }

  // Archive: message seed (lazy). We use more "historical" timestamps.
  function seedArchiveMessages(){
    if(archiveSeeded) return;
    archiveSeeded = true;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const sampleClient = [
      'Здравствуйте, вопрос был решён, спасибо.',
      'Подтверждаю закрытие обращения.',
      'Информация получила подтверждение, можно архивировать.',
      'Ошибок больше не наблюдаю — тикет можно завершить.',
      'Всё работает стабильно, благодарю.'
    ];
    const sampleAgent = [
      'Рады были помочь! Обращайтесь снова при необходимости.',
      'Закрываю обращение. Хорошего дня!',
      'Отлично, тогда архивируем тикет.',
      'Спасибо за подтверждение. Завершаю диалог.',
      'Всегда рады помочь!'
    ];
    for(const dlg of ARCHIVE_DIALOGS){
      const base = now - (dlg.id - 1000) * day; // shift back by days
      const msgs = [
        { id: `a${dlg.id}m1`, dialogId: dlg.id, author: 'client', text: sampleClient[(dlg.id)%sampleClient.length], createdAt: new Date(base - 6*3600*1000).toISOString(), status:'sent' },
        { id: `a${dlg.id}m2`, dialogId: dlg.id, author: dlg.origin === 'bot' ? 'bot':'operator', text: sampleAgent[(dlg.id)%sampleAgent.length], createdAt: new Date(base - 5.5*3600*1000).toISOString(), status:'sent', attachments: (dlg.id % 2 === 0) ? [ { id:`a${dlg.id}f1`, name:`summary-${dlg.id}.pdf`, size:'180 KB', contentType:'application/pdf', displayHint:'file' } ] : undefined },
        { id: `a${dlg.id}m3`, dialogId: dlg.id, author: 'client', text: 'Подтверждаю закрытие и отсутствие проблем.', createdAt: new Date(base - 5*3600*1000).toISOString(), status:'sent' },
        { id: `a${dlg.id}m4`, dialogId: dlg.id, author: dlg.origin === 'bot' ? 'bot':'operator', text: 'Диалог переведён в архив.', createdAt: new Date(base - 4.5*3600*1000).toISOString(), status:'sent', attachments: (dlg.id % 3 === 0) ? [ { id:`a${dlg.id}img`, name:`final-${dlg.id}.png`, size:'90 KB', contentType:'image/png', url:`https://picsum.photos/seed/arch${dlg.id}/260/160`, displayHint:'inline-image' } ] : undefined }
      ];
      MessageStore.ingestBatch(dlg.id, msgs, { position:'append' });
    }
    console.log('[seedArchiveMessages] seeded for', ARCHIVE_DIALOGS.length, 'dialogs');
  }

  /* ====== Templates Store ======
     Reply template store with CRUD support.
  */
  const TemplatesStore = (() => {
    const MOCK_TEMPLATES = [
      {
        id: 1,
        name: 'Приветствие',
        text: 'Здравствуйте! Я оператор технической поддержки. Готов помочь вам решить возникшую проблему.'
      },
      {
        id: 2,
        name: 'Перезапуск приложения',
        text: 'Попробуйте полностью закрыть приложение и запустить его заново. Это поможет решить большинство проблем.'
      },
      {
        id: 3,
        name: 'Проверка интернета',
        text: 'Пожалуйста, проверьте стабильность интернет-соединения и повторите попытку.'
      },
      {
        id: 4,
        name: 'Обновление приложения',
        text: 'Рекомендую обновить приложение до последней версии. Обновления содержат исправления известных ошибок.'
      },
      {
        id: 5,
        name: 'Завершение диалога',
        text: 'Если ваша проблема решена, диалог можно завершить. Спасибо за обращение! Хорошего дня!'
      }
    ];

    let templates = [...MOCK_TEMPLATES];
    let nextId = 6;
    const listeners = new Set();

    function notifyListeners() {
      listeners.forEach(fn => {
        try { fn(); } catch (e) { console.error('[TemplatesStore] listener error:', e); }
      });
    }

    return {
      getAll() { return [...templates]; },
      
      getById(id) { return templates.find(t => t.id === id); },
      
      create(name, text) {
        const template = { id: nextId++, name: name.trim(), text: text.trim() };
        templates.push(template);
        notifyListeners();
        return template;
      },
      
      update(id, name, text) {
        const template = templates.find(t => t.id === id);
        if (template) {
          template.name = name.trim();
          template.text = text.trim();
          notifyListeners();
          return template;
        }
        return null;
      },
      
      delete(id) {
        const index = templates.findIndex(t => t.id === id);
        if (index !== -1) {
          const deleted = templates.splice(index, 1)[0];
          notifyListeners();
          return deleted;
        }
        return null;
      },
      
      subscribe(fn) { listeners.add(fn); },
      unsubscribe(fn) { listeners.delete(fn); }
    };
  })();

  /* ====== Templates Modal ======
     Modal window for managing reply templates.
  */
  const TemplatesModal = (() => {
    let modal, templatesTab, createTab, templatesPanel, createPanel, templatesList, templatesCount, templatesEmpty;
    let templateForm, templateName, templateText, templateCancel, templateSave;
    let currentEditingId = null;

    function ensureElements() {
      if (modal) return;
      
      modal = document.getElementById('templatesModal');
      templatesTab = document.getElementById('templatesTab');
      createTab = document.getElementById('createTab');
      templatesPanel = document.getElementById('templatesPanel');
      createPanel = document.getElementById('createPanel');
      templatesList = document.getElementById('templatesList');
      templatesCount = document.getElementById('templatesCount');
      templatesEmpty = document.getElementById('templatesEmpty');
      
      templateForm = document.getElementById('templateForm');
      templateName = document.getElementById('templateName');
      templateText = document.getElementById('templateText');
      templateCancel = document.getElementById('templateCancel');
      templateSave = document.getElementById('templateSave');

  // Initialize the disabled state of the save button
  updateSaveButtonState();

      setupEventListeners();
      TemplatesStore.subscribe(renderTemplatesList);
      renderTemplatesList();
    }

    function setupEventListeners() {
      // Close the modal
      const closeBtn = document.getElementById('templatesModalClose');
      closeBtn.addEventListener('click', hide);
      
      // Close on ESC and overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hide();
      });
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
          hide();
        }
      });

      // Switching tabs
      templatesTab.addEventListener('click', () => switchTab('templates'));
      createTab.addEventListener('click', () => switchTab('create'));

      // Template create/edit form
      templateForm.addEventListener('submit', handleFormSubmit);
      templateCancel.addEventListener('click', () => switchTab('templates'));
  // Track input in fields to manage the disabled state
  templateName.addEventListener('input', updateSaveButtonState);
  templateText.addEventListener('input', updateSaveButtonState);
      
      // Event delegation for template action buttons
      templatesList.addEventListener('click', handleTemplateAction);
      // Click on the template item itself: insert text and close the modal
      templatesList.addEventListener('click', (e) => {
        const item = e.target.closest('.template-item');
        if (!item) return;
        // If the click was on an action button, hand processing to handleTemplateAction
        if (e.target.closest('[data-action]')) return;
        const id = parseInt(item.getAttribute('data-template-id'));
        const template = TemplatesStore.getById(id);
        if (!template) return;
        const input = document.getElementById('chatInput');
        if (input) {
          // Insert text (replace or add a line break?) — we append with a separator
          const append = template.text;
          const hasValue = input.value.trim().length > 0;
          input.value = hasValue ? input.value + (input.value.endsWith('\n') ? '' : '\n') + append : append;
          input.focus();
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        hide();
      });
    }

    function show() {
      ensureElements();
      setAriaHidden(modal, false);
      modal.focus();
      switchTab('templates');
    }

    function hide() {
      if (!modal) return;
      setAriaHidden(modal, true);
      resetForm();
    }

    function switchTab(tabName) {
      if (tabName === 'templates') {
        templatesTab.setAttribute('aria-selected', 'true');
        templatesTab.tabIndex = 0;
        createTab.setAttribute('aria-selected', 'false');
        createTab.tabIndex = -1;
        
        setAriaHidden(templatesPanel, false);
        setAriaHidden(createPanel, true);
        
        resetForm();
      } else if (tabName === 'create') {
        templatesTab.setAttribute('aria-selected', 'false');
        templatesTab.tabIndex = -1;
        createTab.setAttribute('aria-selected', 'true');
        createTab.tabIndex = 0;
        
        setAriaHidden(templatesPanel, true);
        setAriaHidden(createPanel, false);
        
        templateName.focus();
        updateSaveButtonState();
      }
    }

    function renderTemplatesList() {
      if (!templatesList) return;
      
      const templates = TemplatesStore.getAll();
      templatesCount.textContent = templates.length;
      
      if (templates.length === 0) {
        templatesList.innerHTML = '';
        templatesEmpty.hidden = false;
        return;
      }
      
      templatesEmpty.hidden = true;
      templatesList.innerHTML = templates.map(template => `
        <div class="template-item" data-template-id="${template.id}">
          <div class="template-item__content">
            <h4 class="template-item__title">${escapeHtml(template.name)}</h4>
            <p class="template-item__text">${escapeHtml(template.text)}</p>
          </div>
          <div class="template-item__actions">
            <button type="button" class="template-action-btn template-action-btn--copy" 
                    data-action="copy" title="Копировать текст" aria-label="Копировать текст шаблона">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
            <button type="button" class="template-action-btn template-action-btn--edit" 
                    data-action="edit" title="Редактировать" aria-label="Редактировать шаблон">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button type="button" class="template-action-btn template-action-btn--delete" 
                    data-action="delete" title="Удалить" aria-label="Удалить шаблон">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');
    }

    function handleTemplateAction(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      
      const action = btn.dataset.action;
      const templateItem = btn.closest('[data-template-id]');
      const templateId = parseInt(templateItem.dataset.templateId);
      const template = TemplatesStore.getById(templateId);
      
      if (!template) return;
      
      switch (action) {
        case 'copy':
          copyTemplateText(template.text);
          break;
        case 'edit':
          editTemplate(template);
          break;
        case 'delete':
          deleteTemplate(template);
          break;
      }
    }

    function copyTemplateText(text) {
      // If there is an active message input, insert the text there
      const activeTextarea = document.querySelector('#chatInput');
      if (activeTextarea) {
        const currentValue = activeTextarea.value;
        const newValue = currentValue ? currentValue + '\n\n' + text : text;
        activeTextarea.value = newValue;
        activeTextarea.focus();
        // Simulate an input event to update the UI
        activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        hide();
      } else {
        // Copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
          console.log('[TemplatesModal] Text copied to clipboard');
        }).catch(err => {
          console.error('[TemplatesModal] Failed to copy text:', err);
        });
      }
    }

    function editTemplate(template) {
      currentEditingId = template.id;
      templateName.value = template.name;
      templateText.value = template.text;
      const spanLabel = templateSave.querySelector('span');
      if (spanLabel) spanLabel.textContent = 'Сохранить изменения';
      templateSave.disabled = false; // Once editing, the button is active
      switchTab('create');
    }

    function deleteTemplate(template) {
      // Instant deletion without native confirm, as required
      TemplatesStore.delete(template.id);
      if (typeof window.showServiceNotification === 'function') {
        window.showServiceNotification('Шаблон удалён', 'Шаблон успешно удалён');
      }
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      
      const name = templateName.value.trim();
      const text = templateText.value.trim();
      
      if (!name || !text) {
        alert('Заполните все поля');
        return;
      }
      
      if (currentEditingId) {
        TemplatesStore.update(currentEditingId, name, text);
      } else {
        TemplatesStore.create(name, text);
      }
      
      resetForm();
      switchTab('templates');
    }

    function resetForm() {
      if (!templateForm) return;
      
      currentEditingId = null;
      templateName.value = '';
      templateText.value = '';
      const spanLabel = templateSave.querySelector('span');
      if (spanLabel) spanLabel.textContent = 'Создать шаблон';
      updateSaveButtonState();
    }

    function updateSaveButtonState() {
      if (!templateSave) return;
      const nameFilled = templateName && templateName.value.trim().length > 0;
      const textFilled = templateText && templateText.value.trim().length > 0;
      templateSave.disabled = !(nameFilled && textFilled);
    }

    return { show, hide };
  })();

  /* ====== Utilities ======
     Small helper functions without side effects.
  */
  function paginate(items, page, size) {
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  }

  function setAriaExpanded(el, isExpanded) {
    if (!el) return;
    el.setAttribute('aria-expanded', String(isExpanded));
  }

  function setAriaHidden(el, isHidden) {
    if (!el) return;
    el.setAttribute('aria-hidden', String(isHidden));
  }

  /* ====== Image Preview Modal ======
     Lazy initialization: create one instance and reuse it.
     Features:
       - Close on ESC, overlay click, close button.
       - Trap focus inside the modal (two interactive elements).
       - The download button uses the download attribute and a direct link.
  */
  const ImagePreviewModal = (() => {
    let overlay = null;
    let btnClose = null;
    let btnDownload = null;
    let imgEl = null;
    let fileNameEl = null;
    let previouslyFocused = null;

    function ensureDom(){
      if(overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'image-modal__overlay';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.innerHTML = `\n        <div class="image-modal">\n          <button type="button" class="image-modal__close" aria-label="Закрыть предпросмотр">\n            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>\n          </button>\n          <div class="image-modal__img-wrap">\n            <img class="image-modal__img" alt="" />\n          </div>\n          <div class="image-modal__bottom">\n            <div class="image-modal__filename" id="imageModalFilename"></div>\n            <a class="image-modal__download" id="imageModalDownload" target="_blank" rel="noopener" download>\n              <img class="image-modal__download-icon" src="images/download.svg" alt="" aria-hidden="true" />\n              <span>Скачать</span>\n            </a>\n          </div>\n        </div>`;
      btnClose = overlay.querySelector('.image-modal__close');
      btnDownload = overlay.querySelector('#imageModalDownload');
      imgEl = overlay.querySelector('.image-modal__img');
      fileNameEl = overlay.querySelector('#imageModalFilename');

      overlay.addEventListener('click', (e)=>{ if(e.target === overlay) close(); });
      btnClose.addEventListener('click', close);
      document.addEventListener('keydown', onKeydown);
    }

    function onKeydown(e){
      if(!overlay || !overlay.isConnected) return;
      if(e.key === 'Escape'){
        e.preventDefault();
        close();
      } else if(e.key === 'Tab'){
        const focusables = [btnClose, btnDownload];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }

    function open({ url, name }){
      ensureDom();
      previouslyFocused = document.activeElement;
      imgEl.src = url;
      imgEl.alt = name || '';
      fileNameEl.textContent = name || '';
      btnDownload.setAttribute('href', url);
      if(name) btnDownload.setAttribute('download', name); else btnDownload.removeAttribute('download');
      document.body.appendChild(overlay);
      requestAnimationFrame(()=>btnClose.focus());
    }

    function close(){
      if(!overlay) return;
      if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if(previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    }

    return { open, close };
  })();

  /* ====== Render ======
     Re-renders the current page list. Event subscriptions are below.
  */
  /**
   * Renders the current page of the dialog list based on state.currentPage/state.pageSize.
   * Updates pagination controls and the counter.
   * Side effects: modifies the DOM inside the list and controls.
   */
  function currentDialogs(){ return state.viewMode === 'active' ? MOCK_DIALOGS : ARCHIVE_DIALOGS; }

  function renderList() {
    const source = currentDialogs();
    const totalPages = Math.max(1, Math.ceil(source.length / state.pageSize));
    state.currentPage = Math.min(state.currentPage, totalPages);

    dom.list.innerHTML = '';

    const pageItems = paginate(source, state.currentPage, state.pageSize);
    const fragment = document.createDocumentFragment();

    for (const item of pageItems) {
      const li = document.createElement('li');
      li.className = 'dialog';
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');
      li.dataset.id = String(item.id);
      li.setAttribute('aria-selected', String(state.selectedId === item.id));

      const badge = buildOriginBadge(item.origin);

      li.innerHTML = `
        <div class="dialog__body">
          <div class="dialog__top">
            <span class="dialog__name">${item.name}</span>
            <span class="${badge.className}" aria-label="${badge.label}">${badge.iconSvg}${badge.label}</span>
          </div>
          <div class="dialog__row">
            <div class="dialog__time">${item.time}</div>
            <span class="dialog__timer" data-visible="false" hidden aria-hidden="true">
              <svg class="dialog__timer-icon" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor"><path d="M128,36a92,92,0,1,0,92,92A92.10416,92.10416,0,0,0,128,36Zm0,176a84,84,0,1,1,84-84A84.095,84.095,0,0,1,128,212ZM170.42627,85.57324a4.00106,4.00106,0,0,1,.00049,5.65723l-39.59864,39.59814a4.00009,4.00009,0,0,1-5.65673-5.65722l39.59814-39.59815A4.00091,4.00091,0,0,1,170.42627,85.57324ZM100,8a4.0002,4.0002,0,0,1,4-4h48a4,4,0,0,1,0,8H104A4.0002,4.0002,0,0,1,100,8Z"/></svg>
              <time class="dialog__timer-value" datetime="" aria-label="">00ч</time>
            </span>
          </div>
          <div class="dialog__meta">${item.platform}</div>
        </div>
        <div class="dialog__menu">
          <button class="icon-btn text-muted" title="Меню диалога" aria-label="Меню диалога" aria-haspopup="menu" aria-controls="dialogMenu">
            <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        </div>
      `;
      fragment.appendChild(li);
    }

    dom.list.appendChild(fragment);

    dom.pageInfo.textContent = `${state.currentPage} из ${totalPages}`;
    const isFirst = state.currentPage <= 1;
    const isLast = state.currentPage >= totalPages;
    dom.btnPrev.disabled = isFirst;
    dom.btnNext.disabled = isLast;
    dom.btnPrev.classList.toggle('btn--disabled', isFirst);
    dom.btnNext.classList.toggle('btn--disabled', isLast);
    dom.totalCounter.textContent = String(source.length);
  }

  /**
   * Selects the dialog, updates the visual state of the list and the right panel.
   * If the context menu is open, rebuilds it for the current dialog.
   * @param {number|null} id
   */
  function selectDialog(id) {
    state.selectedId = id;
    for (const node of dom.list.children) {
      node.setAttribute('aria-selected', String(node.dataset.id == String(id)));
    }
    // If the context menu is already open while selection changes — update its content
    if (dom.dialogMenu && dom.dialogMenu.getAttribute('aria-hidden') === 'false') {
      if (!dialogMenuAnchorBtn) {
        const currentLi = dom.list.querySelector(`.dialog[data-id="${String(id)}"]`);
        if (currentLi) dialogMenuAnchorBtn = currentLi.querySelector('.dialog__menu .icon-btn');
      }
      renderDialogMenuForDialog(id);
      positionDialogMenu();
    }
    // Show/hide right panel
    if (dom.chatPanel && dom.workspaceEmpty) {
      if (id != null) {
        dom.chatPanel.hidden = false;
        dom.workspaceEmpty.hidden = true;
        // Find the selected dialog data
  const data = getDialogById(id);
        if (data) {
          dom.chatUser.textContent = data.name;
          // meta: platform + UID (we conventionally build the UID from id for the example)
          dom.chatMeta.textContent = `${data.platform} • UID ${String(500000 + data.id)}`;
          if (dom.chatBadge) {
            const badge = buildOriginBadge(data.origin);
            dom.chatBadge.className = badge.className;
            dom.chatBadge.innerHTML = `${badge.iconSvg}${badge.label}`;
          }
          // Update the footer for the selected dialog
          renderChatFooterForDialog(data);
          // Render messages for the selected dialog
          renderMessagesForDialog(data.id);
        }
      } else {
        dom.chatPanel.hidden = true;
        dom.workspaceEmpty.hidden = false;
        if (dom.chatFooter) dom.chatFooter.innerHTML = '';
      }
    }
  }

  /**
   * Builds the data for the dialog origin badge (bot / operator).
   * No side effects. Used when rendering the list and the right panel.
   * @param {string} origin 'bot' | 'operator'
   * @returns {{className:string,label:string,iconSvg:string,html:string,isBot:boolean}}
   */
  function buildOriginBadge(origin){
    const isBot = origin !== 'operator';
    const className = isBot ? 'badge__bot' : 'badge__person';
    const label = isBot ? 'Нейросеть' : 'Оператор';
    const iconSvg = isBot
      ? `<svg class="dialog__bot-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`
      : `<svg class="dialog__user-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    return { className, label, iconSvg, html: `${iconSvg}${label}`, isBot };
  }

  /**
   * Sets the dialog origin and returns the object (or null).
   * @param {number} id
   * @param {string} origin 'bot'|'operator'
   */
  function setDialogOrigin(id, origin){
    const dlg = getDialogById(id);
    if (!dlg) return null;
    dlg.origin = origin;
    return dlg;
  }

  /**
   * Updates the badge in the list for a specific dialog without a full page re-render.
   */
  function updateDialogListBadge(id){
    const li = dom.list && dom.list.querySelector(`li.dialog[data-id="${id}"]`);
    if(!li) return;
    const badgeNode = li.querySelector('.badge__bot, .badge__person');
    if(!badgeNode) return;
    const badge = buildOriginBadge('operator');
    badgeNode.className = badge.className;
    badgeNode.innerHTML = `${badge.iconSvg}${badge.label}`;
  }

  /**
   * Completes the bot-to-operator handoff: updates data, list, header and footer.
   * source: 'menu' | 'banner'
   */
  function performSwitchToOperator(dialogId, { source } = { source: 'banner' }){
    if (dialogId == null) return;
    const dlg = getDialogById(dialogId);
    if (!dlg || dlg.origin === 'operator') return; // already operator — do nothing

    if (source === 'menu') {
      // 1) remove the button from the menu (if still present) and close the menu BEFORE UI changes
      if (dom.dialogMenu) {
        const toOpBtn = dom.dialogMenu.querySelector('[data-action="dlgToOperator"], #dlgToOperator, [id="dlgToOperator"]');
        if (toOpBtn) toOpBtn.remove();
      }
      if (typeof setDialogMenuOpen === 'function') {
        setDialogMenuOpen(false);
      }
    }

    // 2) update data
    setDialogOrigin(dialogId, 'operator');

    // 3) update the list item (badge)
    updateDialogListBadge(dialogId);

    // 4) if this dialog is open, update the header and footer
    if (state.selectedId === dialogId) {
      const badge = buildOriginBadge('operator');
      if (dom.chatBadge) {
        dom.chatBadge.className = badge.className;
        dom.chatBadge.innerHTML = `${badge.iconSvg}${badge.label}`;
      }
      // Re-render the footer into composer mode
      const dlgData = getDialogById(dialogId);
      renderChatFooterForDialog(dlgData);
    }

    console.log('[switch] dialog', dialogId, 'переведён на оператора (source:', source, ')');
  }

  /* ====== Chat footer (dynamic) ====== */
  function createAiBanner(dialogId){
    const banner = document.createElement('div');
    banner.className = 'chat__ai-banner';
    banner.setAttribute('role','button');
    banner.setAttribute('tabindex','0');
    banner.setAttribute('aria-pressed','false');
    banner.dataset.dialogId = String(dialogId);
    banner.setAttribute('aria-label','Ответы даёт нейросеть. Нажмите чтобы перевести на ручное управление');
    banner.innerHTML = `<h3 class="chat__ai-banner-title">Ответы даёт нейросеть</h3><p class="chat__ai-banner-subtitle">Нажмите «Перевести на ручное управление», чтобы отвечать вручную</p>`;
    function activate(){
      performSwitchToOperator(dialogId, { source: 'banner' });
      banner.setAttribute('aria-pressed','true');
    }
    banner.addEventListener('click', activate);
    banner.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); activate(); }});
    return banner;
  }

  function createOperatorComposer(){
    const wrapper = document.createElement('div');
    wrapper.className = 'chat__composer-wrapper';
    wrapper.innerHTML = `
      <input type="file" id="fileInput" multiple style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
      <div class="chat__composer" role="group" aria-label="Operator message sending">
        <div class="chat__composer-main">
          <textarea class="chat__input" id="chatInput" placeholder="Type a message... (Enter - send, Ctrl+K - templates)" aria-label="Message input field" rows="1"></textarea>
          <div class="chat__composer-actions">
            <button type="button" class="chat__icon-btn" id="btnAttach" title="Attach file" aria-label="Attach file">
              <img src="images/attach.svg" alt="" aria-hidden="true" width="20" height="20" />
            </button>
            <button type="button" class="chat__icon-btn" id="btnTemplates" title="Templates (Ctrl+K)" aria-label="Open templates (Ctrl+K)">
              <img src="images/templates.svg" alt="" aria-hidden="true" width="20" height="20" />
            </button>
          </div>
        </div>
      </div>
      <div class="chat__pending" id="pendingAttachments" aria-live="polite" aria-label="Message attachments"></div>
      <div class="chat__composer-bottom">
        <div class="chat__composer-hint" id="chatShortcuts" aria-hidden="false">
          <span class="chat__shortcut-key"><kbd>Enter</kbd> — send</span>
          <span class="chat__shortcut-key"><kbd>Ctrl+K</kbd> — templates</span>
        </div>
        <button type="button" class="chat__send-btn" id="btnSend" aria-label="Send message">
          <img src="images/send.svg" class="chat__send-btn-icon" alt="" aria-hidden="true" />
          <span>Send</span>
        </button>
      </div>
    `;

    // Logic: textarea auto-height + send button state management
    const textarea = wrapper.querySelector('#chatInput');
    const btnSend = wrapper.querySelector('#btnSend');
    const btnAttach = wrapper.querySelector('#btnAttach');
    const btnTemplates = wrapper.querySelector('#btnTemplates');
    const fileInput = wrapper.querySelector('#fileInput');
    const pendingRoot = wrapper.querySelector('#pendingAttachments');

    // Local state of composer attachments (not added to MessageStore until sent)
    const pending = []; // { id, file, name, sizeBytes, sizeLabel, contentType, url, status, progress, displayHint }
    let pendingCounter = 1;

    function formatBytes(bytes){
      if(bytes == null) return '';
      const thresh = 1024;
      if(bytes < thresh) return bytes + ' B';
      const units = ['KB','MB','GB'];
      let u = -1; let value = bytes;
      do { value /= thresh; ++u; } while(value >= thresh && u < units.length-1);
      return value.toFixed(value < 10 ? 1 : 0) + ' ' + units[u];
    }

    function isLikelyImage(file){
      if(!file) return false;
      if(file.type && file.type.startsWith('image/')) return true;
      return /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name);
    }

    function createPendingModel(file){
      const id = 'p'+(pendingCounter++);
      const url = URL.createObjectURL(file);
      const sizeBytes = file.size;
      return {
        id,
        file,
        name: file.name,
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes),
        contentType: file.type || '',
        url,
        status: 'uploading', // uploading|ready|error
        progress: 0,
        displayHint: undefined,
      };
    }

    function renderPending(){
      if(!pendingRoot) return;
      if(!pending.length){ pendingRoot.innerHTML=''; return; }
      const parts = [];
      for(const att of pending){
        const isImg = isLikelyImage(att.file);
        const variantClass = isImg? 'pending-attach--img':'pending-attach--file';
        const progBar = att.status === 'uploading' ? `<div class="pending-attach__progress"><div class="pending-attach__progress-bar" style="width:${att.progress}%"></div></div>` : '';
        const statusLabel = att.status === 'error' ? '<span class="pending-attach__status pending-attach__status--error">Ошибка</span>' : att.status === 'ready' ? '' : '<span class="pending-attach__status pending-attach__status--spin" aria-label="Загрузка"></span>';
        const removeBtn = `<button type="button" class="pending-attach__remove" data-remove-id="${att.id}" title="Удалить" aria-label="Удалить вложение"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>`;
        let body = '';
        if(isImg){
          body = `<div class="pending-attach__thumb"><img src="${att.url}" alt="" /></div>`;
        } else {
          body = `<div class="pending-attach__icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg></div>`;
        }
        parts.push(`<div class="pending-attach ${variantClass} pending-attach--${att.status}" data-pending-id="${att.id}">
          ${body}
          <div class="pending-attach__info">
            <div class="pending-attach__name" title="${att.name}">${att.name}</div>
            <div class="pending-attach__meta">${att.sizeLabel}</div>
            ${progBar}
          </div>
          ${statusLabel}
          ${removeBtn}
        </div>`);
      }
      pendingRoot.innerHTML = parts.join('');
    }

    function updateSendBtnState(){
      const hasText = textarea.value.trim().length > 0;
      const hasReadyAtt = pending.some(a=>a.status==='ready');
      const uploading = pending.some(a=>a.status==='uploading');
      // Allow sending if there is text or at least one ready attachment
      const enabled = hasText || hasReadyAtt;
      btnSend.disabled = !enabled;
      btnSend.classList.toggle('is-disabled', !enabled);
      btnSend.dataset.uploading = uploading ? 'true':'false';
    }

    function simulateUpload(model){
      // Simulation: speed ~1000-2000ms
      const totalMs = 1000 + Math.random()*1500;
      const started = performance.now();
      function step(){
        if(model.status !== 'uploading') return; // may have been removed
        const elapsed = performance.now() - started;
        model.progress = Math.min(100, Math.round(elapsed / totalMs * 100));
        renderPending();
        updateSendBtnState();
        if(elapsed >= totalMs){
          // 5% chance of error for demonstration
          if(Math.random() < 0.05){
            model.status = 'error';
            model.progress = 0;
          } else {
            model.status = 'ready';
            model.progress = 100;
            // Determine displayHint
            if(isLikelyImage(model.file) && model.sizeBytes <= INLINE_IMAGE_MAX_BYTES){
              model.displayHint = 'inline-image';
            } else {
              model.displayHint = 'file';
            }
          }
          renderPending();
          updateSendBtnState();
        } else {
          requestAnimationFrame(step);
        }
      }
      requestAnimationFrame(step);
    }

    function addFiles(list){
      for(const file of list){
        const model = createPendingModel(file);
        pending.push(model);
        simulateUpload(model);
      }
      renderPending();
      updateSendBtnState();
    }

    function removePending(id){
      const idx = pending.findIndex(a=>a.id===id);
      if(idx>=0){
        const [m] = pending.splice(idx,1);
        try{ if(m.url) URL.revokeObjectURL(m.url); }catch(e){}
        renderPending();
        updateSendBtnState();
      }
    }

    pendingRoot.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-remove-id]');
      if(btn){
        removePending(btn.getAttribute('data-remove-id'));
      }
    });

    function autoResize(){
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    }
    textarea.addEventListener('input', () => {
      autoResize();
      updateSendBtnState();
    });
    autoResize();
    updateSendBtnState();

    btnAttach.addEventListener('click', () => { fileInput.click(); });
    fileInput.addEventListener('change', (e)=>{
      const files = Array.from(e.target.files || []);
      if(files.length){ addFiles(files); }
      fileInput.value=''; // so the same file name can be selected again
    });
    function triggerTemplates(){ TemplatesModal.show(); }
    btnTemplates.addEventListener('click', triggerTemplates);
    btnSend.addEventListener('click', sendMessagePlaceholder);

    function sendMessagePlaceholder(){
      const value = textarea.value.trim();
      const readyAtts = pending.filter(a=>a.status==='ready');
      if(!value && !readyAtts.length){
        console.log('[composer] empty message without ready attachments');
        return;
      }
      // Adding an operator message to the current dialog
      if(state.selectedId != null){
        const attachments = readyAtts.map(m => ({
          id: 'upl:' + m.id,
            name: m.name,
            size: m.sizeLabel,
            contentType: m.contentType,
            url: m.url,
            downloadUrl: m.url,
            displayHint: m.displayHint
        }));
        addMessage(state.selectedId, { author:'operator', text:value || (attachments.length? '': ''), attachments, createdAt: new Date() });
        // Clear pending. IMPORTANT: do not revoke the objectURLs of attachments we just added to the chat,
        // otherwise the blob becomes unavailable for preview (the modal would open empty).
        const usedUrls = new Set(readyAtts.map(m=>m.url));
        for(const m of pending){
          if(!usedUrls.has(m.url)){
            try{ if(m.url) URL.revokeObjectURL(m.url); }catch(e){}
          }
        }
        pending.length = 0;
        renderPending();
      } else {
        console.warn('[composer] no dialog selected');
      }
      textarea.value='';
      autoResize();
      updateSendBtnState();
    }

    // Hotkeys inside textarea
    textarea.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        sendMessagePlaceholder();
      } else if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        triggerTemplates();
      }
    });

    // Global Ctrl+K when focus is in textarea (logic duplicated for reliability)
    wrapper.addEventListener('keydown', (e)=>{
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        if(document.activeElement === textarea){
          e.preventDefault();
          triggerTemplates();
        }
      }
    });

    return wrapper;
  }

  function renderChatFooterForDialog(dialogData){
    if (!dom.chatFooter) return;
    dom.chatFooter.innerHTML = '';
    if (!dialogData) return;
    const isBot = dialogData.origin !== 'operator';
    const el = isBot ? createAiBanner(dialogData.id) : createOperatorComposer();
    dom.chatFooter.appendChild(el);
  }

  // Delegated click on inline images inside the chat body
  if(dom.chatBody){
    dom.chatBody.addEventListener('click', (e)=>{
      // If the click is on a download button inside an inline image — allow the download and do not open the modal
      const dlBtn = e.target.closest('.msg-image__download');
      if(dlBtn) return; // the browser will perform the standard download
      const fig = e.target.closest && e.target.closest('.msg-image');
      if(!fig || !dom.chatBody.contains(fig)) return;
      const url = fig.getAttribute('data-url');
      const name = fig.getAttribute('data-name') || 'image';
      if(url){
        ImagePreviewModal.open({ url, name });
      }
    });
  }

  /* ====== Events: list (delegation) ====== */
  function onListClick(event) {
    const li = event.target.closest('li.dialog');
    if (!li || !dom.list.contains(li)) return;
    const id = Number(li.dataset.id);
    selectDialog(id);
  }

  function onListKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const li = event.target.closest('li.dialog');
    if (!li || !dom.list.contains(li)) return;
    event.preventDefault();
    const id = Number(li.dataset.id);
    selectDialog(id);
  }

  /* ====== Pagination ====== */
  function goPrev() {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderList();
    }
  }
  function goNext() {
    const totalPages = Math.max(1, Math.ceil(currentDialogs().length / state.pageSize));
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderList();
    }
  }

  /* ====== Custom select ======
     The native select remains but is visually hidden. The visible part is controlled by .open.
  */
  function setDropdownOpen(isOpen) {
    if (!dom.selectRoot) return;
    dom.selectRoot.classList.toggle('open', isOpen);
    setAriaExpanded(dom.selectRoot, isOpen);
  }

  function onNativeChange(e) {
    const value = e.target.value;
    dom.projectDisplay.textContent = value;
    const options = Array.from(dom.dropdown.querySelectorAll('.select__option'));
    for (const opt of options) {
      const isSelected = opt.dataset.value === value;
      opt.classList.toggle('select__option--selected', isSelected);
      opt.setAttribute('aria-selected', String(isSelected));
    }
    setDropdownOpen(false);
  }

  function onOptionActivate(optEl) {
    const value = optEl.dataset.value;
    dom.projectSelect.value = value;
    dom.projectDisplay.textContent = value;
    const options = Array.from(dom.dropdown.querySelectorAll('.select__option'));
    for (const o of options) o.classList.remove('select__option--selected');
    optEl.classList.add('select__option--selected');
    optEl.setAttribute('aria-selected', 'true');
    setDropdownOpen(false);
    dom.projectSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ====== Popup menu: project ======
     The menu opens at the project button. Closes on outside click/ESC.
  */
  function setProjectMenuOpen(isOpen){
    if (!dom.projectMenu || !dom.projectMenuBtn) return;
    setAriaHidden(dom.projectMenu, !isOpen);
    setAriaExpanded(dom.projectMenuBtn, isOpen);
    if (isOpen) positionProjectMenu();
  }

  function positionProjectMenu(){
    if (!dom.projectMenu || !dom.projectMenuBtn) return;
    const container = dom.projectMenuBtn.closest('.sidebar__project');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = dom.projectMenuBtn.getBoundingClientRect();

    // Temporarily show to measure width if hidden
    const wasHidden = dom.projectMenu.getAttribute('aria-hidden') !== 'false';
    if (wasHidden) {
      dom.projectMenu.style.visibility = 'hidden';
      dom.projectMenu.setAttribute('aria-hidden', 'false');
    }
    const menuWidth = dom.projectMenu.offsetWidth;
    // Align the right edge of the menu with the right edge of the button
    const top = btnRect.bottom - containerRect.top + 6; // 6px offset
    const left = btnRect.right - containerRect.left - menuWidth;
    dom.projectMenu.style.top = top + 'px';
    dom.projectMenu.style.left = left + 'px';
    dom.projectMenu.style.right = 'auto';
    if (wasHidden) {
      dom.projectMenu.setAttribute('aria-hidden', 'true');
      dom.projectMenu.style.visibility = '';
    }
  }

  /* ====== Dialog context menu ======
     A single menu is created on the document and reused for all dialogs.
  */
  const ACTION_IDS = Object.freeze({
    CLOSE_PLUS: 'dlgClosePlus',
    CLOSE_MINUS: 'dlgCloseMinus',
    REQ_PLUS: 'dlgReqPlus',
    REQ_MINUS: 'dlgReqMinus',
    TO_OPERATOR: 'dlgToOperator',
    UNSUBSCRIBE: 'dlgUnsubscribe',
  });

  const MENU_ITEMS = Object.freeze([
    Object.freeze({ icon: 'images/task.svg', label: 'Закрыть тикет (+)', id: ACTION_IDS.CLOSE_PLUS }),
    Object.freeze({ icon: 'images/close.svg', label: 'Закрыть тикет (-)', id: ACTION_IDS.CLOSE_MINUS }),
    Object.freeze({ icon: 'images/time.svg', label: 'Запрос закрытия (+)', id: ACTION_IDS.REQ_PLUS }),
    Object.freeze({ icon: 'images/warning.svg', label: 'Запрос закрытия (-)', id: ACTION_IDS.REQ_MINUS }),
    Object.freeze({ icon: 'images/person.svg', label: 'Перевести на оператора', id: ACTION_IDS.TO_OPERATOR }),
    Object.freeze({ icon: 'images/person-dash.svg', label: 'Отменить подписку', id: ACTION_IDS.UNSUBSCRIBE }),
  ]);

  /* ====== Dialog menu action handlers ======
     Each function receives { dialogId, actionId, source }.
     Content is TODO for now — integration will go here (fetch / emit / state update).
     Architectural approach: a single ACTION_HANDLERS dispatcher keyed by button id.
  */
  function handleDlgClosePlus(ctx){
    // TODO: Implement "Close ticket (+)" logic (positive ticket closure)
    console.log('[dialog action] ClosePlus', ctx);
  }
  function handleDlgCloseMinus(ctx){
    // TODO: Implement "Close ticket (-)" logic (negative ticket closure)
    console.log('[dialog action] CloseMinus', ctx);
  }
  function handleDlgReqPlus(ctx){
    // TODO: Implement "Close request (+)" logic (initiate a positive request)
    console.log('[dialog action] ReqClosePlus', ctx);
  }
  function handleDlgReqMinus(ctx){
    // TODO: Implement "Close request (-)" logic (initiate a negative request)
    console.log('[dialog action] ReqCloseMinus', ctx);
  }
  function handleDlgToOperator(ctx){
    // TODO: Implement handing the dialog over to a live operator
      console.log('[dialog action] ToOperator', ctx);
      const { dialogId } = ctx || {};
      performSwitchToOperator(dialogId, { source: 'menu' });
  }
  function handleDlgUnsubscribe(ctx){
    // TODO: Implement unsubscribing the user from mailing/notifications
    console.log('[dialog action] Unsubscribe', ctx);
    const { dialogId } = ctx || {};
    const modalApi = window.UnsubscribeModal; // safe: object property, will not throw ReferenceError
    if (dialogId != null && modalApi && typeof modalApi.open === 'function') {
      modalApi.open(dialogId, { trigger: 'menu' });
    } else {
      // If the modal is not yet initialized (script below has not run yet)
      // Try deferring the open until the next frame.
      if (dialogId != null) {
        requestAnimationFrame(() => {
          const lateApi = window.UnsubscribeModal;
            if (lateApi && typeof lateApi.open === 'function') {
              lateApi.open(dialogId, { trigger: 'menu-deferred' });
            }
        });
      }
    }
  }

  const ACTION_HANDLERS = {
    [ACTION_IDS.CLOSE_PLUS]: handleDlgClosePlus,
    [ACTION_IDS.CLOSE_MINUS]: handleDlgCloseMinus,
    [ACTION_IDS.REQ_PLUS]: handleDlgReqPlus,
    [ACTION_IDS.REQ_MINUS]: handleDlgReqMinus,
    [ACTION_IDS.TO_OPERATOR]: handleDlgToOperator,
    [ACTION_IDS.UNSUBSCRIBE]: handleDlgUnsubscribe,
  };

  // === Lazy initialization of the dialog menu container ===
  function ensureDialogMenuContainer(){
    if (dom.dialogMenu) return dom.dialogMenu;
    const el = document.createElement('div');
    el.className = 'popup-menu';
    el.id = 'dialogMenu';
    el.setAttribute('role', 'menu');
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    // Delegated clicks on menu items
    el.addEventListener('click', (ev) => {
      if (el.getAttribute('aria-hidden') === 'true') return;
      const itemBtn = ev.target.closest('.popup-menu__item');
      if (!itemBtn) return;
      ev.stopPropagation();
      const dialogId = getCurrentDialogIdByAnchor();
      const actionId = itemBtn.id;
      const handler = ACTION_HANDLERS[actionId];
      const context = { dialogId, actionId, source: 'dialogMenu' };
      if (typeof handler === 'function') {
        try { handler(context); } catch(err){ console.error('[dialog action error]', actionId, err); }
      } else {
        console.warn('[dialog action] Нет обработчика для', actionId, context);
      }
      setDialogMenuOpen(false);
      if (dialogMenuAnchorBtn) dialogMenuAnchorBtn.focus();
    });
    dom.dialogMenu = el;
    return el;
  }

  // Rebuilds menu items for a specific dialog (filtering at composition time)
  /**
   * Rebuilds the HTML of the context menu for the given dialogId.
   * Filters out the handoff-to-operator item if origin is already operator.
   * @param {number|null} dialogId
   */
  function renderDialogMenuForDialog(dialogId){
    const menuEl = ensureDialogMenuContainer();
  const data = dialogId != null ? getDialogById(dialogId) : null;
    const filtered = MENU_ITEMS.filter(item => {
      if (item.id === ACTION_IDS.TO_OPERATOR && data && data.origin === 'operator') return false;
      return true;
    });
    menuEl.innerHTML = filtered.map(item => {
  const isTransfer = item.id === ACTION_IDS.TO_OPERATOR;
      const iconHtml = isTransfer
        ? `<svg class="popup-menu__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
        : `<img class="popup-menu__icon" src="${item.icon}" alt="" aria-hidden="true" />`;
      return `<button class="popup-menu__item" role="menuitem" id="${item.id}">${iconHtml}<span class="popup-menu__label">${item.label}</span></button>`;
    }).join('');
  }

  function getCurrentDialogIdByAnchor(){
    if (!dialogMenuAnchorBtn) return null;
    const li = dialogMenuAnchorBtn.closest('li.dialog');
    return li ? Number(li.dataset.id) : null;
  }
  /**
   * Opens/closes the dialog context menu. Rebuilds content on open.
   * @param {boolean} isOpen
   */
  function setDialogMenuOpen(isOpen){
    if (isOpen){
      const dialogId = getCurrentDialogIdByAnchor() ?? state.selectedId ?? null;
      renderDialogMenuForDialog(dialogId);
      setAriaHidden(dom.dialogMenu, false);
      positionDialogMenu();
    } else if (dom.dialogMenu) {
      setAriaHidden(dom.dialogMenu, true);
    }
  }

  /**
   * Positions the context menu relative to the anchor button.
   */
  function positionDialogMenu(){
    if (!dialogMenuAnchorBtn || !dom.dialogMenu) return;
    const btnRect = dialogMenuAnchorBtn.getBoundingClientRect();
    dom.dialogMenu.style.position = 'fixed';
    const top = Math.round(btnRect.bottom + 6);
    const menuWidth = dom.dialogMenu.offsetWidth || 0;
    let left = Math.round(btnRect.right - menuWidth);
    if (left < 8) left = 8; // small offset from the edge
    dom.dialogMenu.style.top = top + 'px';
    dom.dialogMenu.style.left = left + 'px';
    dom.dialogMenu.style.right = 'auto';
  }

  /* ====== Initialization ======
     Entry point: render, subscriptions, menu preparation.
  */
  function init() {
    // Render the initial page
    renderList();
    // Default right panel state
    if (dom.chatPanel) dom.chatPanel.hidden = true;

    // Demo messages
    seedDemoMessages();

  // The dialog context menu is created lazily on first open (ensureDialogMenuContainer)

    // List: delegation
    dom.list.addEventListener('click', (event) => {
      // click on the menu button in a list item
      const menuBtn = event.target.closest('.dialog__menu .icon-btn');
      if (menuBtn) {
        event.stopPropagation();
        event.preventDefault();
        dialogMenuAnchorBtn = menuBtn;
        const isOpen = dom.dialogMenu && dom.dialogMenu.getAttribute('aria-hidden') === 'false';
        setDialogMenuOpen(!isOpen);
        return;
      }
      onListClick(event);
    });
    dom.list.addEventListener('keydown', onListKeydown);

    // Pagination
    dom.btnPrev.addEventListener('click', goPrev);
    dom.btnNext.addEventListener('click', goNext);

    // Select: clicking anywhere in the container opens the list (except the dropdown itself)
    dom.selectRoot.addEventListener('click', (e) => {
      if (dom.dropdown.contains(e.target)) return;
      setDropdownOpen(true);
    });
    dom.projectSelect.addEventListener('focus', () => setDropdownOpen(true));
    dom.projectSelect.addEventListener('blur', () => setDropdownOpen(false));
    dom.projectSelect.addEventListener('change', onNativeChange);

    dom.dropdown.querySelectorAll('.select__option').forEach((opt) => {
      opt.setAttribute('role', 'option');
      opt.addEventListener('click', () => onOptionActivate(opt));
      opt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOptionActivate(opt);
        }
      });
    });

    // Global handlers
    document.addEventListener('click', (e) => {
      if (!dom.selectRoot.contains(e.target)) setDropdownOpen(false);
      if (dom.projectMenu && dom.projectMenuBtn) {
        if (!dom.projectMenu.contains(e.target) && !dom.projectMenuBtn.contains(e.target)) {
          setProjectMenuOpen(false);
        }
      }
      if (dom.dialogMenu && dialogMenuAnchorBtn) {
        if (!dom.dialogMenu.contains(e.target) && !dialogMenuAnchorBtn.contains(e.target)) {
          setDialogMenuOpen(false);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setProjectMenuOpen(false);
        setDialogMenuOpen(false);
      }
    });

    // Logout
    dom.logout.addEventListener('click', () => {
      // TODO: integrate real logout
      console.log('Logout clicked');
    });

    // The footer will be populated when a dialog is selected (selectDialog -> renderChatFooterForDialog)

    // Popup menu (project)
    dom.projectMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dom.projectMenu.getAttribute('aria-hidden') === 'false';
      setProjectMenuOpen(!isOpen);
    });
    // Toggle active / archived
    const openArchiveBtn = document.getElementById('menuOpenArchive');
    if(openArchiveBtn){
      openArchiveBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        toggleArchiveMode();
        setProjectMenuOpen(false);
      });
    }
    // Close the project menu after selecting an item
    if (dom.projectMenu) {
      dom.projectMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.popup-menu__item');
        if (!item) return;
        // Logic for handling the item action (logging only for now)
        console.log('Project menu action:', item.id || '(no-id)');
        setProjectMenuOpen(false);
        // Blur the item so no visual state remains
        if (document.activeElement === item) item.blur();
      });
    }
    window.addEventListener('resize', () => {
      if (dom.projectMenu.getAttribute('aria-hidden') === 'false') positionProjectMenu();
      if (dom.dialogMenu && dom.dialogMenu.getAttribute('aria-hidden') === 'false') positionDialogMenu();
    });
    window.addEventListener('scroll', () => {
      if (dom.projectMenu.getAttribute('aria-hidden') === 'false') positionProjectMenu();
      if (dom.dialogMenu && dom.dialogMenu.getAttribute('aria-hidden') === 'false') positionDialogMenu();
    }, true);

    // (menu click listener is added when the container is created)

    // Export handlers externally (optional, for future modules/tests)
    window.app = window.app || {};
    window.app.dialogActions = ACTION_HANDLERS;
    // Export unsubscribe API (if the module was already initialized further down the file)
    if (typeof UnsubscribeModal !== 'undefined') {
      window.app.unsubscribe = UnsubscribeModal;
    } else {
      // Deferred attempt after the current tick
      setTimeout(() => {
        if (typeof UnsubscribeModal !== 'undefined') {
          window.app.unsubscribe = UnsubscribeModal;
        }
      }, 0);
    }
  }

  // === helper: safely updates the timer inside li ===
  // Timer methods are available via window.app.dialogs.* for integration.
  function _getTimerNodeForLi(li) {
    return li.querySelector('.dialog__timer');
  }

  function setDialogTimer(id, valueString, { datetime = null, show = true } = {}) {
    const li = dom.list.querySelector(`.dialog[data-id="${String(id)}"]`);
    if (!li) return false;
    const timer = _getTimerNodeForLi(li);
    if (!timer) return false;

    const timeEl = timer.querySelector('.dialog__timer-value');
    timeEl.textContent = String(valueString);
    if (datetime) timeEl.setAttribute('datetime', datetime);
    timeEl.setAttribute('aria-label', `${String(valueString)} (таймер)`);

    if (show) showDialogTimer(id);
    return true;
  }

  function showDialogTimer(id) {
    const li = dom.list.querySelector(`.dialog[data-id="${String(id)}"]`);
    if (!li) return false;
    const timer = _getTimerNodeForLi(li);
    if (!timer) return false;
    timer.hidden = false;
    timer.dataset.visible = 'true';
    timer.setAttribute('aria-hidden', 'false');
    return true;
  }

  function hideDialogTimer(id) {
    const li = dom.list.querySelector(`.dialog[data-id="${String(id)}"]`);
    if (!li) return false;
    const timer = _getTimerNodeForLi(li);
    if (!timer) return false;
    timer.hidden = true;
    timer.dataset.visible = 'false';
    timer.setAttribute('aria-hidden', 'true');
    return true;
  }

  /**
   * Returns the dialog object by id or null.
   * @param {number|null} id
   * @returns {{id:number,name:string,time:string,platform:string,origin:string}|null}
   */
  function getDialogById(id){
    if (id == null) return null;
    return MOCK_DIALOGS.find(d => d.id === id) || ARCHIVE_DIALOGS.find(d => d.id === id) || null;
  }

  // ====== Toggle active / archived dialogs ======
  function applyViewMode(){
    const isArchive = state.viewMode === 'archive';
    document.documentElement.classList.toggle('view-archive', isArchive);
    const headerTitle = document.querySelector('.app-header__title');
    if(headerTitle){ headerTitle.textContent = isArchive ? 'Архивные диалоги' : 'Активные диалоги'; }
    if(dom.list){ dom.list.setAttribute('aria-label', isArchive ? 'Архивные диалоги' : 'Активные диалоги'); }
    const menuItem = document.getElementById('menuOpenArchive');
    if(menuItem){
      const labelSpan = menuItem.querySelector('.popup-menu__label');
      if(labelSpan){ labelSpan.textContent = isArchive ? 'Открыть активные диалоги' : 'Открыть архивные чаты'; }
    }
  }

  function toggleArchiveMode(){
    state.viewMode = state.viewMode === 'active' ? 'archive' : 'active';
    state.selectedId = null;
    state.currentPage = 1;
    if(dom.chatPanel) dom.chatPanel.hidden = true;
    if(dom.workspaceEmpty) dom.workspaceEmpty.hidden = false;
    if(state.viewMode === 'archive') seedArchiveMessages();
    renderList();
    applyViewMode();
  }

  // Export API for use from the console/other modules
  const dialogsApi = { setDialogTimer, showDialogTimer, hideDialogTimer };
  window.app = window.app || {};
  window.app.dialogs = dialogsApi;
  // Export access to dialog data for external modules (unsubscribe modal)
  window.getDialogById = getDialogById;
  window.toggleArchiveMode = toggleArchiveMode;
  window.ARCHIVE_DIALOGS = ARCHIVE_DIALOGS;
  // Convenient global aliases (for debugging)
  window.setDialogTimer = setDialogTimer;
  window.showDialogTimer = showDialogTimer;
  window.hideDialogTimer = hideDialogTimer;

  // === SINGLE PUBLIC API (AppAPI) ===
  // Centralized integration contract. Preserves backward compatibility with existing globals.
  (function exposeUnifiedApi(){
    if(window.AppAPI) return; // do not override if already created (in case of a repeated load)
    const unified = {
      version: '1.0.1', // patch: added attachment support in client messages
      auth: window.Auth ? {
        isAuthed: window.Auth.isAuthed,
        getPhase: window.Auth.getPhase,
        showLogin: window.Auth.showLogin,
        showApp: window.Auth.showApp,
        logout: window.Auth.performLogout
      } : null,
      dialogs: {
        select: (id) => { try { return selectDialog(Number(id)); } catch(e){ console.warn('[AppAPI.dialogs.select] error', e); } },
        getById: (id) => { try { return getDialogById(Number(id)); } catch(e){ return null; } },
        toggleArchive: () => { try { return toggleArchiveMode(); } catch(e){ console.warn('[AppAPI.dialogs.toggleArchive] error', e); } },
        switchToOperator: (id, meta={}) => { try { return performSwitchToOperator(Number(id), { source: meta.source || 'api' }); } catch(e){ console.warn('[AppAPI.dialogs.switchToOperator] error', e); } },
        timers: {
          set: (id, value, opts={}) => { try { return setDialogTimer(Number(id), value, opts); } catch(e){ return false; } },
          show: (id) => { try { return showDialogTimer(Number(id)); } catch(e){ return false; } },
          hide: (id) => { try { return hideDialogTimer(Number(id)); } catch(e){ return false; } }
        }
      },
      messages: {
        add: (dialogId, payload) => {
          try {
            if(!payload || typeof payload !== 'object') throw new Error('payload must be object');
            const { author='operator', text='', attachments=[], createdAt=new Date() } = payload;
            return addMessage(Number(dialogId), { author, text, attachments, createdAt });
          } catch(e){ console.warn('[AppAPI.messages.add] error', e); return null; }
        }
      },
      templates: {
        open: () => { try { return TemplatesModal.show(); } catch(e){ console.warn('[AppAPI.templates.open] error', e); } }
      },
      modals: {
        logout: () => { if(window.LogoutConfirm && window.LogoutConfirm.open) window.LogoutConfirm.open({ trigger:'api' }); },
        unsubscribe: (dialogId) => { if(window.UnsubscribeModal && window.UnsubscribeModal.open) window.UnsubscribeModal.open(Number(dialogId), { trigger:'api' }); }
      },
      notify: (title, message='', opts={}) => { try { return window.showServiceNotification ? window.showServiceNotification(title, message, opts) : null; } catch(e){ console.warn('[AppAPI.notify] error', e); return null; } },
      ping: () => ({ ok:true, ts: Date.now(), phase: window.Auth ? window.Auth.getPhase() : null })
    };
    window.AppAPI = unified;
  })();

  // Start
  init();
})();

/* ====== Logout Confirmation Modal Module ======
   Purpose: show a small logout confirmation modal instead of an instant logout.
   Architecture is similar to UnsubscribeModal, but without the error block and extra data.
   API: window.LogoutConfirm.open({trigger}) / close().
*/
(function(){
  'use strict';
  const modal = document.getElementById('logoutModal');
  if(!modal){ console.warn('[LogoutConfirm] modal element not found'); return; }
  const el = {
    modal,
    close: document.getElementById('logoutClose'),
    cancel: document.getElementById('logoutCancel'),
    confirm: document.getElementById('logoutConfirm'),
    spinner: modal.querySelector('.btn__spinner')
  };
  const state = { open:false, lastTrigger:null, lastActiveElement:null, loading:false };

  function setAriaHidden(root, hidden){ root.setAttribute('aria-hidden', hidden? 'true':'false'); }

  function trapFocus(e){
    if(!state.open || e.key !== 'Tab') return;
    const focusables = [el.cancel, el.confirm];
    const idx = focusables.indexOf(document.activeElement);
    if(e.shiftKey){
      if(idx <= 0){ e.preventDefault(); focusables[focusables.length-1].focus(); }
    } else {
      if(idx === focusables.length-1){ e.preventDefault(); focusables[0].focus(); }
    }
  }

  function open({ trigger = null } = {}){
    if(state.open) return;
    state.open = true; state.lastTrigger = trigger; state.lastActiveElement = document.activeElement;
    setAriaHidden(el.modal, false);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(()=> el.cancel.focus());
    document.addEventListener('keydown', onKeydown, true);
    el.modal.addEventListener('click', onOverlayClick);
  }

  function close({ returnFocus = true } = {}){
    if(!state.open) return;
    state.open = false; state.loading = false;
    setLoading(false);
    setAriaHidden(el.modal, true);
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown, true);
    el.modal.removeEventListener('click', onOverlayClick);
    if(returnFocus && state.lastActiveElement && typeof state.lastActiveElement.focus === 'function'){
      try { state.lastActiveElement.focus(); } catch(_){ /* noop */ }
    }
  }

  function setLoading(flag){
    state.loading = flag;
    if(flag){
      el.confirm.setAttribute('disabled','disabled');
      if(el.spinner) el.spinner.hidden = false;
    } else {
      el.confirm.removeAttribute('disabled');
      if(el.spinner) el.spinner.hidden = true;
    }
  }

  async function submit(){
    if(state.loading) return;
    setLoading(true);
    try {
      // Small artificial delay for UX (sense of action)
      await new Promise(r=>setTimeout(r, 250));
      if(window.Auth && typeof window.Auth.performLogout === 'function'){
        window.Auth.performLogout();
      } else {
        // Fallback if Auth is not initialized
        try { localStorage.removeItem('authToken'); } catch(_){ /* noop */ }
        console.warn('[LogoutConfirm] Auth.performLogout отсутствует, применён fallback');
        if(window.Auth && typeof window.Auth.showLogin === 'function') window.Auth.showLogin();
      }
      // We do not return focus to the logout button, since the login screen appears.
      close({ returnFocus:false });
    } finally {
      setLoading(false);
    }
  }

  function onKeydown(e){
    if(e.key === 'Escape'){ e.preventDefault(); close({ returnFocus:true }); }
    if(e.key === 'Tab') trapFocus(e);
    if((e.key === 'Enter' || e.key === ' ') && document.activeElement === el.confirm){ e.preventDefault(); submit(); }
  }

  function onOverlayClick(e){ if(e.target === el.modal) close({ returnFocus:true }); }

  el.close.addEventListener('click', ()=> close({ returnFocus:true }));
  el.cancel.addEventListener('click', ()=> close({ returnFocus:true }));
  el.confirm.addEventListener('click', submit);

  window.LogoutConfirm = { open, close };
})();

/* ====== Unsubscribe Confirmation Modal Module ======
   Architecture: an independent module not coupled to the whole file: uses
   public API (getDialogById) via window.app.dialogs is not required.
   State model: { open:boolean, dialogId:number|null, loading:boolean, lastTrigger: string|null }
   Methods:
     open(dialogId, {trigger})   — shows the modal, fills in the user name
     close({returnFocus})        — hides the modal, optionally returns focus
     setLoading(bool)            — toggles the loading state of the confirm button
     setError(message|null)      — shows/hides the error block
     submit()                    — simulates an async unsubscribe request (mock)
   For integration with a real backend, replace the fakeRequest function with fetch.
*/
(function(){
  'use strict';
  const modal = document.getElementById('unsubscribeModal');
  if(!modal){ console.warn('[UnsubscribeModal] container not found'); return; }
  const el = {
    modal,
    close: document.getElementById('unsubscribeClose'),
    cancel: document.getElementById('unsubscribeCancel'),
    confirm: document.getElementById('unsubscribeConfirm'),
    spinner: modal.querySelector('.btn__spinner'),
    error: document.getElementById('unsubscribeError'),
    errorText: document.getElementById('unsubscribeErrorText'),
    userName: document.getElementById('unsubscribeUserName')
  };
  const state = { open:false, dialogId:null, loading:false, lastTrigger:null, lastActiveElement:null };

  function getDialog(dialogId){
    try { return window.MOCK_DIALOGS ? window.MOCK_DIALOGS.find(d=>d.id===dialogId) : null; } catch(_){ return null; }
  }

  function setAriaHidden(root, hidden){ root.setAttribute('aria-hidden', hidden? 'true':'false'); }

  function trapFocus(e){
    if(!state.open) return;
    if(e.key !== 'Tab') return;
    const focusables = [el.cancel, el.confirm];
    const idx = focusables.indexOf(document.activeElement);
    if(e.shiftKey){
      if(idx <= 0){ e.preventDefault(); focusables[focusables.length-1].focus(); }
    } else {
      if(idx === focusables.length-1){ e.preventDefault(); focusables[0].focus(); }
    }
  }

  function open(dialogId, { trigger = null } = {}){
    state.dialogId = dialogId;
    state.open = true; state.lastTrigger = trigger; state.lastActiveElement = document.activeElement;
    const dialogData = (typeof getDialogById === 'function') ? getDialogById(dialogId) : getDialog(dialogId);
    el.userName.textContent = dialogData ? dialogData.name : 'user_'+dialogId;
    clearError();
    setLoading(false);
    setAriaHidden(el.modal, false);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(()=>{ el.cancel.focus(); });
    document.addEventListener('keydown', onKeydown, true);
    el.modal.addEventListener('click', onOverlayClick);
  }

  function close({ returnFocus = true } = {}){
    state.open = false; state.dialogId = null; state.loading = false;
    setAriaHidden(el.modal, true);
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown, true);
    el.modal.removeEventListener('click', onOverlayClick);
    if(returnFocus && state.lastActiveElement && typeof state.lastActiveElement.focus === 'function'){
      try { state.lastActiveElement.focus(); } catch(_){ /* noop */ }
    }
  }

  function setLoading(is){
    state.loading = is;
    if(is){
      el.confirm.setAttribute('disabled','disabled');
      el.spinner.hidden = false;
    } else {
      el.confirm.removeAttribute('disabled');
      el.spinner.hidden = true;
    }
  }

  function setError(message){
    if(!message){ clearError(); return; }
    el.errorText.textContent = message;
    el.error.hidden = false;
  }
  function clearError(){ el.error.hidden = true; }

  function fakeRequest(){
    return new Promise((resolve,reject)=>{
      // simulation: 50% chance of error, 900ms
      setTimeout(()=>{ Math.random() < 0.5 ? resolve({ ok:true }) : reject(new Error('Не удалось найти и отменить подписку')); }, 900);
    });
  }

  async function submit(){
    if(state.loading) return;
    setError(null);
    setLoading(true);
    try {
      // Replace fakeRequest with a real fetch
      await fakeRequest();
      // Success: close the modal
      close({ returnFocus:true });
      console.log('[Unsubscribe] success for dialog', state.dialogId);
      if (typeof window.showServiceNotification === 'function') {
        window.showServiceNotification('Подписка отменена', 'Подписка пользователя успешно отменена');
      }
    } catch(err){
      console.warn('[Unsubscribe] error', err);
      setError(err.message || 'Ошибка отмены подписки');
    } finally {
      setLoading(false);
    }
  }

  function onKeydown(e){
    if(e.key === 'Escape'){ e.preventDefault(); close({ returnFocus:true }); }
    if(e.key === 'Tab') trapFocus(e);
    if((e.key === 'Enter' || e.key === ' ') && document.activeElement === el.confirm){ e.preventDefault(); submit(); }
  }

  function onOverlayClick(e){
    if(e.target === el.modal) close({ returnFocus:true });
  }

  el.close.addEventListener('click', ()=> close({ returnFocus:true }));
  el.cancel.addEventListener('click', ()=> close({ returnFocus:true }));
  el.confirm.addEventListener('click', submit);

  // Export API
  window.UnsubscribeModal = { open, close, submit, setError, clearError, setLoading };
})();

/* ====== Service Notifications (Toast) Module ======
   Purpose: compact service notifications (toasts) at the bottom right.
   Simplified API (v2):
     showServiceNotification(title, message)
       title   — title string (required)
       message — text string (may be empty)

   Legacy: the third parameter (object) is allowed; only the timeout property is considered.
     showServiceNotification('Saved','Changes applied',{ timeout: 6000 });
     timeout: number of ms (0 or negative/Infinity => no auto close).

   Behavior:
     - Auto-close after 4000 ms by default.
     - Max 5 active notifications (old ones removed FIFO).
     - No progress bar; the close button is visible only on hover/focus.
     - Container has aria-live="polite" for accessibility.
*/
(function ServiceToasts(){
  const MAX_TOASTS = 5;
  const DEFAULT_TIMEOUT = 4000;
  const container = document.getElementById('toastContainer');
  if(!container){ console.warn('[Toast] container #toastContainer не найден'); return; }

  const active = new Map(); // id -> { el, timer, opts }

  function escape(str){
    return String(str == null ? '' : str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function removeToast(id, reason){
    const rec = active.get(id);
    if(!rec) return;
    if(rec.timer) clearTimeout(rec.timer);
    const { el, opts } = rec;
    el.dataset.dismiss = 'true';
    setTimeout(()=>{
      if(el.parentNode) el.parentNode.removeChild(el);
      active.delete(id);
      if(opts && typeof opts.onClose === 'function'){
        try { opts.onClose(reason || 'api'); } catch(e){ /* noop */ }
      }
    }, 260);
  }

  function scheduleAutoClose(id, timeout){
    if(timeout <= 0 || !isFinite(timeout)) return;
    const rec = active.get(id);
    if(!rec) return;
    rec.timer = setTimeout(()=> removeToast(id, 'timeout'), timeout);
  }

  function buildId(customId){
    return customId || ('toast:' + Date.now() + ':' + Math.random().toString(36).slice(2,7));
  }

  function createToastEl(id, title, message, variant, opts){
    const el = document.createElement('div');
    el.className = 'toast' + (variant && variant !== 'default' ? ' toast--'+variant : '');
    el.setAttribute('role','status');
    el.dataset.id = id;
    const parts = [];
    parts.push('<div class="toast__content">');
    parts.push(`<h3 class="toast__title">${escape(title)}</h3>`);
    if(message){ parts.push(`<p class="toast__message">${escape(message)}</p>`); }
    parts.push('</div>');
    if(opts.closeButton !== false){
      parts.push(`<button class="toast__close" type="button" aria-label="Закрыть уведомление">`+
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`+
        `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`+
      `</button>`);
    }
    el.innerHTML = parts.join('');
    if(opts.closeButton !== false){
      const btn = el.querySelector('.toast__close');
      btn.addEventListener('click', ()=> removeToast(id, 'close'));
    }
    return el;
  }

  function enforceLimit(){
    const keys = Array.from(active.keys());
    while(keys.length > MAX_TOASTS){
      const oldest = keys.shift();
      removeToast(oldest, 'overflow');
    }
  }

  // New simplified API: showServiceNotification(title, message)
  // For backward compatibility the third parameter (opts) may be passed but is ignored (except legacy timeout>0 for auto-close)
  function showServiceNotification(title, message='', legacyOpts){
    const opts = (legacyOpts && typeof legacyOpts === 'object') ? legacyOpts : {};
    // Keep only timeout (to opt out of auto-close) — other options removed
    const timeout = (typeof opts.timeout === 'number') ? opts.timeout : DEFAULT_TIMEOUT;
    const options = { variant:'default', timeout, id:null, closeButton:true };
    const id = buildId(options.id);
    if(active.has(id)){
      const old = active.get(id);
      if(old.timer) clearTimeout(old.timer);
      const oldEl = old.el;
      const content = oldEl.querySelector('.toast__content');
      if(content){
        content.innerHTML = `<h3 class=\"toast__title\">${escape(title)}</h3>${message ? `<p class=\\"toast__message\\">${escape(message)}</p>`:''}`;
      }
      container.prepend(oldEl);
      active.set(id, { el: oldEl, opts: options });
      scheduleAutoClose(id, timeout);
      enforceLimit();
      return id;
    }
    const el = createToastEl(id, title, message, options.variant, options);
    container.prepend(el);
    active.set(id, { el, opts: options, timer:null });
    scheduleAutoClose(id, timeout);
    enforceLimit();
    return id;
  }

  window.showServiceNotification = showServiceNotification;
})();