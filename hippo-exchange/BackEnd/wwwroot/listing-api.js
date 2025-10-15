// listing-api.js — Connect to your C# API
// Global variables
const $ = (id) => document.getElementById(id);
const PLACEHOLDER_IMG = 'https://placehold.co/1200x700/ffffff/111111?text=Listing+Image';
const money = (n) =>
  (n === null || n === undefined || n === '')
    ? '$—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));

const API_BASE_URL = (typeof location !== 'undefined' && location.origin) ? location.origin : 'http://localhost:5000';
let currentUser = null; // Store current user data

// Get item ID from URL parameters
const qs = new URLSearchParams(location.search);
const itemId = qs.get('id') || qs.get('item');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Listing page loaded, starting authentication check...');
  // Check authentication and load user data FIRST
  await checkAuthAndLoadUser();
  console.log('Authentication check completed, currentUser:', currentUser);
  
  // Now load and render the listing
  readListing()
    .then(render)
    .catch(err => {
      console.error('Failed to load listing:', err);
      $('listing-title').textContent = 'Listing unavailable';

      const main = document.querySelector('main');
      const errorDiv = document.createElement('div');
      errorDiv.className = 'glass p-6 rounded-lg text-center mt-6 max-w-md mx-auto';
      errorDiv.innerHTML = `
        <div class="text-6xl mb-4">😔</div>
        <h3 class="text-lg font-semibold text-slate-800 mb-2">Unable to load listing</h3>
        <p class="text-slate-600 mb-4">This listing may have been removed or is temporarily unavailable.</p>
        <div class="text-sm text-slate-500 mb-4">Error: ${err.message}</div>
        <a href="home.html" class="btn-primary inline-block">Browse other listings</a>
      `;

      const existingContent = main.querySelector('section');
      if (existingContent) {
        existingContent.style.display = 'none';
      }
      main.appendChild(errorDiv);
    });

  // Geocoding function to get coordinates from location string
  async function geocodeLocation(locationString) {
    if (!locationString) return null;

    try {
      // Use OpenStreetMap Nominatim API (free, no key required)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationString)}&limit=1`);
      const data = await response.json();

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.log('Geocoding failed:', error);
    }

    return null;
  }

  async function readListing() {
    try {
      let item;

      if (itemId) {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Item with ID ${itemId} not found`);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        item = await response.json();
      } else {
        const response = await fetch(`${API_BASE_URL}/items`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const items = await response.json();
        if (!items || items.length === 0) {
          throw new Error('No items found');
        }

        item = items[0];
      }

      let seller = null;
      if (item.userId) {
        try {
          const userResponse = await fetch(`${API_BASE_URL}/users/${item.userId}`);
          if (userResponse.ok) {
            seller = await userResponse.json();
          }
        } catch (err) {
          console.warn('Could not fetch seller details:', err);
        }
      }

      // Handle both backend API format and fallback JSON format
      console.log('🔍 Raw item data from API:', item);
      console.log('🔍 item.Pictures (capital P):', item.Pictures);
      console.log('🔍 item.pictures (lowercase):', item.pictures);
      console.log('🔍 item.images:', item.images);
      console.log('🔍 item.imageUrl:', item.imageUrl);
      console.log('🔍 item.Videos (capital V):', item.Videos);
      console.log('🔍 item.videos (lowercase):', item.videos);
      
      const images = item.Pictures || item.pictures || item.images || [];
      const videos = item.Videos || item.videos || [];
      const imageUrl = item.imageUrl || images[0] || PLACEHOLDER_IMG;
      
      console.log('🔍 Processed images array:', images);
      console.log('🔍 Processed videos array:', videos);
      console.log('🔍 Final imageUrl:', imageUrl);
      const price = item.dollarCost ?? item.price ?? 0;
      const locationLabel = item.location ?? item.locationLabel ?? '';

      // Get coordinates - use existing or geocode from location
      let coordinates = null;
      if (item.lat && item.lng) {
        coordinates = { lat: item.lat, lng: item.lng };
      } else if (locationLabel) {
        console.log('🗺️ Geocoding location:', locationLabel);
        coordinates = await geocodeLocation(locationLabel);
        if (coordinates) {
          console.log('📍 Geocoded coordinates:', coordinates);
        }
      }

      // Fetch maintenance data separately
      let maintenanceData = [];
      try {
        console.log('🔍 Fetching maintenance for item:', item.id);
        const maintenanceResponse = await fetch(`${API_BASE_URL}/maintenance/item/${item.id}`);
        console.log('📡 Maintenance response status:', maintenanceResponse.status);

        if (maintenanceResponse.ok) {
          maintenanceData = await maintenanceResponse.json();
          console.log('✅ Maintenance data received:', maintenanceData);
        } else {
          console.error('❌ Maintenance fetch failed:', maintenanceResponse.status, maintenanceResponse.statusText);
        }
      } catch (err) {
        console.error('❌ Could not fetch maintenance data:', err);
      }

      return {
        id: item.id,
        title: item.title || 'Untitled Item',
        price: price,
        condition: item.condition || 'Unknown',
        description: item.description || '',
        images: images,
        videos: videos,
        imageUrl: imageUrl,
        createdUtc: item.createdUtc,
        isNew: item.createdUtc ? (new Date() - new Date(item.createdUtc)) < (7 * 24 * 60 * 60 * 1000) : false,
        featured: false,
        seller: {
          id: item.userId || item.ownerId,
          name: seller?.firstName && seller?.lastName ? `${seller.firstName} ${seller.lastName}` :
            seller?.name || 'Unknown Seller',
          email: seller?.email || '',
          avatar: seller?.profilePicture || 'hippo-exchange-logo.png',
          since: seller?.createdUtc ? `Joined ${new Date(seller.createdUtc).getFullYear()}` : 'Member',
        },
        locationLabel: locationLabel,
        ships: item.ships || true,
        pickup: '',
        lat: coordinates?.lat || null,
        lng: coordinates?.lng || null,
        maintenance: maintenanceData, // Add maintenance data
        bullets: [
          item.condition ? `Condition: ${item.condition}` : null,
          item.categories && item.categories.length > 0 ? `Categories: ${item.categories.join(', ')}` :
            (item.category ? `Category: ${item.category}` : null),
          `Created: ${item.createdUtc ? new Date(item.createdUtc).toLocaleDateString() : 'Unknown'}`
        ].filter(Boolean)
      };

    } catch (error) {
      console.error('Error reading listing:', error);
      throw error;
    }
  }

  function render(listing) {
    // Store listing data globally for maintenance form
    window.currentListing = listing;

    console.log('🖼️ Full listing data for image debugging:', listing);
    console.log('🖼️ listing.images:', listing.images);
    console.log('🖼️ listing.imageUrl:', listing.imageUrl);
    console.log('🖼️ listing.videos:', listing.videos);

    $('listing-title').textContent = listing.title;
    $('price').textContent = money(listing.price);
    $('condition').textContent = listing.condition ? `Condition: ${listing.condition}` : '';

    const badge = $('badge');
    if (!listing.isNew && !listing.featured) {
      badge?.remove();
    } else {
      badge.textContent = listing.isNew ? 'Just listed' : 'Featured';
    }

    const hero = $('hero-img');
    const thumbs = $('thumbs');
    const imgs = listing.images && listing.images.length ? listing.images : [listing.imageUrl];
    const videos = listing.videos && listing.videos.length ? listing.videos : [];

    console.log('🖼️ Final imgs array:', imgs);
    console.log('🖼️ Final videos array:', videos);

    // Combine images and videos for display
    const allMedia = [...imgs, ...videos];

    if (allMedia.length > 0) {
      const firstMedia = allMedia[0];
      if (videos.includes(firstMedia)) {
        // If first media is a video, show video element
        hero.style.display = 'none';
        let videoEl = hero.parentElement.querySelector('video');
        if (!videoEl) {
          videoEl = document.createElement('video');
          videoEl.className = 'w-full h-[400px] object-cover rounded-lg';
          videoEl.controls = true;
          videoEl.preload = 'metadata';
          hero.parentElement.appendChild(videoEl);
        }
        videoEl.src = firstMedia;
        videoEl.style.display = 'block';
      } else {
        // Show image
        let videoEl = hero.parentElement.querySelector('video');
        if (videoEl) videoEl.style.display = 'none';
        hero.style.display = 'block';
        hero.src = firstMedia;
        hero.alt = `${listing.title} photo`;
      }
    } else {
      hero.src = PLACEHOLDER_IMG;
      hero.alt = `${listing.title} photo`;
    }

    thumbs.replaceChildren();
    allMedia.forEach((src, i) => {
      const isVideo = videos.includes(src);
      const b = document.createElement('button');
      b.className = `detail-thumb ${i === 0 ? 'detail-thumb--active' : ''}`;

      if (isVideo) {
        b.innerHTML = `<video src="${src}" class="w-full h-full object-cover" muted preload="metadata"></video><div class="play-icon"><svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg></div>`;
      } else {
        b.innerHTML = `<img src="${src}" alt="Thumbnail ${i + 1}" class="w-full h-full object-cover">`;
      }

      b.addEventListener('click', () => {
        if (isVideo) {
          // Show video in hero
          hero.style.display = 'none';
          let videoEl = hero.parentElement.querySelector('video');
          if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.className = 'w-full h-[400px] object-cover rounded-lg';
            videoEl.controls = true;
            videoEl.preload = 'metadata';
            hero.parentElement.appendChild(videoEl);
          }
          videoEl.src = src;
          videoEl.style.display = 'block';
        } else {
          // Show image in hero
          let videoEl = hero.parentElement.querySelector('video');
          if (videoEl) videoEl.style.display = 'none';
          hero.style.display = 'block';
          hero.src = src;
          hero.alt = `Thumbnail ${i + 1}`;
        }

        thumbs.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('detail-thumb--active'));
        b.classList.add('detail-thumb--active');
      });
      thumbs.appendChild(b);
    });

    const ul = $('details-list');
    ul.replaceChildren();
    listing.bullets.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    $('long-desc').textContent = listing.description;

    $('fulfillment').textContent =
      listing.ships && listing.pickup ? 'Ships to you • Local pickup available' :
        listing.ships ? 'Ships to you' :
          (listing.pickup ? `Local pickup — ${listing.pickup}` : 'Contact seller for details');

    $('seller-name').textContent = listing.seller.name;
    $('seller-avatar').src = listing.seller.avatar;
    $('seller-meta').textContent = listing.seller.since;

    $('location-label').textContent = listing.locationLabel;

    // Debug map coordinates
    console.log('🗺️ Map coordinates:', { lat: listing.lat, lng: listing.lng, hasLeaflet: typeof L !== 'undefined' });

    // Ensure map container is visible
    const mapContainer = $('detail-map');
    if (mapContainer) {
      mapContainer.style.display = 'block';
      mapContainer.innerHTML = ''; // Clear loading message
    }

    if (typeof L !== 'undefined') {
      try {
        // Use provided coordinates or default to Indianapolis
        const lat = listing.lat || 39.7684;
        const lng = listing.lng || -86.1581;

        console.log('🗺️ Initializing map with coordinates:', { lat, lng });

        const map = L.map('detail-map', { zoomControl: true, scrollWheelZoom: true })
          .setView([lat, lng], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Only add marker if we have actual coordinates
        if (listing.lat && listing.lng) {
          L.marker([listing.lat, listing.lng]).addTo(map);
          console.log('📍 Added marker for listing location');
        } else {
          // Add a default marker for Indianapolis
          L.marker([lat, lng]).addTo(map).bindPopup('Default Location - Indianapolis');
          console.log('📍 Added default marker for Indianapolis');
        }

        setTimeout(() => {
          map.invalidateSize();
          console.log('🗺️ Map size invalidated');
        }, 120);

      } catch (error) {
        console.error('❌ Error initializing map:', error);
        if (mapContainer) {
          mapContainer.innerHTML = '<div class="text-red-500 text-center p-4">Map failed to load</div>';
        }
      }
    } else {
      console.log('❌ Leaflet not loaded');
      if (mapContainer) {
        mapContainer.innerHTML = '<div class="text-red-500 text-center p-4">Map library not loaded</div>';
      }
    }

    // Render maintenance data only for item owners
    console.log('📋 Listing data for maintenance rendering:', listing);
    console.log('👤 Current user:', currentUser);
    console.log('🏠 Listing seller:', listing.seller);
    
    // Get current user ID with multiple fallbacks
    const currentUserId = currentUser?.Id || currentUser?.id || currentUser?.userId;
    const sellerId = listing.seller?.id || listing.seller?.Id;
    
    console.log('🔍 Current user ID:', currentUserId);
    console.log('🔍 Seller ID:', sellerId);
    
    const isOwner = currentUserId && sellerId && currentUserId === sellerId;
    console.log('🔍 Is owner check:', isOwner);
    
    if (isOwner) {
      console.log('✅ User is owner, showing maintenance section');
      renderMaintenance(listing.maintenance || []);
    } else {
      console.log('❌ User is not owner, hiding maintenance section');
      hideMaintenanceSection();
    }

    addInteractivity(listing);
    setupMaintenanceModal();
  }

  function hideMaintenanceSection() {
    console.log('🔒 Hiding maintenance section for non-owners');
    
    // Try multiple selectors to find the maintenance section
    let maintenanceSection = null;
    
    // Method 1: Look for the specific heading
    const maintenanceHeading = document.querySelector('h3.text-lg.font-semibold.text-slate-800');
    if (maintenanceHeading && maintenanceHeading.textContent === 'Maintenance Information') {
      maintenanceSection = maintenanceHeading.closest('.glass');
      console.log('📍 Found maintenance section via heading method');
    }
    
    // Method 2: Look for the maintenance section by its content
    if (!maintenanceSection) {
      const allGlassSections = document.querySelectorAll('.glass');
      for (const section of allGlassSections) {
        if (section.textContent.includes('Maintenance Information')) {
          maintenanceSection = section;
          console.log('📍 Found maintenance section via content method');
          break;
        }
      }
    }
    
    if (maintenanceSection) {
      maintenanceSection.style.display = 'none';
      console.log('✅ Maintenance section hidden for non-owner');
    } else {
      console.warn('⚠️ Could not find maintenance section to hide');
    }
  }

  function renderMaintenance(maintenanceData) {
    console.log('🎨 Rendering maintenance data:', maintenanceData);

    // Ensure maintenance section is visible for owners
    let maintenanceSection = null;
    
    // Method 1: Look for the specific heading
    const maintenanceHeading = document.querySelector('h3.text-lg.font-semibold.text-slate-800');
    if (maintenanceHeading && maintenanceHeading.textContent === 'Maintenance Information') {
      maintenanceSection = maintenanceHeading.closest('.glass');
    }
    
    // Method 2: Look for the maintenance section by its content
    if (!maintenanceSection) {
      const allGlassSections = document.querySelectorAll('.glass');
      for (const section of allGlassSections) {
        if (section.textContent.includes('Maintenance Information')) {
          maintenanceSection = section;
          break;
        }
      }
    }
    
    if (maintenanceSection) {
      maintenanceSection.style.display = 'block';
      console.log('✅ Maintenance section shown for owner');
    } else {
      console.warn('⚠️ Could not find maintenance section to show');
    }

    const maintenanceNeededList = document.getElementById('maintenance-needed-list');
    const maintenanceNeededEmpty = document.getElementById('maintenance-needed-empty');
    const maintenanceList = document.getElementById('maintenance-list');
    const maintenanceEmpty = document.getElementById('maintenance-empty');

    if (!maintenanceNeededList || !maintenanceNeededEmpty || !maintenanceList || !maintenanceEmpty) {
      console.warn('⚠️ Maintenance DOM elements not found');
      return;
    }

    // Clear existing content
    maintenanceNeededList.innerHTML = '';
    maintenanceList.innerHTML = '';

    if (maintenanceData.length === 0) {
      maintenanceNeededEmpty.style.display = 'block';
      maintenanceEmpty.style.display = 'block';
      return;
    }

    // Separate maintenance by type
    const requiredMaintenance = maintenanceData.filter(m => m.type === 'required');
    const historyMaintenance = maintenanceData.filter(m => m.type === 'history');

    // Render required maintenance
    if (requiredMaintenance.length === 0) {
      maintenanceNeededEmpty.style.display = 'block';
    } else {
      maintenanceNeededEmpty.style.display = 'none';
      renderMaintenanceEntries(requiredMaintenance, maintenanceNeededList, 'required');
    }

    // Render maintenance history
    if (historyMaintenance.length === 0) {
      maintenanceEmpty.style.display = 'block';
    } else {
      maintenanceEmpty.style.display = 'none';
      renderMaintenanceEntries(historyMaintenance, maintenanceList, 'history');
    }
  }

  function renderMaintenanceEntries(maintenanceData, container, sectionType) {
    // Sort by createdUtc (newest first)
    const sortedMaintenance = [...maintenanceData].sort((a, b) =>
      new Date(b.createdUtc) - new Date(a.createdUtc)
    );

    sortedMaintenance.forEach(maintenance => {
      const entry = document.createElement('div');

      const description = maintenance.description || '';
      const category = maintenance.category || 'maintenance';

      // Color coding based on category
      const categoryColors = {
        cleaning: 'border-green-500',
        repair: 'border-red-500',
        inspection: 'border-yellow-500',
        upgrade: 'border-purple-500',
        maintenance: 'border-blue-500'
      };

      entry.className = `glass p-3 rounded-lg border-l-4 ${categoryColors[category] || 'border-blue-500'}`;

      // Different styling for required vs history
      if (sectionType === 'required') {
        entry.innerHTML = `
         <div class="flex items-center gap-2 mb-1">
             <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
               Required
             </span>
           <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
               ${category.charAt(0).toUpperCase() + category.slice(1)}
           </span>
           <span class="text-sm text-slate-600">${new Date(maintenance.createdUtc).toLocaleDateString()}</span>
         </div>
         <p class="text-slate-700 text-sm">${description}</p>
           ${maintenance.frequency ? `<p class="text-xs text-slate-500 mt-1">Frequency: ${maintenance.frequency}</p>` : ''}
         `;
      } else {
        entry.innerHTML = `
           <div class="flex items-center gap-2 mb-1">
             <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
               ${category.charAt(0).toUpperCase() + category.slice(1)}
             </span>
             <span class="text-sm text-slate-600">${new Date(maintenance.createdUtc).toLocaleDateString()}</span>
           </div>
           <p class="text-slate-700 text-sm">${description}</p>
         `;
      }

      container.appendChild(entry);
    });
  }

  function setupMaintenanceModal() {
    const addMaintenanceBtn = document.getElementById('add-maintenance-btn');
    const maintenanceModal = document.getElementById('maintenance-modal');
    const closeMaintenanceBtn = document.getElementById('close-maintenance');
    const cancelMaintenanceBtn = document.getElementById('cancel-maintenance');
    const maintenanceForm = document.getElementById('maintenance-form');

    if (!addMaintenanceBtn || !maintenanceModal || !maintenanceForm) {
      console.warn('⚠️ Maintenance modal elements not found');
      return;
    }

    // Show add maintenance button for item owners
    if (currentUser && currentUser.id === window.currentListing?.userId) {
      addMaintenanceBtn.classList.remove('hidden');
    }

    // Event listeners
    addMaintenanceBtn.addEventListener('click', openMaintenanceModal);
    closeMaintenanceBtn.addEventListener('click', closeMaintenanceModal);
    cancelMaintenanceBtn.addEventListener('click', closeMaintenanceModal);
    maintenanceForm.addEventListener('submit', handleMaintenanceSubmit);

    // Maintenance type radio button listeners
    document.querySelectorAll('input[name="maintenance-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        toggleFrequencyField(e.target.value === 'required');
      });
    });

    function openMaintenanceModal() {
      // Reset form
      maintenanceForm.reset();

      // Set default maintenance type to 'required' and show frequency field
      const requiredRadio = document.querySelector('input[name="maintenance-type"][value="required"]');
      if (requiredRadio) {
        requiredRadio.checked = true;
      }
      toggleFrequencyField(true);

      // Show modal
      maintenanceModal.classList.add('active');
    }

    function closeMaintenanceModal() {
      maintenanceModal.classList.remove('active');
      maintenanceForm.reset();
    }

    function toggleFrequencyField(show) {
      const frequencySection = document.getElementById('frequency-section');
      const frequencyInput = document.getElementById('maintenance-frequency-input');

      if (show) {
        frequencySection.style.display = 'block';
        frequencyInput.required = true;
      } else {
        frequencySection.style.display = 'none';
        frequencyInput.required = false;
        frequencyInput.value = '';
      }
    }

    async function handleMaintenanceSubmit(e) {
      e.preventDefault();

      if (!window.currentListing) return;

      // Get form data
      const maintenanceType = document.querySelector('input[name="maintenance-type"]:checked')?.value;
      const category = document.getElementById('maintenance-category-input').value;
      const frequency = document.getElementById('maintenance-frequency-input').value;
      const description = document.getElementById('maintenance-description-input').value;

      // Validate required fields
      if (!maintenanceType) {
        showError('Please select a maintenance type.');
        return;
      }

      if (!category) {
        showError('Please select a maintenance category.');
        return;
      }

      if (maintenanceType === 'required' && !frequency) {
        showError('Please select a frequency for required maintenance.');
        return;
      }

      if (!description.trim()) {
        showError('Please provide a description.');
        return;
      }

      const formData = {
        ItemId: window.currentListing.id,
        Type: maintenanceType,
        Category: category,
        Frequency: maintenanceType === 'required' ? frequency : "",
        Description: description,
        Date: new Date().toISOString().split('T')[0]
      };

      console.log('🔧 Sending maintenance data to backend:', formData);

      try {
        const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
        const response = await fetch(`${API_BASE_URL}/maintenance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          closeMaintenanceModal();
          showSuccess(maintenanceType === 'required'
            ? 'Maintenance requirement added successfully!'
            : 'Maintenance history entry added successfully!');

          // Reload the listing to show the new maintenance entry
          await readListing();
        } else {
          const errorText = await response.text();
          showError(`Failed to add maintenance entry: ${errorText}`);
        }
      } catch (error) {
        console.error('Error adding maintenance entry:', error);
        showError('An error occurred while adding the maintenance entry.');
      }
    }

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
  }

  // Request Item Function
  async function requestItem(listing) {
    console.log('Requesting item:', listing.id);
    console.log('Current user at request time:', currentUser);
    
    // Show date selection modal instead of directly requesting
    showDateSelectionModal(listing);
  }

  // Show Date Selection Modal
  function showDateSelectionModal(listing) {
    const modal = document.getElementById('date-selection-modal');
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    startDateInput.min = today;
    endDateInput.min = today;
    
    // Set default start date to today and end date to 7 days from now
    startDateInput.value = today;
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);
    endDateInput.value = defaultEndDate.toISOString().split('T')[0];
    
    // Update end date minimum when start date changes
    startDateInput.addEventListener('change', function() {
      if (this.value) {
        endDateInput.min = this.value;
        // If end date is before start date, update it
        if (endDateInput.value && endDateInput.value < this.value) {
          endDateInput.value = this.value;
        }
      }
    });
    
    // Show modal
    modal.classList.add('active');
    
    // Handle confirm button
    const confirmBtn = document.getElementById('confirm-date-selection');
    confirmBtn.onclick = () => {
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;
      
      if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
      }
      
      if (new Date(endDate) <= new Date(startDate)) {
        alert('End date must be after start date.');
        return;
      }
      
      // Close modal and proceed with request
      modal.classList.remove('active');
      proceedWithRequest(listing, startDate, endDate);
    };
    
    // Handle cancel button
    const cancelBtn = document.getElementById('cancel-date-selection');
    const closeBtn = document.getElementById('close-date-selection');
    
    const closeModal = () => modal.classList.remove('active');
    cancelBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  // Proceed with request after date selection
  async function proceedWithRequest(listing, startDate, endDate) {
    console.log('Proceeding with request for dates:', startDate, 'to', endDate);

    // Check if user is authenticated
    if (!currentUser) {
      console.log('No currentUser found, checking localStorage...');
      const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
      const userData = localStorage.getItem('hippo_user') || localStorage.getItem('userData');
      console.log('Token exists:', !!token);
      console.log('User data exists:', !!userData);
      console.log('All localStorage keys:', Object.keys(localStorage));

      if (!token || !userData) {
        alert('Please log in to request items.');
        window.location.href = './Login.html';
        return;
      }

      // Try to get user data from localStorage
      try {
        const storedUser = JSON.parse(userData);
        currentUser = storedUser;
        console.log('Loaded user from localStorage:', currentUser);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        alert('Please log in to request items.');
        window.location.href = './Login.html';
        return;
      }
    }

    // Check if user is trying to request their own item
    const currentUserId = currentUser?.Id || currentUser?.id || currentUser?.userId;
    if (currentUserId === listing.seller.id) {
      alert('You cannot request your own item.');
      return;
    }

    const requestBtn = document.getElementById('request-item-btn');
    const originalText = requestBtn.textContent;

    try {
      // Disable button and show loading state with animation
      requestBtn.disabled = true;
      requestBtn.innerHTML = `
        <div class="flex items-center justify-center">
          <svg class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="font-medium">Requesting...</span>
        </div>
      `;
      requestBtn.classList.add('opacity-75', 'cursor-not-allowed');

      // Prepare request data according to Swagger docs
      const requestData = {
        ownerId: listing.seller.id,
        borrowerId: currentUserId,
        itemId: listing.id,
        startDate: startDate,
        endDate: endDate
      };

      console.log('Sending request data:', requestData);

      const response = await fetch(`${API_BASE_URL}/exchanges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hippo_token')}`
        },
        body: JSON.stringify(requestData)
      });

      console.log('Request response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          errorMessage = errorData.title || errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('Error text:', errorText);
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Request created successfully:', result);

      // Create message thread between requester and owner
      await createMessageThread(listing, currentUser);

      // Send notification to the item owner
      await sendRequestNotification(listing, currentUser);

      // Show success state with enhanced styling and animation
      requestBtn.innerHTML = `
        <div class="flex items-center justify-center relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-r from-green-400 via-green-500 to-green-600"></div>
          <div class="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div class="relative flex items-center justify-center w-full">
            <div class="success-checkmark mr-3 relative">
              <div class="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
              <svg class="w-4 h-4 text-white relative z-10 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div class="text-center">
              <div class="font-bold text-white text-sm">Request Sent!</div>
              <div class="text-green-100 text-xs mt-0.5">Owner will be notified</div>
            </div>
          </div>
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
        </div>
      `;
      requestBtn.classList.remove('btn-primary', 'opacity-75', 'cursor-not-allowed');
      requestBtn.classList.add('bg-green-500', 'text-white', 'border-green-500', 'shadow-xl', 'shadow-green-500/30', 'rounded-full');

      // Add a subtle pulse animation
      requestBtn.style.animation = 'successPulse 2s ease-in-out infinite';

      // Add success information panel
      addSuccessInfoPanel(listing);

      // Show success toast notification with inbox link
      showToast('✅ Request sent successfully! A message thread has been created and the owner will be notified.', 'success');

      // Add a button to go to inbox after a short delay
      setTimeout(() => {
        showToast('💬 Check your inbox to see the new message thread!', 'info', 5000);
      }, 2000);

    } catch (error) {
      console.error('❌ Error requesting item:', error);

      // Remove success panel if it exists
      const successPanel = document.getElementById('success-info-panel');
      if (successPanel) {
        successPanel.remove();
      }

      // Re-enable button with original styling
      requestBtn.disabled = false;
      requestBtn.innerHTML = `
        <div class="flex items-center justify-center">
          <svg class="w-4 h-4 mr-2 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span class="font-medium">Request Item</span>
        </div>
      `;
      requestBtn.classList.remove('opacity-75', 'cursor-not-allowed', 'bg-green-500', 'hover:bg-green-600', 'text-white', 'border-green-500', 'shadow-xl', 'shadow-green-500/30', 'transform', 'scale-105');
      requestBtn.classList.add('btn-primary');
      requestBtn.style.animation = '';

      // Show error toast
      showToast(`❌ Error: ${error.message}`, 'error');
    }
  }

  // Add success information panel
  function addSuccessInfoPanel(listing) {
    // Remove existing success panel if any
    const existingPanel = document.getElementById('success-info-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Create success info panel
    const successPanel = document.createElement('div');
    successPanel.id = 'success-info-panel';
    successPanel.className = 'glass p-4 rounded-lg mt-4 border-l-4 border-green-500 bg-green-50/50';
    successPanel.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        </div>
        <div class="flex-1">
          <h4 class="font-semibold text-green-800 text-sm mb-1">Request Submitted Successfully!</h4>
          <p class="text-green-700 text-xs mb-2">Your request to borrow "${listing.title}" has been sent to ${listing.seller.name}.</p>
          <div class="space-y-1 text-xs text-green-600">
            <div class="flex items-center gap-2">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Owner will be notified via notification</span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <span>Check your exchanges for updates</span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <span>A message thread has been created for you to discuss details</span>
            </div>
            <div class="mt-3">
              <a href="./inbox.html" class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                Go to Inbox to view the conversation
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to the user controls section
    const userControls = document.getElementById('user-controls');
    if (userControls) {
      userControls.appendChild(successPanel);

      // Animate in
      successPanel.style.opacity = '0';
      successPanel.style.transform = 'translateY(10px)';
      successPanel.style.transition = 'all 0.3s ease-out';

      setTimeout(() => {
        successPanel.style.opacity = '1';
        successPanel.style.transform = 'translateY(0)';
      }, 100);
    }
  }

  // Send notification function
  async function sendRequestNotification(listing, requester) {
    try {
      console.log('📧 Sending notification to item owner...');

      // Get requester's display name
      const requesterName = requester?.FirstName && requester?.LastName
        ? `${requester.FirstName} ${requester.LastName}`
        : requester?.email || 'Someone';

      // Prepare notification data according to Swagger docs
      const notificationData = {
        senderId: requester?.Id || requester?.id || requester?.userId,
        receiverId: listing.seller.id,
        message: `${requesterName} has requested to borrow your item "${listing.title}". Check your exchanges to approve or decline the request.`,
        title: 'New Item Request',
        type: 'exchange_request',
        listingId: listing.id,
        senderAvatar: requester?.profilePicture || 'hippo-exchange-logo.png'
      };

      console.log('📤 Sending notification data:', notificationData);

      const notificationResponse = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hippo_token')}`
        },
        body: JSON.stringify(notificationData)
      });

      console.log('📥 Notification response status:', notificationResponse.status);

      if (!notificationResponse.ok) {
        console.warn('⚠️ Failed to send notification:', notificationResponse.status);
        // Don't fail the whole request if notification fails
        return;
      }

      const notificationResult = await notificationResponse.json();
      console.log('✅ Notification sent successfully:', notificationResult);

    } catch (error) {
      console.warn('⚠️ Error sending notification:', error);
      // Don't fail the whole request if notification fails
    }
  }

  // Create message thread function
  async function createMessageThread(listing, requester) {
    try {
      console.log('💬 Creating message thread between requester and owner...');

      // Get requester's display name
      const requesterName = requester?.FirstName && requester?.LastName
        ? `${requester.FirstName} ${requester.LastName}`
        : requester?.email || 'Someone';

      // Prepare thread data
      const threadData = {
        participantIds: [requester?.Id || requester?.id || requester?.userId, listing.seller.id],
        subject: `Item Request: ${listing.title}`
      };

      console.log('📤 Creating thread data:', threadData);
      console.log('📤 Requester ID:', requester?.Id || requester?.id || requester?.userId);
      console.log('📤 Seller ID:', listing.seller.id);

      const threadResponse = await fetch(`${API_BASE_URL}/messages/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hippo_token')}`
        },
        body: JSON.stringify(threadData)
      });

      console.log('📥 Thread response status:', threadResponse.status);

      if (!threadResponse.ok) {
        console.warn('⚠️ Failed to create message thread:', threadResponse.status);
        // Don't fail the whole request if thread creation fails
        return;
      }

      const threadResult = await threadResponse.json();
      console.log('✅ Message thread created successfully:', threadResult);

      // Send initial message in the thread
      if (threadResult.id) {
        await sendInitialMessage(threadResult.id, listing, requester);
      }

    } catch (error) {
      console.warn('⚠️ Error creating message thread:', error);
      // Don't fail the whole request if thread creation fails
    }
  }

  // Send initial message in the thread
  async function sendInitialMessage(threadId, listing, requester) {
    try {
      console.log('📝 Sending initial message in thread...');

      // Get requester's display name
      const requesterName = requester?.FirstName && requester?.LastName
        ? `${requester.FirstName} ${requester.LastName}`
        : requester?.email || 'Someone';

      // Prepare initial message
      const messageData = {
        body: `Hi! I'm interested in borrowing your item "${listing.title}". Could we discuss the details?`,
        senderId: requester?.Id || requester?.id || requester?.userId
      };

      console.log('📤 Sending initial message data:', messageData);

      const messageResponse = await fetch(`${API_BASE_URL}/messages/threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hippo_token')}`
        },
        body: JSON.stringify(messageData)
      });

      console.log('📥 Message response status:', messageResponse.status);

      if (!messageResponse.ok) {
        console.warn('⚠️ Failed to send initial message:', messageResponse.status);
        return;
      }

      const messageResult = await messageResponse.json();
      console.log('✅ Initial message sent successfully:', messageResult);

    } catch (error) {
      console.warn('⚠️ Error sending initial message:', error);
    }
  }

  function addInteractivity(listing) {
    const requestBtn = $('request-item-btn');
    requestBtn?.addEventListener('click', async () => {
      await requestItem(listing);
    });


    const saveBtn = $('save-btn');
    saveBtn?.addEventListener('click', async () => {
      console.log('Save listing:', listing.id);
      saveBtn.textContent = saveBtn.textContent === 'Save' ? 'Saved' : 'Save';
      saveBtn.classList.toggle('btn-primary');
      saveBtn.classList.toggle('btn-ghost');
    });

    const shareBtn = $('share-btn');
    shareBtn?.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: listing.title,
          text: `Check out this listing: ${listing.title}`,
          url: window.location.href
        }).catch(err => console.log('Error sharing:', err));
      } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
          const originalText = shareBtn.textContent;
          shareBtn.textContent = 'Link copied!';
          setTimeout(() => {
            shareBtn.textContent = originalText;
          }, 2000);
        });
      }
    });

    const viewProfileBtn = $('view-profile');
    console.log('🔍 View profile button found:', !!viewProfileBtn);
    console.log('🔍 View profile button element:', viewProfileBtn);

    if (viewProfileBtn) {
      viewProfileBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent default link behavior
        console.log('🔍 View profile clicked!');
        console.log('🔍 Listing object:', listing);
        console.log('🔍 Listing seller:', listing.seller);
        console.log('🔍 Seller ID:', listing.seller?.id);
        console.log('🔍 Seller name:', listing.seller?.name);

        if (listing.seller?.id) {
          const url = `./otheruser.html?userId=${listing.seller.id}`;
          console.log('🔍 Full URL will be:', url);
          window.location.href = url;
        } else {
          console.error('❌ No seller ID found in listing object!');
          console.error('❌ Listing seller object:', listing.seller);
        }
      });
    } else {
      console.error('❌ View profile button not found!');
    }
  }

  // Set up sign-out functionality
  const signoutButton = document.querySelector('a[href="./Login.html"]');
  if (signoutButton) {
    signoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
  }

});

