/* ====== Dialogs Module ======
   Dialog list rendering, selection, origin badges, handover to operator,
   active/archive view toggle, SLA timer pills, small shared utilities.
   Deps: SC.state/dom/MOCK_DIALOGS/ARCHIVE_DIALOGS, SC.MessageStore,
         message/footer rendering via SC.* (resolved at call time).
*/
(function(){
  'use strict';
  const SC = window.SC;

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
   * Renders the current page of the dialog list based on SC.state.currentPage/SC.state.pageSize.
   * Updates pagination controls and the counter.
   * Side effects: modifies the DOM inside the list and controls.
   */
  function currentDialogs(){ return SC.state.viewMode === 'active' ? SC.MOCK_DIALOGS : SC.ARCHIVE_DIALOGS; }

  function renderList() {
    const source = currentDialogs();
    const totalPages = Math.max(1, Math.ceil(source.length / SC.state.pageSize));
    SC.state.currentPage = Math.min(SC.state.currentPage, totalPages);

    SC.dom.list.innerHTML = '';

    const pageItems = paginate(source, SC.state.currentPage, SC.state.pageSize);
    const fragment = document.createDocumentFragment();

    for (const item of pageItems) {
      const li = document.createElement('li');
      li.className = 'dialog';
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');
      li.dataset.id = String(item.id);
      li.setAttribute('aria-selected', String(SC.state.selectedId === item.id));

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

    SC.dom.list.appendChild(fragment);

    SC.dom.pageInfo.textContent = `${SC.state.currentPage} из ${totalPages}`;
    const isFirst = SC.state.currentPage <= 1;
    const isLast = SC.state.currentPage >= totalPages;
    SC.dom.btnPrev.disabled = isFirst;
    SC.dom.btnNext.disabled = isLast;
    SC.dom.btnPrev.classList.toggle('btn--disabled', isFirst);
    SC.dom.btnNext.classList.toggle('btn--disabled', isLast);
    SC.dom.totalCounter.textContent = String(source.length);
  }

  /**
   * Selects the dialog, updates the visual state of the list and the right panel.
   * If the context menu is open, rebuilds it for the current dialog.
   * @param {number|null} id
   */
  function selectDialog(id) {
    SC.state.selectedId = id;
    for (const node of SC.dom.list.children) {
      node.setAttribute('aria-selected', String(node.dataset.id == String(id)));
    }
    // If the context menu is already open while selection changes — update its content
    if (SC.dom.dialogMenu && SC.dom.dialogMenu.getAttribute('aria-hidden') === 'false') {
      if (!SC.dialogMenuAnchorBtn) {
        const currentLi = SC.dom.list.querySelector(`.dialog[data-id="${String(id)}"]`);
        if (currentLi) SC.dialogMenuAnchorBtn = currentLi.querySelector('.dialog__menu .icon-btn');
      }
      SC.renderDialogMenuForDialog(id);
      positionDialogMenu();
    }
    // Show/hide right panel
    if (SC.dom.chatPanel && SC.dom.workspaceEmpty) {
      if (id != null) {
        SC.dom.chatPanel.hidden = false;
        SC.dom.workspaceEmpty.hidden = true;
        // Find the selected dialog data
  const data = getDialogById(id);
        if (data) {
          SC.dom.chatUser.textContent = data.name;
          // meta: platform + UID (we conventionally build the UID from id for the example)
          SC.dom.chatMeta.textContent = `${data.platform} • UID ${String(500000 + data.id)}`;
          if (SC.dom.chatBadge) {
            const badge = buildOriginBadge(data.origin);
            SC.dom.chatBadge.className = badge.className;
            SC.dom.chatBadge.innerHTML = `${badge.iconSvg}${badge.label}`;
          }
          // Update the footer for the selected dialog
          SC.renderChatFooterForDialog(data);
          // Render messages for the selected dialog
          SC.renderMessagesForDialog(data.id);
        }
      } else {
        SC.dom.chatPanel.hidden = true;
        SC.dom.workspaceEmpty.hidden = false;
        if (SC.dom.chatFooter) SC.dom.chatFooter.innerHTML = '';
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
    const li = SC.dom.list && SC.dom.list.querySelector(`li.dialog[data-id="${id}"]`);
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
      if (SC.dom.dialogMenu) {
        const toOpBtn = SC.dom.dialogMenu.querySelector('[data-action="dlgToOperator"], #dlgToOperator, [id="dlgToOperator"]');
        if (toOpBtn) toOpBtn.remove();
      }
      if (typeof SC.setDialogMenuOpen === 'function') {
        SC.setDialogMenuOpen(false);
      }
    }

    // 2) update data
    setDialogOrigin(dialogId, 'operator');

    // 3) update the list item (badge)
    updateDialogListBadge(dialogId);

    // 4) if this dialog is open, update the header and footer
    if (SC.state.selectedId === dialogId) {
      const badge = buildOriginBadge('operator');
      if (SC.dom.chatBadge) {
        SC.dom.chatBadge.className = badge.className;
        SC.dom.chatBadge.innerHTML = `${badge.iconSvg}${badge.label}`;
      }
      // Re-render the footer into composer mode
      const dlgData = getDialogById(dialogId);
      SC.renderChatFooterForDialog(dlgData);
    }

    console.log('[switch] dialog', dialogId, 'переведён на оператора (source:', source, ')');
  }

  // === helper: safely updates the timer inside li ===
  // Timer methods are available via window.app.dialogs.* for integration.
  function _getTimerNodeForLi(li) {
    return li.querySelector('.dialog__timer');
  }

  function setDialogTimer(id, valueString, { datetime = null, show = true } = {}) {
    const li = SC.dom.list.querySelector(`.dialog[data-id="${String(id)}"]`);
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
    const li = SC.dom.list.querySelector(`.dialog[data-id="${String(id)}"]`);
    if (!li) return false;
    const timer = _getTimerNodeForLi(li);
    if (!timer) return false;
    timer.hidden = false;
    timer.dataset.visible = 'true';
    timer.setAttribute('aria-hidden', 'false');
    return true;
  }

  function hideDialogTimer(id) {
    const li = SC.dom.list.querySelector(`.dialog[data-id="${String(id)}"]`);
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
    return SC.MOCK_DIALOGS.find(d => d.id === id) || SC.ARCHIVE_DIALOGS.find(d => d.id === id) || null;
  }

  // ====== Toggle active / archived dialogs ======
  function applyViewMode(){
    const isArchive = SC.state.viewMode === 'archive';
    document.documentElement.classList.toggle('view-archive', isArchive);
    const headerTitle = document.querySelector('.app-header__title');
    if(headerTitle){ headerTitle.textContent = isArchive ? 'Архивные диалоги' : 'Активные диалоги'; }
    if(SC.dom.list){ SC.dom.list.setAttribute('aria-label', isArchive ? 'Архивные диалоги' : 'Активные диалоги'); }
    const menuItem = document.getElementById('menuOpenArchive');
    if(menuItem){
      const labelSpan = menuItem.querySelector('.popup-menu__label');
      if(labelSpan){ labelSpan.textContent = isArchive ? 'Открыть активные диалоги' : 'Открыть архивные чаты'; }
    }
  }

  function toggleArchiveMode(){
    SC.state.viewMode = SC.state.viewMode === 'active' ? 'archive' : 'active';
    SC.state.selectedId = null;
    SC.state.currentPage = 1;
    if(SC.dom.chatPanel) SC.dom.chatPanel.hidden = true;
    if(SC.dom.workspaceEmpty) SC.dom.workspaceEmpty.hidden = false;
    if(SC.state.viewMode === 'archive') SC.seedArchiveMessages();
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
  window.SC.ARCHIVE_DIALOGS = SC.ARCHIVE_DIALOGS;
  // Convenient global aliases (for debugging)
  window.setDialogTimer = setDialogTimer;
  window.showDialogTimer = showDialogTimer;
  window.hideDialogTimer = hideDialogTimer;


  SC.ImagePreviewModal = ImagePreviewModal;
  SC.paginate = paginate;
  SC.setAriaExpanded = setAriaExpanded;
  SC.setAriaHidden = setAriaHidden;
  SC.currentDialogs = currentDialogs;
  SC.renderList = renderList;
  SC.selectDialog = selectDialog;
  SC.buildOriginBadge = buildOriginBadge;
  SC.setDialogOrigin = setDialogOrigin;
  SC.updateDialogListBadge = updateDialogListBadge;
  SC.performSwitchToOperator = performSwitchToOperator;
  SC.getDialogById = getDialogById;
  SC.toggleArchiveMode = toggleArchiveMode;
  SC.setDialogTimer = setDialogTimer;
  SC.showDialogTimer = showDialogTimer;
  SC.hideDialogTimer = hideDialogTimer;
})();
