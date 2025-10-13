// inbox.js — Production inbox wired to backend threads/messages
document.addEventListener('DOMContentLoaded', async () => {
  // ---- Config / API ----
  const API = location.origin;
  let currentUser = null;

  // Simple wrapper for backend API calls. Automatically attaches Authorization if token present.
  async function api(path, { method = 'GET', body } = {}) {
    const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}${path}`, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
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
  async function checkAuthAndLoadUser() {
    const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
    const userData = localStorage.getItem('hippo_user') || localStorage.getItem('userData');

    console.log('Auth check - Token:', !!token, 'UserData:', !!userData);

    if (!token || !userData) {
      console.log('No auth data found, redirecting to login');
      window.location.href = './Login.html';
      return;
    }

    try {
      const response = await fetch(`${API}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log('Auth validation failed, redirecting to login');
        clearAuthData();
        window.location.href = './Login.html';
        return;
      }

      const user = await response.json();
      console.log('Auth successful, user:', user);
      currentUser = user;
      displayUserInfo(user);
    } catch (error) {
      console.error('Auth error:', error);
      clearAuthData();
      window.location.href = './Login.html';
    }
  }

  function displayUserInfo(user) {
    const nameElement = document.getElementById('acct-name');
    const rankElement = document.getElementById('acct-rank');
    if (nameElement) {
      // show the user's email as the primary account label
      nameElement.textContent = user.email || user.username || user.name || 'User';
    }
    if (rankElement) {
      // always show the literal 'Member' as requested
      rankElement.textContent = 'Member';
    }
  }

  function clearAuthData() {
    localStorage.removeItem('hippo_token');
    localStorage.removeItem('hippo_user');
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
  }

  function signOut() {
    clearAuthData();
    window.location.href = './Login.html';
  }

  // Initialize auth
  await checkAuthAndLoadUser();

  // Use currentUser for the rest of the app
  const me = currentUser;
  if (!me || !me.id) {
    return; // Already redirected in checkAuthAndLoadUser
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

  // Compose modal removed: direct compose is disabled; messages are created via listings

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
  let activeFilter = 'all';        // 'all' | 'unread' | 'starred' | 'sent'
  let selectedThread = null;       // thread object - currently open thread
  let searchQuery = '';
  let threads = [];                // loaded from backend
  let messagesCache = new Map();   // threadId -> messages[] - avoid reloading if already fetched
  let userNamesCache = new Map();  // userId -> user name - cache user names

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

  // checks if thread has messages sent by current user
  async function hasSentMessages(t) {
    const msgs = await loadMessages(t.id);
    return msgs.some(m => m.senderId === me.id);
  }

  // fetch user name by ID
  async function getUserName(userId) {
    if (userNamesCache.has(userId)) {
      return userNamesCache.get(userId);
    }

    try {
      // Get user info from the users endpoint
      const response = await fetch(`${API}/users/by-id?id=${encodeURIComponent(userId)}`);

      if (response.ok) {
        const user = await response.json();

        // Prefer explicit display name if provided
        if (user && typeof user === 'object') {
          if (user.name && String(user.name).trim()) {
            const n = String(user.name).trim();
            userNamesCache.set(userId, n);
            return n;
          }

          // Safely compose first/last only when they are non-empty
          const fn = (user.firstName || user.FirstName || '') || '';
          const ln = (user.lastName || user.LastName || '') || '';
          const parts = [String(fn).trim(), String(ln).trim()].filter(Boolean);
          if (parts.length > 0) {
            const full = parts.join(' ');
            userNamesCache.set(userId, full);
            return full;
          }

          // Fall back to email
          if (user.email) {
            const e = String(user.email).trim();
            userNamesCache.set(userId, e);
            return e;
          }
        }

        // Final fallback
        userNamesCache.set(userId, 'User');
        return 'User';
      }
    } catch (error) {
      console.log('Could not fetch user name:', error);
    }

    // Fallback to showing user ID
    const fallbackName = `User ${userId.substring(0, 8)}...`;
    userNamesCache.set(userId, fallbackName);
    return fallbackName;
  }

  // returns a title for the thread (subject or recipient name)
  async function threadTitle(t) {
      // Prefer 'Requester Name - Item Title' where possible
      const subjectFromThread = t.subject || '';
      let listingTitle = '';
      const match = subjectFromThread.match(/Item Request:\s*(.*)/i) || subjectFromThread.match(/Item Request\s*-\s*(.*)/i);
      if (match && match[1]) listingTitle = match[1].trim();

      try {
        // Try to load earliest message and use its sender as requester
        const msgs = await loadMessages(t.id);
        if (Array.isArray(msgs) && msgs.length > 0) {
          const first = msgs[0];
          if (first && first.senderId) {
            const requester = await getUserName(first.senderId);
            if (requester && listingTitle) return `${requester} - ${listingTitle}`;
            if (requester) return requester;
          }
        }
      } catch (e) {
        // ignore and fall back
      }

      // Fallback to other participant name
      const participants = t.participants || t.Participants || [];
      const otherParticipantId = participants.find(p => p !== me.id);
      if (otherParticipantId) {
        const other = await getUserName(otherParticipantId);
        if (other && listingTitle) return `${other} - ${listingTitle}`;
        if (other) return other;
      }

      if (subjectFromThread) return subjectFromThread;
      return 'Conversation';
  }

  // ---- Backend calls ----

  async function loadThreads() {
    const data = await api(`/messages/threads?userId=${encodeURIComponent(me.id)}&filter=all`);
    threads = data.map(x => ({ id: x.id || x.Id, ...x }));
    await renderThreads();
  }

  async function loadMessages(threadId) {
    if (messagesCache.has(threadId)) return messagesCache.get(threadId);
    // Server exposes GET /messages/threads/{threadId}/messages which returns an array of messages
    const resp = await api(`/messages/threads/${encodeURIComponent(threadId)}/messages`);
    let msgs = [];
    if (!resp) msgs = [];
    else if (Array.isArray(resp)) msgs = resp;
    else msgs = resp.messages || resp.Messages || [];
    messagesCache.set(threadId, msgs);
    return msgs;
  }

  async function markThreadRead(threadId) {
    await api(`/messages/threads/${encodeURIComponent(threadId)}/read`, {
      method: 'POST',
      body: { userId: me.id }
    });
    const t = threads.find(x => (x.id || x.Id) === threadId);
    if (t) {
      (t.lastReadBy ||= {})[me.id] = new Date().toISOString();
      await renderThreads();
    }
  }

  async function toggleStar(thread, wantStar) {
    await api(`/messages/threads/${encodeURIComponent(thread.id)}/star`, {
      method: 'POST',
      body: { userId: me.id, starred: wantStar }
    });
    if (!thread.starredBy) thread.starredBy = [];
    if (wantStar) {
      if (!thread.starredBy.includes(me.id)) thread.starredBy.push(me.id);
    } else {
      thread.starredBy = thread.starredBy.filter(x => x !== me.id);
    }
    await renderThreads();
  }

  async function sendReply(thread, text) {
    await api(`/messages/threads/${encodeURIComponent(thread.id)}/messages`, {
      method: 'POST',
      body: { senderId: me.id, body: text }
    });
    messagesCache.delete(thread.id); // ensure next load is fresh
    await openThread(thread);        // refresh view
    await loadThreads();             // refresh list (preview/time)
  }

  // composeNew removed — direct compose disabled

  // ---- Rendering ----
  async function filterThreadsLocal(list) {
    let arr = [...list];
    // Filter type
    if (activeFilter === 'unread') arr = arr.filter(isUnread);
    else if (activeFilter === 'starred') arr = arr.filter(isStarred);
    else if (activeFilter === 'sent') {
      // For sent filter, we need to check each thread for sent messages
      const sentThreads = [];
      for (const t of arr) {
        if (await hasSentMessages(t)) {
          sentThreads.push(t);
        }
      }
      arr = sentThreads;
    }

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
  async function renderThreads() {
    messagesList.innerHTML = '';
    const list = await filterThreadsLocal(threads);

    if (list.length === 0) {
      messagesEmpty.classList.remove('hidden');
      return;
    }
    messagesEmpty.classList.add('hidden');

    for (const t of list) {
      const li = document.createElement('li');
      const unread = isUnread(t);
      const starred = isStarred(t);
      const title = await threadTitle(t);

      li.className = 'message-item cursor-pointer hover:bg-slate-50 transition-colors';
      li.dataset.threadId = t.id;

      li.innerHTML = `
        <div class="p-4 ${unread ? 'bg-blue-50/50' : ''}">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#2563eb]">💬</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <p class="font-semibold text-slate-800 truncate ${unread ? 'text-slate-900' : ''}">
                  ${escapeHtml(title)}
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
    // Build header: prefer "Requester Name - Item Name" when possible.
    const subjectFromThread = t.subject || '';
    let listingTitle = '';
    // If subject follows pattern like "Item Request: <Listing Title>" set by listing flow
    const match = subjectFromThread.match(/Item Request:\s*(.*)/i) || subjectFromThread.match(/Item Request\s*-\s*(.*)/i);
    if (match && match[1]) listingTitle = match[1].trim();

    // Load messages first so we can reliably identify the requester as the earliest message sender
    const msgs = await loadMessages(t.id);
    let requesterName = '';
    try {
      if (Array.isArray(msgs) && msgs.length > 0) {
        const first = msgs[0];
        if (first && first.senderId) {
          requesterName = await getUserName(first.senderId);
        }
      }
    } catch (e) {
      // ignore and continue to fallbacks
      console.debug('Could not resolve requester name from messages', e);
    }

    // If we couldn't resolve requester from messages, try the other participant as a fallback
    let otherName = '';
    if (!requesterName) {
      try {
        const participants = t.participants || t.Participants || [];
        const otherId = participants.find(p => p !== me.id);
        if (otherId) {
          otherName = await getUserName(otherId);
        }
      } catch (e) {
        // ignore
      }
    }

    if (requesterName && listingTitle) {
      senderNameEl.textContent = `${requesterName} - ${listingTitle}`;
      messageSubjectEl.textContent = subjectFromThread || '';
    } else if (otherName && listingTitle) {
      // fallback to other participant if requester not found
      senderNameEl.textContent = `${otherName} - ${listingTitle}`;
      messageSubjectEl.textContent = subjectFromThread || '';
    } else if (requesterName) {
      senderNameEl.textContent = requesterName;
      messageSubjectEl.textContent = subjectFromThread || '';
    } else if (otherName) {
      senderNameEl.textContent = otherName;
      messageSubjectEl.textContent = subjectFromThread || '';
    } else {
      // fallback to previous behavior
      const title = await threadTitle(t);
      senderNameEl.textContent = title;
      messageSubjectEl.textContent = subjectFromThread || '';
    }
    // Resolve sender names (avoid duplicate fetches by using a render-time cache)
    const renderNameCache = new Map();
    const messageHtmls = await Promise.all(msgs.map(async (m) => {
      const mine = m.senderId === me.id;
      let senderName = 'User';
      if (mine) {
        senderName = 'You';
      } else {
        if (renderNameCache.has(m.senderId)) {
          senderName = renderNameCache.get(m.senderId);
        } else {
          try {
            const nm = await getUserName(m.senderId);
            renderNameCache.set(m.senderId, nm);
            senderName = nm;
          } catch (e) {
            renderNameCache.set(m.senderId, `User ${m.senderId.substring(0, 8)}...`);
            senderName = renderNameCache.get(m.senderId);
          }
        }
      }

      return `
        <div class="mb-3 ${mine ? 'text-right' : 'text-left'}">
          <div class="text-[12px] text-slate-500 mb-1">${escapeHtml(senderName)}</div>
          <div class="inline-block rounded-xl px-3 py-2 ${mine ? 'bg-blue-600 text-white' : 'bg-white text-slate-800'}">
            ${escapeHtml(m.body)}
          </div>
          <div class="text-[11px] text-slate-500 mt-1">${fmtDate(m.sentUtc)}</div>
        </div>
      `;
    }));

    messageBodyEl.innerHTML = messageHtmls.join('');

    // Show participant names instead of IDs
    const participantNames = await Promise.all(
      (t.participants || []).map(async (participantId) => {
        if (participantId === me.id) {
          return 'You';
        }
        return await getUserName(participantId);
      })
    );
    messageMetaEl.textContent = `Participants: ${participantNames.join(', ')}`;

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
    button.addEventListener('click', async () => {
      activeFilter = button.dataset.filter || 'all';
      // Update button styles
      filterButtons.forEach(btn => {
        btn.classList.remove('bg-slate-900/80', 'text-white');
        btn.classList.add('bg-white/40', 'text-slate-900');
      });
      button.classList.remove('bg-white/40', 'text-slate-900');
      button.classList.add('bg-slate-900/80', 'text-white');
      await renderThreads();
    });
  });

  searchMessages.addEventListener('input', async (e) => {
    searchQuery = e.target.value || '';
    await renderThreads();
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
    // Delete conversation (not implemented) — keep placeholder for now
    alert('Delete conversation is not implemented yet.');
  });


  // Send a quick reply in the currently selected thread
  if (sendReplyBtn) {
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
  }

  // Compose-related handlers removed

  // ---- Sign out functionality ----
  const signOutLink = document.querySelector('a[href="./Login.html"]');
  if (signOutLink) {
    signOutLink.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
  }

  // ---- Initial load ----
  loadThreads().catch(err => console.error(err));
});