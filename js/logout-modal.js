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
