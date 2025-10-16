// global-notifications.js — Global notification system for all pages

/**
 * Global notification system that works across all pages
 * - Shows notification badges/counts in navigation
 * - Auto-refreshes notification counts
 * - Handles real-time updates
 */

// Add CSS styles for notification badges
const style = document.createElement('style');
style.textContent = `
    .notification-badge {
        position: absolute;
        top: -6px;
        right: -12px;
        background: linear-gradient(135deg, #ff4757, #ff3742);
        color: white;
        font-size: 0.7rem;
        border-radius: 12px;
        min-width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        z-index: 50;
        box-shadow: 
            0 2px 8px rgba(255, 71, 87, 0.4),
            0 0 0 2px rgba(255, 255, 255, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.2);
        animation: notificationPulse 2s ease-in-out infinite;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        letter-spacing: -0.02em;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        white-space: nowrap;
        overflow: visible;
    }
    
    .notification-badge.single-digit {
        min-width: 20px;
        width: 20px;
        border-radius: 50%;
    }
    
    .notification-badge.double-digit {
        min-width: 24px;
        padding: 0 6px;
        border-radius: 12px;
    }
    
    .notification-badge.triple-digit {
        min-width: 28px;
        padding: 0 8px;
        border-radius: 14px;
        font-size: 0.65rem;
    }
    
    @keyframes notificationPulse {
        0%, 100% {
            transform: scale(1);
            box-shadow: 
                0 2px 8px rgba(255, 71, 87, 0.4),
                0 0 0 2px rgba(255, 255, 255, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
        50% {
            transform: scale(1.05);
            box-shadow: 
                0 4px 12px rgba(255, 71, 87, 0.6),
                0 0 0 3px rgba(255, 255, 255, 0.15),
                inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }
    }
    
    .nav-link {
        position: relative;
        transition: all 0.2s ease;
        overflow: visible !important;
    }
    
    /* Targeted overflow fixes only for notification elements */
    .nav-link[href*="notifications.html"] {
        overflow: visible !important;
    }
    
    .nav-link:hover .notification-badge {
        transform: scale(1.1);
        animation-play-state: paused;
    }
    
    .notification-counter {
        display: none;
        background: linear-gradient(135deg, #ff4757, #ff3742);
        color: white;
        font-size: 0.7rem;
        border-radius: 12px;
        padding: 2px 8px;
        margin-left: 6px;
        font-weight: 700;
        box-shadow: 0 2px 6px rgba(255, 71, 87, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    /* Enhanced bell icon styling */
    .nav-link[href*="notifications.html"] .icon-bell {
        transition: all 0.3s ease;
        position: relative;
    }
    
    .nav-link[href*="notifications.html"]:hover .icon-bell {
        transform: scale(1.1);
    }
    
    /* Glow effect for bell when notifications are present */
    .nav-link[href*="notifications.html"]:has(.notification-badge) .icon-bell {
        filter: drop-shadow(0 0 6px rgba(255, 71, 87, 0.6));
        color: #ff4757 !important;
    }
    
    /* Smooth transitions for all notification elements */
    .notification-badge,
    .nav-link[href*="notifications.html"] .icon-bell {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* More targeted overflow fixes for notification badges */
    .nav-link[href*="notifications.html"] {
        overflow: visible !important;
        margin-right: 8px;
    }
    
    /* Ensure sidebar doesn't clip badges */
    aside, .sidebar, nav {
        overflow: visible !important;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .notification-badge {
            top: -4px;
            right: -8px;
            min-width: 18px;
            height: 18px;
            font-size: 0.65rem;
        }
        
        .notification-badge.double-digit {
            min-width: 22px;
            padding: 0 4px;
        }
        
        .notification-badge.triple-digit {
            min-width: 26px;
            padding: 0 6px;
            font-size: 0.6rem;
        }
    }
`;
document.head.appendChild(style);

class GlobalNotificationManager {
    constructor() {
        this.API_BASE_URL = 'http://localhost:5000';
        this.USER_ID = null;
        this.unreadCount = 0;
        this.refreshInterval = null;
        this.isInitialized = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.updateNotificationBadges = this.updateNotificationBadges.bind(this);
        this.fetchUnreadCount = this.fetchUnreadCount.bind(this);
        this.startAutoRefresh = this.startAutoRefresh.bind(this);
        this.stopAutoRefresh = this.stopAutoRefresh.bind(this);
    }

