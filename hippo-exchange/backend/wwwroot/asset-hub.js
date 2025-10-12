// Asset Hub JavaScript functionality
class AssetHub {
    constructor() {
        this.currentUser = null;
        this.currentUserId = null;
        this.ownedItems = [];
        this.borrowedItems = [];
        this.currentEditingItem = null;
        this.currentDeletingItem = null;

        this.init();
    }

    async init() {
        // Check authentication first
        await this.checkAuthAndLoadUser();
        this.setupEventListeners();
        this.loadUserAssets();
    }

    getCurrentUserId() {
        // Return the authenticated user ID
        return this.currentUserId;
    }

    async checkAuthAndLoadUser() {
        const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
        const userData = localStorage.getItem('hippo_user') || localStorage.getItem('userData');

        console.log('Asset Hub: Checking authentication...');
        console.log('Token exists:', !!token);
        console.log('User data exists:', !!userData);

        if (!token || !userData) {
            console.log('No authentication data found, redirecting to login...');
            window.location.href = './Login.html';
            return;
        }

        try {
            // Verify token with backend
            const response = await fetch('http://localhost:5000/auth/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            console.log('Auth response status:', response.status);

            if (response.ok) {
                const user = await response.json();
                console.log('Current user from /auth/me:', user);
                this.currentUser = user;
                this.currentUserId = user?.Id || user?.id || user?.userId;
                this.displayUserInfo(user);
            } else {
                console.log('Token invalid, response status:', response.status);
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
        console.log('Displaying user info:', user);

        // Check for both uppercase and lowercase property names
        const displayName = user?.FirstName && user?.LastName
            ? `${user.FirstName} ${user.LastName}`
            : user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || 'User';

        console.log('Computed display name:', displayName);

        // Update account name
        const acctNameEl = document.getElementById('acct-name');
        if (acctNameEl) {
            console.log('Account name element found:', !!acctNameEl);
            acctNameEl.textContent = displayName;
            console.log('Set account name to:', displayName);
        }

        // Update account rank (you can customize this logic)
        const acctRankEl = document.getElementById('acct-rank');
        if (acctRankEl) {
            acctRankEl.textContent = 'Member';
        }

        // Balance display intentionally omitted
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

        // Add item button
        document.getElementById('add-item-btn').addEventListener('click', () => {
            window.location.href = './create-listing.html';
        });

        // Edit item modal
        document.getElementById('close-edit-item').addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancel-edit-item').addEventListener('click', () => this.closeEditModal());
        document.getElementById('edit-item-form').addEventListener('submit', (e) => this.handleEditSubmit(e));

        // Delete modal
        document.getElementById('close-delete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancel-delete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirm-delete').addEventListener('click', () => this.handleDeleteConfirm());

        // Maintenance modal
        document.getElementById('close-maintenance').addEventListener('click', () => this.closeMaintenanceModal());
        document.getElementById('cancel-maintenance').addEventListener('click', () => this.closeMaintenanceModal());
        document.getElementById('maintenance-form').addEventListener('submit', (e) => this.handleMaintenanceSubmit(e));

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

        function performSearch(query) {
            currentSearchQuery = query.trim();

            if (!currentSearchQuery) {
                // Show all items when search is empty
                this.renderOwnedItems();
                this.renderBorrowedItems();
                this.updateCounts();
                return;
            }

            // Filter both owned and borrowed items
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

            // Temporarily update the displayed items
            this.ownedItems = filteredOwnedItems;
            this.borrowedItems = filteredBorrowedItems;

            // Re-render the items
            this.renderOwnedItems();
            this.renderBorrowedItems();
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
        };
    }

    async loadUserAssets() {
        if (!this.currentUserId) {
            console.log('No authenticated user, using placeholder data');
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
            const ownedResponse = await fetch('http://localhost:5000/items', {
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
                console.log('Failed to load owned items, using placeholder data');
                this.ownedItems = this.getPlaceholderOwnedItems();
            }
            this.renderOwnedItems();

            // Load borrowed items
            this.borrowedItems = await this.getBorrowedItems();
            this.renderBorrowedItems();

            this.updateCounts();
        } catch (error) {
            console.error('Error loading user assets:', error);
            // Use placeholder data on error
            this.ownedItems = this.getPlaceholderOwnedItems();
            this.borrowedItems = this.getPlaceholderBorrowedItems();
            this.renderOwnedItems();
            this.renderBorrowedItems();
            this.updateCounts();
        }
    }

    async getBorrowedItems() {
        if (!this.currentUserId) {
            return this.getPlaceholderBorrowedItems();
        }

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            console.log('🔍 Fetching borrowed items for user:', this.currentUserId);

            const response = await fetch(`http://localhost:5000/exchanges/borrower/${this.currentUserId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            console.log('📡 Borrowed items response status:', response.status);

            if (response.ok) {
                const exchanges = await response.json();
                console.log('✅ Exchanges received:', exchanges);

                // Fetch actual item details and owner names for each exchange
                const borrowedItems = [];
                for (const exchange of exchanges) {
                    try {
                        console.log('🔍 Fetching item details for exchange:', exchange.ItemId || exchange.itemId);
                        const itemResponse = await fetch(`http://localhost:5000/items/${exchange.ItemId || exchange.itemId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Accept': 'application/json'
                            }
                        });

                        if (itemResponse.ok) {
                            const item = await itemResponse.json();
                            console.log('✅ Item details received:', item);

                            // Fetch owner details
                            let ownerName = 'Unknown Owner';
                            try {
                                console.log('🔍 Fetching owner details for:', exchange.OwnerId || exchange.ownerId);
                                const ownerResponse = await fetch(`http://localhost:5000/users/by-id?id=${exchange.OwnerId || exchange.ownerId}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Accept': 'application/json'
                                    }
                                });

                                if (ownerResponse.ok) {
                                    const owner = await ownerResponse.json();
                                    console.log('✅ Owner details received:', owner);
                                    ownerName = owner.name || `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || 'Unknown Owner';
                                } else {
                                    console.warn('⚠️ Failed to fetch owner details, status:', ownerResponse.status);
                                }
                            } catch (ownerError) {
                                console.warn('⚠️ Error fetching owner details:', ownerError);
                            }

                            // Create borrowed item with full details
                            borrowedItems.push({
                                id: exchange.Id || exchange.id,
                                itemId: exchange.ItemId || exchange.itemId,
                                title: item.title || item.Title || 'Untitled Item',
                                description: item.description || item.Description || 'No description',
                                imageUrl: item.imageUrl || item.ImageUrl || (item.pictures && item.pictures[0]) || (item.Pictures && item.Pictures[0]) || 'https://placehold.co/300x200?text=Item+Image',
                                condition: item.condition || item.Condition || 'Unknown',
                                price: item.price || item.Price || 0,
                                ownerId: exchange.OwnerId || exchange.ownerId,
                                ownerName: ownerName,
                                borrowerId: exchange.BorrowerId || exchange.borrowerId,
                                status: exchange.Approved ? 'Approved' : 'Pending',
                                startDate: exchange.StartDate || exchange.startDate,
                                endDate: exchange.EndDate || exchange.endDate,
                                approved: exchange.Approved || false
                            });
                        } else {
                            console.warn('⚠️ Failed to fetch item details for:', exchange.ItemId || exchange.itemId);

                            // Still try to fetch owner name even if item details fail
                            let ownerName = 'Unknown Owner';
                            try {
                                console.log('🔍 Fetching owner details for fallback:', exchange.OwnerId || exchange.ownerId);
                                const ownerResponse = await fetch(`http://localhost:5000/users/by-id?id=${exchange.OwnerId || exchange.ownerId}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Accept': 'application/json'
                                    }
                                });

                                if (ownerResponse.ok) {
                                    const owner = await ownerResponse.json();
                                    console.log('✅ Owner details received for fallback:', owner);
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
                                status: exchange.Approved ? 'Approved' : 'Pending',
                                startDate: exchange.StartDate || exchange.startDate,
                                endDate: exchange.EndDate || exchange.endDate,
                                approved: exchange.Approved || false
                            });
                        }
                    } catch (itemError) {
                        console.warn('⚠️ Error fetching item details for:', exchange.ItemId || exchange.itemId, itemError);

                        // Still try to fetch owner name even if everything fails
                        let ownerName = 'Unknown Owner';
                        try {
                            console.log('🔍 Fetching owner details for error fallback:', exchange.OwnerId || exchange.ownerId);
                            const ownerResponse = await fetch(`http://localhost:5000/users/by-id?id=${exchange.OwnerId || exchange.ownerId}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Accept': 'application/json'
                                }
                            });

                            if (ownerResponse.ok) {
                                const owner = await ownerResponse.json();
                                console.log('✅ Owner details received for error fallback:', owner);
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
                            status: exchange.Approved ? 'Approved' : 'Pending',
                            startDate: exchange.StartDate || exchange.startDate,
                            endDate: exchange.EndDate || exchange.endDate,
                            approved: exchange.Approved || false
                        });
                    }
                }

