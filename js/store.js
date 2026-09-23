/* ====== State / Data Stores Module ======
   Mock dialog data, single app state, cached DOM references,
   normalized MessageStore and reply TemplatesStore.
   Shared context: window.SC (SupportChat).
*/
(function(){
  'use strict';
  const SC = window.SC = window.SC || {};

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

  // Shared mutable context fields
  SC.archiveSeeded = false;
  SC.dialogMenuAnchorBtn = null;

  SC.state = state;
  SC.dom = dom;
  SC.MOCK_DIALOGS = MOCK_DIALOGS;
  SC.ARCHIVE_DIALOGS = ARCHIVE_DIALOGS;
  SC.MessageStore = MessageStore;
})();
