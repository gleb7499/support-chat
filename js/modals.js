/* ====== Modals Module ======
   Reply templates modal (CRUD) and the image preview modal.
   Deps: SC.TemplatesStore, SC.escapeHtml, window.showServiceNotification.
*/
(function(){
  'use strict';
  const SC = window.SC;

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
      SC.setAriaHidden(modal, false);
      modal.focus();
      switchTab('templates');
    }

    function hide() {
      if (!modal) return;
      SC.setAriaHidden(modal, true);
      resetForm();
    }

    function switchTab(tabName) {
      if (tabName === 'templates') {
        templatesTab.setAttribute('aria-selected', 'true');
        templatesTab.tabIndex = 0;
        createTab.setAttribute('aria-selected', 'false');
        createTab.tabIndex = -1;
        
        SC.setAriaHidden(templatesPanel, false);
        SC.setAriaHidden(createPanel, true);
        
        resetForm();
      } else if (tabName === 'create') {
        templatesTab.setAttribute('aria-selected', 'false');
        templatesTab.tabIndex = -1;
        createTab.setAttribute('aria-selected', 'true');
        createTab.tabIndex = 0;
        
        SC.setAriaHidden(templatesPanel, true);
        SC.setAriaHidden(createPanel, false);
        
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
            <h4 class="template-item__title">${SC.escapeHtml(template.name)}</h4>
            <p class="template-item__text">${SC.escapeHtml(template.text)}</p>
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

  SC.TemplatesStore = TemplatesStore;
  SC.TemplatesModal = TemplatesModal;
})();