const back = document.getElementById('back-btn');
back?.addEventListener('click', (e) => {
  const ref = document.referrer ? new URL(document.referrer) : null;
  const sameSite = ref && ref.origin === location.origin;

  if (sameSite) {
    e.preventDefault();
    history.back();
  }
});


// Authentication and user data functions
async function checkAuthAndLoadUser() {
  console.log('Checking authentication...');

  // Debug: Show all localStorage keys
  console.log('All localStorage keys:', Object.keys(localStorage));

  const token = localStorage.getItem('hippo_token');
  const userData = localStorage.getItem('hippo_user');

  // Also check for alternative keys that might be used
  const altToken = localStorage.getItem('userToken');
  const altUserData = localStorage.getItem('userData');

  console.log('hippo_token exists:', !!token);
  console.log('hippo_user exists:', !!userData);
  console.log('userToken exists:', !!altToken);
  console.log('userData exists:', !!altUserData);
  console.log('Token value:', token ? 'Present' : 'Missing');
  console.log('User data value:', userData ? 'Present' : 'Missing');

  if (!token || !userData) {
    console.log('No token or user data found');
    // Don't redirect immediately, let the user try to use the page
    // They'll be redirected when they try to request an item
    return;
  }

  // First, try to display user info from localStorage as a fallback
  try {
    const storedUser = JSON.parse(userData);
    console.log('Stored user data:', storedUser);
    currentUser = storedUser;
    displayUserInfo(storedUser);
  } catch (error) {
    console.error('Error parsing stored user data:', error);
  }

  try {
    console.log('Verifying token with /auth/me...');
    // Verify token is still valid by calling /auth/me
    const response = await fetch('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Auth response status:', response.status);

    if (!response.ok) {
      console.log('Token invalid, but keeping stored user data for now');
      // Don't redirect immediately, keep the stored user data
      return;
    }

    const currentUserData = await response.json();
    console.log('Current user from /auth/me:', currentUserData);
    currentUser = currentUserData;
    displayUserInfo(currentUserData);

  } catch (error) {
    console.error('Auth check failed:', error);
    // Don't redirect on network errors, keep the stored user data
    console.log('Network error, keeping stored user data');
  }
}