    /**
     * Initialize the global notification system
     */
    async init() {
        if (this.isInitialized) return;
        
        try {
            // Check authentication
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const userData = localStorage.getItem('hippo_user') || localStorage.getItem('userData');

            if (!token || !userData) {
                console.log('🔔 No authentication found for notifications');
                return;
            }

            const user = JSON.parse(userData);
            this.USER_ID = user.Id || user.id;

            if (!this.USER_ID) {
                console.log('🔔 No user ID found for notifications');
                return;
            }

            console.log('🔔 Initializing global notifications for user:', this.USER_ID);
            
            // Initial fetch
            await this.fetchUnreadCount();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            this.isInitialized = true;
            console.log('✅ Global notifications initialized');
            
        } catch (error) {
            console.error('❌ Error initializing global notifications:', error);
        }
    }

    /**
     * Fetch unread notification count from backend
     */
    async fetchUnreadCount() {
        if (!this.USER_ID) return;

        try {
            const response = await fetch(`${this.API_BASE_URL}/notifications/receiver/${this.USER_ID}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch notifications: ${response.status}`);
            }

            const notifications = await response.json();
            
            // Debug: Log all notifications
            console.log('🔍 All notifications:', notifications);
            
            // Count unread notifications using the same logic as notifications.js
            const readIds = this.getReadIds();
            this.unreadCount = notifications.filter(n => {
                const notificationId = n.Id || n.id;
                const isDismissed = n.dismissed === true || n.Dismissed === true;
                const isRead = readIds.includes(notificationId);
                
                // Debug: Log each notification's status
                console.log(`🔍 Notification ${notificationId}:`, {
                    dismissed: isDismissed,
                    read: isRead,
                    willCount: notificationId && !isDismissed && !isRead
                });
                
                // Only count as unread if it has an ID, is not dismissed, and is not marked as read
                return notificationId && !isDismissed && !isRead;
            }).length;
            
            console.log(`🔔 Unread notifications: ${this.unreadCount}`);
            
            // Update badges on all pages
            this.updateNotificationBadges();
            
        } catch (error) {
            console.error('❌ Error fetching unread count:', error);
        }
    }

    /**
     * Update notification badges across all pages
     */
    updateNotificationBadges() {
        // Find all notification links in navigation
        const notificationLinks = document.querySelectorAll('a[href*="notifications.html"]');
        
        notificationLinks.forEach(link => {
            // Remove existing badges
            const existingBadge = link.querySelector('.notification-badge');
            if (existingBadge) {
                existingBadge.remove();
            }

            // Add new badge if there are unread notifications
            if (this.unreadCount > 0) {
                const badge = document.createElement('span');
                badge.className = 'notification-badge';
                
                // Add appropriate size class based on number of digits
                const count = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
                if (count.length === 1) {
                    badge.classList.add('single-digit');
                } else if (count.length === 2) {
                    badge.classList.add('double-digit');
                } else {
                    badge.classList.add('triple-digit');
                }
                
                badge.textContent = count;
                
                // Make the link container relative positioned
                const linkContainer = link.parentElement;
                if (linkContainer) {
                    linkContainer.style.position = 'relative';
                }
                
                // Only add padding to notification links to prevent clipping
                if (link.href && link.href.includes('notifications.html')) {
                    link.style.paddingRight = '8px';
                }
                
                link.appendChild(badge);
                
                // Add visual indicator to the bell icon
                const bellIcon = link.querySelector('.icon-bell, [class*="bell"]');
                if (bellIcon) {
                    bellIcon.style.color = '#ff4757'; // Enhanced red color
                    bellIcon.style.filter = 'drop-shadow(0 0 6px rgba(255, 71, 87, 0.6))';
                }
            } else {
                // Reset bell icon color when no unread notifications
                const bellIcon = link.querySelector('.icon-bell, [class*="bell"]');
                if (bellIcon) {
                    bellIcon.style.color = '';
                    bellIcon.style.filter = '';
                }
            }
        });

        // Also update any standalone notification counters
        const counters = document.querySelectorAll('.notification-counter');
        counters.forEach(counter => {
            counter.textContent = this.unreadCount;
            counter.style.display = this.unreadCount > 0 ? 'inline' : 'none';
        });
    }

    /**
     * Get read notification IDs from localStorage
     */
    getReadIds() {
        try {
            const stored = localStorage.getItem('notifications.readIds');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    /**
     * Start auto-refresh of notification counts
     */
    startAutoRefresh() {
        // Refresh every 15 seconds
        this.refreshInterval = setInterval(() => {
            this.fetchUnreadCount();
        }, 15000);

        // Also refresh when page becomes visible (user switches back to tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.fetchUnreadCount();
            }
        });

        // Refresh when user comes back online
        window.addEventListener('online', () => {
            this.fetchUnreadCount();
        });
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Manually refresh notifications (can be called from other scripts)
     */
    async refresh() {
        await this.fetchUnreadCount();
    }
    
    /**
     * Force update badge count (useful for debugging)
     */
    forceUpdate() {
        this.updateNotificationBadges();
    }
    
    /**
     * Trigger refresh across all pages (called when exchanges are updated)
     */
    triggerGlobalRefresh() {
        console.log('🔄 Triggering global refresh for all pages');
        
        // Refresh notification count
        this.fetchUnreadCount();
        
        // Dispatch custom event for other pages to listen to
        window.dispatchEvent(new CustomEvent('notificationsUpdated', {
            detail: { timestamp: Date.now() }
        }));
        
        // Also dispatch for asset hub specifically
        window.dispatchEvent(new CustomEvent('assetHubRefresh', {
            detail: { timestamp: Date.now() }
        }));
    }

    /**
     * Mark notifications as read (called when user visits notifications page)
     */
    markAsRead(notificationIds) {
        try {
            const readIds = this.getReadIds();
            const newReadIds = [...new Set([...readIds, ...notificationIds])];
            localStorage.setItem('notifications.readIds', JSON.stringify(newReadIds));
            
            // Refresh count immediately
            this.fetchUnreadCount();
        } catch (error) {
            console.error('❌ Error marking notifications as read:', error);
        }
    }

    /**
     * Mark all notifications as read
     */
    markAllAsRead() {
        try {
            // Clear all read IDs to mark everything as read
            localStorage.removeItem('notifications.readIds');
            localStorage.setItem('notifications.lastRead', Date.now().toString());
            
            // Reset unread count
            this.unreadCount = 0;
            this.updateNotificationBadges();
            
            console.log('✅ All notifications marked as read');
        } catch (error) {
            console.error('❌ Error marking all notifications as read:', error);
        }
    }
    
    /**
     * Clear all read status (useful when user visits notifications page)
     */
    clearReadStatus() {
        try {
            localStorage.removeItem('notifications.readIds');
            localStorage.removeItem('notifications.lastRead');
            this.unreadCount = 0;
            this.updateNotificationBadges();
            
            // Stop auto-refresh temporarily to prevent badge from reappearing
            this.stopAutoRefresh();
            
            // Restart auto-refresh after a delay
            setTimeout(() => {
                this.startAutoRefresh();
            }, 5000);
            
            console.log('✅ Notification read status cleared');
        } catch (error) {
            console.error('❌ Error clearing read status:', error);
        }
    }
    
    /**
     * Force clear badge (emergency method)
     */
    forceClearBadge() {
        this.unreadCount = 0;
        this.updateNotificationBadges();
        
        // Remove all badges manually
        const badges = document.querySelectorAll('.notification-badge');
        badges.forEach(badge => badge.remove());
        
        // Reset bell icons
        const bellIcons = document.querySelectorAll('.icon-bell, [class*="bell"]');
        bellIcons.forEach(icon => {
            icon.style.color = '';
            icon.style.filter = '';
        });
        
        console.log('🚨 Badge force cleared');
    }

    /**
     * Cleanup when page unloads
     */
    destroy() {
        this.stopAutoRefresh();
        this.isInitialized = false;
    }
}

// Create global instance
window.GlobalNotifications = new GlobalNotificationManager();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.GlobalNotifications.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.GlobalNotifications.destroy();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlobalNotificationManager;
}
