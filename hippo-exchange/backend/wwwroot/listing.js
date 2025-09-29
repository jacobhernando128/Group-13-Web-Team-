// Enhanced listing.js with ownership checking, editing, and maintenance features
document.addEventListener('DOMContentLoaded', () => {
  const API_URL = 'listings.json'; // same folder as listing.html

  const $ = (id) => document.getElementById(id);
  const PLACEHOLDER_IMG = 'https://placehold.co/1200x700/ffffff/111111?text=Listing+Image';
  const money = (n) =>
    (n === null || n === undefined || n === '')
      ? '$—'
      : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n));

  // Mobile menu functionality
  const menuButton = document.getElementById('menu-button');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  function toggleMobileMenu() {
    const isOpen = sidebar.classList.contains('translate-x-0');
    
    if (isOpen) {
      // Close menu
      sidebar.classList.remove('translate-x-0');
      sidebar.classList.add('-translate-x-full');
      sidebarBackdrop.classList.add('hidden');
      menuButton.setAttribute('aria-expanded', 'false');
    } else {
      // Open menu
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
      sidebarBackdrop.classList.remove('hidden');
      menuButton.setAttribute('aria-expanded', 'true');
    }
  }

  function closeMobileMenu() {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
    sidebarBackdrop.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
  }

  // Event listeners for mobile menu
  if (menuButton) {
    menuButton.addEventListener('click', toggleMobileMenu);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileMenu);
  }

  // Close menu when clicking on nav links (mobile)
  const navLinks = sidebar.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        closeMobileMenu();
      }
    });
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      closeMobileMenu();
    }
  });

  // Get current user ID (in a real app, this would come from authentication)
  const currentUserId = localStorage.getItem('currentUserId') || 'user123';
  
  // Get id or slug from ?id= / ?slug=
  const qs = new URLSearchParams(location.search);
  const key = qs.get('id') || qs.get('slug');

  let currentListing = null;
  let isOwner = false;

  async function readListing() {
    // Try to fetch from API first, fall back to mock data
    try {
      const res = await fetch(API_URL, { headers: { 'Accept':'application/json' } });
      if (res.ok) {
        const items = await res.json();
        const list = Array.isArray(items) ? items : (items.items || []);
        if (list.length) {
          const listing = key ? list.find(x => x.id === key || x.slug === key) ?? list[0] : list[0];
          return listing;
        }
      }
    } catch (error) {
      console.log('API not available, using mock data');
    }
    
    // Fall back to mock data
    return window.mockListing || {
      id: "demo-item",
      title: "Demo Item",
      price: 50,
      condition: "Used",
      ownerId: currentUserId,
      available: true,
      description: "This is a demo item for testing purposes.",
      images: [PLACEHOLDER_IMG],
      bullets: ["Demo feature 1", "Demo feature 2"],
      maintenance: []
    };
  }

  function checkOwnership(listing) {
    isOwner = listing.ownerId === currentUserId;
    
    // Show/hide appropriate controls
    if (isOwner) {
      $('owner-controls').classList.remove('hidden');
      $('user-controls').classList.add('hidden');
      $('add-maintenance-btn').classList.remove('hidden');
    } else {
      $('owner-controls').classList.add('hidden');
      $('user-controls').classList.remove('hidden');
      $('add-maintenance-btn').classList.add('hidden');
    }
  }

  function renderMaintenanceNeeded(requirementsList) {
    const container = $('maintenance-needed-list');
    const empty = $('maintenance-needed-empty');
    
    if (!requirementsList || requirementsList.length === 0) {
      container.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    container.innerHTML = '';

    requirementsList.forEach(requirement => {
      const entry = document.createElement('div');
      entry.className = 'glass p-3 rounded-lg border-l-4';
      
      const importanceColors = {
        high: 'border-red-500 bg-red-50',
        medium: 'border-yellow-500 bg-yellow-50',
        low: 'border-green-500 bg-green-50'
      };
      
      const typeColors = {
        cleaning: 'text-green-700',
        repair: 'text-red-700',
        inspection: 'text-yellow-700',
        upgrade: 'text-purple-700',
        maintenance: 'text-blue-700'
      };
      
      entry.className = `glass p-3 rounded-lg border-l-4 ${importanceColors[requirement.importance] || 'border-blue-500'}`;
      
      entry.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-1 bg-white rounded-full text-xs font-medium ${typeColors[requirement.type] || 'text-blue-700'}">
                ${requirement.type.charAt(0).toUpperCase() + requirement.type.slice(1)}
              </span>
              <span class="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded-full">
                ${requirement.frequency}
              </span>
              <span class="text-xs px-2 py-1 rounded-full ${
                requirement.importance === 'high' ? 'bg-red-100 text-red-700' :
                requirement.importance === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }">
                ${requirement.importance.charAt(0).toUpperCase() + requirement.importance.slice(1)} Priority
              </span>
            </div>
            <p class="text-slate-700 text-sm">${requirement.description}</p>
          </div>
        </div>
      `;
      
      container.appendChild(entry);
    });
  }

  function renderMaintenance(maintenanceList) {
    const container = $('maintenance-list');
    const empty = $('maintenance-empty');
    
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
          ${isOwner ? `
            <button class="delete-maintenance-btn p-1 text-slate-400 hover:text-red-500 transition-colors" data-id="${maintenance.id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          ` : ''}
        </div>
      `;
      
      container.appendChild(entry);
    });

    // Add delete event listeners for maintenance entries
    container.querySelectorAll('.delete-maintenance-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const maintenanceId = e.currentTarget.dataset.id;
        deleteMaintenanceEntry(maintenanceId);
      });
    });
  }

  function render(listing) {
    currentListing = listing;
    checkOwnership(listing);

    // Title + price/condition
    $('listing-title').textContent = listing.title || 'Listing';
    $('price').textContent         = money(listing.price);
    $('condition').textContent     = listing.condition ? `Condition: ${listing.condition}` : '';

    // Badge
    const badge = $('badge');
    if (!(listing.isNew || listing.featured)) badge?.remove();

    // Gallery
    const hero   = $('hero-img');
    const thumbs = $('thumbs');
    const imgs   = (listing.images && listing.images.length) ? listing.images : [listing.imageUrl || PLACEHOLDER_IMG];

    hero.src = imgs[0] || PLACEHOLDER_IMG;
    hero.alt = `${listing.title || 'Listing'} photo`;

    thumbs.replaceChildren();
    imgs.forEach((src, i) => {
      const b = document.createElement('button');
      b.className = `detail-thumb ${i === 0 ? 'detail-thumb--active' : ''}`;
      b.innerHTML = `<img src="${src}" alt="Thumbnail ${i+1}" class="w-full h-full object-cover">`;
      b.addEventListener('click', () => {
        hero.src = src;
        thumbs.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('detail-thumb--active'));
        b.classList.add('detail-thumb--active');
      });
      thumbs.appendChild(b);
    });

    // Details (bullets + long description)
    const ul = $('details-list');
    ul.replaceChildren();
    (listing.bullets || []).forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    $('long-desc').textContent = listing.description || '';

    // Fulfillment
    $('fulfillment').textContent =
      listing.ships && listing.pickup ? 'Ships to you • Local pickup available' :
      listing.ships ? 'Ships to you' :
      (listing.pickup ? `Local pickup — ${listing.pickup}` : '');

    // Seller
    $('seller-name').textContent = listing.seller?.name || 'Seller';
    $('seller-avatar').src       = listing.seller?.avatar || 'hippo-exchange-logo.png';
    $('seller-meta').textContent = listing.seller?.since || '';

    // Location + map
    $('location-label').textContent = listing.locationLabel || '';
    if (typeof L !== 'undefined' && listing.lat && listing.lng) {
      const map = L.map('detail-map', { zoomControl: true, scrollWheelZoom: true })
                  .setView([listing.lat, listing.lng], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      L.marker([listing.lat, listing.lng]).addTo(map);
      setTimeout(() => map.invalidateSize(), 120);
    }

    // Render maintenance information
    renderMaintenanceNeeded(listing.maintenanceRequired || []);
    renderMaintenance(listing.maintenance || []);
  }

  // Edit functionality
  function openEditModal() {
    if (!currentListing) return;
    
    document.getElementById('edit-title-input').value = currentListing.title || '';
    document.getElementById('edit-description-input').value = currentListing.description || '';
    document.getElementById('edit-available-input').value = currentListing.available ? 'true' : 'false';
    
    document.getElementById('edit-modal').classList.add('active');
  }

  function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    
    if (!currentListing) return;

    const formData = {
      title: document.getElementById('edit-title-input').value,
      description: document.getElementById('edit-description-input').value,
      available: document.getElementById('edit-available-input').value === 'true',
      ownerId: currentListing.ownerId
    };

    try {
      // Try to update via API
      const response = await fetch(`/items/${currentListing.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedItem = await response.json();
        currentListing = { ...currentListing, ...updatedItem };
        render(currentListing);
        closeEditModal();
        showSuccess('Item updated successfully!');
      } else {
        throw new Error('Failed to update item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      // Update locally for demo purposes
      currentListing = { ...currentListing, ...formData };
      render(currentListing);
      closeEditModal();
      showSuccess('Item updated successfully! (Demo mode)');
    }
  }

  // Delete functionality
  function openDeleteModal() {
    document.getElementById('delete-modal').classList.add('active');
  }

  function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
  }

  async function handleDeleteConfirm() {
    if (!currentListing) return;

    try {
      const response = await fetch(`/items/${currentListing.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showSuccess('Item deleted successfully!');
        // Redirect to home page
        setTimeout(() => {
          window.location.href = './Home.html';
        }, 1500);
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showSuccess('Item deleted successfully! (Demo mode)');
      setTimeout(() => {
        window.location.href = './Home.html';
      }, 1500);
    }
  }

  // Maintenance functionality
  function openMaintenanceModal() {
    // Set today's date as default
    document.getElementById('maintenance-date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('maintenance-modal').classList.add('active');
  }

  function closeMaintenanceModal() {
    document.getElementById('maintenance-modal').classList.remove('active');
    document.getElementById('maintenance-form').reset();
  }

  function handleMaintenanceSubmit(e) {
    e.preventDefault();
    
    if (!currentListing) return;

    const formData = {
      id: 'maint_' + Date.now(),
      date: document.getElementById('maintenance-date-input').value,
      type: document.getElementById('maintenance-type-input').value,
      description: document.getElementById('maintenance-description-input').value,
      cost: parseFloat(document.getElementById('maintenance-cost-input').value) || 0
    };

    // Add to maintenance list
    if (!currentListing.maintenance) {
      currentListing.maintenance = [];
    }
    currentListing.maintenance.push(formData);
    
    renderMaintenance(currentListing.maintenance);
    closeMaintenanceModal();
    showSuccess('Maintenance entry added successfully!');
  }

  function deleteMaintenanceEntry(maintenanceId) {
    if (!currentListing || !currentListing.maintenance) return;
    
    currentListing.maintenance = currentListing.maintenance.filter(m => m.id !== maintenanceId);
    renderMaintenance(currentListing.maintenance);
    showSuccess('Maintenance entry deleted successfully!');
  }

  // Utility functions
  function showSuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Event listeners
  function setupEventListeners() {
    // Edit modal
    document.getElementById('edit-item-btn')?.addEventListener('click', openEditModal);
    document.getElementById('close-edit')?.addEventListener('click', closeEditModal);
    document.getElementById('cancel-edit')?.addEventListener('click', closeEditModal);
    document.getElementById('edit-form')?.addEventListener('submit', handleEditSubmit);

    // Delete modal
    document.getElementById('delete-item-btn')?.addEventListener('click', openDeleteModal);
    document.getElementById('close-delete')?.addEventListener('click', closeDeleteModal);
    document.getElementById('cancel-delete')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirm-delete')?.addEventListener('click', handleDeleteConfirm);

    // Maintenance modal
    document.getElementById('add-maintenance-btn')?.addEventListener('click', openMaintenanceModal);
    document.getElementById('close-maintenance')?.addEventListener('click', closeMaintenanceModal);
    document.getElementById('cancel-maintenance')?.addEventListener('click', closeMaintenanceModal);
    document.getElementById('maintenance-form')?.addEventListener('submit', handleMaintenanceSubmit);
  }

  // Initialize
  setupEventListeners();
  
  readListing().then(render).catch(err => {
    console.error(err);
    $('listing-title').textContent = 'Listing unavailable';
  });
});

// Back button: prefer history.back when referrer is same-origin; otherwise go to home.html
const back = document.getElementById('back-btn');
back?.addEventListener('click', (e) => {
  const ref = document.referrer ? new URL(document.referrer) : null;
  const sameSite = ref && ref.origin === location.origin;

  if (sameSite) {
    e.preventDefault();
    history.back();
  } // else let the <a href="home.html"> default work
});