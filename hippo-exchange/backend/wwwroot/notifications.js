// notifications.js — Notifications functionality for Hippo Exchange
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const notifsList = document.getElementById('notifs-list');
  const emptyState = document.getElementById('empty-state');
  const markAllBtn = document.getElementById('mark-all');
  const clearReadBtn = document.getElementById('clear-read');
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
  
  // Filter and state
  let activeFilter = 'all';
  
  // Storage keys
  const NOTIFICATIONS_KEY = 'notifications.data';
  const READ_IDS_KEY = 'notifications.readIds';
  
  // Sample notifications data
  const sampleNotifications = [
    {
      id: 'n1',
      type: 'message',
      title: 'New message from Nalij',
      message: 'Hi! I\'m interested in your textbook listing. Is it still available?',
      timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
      from: 'Nalij',
      fromAvatar: 'hippo-exchange-logo.png',
      listingId: 'listing123',
      actionUrl: './inbox.html?messageId=m1'
    },
    {
      id: 'n2',
      type: 'offer',
      title: 'New offer on your listing',
      message: 'Jane made an offer of $45 for your coffee table',
      timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
      from: 'Jane',
      fromAvatar: 'hippo-exchange-logo.png',
      listingId: 'listing456',
      actionUrl: './listing.html?id=listing456'
    },
    {
      id: 'n3',
      type: 'system',
      title: 'Your listing has expired',
      message: 'Your listing "Vintage Guitar" has expired after 30 days. You can renew it from your profile page.',
      timestamp: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
      from: 'System',
      fromAvatar: 'hippo-exchange-logo.png',
      listingId: 'listing789',
      actionUrl: './profile.html'
    },
    {
      id: 'n4',
      type: 'message',
      title: 'Question about your bike',
      message: 'Mike asked: Could you tell me more about the bike\'s condition?',
      timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
      from: 'Mike',
      fromAvatar: 'hippo-exchange-logo.png',
      listingId: 'listing789',
      actionUrl: './inbox.html?messageId=m4'
    },
    {
      id: 'n5',
      type: 'offer',
      title: 'Offer accepted!',
      message: 'Sarah accepted your offer for the desk. Great doing business!',
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      from: 'Sarah',
      fromAvatar: 'hippo-exchange-logo.png',
      listingId: 'listing321',
      actionUrl: './listing.html?id=listing321'
    },
    {
      id: 'n6',
      type: 'system',
      title: 'Welcome to Hippo Exchange!',
      message: 'Thanks for joining! Complete your profile to get started.',
      timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      from: 'System',
      fromAvatar: 'hippo-exchange-logo.png',
      listingId: null,
      actionUrl: './profile.html'
    }
  ];
  
  // Load data from localStorage or use sample data
  function loadNotifications() {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      return stored ? JSON.parse(stored) : sampleNotifications;
    } catch {
      return sampleNotifications;
    }
  }
  
  function saveNotifications(notifications) {
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (e) {
      console.warn('Failed to save notifications:', e);
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
  
  // Utility functions
  function isRead(notificationId) {
    return loadReadIds().includes(notificationId);
  }
  
  function markAsRead(notificationId) {
    const readIds = loadReadIds();
    if (!readIds.includes(notificationId)) {
      readIds.push(notificationId);
      saveReadIds(readIds);
    }
  }
  
  function markAsUnread(notificationId) {
    const readIds = loadReadIds();
    const index = readIds.indexOf(notificationId);
    if (index >= 0) {
      readIds.splice(index, 1);
      saveReadIds(readIds);
    }
  }
  
  function toggleReadStatus(notificationId) {
    const readIds = loadReadIds();
    const index = readIds.indexOf(notificationId);
    if (index >= 0) {
      readIds.splice(index, 1);
    } else {
      readIds.push(notificationId);
    }
    saveReadIds(readIds);
    return !readIds.includes(notificationId);
  }
  
  function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
  
  function getNotificationIcon(type) {
    switch (type) {
      case 'message':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>`;
      case 'offer':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
        </svg>`;
      case 'system':
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;
      default:
        return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>`;
    }
  }
  
  function getNotificationColor(type) {
    switch (type) {
      case 'message':
        return 'text-blue-600 bg-blue-100';
      case 'offer':
        return 'text-green-600 bg-green-100';
      case 'system':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  }
  
  // Filter notifications
  function filterNotifications(notifications) {
    if (activeFilter === 'all') {
      return notifications;
    } else if (activeFilter === 'unread') {
      return notifications.filter(notif => !isRead(notif.id));
    } else {
      return notifications.filter(notif => notif.type === activeFilter);
    }
  }
  
  // Render notifications list
  function renderNotificationsList() {
    const notifications = loadNotifications();
    const filteredNotifications = filterNotifications(notifications);
    
    notifsList.innerHTML = '';
    
    if (filteredNotifications.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    
    // Sort notifications by timestamp (newest first)
    filteredNotifications.sort((a, b) => b.timestamp - a.timestamp);
    
    filteredNotifications.forEach(notification => {
      const notificationItem = createNotificationItem(notification);
      notifsList.appendChild(notificationItem);
    });
  }
  
  // Create notification item
  function createNotificationItem(notification) {
    const li = document.createElement('li');
    const isUnread = !isRead(notification.id);
    const colorClass = getNotificationColor(notification.type);
    
    li.className = `notification-item p-4 hover:bg-slate-50 transition-colors ${isUnread ? 'bg-blue-50/30' : ''}`;
    li.dataset.notificationId = notification.id;
    
    li.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 rounded-full ${colorClass} flex items-center justify-center">
            ${getNotificationIcon(notification.type)}
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <p class="font-semibold text-slate-800 truncate ${isUnread ? 'text-slate-900' : ''}">${notification.title}</p>
                ${isUnread ? '<span class="inline-block w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>' : ''}
              </div>
              <p class="text-sm text-slate-600 mb-2 line-clamp-2">${notification.message}</p>
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500">${formatTime(notification.timestamp)}</span>
                ${notification.from !== 'System' ? `<span class="text-xs text-slate-500">from ${notification.from}</span>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button class="toggle-read-btn p-2 rounded-full transition-all duration-200 ${isUnread ? 'bg-blue-100 hover:bg-blue-200 text-blue-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}" 
                      title="${isUnread ? 'Mark as read' : 'Mark as unread'}"
                      data-notification-id="${notification.id}">
                ${isUnread ? 
                  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' :
                  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add click handler for the main notification area (excluding the toggle button)
    const notificationContent = li.querySelector('.flex-1');
    notificationContent.addEventListener('click', (e) => {
      // Don't trigger if clicking on the toggle button
      if (e.target.closest('.toggle-read-btn')) return;
      
      markAsRead(notification.id);
      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }
      renderNotificationsList();
    });
    
    // Add click handler for the toggle read button
    const toggleBtn = li.querySelector('.toggle-read-btn');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the main click handler from firing
      const newReadStatus = toggleReadStatus(notification.id);
      renderNotificationsList();
    });
    
    return li;
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
      
      renderNotificationsList();
    });
  });
  
  // Mark all as read
  markAllBtn.addEventListener('click', () => {
    const notifications = loadNotifications();
    const allIds = notifications.map(n => n.id);
    saveReadIds(allIds);
    renderNotificationsList();
  });
  
  // Clear read notifications
  clearReadBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all read notifications?')) {
      const notifications = loadNotifications();
      const readIds = loadReadIds();
      const unreadNotifications = notifications.filter(n => !readIds.includes(n.id));
      saveNotifications(unreadNotifications);
      saveReadIds([]);
      renderNotificationsList();
    }
  });
  
  
  // Handle notification from URL parameter (if coming from another page)
  const urlParams = new URLSearchParams(window.location.search);
  const notificationId = urlParams.get('notificationId');
  
  if (notificationId) {
    // Mark the specific notification as read if it exists
    const notifications = loadNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      markAsRead(notificationId);
    }
  }
  
  // Initial render
  renderNotificationsList();
});

// Mobile menu functionality (shared with other pages)
document.addEventListener('DOMContentLoaded', () => {
  const menuButton = document.getElementById('menu-button');
  const closeMenuButton = document.getElementById('close-menu');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const iconHam = document.getElementById('icon-ham');

  function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    sidebarBackdrop.classList.remove('hidden');
    menuButton.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    sidebarBackdrop.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
  }

  menuButton?.addEventListener('click', openSidebar);
  closeMenuButton?.addEventListener('click', closeSidebar);
  sidebarBackdrop?.addEventListener('click', closeSidebar);

  // Close sidebar on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sidebar.classList.contains('-translate-x-full')) {
      closeSidebar();
    }
  });
});

// Signout functionality (shared with other pages)
document.addEventListener('DOMContentLoaded', () => {
  const signoutButton = document.querySelector('a[href="./Login.html"]');
  if (signoutButton) {
    signoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
  }
});

function signOut() {
  // Clear any stored authentication data
  localStorage.removeItem('userToken');
  localStorage.removeItem('userData');
  sessionStorage.removeItem('userToken');
  sessionStorage.removeItem('userData');
  
  // Clear any cookies (if using them for auth)
  document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Redirect to login page
  window.location.href = './Login.html';
}
