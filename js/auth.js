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
