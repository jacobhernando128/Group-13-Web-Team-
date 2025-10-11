// inbox.js — Production inbox wired to backend threads/messages
document.addEventListener('DOMContentLoaded', () => {
  // ---- Config / API ----
  const API = location.origin;

  // Simple wrapper for backend API calls reads in user from localStorage
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      let msg = await res.text().catch(() => '');
      try { const j = JSON.parse(msg); msg = j.error || j.message || msg; } catch { }
      throw new Error(msg || `${res.status} ${res.statusText}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : null;
  }

  // ---- Auth / Current user ----
  let me = null;
  try { me = JSON.parse(localStorage.getItem('hippo_user') || 'null'); } catch { }
  if (!me || !me.id) {
    location.href = './Login.html';
    return;
  }

  // ---- DOM Elements ----
  // cache all elements used by the inbox UI 
  const messagesList = document.getElementById('messages-list');
  const messagesEmpty = document.getElementById('messages-empty');
  const searchMessages = document.getElementById('search-messages');
  const messageHeader = document.getElementById('message-header');
  const messageContent = document.getElementById('message-content');
  const noMessageSelected = document.getElementById('no-message-selected');
  const replySection = document.getElementById('reply-section');
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
  const markAllBtn = document.getElementById('mark-all-read');
  const starBtn = document.getElementById('star-message');
  const deleteBtn = document.getElementById('delete-message');
  const replyTextEl = document.getElementById('reply-text');
  const sendReplyBtn = document.getElementById('send-reply');

  // Compose modal
  const composeModal = document.getElementById('compose-modal');
  const composeBtn = document.getElementById('compose-btn');
  const closeComposeBtn = document.getElementById('close-compose');
  const cancelComposeBtn = document.getElementById('cancel-compose');
  const sendComposeBtn = document.getElementById('send-compose');
  const composeToEl = document.getElementById('compose-to');        // recipient email
  const composeSubjectEl = document.getElementById('compose-subject');
  const composeMessageEl = document.getElementById('compose-message');

  // Message header bits
  const senderAvatarEl = document.getElementById('sender-avatar');
  const senderNameEl = document.getElementById('sender-name');
  const messageSubjectEl = document.getElementById('message-subject');
  const messageBodyEl = document.getElementById('message-body');
  const messageMetaEl = document.getElementById('message-meta');

  // ---- Mobile menu slide in sidebar behavior (toggleMobileMenu, closeMobileMenu) ----
  const menuButton = document.getElementById('menu-button');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  function toggleMobileMenu() {
    const isOpen = sidebar.classList.contains('translate-x-0');
    if (isOpen) {
      sidebar.classList.remove('translate-x-0'); sidebar.classList.add('-translate-x-full');
      sidebarBackdrop.classList.add('hidden'); menuButton.setAttribute('aria-expanded', 'false');
    } else {
      sidebar.classList.remove('-translate-x-full'); sidebar.classList.add('translate-x-0');
      sidebarBackdrop.classList.remove('hidden'); menuButton.setAttribute('aria-expanded', 'true');
    }
  }
  function closeMobileMenu() {
    sidebar.classList.remove('translate-x-0'); sidebar.classList.add('-translate-x-full');
    sidebarBackdrop.classList.add('hidden'); menuButton.setAttribute('aria-expanded', 'false');
  }
  if (menuButton) menuButton.addEventListener('click', toggleMobileMenu);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileMenu);
  const navLinks = sidebar.querySelectorAll('a');
  navLinks.forEach(l => l.addEventListener('click', () => { if (window.innerWidth < 768) closeMobileMenu(); }));
  window.addEventListener('resize', () => { if (window.innerWidth >= 768) closeMobileMenu(); });

  // ---- State ----
  let activeFilter = 'all';        // 'all' | 'unread' | 'starred'
  let selectedThread = null;       // thread object - currently open thread
  let searchQuery = '';
  let threads = [];                // loaded from backend
  let messagesCache = new Map();   // threadId -> messages[] - avoid reloading if already fetched

  // ---- Utils ----
  function fmtDate(val) {
    const d = new Date(val);
    return d.toLocaleString();
  }
  function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // compares thread last read time for current user to updatedUtc
  function isUnread(t) {
    const last = (t.lastReadBy || {})[me.id];
    return !last || new Date(t.updatedUtc) > new Date(last);
  }

  //checkes thread starredBy array for current user id
  function isStarred(t) {
    return (t.starredBy || []).includes(me.id);
  }

  // returns a title for the thread (subject or fallback)
  function threadTitle(t) {
    return t.subject || 'Conversation';
  }

  // ---- Backend calls ----

  async function loadThreads() {
    const data = await api(`/inbox/threads?userId=${encodeURIComponent(me.id)}&filter=all`);
    threads = data.map(x => ({ id: x.id || x.Id, ...x }));
    renderThreads();
  }

  async function loadMessages(threadId) {
    if (messagesCache.has(threadId)) return messagesCache.get(threadId);
    const msgs = await api(`/inbox/threads/${encodeURIComponent(threadId)}/messages`);
    messagesCache.set(threadId, msgs);
    return msgs;
  }

  async function markThreadRead(threadId) {
    await api(`/inbox/threads/${encodeURIComponent(threadId)}/read`, {
      method: 'POST',
      body: { userId: me.id }
    });
    const t = threads.find(x => (x.id || x.Id) === threadId);
    if (t) {
      (t.lastReadBy ||= {})[me.id] = new Date().toISOString();
      renderThreads();
    }
  }

  async function toggleStar(thread, wantStar) {
    await api(`/inbox/threads/${encodeURIComponent(thread.id)}/star`, {
      method: 'POST',
      body: { userId: me.id, starred: wantStar }
    });
    if (!thread.starredBy) thread.starredBy = [];
    if (wantStar) {
      if (!thread.starredBy.includes(me.id)) thread.starredBy.push(me.id);
    } else {
      thread.starredBy = thread.starredBy.filter(x => x !== me.id);
    }
    renderThreads();
  }

  async function sendReply(thread, text) {
    await api(`/inbox/threads/${encodeURIComponent(thread.id)}/messages`, {
      method: 'POST',
      body: { senderId: me.id, body: text }
    });
    messagesCache.delete(thread.id); // ensure next load is fresh
    await openThread(thread);        // refresh view
    await loadThreads();             // refresh list (preview/time)
  }

  async function composeNew(toEmail, subject, body) {
    // resolve recipient by email -> userId
    const to = await api(`/users/by-email?email=${encodeURIComponent(toEmail)}`);
    const partIds = [me.id, to.id];

    // find or create thread
    const thread = await api('/inbox/threads', {
      method: 'POST',
      body: { participantIds: partIds, subject }
    });

    const threadId = thread.id || thread.Id;
    await api(`/inbox/threads/${encodeURIComponent(threadId)}/messages`, {
      method: 'POST',
      body: { senderId: me.id, body }
    });

    messagesCache.delete(threadId);
    await loadThreads();
    const t = threads.find(x => (x.id || x.Id) === threadId) || { id: threadId, ...thread };
    await openThread(t);
  }

  // ---- Rendering ----
  function filterThreadsLocal(list) {
    let arr = [...list];
    // Filter type
    if (activeFilter === 'unread') arr = arr.filter(isUnread);
    else if (activeFilter === 'starred') arr = arr.filter(isStarred);

    // Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      arr = arr.filter(t => {
        const hay = [t.subject || '', t.lastMessagePreview || ''].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    // sort by updated desc
    arr.sort((a, b) => new Date(b.updatedUtc) - new Date(a.updatedUtc));
    return arr;
  }

  //Builds the message list on the left side of the inbox
  function renderThreads() {
    messagesList.innerHTML = '';
    const list = filterThreadsLocal(threads);

    if (list.length === 0) {
      messagesEmpty.classList.remove('hidden');
      return;
    }
    messagesEmpty.classList.add('hidden');

    for (const t of list) {
      const li = document.createElement('li');
      const unread = isUnread(t);
      const starred = isStarred(t);

      li.className = 'message-item cursor-pointer hover:bg-slate-50 transition-colors';
      li.dataset.threadId = t.id;

      li.innerHTML = `
        <div class="p-4 ${unread ? 'bg-blue-50/50' : ''}">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#2563eb]">💬</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <p class="font-semibold text-slate-800 truncate ${unread ? 'text-slate-900' : ''}">
                  ${escapeHtml(threadTitle(t))}
                </p>
                <div class="flex items-center gap-2">
                  ${starred ? '<svg class="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>' : ''}
                  <span class="text-xs text-slate-500">${fmtDate(t.updatedUtc)}</span>
                  ${unread ? '<span class="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
                </div>
              </div>
              <p class="text-sm font-medium text-slate-700 truncate mb-1 ${unread ? 'font-semibold' : ''}">
                ${escapeHtml(t.subject || '(no subject)')}
              </p>
              <p class="text-sm text-slate-600 line-clamp-2">
                ${escapeHtml(t.lastMessagePreview || '')}
              </p>
            </div>
          </div>
        </div>
      `;
      li.addEventListener('click', () => openThread(t));
      messagesList.appendChild(li);
    }
  }

  async function openThread(t) {
    selectedThread = t;
    // header + sections
    messageHeader.classList.remove('hidden');
    messageContent.classList.remove('hidden');
    replySection.classList.remove('hidden');
    noMessageSelected.style.display = 'none';

    // header info
    senderAvatarEl.src = 'hippo-exchange-logo.png';
    senderNameEl.textContent = threadTitle(t);
    messageSubjectEl.textContent = t.subject || '';

    // messages
    const msgs = await loadMessages(t.id);
    messageBodyEl.innerHTML = msgs.map(m => {
      const mine = m.senderId === me.id;
      return `
        <div class="mb-3 ${mine ? 'text-right' : 'text-left'}">
          <div class="inline-block rounded-xl px-3 py-2 ${mine ? 'bg-blue-600 text-white' : 'bg-white text-slate-800'}">
            ${escapeHtml(m.body)}
          </div>
          <div class="text-[11px] text-slate-500 mt-1">${fmtDate(m.sentUtc)}</div>
        </div>
      `;
    }).join('');

    messageMetaEl.textContent = `Participants: ${(t.participants || []).join(', ')}`;

    // mark read
    try { await markThreadRead(t.id); } catch { }
  }

  function hideMessage() {
    selectedThread = null;
    messageHeader.classList.add('hidden');
    messageContent.classList.add('hidden');
    replySection.classList.add('hidden');
    noMessageSelected.style.display = 'flex';
    document.querySelectorAll('.message-item').forEach(it => {
      it.classList.remove('bg-blue-50', 'border-r-4', 'border-blue-500');
    });
  }

  // ---- Events ----
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter || 'all';
      // Update button styles
      filterButtons.forEach(btn => {
        btn.classList.remove('bg-slate-900/80', 'text-white');
        btn.classList.add('bg-white/40', 'text-slate-900');
      });
      button.classList.remove('bg-white/40', 'text-slate-900');
      button.classList.add('bg-slate-900/80', 'text-white');
      renderThreads();
    });
  });

  searchMessages.addEventListener('input', (e) => {
    searchQuery = e.target.value || '';
    renderThreads();
  });

  markAllBtn.addEventListener('click', async () => {
    await Promise.all(threads.map(t =>
      api(`/messages/threads/${encodeURIComponent(t.id)}/read`, {
        method: 'POST',
        body: { userId: me.id }
      }).catch(() => null)
    ));
    await loadThreads();
    if (selectedThread) {
      try { await openThread(selectedThread); } catch { }
    }
  });

  starBtn.addEventListener('click', async () => {
    if (!selectedThread) return;
    const starred = isStarred(selectedThread);
    await toggleStar(selectedThread, !starred);
  });

  deleteBtn.addEventListener('click', () => {
    alert('Delete conversation is not implemented yet.');
  });

  sendReplyBtn.addEventListener('click', async () => {
    const text = (replyTextEl.value || '').trim();
    if (!text || !selectedThread) return;
    try {
      await sendReply(selectedThread, text);
      replyTextEl.value = '';
    } catch (e) {
      alert(e.message || 'Failed to send reply.');
    }
  });

  // Compose modal
  function openCompose() { composeModal.classList.remove('hidden'); composeModal.classList.add('flex'); composeToEl.focus(); }
  function closeCompose() { composeModal.classList.add('hidden'); composeModal.classList.remove('flex'); composeToEl.value = ''; composeSubjectEl.value = ''; composeMessageEl.value = ''; }

  composeBtn.addEventListener('click', openCompose);
  closeComposeBtn.addEventListener('click', closeCompose);
  cancelComposeBtn.addEventListener('click', closeCompose);

  sendComposeBtn.addEventListener('click', async () => {
    const to = (composeToEl.value || '').trim().toLowerCase();
    const subject = (composeSubjectEl.value || '').trim();
    const body = (composeMessageEl.value || '').trim();
    if (!to || !body) {
      alert('Please enter recipient email and a message body.');
      return;
    }
    try {
      await composeNew(to, subject, body);
      closeCompose();
    } catch (e) {
      alert(e.message || 'Failed to send message.');
    }
  });

  // If linked from a notification with ?email=... you can pre-open a compose
  const url = new URL(location.href);
  const preEmail = url.searchParams.get('email');
  if (preEmail) {
    openCompose();
    composeToEl.value = preEmail;
  }

  // ---- Initial load ----
  loadThreads().catch(err => console.error(err));
});
