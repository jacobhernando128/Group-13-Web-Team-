// Asset Hub JavaScript functionality
class AssetHub {
    constructor() {
        this.currentUserId = "f8177ed15fe24b5ca1818feb03bb5f32";
        this.ownedItems = [];
        this.borrowedItems = [];
        this.currentEditingItem = null;
        this.currentDeletingItem = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserAssets();
    }

    getCurrentUserId() {
        // In a real app, this would come from authentication
        // For now, we'll use a mock user ID
        return localStorage.getItem('currentUserId') || 'user123';
    }

    setupEventListeners() {
        // Tab switching
        document.getElementById('owned-tab').addEventListener('click', () => this.showOwnedItems());
        document.getElementById('borrowed-tab').addEventListener('click', () => this.showBorrowedItems());

        // Add item button
        document.getElementById('add-item-btn').addEventListener('click', () => {
            window.location.href = './create-listing.html';
        });

        // Edit modal
        document.getElementById('close-edit').addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancel-edit').addEventListener('click', () => this.closeEditModal());
        document.getElementById('edit-form').addEventListener('submit', (e) => this.handleEditSubmit(e));

        // Delete modal
        document.getElementById('close-delete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancel-delete').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirm-delete').addEventListener('click', () => this.handleDeleteConfirm());

        // Maintenance modal
        document.getElementById('close-maintenance').addEventListener('click', () => this.closeMaintenanceModal());
        document.getElementById('cancel-maintenance').addEventListener('click', () => this.closeMaintenanceModal());
        document.getElementById('maintenance-form').addEventListener('submit', (e) => this.handleMaintenanceSubmit(e));

        // Edit modal maintenance management
        document.getElementById('add-maintenance-from-edit').addEventListener('click', () => this.openMaintenanceModal(this.currentEditingItem));

        // Mobile menu
        this.setupMobileMenu();

        // Search functionality
        this.setupSearch();
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
        this.loadUserAssets = async function() {
            await originalLoadUserAssets();
            // Store original data for search
            originalOwnedItems = [...this.ownedItems];
            originalBorrowedItems = [...this.borrowedItems];
        };
    }