function displayUserInfo(user) {
  console.log('Displaying user info:', user); // Debug log

  // Check for both uppercase and lowercase property names
  const firstName = user.FirstName || user.firstName;
  const lastName = user.LastName || user.lastName;
  const email = user.Email || user.email;

  let displayName = 'User';
  if (firstName && lastName) {
    displayName = `${firstName} ${lastName}`;
  } else if (email) {
    displayName = email;
  }

  console.log('Computed display name:', displayName);

  // Update the account name display in sidebar
  const accountNameElement = document.getElementById('acct-name');
  console.log('Account name element found:', !!accountNameElement);
  if (accountNameElement) {
    accountNameElement.textContent = displayName;
    console.log('Set account name to:', displayName);
  } else {
    console.error('Account name element not found!');
  }
}

function clearAuthData() {
  localStorage.removeItem('hippo_user');
  localStorage.removeItem('hippo_token');
  localStorage.removeItem('userToken');
  localStorage.removeItem('userData');
  sessionStorage.removeItem('userToken');
  sessionStorage.removeItem('userData');

  document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

function signOut() {
  clearAuthData();
  window.location.href = './Login.html';
}

// Toast notification system
function showToast(message, type = 'info') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast-notification');
  existingToasts.forEach(toast => toast.remove());

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'toast-notification fixed top-4 right-4 z-50 max-w-sm w-full';

  const bgColor = type === 'success' ? 'bg-green-500' :
    type === 'error' ? 'bg-red-500' :
      type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';

  toast.innerHTML = `
      <div class="${bgColor} text-white px-6 py-4 rounded-lg shadow-lg border border-white/20 backdrop-blur-sm">
        <div class="flex items-center">
          <div class="flex-1">
            <p class="text-sm font-medium">${message}</p>
          </div>
          <button class="ml-4 text-white/80 hover:text-white transition-colors" onclick="this.parentElement.parentElement.parentElement.remove()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    `;

  // Add to page
  document.body.appendChild(toast);

  // Animate in
  toast.style.transform = 'translateX(100%)';
  toast.style.opacity = '0';
  toast.style.transition = 'all 0.3s ease-out';

  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.transform = 'translateX(100%)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}