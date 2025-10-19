// Asset Hub JavaScript functionality
class AssetHub {
    constructor() {
        // API Configuration
        this.API_BASE_URL = (typeof location !== 'undefined' && location.origin) ? location.origin : 'http://localhost:5000';
        
        this.currentUser = null;
        this.currentUserId = null;
        this.ownedItems = [];
        this.borrowedItems = [];
        this.requestedItems = []; // Store pending requests for user's items
        this.loanedItems = []; // Store items that have been approved and loaned out
        this.currentEditingItem = null;
        this.currentDeletingItem = null;
        this.currentMaintenanceReceipts = []; // Store receipt files for current maintenance entry
        this.editCurrentPhotos = []; // Store current photos for editing
        this.editNewPhotos = []; // Store new photos to be uploaded
        this.editNewPhotoFiles = []; // Store new photo files
        this.autoRefreshInterval = null; // Auto-refresh interval
        this.earlyReturnRequestInProgress = false; // Prevent duplicate early return requests

        this.init();
        
        // Add test function to global scope for debugging
        window.testAssetHubButtons = () => {

            const ownedItems = this.ownedItems;
            if (ownedItems.length > 0) {

                const firstItem = ownedItems[0];

                
                // Test edit modal

                this.openEditModal(firstItem);
                
                // Test maintenance modal after a delay
                setTimeout(() => {

                    this.openMaintenanceModal(firstItem);
                }, 2000);
            } else {

            }
        };
        
        // Add simple modal test function
        window.testModal = () => {

            
            // Wait for DOM to be ready
            setTimeout(() => {
                const modal = document.getElementById('maintenance-modal');

                console.log('🧪 All elements with modal in ID:', document.querySelectorAll('[id*="modal"]'));
                
                if (modal) {

                    console.log('🧪 Modal current display:', window.getComputedStyle(modal).display);

                    
                    // Force modal to be visible
                    modal.style.display = 'flex';
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.width = '100%';
                    modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                    modal.style.zIndex = '9999';
                    modal.classList.add('active');
                    

                    console.log('🧪 Modal new display:', window.getComputedStyle(modal).display);

                } else {

                    console.log('🧪 Available modals:', document.querySelectorAll('[id*="modal"]'));
                    
                    // Try to find any modal
                    const allModals = document.querySelectorAll('.modal-overlay');

                    
                    if (allModals.length > 0) {

                        const firstModal = allModals[0];
                        firstModal.style.display = 'flex';
                        firstModal.style.position = 'fixed';
                        firstModal.style.top = '0';
                        firstModal.style.left = '0';
                        firstModal.style.width = '100%';
                        firstModal.style.height = '100%';
                        firstModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                        firstModal.style.zIndex = '9999';
                        firstModal.classList.add('active');

                    }
                }
            }, 100);
        };
        
        // Add function to check modal HTML
        window.checkModalHTML = () => {

            const modal = document.getElementById('maintenance-modal');
            if (modal) {

                console.log('🔍 Modal HTML content:', modal.outerHTML.substring(0, 200) + '...');
                console.log('🔍 Modal current display:', window.getComputedStyle(modal).display);
                console.log('🔍 Modal current visibility:', window.getComputedStyle(modal).visibility);
                console.log('🔍 Modal current opacity:', window.getComputedStyle(modal).opacity);
                console.log('🔍 Modal current z-index:', window.getComputedStyle(modal).zIndex);
            } else {

                console.log('🔍 All elements with "maintenance" in ID:', document.querySelectorAll('[id*="maintenance"]'));
                console.log('🔍 All elements with "modal" in ID:', document.querySelectorAll('[id*="modal"]'));
                console.log('🔍 All modal-overlay elements:', document.querySelectorAll('.modal-overlay'));
            }
        };
        
        // Add function to close modal
        window.closeModal = () => {

            if (window.assetHub) {
                window.assetHub.closeMaintenanceModal();
            } else {

                const modal = document.getElementById('maintenance-modal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.style.visibility = 'hidden';
                    modal.style.opacity = '0';
                    modal.style.zIndex = '-1';
                    modal.classList.remove('active');

                }
            }
        };
        
        // Add function to close edit modal
        window.closeEditModal = () => {

            if (window.assetHub) {
                window.assetHub.closeEditModal();
            } else {

                const modal = document.getElementById('edit-item-modal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.style.visibility = 'hidden';
                    modal.style.opacity = '0';
                    modal.style.zIndex = '-1';
                    modal.classList.remove('active');

                }
            }
        };
        
        // Add function to force show modal
        window.forceShowModal = () => {

            const modal = document.getElementById('maintenance-modal');
            if (modal) {

                
                // Remove all possible hiding classes
                modal.classList.remove('hidden');
                modal.classList.remove('invisible');
                modal.classList.remove('opacity-0');
                
                // Force all visibility styles
                modal.style.display = 'flex';
                modal.style.visibility = 'visible';
                modal.style.opacity = '1';
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';
                modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                modal.style.zIndex = '99999';
                modal.style.pointerEvents = 'auto';
                
                // Add active class
                modal.classList.add('active');
                

                console.log('🚀 Modal display:', window.getComputedStyle(modal).display);
                console.log('🚀 Modal visibility:', window.getComputedStyle(modal).visibility);
                console.log('🚀 Modal opacity:', window.getComputedStyle(modal).opacity);
            } else {

            }
        };
        
        // Add function to check all maintenance buttons
        window.checkMaintenanceButtons = () => {

            const maintenanceButtons = document.querySelectorAll('.maintenance-btn');

            
            maintenanceButtons.forEach((btn, index) => {

                console.log(`🔍 Button ${index + 1} data-item-id:`, btn.getAttribute('data-item-id'));


            });
        };
        
        // Add function to force-set data-item-id on all buttons
        window.fixButtonDataIds = () => {

            
            // Find all item cards
            const itemCards = document.querySelectorAll('.item-card');

            
            itemCards.forEach((card, cardIndex) => {
                // Try to find the item ID from the card's data attributes or other elements
                const itemId = card.getAttribute('data-item-id') || 
                              card.querySelector('[data-item-id]')?.getAttribute('data-item-id') ||
                              `item-${cardIndex}`;
                

                
                // Set data-item-id on all buttons in this card
                const editBtn = card.querySelector('.edit-btn');
                const maintenanceBtn = card.querySelector('.maintenance-btn');
                const deleteBtn = card.querySelector('.delete-btn');
                
                if (editBtn) {
                    editBtn.setAttribute('data-item-id', itemId);

                }
                if (maintenanceBtn) {
                    maintenanceBtn.setAttribute('data-item-id', itemId);

                }
                if (deleteBtn) {
                    deleteBtn.setAttribute('data-item-id', itemId);

                }
            });
            

        };
        
        // Add global event delegation as backup
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {

                const itemId = e.target.getAttribute('data-item-id');


                
                const item = this.ownedItems.find(i => i.id === itemId);
                if (item) {

                    e.preventDefault();
                    e.stopPropagation();

                    this.openEditModal(item);

                } else {

                }
            }
            
            if (e.target.classList.contains('maintenance-btn')) {



                const itemId = e.target.getAttribute('data-item-id');


                
                const item = this.ownedItems.find(i => i.id === itemId);
                if (item) {

                    e.preventDefault();
                    e.stopPropagation();

                    this.openMaintenanceModal(item);

                } else {

                }
            }
        });
    }
    
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        
        if (tab === 'pending') {

            // Wait for the page to load, then switch to pending tab
            setTimeout(() => {
                this.switchToPendingTab();
            }, 1000);
        }
    }
    
    switchToPendingTab() {
        // Find and click the "My Items" tab button
        const myItemsTab = document.querySelector('[data-tab="my-items"]');
        if (myItemsTab) {

            myItemsTab.click();
            
            // Then scroll to or highlight pending requests section
            setTimeout(() => {
                const pendingSection = document.querySelector('#pending-requests-section');
                if (pendingSection) {
                    pendingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Add a subtle highlight effect
                    pendingSection.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    setTimeout(() => {
                        pendingSection.style.backgroundColor = '';
                    }, 3000);
                }
            }, 500);
        }
    }

    async init() {
        // Check authentication first
        await this.checkAuthAndLoadUser();
        this.setupEventListeners();
        this.setupGlobalFunctions();
        
        // Handle URL parameters
        this.handleUrlParameters();
        
        this.loadUserAssets();
        
        // Check for due maintenance notifications
        this.checkDueMaintenance();
        
        // Start auto-refresh functionality (5 seconds)
        this.startAutoRefresh();
        
        // Add visibility change listener to refresh data when user returns to the page
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible again, refresh the data to ensure status is up to date
                this.loadUserAssets();
                // Also check for due maintenance when user returns
                this.checkDueMaintenance();
                // Restart auto-refresh
                this.startAutoRefresh();
            } else {
                // Page is hidden, stop auto-refresh to save resources
                this.stopAutoRefresh();
            }
        });
    }

    getCurrentUserId() {
        // Return the authenticated user ID
        return this.currentUserId;
    }

    async checkDueMaintenance() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/maintenance/check-due`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();

                
                if (result.notificationsCreated > 0) {
                    // Trigger global notification refresh if notifications were created
                    if (window.GlobalNotifications) {
                        window.GlobalNotifications.triggerGlobalRefresh();
                    }
                }
            } else {
                console.warn('⚠️ Failed to check due maintenance:', response.status);
            }
        } catch (error) {
            console.error('❌ Error checking due maintenance:', error);
        }
    }

    // Auto-refresh functionality (5 seconds)
    startAutoRefresh() {
        // Clear any existing interval
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Set up new interval for 60 seconds (1 minute)
        this.autoRefreshInterval = setInterval(() => {

            this.loadUserAssets();
            this.checkDueMaintenance();
        }, 60000);
        
        console.log('✅ Auto-refresh started for asset hub (60 seconds)');
    }
    
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;

        }
    }

    async checkAuthAndLoadUser() {
        const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
        const userData = localStorage.getItem('hippo_user') || localStorage.getItem('userData');





        if (!token || !userData) {

            window.location.href = './Login.html';
            return;
        }

        try {
            // Verify token with backend
            const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });



            if (response.ok) {
                const user = await response.json();

                this.currentUser = user;
                this.currentUserId = user?.Id || user?.id || user?.userId;
                this.displayUserInfo(user);
                
                // Fetch fresh user data to get updated profile picture
                await this.fetchFreshUserData(this.currentUserId, token);
            } else {

                this.clearAuthData();
                window.location.href = './Login.html';
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.clearAuthData();
            window.location.href = './Login.html';
        }
    }

    displayUserInfo(user) {


        // Check for both uppercase and lowercase property names
        const displayName = user?.FirstName && user?.LastName
            ? `${user.FirstName} ${user.LastName}`
            : user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || 'User';



        // Update account name
        const acctNameEl = document.getElementById('acct-name');
        if (acctNameEl) {

            acctNameEl.textContent = displayName;

        }

        // Update account rank (you can customize this logic)
        const acctRankEl = document.getElementById('acct-rank');
        if (acctRankEl) {
            acctRankEl.textContent = 'Member';
        }

        // Balance display intentionally omitted

        // Update sidebar avatar with profile picture and fallback
        const acctAvatar = document.getElementById('acct-avatar');
        if (acctAvatar) {
            const profilePic = user?.ProfilePicture || user?.profilePicture;
            if (window.generateProfilePictureHTML) {
                acctAvatar.innerHTML = window.generateProfilePictureHTML(profilePic, user, 'md');

            } else {
                // Fallback if utility function not available
                if (profilePic && profilePic.trim()) {
                    acctAvatar.innerHTML = `<img src="${profilePic}" alt="Profile picture" class="w-full h-full object-cover rounded-full" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="w-full h-full rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm" style="display: none;">${(user?.FirstName || user?.firstName || user?.email || 'U').charAt(0).toUpperCase()}</div>`;
                } else {
                    const firstLetter = (user?.FirstName || user?.firstName || user?.email || 'U').charAt(0).toUpperCase();
                    acctAvatar.innerHTML = `<div class="w-full h-full rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">${firstLetter}</div>`;
                }
            }
        }
    }

    // Fetch fresh user data from API
    async fetchFreshUserData(userId, token) {
        try {

            const response = await fetch(`${this.API_BASE_URL}/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const freshUser = await response.json();

                
                // Update localStorage with fresh data
                localStorage.setItem('hippo_user', JSON.stringify(freshUser));
                
                // Display updated user info
                this.displayUserInfo(freshUser);
            } else {
                console.warn('⚠️ Failed to fetch fresh user data, using cached data');
            }
        } catch (error) {
            console.error('❌ Error fetching fresh user data:', error);
        }
    }

    clearAuthData() {
        localStorage.removeItem('hippo_token');
        localStorage.removeItem('hippo_user');
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('currentUserId');
    }

    signOut() {
        this.clearAuthData();
        window.location.href = './Login.html';
    }

    setupEventListeners() {
        // Sign out button
        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.signOut());
        }

        // Tab switching
        document.getElementById('owned-tab').addEventListener('click', () => this.showOwnedItems());
        document.getElementById('borrowed-tab').addEventListener('click', () => this.showBorrowedItems());
        document.getElementById('requested-tab').addEventListener('click', () => this.showRequestedItems());
        document.getElementById('loaned-tab').addEventListener('click', () => this.showLoanedItems());

        // Add item button
        document.getElementById('add-item-btn').addEventListener('click', () => {
            window.location.href = './create-listing.html';
        });

        // Edit item modal
        document.getElementById('close-edit-item').addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancel-edit-item').addEventListener('click', () => this.closeEditModal());
        document.getElementById('edit-item-form').addEventListener('submit', (e) => this.handleEditSubmit(e));
        
        // Photo management in edit modal
        document.getElementById('edit-add-photos-btn').addEventListener('click', () => {
            document.getElementById('edit-photo-upload').click();
        });
        document.getElementById('edit-photo-upload').addEventListener('change', (e) => this.handleEditPhotoUpload(e));
        
        // Close edit modal when clicking outside (on overlay)
        document.getElementById('edit-item-modal').addEventListener('click', (e) => {
            if (e.target.id === 'edit-item-modal') {
                this.closeEditModal();
            }
        });

        // Delete modal
        document.getElementById('close-delete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancel-delete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirm-delete').addEventListener('click', () => this.handleDeleteConfirm());

        // Maintenance modal
        document.getElementById('close-maintenance').addEventListener('click', () => this.closeMaintenanceModal());
        
        // Close modal when clicking outside (on overlay)
        document.getElementById('maintenance-modal').addEventListener('click', (e) => {
            if (e.target.id === 'maintenance-modal') {
                this.closeMaintenanceModal();
            }
        });
        
        // ===== CROSS-PAGE SYNC =====
        // Listen for global refresh events from other pages
        window.addEventListener('notificationsUpdated', (event) => {

            // Refresh all data when notifications are updated
            this.loadUserAssets();
        });
        
        window.addEventListener('assetHubRefresh', (event) => {

            // Refresh all data when asset hub is updated from another page
            this.loadUserAssets();
        });
        document.getElementById('cancel-maintenance').addEventListener('click', () => this.closeMaintenanceModal());
        document.getElementById('maintenance-form').addEventListener('submit', (e) => {

            this.handleMaintenanceSubmit(e);
        });

        // Receipt upload functionality
        const receiptUploadBtn = document.getElementById('receipt-upload-btn');
        const receiptUploadInput = document.getElementById('maintenance-receipt-upload');
        
        if (receiptUploadBtn) {
            receiptUploadBtn.addEventListener('click', () => {
                receiptUploadInput.click();
            });
        }

        if (receiptUploadInput) {
            receiptUploadInput.addEventListener('change', (e) => this.handleReceiptUpload(e));
        }

        // Maintenance type radio button listeners
        document.querySelectorAll('input[name="maintenance-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleFrequencyField(e.target.value === 'required');
            });
        });


        // Mobile menu
        this.setupMobileMenu();

        // Search functionality
        this.setupSearch();

        // Test function for debugging
        window.testEditModal = () => {
            const testItem = {
                Title: "Test Item",
                Description: "This is a test description",
                Category: "Tools",
                Condition: "Good",
                Available: true,
                Location: "Test Location",
                Pictures: ["test1.jpg", "test2.jpg"]
            };
            this.openEditModal(testItem);
        };
    }

    setupMobileMenu() {
        const menuButton = document.getElementById('menu-button');
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        const closeButton = document.getElementById('close-menu');

        menuButton.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
            document.body.classList.add('menu-open');
        });

        closeButton.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
            document.body.classList.remove('menu-open');
        });

        backdrop.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
            document.body.classList.remove('menu-open');
        });
    }

    setupSearch() {
        const searchInput = document.getElementById('asset-search-input');
        let searchTimeout = null;
        let currentSearchQuery = '';
        let originalOwnedItems = [];
        let originalBorrowedItems = [];
        let originalLoanedItems = [];

        function performSearch(query) {
            currentSearchQuery = query.trim();

            if (!currentSearchQuery) {
                // Show all items when search is empty
                this.renderOwnedItems();
                this.renderBorrowedItems();
                this.renderLoanedItems();
                this.updateCounts();
                return;
            }

            // Filter owned, borrowed, and loaned items
            const filteredOwnedItems = originalOwnedItems.filter(item => {
                const searchTerm = currentSearchQuery.toLowerCase();
                const title = (item.title || '').toLowerCase();
                const description = (item.description || '').toLowerCase();
                const category = (item.category || '').toLowerCase();
                const location = (item.location || '').toLowerCase();

                return title.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    category.includes(searchTerm) ||
                    location.includes(searchTerm);
            });

            const filteredBorrowedItems = originalBorrowedItems.filter(item => {
                const searchTerm = currentSearchQuery.toLowerCase();
                const title = (item.title || '').toLowerCase();
                const description = (item.description || '').toLowerCase();
                const status = (item.status || '').toLowerCase();
                const borrowedFrom = (item.borrowedFrom || '').toLowerCase();

                return title.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    status.includes(searchTerm) ||
                    borrowedFrom.includes(searchTerm);
            });

            const filteredLoanedItems = originalLoanedItems.filter(item => {
                const searchTerm = currentSearchQuery.toLowerCase();
                const title = (item.title || '').toLowerCase();
                const description = (item.description || '').toLowerCase();
                const borrowerName = (item.borrowerName || '').toLowerCase();

                return title.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    borrowerName.includes(searchTerm);
            });

            // Temporarily update the displayed items
            this.ownedItems = filteredOwnedItems;
            this.borrowedItems = filteredBorrowedItems;
            this.loanedItems = filteredLoanedItems;

            // Re-render the items
            this.renderOwnedItems();
            this.renderBorrowedItems();
            this.renderLoanedItems();
            this.updateCounts();
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value;

                // Clear previous timeout
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }

                // Set new timeout for debounced search
                searchTimeout = setTimeout(() => {
                    performSearch.call(this, query);
                }, 300); // 300ms delay
            });

            // Handle Enter key for immediate search
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    performSearch.call(this, e.target.value);
                }
            });
        }

        // Store original data when assets are loaded
        const originalLoadUserAssets = this.loadUserAssets.bind(this);
        this.loadUserAssets = async function () {
            await originalLoadUserAssets();
            // Store original data for search
            originalOwnedItems = [...this.ownedItems];
            originalBorrowedItems = [...this.borrowedItems];
            originalLoanedItems = [...this.loanedItems];
        };
    }

    async loadUserAssets() {
        if (!this.currentUserId) {

            this.ownedItems = this.getPlaceholderOwnedItems();
            this.borrowedItems = this.getPlaceholderBorrowedItems();
            this.renderOwnedItems();
            this.renderBorrowedItems();
            this.updateCounts();
            return;
        }

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');

            // Load owned items - fetch all items and filter by current user
            const ownedResponse = await fetch(`${this.API_BASE_URL}/items`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (ownedResponse.ok) {
                const allItems = await ownedResponse.json();

                
                // Filter items by current user ID
                this.ownedItems = allItems.items ? allItems.items.filter(item =>
                    item.userId === this.currentUserId || item.ownerId === this.currentUserId
                ) : [];
                

            } else {

                this.ownedItems = this.getPlaceholderOwnedItems();
            }
            this.renderOwnedItems();

            // Load borrowed items
            this.borrowedItems = await this.getBorrowedItems();
            this.renderBorrowedItems();

            // Load requested items (pending requests for user's items)
            this.requestedItems = await this.getRequestedItems();
            this.renderRequestedItems();

            // Load loaned out items (approved items that are currently borrowed)
            this.loanedItems = await this.getLoanedItems();
            this.renderLoanedItems();

            // Re-render owned items to update availability status based on loaned items
            this.renderOwnedItems();

            this.updateCounts();
        } catch (error) {
            console.error('Error loading user assets:', error);
            // Use placeholder data on error
            this.ownedItems = this.getPlaceholderOwnedItems();
            this.borrowedItems = this.getPlaceholderBorrowedItems();
            this.requestedItems = [];
            this.loanedItems = [];
            this.renderOwnedItems();
            this.renderBorrowedItems();
            this.renderRequestedItems();
            this.renderLoanedItems();
            this.updateCounts();
        }
    }

    async getBorrowedItems() {
        if (!this.currentUserId) {
            return this.getPlaceholderBorrowedItems();
        }

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');


            const response = await fetch(`${this.API_BASE_URL}/exchanges/borrower/${this.currentUserId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });



            if (response.ok) {
                const exchanges = await response.json();


                // Fetch actual item details and owner names for each exchange
                const borrowedItems = [];
                for (const exchange of exchanges) {
                    // Handle null/undefined exchanges
                    if (!exchange) {
                        console.warn('⚠️ Skipping null/undefined exchange');
                        continue;
                    }
                    
                    // Skip exchanges that have been returned (returnConfirmed is not null)
                    if (exchange.returnConfirmed !== null && exchange.returnConfirmed !== undefined) {
                        continue;
                    }
                    
                    try {

                        const itemResponse = await fetch(`${this.API_BASE_URL}/items/${exchange.ItemId || exchange.itemId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Accept': 'application/json'
                            }
                        });

                        if (itemResponse.ok) {
                            const item = await itemResponse.json();


                            // Fetch owner details
                            let ownerName = 'Unknown Owner';
                            try {

                                const ownerResponse = await fetch(`${this.API_BASE_URL}/users/by-id?id=${exchange.OwnerId || exchange.ownerId}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Accept': 'application/json'
                                    }
                                });

                                if (ownerResponse.ok) {
                                    const owner = await ownerResponse.json();

                                    ownerName = owner.name || `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner';
                                } else {
                                    console.warn('⚠️ Failed to fetch owner details, status:', ownerResponse.status);
                                }
                            } catch (ownerError) {
                                console.warn('⚠️ Error fetching owner details:', ownerError);
                            }

                            // Create borrowed item with full details
                            const borrowedItem = {
                                id: exchange.Id || exchange.id,
                                exchangeId: exchange.Id || exchange.id, // Store exchange ID for cancellation
                                itemId: exchange.ItemId || exchange.itemId,
                                title: item.title || item.Title || 'Untitled Item',
                                description: item.description || item.Description || 'No description',
                                imageUrl: item.imageUrl || item.ImageUrl || (item.pictures && item.pictures[0]) || (item.Pictures && item.Pictures[0]) || 'https://placehold.co/300x200?text=Item+Image',
                                condition: item.condition || item.Condition || 'Unknown',
                                price: item.price || item.Price || 0,
                                ownerId: exchange.OwnerId || exchange.ownerId,
                                ownerName: ownerName,
                                borrowerId: exchange.BorrowerId || exchange.borrowerId,
                                status: (exchange?.Approved === true || exchange?.approved === true) ? 'Approved' : ((exchange?.Approved === false || exchange?.approved === false) ? 'Denied' : 'Pending'),
                                startDate: exchange.StartDate || exchange.startDate,
                                endDate: exchange.EndDate || exchange.endDate,
                                approved: exchange?.Approved || exchange?.approved || false
                            };
                            
                            console.log('🔍 Creating borrowed item:', {
                                title: borrowedItem.title,
                                approved: borrowedItem.approved,
                                status: borrowedItem.status,
                                exchangeApproved: exchange?.Approved,
                                exchangeApprovedLower: exchange?.approved,
                                exchangeId: exchange.Id || exchange.id
                            });
                            
                            borrowedItems.push(borrowedItem);
                        } else {
                            console.warn('⚠️ Failed to fetch item details for:', exchange.ItemId || exchange.itemId);

                            // Still try to fetch owner name even if item details fail
                            let ownerName = 'Unknown Owner';
                            try {

                                const ownerResponse = await fetch(`${this.API_BASE_URL}/users/by-id?id=${exchange.OwnerId || exchange.ownerId}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Accept': 'application/json'
                                    }
                                });

                                if (ownerResponse.ok) {
                                    const owner = await ownerResponse.json();

                                    ownerName = owner.name || `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner';
                                }
                            } catch (ownerError) {
                                console.warn('⚠️ Error fetching owner details for fallback:', ownerError);
                            }

                            // Fallback with basic info
                            borrowedItems.push({
                                id: exchange.Id || exchange.id,
                                itemId: exchange.ItemId || exchange.itemId,
                                title: `Item ${exchange.ItemId || exchange.itemId}`,
                                description: `Borrowed from ${ownerName}`,
                                imageUrl: 'https://placehold.co/300x200?text=Item+Image',
                                condition: 'Unknown',
                                price: 0,
                                ownerId: exchange.OwnerId || exchange.ownerId,
                                ownerName: ownerName,
                                borrowerId: exchange.BorrowerId || exchange.borrowerId,
                                status: (exchange?.Approved === true || exchange?.approved === true) ? 'Approved' : ((exchange?.Approved === false || exchange?.approved === false) ? 'Denied' : 'Pending'),
                                startDate: exchange.StartDate || exchange.startDate,
                                endDate: exchange.EndDate || exchange.endDate,
                                approved: exchange?.Approved || exchange?.approved || false
                            });
                        }
                    } catch (itemError) {
                        console.warn('⚠️ Error fetching item details for:', exchange.ItemId || exchange.itemId, itemError);

                        // Still try to fetch owner name even if everything fails
                        let ownerName = 'Unknown Owner';
                        try {

                            const ownerResponse = await fetch(`${this.API_BASE_URL}/users/by-id?id=${exchange.OwnerId || exchange.ownerId}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Accept': 'application/json'
                                }
                            });

                            if (ownerResponse.ok) {
                                const owner = await ownerResponse.json();

                                ownerName = owner.name || `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner';
                            }
                        } catch (ownerError) {
                            console.warn('⚠️ Error fetching owner details for error fallback:', ownerError);
                        }

                        // Fallback with basic info
                        borrowedItems.push({
                            id: exchange.Id || exchange.id,
                            itemId: exchange.ItemId || exchange.itemId,
                            title: `Item ${exchange.ItemId || exchange.itemId}`,
                            description: `Borrowed from ${ownerName}`,
                            imageUrl: 'https://placehold.co/300x200?text=Item+Image',
                            condition: 'Unknown',
                            price: 0,
                            ownerId: exchange.OwnerId || exchange.ownerId,
                            ownerName: ownerName,
                            borrowerId: exchange.BorrowerId || exchange.borrowerId,
                            status: exchange?.Approved ? 'Approved' : 'Pending',
                            startDate: exchange.StartDate || exchange.startDate,
                            endDate: exchange.EndDate || exchange.endDate,
                            approved: exchange?.Approved || exchange?.approved || false
                        });
                    }
                }


                return borrowedItems;
            } else {
                console.error('❌ Failed to fetch exchanges:', response.status);
                return this.getPlaceholderBorrowedItems();
            }
        } catch (error) {
            console.error('❌ Error fetching borrowed items:', error);
            return this.getPlaceholderBorrowedItems();
        }
    }

    getPlaceholderOwnedItems() {
        const userId = this.currentUserId || 'user123';
        return [
            {
                id: 'item1',
                title: 'MacBook Pro 13"',
                description: '2022 MacBook Pro with M2 chip, 16GB RAM, 512GB SSD. Perfect for development and creative work.',
                available: true,
                ownerId: userId,
                userId: userId,
                createdUtc: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'item2',
                title: 'Canon EOS R5 Camera',
                description: 'Professional mirrorless camera with 45MP sensor, 4K video recording, and excellent low-light performance.',
                available: false,
                ownerId: userId,
                userId: userId,
                createdUtc: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'item3',
                title: 'Standing Desk Converter',
                description: 'Adjustable standing desk converter, perfect for home office setup. Height adjustable from 4" to 20".',
                available: true,
                ownerId: userId,
                userId: userId,
                createdUtc: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'item4',
                title: 'Nintendo Switch OLED',
                description: 'Nintendo Switch OLED model with 7" OLED screen, 64GB storage, and Joy-Con controllers included.',
                available: true,
                ownerId: userId,
                userId: userId,
                createdUtc: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'item5',
                title: 'KitchenAid Stand Mixer',
                description: 'Professional 5-quart stand mixer in Empire Red. Includes dough hook, whisk, and flat beater attachments.',
                available: false,
                ownerId: userId,
                userId: userId,
                createdUtc: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    getPlaceholderBorrowedItems() {
        return [
            {
                id: 'borrowed1',
                title: 'Gaming Laptop - ASUS ROG',
                description: 'High-performance gaming laptop with RTX 3070, 16GB RAM, 1TB SSD. Borrowed for weekend gaming sessions.',
                available: false,
                ownerId: 'otheruser1',
                createdUtc: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'active',
                startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
                borrowedFrom: 'Alex Johnson'
            },
            {
                id: 'borrowed2',
                title: 'Professional Camera Lens',
                description: 'Canon EF 24-70mm f/2.8L II USM lens. Borrowed for photography project.',
                available: false,
                ownerId: 'otheruser2',
                createdUtc: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'active',
                startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
                borrowedFrom: 'Sarah Chen'
            }
        ];
    }

    renderOwnedItems() {
        const grid = document.getElementById('owned-items-grid');
        const empty = document.getElementById('owned-empty');

        if (this.ownedItems.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = '';

        this.ownedItems.forEach(item => {
            const card = this.createItemCard(item, 'owned');
            grid.appendChild(card);
        });
    }

    renderBorrowedItems() {
        const grid = document.getElementById('borrowed-items-grid');
        const empty = document.getElementById('borrowed-empty');

        if (this.borrowedItems.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = '';

        this.borrowedItems.forEach(item => {
            const card = this.createItemCard(item, 'borrowed');
            grid.appendChild(card);
        });
    }

    async getRequestedItems() {
        if (!this.currentUserId) {
            return [];
        }

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');


            const response = await fetch(`${this.API_BASE_URL}/exchanges/owner/${this.currentUserId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });



            if (response.ok) {
                const exchanges = await response.json();



                // Log each exchange for debugging
                exchanges.forEach((exchange, index) => {
                    console.log(`📋 Exchange ${index + 1}:`, {
                        id: exchange.Id || exchange.id,
                        approved: exchange?.Approved,
                        approved_lower: exchange?.approved,
                        ownerId: exchange.OwnerId || exchange.ownerId,
                        borrowerId: exchange.BorrowerId || exchange.borrowerId,
                        itemId: exchange.ItemId || exchange.itemId
                    });
                });

                // Filter for pending requests (not approved/declined)
                const pendingExchanges = exchanges.filter(exchange => 
                    !exchange?.approved && !exchange?.Approved
                );




                // Fetch actual item details and borrower names for each exchange
                const requestedItems = [];
                for (const exchange of pendingExchanges) {
                    try {

                        const itemResponse = await fetch(`${this.API_BASE_URL}/items/${exchange.ItemId || exchange.itemId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Accept': 'application/json'
                            }
                        });

                        if (itemResponse.ok) {
                            const item = await itemResponse.json();


                            // Fetch borrower details
                            let borrowerName = 'Unknown Borrower';
                            let borrowerAvatar = null;
                            try {

                                const borrowerResponse = await fetch(`${this.API_BASE_URL}/users/by-id?id=${exchange.BorrowerId || exchange.borrowerId}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Accept': 'application/json'
                                    }
                                });

                                if (borrowerResponse.ok) {
                                    const borrower = await borrowerResponse.json();

                                    borrowerName = `${borrower.firstName || borrower.FirstName || ''} ${borrower.lastName || borrower.LastName || ''}`.trim() || borrower.email || borrower.Email || 'Unknown Borrower';
                                    borrowerAvatar = borrower.profilePicture || borrower.ProfilePicture || null;
                                }
                            } catch (borrowerError) {
                                console.warn('⚠️ Could not fetch borrower details:', borrowerError);
                            }

                            requestedItems.push({
                                id: exchange.Id || exchange.id,
                                exchangeId: exchange.Id || exchange.id,
                                itemId: exchange.ItemId || exchange.itemId,
                                title: item.title || item.Title || 'Unknown Item',
                                description: item.description || item.Description || '',
                                imageUrl: item.imageUrl || item.ImageUrl || (item.pictures && item.pictures[0]) || (item.Pictures && item.Pictures[0]) || (item.images && item.images[0]) || (item.Images && item.Images[0]),
                                category: item.category || item.Category || 'General',
                                status: 'pending',
                                approved: false,
                                borrowerId: exchange.BorrowerId || exchange.borrowerId,
                                borrowerName: borrowerName,
                                borrowerAvatar: borrowerAvatar,
                                requestCreated: exchange.RequestCreated || exchange.requestCreated,
                                startDate: exchange.StartDate || exchange.startDate,
                                endDate: exchange.EndDate || exchange.endDate
                            });
                        }
                    } catch (itemError) {
                        console.warn('⚠️ Could not fetch item details for exchange:', exchange.Id || exchange.id, itemError);
                    }
                }


                return requestedItems;
            } else {

                return [];
            }
        } catch (error) {
            console.error('Error loading requested items:', error);
            return [];
        }
    }

    async getLoanedItems() {
        if (!this.currentUserId) {
            return [];
        }

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');


            const response = await fetch(`${this.API_BASE_URL}/exchanges/owner/${this.currentUserId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });



            if (response.ok) {
                const exchanges = await response.json();


                // Filter for approved exchanges (loaned out items) that haven't been returned
                const approvedExchanges = exchanges.filter(exchange => 
                    (exchange?.approved === true || exchange?.Approved === true) &&
                    (exchange.returnConfirmed === null || exchange.returnConfirmed === undefined)
                );

                console.log('📋 Approved exchanges (loaned out):', approvedExchanges);

                // Fetch actual item details and borrower names for each exchange
                const loanedItems = [];
                for (const exchange of approvedExchanges) {
                    try {

                        const itemResponse = await fetch(`${this.API_BASE_URL}/items/${exchange.ItemId || exchange.itemId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Accept': 'application/json'
                            }
                        });

                        if (itemResponse.ok) {
                            const item = await itemResponse.json();


                            // Fetch borrower details
                            let borrowerName = 'Unknown Borrower';
                            let borrowerAvatar = null;
                            try {

                                const borrowerResponse = await fetch(`${this.API_BASE_URL}/users/by-id?id=${exchange.BorrowerId || exchange.borrowerId}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Accept': 'application/json'
                                    }
                                });

                                if (borrowerResponse.ok) {
                                    const borrower = await borrowerResponse.json();

                                    borrowerName = `${borrower.firstName || borrower.FirstName || ''} ${borrower.lastName || borrower.LastName || ''}`.trim() || borrower.email || borrower.Email || 'Unknown Borrower';
                                    borrowerAvatar = borrower.profilePicture || borrower.ProfilePicture || null;
                                }
                            } catch (borrowerError) {
                                console.warn('⚠️ Could not fetch borrower details for loaned item:', borrowerError);
                            }

                            // Check for early return request notifications
                            let hasEarlyReturnRequest = false;
                            try {
                                const notificationsResponse = await fetch(`${this.API_BASE_URL}/notifications/user/${this.currentUserId}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Accept': 'application/json'
                                    }
                                });

                                if (notificationsResponse.ok) {
                                    const notifications = await notificationsResponse.json();
                                    hasEarlyReturnRequest = notifications.some(notification => 
                                        notification.type === 'early_return_request' && 
                                        !notification.dismissed &&
                                        notification.listingId === (exchange.ItemId || exchange.itemId)
                                    );
                                }
                            } catch (notificationError) {
                                console.warn('⚠️ Could not check for early return requests:', notificationError);
                            }

                            loanedItems.push({
                                id: exchange.Id || exchange.id,
                                exchangeId: exchange.Id || exchange.id,
                                itemId: exchange.ItemId || exchange.itemId,
                                title: item.title || item.Title || 'Unknown Item',
                                description: item.description || item.Description || '',
                                imageUrl: item.imageUrl || item.ImageUrl || (item.pictures && item.pictures[0]) || (item.Pictures && item.Pictures[0]) || (item.images && item.images[0]) || (item.Images && item.Images[0]),
                                category: item.category || item.Category || 'General',
                                status: 'loaned',
                                approved: true,
                                borrowerId: exchange.BorrowerId || exchange.borrowerId,
                                borrowerName: borrowerName,
                                borrowerAvatar: borrowerAvatar,
                                startDate: exchange.StartDate || exchange.startDate,
                                endDate: exchange.EndDate || exchange.endDate,
                                requestCreated: exchange.RequestCreated || exchange.requestCreated,
                                hasEarlyReturnRequest: hasEarlyReturnRequest
                            });
                        }
                    } catch (itemError) {
                        console.warn('⚠️ Could not fetch item details for loaned exchange:', exchange.Id || exchange.id, itemError);
                    }
                }


                return loanedItems;
            } else {

                return [];
            }
        } catch (error) {
            console.error('Error loading loaned out items:', error);
            return [];
        }
    }

    renderRequestedItems() {
        const grid = document.getElementById('requested-items-grid');
        const empty = document.getElementById('requested-empty');

        if (this.requestedItems.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = '';

        this.requestedItems.forEach(request => {
            const requestCard = this.createRequestCard(request);
            grid.appendChild(requestCard);
        });
    }

    renderLoanedItems() {
        const grid = document.getElementById('loaned-items-grid');
        const empty = document.getElementById('loaned-empty');

        if (this.loanedItems.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = '';

        this.loanedItems.forEach(item => {
            const card = this.createItemCard(item, 'loaned');
            grid.appendChild(card);
        });
    }

    createRequestCard(request) {
        const card = document.createElement('div');
        card.className = 'glass rounded-lg p-4 border border-slate-200 hover:shadow-md transition-shadow';
        card.setAttribute('data-request-id', request.id);

        const requestDate = new Date(request.requestCreated).toLocaleDateString();
        const timeAgo = this.formatTimeAgo(new Date(request.requestCreated));

        card.innerHTML = `
            <div class="flex items-start gap-4">
                <!-- Item Image -->
                <div class="flex-shrink-0">
                    <img src="${request.imageUrl || 'https://placehold.co/80x80/ffffff/111111?text=' + encodeURIComponent(request.title)}" 
                         alt="${request.title}" 
                         class="w-16 h-16 rounded-lg object-cover border border-slate-200"
                         onerror="this.src='https://placehold.co/80x80/ffffff/111111?text=' + encodeURIComponent('${request.title}')">
                </div>

                <!-- Request Details -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-slate-800 truncate">${request.title}</h4>
                            <p class="text-sm text-slate-600 line-clamp-2">${request.description}</p>
                            
                            <!-- Requester Info -->
                            <div class="flex items-center gap-2 mt-2">
                                <a href="./otheruser.html?userId=${request.borrowerId}" class="flex items-center gap-2 hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors">
                                    ${generateProfilePictureHTML(request.borrowerAvatar, {FirstName: request.borrowerName.split(' ')[0], LastName: request.borrowerName.split(' ')[1]}, 'sm')}
                                    <span class="text-sm font-medium text-slate-700">${request.borrowerName}</span>
                                </a>
                                <span class="text-xs text-slate-500">wants to borrow</span>
                            </div>

                            <div class="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                <span>Requested ${timeAgo}</span>
                                <span>•</span>
                                <span>${requestDate}</span>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex gap-2 flex-shrink-0">
                            <button class="approve-btn px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors font-medium"
                                    data-request-id="${request.id}"
                                    data-item-id="${request.itemId}"
                                    data-borrower-id="${request.borrowerId}">
                                Approve
                            </button>
                            <button class="decline-btn px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors font-medium"
                                    data-request-id="${request.id}"
                                    data-item-id="${request.itemId}"
                                    data-borrower-id="${request.borrowerId}">
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners for approve/decline buttons
        const approveBtn = card.querySelector('.approve-btn');
        const declineBtn = card.querySelector('.decline-btn');

        approveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleRequestAction(request, true);
        });

        declineBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleRequestAction(request, false);
        });

        return card;
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    async handleRequestAction(request, isApprove) {

        
        const action = isApprove ? 'approve' : 'decline';
        const confirmed = await this.showConfirmation(
            `${isApprove ? 'Approve' : 'Decline'} Request`,
            `Are you sure you want to ${action} ${request.borrowerName}'s request for "${request.title}"?`
        );

        if (!confirmed) {

            return;
        }
        


        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            // Update the exchange
            const approvalBody = isApprove
                ? {
                    Approved: true,
                    StartDate: request.startDate ? new Date(request.startDate).toISOString() : new Date().toISOString(),
                    EndDate: request.endDate ? new Date(request.endDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                }
                : { Approved: false };





            const response = await fetch(`${this.API_BASE_URL}/exchanges/${request.exchangeId}/approval`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(approvalBody)
            });
            



            if (response.ok) {
                const updatedExchange = await response.json();


                
                this.showSuccess(`Request ${action}d successfully!`);
                
                // Remove the request from the list


                this.requestedItems = this.requestedItems.filter(req => {
                    const shouldKeep = req.id !== request.id;

                    return shouldKeep;
                });

                this.renderRequestedItems();
                
                // Always refresh borrowed items to update status for both approved and denied items
                // This ensures the status is updated in real-time on the asset hub page
                this.borrowedItems = await this.getBorrowedItems();

                
                this.renderBorrowedItems();
                
                // If approved, refresh loaned items and user profile data to update counters
                if (isApprove) {
                    this.loanedItems = await this.getLoanedItems();

                    this.renderLoanedItems();
                    
                    // Re-render owned items to update availability status
                    this.renderOwnedItems();
                }
                
                this.updateCounts();
                
                // Trigger global refresh for notifications and other pages
                if (window.GlobalNotifications) {
                    window.GlobalNotifications.triggerGlobalRefresh();
                }
                
            } else {
                const errorText = await response.text();
                console.error('❌ API Error Response:', errorText);
                console.error('❌ Response Status:', response.status);
                this.showError(`Failed to ${action} request: ${errorText}`);
            }
        } catch (error) {
            console.error(`❌ Error ${action}ing request:`, error);
            console.error('❌ Error details:', error.message);
            this.showError(`An error occurred while ${action}ing the request: ${error.message}`);
        }
    }

    async handleEarlyReturnRequest(exchangeId) {
        // Prevent multiple simultaneous requests
        if (this.earlyReturnRequestInProgress) {

            return;
        }

        const confirmed = await this.showConfirmation(
            'Request Early Return',
            'Are you sure you want to request early return for this item?'
        );

        if (!confirmed) {

            return;
        }
        

        this.earlyReturnRequestInProgress = true;

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            



            const requestBody = {
                returnRequestedAt: new Date().toISOString(),
                returnPendingConfirmation: true
            };

            console.log('🔄 Sending early return request:', {
                exchangeId: exchangeId,
                requestBody: requestBody,
                url: `${this.API_BASE_URL}/exchanges/${exchangeId}`
            });

            const response = await fetch(`${this.API_BASE_URL}/exchanges/${exchangeId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('📡 Early return request response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Early return request successful:', result);

                
                // Send inbox message to the item owner

                await this.sendEarlyReturnMessage(exchangeId);

                
                this.showSuccess('Early return request sent successfully!');
                
                // Refresh the borrowed items to update the status
                this.borrowedItems = await this.getBorrowedItems();
                this.renderBorrowedItems();
                this.updateCounts();
                
                // Trigger global refresh for notifications and other pages
                if (window.GlobalNotifications) {
                    window.GlobalNotifications.triggerGlobalRefresh();
                }
                
            } else {
                const errorText = await response.text();
                console.error('❌ Early return request failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText
                });
                this.showError(`Failed to request early return: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Error requesting early return:', error);
            console.error('❌ Error details:', error.message);
            this.showError(`An error occurred while requesting early return: ${error.message}`);
        } finally {
            this.earlyReturnRequestInProgress = false;
        }
    }

    async sendEarlyReturnMessage(exchangeId) {
        try {

            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            if (!token) {
                console.error('❌ No authentication token found');
                return;
            }

            if (!this.currentUserId) {
                console.error('❌ No current user ID found');
                return;
            }
            
            // Get exchange details to find the item owner

            const exchangeResponse = await fetch(`${this.API_BASE_URL}/exchanges/${exchangeId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!exchangeResponse.ok) {
                console.error('❌ Could not fetch exchange details:', exchangeResponse.status, exchangeResponse.statusText);
                return;
            }

            const exchange = await exchangeResponse.json();

            
            const ownerId = exchange.OwnerId || exchange.ownerId;
            const itemId = exchange.ItemId || exchange.itemId;

            if (!ownerId) {
                console.error('❌ No owner ID found for exchange');
                return;
            }



            // Get item details for the message

            const itemResponse = await fetch(`${this.API_BASE_URL}/items/${itemId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            let itemTitle = 'an item';
            if (itemResponse.ok) {
                const item = await itemResponse.json();
                itemTitle = item.title || item.Title || 'an item';

            } else {
                console.warn('⚠️ Could not fetch item details, using default title');
            }

            // Create message thread using the same approach as listing page

            const threadData = {
                participantIds: [this.currentUserId, ownerId],
                itemId: itemId,
                subject: `Early Return Request: ${itemTitle}`
            };




            const threadResponse = await fetch(`${this.API_BASE_URL}/messages/threads`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(threadData)
            });



            if (!threadResponse.ok) {
                console.warn('⚠️ Failed to create message thread:', threadResponse.status);
                const errorText = await threadResponse.text();
                console.error('❌ Thread creation error:', errorText);
                return;
            }

            const threadResult = await threadResponse.json();


            // Send initial message in the thread
            if (threadResult.id) {
                await this.sendInitialMessage(threadResult.id, itemTitle, this.currentUser);
            }

        } catch (error) {
            console.error('❌ Error sending early return message:', error);
        }
    }

    // Send initial message in the thread (matching listing page approach)
    async sendInitialMessage(threadId, itemTitle, sender) {
        try {


            // Get sender's display name
            const senderName = sender?.FirstName && sender?.LastName
                ? `${sender.FirstName} ${sender.LastName}`
                : sender?.email || 'Someone';

            // Prepare initial message
            const messageData = {
                body: `Hi! I'd like to request an early return for "${itemTitle}". I no longer need it and would like to return it to you. Please let me know if this works for you.`,
                senderId: sender?.Id || sender?.id || sender?.userId || this.currentUserId
            };




            const messageResponse = await fetch(`${this.API_BASE_URL}/messages/threads/${threadId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hippo_token')}`
                },
                body: JSON.stringify(messageData)
            });



            if (!messageResponse.ok) {
                console.warn('⚠️ Failed to send initial message:', messageResponse.status);
                return;
            }

            const messageResult = await messageResponse.json();


        } catch (error) {
            console.warn('⚠️ Error sending initial message:', error);
        }
    }

    // Note: handleMarkAsReturned method removed
    // Borrowers can no longer mark items as returned directly
    // They must request early returns, which owners must approve

    async handleRequestItemBackEarly(exchangeId) {
        const confirmed = await this.showConfirmation(
            'Request Item Back Early',
            'Are you sure you want to request this item back early? This will send a message to the borrower.'
        );

        if (!confirmed) {

            return;
        }
        


        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            



            const response = await fetch(`${this.API_BASE_URL}/exchanges/${exchangeId}/request-item-back-early`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            



            if (response.ok) {
                const result = await response.json();

                
                this.showSuccess('Request to get item back early sent successfully!');
                
                // Refresh the loaned items to update the status
                this.loanedItems = await this.getLoanedItems();
                this.renderLoanedItems();
                this.updateCounts();
                
                // Trigger global refresh for notifications and other pages
                if (window.GlobalNotifications) {
                    window.GlobalNotifications.triggerGlobalRefresh();
                }
                
            } else {
                const errorText = await response.text();
                console.error('❌ API Error Response:', errorText);
                console.error('❌ Response Status:', response.status);
                this.showError(`Failed to request item back early: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Error requesting item back early:', error);
            console.error('❌ Error details:', error.message);
            this.showError(`An error occurred while requesting item back early: ${error.message}`);
        }
    }

    async handleConfirmReturn(exchangeId, isConfirm) {
        const action = isConfirm ? 'confirm' : 'dispute';
        const confirmed = await this.showConfirmation(
            `${isConfirm ? 'Confirm' : 'Dispute'} Return`,
            `Are you sure you want to ${action} this item return?`
        );

        if (!confirmed) {

            return;
        }
        


        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            const confirmBody = { 
                returnConfirmed: isConfirm,
                returnConfirmedAt: isConfirm ? new Date().toISOString() : null,
                returnPendingConfirmation: false
            };





            const response = await fetch(`${this.API_BASE_URL}/exchanges/${exchangeId}/confirm-return`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(confirmBody)
            });
            



            if (response.ok) {
                const updatedExchange = await response.json();

                
                // Send inbox message to the borrower about the return confirmation
                await this.sendReturnConfirmationMessage(exchangeId, isConfirm);
                
                this.showSuccess(`Return ${action}ed successfully!`);
                
                // Refresh the loaned items to update the status
                this.loanedItems = await this.getLoanedItems();
                this.renderLoanedItems();
                
                // Re-render owned items to update availability status
                this.renderOwnedItems();
                
                this.updateCounts();
                
                // Trigger global refresh for notifications and other pages
                if (window.GlobalNotifications) {
                    window.GlobalNotifications.triggerGlobalRefresh();
                }
                
            } else {
                const errorText = await response.text();
                console.error('❌ API Error Response:', errorText);
                console.error('❌ Response Status:', response.status);
                this.showError(`Failed to ${action} return: ${errorText}`);
            }
        } catch (error) {
            console.error(`❌ Error ${action}ing return:`, error);
            console.error('❌ Error details:', error.message);
            this.showError(`An error occurred while ${action}ing the return: ${error.message}`);
        }
    }

    async handleMarkAsReturned(exchangeId) {
        const confirmed = await this.showConfirmation(
            'Mark as Returned',
            'Are you sure you have received this item back from the borrower?'
        );

        if (!confirmed) {
            return;
        }

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            // Mark the exchange as completed/returned
            const returnBody = { 
                returnConfirmed: true,
                returnConfirmedAt: new Date().toISOString()
            };

            const response = await fetch(`${this.API_BASE_URL}/exchanges/${exchangeId}/mark-returned`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(returnBody)
            });

            if (response.ok) {
                // Send inbox message to the borrower about the return confirmation
                await this.sendMarkAsReturnedMessage(exchangeId);
                
                this.showSuccess('Item marked as returned successfully!');
                
                // Refresh the loaned items to update the status
                this.loanedItems = await this.getLoanedItems();
                this.renderLoanedItems();
                
                // Re-render owned items to update availability status
                this.renderOwnedItems();
                
                this.updateCounts();
                
                // Trigger global refresh for notifications and other pages
                if (window.GlobalNotifications) {
                    window.GlobalNotifications.triggerGlobalRefresh();
                }
                
            } else {
                const errorText = await response.text();
                console.error('❌ API Error Response:', errorText);
                console.error('❌ Response Status:', response.status);
                this.showError(`Failed to mark item as returned: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Error marking item as returned:', error);
            console.error('❌ Error details:', error.message);
            this.showError(`An error occurred while marking the item as returned: ${error.message}`);
        }
    }

    async sendMarkAsReturnedMessage(exchangeId) {
        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            if (!token) {
                return;
            }

            if (!this.currentUserId) {
                return;
            }
            
            // Find the exchange details from our existing loaned items data
            const loanedItem = this.loanedItems.find(item => 
                item.exchangeId === exchangeId || item.id === exchangeId
            );
            
            if (!loanedItem) {
                return;
            }
            
            const borrowerId = loanedItem.borrowerId || loanedItem.borrower?.id;
            const itemTitle = loanedItem.title || loanedItem.itemTitle || 'an item';

            if (!borrowerId) {
                return;
            }

            // Create message thread using the same approach as other messaging functions
            const threadData = {
                participantIds: [this.currentUserId, borrowerId],
                subject: `Item Return Confirmed: ${itemTitle}`
            };

            const threadResponse = await fetch(`${this.API_BASE_URL}/messages/threads`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(threadData)
            });

            if (!threadResponse.ok) {
                return;
            }

            const threadResult = await threadResponse.json();

            // Send initial message in the thread
            if (threadResult.id) {
                await this.sendMarkAsReturnedInitialMessage(threadResult.id, itemTitle, this.currentUser);
            }

        } catch (error) {
            // Error sending mark as returned message
        }
    }

    async sendMarkAsReturnedInitialMessage(threadId, itemTitle, sender) {
        try {
            // Get sender's display name
            const senderName = sender?.FirstName && sender?.LastName
                ? `${sender.FirstName} ${sender.LastName}`
                : sender?.email || 'Someone';

            // Prepare initial message
            const messageData = {
                body: `Hi! I have received "${itemTitle}" back from you. Thank you for returning it! The exchange is now complete.`,
                senderId: sender?.Id || sender?.id || sender?.userId || this.currentUserId
            };

            const messageResponse = await fetch(`${this.API_BASE_URL}/messages/threads/${threadId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hippo_token')}`
                },
                body: JSON.stringify(messageData)
            });

            if (!messageResponse.ok) {
                return;
            }

            const messageResult = await messageResponse.json();

        } catch (error) {
            // Error sending initial message
        }
    }

    async sendReturnConfirmationMessage(exchangeId, isConfirm) {
        try {

            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            if (!token) {
                console.error('❌ No authentication token found');
                return;
            }

            if (!this.currentUserId) {
                console.error('❌ No current user ID found');
                return;
            }
            
            // Get exchange details to find the borrower

            const exchangeResponse = await fetch(`${this.API_BASE_URL}/exchanges/${exchangeId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!exchangeResponse.ok) {
                console.error('❌ Could not fetch exchange details:', exchangeResponse.status, exchangeResponse.statusText);
                return;
            }

            const exchange = await exchangeResponse.json();

            
            const borrowerId = exchange.BorrowerId || exchange.borrowerId;
            const itemId = exchange.ItemId || exchange.itemId;

            if (!borrowerId) {
                console.error('❌ No borrower ID found for exchange');
                return;
            }



            // Get item details for the message

            const itemResponse = await fetch(`${this.API_BASE_URL}/items/${itemId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            let itemTitle = 'the item';
            if (itemResponse.ok) {
                const item = await itemResponse.json();
                itemTitle = item.title || item.Title || 'the item';

            } else {
                console.warn('⚠️ Could not fetch item details, using default title');
            }

            // Find existing thread with the borrower

            const existingThreadsResponse = await fetch(`${this.API_BASE_URL}/messages/threads?userId=${this.currentUserId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            let threadId;
            if (existingThreadsResponse.ok) {
                const threads = await existingThreadsResponse.json();

                
                const existingThread = threads.find(t => 
                    t.participantIds && t.participantIds.includes(borrowerId)
                );
                if (existingThread) {
                    threadId = existingThread.id || existingThread.Id;

                }
            } else {
                console.warn('⚠️ Could not fetch existing threads:', existingThreadsResponse.status);
            }

            if (!threadId) {
                console.error('❌ Could not find thread for return confirmation message');
                return;
            }

            // Send the confirmation message
            const messageText = isConfirm 
                ? `Thank you! I've confirmed that I received "${itemTitle}" back from you. The return is now complete.`
                : `I need to dispute the return of "${itemTitle}". There seems to be an issue with the item or the return process. Please contact me to resolve this.`;


            const messageData = {
                senderId: this.currentUserId,
                body: messageText
            };
            


            const messageResponse = await fetch(`${this.API_BASE_URL}/messages/threads/${threadId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(messageData)
            });



            if (!messageResponse.ok) {
                console.warn('⚠️ Failed to send confirmation message:', messageResponse.status);
                return;
            }

            const messageResult = await messageResponse.json();


        } catch (error) {
            console.error('❌ Error sending return confirmation message:', error);
        }
    }

    async handleEarlyReturnAction(exchangeId, isApprove) {
        const action = isApprove ? 'approve' : 'decline';
        const confirmed = await this.showConfirmation(
            `${isApprove ? 'Approve' : 'Decline'} Early Return`,
            `Are you sure you want to ${action} this early return request?`
        );

        if (!confirmed) {

            return;
        }
        


        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            const approvalBody = { 
                earlyReturnApproved: isApprove,
                returnPendingConfirmation: isApprove ? true : false
            };





            const response = await fetch(`${this.API_BASE_URL}/exchanges/${exchangeId}/early-return`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(approvalBody)
            });
            



            if (response.ok) {
                const updatedExchange = await response.json();

                
                // Send inbox message to the borrower about the approval/decline
                await this.sendEarlyReturnResponseMessage(exchangeId, isApprove);
                
                this.showSuccess(`Early return request ${action}d successfully!`);
                
                // Refresh the loaned items to update the status
                this.loanedItems = await this.getLoanedItems();
                this.renderLoanedItems();
                
                // Re-render owned items to update availability status
                this.renderOwnedItems();
                
                this.updateCounts();
                
                // Trigger global refresh for notifications and other pages
                if (window.GlobalNotifications) {
                    window.GlobalNotifications.triggerGlobalRefresh();
                }
                
            } else {
                const errorText = await response.text();
                console.error('❌ API Error Response:', errorText);
                console.error('❌ Response Status:', response.status);
                this.showError(`Failed to ${action} early return request: ${errorText}`);
            }
        } catch (error) {
            console.error(`❌ Error ${action}ing early return request:`, error);
            console.error('❌ Error details:', error.message);
            this.showError(`An error occurred while ${action}ing the early return request: ${error.message}`);
        }
    }

    async sendEarlyReturnResponseMessage(exchangeId, isApprove) {
        try {

            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            if (!token) {
                console.error('❌ No authentication token found');
                return;
            }

            if (!this.currentUserId) {
                console.error('❌ No current user ID found');
                return;
            }
            
            // Get exchange details to find the borrower

            const exchangeResponse = await fetch(`${this.API_BASE_URL}/exchanges/${exchangeId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!exchangeResponse.ok) {
                console.error('❌ Could not fetch exchange details:', exchangeResponse.status, exchangeResponse.statusText);
                return;
            }

            const exchange = await exchangeResponse.json();

            
            const borrowerId = exchange.BorrowerId || exchange.borrowerId;
            const itemId = exchange.ItemId || exchange.itemId;

            if (!borrowerId) {
                console.error('❌ No borrower ID found for exchange');
                return;
            }



            // Get item details for the message

            const itemResponse = await fetch(`${this.API_BASE_URL}/items/${itemId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            let itemTitle = 'the item';
            if (itemResponse.ok) {
                const item = await itemResponse.json();
                itemTitle = item.title || item.Title || 'the item';

            } else {
                console.warn('⚠️ Could not fetch item details, using default title');
            }

            // Find existing thread with the borrower

            const existingThreadsResponse = await fetch(`${this.API_BASE_URL}/messages/threads?userId=${this.currentUserId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            let threadId;
            if (existingThreadsResponse.ok) {
                const threads = await existingThreadsResponse.json();

                
                const existingThread = threads.find(t => 
                    t.participantIds && t.participantIds.includes(borrowerId)
                );
                if (existingThread) {
                    threadId = existingThread.id || existingThread.Id;

                }
            } else {
                console.warn('⚠️ Could not fetch existing threads:', existingThreadsResponse.status);
            }

            if (!threadId) {
                console.error('❌ Could not find thread for early return response message');
                return;
            }

            // Send the response message
            const messageText = isApprove 
                ? `Great! I've approved your early return request for "${itemTitle}". Please return it when convenient, and I'll confirm receipt once I receive it.`
                : `I'm sorry, but I cannot approve the early return request for "${itemTitle}" at this time. Please keep it until the original return date.`;


            const messageData = {
                senderId: this.currentUserId,
                body: messageText
            };
            


            const messageResponse = await fetch(`${this.API_BASE_URL}/messages/threads/${threadId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(messageData)
            });



            if (!messageResponse.ok) {
                console.warn('⚠️ Failed to send response message:', messageResponse.status);
                return;
            }

            const messageResult = await messageResponse.json();


        } catch (error) {
            console.error('❌ Error sending early return response message:', error);
        }
    }

    isItemCurrentlyLoaned(itemId) {
        // Check if the item is currently loaned out by looking at the loaned items
        return this.loanedItems.some(loanedItem => 
            loanedItem.itemId === itemId || loanedItem.id === itemId
        );
    }

    createItemCard(item, type) {
        const template = document.getElementById('asset-card-template');
        const card = template.content.cloneNode(true);

        const article = card.querySelector('article');
        article.setAttribute('data-id', item.id);

        // Set image - try multiple possible image fields
        const img = card.querySelector('.card-img');
        
        // Debug logging for image fields
        console.log('🖼️ Asset Hub - Item image data:', {
            id: item.id,
            title: item.title,
            imageUrl: item.imageUrl,
            ImageUrl: item.ImageUrl,
            pictures: item.pictures,
            Pictures: item.Pictures,
            images: item.images,
            Images: item.Images
        });
        
        const imageUrl = item.imageUrl || 
                        item.ImageUrl || 
                        (item.pictures && item.pictures[0]) || 
                        (item.Pictures && item.Pictures[0]) ||
                        (item.images && item.images[0]) ||
                        (item.Images && item.Images[0]);
        

        
        if (imageUrl) {
            img.src = imageUrl;
        } else {
            img.src = 'https://placehold.co/400x300/ffffff/111111?text=' + encodeURIComponent(item.title);
        }
        img.alt = item.title;

        // Set title and description
        card.querySelector('.title').textContent = item.title;
        if (type === 'borrowed') {
            // For borrowed items, show borrowing details
            const description = item.description || 'No description provided';
            const ownerInfo = item.ownerName ? ` • From: ${item.ownerName}` : (item.ownerId ? ` • From: ${item.ownerId}` : '');
            const statusInfo = item.approved === true ? ' • Approved' : (item.approved === false ? ' • Denied' : ' • Pending');
            card.querySelector('.description').textContent = `${description}${ownerInfo}${statusInfo}`;
        } else if (type === 'loaned') {
            // For loaned items, show who is borrowing
            const description = item.description || 'No description provided';
            const borrowerInfo = item.borrowerName ? ` • Loaned to: ${item.borrowerName}` : (item.borrowerId ? ` • Loaned to: ${item.borrowerId}` : '');
            const statusInfo = ' • Loaned Out';
            card.querySelector('.description').textContent = `${description}${borrowerInfo}${statusInfo}`;
        } else {
            card.querySelector('.description').textContent = item.description || 'No description provided';
        }

        // Set created date
        const createdDate = new Date(item.createdUtc);
        card.querySelector('.created-date').textContent = createdDate.toLocaleDateString();

        // Set availability status
        const statusBadge = card.querySelector('.status-badge');
        if (type === 'borrowed') {
            // For borrowed items, show borrowing status
            if (item.approved === true) {
                statusBadge.textContent = 'Approved';
                statusBadge.className = 'badge status-badge bg-green-500';
            } else if (item.approved === false) {
                statusBadge.textContent = 'Denied';
                statusBadge.className = 'badge status-badge bg-red-500';
            } else if (item.status === 'pending' || item.status === 'Pending') {
                statusBadge.textContent = 'Pending';
                statusBadge.className = 'badge status-badge bg-yellow-500';
            } else if (item.status === 'active' || item.status === 'Active') {
                statusBadge.textContent = 'Active';
                statusBadge.className = 'badge status-badge bg-blue-500';
            } else {
                statusBadge.textContent = item.status || 'Borrowed';
                statusBadge.className = 'badge status-badge bg-purple-500';
            }
        } else if (type === 'loaned') {
            // For loaned items, show loaned out status
            statusBadge.textContent = 'Loaned Out';
            statusBadge.className = 'badge status-badge bg-blue-500';
        } else {
            // For owned items, determine availability based on whether item is currently loaned out
            const isCurrentlyLoaned = this.isItemCurrentlyLoaned(item.id);
            
            if (isCurrentlyLoaned) {
                statusBadge.textContent = 'Unavailable';
                statusBadge.className = 'badge status-badge bg-red-500';
            } else {
                statusBadge.textContent = 'Available';
                statusBadge.className = 'badge status-badge bg-green-500';
            }
        }

        // Setup event listeners
        const dropdownBtn = card.querySelector('.dropdown-btn');
        const dropdownMenu = card.querySelector('.dropdown-menu');
        const editBtn = card.querySelector('.edit-btn');
        const viewBtn = card.querySelector('.view-btn');
        const deleteBtn = card.querySelector('.delete-btn');
        const maintenanceBtn = card.querySelector('.maintenance-btn');
        
        // Immediately set data-item-id on all buttons when found
        if (editBtn) {
            editBtn.setAttribute('data-item-id', item.id);

        }
        if (maintenanceBtn) {
            maintenanceBtn.setAttribute('data-item-id', item.id);

        }
        if (deleteBtn) {
            deleteBtn.setAttribute('data-item-id', item.id);

        }
        





        
        // Test if buttons are clickable
        if (editBtn) {

            console.log('🔍 Edit button display style:', window.getComputedStyle(editBtn).display);
        }
        if (maintenanceBtn) {

            console.log('🔍 Maintenance button display style:', window.getComputedStyle(maintenanceBtn).display);
        }
        
        // Add a global test function for this specific item
        window.testButtons = () => {

            if (editBtn) {

                editBtn.click();
            }
            if (maintenanceBtn) {

                maintenanceBtn.click();
            }
        };


        // Dropdown functionality
        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other dropdowns
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    if (menu !== dropdownMenu) {
                        menu.classList.remove('show');
                    }
                });
                // Toggle current dropdown
                dropdownMenu.classList.toggle('show');
            });
        }

        // Close dropdown when clicking outside
        if (dropdownBtn && dropdownMenu) {
            document.addEventListener('click', (e) => {
                if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                    dropdownMenu.classList.remove('show');
                }
            });
        }



        if (type === 'owned') {

            // Hide cancel request button for owned items
            const cancelRequestBtn = card.querySelector('.cancel-request-btn');
            if (cancelRequestBtn) {
                cancelRequestBtn.style.display = 'none';
            }
        } else if (type === 'borrowed') {
            // For borrowed items, add return buttons based on status
            const dropdownMenu = card.querySelector('.dropdown-menu');
            if (dropdownMenu) {
                // Hide buttons that don't apply to borrowed items
                const editBtn = card.querySelector('.edit-btn');
                const deleteBtn = card.querySelector('.delete-btn');
                const maintenanceBtn = card.querySelector('.maintenance-btn');
                const cancelRequestBtn = card.querySelector('.cancel-request-btn');
                
                if (editBtn) editBtn.style.display = 'none';
                if (deleteBtn) deleteBtn.style.display = 'none';
                if (maintenanceBtn) maintenanceBtn.style.display = 'none';
                if (cancelRequestBtn) cancelRequestBtn.style.display = 'none';
                
                // Check if item is approved and not already returned
                const isApproved = item.approved === true || item.Approved === true;
                const isReturned = item.endDate && new Date(item.endDate) <= new Date();
                const isPendingReturn = item.returnPendingConfirmation === true;
                const canRequestEarlyReturn = isApproved && !isReturned && !isPendingReturn && 
                    item.endDate && new Date() < new Date(item.endDate);
                
                if (canRequestEarlyReturn) {
                    // Add early return request button
                    const earlyReturnRequestBtn = document.createElement('button');
                    earlyReturnRequestBtn.className = 'dropdown-item w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center';
                    earlyReturnRequestBtn.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Request Early Return
                    `;
                    
                    dropdownMenu.appendChild(earlyReturnRequestBtn);
                    
                    earlyReturnRequestBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dropdownMenu) dropdownMenu.classList.remove('show');
                        this.handleEarlyReturnRequest(item.exchangeId || item.id);
                    });
                }
                
                // Note: Borrowers cannot mark items as returned directly
                // They can only request early returns, which the owner must approve
                // The owner will then confirm receipt when they actually receive the item
            }
        } else if (type === 'loaned') {
            // For loaned items, add early return approval buttons and return confirmation buttons
            const dropdownMenu = card.querySelector('.dropdown-menu');
            if (dropdownMenu) {
                // Remove buttons that don't apply to loaned items
                const editBtn = card.querySelector('.edit-btn');
                const deleteBtn = card.querySelector('.delete-btn');
                const maintenanceBtn = card.querySelector('.maintenance-btn');
                const cancelRequestBtn = card.querySelector('.cancel-request-btn');
                
                if (editBtn) editBtn.remove();
                if (deleteBtn) deleteBtn.remove();
                if (maintenanceBtn) maintenanceBtn.remove();
                if (cancelRequestBtn) cancelRequestBtn.remove();
                
                // Check if there's a pending return confirmation
                const isPendingReturn = item.returnPendingConfirmation === true;
                
                // Check if there's a pending early return request (returnRequestedAt is not null)
                const hasEarlyReturnRequest = item.returnRequestedAt !== null && item.returnRequestedAt !== undefined;
                
                if (isPendingReturn) {
                    // Add return confirmation buttons
                    const confirmReturnBtn = document.createElement('button');
                    confirmReturnBtn.className = 'dropdown-item w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center';
                    confirmReturnBtn.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        Confirm Return
                    `;
                    
                    const disputeReturnBtn = document.createElement('button');
                    disputeReturnBtn.className = 'dropdown-item w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center';
                    disputeReturnBtn.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Dispute Return
                    `;
                    
                    dropdownMenu.appendChild(confirmReturnBtn);
                    dropdownMenu.appendChild(disputeReturnBtn);
                    
                    confirmReturnBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dropdownMenu) dropdownMenu.classList.remove('show');
                        this.handleConfirmReturn(item.exchangeId || item.id, true);
                    });
                    
                    disputeReturnBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dropdownMenu) dropdownMenu.classList.remove('show');
                        this.handleConfirmReturn(item.exchangeId || item.id, false);
                    });
                } else if (hasEarlyReturnRequest) {
                    // Add early return approval buttons (for early return requests)
                    const earlyReturnApproveBtn = document.createElement('button');
                    earlyReturnApproveBtn.className = 'dropdown-item w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center';
                    earlyReturnApproveBtn.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        Approve Early Return
                    `;
                    
                    const earlyReturnDeclineBtn = document.createElement('button');
                    earlyReturnDeclineBtn.className = 'dropdown-item w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center';
                    earlyReturnDeclineBtn.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Decline Early Return
                    `;
                    
                    dropdownMenu.appendChild(earlyReturnApproveBtn);
                    dropdownMenu.appendChild(earlyReturnDeclineBtn);
                    
                    earlyReturnApproveBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dropdownMenu) dropdownMenu.classList.remove('show');
                        this.handleEarlyReturnAction(item.exchangeId || item.id, true);
                    });
                    
                    earlyReturnDeclineBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dropdownMenu) dropdownMenu.classList.remove('show');
                        this.handleEarlyReturnAction(item.exchangeId || item.id, false);
                    });
                } else {
                    // Add "Mark as Returned" button for loaned out items
                    const markReturnedBtn = document.createElement('button');
                    markReturnedBtn.className = 'dropdown-item w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center';
                    markReturnedBtn.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                        Mark as Returned
                    `;
                    
                    dropdownMenu.appendChild(markReturnedBtn);
                    
                    markReturnedBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dropdownMenu) dropdownMenu.classList.remove('show');
                        this.handleMarkAsReturned(item.exchangeId || item.id);
                    });
                    
                    // Add "Request Item Back Early" button for loaned out items
                    const requestBackBtn = document.createElement('button');
                    requestBackBtn.className = 'dropdown-item w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center';
                    requestBackBtn.innerHTML = `
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Request Item Back Early
                    `;
                    
                    dropdownMenu.appendChild(requestBackBtn);
                    
                    requestBackBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dropdownMenu) dropdownMenu.classList.remove('show');
                        this.handleRequestItemBackEarly(item.exchangeId || item.id);
                    });
                }
            }
            
            if (editBtn) {

                editBtn.style.display = 'block';
                
                // Add data attributes for event delegation
                editBtn.setAttribute('data-item-id', item.id);
                editBtn.setAttribute('data-action', 'edit');
                
                // Use multiple event binding approaches
                editBtn.onclick = (e) => {

                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openEditModal(item);
                };
                
                editBtn.addEventListener('click', (e) => {

                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openEditModal(item);
                });
            } else {

            }
            if (deleteBtn) {

                deleteBtn.style.display = 'block';
                
                // Use a more direct approach
                deleteBtn.onclick = (e) => {

                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openDeleteModal(item);
                };
            }
            // Show maintenance button for owned items
            if (maintenanceBtn) {

                maintenanceBtn.style.display = 'block';
                
                // Add data attributes for event delegation
                maintenanceBtn.setAttribute('data-item-id', item.id);
                maintenanceBtn.setAttribute('data-action', 'maintenance');
                

                console.log('🔧 Maintenance button data-item-id after setting:', maintenanceBtn.getAttribute('data-item-id'));
                
                // Use multiple event binding approaches
                maintenanceBtn.onclick = (e) => {

                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openMaintenanceModal(item);
                };
                
                maintenanceBtn.addEventListener('click', (e) => {

                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openMaintenanceModal(item);
                });
            } else {

            }
        } else {
            console.log('🔍 Processing non-owned item (type:', type, ') for:', item.title);
            // For borrowed items, hide edit, delete, and maintenance buttons
            if (editBtn) editBtn.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (maintenanceBtn) maintenanceBtn.style.display = 'none';
            
            // Show cancel request button for pending borrowed items
            const cancelRequestBtn = card.querySelector('.cancel-request-btn');
            if (cancelRequestBtn) {
                if (!item.approved && (item.status === 'pending' || item.status === 'Pending')) {
                    cancelRequestBtn.style.display = 'block';
                    cancelRequestBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dropdownMenu) dropdownMenu.classList.remove('show');
                        this.cancelRequest(item);
                    });
                } else {
                    cancelRequestBtn.style.display = 'none';
                }
            }
        }

        if (viewBtn) {
            viewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dropdownMenu) dropdownMenu.classList.remove('show');
                this.viewItem(item);
            });
        }

        return card;
    }

    showOwnedItems() {
        document.getElementById('owned-section').classList.remove('hidden');
        document.getElementById('borrowed-section').classList.add('hidden');
        document.getElementById('requested-section').classList.add('hidden');
        document.getElementById('loaned-section').classList.add('hidden');

        // Update tab styles
        document.getElementById('owned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-blue-500 text-white shadow-md';
        document.getElementById('borrowed-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
        document.getElementById('requested-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
        document.getElementById('loaned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
    }

    showBorrowedItems() {
        document.getElementById('owned-section').classList.add('hidden');
        document.getElementById('borrowed-section').classList.remove('hidden');
        document.getElementById('requested-section').classList.add('hidden');
        document.getElementById('loaned-section').classList.add('hidden');

        // Update tab styles
        document.getElementById('borrowed-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-blue-500 text-white shadow-md';
        document.getElementById('owned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
        document.getElementById('requested-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
        document.getElementById('loaned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
    }

    showRequestedItems() {
        document.getElementById('owned-section').classList.add('hidden');
        document.getElementById('borrowed-section').classList.add('hidden');
        document.getElementById('requested-section').classList.remove('hidden');
        document.getElementById('loaned-section').classList.add('hidden');

        // Update tab styles
        document.getElementById('requested-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-blue-500 text-white shadow-md';
        document.getElementById('owned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
        document.getElementById('borrowed-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
        document.getElementById('loaned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
    }

    showLoanedItems() {
        document.getElementById('owned-section').classList.add('hidden');
        document.getElementById('borrowed-section').classList.add('hidden');
        document.getElementById('requested-section').classList.add('hidden');
        document.getElementById('loaned-section').classList.remove('hidden');

        // Update tab styles
        document.getElementById('loaned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-blue-500 text-white shadow-md';
        document.getElementById('owned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
        document.getElementById('borrowed-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
        document.getElementById('requested-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
    }

    updateCounts() {
        document.getElementById('owned-count').textContent = this.ownedItems.length;
        document.getElementById('borrowed-count').textContent = this.borrowedItems.length;
        document.getElementById('requested-count').textContent = this.requestedItems.length;
        document.getElementById('loaned-count').textContent = this.loanedItems.length;
    }

    async refreshUserProfile() {
        try {
            // Refresh the current user's profile data to update counters
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            if (!token) return;

            const response = await fetch(`${this.API_BASE_URL}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const updatedUser = await response.json();
                // Update localStorage with fresh user data
                localStorage.setItem('hippo_user', JSON.stringify(updatedUser));

            }
        } catch (error) {
            console.error('Error refreshing user profile:', error);
        }
    }

    async openEditModal(item) {
        this.currentEditingItem = item;


        console.log('🔍 Item keys:', Object.keys(item));
        
        // Check if modal exists
        const editModal = document.getElementById('edit-item-modal');
        if (!editModal) {
            console.error('❌ Edit modal not found!');
            alert('Edit modal not found. Please refresh the page.');
            return;
        }


        // Wait a moment to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Populate the edit form with current item data
        const titleInput = document.getElementById('edit-item-title-input');
        const descriptionInput = document.getElementById('edit-item-description-input');
        const categoryInput = document.getElementById('edit-item-category-input');
        const conditionInput = document.getElementById('edit-item-condition-input');
        const availableInput = document.getElementById('edit-item-available-input');
        const locationInput = document.getElementById('edit-item-location-input');

        console.log('🔍 Form elements found:', {
            titleInput: !!titleInput,
            descriptionInput: !!descriptionInput,
            categoryInput: !!categoryInput,
            conditionInput: !!conditionInput,
            availableInput: !!availableInput,
            locationInput: !!locationInput
        });

        if (!titleInput || !descriptionInput || !categoryInput || !conditionInput || !availableInput || !locationInput) {
            console.error('❌ Some form elements not found!');
            return;
        }

        // Set values with fallbacks for different field name variations
        const titleValue = item.Title || item.title || '';
        const descriptionValue = item.Description || item.description || '';
        const categoryValue = item.Category || item.category || '';
        const conditionValue = item.Condition || item.condition || '';
        const availableValue = (item.Available !== undefined ? item.Available : (item.available !== undefined ? item.available : true)).toString();
        const locationValue = item.Location || item.location || '';

        console.log('🔍 Setting values:', {
            titleValue,
            descriptionValue,
            categoryValue,
            conditionValue,
            availableValue,
            locationValue
        });

        titleInput.value = titleValue;
        descriptionInput.value = descriptionValue;
        categoryInput.value = categoryValue;
        conditionInput.value = conditionValue;
        availableInput.value = availableValue;
        locationInput.value = locationValue;

        // Load and display current photos
        this.editCurrentPhotos = item.Pictures || item.pictures || item.Images || item.images || [];
        this.editNewPhotos = [];
        this.editNewPhotoFiles = [];
        this.renderEditPhotos();



        // Show the modal
        const showModal = document.getElementById('edit-item-modal');
        if (showModal) {
            // Reset all inline styles first
            showModal.style.display = '';
            showModal.style.visibility = '';
            showModal.style.opacity = '';
            showModal.style.zIndex = '';
            
            // Add active class
            showModal.classList.add('active');
            
            // Force modal to be visible
            showModal.style.display = 'flex';
            showModal.style.position = 'fixed';
            showModal.style.top = '0';
            showModal.style.left = '0';
            showModal.style.width = '100%';
            showModal.style.height = '100%';
            showModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            showModal.style.zIndex = '9999';
            



        } else {
            console.error('❌ Modal element not found!');
        }
    }

    closeEditModal() {
        const modal = document.getElementById('edit-item-modal');
        if (modal) {
            // Remove active class
            modal.classList.remove('active');
            
            // Force hide with inline styles
            modal.style.display = 'none';
            modal.style.visibility = 'hidden';
            modal.style.opacity = '0';
            modal.style.zIndex = '-1';
            

        }
        
        // Reset photo management
        this.editCurrentPhotos = [];
        this.editNewPhotos = [];
        this.editNewPhotoFiles = [];
        this.currentEditingItem = null;
    }

    async handleEditSubmit(e) {
        e.preventDefault();

        if (!this.currentEditingItem) return;

        const formData = {
            title: document.getElementById('edit-item-title-input').value,
            description: document.getElementById('edit-item-description-input').value,
            category: document.getElementById('edit-item-category-input').value,
            condition: document.getElementById('edit-item-condition-input').value,
            available: document.getElementById('edit-item-available-input').value === 'true',
            location: document.getElementById('edit-item-location-input').value,
            pictures: this.editCurrentPhotos, // Updated photos list
            ownerId: this.currentEditingItem.ownerId || this.currentEditingItem.userId
        };

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            
            // If there are new photos to upload, handle them first
            if (this.editNewPhotoFiles.length > 0) {
                await this.uploadNewPhotos();
            }
            
            const response = await fetch(`${this.API_BASE_URL}/items/${this.currentEditingItem.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const updatedItem = await response.json();

                // Update local data
                const index = this.ownedItems.findIndex(item => item.id === this.currentEditingItem.id);
                if (index !== -1) {
                    this.ownedItems[index] = updatedItem;
                }

                this.renderOwnedItems();
                this.closeEditModal();
                this.showSuccess('Item updated successfully!');
            } else {
                throw new Error('Failed to update item');
            }
        } catch (error) {
            console.error('Error updating item:', error);
            this.showError('Failed to update item. Please try again.');
        }
    }

    renderEditPhotos() {
        const photosGrid = document.getElementById('edit-photos-grid');
        const newPhotosGrid = document.getElementById('edit-new-photos-grid');
        const newPhotosSection = document.getElementById('edit-new-photos');
        const photoCount = document.getElementById('edit-photo-count');

        // Update photo count
        photoCount.textContent = this.editCurrentPhotos.length;

        // Render current photos
        photosGrid.innerHTML = '';
        this.editCurrentPhotos.forEach((photo, index) => {
            const photoItem = document.createElement('div');
            photoItem.className = 'relative group bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200';
            photoItem.innerHTML = `
                <div class="relative aspect-square">
                    <img src="${photo}" alt="Current photo ${index + 1}" 
                         class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200"></div>
                    <button type="button" 
                            class="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-lg"
                            onclick="window.assetHub.removeEditCurrentPhoto(${index})"
                            title="Remove photo">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            `;
            photosGrid.appendChild(photoItem);
        });

        // Render new photos
        if (this.editNewPhotos.length > 0) {
            newPhotosSection.classList.remove('hidden');
            newPhotosGrid.innerHTML = '';
            this.editNewPhotos.forEach((photo, index) => {
                const photoItem = document.createElement('div');
                photoItem.className = 'relative group bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200';
                photoItem.innerHTML = `
                    <div class="relative aspect-square">
                        <img src="${photo}" alt="New photo ${index + 1}" 
                             class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200"></div>
                        <button type="button" 
                                class="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-lg"
                                onclick="window.assetHub.removeEditNewPhoto(${index})"
                                title="Remove photo">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                `;
                newPhotosGrid.appendChild(photoItem);
            });
        } else {
            newPhotosSection.classList.add('hidden');
        }
    }

    handleEditPhotoUpload(e) {
        const files = Array.from(e.target.files);

        // Validation
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        const MAX_FILES = 10;
        const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

        if (files.length > MAX_FILES) {
            this.showError(`Maximum ${MAX_FILES} photos allowed`);
            e.target.value = '';
            return;
        }

        const invalidFiles = files.filter(file =>
            file.size > MAX_SIZE || !ALLOWED_TYPES.includes(file.type)
        );

        if (invalidFiles.length > 0) {
            this.showError('Some files are too large (max 5MB) or invalid format (JPG/PNG only)');
            e.target.value = '';
            return;
        }

        // Store files and create preview URLs
        this.editNewPhotoFiles = files;
        this.editNewPhotos = files.map(file => URL.createObjectURL(file));
        this.renderEditPhotos();

        this.showSuccess(`✅ ${files.length} photo${files.length > 1 ? 's' : ''} added`);
        e.target.value = '';
    }

    removeEditCurrentPhoto(index) {
        this.editCurrentPhotos.splice(index, 1);
        this.renderEditPhotos();
        this.showSuccess('Photo removed');
    }

    removeEditNewPhoto(index) {
        this.editNewPhotos.splice(index, 1);
        this.editNewPhotoFiles.splice(index, 1);
        this.renderEditPhotos();
        this.showSuccess('Photo removed');
    }

    async uploadNewPhotos() {
        const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
        const uploadedUrls = [];

        for (const file of this.editNewPhotoFiles) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`${this.API_BASE_URL}/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    uploadedUrls.push(result.url);
                } else {
                    throw new Error(`Failed to upload ${file.name}`);
                }
            } catch (error) {
                console.error('Error uploading photo:', error);
                throw new Error(`Failed to upload ${file.name}`);
            }
        }

        // Add uploaded URLs to current photos
        this.editCurrentPhotos.push(...uploadedUrls);
        
        // Clear new photos
        this.editNewPhotos = [];
        this.editNewPhotoFiles = [];
        
        return uploadedUrls;
    }

    // Make functions globally available for onclick handlers
    setupGlobalFunctions() {
        window.removeEditCurrentPhoto = (index) => this.removeEditCurrentPhoto(index);
        window.removeEditNewPhoto = (index) => this.removeEditNewPhoto(index);
    }

    openDeleteModal(item) {
        this.currentDeletingItem = item;
        document.getElementById('delete-modal').classList.add('active');
    }

    closeDeleteModal() {
        document.getElementById('delete-modal').classList.remove('active');
        this.currentDeletingItem = null;
    }

    async handleDeleteConfirm() {
        if (!this.currentDeletingItem) return;

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(`${this.API_BASE_URL}/items/${this.currentDeletingItem.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Remove from local data
                this.ownedItems = this.ownedItems.filter(item => item.id !== this.currentDeletingItem.id);

                this.renderOwnedItems();
                this.updateCounts();
                this.closeDeleteModal();
                this.showSuccess('Item deleted successfully!');
            } else {
                throw new Error('Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            this.showError('Failed to delete item. Please try again.');
        }
    }

    viewItem(item) {
        // Navigate to item detail page
        window.location.href = `./listing.html?id=${item.id}`;
    }

    async openMaintenanceModal(item) {
        this.currentMaintenanceItem = item;




        // Check if maintenance form exists
        const maintenanceForm = document.getElementById('maintenance-form');
        if (!maintenanceForm) {
            console.error('❌ Maintenance form not found!');
            this.showError('Maintenance form not found. Please refresh the page.');
            return;
        }

        // Reset form
        maintenanceForm.reset();

        // Check if this is a borrowed item (borrowed items should only allow history)
        const isBorrowedItem = !this.ownedItems.some(ownedItem => ownedItem.id === item.id);

        if (isBorrowedItem) {
            // For borrowed items, hide the "Required" option and set default to "History"
            const requiredRadio = document.querySelector('input[name="maintenance-type"][value="required"]');
            const historyRadio = document.querySelector('input[name="maintenance-type"][value="history"]');
            const requiredLabel = requiredRadio?.closest('label');

            if (requiredLabel) {
                requiredLabel.style.display = 'none';
            }

            if (historyRadio) {
                historyRadio.checked = true;
            }

            this.toggleFrequencyField(false);
        } else {
            // For owned items, show both options and default to "Required"
            const requiredRadio = document.querySelector('input[name="maintenance-type"][value="required"]');
            const requiredLabel = requiredRadio?.closest('label');

            if (requiredLabel) {
                requiredLabel.style.display = 'flex';
            }

            if (requiredRadio) {
                requiredRadio.checked = true;
            }

            this.toggleFrequencyField(true);
        }

        // Maintenance history section removed - no longer loading history

        // Show modal
        const maintenanceModal = document.getElementById('maintenance-modal');
        if (!maintenanceModal) {
            console.error('❌ Maintenance modal not found!');
            alert('Maintenance modal not found. Please refresh the page.');
            return;
        }
        



        
        // Reset all inline styles first
        maintenanceModal.style.display = '';
        maintenanceModal.style.visibility = '';
        maintenanceModal.style.opacity = '';
        maintenanceModal.style.zIndex = '';
        
        // Add active class
        maintenanceModal.classList.add('active');
        
        // Force modal to be visible with all necessary styles
        maintenanceModal.style.display = 'flex';
        maintenanceModal.style.position = 'fixed';
        maintenanceModal.style.top = '0';
        maintenanceModal.style.left = '0';
        maintenanceModal.style.width = '100%';
        maintenanceModal.style.height = '100%';
        maintenanceModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        maintenanceModal.style.zIndex = '9999';
        




        
        // Test if modal is visible
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(maintenanceModal);



        }, 100);
    }

    closeMaintenanceModal() {
        const modal = document.getElementById('maintenance-modal');
        if (modal) {
            // Remove active class
            modal.classList.remove('active');
            
            // Force hide with inline styles
            modal.style.display = 'none';
            modal.style.visibility = 'hidden';
            modal.style.opacity = '0';
            modal.style.zIndex = '-1';
            

        }
        
        document.getElementById('maintenance-form').reset();
        this.currentMaintenanceReceipts = [];
        document.getElementById('receipt-preview').innerHTML = '';

        // Restore the "Required" option visibility for next time
        const requiredLabel = document.querySelector('input[name="maintenance-type"][value="required"]')?.closest('label');
        if (requiredLabel) {
            requiredLabel.style.display = 'flex';
        }

        this.currentMaintenanceItem = null;
    }

    toggleFrequencyField(show) {
        const frequencySection = document.getElementById('frequency-section');
        const frequencyInput = document.getElementById('maintenance-frequency-input');
        const receiptSection = document.getElementById('receipt-section');

        if (show) {
            frequencySection.style.display = 'block';
            frequencyInput.required = true;
            receiptSection.style.display = 'none';
        } else {
            frequencySection.style.display = 'none';
            frequencyInput.required = false;
            frequencyInput.value = ''; // Clear the value when hidden
            receiptSection.style.display = 'block';
        }
    }

    handleReceiptUpload(e) {
        const files = Array.from(e.target.files);
        
        // Validate files
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        
        const validFiles = files.filter(file => {
            if (file.size > MAX_SIZE) {
                this.showError(`File ${file.name} is too large (max 5MB)`);
                return false;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                this.showError(`File ${file.name} is not a valid image format`);
                return false;
            }
            return true;
        });

        // Store valid files
        this.currentMaintenanceReceipts = validFiles;
        
        // Update preview
        this.updateReceiptPreview();
    }

    updateReceiptPreview() {
        const receiptPreview = document.getElementById('receipt-preview');
        receiptPreview.innerHTML = '';
        
        this.currentMaintenanceReceipts.forEach((file, index) => {
            const preview = document.createElement('div');
            preview.className = 'flex items-center gap-2 p-2 bg-slate-700 rounded';
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'w-12 h-12 object-cover rounded';
            
            const info = document.createElement('div');
            info.className = 'flex-1 text-sm text-slate-300';
            info.textContent = file.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'text-red-400 hover:text-red-300';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                this.currentMaintenanceReceipts.splice(index, 1);
                this.updateReceiptPreview();
            };
            
            preview.appendChild(img);
            preview.appendChild(info);
            preview.appendChild(removeBtn);
            receiptPreview.appendChild(preview);
        });
    }

    async loadMaintenanceHistory(itemId) {
        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(`${this.API_BASE_URL}/maintenance?itemId=${itemId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                const maintenance = await response.json();
                this.renderMaintenanceHistory(maintenance);
            } else {
                // Use mock data if API fails
                const mockMaintenance = [
                    {
                        id: 'maint1',
                        date: '2024-01-15',
                        type: 'history',
                        description: 'Deep cleaned and sanitized all cutting surfaces with food-safe cleaner',
                        frequency: null
                    },
                    {
                        id: 'maint2',
                        date: '2024-01-01',
                        type: 'required',
                        description: 'Regular maintenance check - oil change and filter replacement',
                        frequency: 'monthly'
                    },
                    {
                        id: 'maint3',
                        date: '2023-12-15',
                        type: 'history',
                        description: 'Replaced worn out parts and performed calibration',
                        frequency: null
                    }
                ];
                this.renderMaintenanceHistory(mockMaintenance);
            }
        } catch (error) {
            console.error('Error loading maintenance history:', error);
            this.renderMaintenanceHistory([]);
        }
    }

    async loadItemMaintenance(itemId) {
        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(`${this.API_BASE_URL}/maintenance?itemId=${itemId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            if (response.ok) {
                const maintenance = await response.json();
                this.renderEditMaintenance(maintenance);
            } else {
                // Use mock data if API fails
                const mockMaintenance = [
                    {
                        id: 'maint1',
                        date: '2024-01-15',
                        type: 'cleaning',
                        description: 'Deep cleaned and sanitized all cutting surfaces with food-safe cleaner',
                        cost: 0
                    },
                    {
                        id: 'maint2',
                        date: '2024-01-01',
                        type: 'maintenance',
                        description: 'Reapplied food-safe mineral oil finish to maintain wood quality',
                        cost: 15.50
                    }
                ];
                this.renderEditMaintenance(mockMaintenance);
            }
        } catch (error) {
            console.error('Error loading maintenance:', error);
            this.renderEditMaintenance([]);
        }
    }

    renderMaintenanceHistory(maintenanceList) {
        const container = document.getElementById('maintenance-history-list');
        const empty = document.getElementById('maintenance-history-empty');

        if (!maintenanceList || maintenanceList.length === 0) {
            container.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        container.innerHTML = '';

        // Sort maintenance by date (newest first)
        const sortedMaintenance = [...maintenanceList].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedMaintenance.forEach(maintenance => {
            const entry = document.createElement('div');
            entry.className = 'glass p-3 rounded-lg border-l-4';

            const typeColors = {
                required: 'border-blue-500',
                history: 'border-green-500',
                cleaning: 'border-green-500',
                repair: 'border-red-500',
                inspection: 'border-yellow-500',
                upgrade: 'border-purple-500',
                maintenance: 'border-blue-500'
            };

            entry.className = `glass p-3 rounded-lg border-l-4 ${typeColors[maintenance.type] || 'border-blue-500'}`;

            const typeLabel = maintenance.type === 'required' ? 'Required' :
                maintenance.type === 'history' ? 'History' :
                    maintenance.type.charAt(0).toUpperCase() + maintenance.type.slice(1);

            const frequencyText = maintenance.frequency ? ` • ${maintenance.frequency}` : '';

            entry.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                ${typeLabel}
                            </span>
                            <span class="text-sm text-slate-600">${new Date(maintenance.date).toLocaleDateString()}</span>
                            ${frequencyText ? `<span class="text-sm text-slate-500">${frequencyText}</span>` : ''}
                        </div>
                        <p class="text-slate-700 text-sm">${maintenance.description}</p>
                    </div>
                </div>
            `;

            container.appendChild(entry);
        });
    }

    renderEditMaintenance(maintenanceList) {
        const container = document.getElementById('edit-maintenance-list');
        const empty = document.getElementById('edit-maintenance-empty');

        if (!maintenanceList || maintenanceList.length === 0) {
            container.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        container.innerHTML = '';

        // Sort maintenance by date (newest first)
        const sortedMaintenance = [...maintenanceList].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedMaintenance.forEach(maintenance => {
            const entry = document.createElement('div');
            entry.className = 'glass p-3 rounded-lg border-l-4 border-blue-500';

            const typeColors = {
                cleaning: 'border-green-500',
                repair: 'border-red-500',
                inspection: 'border-yellow-500',
                upgrade: 'border-purple-500',
                maintenance: 'border-blue-500'
            };

            entry.className = `glass p-3 rounded-lg border-l-4 ${typeColors[maintenance.type] || 'border-blue-500'}`;

            entry.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                ${maintenance.type.charAt(0).toUpperCase() + maintenance.type.slice(1)}
                            </span>
                            <span class="text-sm text-slate-600">${new Date(maintenance.date).toLocaleDateString()}</span>
                            ${maintenance.cost > 0 ? `<span class="text-sm font-semibold text-green-600">$${maintenance.cost.toFixed(2)}</span>` : ''}
                        </div>
                        <p class="text-slate-700 text-sm">${maintenance.description}</p>
                    </div>
                    <button class="delete-edit-maintenance-btn p-1 text-slate-400 hover:text-red-500 transition-colors" data-id="${maintenance.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            `;

            container.appendChild(entry);
        });

        // Add delete event listeners for maintenance entries
        container.querySelectorAll('.delete-edit-maintenance-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const maintenanceId = e.currentTarget.dataset.id;
                this.deleteMaintenanceEntry(maintenanceId);
            });
        });
    }

    async deleteMaintenanceEntry(maintenanceId) {
        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(`${this.API_BASE_URL}/maintenance/${maintenanceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Reload maintenance list
                if (this.currentEditingItem) {
                    await this.loadItemMaintenance(this.currentEditingItem.id);
                }
                this.showSuccess('Maintenance entry deleted successfully!');
            } else {
                throw new Error('Failed to delete maintenance entry');
            }
        } catch (error) {
            console.error('Error deleting maintenance entry:', error);
            this.showError('Failed to delete maintenance entry. Please try again.');
        }
    }

    async handleMaintenanceSubmit(e) {
        e.preventDefault();


        if (!this.currentMaintenanceItem) {

            return;
        }
        


        // Get maintenance type, category, frequency and description
        const maintenanceType = document.querySelector('input[name="maintenance-type"]:checked')?.value;
        const category = document.getElementById('maintenance-category-input').value;
        const frequency = document.getElementById('maintenance-frequency-input').value;
        const description = document.getElementById('maintenance-description-input').value;

        console.log('🔧 Submitting maintenance:', {
            maintenanceType,
            category,
            frequency,
            description,
            itemId: this.currentMaintenanceItem.id
        });

        // Check if this is a borrowed item
        const isBorrowedItem = !this.ownedItems.some(ownedItem => ownedItem.id === this.currentMaintenanceItem.id);

        // Validate required fields
        if (!maintenanceType) {
            this.showError('Please select a maintenance type.');
            return;
        }

        if (!category) {
            this.showError('Please select a machine category.');
            return;
        }

        // For borrowed items, only allow history type
        if (isBorrowedItem && maintenanceType === 'required') {
            this.showError('Borrowed items can only have maintenance history entries.');
            return;
        }

        if (maintenanceType === 'required' && (!frequency || frequency === '' || isNaN(parseInt(frequency)))) {
            this.showError('Please select a valid frequency for required maintenance.');
            return;
        }

        if (!description.trim()) {
            this.showError('Please provide a description.');
            return;
        }

        const formData = {
            ItemId: this.currentMaintenanceItem.id,
            Type: maintenanceType || null,
            Category: category || null,
            Frequency: maintenanceType === 'required' ? parseInt(frequency) || null : null,
            Description: description
        };



        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(`${this.API_BASE_URL}/maintenance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const createdMaintenance = await response.json();


                // Upload receipts if any exist (only for history type)
                let receiptUploadResults = [];
                if (maintenanceType === 'history' && this.currentMaintenanceReceipts.length > 0) {

                    
                    for (const receiptFile of this.currentMaintenanceReceipts) {
                        try {
                            const formData = new FormData();
                            formData.append('file', receiptFile);
                            formData.append('maintenanceId', createdMaintenance.id || createdMaintenance.Id);
                            formData.append('Description', `Receipt for ${description}`);

                            const receiptRes = await fetch(`${this.API_BASE_URL}/documents`, {
                                method: 'POST',
                                body: formData
                            });

                            if (!receiptRes.ok) {
                                console.warn('⚠️ Failed to upload receipt:', receiptFile.name, 'Status:', receiptRes.status);
                                receiptUploadResults.push({ file: receiptFile.name, success: false });
                            } else {

                                receiptUploadResults.push({ file: receiptFile.name, success: true });
                            }
                        } catch (err) {
                            console.warn('⚠️ Error uploading receipt:', err);
                            receiptUploadResults.push({ file: receiptFile.name, success: false });
                        }
                    }
                }

                // Create success message with receipt upload status
                let successMessage = maintenanceType === 'required'
                    ? 'Maintenance requirement added successfully!'
                    : 'Maintenance history entry added successfully!';
                
                if (receiptUploadResults.length > 0) {
                    const successfulUploads = receiptUploadResults.filter(r => r.success).length;
                    const failedUploads = receiptUploadResults.filter(r => !r.success).length;
                    
                    if (successfulUploads > 0 && failedUploads === 0) {
                        successMessage += ` ${successfulUploads} receipt(s) uploaded successfully!`;
                    } else if (successfulUploads > 0 && failedUploads > 0) {
                        successMessage += ` ${successfulUploads} receipt(s) uploaded, ${failedUploads} failed.`;
                    } else if (failedUploads > 0) {
                        successMessage += ` Warning: ${failedUploads} receipt upload(s) failed.`;
                    }
                }
                
                this.showSuccess(successMessage);

                // Maintenance history section removed - no longer reloading history

                // Reload maintenance list if we're in edit modal
                if (this.currentEditingItem) {
                    await this.loadItemMaintenance(this.currentEditingItem.id);
                }

                // Reset form for next entry
                document.getElementById('maintenance-form').reset();
                this.currentMaintenanceReceipts = [];
                document.getElementById('receipt-preview').innerHTML = '';

                // Check if this is a borrowed item to set appropriate defaults
                const isBorrowedItem = !this.ownedItems.some(ownedItem => ownedItem.id === this.currentMaintenanceItem.id);

                if (isBorrowedItem) {
                    // For borrowed items, default to "History"
                    const historyRadio = document.querySelector('input[name="maintenance-type"][value="history"]');
                    if (historyRadio) {
                        historyRadio.checked = true;
                    }
                    this.toggleFrequencyField(false);
                } else {
                    // For owned items, default to "Required"
                    const requiredRadio = document.querySelector('input[name="maintenance-type"][value="required"]');
                    if (requiredRadio) {
                        requiredRadio.checked = true;
                    }
                    this.toggleFrequencyField(true);
                }
            } else {
                const errorText = await response.text();
                console.error('❌ Maintenance submission failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText,
                    formData: formData
                });
                this.showError(`Failed to add maintenance entry (${response.status}): ${errorText}`);
            }
        } catch (error) {
            console.error('Error adding maintenance entry:', error);
            this.showError('An error occurred while adding the maintenance entry.');
        }
    }

    showSuccess(message) {
        // Simple success notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        // Simple error notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    async cancelRequest(item) {
        if (!item.exchangeId) {
            this.showError('Cannot cancel request: Exchange ID not found');
            return;
        }

        // Show custom confirmation modal
        const confirmed = await this.showConfirmation(
            'Cancel Request',
            `Are you sure you want to cancel your request for "${item.title}"?`
        );
        
        if (!confirmed) return;

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(`${this.API_BASE_URL}/exchanges/${item.exchangeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                this.showSuccess('Request cancelled successfully!');
                
                // Remove the item from borrowed items list
                this.borrowedItems = this.borrowedItems.filter(borrowedItem => borrowedItem.id !== item.id);
                
                // Re-render the borrowed items
                this.renderBorrowedItems();
                this.updateCounts();
            } else {
                const errorText = await response.text();
                this.showError(`Failed to cancel request: ${errorText}`);
            }
        } catch (error) {
            console.error('Error cancelling request:', error);
            this.showError('An error occurred while cancelling the request');
        }
    }

    showConfirmation(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmation-modal');
            const titleElement = document.getElementById('confirmation-title');
            const messageElement = document.getElementById('confirmation-message');
            const confirmBtn = document.getElementById('confirmation-confirm');
            const cancelBtn = document.getElementById('confirmation-cancel');
            const closeBtn = document.getElementById('close-confirmation');

            // Set content
            titleElement.textContent = title;
            messageElement.textContent = message;

            // Show modal
            modal.classList.add('active');

            // Handle confirm
            const handleConfirm = () => {
                modal.classList.remove('active');
                resolve(true);
                cleanup();
            };

            // Handle cancel/close
            const handleCancel = () => {
                modal.classList.remove('active');
                resolve(false);
                cleanup();
            };

            // Cleanup event listeners
            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                closeBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', handleBackdropClick);
            };

            // Handle backdrop click
            const handleBackdropClick = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };

            // Add event listeners
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            closeBtn.addEventListener('click', handleCancel);
            modal.addEventListener('click', handleBackdropClick);
        });
    }

    viewItem(item) {
        // Navigate to item detail page
        // For borrowed items, use itemId instead of id (which is the exchange ID)
        const itemId = item.itemId || item.id || item.Id;
        window.location.href = `./listing.html?id=${itemId}`;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    new AssetHub();
});
