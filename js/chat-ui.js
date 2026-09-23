/* ====== Chat UI Module ======
   Dynamic chat footer (AI banner / operator composer with attachments),
   list event delegation, pagination controls, custom select, popup menus,
   dialog context menu and its action handlers.
   Deps: SC.state/dom, SC.dialogs/messages/modals exports.
*/
(function(){
  'use strict';
  const SC = window.SC;

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
      SC.performSwitchToOperator(dialogId, { source: 'banner' });
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

    // Local state of composer attachments (not added to SC.MessageStore until sent)
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
    function triggerTemplates(){ SC.TemplatesModal.show(); }
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
      if(SC.state.selectedId != null){
        const attachments = readyAtts.map(m => ({
          id: 'upl:' + m.id,
            name: m.name,
            size: m.sizeLabel,
            contentType: m.contentType,
            url: m.url,
            downloadUrl: m.url,
            displayHint: m.displayHint
        }));
        SC.addMessage(SC.state.selectedId, { author:'operator', text:value || (attachments.length? '': ''), attachments, createdAt: new Date() });
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
    if (!SC.dom.chatFooter) return;
    SC.dom.chatFooter.innerHTML = '';
    if (!dialogData) return;
    const isBot = dialogData.origin !== 'operator';
    const el = isBot ? createAiBanner(dialogData.id) : createOperatorComposer();
    SC.dom.chatFooter.appendChild(el);
  }

  // Delegated click on inline images inside the chat body
  if(SC.dom.chatBody){
    SC.dom.chatBody.addEventListener('click', (e)=>{
      // If the click is on a download button inside an inline image — allow the download and do not open the modal
      const dlBtn = e.target.closest('.msg-image__download');
      if(dlBtn) return; // the browser will perform the standard download
      const fig = e.target.closest && e.target.closest('.msg-image');
      if(!fig || !SC.dom.chatBody.contains(fig)) return;
      const url = fig.getAttribute('data-url');
      const name = fig.getAttribute('data-name') || 'image';
      if(url){
        SC.ImagePreviewModal.open({ url, name });
      }
    });
  }

  /* ====== Events: list (delegation) ====== */
  function onListClick(event) {
    const li = event.target.closest('li.dialog');
    if (!li || !SC.dom.list.contains(li)) return;
    const id = Number(li.dataset.id);
    SC.selectDialog(id);
  }

  function onListKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const li = event.target.closest('li.dialog');
    if (!li || !SC.dom.list.contains(li)) return;
    event.preventDefault();
    const id = Number(li.dataset.id);
    SC.selectDialog(id);
  }

  /* ====== Pagination ====== */
  function goPrev() {
    if (SC.state.currentPage > 1) {
      SC.state.currentPage--;
      SC.renderList();
    }
  }
  function goNext() {
    const totalPages = Math.max(1, Math.ceil(SC.currentDialogs().length / SC.state.pageSize));
    if (SC.state.currentPage < totalPages) {
      SC.state.currentPage++;
      SC.renderList();
    }
  }

  /* ====== Custom select ======
     The native select remains but is visually hidden. The visible part is controlled by .open.
  */
  function setDropdownOpen(isOpen) {
    if (!SC.dom.selectRoot) return;
    SC.dom.selectRoot.classList.toggle('open', isOpen);
    SC.setAriaExpanded(SC.dom.selectRoot, isOpen);
  }

  function onNativeChange(e) {
    const value = e.target.value;
    SC.dom.projectDisplay.textContent = value;
    const options = Array.from(SC.dom.dropdown.querySelectorAll('.select__option'));
    for (const opt of options) {
      const isSelected = opt.dataset.value === value;
      opt.classList.toggle('select__option--selected', isSelected);
      opt.setAttribute('aria-selected', String(isSelected));
    }
    setDropdownOpen(false);
  }

  function onOptionActivate(optEl) {
    const value = optEl.dataset.value;
    SC.dom.projectSelect.value = value;
    SC.dom.projectDisplay.textContent = value;
    const options = Array.from(SC.dom.dropdown.querySelectorAll('.select__option'));
    for (const o of options) o.classList.remove('select__option--selected');
    optEl.classList.add('select__option--selected');
    optEl.setAttribute('aria-selected', 'true');
    setDropdownOpen(false);
    SC.dom.projectSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ====== Popup menu: project ======
     The menu opens at the project button. Closes on outside click/ESC.
  */
  function setProjectMenuOpen(isOpen){
    if (!SC.dom.projectMenu || !SC.dom.projectMenuBtn) return;
    SC.setAriaHidden(SC.dom.projectMenu, !isOpen);
    SC.setAriaExpanded(SC.dom.projectMenuBtn, isOpen);
    if (isOpen) positionProjectMenu();
  }

  function positionProjectMenu(){
    if (!SC.dom.projectMenu || !SC.dom.projectMenuBtn) return;
    const container = SC.dom.projectMenuBtn.closest('.sidebar__project');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = SC.dom.projectMenuBtn.getBoundingClientRect();

    // Temporarily show to measure width if hidden
    const wasHidden = SC.dom.projectMenu.getAttribute('aria-hidden') !== 'false';
    if (wasHidden) {
      SC.dom.projectMenu.style.visibility = 'hidden';
      SC.dom.projectMenu.setAttribute('aria-hidden', 'false');
    }
    const menuWidth = SC.dom.projectMenu.offsetWidth;
    // Align the right edge of the menu with the right edge of the button
    const top = btnRect.bottom - containerRect.top + 6; // 6px offset
    const left = btnRect.right - containerRect.left - menuWidth;
    SC.dom.projectMenu.style.top = top + 'px';
    SC.dom.projectMenu.style.left = left + 'px';
    SC.dom.projectMenu.style.right = 'auto';
    if (wasHidden) {
      SC.dom.projectMenu.setAttribute('aria-hidden', 'true');
      SC.dom.projectMenu.style.visibility = '';
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
     Architectural approach: a single SC.ACTION_HANDLERS dispatcher keyed by button id.
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
      SC.performSwitchToOperator(dialogId, { source: 'menu' });
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
    if (SC.dom.dialogMenu) return SC.dom.dialogMenu;
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
      const dialogId = SC.getCurrentDialogIdByAnchor();
      const actionId = itemBtn.id;
      const handler = SC.ACTION_HANDLERS[actionId];
      const context = { dialogId, actionId, source: 'dialogMenu' };
      if (typeof handler === 'function') {
        try { handler(context); } catch(err){ console.error('[dialog action error]', actionId, err); }
      } else {
        console.warn('[dialog action] Нет обработчика для', actionId, context);
      }
      SC.setDialogMenuOpen(false);
      if (SC.dialogMenuAnchorBtn) SC.dialogMenuAnchorBtn.focus();
    });
    SC.dom.dialogMenu = el;
    return el;
  }

  // Rebuilds menu items for a specific dialog (filtering at composition time)
  /**
   * Rebuilds the HTML of the context menu for the given dialogId.
   * Filters out the handoff-to-operator item if origin is already operator.
   * @param {number|null} dialogId
   */
  function renderDialogMenuForDialog(dialogId){
    const menuEl = SC.ensureDialogMenuContainer();
  const data = dialogId != null ? SC.getDialogById(dialogId) : null;
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
    if (!SC.dialogMenuAnchorBtn) return null;
    const li = SC.dialogMenuAnchorBtn.closest('li.dialog');
    return li ? Number(li.dataset.id) : null;
  }
  /**
   * Opens/closes the dialog context menu. Rebuilds content on open.
   * @param {boolean} isOpen
   */
  function setDialogMenuOpen(isOpen){
    if (isOpen){
      const dialogId = SC.getCurrentDialogIdByAnchor() ?? SC.state.selectedId ?? null;
      SC.renderDialogMenuForDialog(dialogId);
      SC.setAriaHidden(SC.dom.dialogMenu, false);
      positionDialogMenu();
    } else if (SC.dom.dialogMenu) {
      SC.setAriaHidden(SC.dom.dialogMenu, true);
    }
  }

  /**
   * Positions the context menu relative to the anchor button.
   */
  function positionDialogMenu(){
    if (!SC.dialogMenuAnchorBtn || !SC.dom.dialogMenu) return;
    const btnRect = SC.dialogMenuAnchorBtn.getBoundingClientRect();
    SC.dom.dialogMenu.style.position = 'fixed';
    const top = Math.round(btnRect.bottom + 6);
    const menuWidth = SC.dom.dialogMenu.offsetWidth || 0;
    let left = Math.round(btnRect.right - menuWidth);
    if (left < 8) left = 8; // small offset from the edge
    SC.dom.dialogMenu.style.top = top + 'px';
    SC.dom.dialogMenu.style.left = left + 'px';
    SC.dom.dialogMenu.style.right = 'auto';
  }


  SC.renderChatFooterForDialog = renderChatFooterForDialog;
  SC.onListClick = onListClick;
  SC.onListKeydown = onListKeydown;
  SC.goPrev = goPrev;
  SC.goNext = goNext;
  SC.setDropdownOpen = setDropdownOpen;
  SC.onNativeChange = onNativeChange;
  SC.onOptionActivate = onOptionActivate;
  SC.setProjectMenuOpen = setProjectMenuOpen;
  SC.positionProjectMenu = positionProjectMenu;
  SC.positionDialogMenu = positionDialogMenu;
  SC.ACTION_HANDLERS = ACTION_HANDLERS;
  SC.ensureDialogMenuContainer = ensureDialogMenuContainer;
  SC.renderDialogMenuForDialog = renderDialogMenuForDialog;
  SC.getCurrentDialogIdByAnchor = getCurrentDialogIdByAnchor;
  SC.setDialogMenuOpen = setDialogMenuOpen;
})();
