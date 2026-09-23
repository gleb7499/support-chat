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