    async loadUserAssets() {
        try {
            // Load owned items
            const ownedResponse = await fetch(`/users/${this.currentUserId}/items`);
            if (ownedResponse.ok) {
                this.ownedItems = await ownedResponse.json();
            } else {
                // Use placeholder data if API is not available
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
        try {
            const response = await fetch(`/users/${this.currentUserId}/borrowed`);
            if (response.ok) {
                const borrowings = await response.json();
                // For now, we'll return the borrowings as-is
                // In a real app, you might want to fetch the actual item details
                return borrowings.map(borrowing => ({
                    id: borrowing.id,
                    title: `Item ${borrowing.itemId}`, // Would be fetched from items API
                    description: `Borrowed from user ${borrowing.ownerId}`,
                    available: false,
                    ownerId: borrowing.ownerId,
                    createdUtc: borrowing.createdUtc,
                    status: borrowing.status,
                    startDate: borrowing.startDate,
                    endDate: borrowing.endDate,
                    notes: borrowing.notes
                }));
            }
            // Use placeholder data if API is not available
            return this.getPlaceholderBorrowedItems();
        } catch (error) {
            console.error('Error loading borrowed items:', error);
            return this.getPlaceholderBorrowedItems();
        }
    }

    getPlaceholderOwnedItems() {
        return [
            {
                id: 'item1',
                title: 'MacBook Pro 13"',
                description: '2022 MacBook Pro with M2 chip, 16GB RAM, 512GB SSD. Perfect for development and creative work.',
                available: true,
                ownerId: this.currentUserId,
                createdUtc: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'item2',
                title: 'Canon EOS R5 Camera',
                description: 'Professional mirrorless camera with 45MP sensor, 4K video recording, and excellent low-light performance.',
                available: false,
                ownerId: this.currentUserId,
                createdUtc: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'item3',
                title: 'Standing Desk Converter',
                description: 'Adjustable standing desk converter, perfect for home office setup. Height adjustable from 4" to 20".',
                available: true,
                ownerId: this.currentUserId,
                createdUtc: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'item4',
                title: 'Nintendo Switch OLED',
                description: 'Nintendo Switch OLED model with 7" OLED screen, 64GB storage, and Joy-Con controllers included.',
                available: true,
                ownerId: this.currentUserId,
                createdUtc: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'item5',
                title: 'KitchenAid Stand Mixer',
                description: 'Professional 5-quart stand mixer in Empire Red. Includes dough hook, whisk, and flat beater attachments.',
                available: false,
                ownerId: this.currentUserId,
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
        
        // Set image (using placeholder for now)
        const img = card.querySelector('.card-img');
        img.src = 'https://placehold.co/400x300/ffffff/111111?text=' + encodeURIComponent(item.title);
        img.alt = item.title;
        
        // Set title and description
        card.querySelector('.title').textContent = item.title;
        if (type === 'borrowed' && item.borrowedFrom) {
            card.querySelector('.description').textContent = `${item.description || 'No description provided'} • From: ${item.borrowedFrom}`;
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
            if (item.status === 'active') {
                statusBadge.textContent = 'Active';
                statusBadge.className = 'badge status-badge bg-blue-500';
            } else if (item.status === 'pending') {
                statusBadge.textContent = 'Pending';
                statusBadge.className = 'badge status-badge bg-yellow-500';
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
        const editBtn = card.querySelector('.edit-btn');
        const viewBtn = card.querySelector('.view-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        if (type === 'owned') {
            editBtn.addEventListener('click', () => this.openEditModal(item));
            deleteBtn.addEventListener('click', () => this.openDeleteModal(item));
        } else {
            // For borrowed items, hide edit and delete buttons, but show maintenance button
            editBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
            
            // Show maintenance button for borrowed items
            const maintenanceBtn = card.querySelector('.maintenance-btn');
            if (maintenanceBtn) {
                maintenanceBtn.style.display = 'block';
                maintenanceBtn.addEventListener('click', () => this.openMaintenanceModal(item));
            }
        }

        viewBtn.addEventListener('click', () => this.viewItem(item));

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
        
        // Populate form
        document.getElementById('edit-title-input').value = item.title;
        document.getElementById('edit-description-input').value = item.description || '';
        document.getElementById('edit-available-input').value = item.available.toString();
        
        // Load and display maintenance history
        await this.loadItemMaintenance(item.id);
        
        // Show modal
        document.getElementById('edit-modal').classList.add('active');
    }

    closeEditModal() {
        document.getElementById('edit-modal').classList.remove('active');
        this.currentEditingItem = null;
    }

    async handleEditSubmit(e) {
        e.preventDefault();
        
        if (!this.currentEditingItem) return;

        const formData = {
            title: document.getElementById('edit-title-input').value,
            description: document.getElementById('edit-description-input').value,
            available: document.getElementById('edit-available-input').value === 'true',
            ownerId: this.currentEditingItem.ownerId
        };

        try {
            const response = await fetch(`/items/${this.currentEditingItem.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
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
            const response = await fetch(`/items/${this.currentDeletingItem.id}`, {
                method: 'DELETE'
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

    openMaintenanceModal(item) {
        this.currentMaintenanceItem = item;
        
        // Set today's date as default
        document.getElementById('maintenance-date-input').value = new Date().toISOString().split('T')[0];
        
        // Show modal
        document.getElementById('maintenance-modal').classList.add('active');
    }

    closeMaintenanceModal() {
        document.getElementById('maintenance-modal').classList.remove('active');
        document.getElementById('maintenance-form').reset();
        this.currentMaintenanceItem = null;
    }

    async loadItemMaintenance(itemId) {
        try {
            const response = await fetch(`/items/${itemId}/maintenance`);
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
            const response = await fetch(`/maintenance/${maintenanceId}`, {
                method: 'DELETE'
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

        const formData = {
            itemId: this.currentMaintenanceItem.id,
            date: document.getElementById('maintenance-date-input').value,
            type: document.getElementById('maintenance-type-input').value,
            description: document.getElementById('maintenance-description-input').value,
            cost: parseFloat(document.getElementById('maintenance-cost-input').value) || 0
        };

        try {
            const response = await fetch('/maintenance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.closeMaintenanceModal();
                this.showSuccess('Maintenance entry added successfully!');
                
                // Reload maintenance list if we're in edit modal
                if (this.currentEditingItem) {
                    await this.loadItemMaintenance(this.currentEditingItem.id);
                }
            } else {
                throw new Error('Failed to add maintenance entry');
            }
        } catch (error) {
            console.error('Error adding maintenance entry:', error);
            this.showError('Failed to add maintenance entry. Please try again.');
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AssetHub();
});
