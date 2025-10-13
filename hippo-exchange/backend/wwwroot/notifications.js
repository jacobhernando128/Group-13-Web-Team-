// notifications.js — Notifications functionality for Hippo Exchange (API-integrated)

/*
 * NOTIFICATION CREATION GUIDE
 * ===========================
 * This file DISPLAYS notifications. To complete the notification system, you need to CREATE
 * notifications in other parts of your app. Below are code snippets for each required notification type:
 * 
 * 1. ✅ EXCHANGE REQUEST (Already implemented elsewhere)
 *    When: User requests to borrow an item
 *    Code: After POST /exchanges succeeds
 *    ```
 *    await fetch(`${API_BASE}/notifications`, {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({
 *        senderId: borrowerId,
 *        receiverId: ownerId,
 *        title: 'New Item Request',
 *        message: `${borrowerName} wants to borrow your item "${itemTitle}"`,
 *        type: 'exchange_request',
 *        listingId: itemId
 *      })
 *    });
 *    ```
 * 
 * 2. ✅ REQUEST APPROVED/DENIED (Already implemented in this file)
 *    When: Owner approves or denies a request
 *    Location: handleExchangeAction() function in this file
 * 
 * 3. ❌ MESSAGE RECEIVED
 *    When: User receives a new message
 *    Location: After POST /messages/threads/{threadId}/messages succeeds (in inbox.js or messaging code)
 *    Code:
 *    ```
 *    await fetch(`${API_BASE}/notifications`, {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({
 *        senderId: currentUserId,
 *        receiverId: otherUserId,  // The person receiving the message
 *        title: 'New Message',
 *        message: `${senderName} sent you a message`,
 *        type: 'message',
 *        listingId: itemId  // Optional: if message is about a specific item
 *      })
 *    });
 *    ```
 * 
 * 4. ❌ MAINTENANCE COMING UP
 *    When: Maintenance is due soon (e.g., within 7 days)
 *    Location: In a scheduled job or when user views asset hub
 *    Code:
 *    ```
 *    // Check all maintenance records for items owned by user
 *    const dueDate = new Date(maintenance.lastMaintenanceDate);
 *    dueDate.setDate(dueDate.getDate() + maintenance.frequency);
 *    const daysUntilDue = Math.floor((dueDate - new Date()) / (1000 * 60 * 60 * 24));
 *    
 *    if (daysUntilDue <= 7 && daysUntilDue > 0) {
 *      await fetch(`${API_BASE}/notifications`, {
 *        method: 'POST',
 *        headers: { 'Content-Type': 'application/json' },
 *        body: JSON.stringify({
 *          senderId: 'system',
 *          receiverId: ownerId,
 *          title: 'Maintenance Due Soon',
 *          message: `Maintenance for "${itemTitle}" is due in ${daysUntilDue} days`,
 *          type: 'maintenance_due',
 *          listingId: itemId
 *        })
 *      });
 *    }
 *    ```
 * 
 * 5. ❌ MAINTENANCE COMPLETED
 *    When: User marks maintenance as done
 *    Location: After updating maintenance record (in asset hub or maintenance code)
 *    Code:
 *    ```
 *    // After PUT /maintenance/{id} with new completion date
 *    await fetch(`${API_BASE}/notifications`, {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({
 *        senderId: 'system',
 *        receiverId: ownerId,
 *        title: 'Maintenance Completed',
 *        message: `Maintenance for "${itemTitle}" has been marked as complete`,
 *        type: 'maintenance_complete',
 *        listingId: itemId
 *      })
 *    });
 *    ```
 * 
 * 6. ❌ OFFER SENT
 *    When: User makes an offer on an item (if you have an offer system)
 *    Location: After creating an offer (if different from exchange)
 *    Code:
 *    ```
 *    await fetch(`${API_BASE}/notifications`, {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({
 *        senderId: offererId,
 *        receiverId: ownerId,
 *        title: 'New Offer Received',
 *        message: `${offererName} made an offer on your item "${itemTitle}"`,
 *        type: 'offer_sent',
 *        listingId: itemId
 *      })
 *    });
 *    ```
 * 
 * 7. ❌ OFFER ACCEPTED
 *    When: Owner accepts an offer
 *    Location: After accepting an offer
 *    Code:
 *    ```
 *    await fetch(`${API_BASE}/notifications`, {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({
 *        senderId: ownerId,
 *        receiverId: offererId,
 *        title: 'Offer Accepted!',
 *        message: `${ownerName} accepted your offer for "${itemTitle}"`,
 *        type: 'offer_accepted',
 *        listingId: itemId
 *      })
 *    });
 *    ```
 * 
 * NOTE: Replace API_BASE with: const API_BASE = window.location.origin;
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const notifsList = document.getElementById('notifs-list');
    const emptyState = document.getElementById('empty-state');
    const markAllBtn = document.getElementById('mark-all');
    const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));

    // API base URL
    const API_BASE = window.location.origin;

    // Filter and state
    let activeFilter = 'all';
    let showCleared = false; // Toggle for showing cleared notifications

    // Storage keys
    const CLEARED_IDS_KEY = 'notifications.clearedIds';

    // Cleared notification management
    function loadClearedIds() {
        try {
            const stored = localStorage.getItem(CLEARED_IDS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    function saveClearedIds(ids) {
        try {
            localStorage.setItem(CLEARED_IDS_KEY, JSON.stringify(ids));
        } catch (e) {
            console.warn('Failed to save cleared IDs:', e);
        }
    }

    function isCleared(notificationId) {
        return loadClearedIds().includes(notificationId);
    }

    function markAsCleared(notificationId) {
        const clearedIds = loadClearedIds();
        if (!clearedIds.includes(notificationId)) {
            clearedIds.push(notificationId);
            saveClearedIds(clearedIds);
        }
    }

    function unmarkCleared(notificationId) {
        const clearedIds = loadClearedIds();
        const index = clearedIds.indexOf(notificationId);
        if (index >= 0) {
            clearedIds.splice(index, 1);
            saveClearedIds(clearedIds);
        }
    }

    function clearAllReadNotifications() {
        const readNotifications = notifications.filter(n => n.dismissed);
        readNotifications.forEach(n => markAsCleared(n.id));
    }
    let notifications = [];

    // Get current user ID from localStorage or session
    function getCurrentUserId() {
        try {
            // Try multiple possible storage keys (including hippo_user which your app uses!)
            const possibleKeys = ['hippo_user', 'userData', 'currentUser', 'user', 'authUser', 'userInfo'];

            for (const key of possibleKeys) {
                const userData = localStorage.getItem(key) || sessionStorage.getItem(key);

                if (userData) {
                    try {
                        const user = JSON.parse(userData);
                        console.log(`✓ Found user data in '${key}':`, user);

                        // Check multiple possible property names
                        const userId = user.Id || user.id || user.ID || user.userId || user.user_id;

                        if (userId) {
                            console.log('✓ Extracted user ID:', userId);
                            return userId;
                        }
                    } catch (parseError) {
                        console.warn(`Failed to parse userData from key '${key}':`, parseError);
                    }
                }
            }

            // Also check if there's a global user object set by home.js
            if (window.currentUser) {
                console.log('Found window.currentUser:', window.currentUser);
                const userId = window.currentUser.Id || window.currentUser.id || window.currentUser.ID;
                if (userId) {
                    console.log('✓ Found user ID from window.currentUser:', userId);
                    return userId;
                }
            }

        } catch (e) {
            console.error('Error getting user ID:', e);
        }

        console.warn('⚠ No user ID found in storage');
        return null;
    }

    // Fetch notifications from API
    async function fetchNotifications() {
        const userId = getCurrentUserId();
        if (!userId) {
            console.error('No user ID found - user may not be logged in');
            showEmptyState('Please log in to view notifications');
            return [];
        }

        console.log('Fetching notifications for user:', userId);

        try {
            const url = `${API_BASE}/notifications/receiver/${userId}`;
            console.log('Fetching from:', url);

            const response = await fetch(url);
            console.log('Notifications API response status:', response.status);

            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.status}`);
            }

            const data = await response.json();
            console.log('Fetched notifications:', data);

            // Transform API data to match our notification format
            return data.map(notif => ({
                id: notif.id,
                type: notif.type || 'system',
                title: notif.title || 'Notification',
                message: notif.message || '',
                timestamp: new Date(notif.createdUtc).getTime(),
                from: 'User',
                fromAvatar: notif.senderAvatar || 'hippo-exchange-logo.png',
                listingId: notif.listingId || null,
                senderId: notif.senderId || null,
                dismissed: notif.dismissed || false,
                exchangeId: notif.exchangeId || null,  // Include exchangeId if present
                actionUrl: determineActionUrl(notif)
            }));
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    }

    // Determine action URL based on notification type
    function determineActionUrl(notif) {
        const type = notif.type?.toLowerCase() || '';

        // Message notifications
        if (type.includes('message')) {
            return `./inbox.html`;
        }
        // Exchange/request notifications
        else if (type.includes('exchange') || type.includes('request')) {
            return `./listing.html?id=${notif.listingId || ''}`;
        }
        // Offer notifications
        else if (type.includes('offer')) {
            return `./listing.html?id=${notif.listingId || ''}`;
        }
        // Maintenance notifications
        else if (type.includes('maintenance')) {
            return `./asset-hub.html?itemId=${notif.listingId || ''}`;
        }
        // Default to item listing if we have one
        else if (notif.listingId) {
            return `./listing.html?id=${notif.listingId}`;
        }
        return './Home.html';
    }

    // Fetch sender's profile picture from API
    async function fetchUserProfilePicture(userId) {
        if (!userId) return null;

        try {
            const response = await fetch(`${API_BASE}/users/${userId}/profile-picture`);
            if (!response.ok) return null;

            const data = await response.json();
            return data.profilePicture || null;
        } catch (error) {
            console.error('Error fetching user profile picture:', error);
            return null;
        }
    }

    // Fetch sender's name from API
    async function fetchUserName(userId) {
        if (!userId) return 'User';

        try {
            const response = await fetch(`${API_BASE}/users/by-id?id=${userId}`);
            if (!response.ok) return 'User';

            const data = await response.json();
            return data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'User';
        } catch (error) {
            console.error('Error fetching user name:', error);
            return 'User';
        }
    }

    // Dismiss notification via API
    async function dismissNotification(notificationId) {
        try {
            const response = await fetch(`${API_BASE}/notifications/${notificationId}/dismiss`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to dismiss notification: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Error dismissing notification:', error);
            return false;
        }
    }

    // Mark all notifications as dismissed
    async function dismissAllNotifications() {
        const userId = getCurrentUserId();
        if (!userId) return;

        const undismissedNotifs = notifications.filter(n => !n.dismissed);

        try {
            // Dismiss all notifications in parallel
            await Promise.all(
                undismissedNotifs.map(notif => dismissNotification(notif.id))
            );

            // Refresh the notifications list
            await loadAndRenderNotifications();
        } catch (error) {
            console.error('Error dismissing all notifications:', error);
        }
    }

    // Handle exchange approval/decline
    async function handleExchangeAction(notificationId, exchangeId, approved) {
        try {
            const actionText = approved ? 'approve' : 'decline';
            console.log(`Attempting to ${actionText} exchange:`, exchangeId);

            const body = { approved };

            // If approving, need to provide dates
            if (approved) {
                // Default: start today, end in 7 days
                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 7);

                // You could also prompt the user for dates here
                body.startDate = startDate.toISOString();
                body.endDate = endDate.toISOString();
            }

            const response = await fetch(`${API_BASE}/exchanges/${exchangeId}/approval`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to ${actionText} exchange: ${response.status} - ${errorText}`);
            }

            const updatedExchange = await response.json();
            console.log(`Exchange ${actionText}ed successfully:`, updatedExchange);

            // Dismiss the notification
            await dismissNotification(notificationId);

            // Create notification for borrower
            await createBorrowerNotification(updatedExchange, approved);

            // Refresh notifications list
            await loadAndRenderNotifications();

            // Show success message
            alert(`Exchange ${actionText}ed successfully!`);

            return true;
        } catch (error) {
            console.error(`Error ${approved ? 'approving' : 'declining'} exchange:`, error);
            alert(`Failed to ${approved ? 'approve' : 'decline'} exchange: ${error.message}`);
            return false;
        }
    }

    // Create notification for borrower after approval/decline
    async function createBorrowerNotification(exchange, approved) {
        try {
            const currentUser = getCurrentUserId();
            const currentUserData = JSON.parse(localStorage.getItem('hippo_user') || '{}');
            const ownerName = `${currentUserData.firstName || ''} ${currentUserData.lastName || ''}`.trim() || 'The owner';

            await fetch(`${API_BASE}/notifications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    senderId: exchange.ownerId || currentUser,
                    receiverId: exchange.borrowerId,
                    title: approved ? 'Request Approved!' : 'Request Declined',
                    message: approved
                        ? `${ownerName} approved your exchange request. Check your exchanges for details.`
                        : `${ownerName} declined your exchange request.`,
                    type: approved ? 'exchange_approved' : 'exchange_declined',
                    listingId: exchange.itemId
                })
            });

            console.log('Borrower notification created');
        } catch (error) {
            console.error('Failed to create borrower notification:', error);
        }
    }

    // Fetch exchange ID for a notification
    async function getExchangeIdForNotification(notification) {
        try {
            // If the notification already has exchangeId, use it
            if (notification.exchangeId) {
                return notification.exchangeId;
            }

            const currentUserId = getCurrentUserId();
            if (!currentUserId) return null;

            // Fetch exchanges where current user is the owner
            const response = await fetch(`${API_BASE}/exchanges/owner/${currentUserId}`);
            if (!response.ok) return null;

            const exchanges = await response.json();

            // Find exchange matching this notification
            // Match by: borrowerId (sender), itemId, and not yet handled
            const matchingExchange = exchanges.find(ex =>
                ex.borrowerId === notification.senderId &&
                ex.itemId === notification.listingId &&
                !ex.requestHandled
            );

            return matchingExchange?.id || null;
        } catch (error) {
            console.error('Error fetching exchange ID:', error);
            return null;
        }
    }

    // Utility functions
    function isRead(notification) {
        return notification.dismissed || false;
    }

    async function toggleReadStatus(notificationId) {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) return false;

        // If already dismissed, we can't "un-dismiss" via the API
        // So we'll just mark it as dismissed if it's not already
        if (!notification.dismissed) {
            const success = await dismissNotification(notificationId);
            if (success) {
                notification.dismissed = true;
                return true;
            }
        }
        return false;
    }

    function formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        // For older notifications, show the actual date
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function getNotificationIcon(type) {
        const typeStr = (type || '').toLowerCase();

        // Message notifications
        if (typeStr.includes('message')) {
            return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>`;
        }
        // Exchange/Request notifications
        else if (typeStr.includes('exchange') || typeStr.includes('request')) {
            return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
      </svg>`;
        }
        // Approval notifications
        else if (typeStr.includes('approved') || typeStr.includes('accepted')) {
            return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>`;
        }
        // Denial notifications
        else if (typeStr.includes('denied') || typeStr.includes('rejected') || typeStr.includes('declined')) {
            return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>`;
        }
        // Offer notifications
        else if (typeStr.includes('offer')) {
            return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>`;
        }
        // Maintenance notifications
        else if (typeStr.includes('maintenance')) {
            return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>`;
        }
        // Default notification icon
        else {
            return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
      </svg>`;
        }
    }

    function getNotificationColor(type) {
        const typeStr = (type || '').toLowerCase();

        // Message notifications
        if (typeStr.includes('message')) {
            return 'text-blue-600 bg-blue-100';
        }
        // Approval/Success notifications
        else if (typeStr.includes('approved') || typeStr.includes('accepted') || typeStr.includes('done') || typeStr.includes('complete')) {
            return 'text-green-600 bg-green-100';
        }
        // Denial/Error notifications
        else if (typeStr.includes('denied') || typeStr.includes('rejected') || typeStr.includes('declined')) {
            return 'text-red-600 bg-red-100';
        }
        // Exchange/Request notifications
        else if (typeStr.includes('exchange') || typeStr.includes('request')) {
            return 'text-purple-600 bg-purple-100';
        }
        // Offer notifications
        else if (typeStr.includes('offer')) {
            return 'text-emerald-600 bg-emerald-100';
        }
        // Maintenance notifications
        else if (typeStr.includes('maintenance')) {
            return 'text-orange-600 bg-orange-100';
        }
        // Default
        else {
            return 'text-slate-600 bg-slate-100';
        }
    }

    // Filter notifications
    function filterNotifications(notificationsList) {
        // First filter by cleared status (unless showCleared is true)
        let filtered = showCleared
            ? notificationsList
            : notificationsList.filter(notif => !isCleared(notif.id));

        // Then apply additional filters
        if (activeFilter === 'all') {
            return filtered;
        } else if (activeFilter === 'unread') {
            return filtered.filter(notif => !isRead(notif));
        } else {
            // Filter by type
            return filtered.filter(notif => {
                const type = (notif.type || '').toLowerCase();
                // Handle filter matching
                if (activeFilter === 'messages') {
                    return type.includes('message');
                } else if (activeFilter === 'offers') {
                    return type.includes('offer');
                } else if (activeFilter === 'system') {
                    return type.includes('maintenance') || type.includes('system');
                } else {
                    return type.includes(activeFilter);
                }
            });
        }
    }

    // Show empty state with custom message
    function showEmptyState(message = null) {
        emptyState.classList.remove('hidden');
        if (message) {
            const emptyMessage = emptyState.querySelector('p');
            if (emptyMessage) {
                emptyMessage.textContent = message;
            }
        }

        // Add hint about cleared notifications if applicable
        const clearedCount = loadClearedIds().length;
        if (clearedCount > 0 && !showCleared) {
            const emptyMessage = emptyState.querySelector('p');
            if (emptyMessage) {
                emptyMessage.innerHTML += `<br><span class="text-xs text-slate-500 mt-2 block">You have ${clearedCount} cleared notification${clearedCount > 1 ? 's' : ''}. Click "Mark all read" to view options.</span>`;
            }
        }
    }

    // Render notifications list
    async function renderNotificationsList() {
        const filteredNotifications = filterNotifications(notifications);

        notifsList.innerHTML = '';

        if (filteredNotifications.length === 0) {
            const clearedCount = loadClearedIds().length;
            let message = activeFilter === 'unread' ? 'No unread notifications' : 'No notifications yet';

            if (clearedCount > 0 && !showCleared) {
                message = 'All notifications cleared';
            }

            showEmptyState(message);
            return;
        }

        emptyState.classList.add('hidden');

        // Sort notifications by timestamp (newest first)
        filteredNotifications.sort((a, b) => b.timestamp - a.timestamp);

        // Fetch sender names and profile pictures for all notifications
        const senderIds = [...new Set(filteredNotifications.map(n => n.senderId).filter(Boolean))];
        const senderData = new Map();

        await Promise.all(
            senderIds.map(async (senderId) => {
                const name = await fetchUserName(senderId);
                const profilePicture = await fetchUserProfilePicture(senderId);
                senderData.set(senderId, { name, profilePicture });
            })
        );

        filteredNotifications.forEach(notification => {
            // Update from name and profile picture if we have it
            if (notification.senderId && senderData.has(notification.senderId)) {
                const data = senderData.get(notification.senderId);
                notification.from = data.name;
                notification.fromAvatar = data.profilePicture || notification.fromAvatar;
            }

            const notificationItem = createNotificationItem(notification);
            notifsList.appendChild(notificationItem);
        });
    }

    // Create notification item
    function createNotificationItem(notification) {
        const li = document.createElement('li');
        const isUnread = !isRead(notification);
        const cleared = isCleared(notification.id);
        const colorClass = getNotificationColor(notification.type);
        const isExchangeRequest = (notification.type || '').toLowerCase().includes('request');

        li.className = `notification-item p-4 hover:bg-slate-50 transition-colors ${!isExchangeRequest ? 'cursor-pointer' : ''} ${isUnread && !cleared ? 'bg-blue-50/30' : ''} ${cleared ? 'opacity-60' : ''}`;
        li.dataset.notificationId = notification.id;

        li.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <a href="./otheruser.html?userId=${notification.senderId || ''}" 
             class="profile-link block hover:opacity-80 transition-opacity"
             ${!notification.senderId ? 'style="pointer-events: none;"' : ''}
             title="View ${notification.from}'s profile">
            ${notification.fromAvatar && notification.fromAvatar !== 'hippo-exchange-logo.png' ? `
              <img src="${notification.fromAvatar}" 
                   alt="${notification.from}" 
                   class="w-10 h-10 rounded-full object-cover border-2 border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="w-10 h-10 rounded-full ${colorClass} items-center justify-center" style="display:none;">
                ${getNotificationIcon(notification.type)}
              </div>
            ` : `
              <div class="w-10 h-10 rounded-full ${colorClass} flex items-center justify-center">
                ${getNotificationIcon(notification.type)}
              </div>
            `}
          </a>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <p class="font-semibold text-slate-800 truncate ${isUnread ? 'text-slate-900' : ''}">${notification.title}</p>
                ${isUnread && !cleared ? '<span class="inline-block w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>' : ''}
                ${cleared ? '<span class="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">Cleared</span>' : ''}
              </div>
              <p class="text-sm text-slate-600 mb-2 line-clamp-2">${notification.message}</p>
              
              ${isExchangeRequest && !cleared ? `
                <div class="flex items-center gap-2 mb-2">
                  <button class="accept-btn px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                          data-notification-id="${notification.id}">
                    Accept
                  </button>
                  <button class="decline-btn px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                          data-notification-id="${notification.id}">
                    Decline
                  </button>
                </div>
              ` : ''}
              
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500">${formatTime(notification.timestamp)}</span>
                ${notification.from !== 'System' ? `<span class="text-xs text-slate-500">from ${notification.from}</span>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              ${!cleared ? `
                <button class="clear-btn p-2 rounded-full transition-all duration-200 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600" 
                        title="Clear notification"
                        data-notification-id="${notification.id}">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
                <button class="toggle-read-btn p-2 rounded-full transition-all duration-200 ${isUnread ? 'bg-blue-100 hover:bg-blue-200 text-blue-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-400'}" 
                        title="${isUnread ? 'Mark as read' : 'Already read'}"
                        data-notification-id="${notification.id}"
                        ${!isUnread ? 'disabled' : ''}>
                  ${isUnread ?
                    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' :
                    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
                }
                </button>
              ` : `
                <button class="restore-btn p-2 rounded-full transition-all duration-200 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600" 
                        title="Restore notification"
                        data-notification-id="${notification.id}">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

        // Add click handler for the main notification area
        const notificationContent = li.querySelector('.flex-1');
        notificationContent.addEventListener('click', async (e) => {
            // Don't trigger if clicking on buttons or profile link
            if (e.target.closest('.toggle-read-btn') ||
                e.target.closest('.accept-btn') ||
                e.target.closest('.decline-btn') ||
                e.target.closest('.clear-btn') ||
                e.target.closest('.restore-btn') ||
                e.target.closest('.profile-link')) return;

            // Mark as read
            if (!notification.dismissed) {
                await toggleReadStatus(notification.id);
                await loadAndRenderNotifications();
            }

            // Navigate to action URL (but not if cleared)
            if (notification.actionUrl && !cleared) {
                window.location.href = notification.actionUrl;
            }
        });

        // Add click handler for the toggle read button
        const toggleBtn = li.querySelector('.toggle-read-btn');
        toggleBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!notification.dismissed) {
                await toggleReadStatus(notification.id);
                await loadAndRenderNotifications();
            }
        });

        // Add click handler for clear button
        const clearBtn = li.querySelector('.clear-btn');
        clearBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            markAsCleared(notification.id);
            await loadAndRenderNotifications();
        });

        // Add click handler for restore button
        const restoreBtn = li.querySelector('.restore-btn');
        restoreBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            unmarkCleared(notification.id);
            await loadAndRenderNotifications();
        });

        // Add click handlers for Accept/Decline buttons
        if (isExchangeRequest) {
            const acceptBtn = li.querySelector('.accept-btn');
            const declineBtn = li.querySelector('.decline-btn');

            acceptBtn?.addEventListener('click', async (e) => {
                e.stopPropagation();
                acceptBtn.disabled = true;
                declineBtn.disabled = true;
                acceptBtn.textContent = 'Processing...';

                const exchangeId = await getExchangeIdForNotification(notification);
                if (!exchangeId) {
                    alert('Could not find the exchange request. It may have already been handled.');
                    await loadAndRenderNotifications();
                    return;
                }

                const success = await handleExchangeAction(notification.id, exchangeId, true);
                if (success) {
                    // Auto-clear the notification after accepting
                    markAsCleared(notification.id);
                }
            });

            declineBtn?.addEventListener('click', async (e) => {
                e.stopPropagation();
                acceptBtn.disabled = true;
                declineBtn.disabled = true;
                declineBtn.textContent = 'Processing...';

                const exchangeId = await getExchangeIdForNotification(notification);
                if (!exchangeId) {
                    alert('Could not find the exchange request. It may have already been handled.');
                    await loadAndRenderNotifications();
                    return;
                }

                const success = await handleExchangeAction(notification.id, exchangeId, false);
                if (success) {
                    // Auto-clear the notification after declining
                    markAsCleared(notification.id);
                }
            });
        }

        return li;
    }

    // Load and render notifications with retry
    async function loadAndRenderNotifications(retryCount = 0) {
        const userId = getCurrentUserId();

        // If no user ID and we haven't retried too many times, wait and retry
        if (!userId && retryCount < 3) {
            console.log(`No user ID yet, retrying in 500ms (attempt ${retryCount + 1}/3)...`);
            setTimeout(() => loadAndRenderNotifications(retryCount + 1), 500);
            return;
        }

        notifications = await fetchNotifications();
        await renderNotificationsList();
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
    markAllBtn?.addEventListener('click', async () => {
        await dismissAllNotifications();
    });

    // Handle notification from URL parameter (if coming from another page)
    const urlParams = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notificationId');

    if (notificationId) {
        // Mark the specific notification as read
        dismissNotification(notificationId).then(() => {
            loadAndRenderNotifications();
        });
    } else {
        // Initial load
        loadAndRenderNotifications();
    }

    // Auto-refresh notifications every 30 seconds
    setInterval(loadAndRenderNotifications, 30000);
});

// Mobile menu functionality (shared with other pages)
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

    // Close sidebar on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && !sidebar.classList.contains('-translate-x-full')) {
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
    // Clear any stored authentication data - including hippo_user and hippo_token
    localStorage.removeItem('hippo_user');
    localStorage.removeItem('hippo_token');
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    sessionStorage.removeItem('hippo_user');
    sessionStorage.removeItem('hippo_token');
    sessionStorage.removeItem('userToken');
    sessionStorage.removeItem('userData');

    // Clear any cookies (if using them for auth)
    document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Redirect to login page
    window.location.href = './Login.html';
}

/* 
 * NOTIFICATION SYSTEM STATUS
 * ==========================
 * 
 * ✅ COMPLETED IN THIS FILE:
 * - Display all notification types (message, exchange, offer, maintenance, system)
 * - Profile pictures clickable → otheruser.html
 * - Accept/Decline buttons for exchange requests
 * - Auto-create notifications when accepting/declining exchanges
 * - Clear/restore notification functionality
 * - Mark as read functionality
 * - Filter by type (All, Unread, Messages, Offers, System)
 * - Auto-refresh every 30 seconds
 * 
 * ❌ TODO IN OTHER FILES:
 * See the NOTIFICATION CREATION GUIDE at the top of this file for code snippets.
 * You need to add notification creation in:
 * 1. inbox.js or messaging code → Create "message" notifications
 * 2. asset-hub.js or maintenance code → Create "maintenance_due" and "maintenance_complete" notifications
 * 3. listing.js or offer code → Create "offer_sent" and "offer_accepted" notifications
 * 
 * Each notification needs:
 * - senderId: User ID who triggered the notification
 * - receiverId: User ID who should receive the notification
 * - title: Short title (e.g., "New Message")
 * - message: Detailed message text
 * - type: notification type (e.g., "message", "maintenance_due", "offer_sent")
 * - listingId: Item ID related to the notification (optional but recommended)
 */