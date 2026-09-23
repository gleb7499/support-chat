/* ====== Messages Module ======
   Message utilities, attachment helpers (inline image / file),
   message rendering for the chat panel and demo-data seeding.
   Deps: SC.state, SC.dom, SC.MessageStore, SC.archiveSeeded, SC.ARCHIVE_DIALOGS.
*/
(function(){
  'use strict';
  const SC = window.SC;

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
    if(!SC.dom.chatBody || SC.state.selectedId !== dialogId) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = createMessageHtml(msg);
    SC.dom.chatBody.appendChild(wrap.firstElementChild);
    SC.dom.chatBody.scrollTop = SC.dom.chatBody.scrollHeight;
    const el = SC.dom.chatBody.querySelector(`[data-msg-id="${msg.id}"]`);
    if(el) processMessageAttachments(dialogId, msg, el);
  }

  // Backward-compatible interface for the current composer
  function addMessage(dialogId, { author, text, attachments = [], createdAt = new Date() }){
    const msg = SC.MessageStore.addLocal(dialogId, { author, text, attachments, createdAt, status: author === 'operator' ? 'pending':'sent' });
    appendMessageToDom(dialogId, msg);
    return msg;
  }

  function renderMessagesForDialog(dialogId){
    if(!SC.dom.chatBody) return;
    SC.dom.chatBody.innerHTML = '';
    if(dialogId == null) return;
    const list = SC.MessageStore.getList(dialogId);
    const frag = document.createDocumentFragment();
    for(const m of list){
      const w = document.createElement('div');
      w.innerHTML = createMessageHtml(m);
      frag.appendChild(w.firstElementChild);
    }
    SC.dom.chatBody.appendChild(frag);
    SC.dom.chatBody.scrollTop = SC.dom.chatBody.scrollHeight;
    // Post-process attachments (upgrade/fallback)
    for(const m of list){
      const node = SC.dom.chatBody.querySelector(`[data-msg-id="${m.id}"]`);
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
            SC.MessageStore.updateAttachment(dialogId, msg.id, att.id, { displayHint:'file' });
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
              SC.MessageStore.updateAttachment(dialogId, msg.id, att.id, { displayHint:'inline-image' });
            }, { once:true });
            testImg.addEventListener('error', ()=>{ /* stay in file mode */ }, { once:true });
            testImg.src = url;
        } catch(e){ /* silent */ }
      }
    }
  }

  function seedDemoMessages(){
    // If the first dialog already has messages — consider the seed done
    if(SC.MessageStore.getList(1).length) return;

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
    for(const dlg of SC.MOCK_DIALOGS){
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
      SC.MessageStore.ingestBatch(dlg.id, batch, { position:'append' });
    }
    console.log('[seedDemoMessages] Attachments summary:', { inlineImage: inlineImageCount, file: fileCount });
  }

  // Archive: message seed (lazy). We use more "historical" timestamps.
  function seedArchiveMessages(){
    if(SC.archiveSeeded) return;
    SC.archiveSeeded = true;
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
    for(const dlg of SC.ARCHIVE_DIALOGS){
      const base = now - (dlg.id - 1000) * day; // shift back by days
      const msgs = [
        { id: `a${dlg.id}m1`, dialogId: dlg.id, author: 'client', text: sampleClient[(dlg.id)%sampleClient.length], createdAt: new Date(base - 6*3600*1000).toISOString(), status:'sent' },
        { id: `a${dlg.id}m2`, dialogId: dlg.id, author: dlg.origin === 'bot' ? 'bot':'operator', text: sampleAgent[(dlg.id)%sampleAgent.length], createdAt: new Date(base - 5.5*3600*1000).toISOString(), status:'sent', attachments: (dlg.id % 2 === 0) ? [ { id:`a${dlg.id}f1`, name:`summary-${dlg.id}.pdf`, size:'180 KB', contentType:'application/pdf', displayHint:'file' } ] : undefined },
        { id: `a${dlg.id}m3`, dialogId: dlg.id, author: 'client', text: 'Подтверждаю закрытие и отсутствие проблем.', createdAt: new Date(base - 5*3600*1000).toISOString(), status:'sent' },
        { id: `a${dlg.id}m4`, dialogId: dlg.id, author: dlg.origin === 'bot' ? 'bot':'operator', text: 'Диалог переведён в архив.', createdAt: new Date(base - 4.5*3600*1000).toISOString(), status:'sent', attachments: (dlg.id % 3 === 0) ? [ { id:`a${dlg.id}img`, name:`final-${dlg.id}.png`, size:'90 KB', contentType:'image/png', url:`https://picsum.photos/seed/arch${dlg.id}/260/160`, displayHint:'inline-image' } ] : undefined }
      ];
      SC.MessageStore.ingestBatch(dlg.id, msgs, { position:'append' });
    }
    console.log('[seedArchiveMessages] seeded for', SC.ARCHIVE_DIALOGS.length, 'dialogs');
  }


  SC.escapeHtml = escapeHtml;
  SC.formatMsgDate = formatMsgDate;
  SC.buildAuthorIcon = buildAuthorIcon;
  SC.createAttachmentBlock = createAttachmentBlock;
  SC.isImageAttachment = isImageAttachment;
  SC.parseSizeToBytes = parseSizeToBytes;
  SC.isInlineImage = isInlineImage;
  SC.createInlineImageAttachment = createInlineImageAttachment;
  SC.createFileAttachment = createFileAttachment;
  SC.classifyAttachmentVariant = classifyAttachmentVariant;
  SC.buildAttachmentHtml = buildAttachmentHtml;
  SC.createMessageHtml = createMessageHtml;
  SC.appendMessageToDom = appendMessageToDom;
  SC.addMessage = addMessage;
  SC.renderMessagesForDialog = renderMessagesForDialog;
  SC.seedDemoMessages = seedDemoMessages;
  SC.seedArchiveMessages = seedArchiveMessages;
})();
