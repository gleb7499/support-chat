/* ====== Application Bootstrap & Public API ======
   Initialization, event wiring and the single public window.AppAPI
   (versioned integration contract, kept for backward compatibility).
*/
(function(){
  'use strict';
  const SC = window.SC;

  /* ====== Initialization ======
     Entry point: render, subscriptions, menu preparation.
  */
  function init() {
    // Render the initial page
    SC.renderList();
    // Default right panel state
    if (SC.dom.chatPanel) SC.dom.chatPanel.hidden = true;

    // Demo messages
    SC.seedDemoMessages();

  // The dialog context menu is created lazily on first open (ensureDialogMenuContainer)

    // List: delegation
    SC.dom.list.addEventListener('click', (event) => {
      // click on the menu button in a list item
      const menuBtn = event.target.closest('.dialog__menu .icon-btn');
      if (menuBtn) {
        event.stopPropagation();
        event.preventDefault();
        SC.dialogMenuAnchorBtn = menuBtn;
        const isOpen = SC.dom.dialogMenu && SC.dom.dialogMenu.getAttribute('aria-hidden') === 'false';
        SC.setDialogMenuOpen(!isOpen);
        return;
      }
      SC.onListClick(event);
    });
    SC.dom.list.addEventListener('keydown', SC.onListKeydown);

    // Pagination
    SC.dom.btnPrev.addEventListener('click', SC.goPrev);
    SC.dom.btnNext.addEventListener('click', SC.goNext);

    // Select: clicking anywhere in the container opens the list (except the dropdown itself)
    SC.dom.selectRoot.addEventListener('click', (e) => {
      if (SC.dom.dropdown.contains(e.target)) return;
      SC.setDropdownOpen(true);
    });
    SC.dom.projectSelect.addEventListener('focus', () => SC.setDropdownOpen(true));
    SC.dom.projectSelect.addEventListener('blur', () => SC.setDropdownOpen(false));
    SC.dom.projectSelect.addEventListener('change', SC.onNativeChange);

    SC.dom.dropdown.querySelectorAll('.select__option').forEach((opt) => {
      opt.setAttribute('role', 'option');
      opt.addEventListener('click', () => SC.onOptionActivate(opt));
      opt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          SC.onOptionActivate(opt);
        }
      });
    });

    // Global handlers
    document.addEventListener('click', (e) => {
      if (!SC.dom.selectRoot.contains(e.target)) SC.setDropdownOpen(false);
      if (SC.dom.projectMenu && SC.dom.projectMenuBtn) {
        if (!SC.dom.projectMenu.contains(e.target) && !SC.dom.projectMenuBtn.contains(e.target)) {
          SC.setProjectMenuOpen(false);
        }
      }
      if (SC.dom.dialogMenu && SC.dialogMenuAnchorBtn) {
        if (!SC.dom.dialogMenu.contains(e.target) && !SC.dialogMenuAnchorBtn.contains(e.target)) {
          SC.setDialogMenuOpen(false);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        SC.setDropdownOpen(false);
        SC.setProjectMenuOpen(false);
        SC.setDialogMenuOpen(false);
      }
    });

    // Logout
    SC.dom.logout.addEventListener('click', () => {
      // TODO: integrate real logout
      console.log('Logout clicked');
    });

    // The footer will be populated when a dialog is selected (SC.selectDialog -> renderChatFooterForDialog)

    // Popup menu (project)
    SC.dom.projectMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = SC.dom.projectMenu.getAttribute('aria-hidden') === 'false';
      SC.setProjectMenuOpen(!isOpen);
    });
    // Toggle active / archived
    const openArchiveBtn = document.getElementById('menuOpenArchive');
    if(openArchiveBtn){
      openArchiveBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        SC.toggleArchiveMode();
        SC.setProjectMenuOpen(false);
      });
    }
    // Close the project menu after selecting an item
    if (SC.dom.projectMenu) {
      SC.dom.projectMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.popup-menu__item');
        if (!item) return;
        // Logic for handling the item action (logging only for now)
        console.log('Project menu action:', item.id || '(no-id)');
        SC.setProjectMenuOpen(false);
        // Blur the item so no visual state remains
        if (document.activeElement === item) item.blur();
      });
    }
    window.addEventListener('resize', () => {
      if (SC.dom.projectMenu.getAttribute('aria-hidden') === 'false') SC.positionProjectMenu();
      if (SC.dom.dialogMenu && SC.dom.dialogMenu.getAttribute('aria-hidden') === 'false') SC.positionDialogMenu();
    });
    window.addEventListener('scroll', () => {
      if (SC.dom.projectMenu.getAttribute('aria-hidden') === 'false') SC.positionProjectMenu();
      if (SC.dom.dialogMenu && SC.dom.dialogMenu.getAttribute('aria-hidden') === 'false') SC.positionDialogMenu();
    }, true);

    // (menu click listener is added when the container is created)

    // Export handlers externally (optional, for future modules/tests)
    window.app = window.app || {};
    window.app.dialogActions = SC.ACTION_HANDLERS;
    // Export unsubscribe API (if the module was already initialized further down the file)
    if (typeof window.UnsubscribeModal !== 'undefined') {
      window.app.unsubscribe = window.UnsubscribeModal;
    } else {
      // Deferred attempt after the current tick
      setTimeout(() => {
        if (typeof window.UnsubscribeModal !== 'undefined') {
          window.app.unsubscribe = window.UnsubscribeModal;
        }
      }, 0);
    }
  }

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
        select: (id) => { try { return SC.selectDialog(Number(id)); } catch(e){ console.warn('[AppAPI.dialogs.select] error', e); } },
        getById: (id) => { try { return SC.getDialogById(Number(id)); } catch(e){ return null; } },
        toggleArchive: () => { try { return SC.toggleArchiveMode(); } catch(e){ console.warn('[AppAPI.dialogs.toggleArchive] error', e); } },
        switchToOperator: (id, meta={}) => { try { return SC.performSwitchToOperator(Number(id), { source: meta.source || 'api' }); } catch(e){ console.warn('[AppAPI.dialogs.switchToOperator] error', e); } },
        timers: {
          set: (id, value, opts={}) => { try { return SC.setDialogTimer(Number(id), value, opts); } catch(e){ return false; } },
          show: (id) => { try { return SC.showDialogTimer(Number(id)); } catch(e){ return false; } },
          hide: (id) => { try { return SC.hideDialogTimer(Number(id)); } catch(e){ return false; } }
        }
      },
      messages: {
        add: (dialogId, payload) => {
          try {
            if(!payload || typeof payload !== 'object') throw new Error('payload must be object');
            const { author='operator', text='', attachments=[], createdAt=new Date() } = payload;
            return SC.addMessage(Number(dialogId), { author, text, attachments, createdAt });
          } catch(e){ console.warn('[AppAPI.messages.add] error', e); return null; }
        }
      },
      templates: {
        open: () => { try { return SC.TemplatesModal.show(); } catch(e){ console.warn('[AppAPI.templates.open] error', e); } }
      },
      modals: {
        logout: () => { if(window.LogoutConfirm && window.LogoutConfirm.open) window.LogoutConfirm.open({ trigger:'api' }); },
        unsubscribe: (dialogId) => { if(window.window.UnsubscribeModal && window.window.UnsubscribeModal.open) window.window.UnsubscribeModal.open(Number(dialogId), { trigger:'api' }); }
      },
      notify: (title, message='', opts={}) => { try { return window.showServiceNotification ? window.showServiceNotification(title, message, opts) : null; } catch(e){ console.warn('[AppAPI.notify] error', e); return null; } },
      ping: () => ({ ok:true, ts: Date.now(), phase: window.Auth ? window.Auth.getPhase() : null })
    };
    window.AppAPI = unified;
  })();

  // Start
  init();
})();