                console.log('✅ Final borrowed items:', borrowedItems);
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

    createItemCard(item, type) {
        const template = document.getElementById('asset-card-template');
        const card = template.content.cloneNode(true);

        const article = card.querySelector('article');
        article.setAttribute('data-id', item.id);

        // Set image
        const img = card.querySelector('.card-img');
        if (item.imageUrl) {
            img.src = item.imageUrl;
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
            const statusInfo = item.approved ? ' • Approved' : ' • Pending';
            card.querySelector('.description').textContent = `${description}${ownerInfo}${statusInfo}`;
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
            if (item.approved) {
                statusBadge.textContent = 'Approved';
                statusBadge.className = 'badge status-badge bg-green-500';
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
        } else {
            // For owned items, show availability
            if (item.available) {
                statusBadge.textContent = 'Available';
                statusBadge.className = 'badge status-badge bg-green-500';
            } else {
                statusBadge.textContent = 'Unavailable';
                statusBadge.className = 'badge status-badge bg-red-500';
            }
        }

        // Setup event listeners
        const dropdownBtn = card.querySelector('.dropdown-btn');
        const dropdownMenu = card.querySelector('.dropdown-menu');
        const editBtn = card.querySelector('.edit-btn');
        const viewBtn = card.querySelector('.view-btn');
        const deleteBtn = card.querySelector('.delete-btn');
        const maintenanceBtn = card.querySelector('.maintenance-btn');


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
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openEditModal(item);
                });
            }
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openDeleteModal(item);
                });
            }
            // Show maintenance button for owned items
            if (maintenanceBtn) {
                maintenanceBtn.style.display = 'block';
                maintenanceBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openMaintenanceModal(item);
                });
            }
        } else {
            // For borrowed items, hide edit and delete buttons, but show maintenance button
            if (editBtn) editBtn.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none';

            // Show maintenance button for borrowed items
            if (maintenanceBtn) {
                maintenanceBtn.style.display = 'block';
                maintenanceBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    this.openMaintenanceModal(item);
                });
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

        // Update tab styles
        document.getElementById('owned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-blue-500 text-white shadow-md';
        document.getElementById('borrowed-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
    }

    showBorrowedItems() {
        document.getElementById('owned-section').classList.add('hidden');
        document.getElementById('borrowed-section').classList.remove('hidden');

        // Update tab styles
        document.getElementById('borrowed-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-blue-500 text-white shadow-md';
        document.getElementById('owned-tab').className = 'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 bg-white/40 text-slate-700 hover:bg-white/60';
    }

    updateCounts() {
        document.getElementById('owned-count').textContent = this.ownedItems.length;
        document.getElementById('borrowed-count').textContent = this.borrowedItems.length;
    }

    async openEditModal(item) {
        this.currentEditingItem = item;

        console.log('🔍 Opening edit modal for item:', item);
        console.log('🔍 Item keys:', Object.keys(item));

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

        // Show photo upload indicator if item has photos
        const photoIndicator = document.getElementById('photo-upload-indicator');
        const photoCount = document.getElementById('photo-count');
        const photos = item.Pictures || item.pictures || item.Images || item.images || [];

        if (photos.length > 0) {
            photoIndicator.classList.remove('hidden');
            photoCount.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} uploaded`;
        } else {
            photoIndicator.classList.add('hidden');
        }

        console.log('✅ Form populated successfully');

        // Show the modal
        const modal = document.getElementById('edit-item-modal');
        if (modal) {
            modal.classList.add('active');
            console.log('✅ Modal shown');
            console.log('🔍 Modal classes:', modal.className);
            console.log('🔍 Modal style display:', modal.style.display);
        } else {
            console.error('❌ Modal element not found!');
        }
    }

    closeEditModal() {
        document.getElementById('edit-item-modal').classList.remove('active');
        document.getElementById('photo-upload-indicator').classList.add('hidden');
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
            ownerId: this.currentEditingItem.ownerId || this.currentEditingItem.userId
        };

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(`http://localhost:5000/items/${this.currentEditingItem.id}`, {
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
            const response = await fetch(`http://localhost:5000/items/${this.currentDeletingItem.id}`, {
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

        console.log('🔧 Opening maintenance modal for item:', item);

        // Reset form
        document.getElementById('maintenance-form').reset();

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
        document.getElementById('maintenance-modal').classList.add('active');
    }

    closeMaintenanceModal() {
        document.getElementById('maintenance-modal').classList.remove('active');
        document.getElementById('maintenance-form').reset();

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

        if (show) {
            frequencySection.style.display = 'block';
            frequencyInput.required = true;
        } else {
            frequencySection.style.display = 'none';
            frequencyInput.required = false;
            frequencyInput.value = ''; // Clear the value when hidden
        }
    }

    async loadMaintenanceHistory(itemId) {
        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(`http://localhost:5000/maintenance?itemId=${itemId}`, {
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
            const response = await fetch(`http://localhost:5000/maintenance?itemId=${itemId}`, {
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
            const response = await fetch(`http://localhost:5000/maintenance/${maintenanceId}`, {
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

        if (!this.currentMaintenanceItem) return;

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

        if (maintenanceType === 'required' && !frequency) {
            this.showError('Please select a frequency for required maintenance.');
            return;
        }

        if (!description.trim()) {
            this.showError('Please provide a description.');
            return;
        }

        const formData = {
            ItemId: this.currentMaintenanceItem.id,
            Type: maintenanceType,
            Category: category,
            Frequency: maintenanceType === 'required' ? frequency : "",
            Description: description,
            Date: new Date().toISOString().split('T')[0] // Auto-set to today's date
        };

        console.log('🔧 Sending maintenance data to backend:', formData);

        try {
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch('http://localhost:5000/maintenance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const successMessage = maintenanceType === 'required'
                    ? 'Maintenance requirement added successfully!'
                    : 'Maintenance history entry added successfully!';
                this.showSuccess(successMessage);

                // Maintenance history section removed - no longer reloading history

                // Reload maintenance list if we're in edit modal
                if (this.currentEditingItem) {
                    await this.loadItemMaintenance(this.currentEditingItem.id);
                }

                // Reset form for next entry
                document.getElementById('maintenance-form').reset();

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
                this.showError(`Failed to add maintenance entry: ${errorText}`);
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

    viewItem(item) {
        // Navigate to item detail page
        window.location.href = `./listing.html?id=${item.id || item.Id}`;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    new AssetHub();
});