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
