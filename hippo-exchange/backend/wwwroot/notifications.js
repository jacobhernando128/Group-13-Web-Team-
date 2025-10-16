// notifications.js — Notifications functionality for Hippo Exchange (Merged Version)

/**
 * COMPREHENSIVE NOTIFICATION TYPES FOR HIPPO EXCHANGE:
 * 
 * === MESSAGING NOTIFICATIONS ===
 * 1. message / messaged - User sent you a message
 * 2. message_received - New message received in conversation
 * 3. conversation_started - New conversation thread started
 * 
 * === EXCHANGE NOTIFICATIONS ===
 * 4. exchange_request - Someone wants to borrow your item
 * 5. exchange_approved - Your borrow request was approved
 * 6. exchange_declined - Your borrow request was declined
 * 7. exchange_cancelled - Someone cancelled their borrow request
 * 8. exchange_started - Exchange period has begun
 * 9. exchange_completed - Exchange period has ended successfully
 * 10. exchange_overdue - Item is overdue for return
 * 11. exchange_returned - Item has been returned
 * 12. exchange_disputed - Exchange dispute reported
 * 
 * === OFFER NOTIFICATIONS ===
 * 13. offer_request / offer_received / new_offer - Someone made an offer on your item
 * 14. offer_accepted / offer_approved - Your offer was accepted
 * 15. offer_declined - Your offer was declined
 * 16. offer_sent / offer_submitted - Your offer was sent successfully
 * 17. offer_cancelled - Offer was cancelled
 * 18. offer_expired - Offer has expired
 * 
 * === MAINTENANCE NOTIFICATIONS ===
 * 19. maintenance_coming_up / maintenance_reminder - Upcoming maintenance reminder
 * 20. maintenance_done / maintenance_complete / maintenance_completed - Maintenance completed
 * 21. maintenance_overdue - Maintenance is overdue
 * 22. maintenance_scheduled - Maintenance has been scheduled
 * 23. maintenance_cancelled - Maintenance was cancelled
 * 
 * === RETURN & REMINDER NOTIFICATIONS ===
 * 24. return_reminder - Return date reminder for borrowed items
 * 25. return_due_today - Item is due for return today
 * 26. return_overdue - Item is overdue for return
 * 27. return_confirmed - Return has been confirmed by owner
 * 28. return_disputed - Return is being disputed
 * 
 * === USER & PROFILE NOTIFICATIONS ===
 * 29. profile_updated - Your profile has been updated
 * 30. profile_picture_updated - Your profile picture has been updated
 * 31. account_verified - Your account has been verified
 * 32. account_suspended - Your account has been suspended
 * 33. account_reactivated - Your account has been reactivated
 * 
 * === ITEM NOTIFICATIONS ===
 * 34. item_listed - You successfully listed a new item
 * 35. item_updated - Your item listing has been updated
 * 36. item_deleted - Your item listing has been deleted
 * 37. item_featured - Your item has been featured
 * 38. item_reported - Your item has been reported
 * 39. item_flagged - Your item has been flagged for review
 * 
 * === REVIEW NOTIFICATIONS ===
 * 40. review_received - You received a new review
 * 41. review_updated - A review of you has been updated
 * 42. review_deleted - A review of you has been deleted
 * 43. review_reported - A review of you has been reported
 * 
 * === SYSTEM NOTIFICATIONS ===
 * 44. system_maintenance - System maintenance scheduled
 * 45. system_update - System has been updated
 * 46. system_announcement - Important system announcement
 * 47. system_warning - System warning message
 * 48. system_error - System error notification
 * 
 * === SECURITY NOTIFICATIONS ===
 * 49. login_success - Successful login from new device
 * 50. login_failed - Failed login attempt
 * 51. password_changed - Your password has been changed
 * 52. email_changed - Your email address has been changed
 * 53. security_alert - Security alert notification
 * 
 * === PAYMENT NOTIFICATIONS (if applicable) ===
 * 54. payment_received - Payment received
 * 55. payment_failed - Payment failed
 * 56. payment_refunded - Payment refunded
 * 57. payment_disputed - Payment dispute
 * 
 * === LOCATION & PICKUP NOTIFICATIONS ===
 * 58. pickup_scheduled - Pickup has been scheduled
 * 59. pickup_reminder - Pickup reminder
 * 60. pickup_completed - Pickup completed
 * 61. pickup_cancelled - Pickup cancelled
 * 62. location_updated - Pickup location updated
 * 
 * === WEATHER & EXTERNAL NOTIFICATIONS ===
 * 63. weather_alert - Weather alert affecting pickup/delivery
 * 64. delivery_delayed - Delivery delayed due to external factors
 * 
 * === COMMUNITY NOTIFICATIONS ===
 * 65. community_announcement - Community announcement
 * 66. community_event - Community event notification
 * 67. community_achievement - Community achievement unlocked
 * 
 * Backend should use these exact type strings when creating notifications.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ===== CONFIGURATION =====
    const API_BASE_URL = 'http://35.209.4.180:5000';
    
    // ===== GLOBAL NOTIFICATIONS INTEGRATION =====
    // Clear notification badge when user visits notifications page
    if (window.GlobalNotifications) {
        // Force clear immediately using emergency method
        window.GlobalNotifications.forceClearBadge();
        
        // Also clear localStorage
        localStorage.removeItem('notifications.readIds');
        localStorage.removeItem('notifications.lastRead');
        
        // Clear the badge immediately when user visits this page
        setTimeout(() => {
            window.GlobalNotifications.clearReadStatus();
        }, 100); // Very small delay
    }
    
    // Also manually remove any existing badges immediately
    const badges = document.querySelectorAll('.notification-badge');
    badges.forEach(badge => badge.remove());
    
    // Reset bell icon colors immediately
    const bellIcons = document.querySelectorAll('.icon-bell, [class*="bell"]');
    bellIcons.forEach(icon => {
        icon.style.color = '';
        icon.style.filter = '';
    });
    
    // ===== CROSS-PAGE SYNC =====
    // Listen for global refresh events
    window.addEventListener('notificationsUpdated', (event) => {
        console.log('🔄 Notifications page received global refresh event');
        // Refresh the notifications list
        if (typeof loadNotifications === 'function') {
            loadNotifications();
        }
    });
    
    window.addEventListener('assetHubRefresh', (event) => {
        console.log('🔄 Notifications page received asset hub refresh event');
        // Refresh the notifications list when asset hub updates
        if (typeof loadNotifications === 'function') {
            loadNotifications();
        }
    });

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
        
        // Fetch fresh user data to get updated profile picture
        await fetchFreshUserData(USER_ID, token);
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
                let senderAvatar = null;
                let itemTitle = 'item';

                // Fetch sender info
                if (n.senderId || n.SenderId) {
                    const senderId = n.senderId || n.SenderId;
                    try {
                        const senderRes = await fetch(`${API_BASE_URL}/users/${senderId}`);
                        if (senderRes.ok) {
                            const sender = await senderRes.json();
                            senderName = `${sender.firstName || sender.FirstName || ''} ${sender.lastName || sender.LastName || ''}`.trim() || sender.email || sender.Email || 'User';
                            senderAvatar = sender.profilePicture || sender.ProfilePicture || null;
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

                const notification = {
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
                
                console.log('📋 Created notification:', {
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    actionUrl: notification.actionUrl
                });
                
                return notification;
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
            // === MESSAGING NOTIFICATIONS ===
            case 'message':
            case 'messaged':
                return {
                    title: `New message from ${senderName}`,
                    message: `${senderName} sent you a message. Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'message_received':
                return {
                    title: `New Message`,
                    message: `You have a new message from ${senderName}. Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'conversation_started':
                return {
                    title: `New Conversation`,
                    message: `${senderName} started a new conversation with you. Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            // === EXCHANGE NOTIFICATIONS ===
            case 'exchange_request':
                return {
                    title: `Borrow Request`,
                    message: `${senderName} has requested to borrow your ${itemTitle}. Click to view.`,
                    actionUrl: `./asset-hub.html?tab=pending`
                };

            case 'exchange_approved':
                return {
                    title: `Request Approved! 🎉`,
                    message: `Great news! ${senderName} has approved your request to borrow ${itemTitle}. Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'exchange_declined':
                return {
                    title: `Request Declined`,
                    message: `${senderName} has declined your request to borrow ${itemTitle}. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'exchange_cancelled':
                return {
                    title: `Request Cancelled`,
                    message: `${senderName} has cancelled their request for your ${itemTitle}. Click to view.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'exchange_started':
                return {
                    title: `Exchange Started`,
                    message: `Your exchange for ${itemTitle} has begun. Click to view.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'exchange_completed':
                return {
                    title: `Exchange Completed`,
                    message: `Your exchange for ${itemTitle} has been completed successfully. Click to view.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'exchange_overdue':
                return {
                    title: `Overdue Item`,
                    message: `The item ${itemTitle} is overdue for return. Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'exchange_returned':
                return {
                    title: `Item Returned`,
                    message: `${senderName} has returned your ${itemTitle}. Click to view.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'exchange_disputed':
                return {
                    title: `Exchange Dispute`,
                    message: `A dispute has been reported for your exchange of ${itemTitle}. Click to view.`,
                    actionUrl: `./profile.html`
                };

            // === OFFER NOTIFICATIONS ===
            case 'offer_request':
            case 'offer_received':
            case 'new_offer':
                return {
                    title: `New Offer Received`,
                    message: `${senderName} made an offer on your ${itemTitle}. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'offer_accepted':
            case 'offer_approved':
                return {
                    title: `Offer Accepted! 🎉`,
                    message: `Great news! Your offer for ${itemTitle} has been accepted. Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'offer_declined':
                return {
                    title: `Offer Declined`,
                    message: `Your offer for ${itemTitle} has been declined by ${senderName}. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'offer_sent':
            case 'offer_submitted':
                return {
                    title: `Offer Sent`,
                    message: `Your offer for ${itemTitle} has been sent successfully. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'offer_cancelled':
                return {
                    title: `Offer Cancelled`,
                    message: `The offer for ${itemTitle} has been cancelled. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'offer_expired':
                return {
                    title: `Offer Expired`,
                    message: `Your offer for ${itemTitle} has expired. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            // === MAINTENANCE NOTIFICATIONS ===
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
                    message: `Maintenance on your ${itemTitle} has been completed successfully. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'maintenance_overdue':
                return {
                    title: `Maintenance Overdue`,
                    message: `Maintenance for ${itemTitle} is overdue. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'maintenance_due':
                return {
                    title: `Maintenance Due`,
                    message: notification.message || `Maintenance is due for ${itemTitle}. Please schedule maintenance soon.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'maintenance_scheduled':
                return {
                    title: `Maintenance Scheduled`,
                    message: `Maintenance for ${itemTitle} has been scheduled. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'maintenance_cancelled':
                return {
                    title: `Maintenance Cancelled`,
                    message: `Maintenance for ${itemTitle} has been cancelled. Click to view.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            // === RETURN & REMINDER NOTIFICATIONS ===
            case 'return_reminder':
                return {
                    title: `Return Reminder`,
                    message: `Don't forget! ${itemTitle} is due for return soon. Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'return_due_today':
                return {
                    title: `Return Due Today`,
                    message: `⚠️ ${itemTitle} is due for return today! Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'return_overdue':
                return {
                    title: `Return Overdue`,
                    message: `🚨 ${itemTitle} is overdue for return. Click to view.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'return_confirmed':
                return {
                    title: `Return Confirmed`,
                    message: `Return of ${itemTitle} has been confirmed by ${senderName}. Click to view.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'return_disputed':
                return {
                    title: `Return Disputed`,
                    message: `Return of ${itemTitle} is being disputed. Please contact support.`,
                    actionUrl: `./profile.html`
                };

            case 'early_return_request':
                return {
                    title: `Early Return Request`,
                    message: `${senderName} wants to return ${itemTitle} early. Click to view.`,
                    actionUrl: `./asset-hub.html?tab=loaned`
                };

            case 'item_returned':
                return {
                    title: `Item Returned`,
                    message: `${senderName} has marked ${itemTitle} as returned. Please confirm receipt. Click to view.`,
                    actionUrl: `./asset-hub.html?tab=loaned`
                };

            // === USER & PROFILE NOTIFICATIONS ===
            case 'profile_updated':
                return {
                    title: `Profile Updated`,
                    message: `Your profile has been successfully updated.`,
                    actionUrl: `./profile.html`
                };

            case 'profile_picture_updated':
                return {
                    title: `Profile Picture Updated`,
                    message: `Your profile picture has been successfully updated.`,
                    actionUrl: `./profile.html`
                };

            case 'account_verified':
                return {
                    title: `Account Verified`,
                    message: `🎉 Your account has been verified! You now have full access to all features.`,
                    actionUrl: `./profile.html`
                };

            case 'account_suspended':
                return {
                    title: `Account Suspended`,
                    message: `Your account has been suspended. Please contact support for more information.`,
                    actionUrl: `./profile.html`
                };

            case 'account_reactivated':
                return {
                    title: `Account Reactivated`,
                    message: `Welcome back! Your account has been reactivated.`,
                    actionUrl: `./profile.html`
                };

            // === ITEM NOTIFICATIONS ===
            case 'item_listed':
                return {
                    title: `Item Listed Successfully`,
                    message: `Your ${itemTitle} has been successfully listed and is now available for borrowing.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'item_updated':
                return {
                    title: `Item Updated`,
                    message: `Your ${itemTitle} listing has been successfully updated.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'item_deleted':
                return {
                    title: `Item Deleted`,
                    message: `Your ${itemTitle} listing has been deleted.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'item_featured':
                return {
                    title: `Item Featured`,
                    message: `🎉 Your ${itemTitle} has been featured! It will be highlighted to more users.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'item_reported':
                return {
                    title: `Item Reported`,
                    message: `Your ${itemTitle} has been reported. Please review and contact support if needed.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            case 'item_flagged':
                return {
                    title: `Item Flagged`,
                    message: `Your ${itemTitle} has been flagged for review. Please check the listing details.`,
                    actionUrl: `./listing.html?id=${listingId}`
                };

            // === REVIEW NOTIFICATIONS ===
            case 'review_received':
                return {
                    title: `New Review Received`,
                    message: `${senderName} left you a review. Check it out!`,
                    actionUrl: `./profile.html`
                };

            case 'review_updated':
                return {
                    title: `Review Updated`,
                    message: `${senderName} updated their review of you.`,
                    actionUrl: `./profile.html`
                };

            case 'review_deleted':
                return {
                    title: `Review Deleted`,
                    message: `A review of you has been deleted.`,
                    actionUrl: `./profile.html`
                };

            case 'review_reported':
                return {
                    title: `Review Reported`,
                    message: `A review of you has been reported. We're investigating.`,
                    actionUrl: `./profile.html`
                };

            // === SYSTEM NOTIFICATIONS ===
            case 'system_maintenance':
                return {
                    title: `System Maintenance`,
                    message: `Scheduled system maintenance will occur. Some features may be temporarily unavailable.`,
                    actionUrl: `./Home.html`
                };

            case 'system_update':
                return {
                    title: `System Updated`,
                    message: `Hippo Exchange has been updated with new features and improvements!`,
                    actionUrl: `./Home.html`
                };

            case 'system_announcement':
                return {
                    title: `Important Announcement`,
                    message: `Important system announcement. Please read for updates.`,
                    actionUrl: `./Home.html`
                };

            case 'system_warning':
                return {
                    title: `System Warning`,
                    message: `System warning: Please be aware of this important information.`,
                    actionUrl: `./Home.html`
                };

            case 'system_error':
                return {
                    title: `System Error`,
                    message: `A system error has occurred. We're working to resolve it.`,
                    actionUrl: `./Home.html`
                };

            // === SECURITY NOTIFICATIONS ===
            case 'login_success':
                return {
                    title: `Login Successful`,
                    message: `You have successfully logged in from a new device.`,
                    actionUrl: `./profile.html`
                };

            case 'login_failed':
                return {
                    title: `Failed Login Attempt`,
                    message: `A failed login attempt was detected. If this wasn't you, please secure your account.`,
                    actionUrl: `./profile.html`
                };

            case 'password_changed':
                return {
                    title: `Password Changed`,
                    message: `Your password has been successfully changed.`,
                    actionUrl: `./profile.html`
                };

            case 'email_changed':
                return {
                    title: `Email Changed`,
                    message: `Your email address has been successfully changed.`,
                    actionUrl: `./profile.html`
                };

            case 'security_alert':
                return {
                    title: `Security Alert`,
                    message: `Security alert: Please review your account security settings.`,
                    actionUrl: `./profile.html`
                };

            // === PAYMENT NOTIFICATIONS ===
            case 'payment_received':
                return {
                    title: `Payment Received`,
                    message: `Payment has been received for your transaction.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'payment_failed':
                return {
                    title: `Payment Failed`,
                    message: `Payment failed. Please check your payment method and try again.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'payment_refunded':
                return {
                    title: `Payment Refunded`,
                    message: `Your payment has been refunded.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'payment_disputed':
                return {
                    title: `Payment Dispute`,
                    message: `A payment dispute has been reported. Please contact support.`,
                    actionUrl: `./profile.html`
                };

            // === LOCATION & PICKUP NOTIFICATIONS ===
            case 'pickup_scheduled':
                return {
                    title: `Pickup Scheduled`,
                    message: `Pickup for ${itemTitle} has been scheduled. Check details and confirm.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'pickup_reminder':
                return {
                    title: `Pickup Reminder`,
                    message: `Don't forget! Pickup for ${itemTitle} is scheduled soon.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'pickup_completed':
                return {
                    title: `Pickup Completed`,
                    message: `Pickup for ${itemTitle} has been completed successfully.`,
                    actionUrl: `./asset-hub.html`
                };

            case 'pickup_cancelled':
                return {
                    title: `Pickup Cancelled`,
                    message: `Pickup for ${itemTitle} has been cancelled.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'location_updated':
                return {
                    title: `Location Updated`,
                    message: `Pickup location for ${itemTitle} has been updated.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            // === WEATHER & EXTERNAL NOTIFICATIONS ===
            case 'weather_alert':
                return {
                    title: `Weather Alert`,
                    message: `Weather conditions may affect pickup/delivery for ${itemTitle}.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            case 'delivery_delayed':
                return {
                    title: `Delivery Delayed`,
                    message: `Delivery for ${itemTitle} has been delayed due to external factors.`,
                    actionUrl: `./inbox.html?userId=${senderId}`
                };

            // === COMMUNITY NOTIFICATIONS ===
            case 'community_announcement':
                return {
                    title: `Community Announcement`,
                    message: `Important community announcement. Check it out!`,
                    actionUrl: `./Home.html`
                };

            case 'community_event':
                return {
                    title: `Community Event`,
                    message: `New community event announced. Join us!`,
                    actionUrl: `./Home.html`
                };

            case 'community_achievement':
                return {
                    title: `Achievement Unlocked`,
                    message: `🎉 You've unlocked a new community achievement!`,
                    actionUrl: `./profile.html`
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
        
        console.log('🔧 generateActionUrl called:', {
            type: type,
            senderId: senderId,
            listingId: listingId,
            notification: notification
        });

        switch (type) {
            // Messaging notifications
            case 'message':
            case 'messaged':
            case 'message_received':
            case 'conversation_started':
                return `./inbox.html?userId=${senderId}`;
            
            // Exchange notifications
            case 'exchange_request':
            case 'exchange_approved':
            case 'exchange_declined':
            case 'exchange_started':
            case 'exchange_completed':
            case 'exchange_overdue':
            case 'exchange_returned':
            case 'exchange_disputed':
                return listingId ? `./listing.html?id=${listingId}` : './asset-hub.html';
            
            case 'exchange_cancelled':
                return './asset-hub.html';
            
            // Offer notifications
            case 'offer_request':
            case 'offer_received':
            case 'new_offer':
            case 'offer_accepted':
            case 'offer_approved':
            case 'offer_declined':
            case 'offer_sent':
            case 'offer_submitted':
            case 'offer_cancelled':
            case 'offer_expired':
                return listingId ? `./listing.html?id=${listingId}` : './asset-hub.html';
            
            // Maintenance notifications
            case 'maintenance_coming_up':
            case 'maintenance_reminder':
            case 'maintenance_done':
            case 'maintenance_complete':
            case 'maintenance_completed':
            case 'maintenance_overdue':
            case 'maintenance_due':
            case 'maintenance_scheduled':
            case 'maintenance_cancelled':
                return listingId ? `./listing.html?id=${listingId}` : './asset-hub.html';
            
            // Return notifications
            case 'return_reminder':
            case 'return_due_today':
            case 'return_overdue':
            case 'return_confirmed':
            case 'return_disputed':
                return senderId ? `./inbox.html?userId=${senderId}` : './asset-hub.html';
            
            case 'early_return_request':
                return './asset-hub.html?tab=loaned';
            
            case 'item_returned':
                return './asset-hub.html?tab=loaned';
            
            // Profile notifications
            case 'profile_updated':
            case 'profile_picture_updated':
            case 'account_verified':
            case 'account_suspended':
            case 'account_reactivated':
            case 'password_changed':
            case 'email_changed':
            case 'security_alert':
            case 'login_success':
            case 'login_failed':
                return './profile.html';
            
            // Item notifications
            case 'item_listed':
            case 'item_updated':
            case 'item_deleted':
            case 'item_featured':
            case 'item_reported':
            case 'item_flagged':
                return listingId ? `./listing.html?id=${listingId}` : './asset-hub.html';
            
            // Review notifications
            case 'review_received':
            case 'review_updated':
            case 'review_deleted':
            case 'review_reported':
                return './profile.html';
            
            // System notifications
            case 'system_maintenance':
            case 'system_update':
            case 'system_announcement':
            case 'system_warning':
            case 'system_error':
            case 'community_announcement':
            case 'community_event':
                return './Home.html';
            
            case 'community_achievement':
                return './profile.html';
            
            // Payment notifications
            case 'payment_received':
            case 'payment_failed':
            case 'payment_refunded':
            case 'payment_disputed':
                return './asset-hub.html';
            
            // Pickup notifications
            case 'pickup_scheduled':
            case 'pickup_reminder':
            case 'pickup_completed':
            case 'pickup_cancelled':
            case 'location_updated':
            case 'weather_alert':
            case 'delivery_delayed':
                return senderId ? `./inbox.html?userId=${senderId}` : './asset-hub.html';
            
            default:
                const defaultUrl = listingId ? `./listing.html?id=${listingId}` : './profile.html';
                console.log('🔧 generateActionUrl default case:', defaultUrl);
                return defaultUrl;
        }
        
        // This should never be reached, but just in case
        console.log('🔧 generateActionUrl fallback:', './profile.html');
        return './profile.html';
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
            // === MESSAGING NOTIFICATIONS ===
            case 'message':
            case 'messaged':
            case 'message_received':
            case 'conversation_started':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>`;

            // === EXCHANGE NOTIFICATIONS ===
            case 'exchange_request':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
        </svg>`;

            case 'exchange_approved':
            case 'exchange_started':
            case 'exchange_completed':
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

            case 'exchange_overdue':
            case 'exchange_returned':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;

            case 'exchange_disputed':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
        </svg>`;

            // === OFFER NOTIFICATIONS ===
            case 'offer_request':
            case 'offer_received':
            case 'new_offer':
            case 'offer_accepted':
            case 'offer_approved':
            case 'offer_sent':
            case 'offer_submitted':
            case 'offer_declined':
            case 'offer_cancelled':
            case 'offer_expired':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
        </svg>`;

            // === MAINTENANCE NOTIFICATIONS ===
            case 'maintenance_coming_up':
            case 'maintenance_reminder':
            case 'maintenance_done':
            case 'maintenance_complete':
            case 'maintenance_completed':
            case 'maintenance_overdue':
            case 'maintenance_due':
            case 'maintenance_scheduled':
            case 'maintenance_cancelled':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>`;

            // === RETURN & REMINDER NOTIFICATIONS ===
            case 'return_reminder':
            case 'return_due_today':
            case 'return_overdue':
            case 'return_confirmed':
            case 'return_disputed':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;

            case 'early_return_request':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;

            case 'item_returned':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;

            // === USER & PROFILE NOTIFICATIONS ===
            case 'profile_updated':
            case 'profile_picture_updated':
            case 'account_verified':
            case 'account_reactivated':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>`;

            case 'account_suspended':
            case 'security_alert':
            case 'login_failed':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
        </svg>`;

            case 'password_changed':
            case 'email_changed':
            case 'login_success':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
        </svg>`;

            // === ITEM NOTIFICATIONS ===
            case 'item_listed':
            case 'item_updated':
            case 'item_featured':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>`;

            case 'item_deleted':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>`;

            case 'item_reported':
            case 'item_flagged':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
        </svg>`;

            // === REVIEW NOTIFICATIONS ===
            case 'review_received':
            case 'review_updated':
            case 'review_deleted':
            case 'review_reported':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
        </svg>`;

            // === SYSTEM NOTIFICATIONS ===
            case 'system_maintenance':
            case 'system_update':
            case 'system_announcement':
            case 'system_warning':
            case 'system_error':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>`;

            // === PAYMENT NOTIFICATIONS ===
            case 'payment_received':
            case 'payment_failed':
            case 'payment_refunded':
            case 'payment_disputed':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
        </svg>`;

            // === LOCATION & PICKUP NOTIFICATIONS ===
            case 'pickup_scheduled':
            case 'pickup_reminder':
            case 'pickup_completed':
            case 'pickup_cancelled':
            case 'location_updated':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>`;

            // === WEATHER & EXTERNAL NOTIFICATIONS ===
            case 'weather_alert':
            case 'delivery_delayed':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
        </svg>`;

            // === COMMUNITY NOTIFICATIONS ===
            case 'community_announcement':
            case 'community_event':
            case 'community_achievement':
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>`;

            default:
                return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>`;
        }
    }

    function getNotificationColor(type) {
        switch (type) {
            // === MESSAGING NOTIFICATIONS ===
            case 'message':
            case 'messaged':
            case 'message_received':
            case 'conversation_started':
                return 'text-blue-600 bg-blue-100';

            // === EXCHANGE NOTIFICATIONS ===
            case 'exchange_request':
                return 'text-indigo-600 bg-indigo-100';

            case 'exchange_approved':
            case 'exchange_started':
            case 'exchange_completed':
                return 'text-emerald-600 bg-emerald-100';

            case 'exchange_declined':
                return 'text-red-600 bg-red-100';

            case 'exchange_cancelled':
                return 'text-orange-600 bg-orange-100';

            case 'exchange_overdue':
            case 'exchange_returned':
                return 'text-amber-600 bg-amber-100';

            case 'exchange_disputed':
                return 'text-red-700 bg-red-200';

            // === OFFER NOTIFICATIONS ===
            case 'offer_request':
            case 'offer_received':
            case 'new_offer':
            case 'offer_sent':
            case 'offer_submitted':
                return 'text-green-600 bg-green-100';

            case 'offer_accepted':
            case 'offer_approved':
                return 'text-emerald-600 bg-emerald-100';

            case 'offer_declined':
                return 'text-red-600 bg-red-100';

            case 'offer_cancelled':
            case 'offer_expired':
                return 'text-orange-600 bg-orange-100';

            // === MAINTENANCE NOTIFICATIONS ===
            case 'maintenance_coming_up':
            case 'maintenance_reminder':
                return 'text-yellow-600 bg-yellow-100';

            case 'maintenance_done':
            case 'maintenance_complete':
            case 'maintenance_completed':
            case 'maintenance_scheduled':
                return 'text-teal-600 bg-teal-100';

            case 'maintenance_overdue':
            case 'maintenance_due':
                return 'text-red-600 bg-red-100';

            case 'maintenance_cancelled':
                return 'text-orange-600 bg-orange-100';

            // === RETURN & REMINDER NOTIFICATIONS ===
            case 'return_reminder':
                return 'text-blue-600 bg-blue-100';

            case 'return_due_today':
                return 'text-amber-600 bg-amber-100';

            case 'return_overdue':
                return 'text-red-600 bg-red-100';

            case 'return_confirmed':
                return 'text-emerald-600 bg-emerald-100';

            case 'return_disputed':
                return 'text-red-700 bg-red-200';

            case 'early_return_request':
                return 'text-blue-600 bg-blue-100';

            case 'item_returned':
                return 'text-green-600 bg-green-100';

            // === USER & PROFILE NOTIFICATIONS ===
            case 'profile_updated':
            case 'profile_picture_updated':
            case 'account_verified':
            case 'account_reactivated':
                return 'text-emerald-600 bg-emerald-100';

            case 'account_suspended':
            case 'security_alert':
            case 'login_failed':
                return 'text-red-600 bg-red-100';

            case 'password_changed':
            case 'email_changed':
            case 'login_success':
                return 'text-blue-600 bg-blue-100';

            // === ITEM NOTIFICATIONS ===
            case 'item_listed':
            case 'item_updated':
            case 'item_featured':
                return 'text-emerald-600 bg-emerald-100';

            case 'item_deleted':
                return 'text-orange-600 bg-orange-100';

            case 'item_reported':
            case 'item_flagged':
                return 'text-red-600 bg-red-100';

            // === REVIEW NOTIFICATIONS ===
            case 'review_received':
            case 'review_updated':
                return 'text-yellow-600 bg-yellow-100';

            case 'review_deleted':
                return 'text-orange-600 bg-orange-100';

            case 'review_reported':
                return 'text-red-600 bg-red-100';

            // === SYSTEM NOTIFICATIONS ===
            case 'system_maintenance':
            case 'system_update':
            case 'system_announcement':
                return 'text-blue-600 bg-blue-100';

            case 'system_warning':
                return 'text-amber-600 bg-amber-100';

            case 'system_error':
                return 'text-red-600 bg-red-100';

            // === PAYMENT NOTIFICATIONS ===
            case 'payment_received':
                return 'text-emerald-600 bg-emerald-100';

            case 'payment_failed':
                return 'text-red-600 bg-red-100';

            case 'payment_refunded':
                return 'text-blue-600 bg-blue-100';

            case 'payment_disputed':
                return 'text-red-700 bg-red-200';

            // === LOCATION & PICKUP NOTIFICATIONS ===
            case 'pickup_scheduled':
            case 'pickup_reminder':
            case 'pickup_completed':
            case 'location_updated':
                return 'text-blue-600 bg-blue-100';

            case 'pickup_cancelled':
                return 'text-orange-600 bg-orange-100';

            // === WEATHER & EXTERNAL NOTIFICATIONS ===
            case 'weather_alert':
            case 'delivery_delayed':
                return 'text-amber-600 bg-amber-100';

            // === COMMUNITY NOTIFICATIONS ===
            case 'community_announcement':
            case 'community_event':
                return 'text-purple-600 bg-purple-100';

            case 'community_achievement':
                return 'text-yellow-600 bg-yellow-100';

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
        console.log('🔍 Generating profile picture for:', notification.senderName, 'Avatar:', notification.senderAvatar);
        console.log('🔍 generateProfilePictureHTML function available:', typeof generateProfilePictureHTML);
        
        const avatarHtml = `<a href="./otheruser.html?userId=${notification.senderId}" class="profile-link" title="View ${notification.senderName}'s profile">
        ${typeof generateProfilePictureHTML === 'function' ? 
            generateProfilePictureHTML(notification.senderAvatar, {FirstName: notification.senderName.split(' ')[0], LastName: notification.senderName.split(' ')[1]}, 'lg') :
            `<div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">${notification.senderName.charAt(0).toUpperCase()}</div>`
        }
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
            console.log('🔍 Notification clicked:', notification);
            console.log('🔍 Action URL:', notification.actionUrl);
            
            // Don't trigger if clicking on the toggle button, profile link, or accept/decline buttons
            if (e.target.closest('.toggle-read-btn') ||
                e.target.closest('.profile-link') ||
                e.target.closest('.accept-btn') ||
                e.target.closest('.decline-btn')) {
                console.log('🚫 Click blocked - clicked on excluded element');
                return;
            }

            console.log('✅ Processing notification click');
            
            // Mark as read and navigate
            markAsRead(notification.id);

            if (notification.actionUrl) {
                console.log('🚀 Navigating to:', notification.actionUrl);
                window.location.href = notification.actionUrl;
            } else {
                console.log('⚠️ No action URL found for notification');
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
                    Approved: true,
                    StartDate: new Date().toISOString(),
                    EndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                }
                : { Approved: false };

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

            // If approved, refresh user profile data to update counters
            if (isAccept) {
                await refreshUserProfile();
            }

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

    // Auto-refresh notifications every 60 seconds (1 minute)
    setInterval(() => {
        if (!isLoading) {
            console.log('🔄 Auto-refreshing notifications...');
            fetchNotifications();
        }
    }, 60000);
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

// Refresh user profile data to update counters
async function refreshUserProfile() {
    try {
        const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
        if (!token) return;

        const response = await fetch('http://localhost:5000/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const updatedUser = await response.json();
            localStorage.setItem('hippo_user', JSON.stringify(updatedUser));
            console.log('🔄 Refreshed user profile data:', updatedUser);
        }
    } catch (error) {
        console.error('Error refreshing user profile:', error);
    }
}

// Fetch fresh user data from API
async function fetchFreshUserData(userId, token) {
    try {
        console.log('🔄 Fetching fresh user data for:', userId);
        const response = await fetch(`http://localhost:5000/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const freshUser = await response.json();
            console.log('✅ Fresh user data received:', freshUser);
            
            // Update localStorage with fresh data
            localStorage.setItem('hippo_user', JSON.stringify(freshUser));
            
            // Display updated user info
            displayUserInfo(freshUser);
        } else {
            console.warn('⚠️ Failed to fetch fresh user data, using cached data');
            // Fallback to cached data
            const cachedUser = JSON.parse(localStorage.getItem('hippo_user') || '{}');
            displayUserInfo(cachedUser);
        }
    } catch (error) {
        console.error('❌ Error fetching fresh user data:', error);
        // Fallback to cached data
        const cachedUser = JSON.parse(localStorage.getItem('hippo_user') || '{}');
        displayUserInfo(cachedUser);
    }
}

// Display user info in sidebar
function displayUserInfo(user) {
    console.log('Displaying user info:', user);
    
    // Update account name
    const acctName = document.getElementById('acct-name');
    if (acctName) {
        const firstName = user.FirstName || user.firstName || '';
        const lastName = user.LastName || user.lastName || '';
        const email = user.Email || user.email || '';
        
        const fullName = `${firstName} ${lastName}`.trim() || email || 'User';
        acctName.textContent = fullName;
    }
    
    // Update account rank
    const acctRank = document.getElementById('acct-rank');
    if (acctRank) {
        acctRank.textContent = 'Member';
    }
    
    // Update sidebar avatar with profile picture and fallback
    const acctAvatar = document.getElementById('acct-avatar');
    const profilePic = user.ProfilePicture || user.profilePicture;
    if (acctAvatar && profilePic && profilePic.trim()) {
        acctAvatar.src = profilePic;
    }
  }
