// inbox.js — Inbox functionality for Hippo Exchange
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const messagesList = document.getElementById('messages-list');
  const messagesEmpty = document.getElementById('messages-empty');
  const searchMessages = document.getElementById('search-messages');
  const messageHeader = document.getElementById('message-header');
  const messageContent = document.getElementById('message-content');
  const noMessageSelected = document.getElementById('no-message-selected');
  const replySection = document.getElementById('reply-section');
  const composeModal = document.getElementById('compose-modal');
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
  
  // Filter and state
  let activeFilter = 'all';
  let selectedMessageId = null;
  let searchQuery = '';
  
  // Storage keys
  const MESSAGES_KEY = 'inbox.messages';
  const READ_IDS_KEY = 'inbox.readIds';
  const STARRED_IDS_KEY = 'inbox.starredIds';
  
  // Sample messages data
  const sampleMessages = [
    {
      id: 'm1',
      from: 'Nalij',
      fromAvatar: 'hippo-exchange-logo.png',
      subject: 'Interested in your textbook listing',
      body: `Hi there! I saw your listing for the Calculus textbook and I'm very interested. Is it still available? I'm willing to pay the full asking price if it's in good condition. Let me know when we can arrange a pickup time. Thanks!`,
      timestamp: Date.now() - 2 * 60 * 1000, // 2 minutes ago
      type: 'offer',
      listingId: 'listing123'
    },
    {
      id: 'm2',
      from: 'Jane',
      fromAvatar: 'hippo-exchange-logo.png',
      subject: 'Re: Coffee table pickup',
      body: `Perfect! I can meet you at the campus center tomorrow at 2 PM. I'll bring exact change. See you then!`,
      timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
      type: 'arrangement',
      listingId: 'listing456'
    },
    {
      id: 'm3',
      from: 'System',
      fromAvatar: 'hippo-exchange-logo.png',
      subject: 'Your listing has expired',
      body: `Your listing "Vintage Guitar" has expired after 30 days. You can renew it from your profile page or create a new listing with updated details.`,
      timestamp: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
      type: 'system',
      listingId: null
    },
    {
      id: 'm4',
      from: 'Mike',
      fromAvatar: 'hippo-exchange-logo.png',
      subject: 'Question about bike condition',
      body: `Hey! I'm interested in the mountain bike you posted. Could you tell me more about its condition? Any scratches or mechanical issues? Also, would you be willing to negotiate on the price? Let me know!`,
      timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
      type: 'inquiry',
      listingId: 'listing789'
    },
    {
      id: 'm5',
      from: 'Sarah',
      fromAvatar: 'hippo-exchange-logo.png',
      subject: 'Thanks for the quick sale!',
      body: `Just wanted to say thanks for the smooth transaction. The desk is perfect for my dorm room. Great doing business with you!`,
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      type: 'feedback',
      listingId: 'listing321'
    }
  ];
  
  // Load data from localStorage or use sample data
  function loadMessages() {
    try {
      const stored = localStorage.getItem(MESSAGES_KEY);
      return stored ? JSON.parse(stored) : sampleMessages;
    } catch {
      return sampleMessages;
    }
  }
  
  function saveMessages(messages) {
    try {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save messages:', e);
    }
  }
  
  function loadReadIds() {
    try {
      const stored = localStorage.getItem(READ_IDS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  function saveReadIds(ids) {
    try {
      localStorage.setItem(READ_IDS_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn('Failed to save read IDs:', e);
    }
  }
  
  function loadStarredIds() {
    try {
      const stored = localStorage.getItem(STARRED_IDS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  function saveStarredIds(ids) {
    try {
      localStorage.setItem(STARRED_IDS_KEY, JSON.stringify(ids));
    } catch (e) {
      console.warn('Failed to save starred IDs:', e);
    }
  }
  
  // Utility functions
  function isRead(messageId) {
    return loadReadIds().includes(messageId);
  }
  
  function isStarred(messageId) {
    return loadStarredIds().includes(messageId);
  }
  
  function markAsRead(messageId) {
    const readIds = loadReadIds();
    if (!readIds.includes(messageId)) {
      readIds.push(messageId);
      saveReadIds(readIds);
    }
  }
  
  function toggleStar(messageId) {
    const starredIds = loadStarredIds();
    const index = starredIds.indexOf(messageId);
    if (index >= 0) {
      starredIds.splice(index, 1);
    } else {
      starredIds.push(messageId);
    }
    saveStarredIds(starredIds);
    return starredIds.includes(messageId);
  }
  
  function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  }
  
  function formatFullTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
  
  // Filter messages
  function filterMessages(messages) {
    let filtered = messages;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(msg => 
        msg.from.toLowerCase().includes(query) ||
        msg.subject.toLowerCase().includes(query) ||
        msg.body.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (activeFilter === 'unread') {
      filtered = filtered.filter(msg => !isRead(msg.id));
    } else if (activeFilter === 'starred') {
      filtered = filtered.filter(msg => isStarred(msg.id));
    }
    
    return filtered;
  }
  
  // Render messages list
  function renderMessagesList() {
    const messages = loadMessages();
    const filteredMessages = filterMessages(messages);
    
    messagesList.innerHTML = '';
    
    if (filteredMessages.length === 0) {
      messagesEmpty.classList.remove('hidden');
      return;
    }
    
    messagesEmpty.classList.add('hidden');
    
    // Sort messages by timestamp (newest first)
    filteredMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    filteredMessages.forEach(message => {
      const messageItem = createMessageListItem(message);
      messagesList.appendChild(messageItem);
    });
  }
  
  // Create message list item
  function createMessageListItem(message) {
    const li = document.createElement('li');
    const isUnread = !isRead(message.id);
    const starred = isStarred(message.id);
    const isSelected = selectedMessageId === message.id;
    
    li.className = `message-item cursor-pointer hover:bg-slate-50 transition-colors ${
      isSelected ? 'bg-blue-50 border-r-4 border-blue-500' : ''
    }`;
    li.dataset.messageId = message.id;
    
    li.innerHTML = `
      <div class="p-4 ${isUnread ? 'bg-blue-50/50' : ''}">
        <div class="flex items-start gap-3">
          <img src="${message.fromAvatar}" alt="${message.from}" class="w-10 h-10 rounded-full ring-2 ring-white/40 flex-shrink-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <p class="font-semibold text-slate-800 truncate ${isUnread ? 'text-slate-900' : ''}">${message.from}</p>
              <div class="flex items-center gap-2 flex-shrink-0">
                ${starred ? '<svg class="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>' : ''}
                <span class="text-xs text-slate-500">${formatTime(message.timestamp)}</span>
                ${isUnread ? '<span class="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
              </div>
            </div>
            <p class="text-sm font-medium text-slate-700 truncate mb-1 ${isUnread ? 'font-semibold' : ''}">${message.subject}</p>
            <p class="text-sm text-slate-600 line-clamp-2">${message.body.substring(0, 100)}${message.body.length > 100 ? '...' : ''}</p>
          </div>
        </div>
      </div>
    `;
    
    li.addEventListener('click', () => selectMessage(message.id));
    
    return li;
  }
  
  // Select and display a message
  function selectMessage(messageId) {
    selectedMessageId = messageId;
    markAsRead(messageId);
    
    const messages = loadMessages();
    const message = messages.find(m => m.id === messageId);
    
    if (!message) return;
    
    // Update UI selection
    document.querySelectorAll('.message-item').forEach(item => {
      item.classList.remove('bg-blue-50', 'border-r-4', 'border-blue-500');
    });
    
    const selectedItem = document.querySelector(`[data-message-id="${messageId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('bg-blue-50', 'border-r-4', 'border-blue-500');
    }
    
    // Show message content
    displayMessage(message);
    
    // Re-render list to update read status
    renderMessagesList();
  }
  
  // Display message content
  function displayMessage(message) {
    // Update header
    document.getElementById('sender-avatar').src = message.fromAvatar;
    document.getElementById('sender-name').textContent = message.from;
    document.getElementById('message-subject').textContent = message.subject;
    
    // Update star button
    const starButton = document.getElementById('star-message');
    const starSvg = starButton.querySelector('svg');
    if (isStarred(message.id)) {
      starSvg.classList.add('fill-current', 'text-yellow-500');
      starSvg.classList.remove('text-slate-400');
    } else {
      starSvg.classList.remove('fill-current', 'text-yellow-500');
      starSvg.classList.add('text-slate-400');
    }
    
    // Update content
    document.getElementById('message-body').innerHTML = `<p class="text-slate-700 leading-relaxed">${message.body.replace(/\n/g, '<br>')}</p>`;
    document.getElementById('message-meta').innerHTML = `
      <div class="flex items-center justify-between">
        <span>Sent ${formatFullTime(message.timestamp)}</span>
        ${message.listingId ? `<a href="./listing.html?id=${message.listingId}" class="text-blue-600 hover:underline text-sm">View related listing</a>` : ''}
      </div>
    `;
    
    // Show message sections
    messageHeader.classList.remove('hidden');
    messageContent.classList.remove('hidden');
    replySection.classList.remove('hidden');
    noMessageSelected.style.display = 'none';
  }
  
  // Hide message content
  function hideMessage() {
    selectedMessageId = null;
    messageHeader.classList.add('hidden');
    messageContent.classList.add('hidden');
    replySection.classList.add('hidden');
    noMessageSelected.style.display = 'flex';
    
    // Clear selection in list
    document.querySelectorAll('.message-item').forEach(item => {
      item.classList.remove('bg-blue-50', 'border-r-4', 'border-blue-500');
    });
  }
  
  // Event Listeners
  
  // Filter buttons
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      
      // Update button styles
      filterButtons.forEach(btn => {
        btn.classList.remove('bg-slate-900/80', 'text-white');
        btn.classList.add('bg-white/40', 'text-slate-900');
      });
      button.classList.remove('bg-white/40', 'text-slate-900');
      button.classList.add('bg-slate-900/80', 'text-white');
      
      renderMessagesList();
    });
  });
  
  // Search functionality
  searchMessages.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderMessagesList();
  });
  
  // Mark all as read
  document.getElementById('mark-all-read').addEventListener('click', () => {
    const messages = loadMessages();
    const allIds = messages.map(m => m.id);
    saveReadIds(allIds);
    renderMessagesList();
    if (selectedMessageId) {
      const message = messages.find(m => m.id === selectedMessageId);
      if (message) displayMessage(message);
    }
  });
  
  // Star message
  document.getElementById('star-message').addEventListener('click', () => {
    if (!selectedMessageId) return;
    
    const isNowStarred = toggleStar(selectedMessageId);
    const starSvg = document.getElementById('star-message').querySelector('svg');
    
    if (isNowStarred) {
      starSvg.classList.add('fill-current', 'text-yellow-500');
      starSvg.classList.remove('text-slate-400');
    } else {
      starSvg.classList.remove('fill-current', 'text-yellow-500');
      starSvg.classList.add('text-slate-400');
    }
    
    renderMessagesList();
  });
  
  // Delete message
  document.getElementById('delete-message').addEventListener('click', () => {
    if (!selectedMessageId) return;
    
    if (confirm('Are you sure you want to delete this message?')) {
      const messages = loadMessages();
      const updatedMessages = messages.filter(m => m.id !== selectedMessageId);
      saveMessages(updatedMessages);
      
      // Remove from read/starred lists
      const readIds = loadReadIds().filter(id => id !== selectedMessageId);
      const starredIds = loadStarredIds().filter(id => id !== selectedMessageId);
      saveReadIds(readIds);
      saveStarredIds(starredIds);
      
      hideMessage();
      renderMessagesList();
    }
  });
  
  // Reply functionality
  document.getElementById('send-reply').addEventListener('click', () => {
    const replyText = document.getElementById('reply-text').value.trim();
    if (!replyText || !selectedMessageId) return;
    
    // In a real app, this would send the reply to the server
    alert(`Reply sent: "${replyText}"`);
    document.getElementById('reply-text').value = '';
  });
  
  // Compose modal
  document.getElementById('compose-btn').addEventListener('click', () => {
    composeModal.classList.remove('hidden');
    composeModal.classList.add('flex');
  });
  
  document.getElementById('close-compose').addEventListener('click', () => {
    composeModal.classList.add('hidden');
    composeModal.classList.remove('flex');
  });
  
  document.getElementById('cancel-compose').addEventListener('click', () => {
    composeModal.classList.add('hidden');
    composeModal.classList.remove('flex');
  });
  
  document.getElementById('send-compose').addEventListener('click', () => {
    const to = document.getElementById('compose-to').value.trim();
    const subject = document.getElementById('compose-subject').value.trim();
    const body = document.getElementById('compose-message').value.trim();
    
    if (!to || !subject || !body) {
      alert('Please fill in all fields.');
      return;
    }
    
    // In a real app, this would send the message to the server
    alert(`Message sent to ${to}!`);
    
    // Clear form and close modal
    document.getElementById('compose-to').value = '';
    document.getElementById('compose-subject').value = '';
    document.getElementById('compose-message').value = '';
    composeModal.classList.add('hidden');
    composeModal.classList.remove('flex');
  });
  
  // Handle message from notification (URL parameter)
  const urlParams = new URLSearchParams(window.location.search);
  const messageId = urlParams.get('messageId');
  const notificationId = urlParams.get('from');
  
  if (messageId || notificationId) {
    // If coming from notification, select the specific message
    if (messageId) {
      setTimeout(() => selectMessage(messageId), 100);
    } else if (notificationId) {
      // Create a new message based on notification data
      const messages = loadMessages();
      const newMessage = {
        id: `msg_${Date.now()}`,
        from: notificationId,
        fromAvatar: 'hippo-exchange-logo.png',
        subject: decodeURIComponent(urlParams.get('subject') || 'New Message'),
        body: decodeURIComponent(urlParams.get('message') || 'You have a new message.'),
        timestamp: Date.now(),
        type: 'message',
        listingId: urlParams.get('listingId')
      };
      
      messages.unshift(newMessage);
      saveMessages(messages);
      setTimeout(() => {
        renderMessagesList();
        selectMessage(newMessage.id);
      }, 100);
    }
  }
  
  // Initial render
  renderMessagesList();
});