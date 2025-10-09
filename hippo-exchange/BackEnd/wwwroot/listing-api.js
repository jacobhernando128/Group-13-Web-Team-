// listing-api.js — Connect to your C# API
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const PLACEHOLDER_IMG = 'https://placehold.co/1200x700/ffffff/111111?text=Listing+Image';
  const money = (n) =>
    (n === null || n === undefined || n === '')
      ? '$—'
      : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n));

  const API_BASE_URL = 'http://localhost:5000';

  const qs = new URLSearchParams(location.search);
  const itemId = qs.get('id') || qs.get('item');

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
        price: item.dollarCost || 0, // Updated to use dollarCost
        condition: item.condition || (item.available ? 'Available' : 'Not Available'),
        description: item.description || '',
        images: item.images || [],
        imageUrl: item.imageUrl || item.images?.[0] || PLACEHOLDER_IMG,
        createdUtc: item.createdUtc,
        isNew: item.createdUtc ? (new Date() - new Date(item.createdUtc)) < (7 * 24 * 60 * 60 * 1000) : false,
        featured: false,
        seller: {
          id: item.userId, // Updated to use userId
          name: seller?.name || 'Unknown Seller',
          email: seller?.email || '',
          avatar: seller?.profilePicture || 'hippo-exchange-logo.png',
          since: seller?.createdUtc ? `Joined ${new Date(seller.createdUtc).getFullYear()}` : 'Member',
        },
        locationLabel: item.locationLabel || item.location || '',
        ships: item.ships || true,
        pickup: '',
        lat: item.lat || null,
        lng: item.lng || null,
        maintenance: maintenanceData, // Add maintenance data
        bullets: [
          `Status: ${item.available ? 'Available' : 'Not Available'}`,
          item.categories && item.categories.length > 0 ? `Category: ${item.categories.join(', ')}` : null,
          item.condition ? `Condition: ${item.condition}` : null,
          `Created: ${item.createdUtc ? new Date(item.createdUtc).toLocaleDateString() : 'Unknown'}`,
          item.userId ? `Seller ID: ${item.userId}` : null
        ].filter(Boolean)
      };

    } catch (error) {
      console.error('Error reading listing:', error);
      throw error;
    }
  }

  function render(listing) {
    $('listing-title').textContent = listing.title;
    $('price').textContent = money(listing.price);
    $('condition').textContent = listing.condition ? `Condition: ${listing.condition}` : '';

    const badge = $('badge');
    if (!listing.isNew && !listing.featured) {
      badge?.remove();
    } else {
      badge.textContent = listing.isNew ? 'Just listed' : 'Featured';
    }

    const hero   = $('hero-img');
    const thumbs = $('thumbs');
    const imgs   = listing.images && listing.images.length ? listing.images : [listing.imageUrl];

    hero.src = imgs[0] || PLACEHOLDER_IMG;
    hero.alt = `${listing.title} photo`;

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
    if (typeof L !== 'undefined' && listing.lat && listing.lng) {
      const map = L.map('detail-map', { zoomControl: true, scrollWheelZoom: true })
                  .setView([listing.lat, listing.lng], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      L.marker([listing.lat, listing.lng]).addTo(map);
      setTimeout(() => map.invalidateSize(), 120);
    } else {
      const mapContainer = $('detail-map');
      if (mapContainer) {
        mapContainer.style.display = 'none';
        const mapParent = mapContainer.parentElement;
        if (mapParent) {
          mapParent.style.display = 'none';
        }
      }
    }

    // Render maintenance data
    console.log('📋 Listing data for maintenance rendering:', listing);
    renderMaintenance(listing.maintenance || []);

    addInteractivity(listing);
  }

  function renderMaintenance(maintenanceData) {
    console.log('🎨 Rendering maintenance data:', maintenanceData);
    
    const maintenanceList = document.getElementById('maintenance-list');
    const maintenanceEmpty = document.getElementById('maintenance-empty');

    if (!maintenanceList || !maintenanceEmpty) {
      console.warn('⚠️ Maintenance DOM elements not found');
      return;
    }

    // Clear existing content
    maintenanceList.innerHTML = '';

    if (maintenanceData.length === 0) {
      maintenanceEmpty.style.display = 'block';
      return;
    }

    maintenanceEmpty.style.display = 'none';

    // Render maintenance history (sorted by createdUtc)
    const sortedMaintenance = [...maintenanceData].sort((a, b) => 
      new Date(b.createdUtc) - new Date(a.createdUtc)
    );

    sortedMaintenance.forEach(maintenance => {
      const entry = document.createElement('div');
      
      const frequencyColors = {
        cleaning: 'border-green-500',
        repair: 'border-red-500',
        inspection: 'border-yellow-500',
        upgrade: 'border-purple-500',
        maintenance: 'border-blue-500'
      };
      
      entry.className = `glass p-3 rounded-lg border-l-4 ${frequencyColors[maintenance.frequency] || 'border-blue-500'}`;
      
      entry.innerHTML = `
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            ${maintenance.frequency.charAt(0).toUpperCase() + maintenance.frequency.slice(1)}
          </span>
          <span class="text-sm text-slate-600">${new Date(maintenance.createdUtc).toLocaleDateString()}</span>
        </div>
        <p class="text-slate-700 text-sm">${maintenance.description}</p>
      `;
      
      maintenanceList.appendChild(entry);
    });
  }

  function addInteractivity(listing) {
    const messageBtn = $('message-btn');
    messageBtn?.addEventListener('click', () => {
      console.log('Message seller:', listing.seller.name, 'ID:', listing.seller.id);
      alert(`Contact ${listing.seller.name} at ${listing.seller.email || 'email not available'}`);
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
    viewProfileBtn?.addEventListener('click', () => {
      console.log('View profile:', listing.seller.id);
      alert(`View profile for ${listing.seller.name} (User ID: ${listing.seller.id})`);
    });
  }

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