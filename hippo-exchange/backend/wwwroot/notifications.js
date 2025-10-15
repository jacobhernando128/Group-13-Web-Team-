// notifications.js — Notifications functionality for Hippo Exchange (Merged Version)

/**
 * SUPPORTED NOTIFICATION TYPES:
 * 
 * 1. message / messaged - User sent you a message
 * 2. maintenance_coming_up / maintenance_reminder - Upcoming maintenance reminder
 * 3. maintenance_done / maintenance_complete / maintenance_completed - Maintenance completed
 * 4. offer_request / offer_received / new_offer - Someone made an offer on your item
 * 5. offer_accepted / offer_approved - Your offer was accepted
 * 6. offer_sent / offer_submitted - Your offer was sent successfully
 * 7. exchange_request - Someone wants to borrow your item
 * 8. exchange_approved - Your borrow request was approved
 * 9. exchange_declined - Your borrow request was declined
 * 10. exchange_cancelled - Someone cancelled their borrow request
 * 
 * Backend should use these exact type strings when creating notifications.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ===== CONFIGURATION =====
    const API_BASE_URL = location.origin;

    // ===== AUTH CHECK =====
    let USER_ID = null;

    // Check authentication first
    const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
    const userData = localStorage.getItem('hippo_user') || localStorage.getItem('userData');

    if (!token || !userData) {
        console.log('❌ No authentication found, redirecting to login');
        window.location.href = './Login.html';
        return;
    }

    try {
        const user = JSON.parse(userData);
        USER_ID = user.Id || user.id;

        if (!USER_ID) {
            console.log('❌ No user ID found, redirecting to login');
            window.location.href = './Login.html';
            return;
        }

        console.log('✅ Authenticated as user:', USER_ID);
    } catch (err) {
        console.error('❌ Error parsing user data:', err);
        window.location.href = './Login.html';
        return;
    }

    // Storage keys for local read status tracking
    const READ_IDS_KEY = 'notifications.readIds';

    // DOM Elements
    const notifsList = document.getElementById('notifs-list');
    const emptyState = document.getElementById('empty-state');
    const markAllBtn = document.getElementById('mark-all');
    const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));

    // State
    let activeFilter = 'all';
    let notifications = [];
    let isLoading = false;

    // ===== LOCALSTORAGE FUNCTIONS FOR READ STATUS =====

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
        if (isRead(notificationId)) {
            markAsUnread(notificationId);
        } else {
            markAsRead(notificationId);
        }
    }

    function markAllAsRead() {
        const allIds = notifications.map(n => n.id);
        saveReadIds(allIds);
        renderNotificationsList();
    }

    // ===== API FUNCTIONS =====

    /**
     * Fetch all notifications for the current user from backend
     */
    async function fetchNotifications() {
        try {
            isLoading = true;
            showLoadingState();

            console.log('📥 Fetching notifications for user:', USER_ID);

            const res = await fetch(`${API_BASE_URL}/notifications/receiver/${USER_ID}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch notifications: ${res.status}`);
            }

            const data = await res.json();
            console.log('✅ Notifications fetched:', data);

            // Transform backend data to match UI expectations and fetch sender info
            const transformedNotifications = await Promise.all(data.map(async n => {
                let senderName = 'User';
                let senderAvatar = 'hippo-exchange-logo.png';
                let itemTitle = 'item';

                // Fetch sender info
                if (n.senderId || n.SenderId) {
                    const senderId = n.senderId || n.SenderId;
                    try {
                        const senderRes = await fetch(`${API_BASE_URL}/users/${senderId}`);
                        if (senderRes.ok) {
                            const sender = await senderRes.json();
                            senderName = `${sender.firstName || sender.FirstName || ''} ${sender.lastName || sender.LastName || ''}`.trim() || sender.email || sender.Email || 'User';
                            senderAvatar = sender.profilePicture || sender.ProfilePicture || senderAvatar;
                        }
                    } catch (err) {
                        console.warn('Could not fetch sender info:', err);
                    }
                }

                // Fetch item info if listingId exists
                const listingId = n.listingId || n.ListingId || n.listingID || n.ListingID;
                if (listingId) {
                    try {
                        const itemRes = await fetch(`${API_BASE_URL}/items/${listingId}`);
                        if (itemRes.ok) {
                            const item = await itemRes.json();
                            itemTitle = item.title || item.Title || 'item';
                        }
                    } catch (err) {
                        console.warn('Could not fetch item info:', err);
                    }
                }

                // Format notification based on type
                const notifType = (n.type || n.Type || '').toLowerCase();
                const formatted = formatNotificationByType(notifType, senderName, itemTitle, n);

                return {
                    id: n.id || n.Id,
                    type: notifType,
                    title: formatted.title,
                    message: formatted.message,
                    timestamp: new Date(n.createdUtc || n.CreatedUtc).getTime(),
                    senderId: n.senderId || n.SenderId,
                    senderName: senderName,
                    senderAvatar: senderAvatar,
                    listingId: listingId,
                    actionUrl: formatted.actionUrl || generateActionUrl(n),
                    isRead: isRead(n.id || n.Id),
                    dismissed: n.dismissed || n.Dismissed || false
                };
            }));

            // Filter out dismissed notifications
            notifications = transformedNotifications.filter(n => !n.dismissed);
            renderNotificationsList();

        } catch (err) {
            console.error('❌ Error fetching notifications:', err);
            showError('Failed to load notifications. Please try again.');
        } finally {
            isLoading = false;
        }
    }

    /**
     * Format notification based on type using switch case
     */
    function formatNotificationByType(type, senderName, itemTitle, notification) {
        const senderId = notification.senderId || notification.SenderId;
        const listingId = notification.listingId || notification.ListingId || notification.listingID || notification.ListingID;

        switch (type) {
            case 'message':
            case 'messaged':
                return {
                    title: `New message from ${senderName}`,
                    message: `${senderName} sent you a message. Click to view the conversation.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'maintenance_coming_up':
            case 'maintenance_reminder':
                return {
                    title: `Maintenance Reminder`,
                    message: `Your ${itemTitle} has upcoming maintenance scheduled. Click to view details.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'maintenance_done':
            case 'maintenance_complete':
            case 'maintenance_completed':
                return {
                    title: `Maintenance Complete`,
                    message: `Maintenance on your ${itemTitle} has been completed successfully.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'offer_request':
            case 'offer_received':
            case 'new_offer':
                return {
                    title: `New Offer Received`,
                    message: `${senderName} made an offer on your ${itemTitle}. Check your exchanges to review.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'offer_accepted':
            case 'offer_approved':
                return {
                    title: `Offer Accepted! 🎉`,
                    message: `Great news! Your offer for ${itemTitle} has been accepted. Click here to message ${senderName} for details`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'offer_sent':
            case 'offer_submitted':
                return {
                    title: `Offer Sent`,
                    message: `Your offer for ${itemTitle} has been sent successfully. You'll be notified when the owner responds.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'exchange_request':
                return {
                    title: `Borrow Request`,
                    message: `${senderName} has requested to borrow your ${itemTitle}. Check your exchanges to approve or decline.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'exchange_approved':
                return {
                    title: `Request Approved! 🎉`,
                    message: `Great news! ${senderName} has approved your request to borrow ${itemTitle}. Click to message them to arrange pickup.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'exchange_declined':
                return {
                    title: `Request Declined`,
                    message: `${senderName} has declined your request to borrow ${itemTitle}. Browse other items or contact them for more information.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'exchange_cancelled':
                return {
                    title: `Request Cancelled`,
                    message: `${senderName} has cancelled their request for your ${itemTitle}. The request has been withdrawn.`,
                    actionUrl: `./asset-hub.html`
                };

            default:
                // Fallback to original notification data
                return {
                    title: notification.title || notification.Title || 'New Notification',
                    message: notification.message || notification.Message || 'You have a new notification.',
                    actionUrl: listingId ? `./listing.html?id=${listingId}` : './profile.html'
                };
        }
    }

    /**
     * Generate action URL based on notification type
     */
    function generateActionUrl(notification) {
        const type = (notification.type || notification.Type || '').toLowerCase();
        const senderId = notification.senderId || notification.SenderId;
        const listingId = notification.listingId || notification.ListingId || notification.listingID || notification.ListingID;

        switch (type) {
            case 'message':
            case 'messaged':
                return `./inbox.html?userId=${senderId}`;
            case 'offer_request':
            case 'offer_received':
            case 'new_offer':
            case 'offer_accepted':
            case 'offer_approved':
            case 'exchange_request':
            case 'exchange_approved':
            case 'exchange_declined':
                return `./listing.html?id=${listingId}`;
            case 'exchange_cancelled':
                return './asset-hub.html';
            default:
                return listingId ? `./listing.html?id=${listingId}` : './profile.html';
        }
    }

    // ===== UTILITY FUNCTIONS =====

    function formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }

    function getNotificationIcon(type) {
        switch (type) {
            case 'message':
            case 'messaged':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>`;

            case 'offer_request':
            case 'offer_received':
            case 'new_offer':
            case 'offer_accepted':
            case 'offer_approved':
            case 'offer_sent':
            case 'offer_submitted':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
        </svg>`;

            case 'maintenance_coming_up':
            case 'maintenance_reminder':
            case 'maintenance_done':
            case 'maintenance_complete':
            case 'maintenance_completed':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>`;

            case 'exchange_request':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
        </svg>`;

            case 'exchange_approved':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;

            case 'exchange_declined':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;

            case 'exchange_cancelled':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
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
            case 'messaged':
                return 'text-blue-600 bg-blue-100';

            case 'offer_request':
            case 'offer_received':
            case 'new_offer':
            case 'offer_sent':
            case 'offer_submitted':
                return 'text-green-600 bg-green-100';

            case 'offer_accepted':
            case 'offer_approved':
                return 'text-emerald-600 bg-emerald-100';

            case 'maintenance_coming_up':
            case 'maintenance_reminder':
                return 'text-yellow-600 bg-yellow-100';

            case 'maintenance_done':
            case 'maintenance_complete':
            case 'maintenance_completed':
                return 'text-teal-600 bg-teal-100';

            case 'exchange_request':
                return 'text-indigo-600 bg-indigo-100';

            case 'exchange_approved':
                return 'text-emerald-600 bg-emerald-100';

            case 'exchange_declined':
                return 'text-red-600 bg-red-100';

            case 'exchange_cancelled':
                return 'text-orange-600 bg-orange-100';

            default:
                return 'text-slate-600 bg-slate-100';
        }
    }

    // ===== UI FUNCTIONS =====

    function showLoadingState() {
        notifsList.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    `;
        emptyState.classList.add('hidden');
    }

    function showError(message) {
        notifsList.innerHTML = `
      <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
        <p class="text-red-800 mb-3">${message}</p>
        <button onclick="location.reload()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
          Retry
        </button>
      </div>
    `;
        emptyState.classList.add('hidden');
    }

    /**
     * Filter notifications based on active filter
     */
    function filterNotifications(notifications) {
        if (activeFilter === 'all') {
            return notifications;
        } else if (activeFilter === 'unread') {
            return notifications.filter(notif => !notif.isRead);
        } else if (activeFilter === 'message') {
            return notifications.filter(notif =>
                notif.type === 'message' ||
                notif.type === 'messaged'
            );
        } else if (activeFilter === 'exchange_request') {
            return notifications.filter(notif => notif.type === 'exchange_request');
        } else if (activeFilter === 'exchange_cancelled') {
            return notifications.filter(notif => notif.type === 'exchange_cancelled');
        } else if (activeFilter === 'offer') {
            return notifications.filter(notif =>
                notif.type === 'offer_request' ||
                notif.type === 'offer_received' ||
                notif.type === 'new_offer' ||
                notif.type === 'offer_accepted' ||
                notif.type === 'offer_approved' ||
                notif.type === 'offer_sent' ||
                notif.type === 'offer_submitted' ||
                notif.type === 'exchange_request' ||
                notif.type === 'exchange_approved' ||
                notif.type === 'exchange_declined'
            );
        } else if (activeFilter === 'system') {
            return notifications.filter(notif =>
                notif.type === 'maintenance_coming_up' ||
                notif.type === 'maintenance_reminder' ||
                notif.type === 'maintenance_done' ||
                notif.type === 'maintenance_complete' ||
                notif.type === 'maintenance_completed'
            );
        } else {
            return notifications.filter(notif => notif.type === activeFilter);
        }
    }

    /**
     * Render the notifications list
     */
    function renderNotificationsList() {
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

    /**
     * Create a single notification item element
     */
    function createNotificationItem(notification) {
        const li = document.createElement('li');
        const isUnread = !notification.isRead;
        const colorClass = getNotificationColor(notification.type);

        li.className = `notification-item p-4 hover:bg-slate-50 transition-colors ${isUnread ? 'bg-blue-50/30' : ''}`;
        li.dataset.notificationId = notification.id;

        // Profile picture - use otheruser.html
        const avatarHtml = `<a href="./otheruser.html?userId=${notification.senderId}" class="profile-link" title="View ${notification.senderName}'s profile">
        <img src="${notification.senderAvatar}" 
             alt="${notification.senderName}" 
             class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm hover:shadow-md transition-shadow"
             onerror="this.onerror=null; this.src='hippo-exchange-logo.png';">
      </a>`;

        li.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          ${avatarHtml}
        </div>
        <div class="flex-1 min-w-0 notification-content cursor-pointer">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <p class="font-semibold text-slate-800 truncate ${isUnread ? 'text-slate-900' : ''}">${notification.title}</p>
                ${isUnread ? '<span class="inline-block w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>' : ''}
              </div>
              <p class="text-sm text-slate-600 mb-2 line-clamp-2">${notification.message}</p>

            ${notification.type === 'exchange_request' ? `
              <div class="flex gap-2 mt-2">
                <button class="accept-btn px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition"
                        data-item-id="${notification.listingId}"
                        data-borrower-id="${notification.senderId}"
                        data-notification-id="${notification.id}">
                  Accept
                </button>
                <button class="decline-btn px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
                        data-item-id="${notification.listingId}"
                        data-borrower-id="${notification.senderId}"
                        data-notification-id="${notification.id}">
                  Decline
                </button>
              </div>
            ` : ''}

              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500">${formatTime(notification.timestamp)}</span>
                <span class="text-xs text-slate-500">from ${notification.senderName}</span>
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

        // Add click handler for the main notification area (excluding profile link, toggle button, and accept/decline buttons)
        const notificationContent = li.querySelector('.notification-content');
        notificationContent.addEventListener('click', (e) => {
            // Don't trigger if clicking on the toggle button, profile link, or accept/decline buttons
            if (e.target.closest('.toggle-read-btn') ||
                e.target.closest('.profile-link') ||
                e.target.closest('.accept-btn') ||
                e.target.closest('.decline-btn')) return;

            // Mark as read and navigate
            markAsRead(notification.id);

            if (notification.actionUrl) {
                window.location.href = notification.actionUrl;
            }
        });

        // Add click handler for profile link (prevent propagation)
        const profileLink = li.querySelector('.profile-link');
        if (profileLink) {
            profileLink.addEventListener('click', (e) => {
                e.stopPropagation();
                markAsRead(notification.id);
                // Link will navigate naturally to otheruser.html
            });
        }

        // Add click handler for the toggle read button
        const toggleBtn = li.querySelector('.toggle-read-btn');
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReadStatus(notification.id);
            // Update the notification's isRead status in the array
            notification.isRead = !notification.isRead;
            renderNotificationsList();
        });

        return li;
    }

    // ===== EXCHANGE REQUEST ACTION HANDLERS =====
    notifsList.addEventListener('click', async (e) => {
        const acceptBtn = e.target.closest('.accept-btn');
        const declineBtn = e.target.closest('.decline-btn');

        if (!acceptBtn && !declineBtn) return;

        e.stopPropagation();

        const btn = acceptBtn || declineBtn;

        // Prevent double-clicks
        if (btn.disabled) return;

        const isAccept = Boolean(acceptBtn);
        const itemId = btn.dataset.itemId;
        const borrowerId = btn.dataset.borrowerId;
        const notificationId = btn.dataset.notificationId;

        console.log(`🎯 ${isAccept ? 'Accept' : 'Decline'} clicked for item: ${itemId}, borrower: ${borrowerId}`);

        // Disable buttons immediately
        const containerLi = btn.closest('li');
        const acceptEl = containerLi?.querySelector('.accept-btn');
        const declineEl = containerLi?.querySelector('.decline-btn');
        acceptEl?.setAttribute('disabled', 'true');
        declineEl?.setAttribute('disabled', 'true');

        // Show loading state on buttons
        if (isAccept && acceptEl) {
            acceptEl.innerHTML = 'Processing...';
        } else if (!isAccept && declineEl) {
            declineEl.innerHTML = 'Processing...';
        }

        try {
            // STEP 1: Find the exchange
            console.log('📥 Fetching exchanges for owner:', USER_ID);
            const exRes = await fetch(`${API_BASE_URL}/exchanges/owner/${USER_ID}`);
            if (!exRes.ok) throw new Error('Failed to load exchanges');

            const exchanges = await exRes.json();
            console.log('📦 Exchanges:', exchanges);

            const exchange = exchanges.find(ex => {
                const exItem = ex.itemId || ex.ItemId || ex.itemID || ex.ItemID;
                const exBorrower = ex.borrowerId || ex.BorrowerId || ex.borrowerID || ex.BorrowerID;
                return String(exItem) === String(itemId) && String(exBorrower) === String(borrowerId);
            });

            if (!exchange) {
                throw new Error('Exchange not found.');
            }

            const exchangeId = exchange.id || exchange.Id;
            console.log('✅ Found exchange:', exchangeId);

            // STEP 2: Update exchange (approve/decline)
            const approvalBody = isAccept
                ? {
                    approved: true,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                }
                : { approved: false };

            console.log('📤 Updating exchange:', approvalBody);

            const putRes = await fetch(`${API_BASE_URL}/exchanges/${exchangeId}/approval`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(approvalBody)
            });

            if (!putRes.ok) {
                const errorText = await putRes.text();
                throw new Error(`Failed to update exchange: ${errorText}`);
            }

            console.log('✅ Exchange updated (backend will send notification to borrower automatically)');

            // STEP 3: Dismiss the original exchange_request notification
            console.log('🗑️ Dismissing original notification:', notificationId);
            try {
                const dismissRes = await fetch(`${API_BASE_URL}/notifications/${notificationId}/dismiss`, {
                    method: 'PUT'
                });

                if (dismissRes.ok) {
                    console.log('✅ Original notification dismissed');
                } else {
                    console.warn('⚠️ Failed to dismiss notification');
                }
            } catch (dismissErr) {
                console.warn('⚠️ Could not dismiss original notification:', dismissErr);
            }

            // STEP 4: Show success message
            if (containerLi) {
                const messageEl = document.createElement('div');
                messageEl.className = `mt-2 p-2 rounded text-sm ${isAccept ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`;
                messageEl.textContent = isAccept
                    ? '✓ Request accepted! Notification sent to borrower.'
                    : '✓ Request declined. Notification sent to borrower.';
                containerLi.querySelector('.notification-content').appendChild(messageEl);

                // Remove buttons
                const btnContainer = containerLi.querySelector('.accept-btn')?.parentElement;
                if (btnContainer) {
                    btnContainer.remove();
                }
            }

            // STEP 5: Refresh the notifications list after a short delay
            console.log('🔄 Refreshing notifications in 2 seconds...');
            setTimeout(() => {
                fetchNotifications();
            }, 2000);

            console.log('✅ All done!');

        } catch (err) {
            console.error('❌ Error:', err);
            alert(`Failed to ${isAccept ? 'accept' : 'decline'} request: ${err.message}`);

            // Re-enable buttons and restore text on error
            if (acceptEl) {
                acceptEl.removeAttribute('disabled');
                acceptEl.innerHTML = 'Accept';
            }
            if (declineEl) {
                declineEl.removeAttribute('disabled');
                declineEl.innerHTML = 'Decline';
            }
        }
    });

    // ===== EVENT LISTENERS =====

    // Filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            activeFilter = button.dataset.filter;

            console.log('📊 Filter changed to:', activeFilter);

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
    markAllBtn?.addEventListener('click', () => {
        markAllAsRead();
    });

    // Handle notification from URL parameter (if coming from another page)
    const urlParams = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notificationId');

    if (notificationId) {
        // Mark the specific notification as read after data loads
        setTimeout(() => {
            const notification = notifications.find(n => n.id === notificationId);
            if (notification) {
                markAsRead(notificationId);
                renderNotificationsList();
            }
        }, 500);
    }

    // ===== INITIALIZATION =====
    console.log('✅ Notifications page initialized');
    console.log('🔑 User ID:', USER_ID);
    fetchNotifications();

    // Auto-refresh notifications every 30 seconds
    setInterval(() => {
        if (!isLoading) {
            console.log('🔄 Auto-refreshing notifications...');
            fetchNotifications();
        }
    }, 30000);
});

// ===== MOBILE MENU FUNCTIONALITY =====
document.addEventListener('DOMContentLoaded', () => {
    const menuButton = document.getElementById('menu-button');
    const closeMenuButton = document.getElementById('close-menu');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    function openSidebar() {
        sidebar?.classList.remove('-translate-x-full');
        sidebar?.classList.add('translate-x-0');
        sidebarBackdrop?.classList.remove('hidden');
        menuButton?.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
        sidebar?.classList.add('-translate-x-full');
        sidebar?.classList.remove('translate-x-0');
        sidebarBackdrop?.classList.add('hidden');
        menuButton?.setAttribute('aria-expanded', 'false');
    }

    menuButton?.addEventListener('click', openSidebar);
    closeMenuButton?.addEventListener('click', closeSidebar);
    sidebarBackdrop?.addEventListener('click', closeSidebar);

    // Close sidebar on navigation links
    const navLinks = sidebar?.querySelectorAll('a') || [];
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                closeSidebar();
            }
        });
    });

    // Close sidebar on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && !sidebar.classList.contains('-translate-x-full')) {
            closeSidebar();
        }
    });

    // Close sidebar on window resize to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            closeSidebar();
        }
    });
});

// ===== SIGNOUT FUNCTIONALITY =====
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
    // Clear ALL stored authentication data
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('hippo_user');
    localStorage.removeItem('hippo_token');
    sessionStorage.removeItem('userToken');
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('hippo_user');
    sessionStorage.removeItem('hippo_token');

    // Clear any cookies (if using them for auth)
    document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'hippo_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'hippo_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Redirect to login page
    window.location.href = './Login.html';
}