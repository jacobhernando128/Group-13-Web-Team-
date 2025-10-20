// home.js — Backend API powered grid

// Geocoding cache to avoid repeated API calls
const geocodingCache = new Map();

// Location loading screen functions
function showLocationLoadingScreen() {
  // Create loading overlay if it doesn't exist
  let loadingOverlay = document.getElementById('location-loading-overlay');
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'location-loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="location-loading-content">
        <div class="location-loading-spinner"></div>
        <h3>Filtering by location...</h3>
        <p>Finding items within your selected area</p>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
  }
  
  // Show the loading screen
  loadingOverlay.style.display = 'flex';
  loadingOverlay.classList.add('active');
}

function hideLocationLoadingScreen() {
  const loadingOverlay = document.getElementById('location-loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('active');
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
    }, 300);
  }
}

// Location persistence functions (moved outside DOMContentLoaded scope)
function saveLocationFilter(locationFilter) {

  
  if (locationFilter) {
    const filterData = JSON.stringify(locationFilter);
    const displayData = JSON.stringify({
      cityText: document.getElementById('header-location').textContent,
      inputValue: document.getElementById('location-input')?.value || ''
    });
    


    
    localStorage.setItem('hippo_location_filter', filterData);
    localStorage.setItem('hippo_location_display', displayData);
    

  } else {

    localStorage.removeItem('hippo_location_filter');
    localStorage.removeItem('hippo_location_display');
  }
}

function loadLocationFilter() {
  try {
    // Debug: Check all localStorage keys
    console.log('All localStorage keys:', Object.keys(localStorage));
    
    const saved = localStorage.getItem('hippo_location_filter');

    
    if (saved) {
      currentLocationFilter = JSON.parse(saved);

      
      // Restore display information
      const displayInfo = localStorage.getItem('hippo_location_display');

      
      if (displayInfo) {
        const display = JSON.parse(displayInfo);

        
        const headerEl = document.getElementById('header-location');

        
        if (headerEl) {
          headerEl.textContent = display.cityText;

        } else {
          console.error('❌ Header element not found!');
        }
      }
      

      return currentLocationFilter;
    } else {

    }
  } catch (error) {
    console.error('❌ Error loading saved location filter:', error);
    localStorage.removeItem('hippo_location_filter');
    localStorage.removeItem('hippo_location_display');
  }
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  // Only run on Home.html page
  if (!window.location.pathname.includes('Home.html')) {
    return;
  }
  

  // Check authentication and load user data
  checkAuthAndLoadUser();
  const grid = document.getElementById('listings-grid');
  const tpl = document.getElementById('item-card-template');
  const filterCount = document.getElementById('filter-count');

  // Mobile menu functionality
  const menuButton = document.getElementById('menu-button');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const iconHam = document.getElementById('icon-ham');

  function toggleMobileMenu() {
    const isOpen = sidebar.classList.contains('translate-x-0');

    if (isOpen) {
      sidebar.classList.remove('translate-x-0');
      sidebar.classList.add('-translate-x-full');
      sidebarBackdrop.classList.add('hidden');
      menuButton.setAttribute('aria-expanded', 'false');
    } else {
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

  if (menuButton) {
    menuButton.addEventListener('click', toggleMobileMenu);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileMenu);
  }

  const navLinks = sidebar.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        closeMobileMenu();
      }
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      closeMobileMenu();
    }
  });

  // Search functionality
  const searchInput = document.getElementById('search-input');
  let searchTimeout = null;

  async function performSearch(query) {
    currentSearchQuery = query.trim();

    // Reset pagination when searching
    paginationInfo = { totalCount: 0, limit: 100, offset: 0, hasMore: false };
    
    let filteredItems = allListings;

    // Apply location filter first
    filteredItems = await filterByLocation(filteredItems, currentLocationFilter);

    if (currentCategory !== 'all') {
      filteredItems = filteredItems.filter(item => {
        // Check if item has categories array and if it contains the selected category
        if (item.categories && Array.isArray(item.categories)) {
          return item.categories.some(cat => 
            cat.toLowerCase() === currentCategory.toLowerCase() ||
            mapCategoryName(cat).toLowerCase() === currentCategory.toLowerCase()
          );
        }
        // Fallback to old category field if it exists
        if (item.category) {
          return item.category.toLowerCase() === currentCategory.toLowerCase() ||
                 mapCategoryName(item.category).toLowerCase() === currentCategory.toLowerCase();
        }
        return false;
      });
    }

    if (currentSearchQuery) {
      const searchTerm = currentSearchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item => {
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const location = (item.location || item.locationLabel || '').toLowerCase();

        // Check categories array for search term
        let categoryMatch = false;
        if (item.categories && Array.isArray(item.categories)) {
          categoryMatch = item.categories.some(cat => 
            cat.toLowerCase().includes(searchTerm)
          );
        } else if (item.category) {
          categoryMatch = item.category.toLowerCase().includes(searchTerm);
        }

        return title.includes(searchTerm) ||
          description.includes(searchTerm) ||
          categoryMatch ||
          location.includes(searchTerm);
      });
    }

    render(filteredItems);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      searchTimeout = setTimeout(async () => {
        await performSearch(query);
      }, 300);
    });

    searchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        await performSearch(e.target.value);
      }
    });
  }

  const PLACEHOLDER_IMG = 'https://placehold.co/600x400/ffffff/111111?text=Listing+Image';

let currentCategory = 'all';
let allListings = [];
let paginationInfo = { totalCount: 0, limit: 100, offset: 0, hasMore: false };
let isLoadingMore = false;
let currentLocationFilter = null; // Store current location filter
let currentSearchQuery = ''; // Store current search query globally


  // Map backend category names to frontend category buttons
  function mapCategoryName(backendCategory) {
    const categoryMap = {
      'Electronics': 'electronics',
      'Furniture': 'furniture', 
      'Clothing': 'clothing',
      'Vehicles': 'vehicles',
      'Sports & Recreation': 'sports',
      'Books & Media': 'books',
      'Home & Garden': 'home',
      'Other': 'other',
      'Entertainment': 'electronics', // Map to electronics
      'Food': 'other' // Map to other
    };
    return categoryMap[backendCategory] || 'other';
  }

  // Calculate distance between two coordinates using Haversine formula
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Filter items by location with caching for better performance
  async function filterByLocation(items, locationFilter) {
    if (!locationFilter || !locationFilter.lat || !locationFilter.lng) {

      return items;
    }
    
    const { lat, lng, radius } = locationFilter;


    
    const filteredItems = [];
    const itemsToGeocode = [];
    
    // First pass: check cache and collect items that need geocoding
    for (const item of items) {
      // If item has no location string, include it (for items that ship)
      if (!item.location && !item.locationLabel) {

        filteredItems.push(item);
        continue;
      }
      
      const itemLocation = item.location || item.locationLabel;
      const cacheKey = itemLocation.toLowerCase().trim();
      
      if (geocodingCache.has(cacheKey)) {
        const cachedCoords = geocodingCache.get(cacheKey);
        const distance = calculateDistance(lat, lng, cachedCoords.lat, cachedCoords.lon);
        
        if (distance <= radius) {
          console.log(`✅ Item "${item.title}" (cached) is ${distance.toFixed(1)}mi away (within ${radius}mi radius)`);
          filteredItems.push(item);
        } else {
          console.log(`❌ Item "${item.title}" (cached) is ${distance.toFixed(1)}mi away (outside ${radius}mi radius)`);
        }
      } else {
        itemsToGeocode.push(item);
      }
    }
    

    
    // Batch geocode remaining items (limit to 3 concurrent requests to avoid rate limiting)
    const batchSize = 3;
    for (let i = 0; i < itemsToGeocode.length; i += batchSize) {
      const batch = itemsToGeocode.slice(i, i + batchSize);
      
      const geocodePromises = batch.map(async (item) => {
        const itemLocation = item.location || item.locationLabel;

        
        try {
          const itemCoords = await geocode(itemLocation);

          
          if (itemCoords) {
            // Cache the result
            const cacheKey = itemLocation.toLowerCase().trim();
            geocodingCache.set(cacheKey, { lat: itemCoords.lat, lon: itemCoords.lon });
            
            const distance = calculateDistance(lat, lng, itemCoords.lat, itemCoords.lon);
            const isWithinRadius = distance <= radius;
            
            console.log(`Distance from "${item.title}" to selected location: ${distance.toFixed(1)}mi (radius: ${radius}mi)`);
            
            if (isWithinRadius) {
              console.log(`✅ Item "${item.title}" is ${distance.toFixed(1)}mi away (within ${radius}mi radius)`);
              return item;
            } else {
              console.log(`❌ Item "${item.title}" is ${distance.toFixed(1)}mi away (outside ${radius}mi radius)`);
              return null;
            }
          } else {
            // If geocoding fails, include the item (better to show than hide)

            return item;
          }
        } catch (error) {
          console.error(`❌ Error geocoding location for item "${item.title}":`, error);
          // If geocoding fails, include the item (better to show than hide)
          return item;
        }
      });
      
      const batchResults = await Promise.all(geocodePromises);
      filteredItems.push(...batchResults.filter(item => item !== null));
      
      // Small delay between batches to be respectful to the API
      if (i + batchSize < itemsToGeocode.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    

    return filteredItems;
  }

  const formatPrice = (val) =>
    (val === null || val === undefined || val === '')
      ? '$—'
      : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(Number(val));

  const pickHomeFields = (item) => {
    // Handle both backend API format and fallback JSON format
    const hero = item.imageUrl || 
                 (Array.isArray(item.images) && item.images[0]) || 
                 (Array.isArray(item.pictures) && item.pictures[0]) || 
                 PLACEHOLDER_IMG;
    
    // Use dollarCost from backend, fallback to price from JSON
    const price = item.dollarCost ?? item.price ?? '';
    
    // Use location from backend, fallback to locationLabel from JSON
    const locationLabel = item.location ?? item.locationLabel ?? (item.ships ? 'Ships to you' : '');
    
    return {
      id: item.id ?? '',
      slug: item.slug ?? '',
      title: item.title ?? 'Untitled listing',
      price: price,
      locationLabel: locationLabel,
      imageUrl: hero,
      isNew: !!item.isNew,
      ships: !!item.ships,
      // Include backend fields for compatibility
      categories: item.categories || (item.category ? [item.category] : []),
      category: item.category || (item.categories && item.categories[0]) || 'other',
      description: item.description || '',
      condition: item.condition || ''
    };
  };

  function toCard(min) {
    const el = tpl?.content?.firstElementChild
      ? tpl.content.firstElementChild.cloneNode(true)
      : document.createElement('article');

    if (!tpl) {
      el.className = 'glass rounded-lg overflow-hidden shadow-lg';
      el.innerHTML = `
        <div class="relative">
          <img class="card-img w-full h-[170px] object-cover" alt="">
          <span class="badge absolute top-2 left-2 text-xs font-semibold px-2 py-1 rounded-full">Just listed</span>
        </div>
        <div class="p-4">
          <p class="title text-slate-700 text-sm"></p>
          <p class="sub text-slate-600 text-xs mt-1" data-field="location"></p>
        </div>`;
    }

    el.dataset.id = min.id;
    const img = el.querySelector('.card-img');
    const title = el.querySelector('.title');
    const loc = el.querySelector('[data-field="location"]');
    const badge = el.querySelector('.badge');

    img.src = min.imageUrl || PLACEHOLDER_IMG;
    img.alt = min.title ? `${min.title} photo` : 'Listing image';

    title.textContent = min.title;
    loc.textContent = min.locationLabel || (min.ships ? 'Ships to you' : '');

    if (!min.isNew) badge?.remove();

    el.addEventListener('click', () => {
      if (min.slug) location.href = `listing.html?slug=${encodeURIComponent(min.slug)}`;
      else if (min.id) location.href = `listing.html?id=${encodeURIComponent(min.id)}`;
    });

    return el;
  }

  function render(items) {
    // Check if grid exists before proceeding
    if (!grid) {
      console.error('Grid element not found');
      return;
    }
    
    // Clear all item cards but preserve load more button
    const loadMoreBtn = document.getElementById('load-more-btn');
    const children = Array.from(grid.children);
    
    // Remove all children except load more button
    children.forEach(child => {
      if (child.id !== 'load-more-btn') {
        child.remove();
      }
    });
    
    // Add all items
    items.map(pickHomeFields).forEach(min => grid.appendChild(toCard(min)));
    updateFilterCount(items.length);
  }

  function updateFilterCount(count) {
    if (currentCategory === 'all') {
      filterCount.textContent = `${count} items`;
    } else {
      const categoryName = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
      filterCount.textContent = `${count} ${categoryName} items`;
    }
  }

  function updateLoadMoreButton() {
    let loadMoreBtn = document.getElementById('load-more-btn');
    
    if (!loadMoreBtn && paginationInfo.hasMore) {
      // Create load more button if it doesn't exist and there are more items
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'col-span-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 mt-6';
      loadMoreBtn.textContent = 'Load More Items';
      loadMoreBtn.addEventListener('click', loadMore);
      grid.appendChild(loadMoreBtn);
    } else if (loadMoreBtn && !paginationInfo.hasMore) {
      // Remove button if no more items
      loadMoreBtn.remove();
    } else if (loadMoreBtn) {
      // Update button text with count info
      const remaining = paginationInfo.totalCount - allListings.length;
      loadMoreBtn.textContent = `Load More Items (${remaining} remaining)`;
    }
  }

  async function loadMore() {
    if (isLoadingMore) return;
    
    isLoadingMore = true;
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Loading...';
      loadMoreBtn.disabled = true;
    }

    // Update offset for next page
    paginationInfo.offset = allListings.length;
    
    try {
      await load(true);
    } finally {
      isLoadingMore = false;
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
      }
    }
  }

  async function filterByCategory(category) {
    currentCategory = category;


    // Reset pagination when filtering
    paginationInfo = { totalCount: 0, limit: 100, offset: 0, hasMore: false };
    
    let filteredItems = allListings;

    // Apply location filter first
    filteredItems = await filterByLocation(filteredItems, currentLocationFilter);

    if (category !== 'all') {
      filteredItems = filteredItems.filter(item => {
        // Check if item has categories array and if it contains the selected category
        if (item.categories && Array.isArray(item.categories)) {
          const matches = item.categories.some(cat => 
            cat.toLowerCase() === category.toLowerCase() ||
            mapCategoryName(cat).toLowerCase() === category.toLowerCase()
          );
          if (matches) {

          }
          return matches;
        }
        // Fallback to old category field if it exists
        if (item.category) {
          return item.category.toLowerCase() === category.toLowerCase() ||
                 mapCategoryName(item.category).toLowerCase() === category.toLowerCase();
        }
        return false;
      });
    }

    if (currentSearchQuery) {
      const searchTerm = currentSearchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item => {
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const location = (item.location || item.locationLabel || '').toLowerCase();

        // Check categories array for search term
        let categoryMatch = false;
        if (item.categories && Array.isArray(item.categories)) {
          categoryMatch = item.categories.some(cat => 
            cat.toLowerCase().includes(searchTerm)
          );
        } else if (item.category) {
          categoryMatch = item.category.toLowerCase().includes(searchTerm);
        }

        return title.includes(searchTerm) ||
          description.includes(searchTerm) ||
          categoryMatch ||
          location.includes(searchTerm);
      });
    }

    render(filteredItems);
    updateCategoryButtons(category);
  }

  function updateCategoryButtons(activeCategory) {
    const buttons = document.querySelectorAll('.category-filter');
    buttons.forEach(button => {
      const category = button.dataset.category;
      if (category === activeCategory) {
        button.classList.add('active', 'bg-blue-100', 'text-blue-800', 'border-blue-400', 'shadow-sm');
        button.classList.remove('bg-white/40', 'text-slate-700', 'bg-blue-500', 'text-white', 'shadow-md');
      } else {
        button.classList.remove('active', 'bg-blue-100', 'text-blue-800', 'border-blue-400', 'shadow-sm', 'bg-blue-500', 'text-white', 'shadow-md');
        button.classList.add('bg-white/40', 'text-slate-700');
      }
    });
  }

  // Check if an item is currently loaned out
  async function isItemLoanedOut(itemId, ownerId) {
    try {

      
      if (!ownerId) {

        return false;
      }
      
      // Get all exchanges for this item's owner
      const response = await fetch(`/exchanges/owner/${ownerId}`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to fetch exchanges for owner:', response.status);
        return false;
      }

      const exchanges = await response.json();
      const now = new Date();
      
      // Check if there's an approved exchange for this item that's currently active
      const activeExchange = exchanges.find(exchange => {
        const isApproved = exchange.approved === true || exchange.Approved === true;
        const isForThisItem = exchange.itemID === itemId || exchange.itemId === itemId;
        
        if (!isApproved || !isForThisItem) {
          return false;
        }
        
        // Check if the exchange is currently active (between start and end dates)
        const startDate = new Date(exchange.startDate);
        const endDate = new Date(exchange.endDate);
        
        return now >= startDate && now <= endDate;
      });

      if (activeExchange) {

        return true;
      }


      return false;

    } catch (error) {
      console.error('❌ Error checking if item is loaned out:', error);
      return false; // Default to showing the item if we can't check
    }
  }

  // Filter out loaned out items from the listings
  async function filterLoanedOutItems(items) {

    
    const availableItems = [];
    
    for (const item of items) {
      const ownerId = item.userId || item.ownerId;
      const isLoanedOut = await isItemLoanedOut(item.id, ownerId);
      if (!isLoanedOut) {
        availableItems.push(item);
      }
    }
    
    console.log(`✅ Filtered to ${availableItems.length} available items (removed ${items.length - availableItems.length} loaned out items)`);
    return availableItems;
  }

  async function load(loadMore = false) {
    try {
      if (!loadMore) {
        if (grid) {
          grid.innerHTML = '<div class="col-span-full text-center text-slate-600 py-8">Loading listings...</div>';
        }
        allListings = [];
        paginationInfo = { totalCount: 0, limit: 100, offset: 0, hasMore: false };
      }

      const url = `/items?limit=${paginationInfo.limit}&offset=${paginationInfo.offset}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      
      let rawItems = [];
      // Handle new pagination response format
      if (data.items && Array.isArray(data.items)) {
        rawItems = data.items;
        paginationInfo = {
          totalCount: data.totalCount || 0,
          limit: data.limit || 100,
          offset: data.offset || 0,
          hasMore: data.hasMore || false
        };
      } else {
        // Fallback for old format
        rawItems = Array.isArray(data) ? data : [];
        paginationInfo.hasMore = false;
      }

      console.log(`Loaded ${rawItems.length} raw listings from backend (${paginationInfo.totalCount} total)`);
      
      // Filter out loaned out items
      const availableItems = await filterLoanedOutItems(rawItems);
      
      if (loadMore) {
        allListings = [...allListings, ...availableItems];
      } else {
        allListings = availableItems;
      }


      
      // Apply current filters (location, category, search) to the loaded items
      let filteredItems = allListings;
      filteredItems = await filterByLocation(filteredItems, currentLocationFilter);
      
      if (currentCategory !== 'all') {
        filteredItems = filteredItems.filter(item => {
          if (item.categories && Array.isArray(item.categories)) {
            return item.categories.some(cat => 
              cat.toLowerCase() === currentCategory.toLowerCase() ||
              mapCategoryName(cat).toLowerCase() === currentCategory.toLowerCase()
            );
          }
          if (item.category) {
            return item.category.toLowerCase() === currentCategory.toLowerCase() ||
                   mapCategoryName(item.category).toLowerCase() === currentCategory.toLowerCase();
          }
          return false;
        });
      }
      
      if (currentSearchQuery) {
        const searchTerm = currentSearchQuery.toLowerCase();
        filteredItems = filteredItems.filter(item => {
          const title = (item.title || '').toLowerCase();
          const description = (item.description || '').toLowerCase();
          const location = (item.location || item.locationLabel || '').toLowerCase();

          let categoryMatch = false;
          if (item.categories && Array.isArray(item.categories)) {
            categoryMatch = item.categories.some(cat => 
              cat.toLowerCase().includes(searchTerm)
            );
          } else if (item.category) {
            categoryMatch = item.category.toLowerCase().includes(searchTerm);
          }

          return title.includes(searchTerm) ||
            description.includes(searchTerm) ||
            categoryMatch ||
            location.includes(searchTerm);
        });
      }
      
      render(filteredItems);
      updateLoadMoreButton();
      
      // If we have a saved location filter, apply it after initial load
      if (currentLocationFilter && !loadMore) {

        // Re-apply filters with saved location immediately
        if (currentSearchQuery) {
          await performSearch(currentSearchQuery);
        } else {
          await filterByCategory(currentCategory);
        }
      }

    } catch (err) {
      console.error('Failed to load listings from API:', err);

      // No fallback file available


      allListings = [{
        id: 'sample1',
        title: 'Sample Item',
        description: 'This is sample data. Check console for errors.',
        price: 100,
        locationLabel: 'Cookeville, TN',
        imageUrl: PLACEHOLDER_IMG,
        isNew: true,
        category: 'electronics',
        available: true
      }];
      render(allListings);
      updateLoadMoreButton();

      grid.innerHTML += '<div class="col-span-full text-center text-red-600 text-sm mt-4 glass p-4 rounded-lg">Could not load listings from server. Showing sample data. Check browser console for details.</div>';
    }
  }

  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('category-filter')) {
      const category = e.target.dataset.category;
      await filterByCategory(category);
    }
  });

  // Load saved location filter after DOM elements are available
  loadLocationFilter();
  
  // Load data and apply any saved location filter
  load();

  // Auto-refresh functionality (5 seconds)
  let autoRefreshInterval = null;
  
  function startAutoRefresh() {
    // Clear any existing interval
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    // Set up new interval for 60 seconds (1 minute)
    autoRefreshInterval = setInterval(() => {

      load();
    }, 60000);
    
    console.log('✅ Auto-refresh started for home page (60 seconds)');
  }
  
  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;

    }
  }
  
  // Start auto-refresh when page becomes visible
  function handleVisibilityChange() {
    if (document.hidden) {
      stopAutoRefresh();
    } else {
      startAutoRefresh();
    }
  }
  
  // Start auto-refresh initially
  startAutoRefresh();
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Clean up on page unload
  window.addEventListener('beforeunload', stopAutoRefresh);

  // Apply button event listener (moved inside DOMContentLoaded scope)
  applyBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const milesText = radiusEl.value || '40 mi';
      let cityText = inputEl.value && inputEl.value.trim() ? inputEl.value.trim() : 'Custom location';
      let lat, lng;

      // Ensure map is initialized
      ensureMap();

      if (cityText && cityText !== lastGeocodedQuery && cityText !== 'Custom location') {
        const result = await geocode(cityText);
        if (result) {
          setMapTo(result.lat, result.lon);
          cityText = result.display_name.split(',').slice(0, 2).join(',');
          lastGeocodedQuery = inputEl.value.trim();
          lat = result.lat;
          lng = result.lon;
        } else {
          // If geocoding fails, use current marker position
          if (marker) {
            const pos = marker.getLatLng();
            lat = pos.lat;
            lng = pos.lng;
          }
        }
      } else {
        // Use current marker position
        if (marker) {
          const pos = marker.getLatLng();
          lat = pos.lat;
          lng = pos.lng;
        } else {
          // Fallback to default position
          lat = defaultPos.lat;
          lng = defaultPos.lng;
        }
      }

      // Update circle radius
      const miles = (milesText || '40').split(' ')[0];
      circle?.setRadius(milesToMeters(miles));

      // Set the location filter
      const radius = parseFloat(miles);
      currentLocationFilter = { lat, lng, radius };
      
      const shortCity = cityText.split(',').slice(0, 2).join(',');
      updateHeader(shortCity, milesText);
      
      // Save the location filter to localStorage
      saveLocationFilter(currentLocationFilter);
      

      
      // Close modal immediately

      modal.classList.remove('active');
      
      // Show loading screen
      showLocationLoadingScreen();
      
      // Re-apply filters and re-render in background
      try {
        if (currentSearchQuery) {
          await performSearch(currentSearchQuery);
        } else {
          await filterByCategory(currentCategory);
        }
      } catch (filterError) {
        console.error('Error applying location filter:', filterError);
      } finally {
        // Hide loading screen
        hideLocationLoadingScreen();
      }
      
    } catch (error) {
      console.error('Error applying location filter:', error);
      // Close modal and hide loading screen on error
      modal.classList.remove('active');
      hideLocationLoadingScreen();
    }
  });
});

// Authentication and user data functions
async function checkAuthAndLoadUser() {

  const token = localStorage.getItem('hippo_token');
  const userData = localStorage.getItem('hippo_user');
  


  
  if (!token || !userData) {

    // No token or user data, redirect to login
    window.location.href = './Login.html';
    return;
  }
  
  // First, try to display user info from localStorage as a fallback
  try {
    const storedUser = JSON.parse(userData);

    displayUserInfo(storedUser);
  } catch (error) {
    console.error('Error parsing stored user data:', error);
  }
  
  try {

    // Verify token is still valid by calling /auth/me
    const response = await fetch('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    

    
    if (!response.ok) {

      // Don't redirect immediately, keep the stored user data
      return;
    }
    
    const currentUser = await response.json();

    displayUserInfo(currentUser);
    
  } catch (error) {
    console.error('Auth check failed:', error);
    // Don't redirect on network errors, keep the stored user data

  }
}

function displayUserInfo(user) {
  console.log('Displaying user info:', user); // Debug log
  
  // Update the account name display
  const accountNameElement = document.getElementById('acct-name');
  if (accountNameElement) {
    // Check for both uppercase and lowercase property names
    const firstName = user.FirstName || user.firstName;
    const lastName = user.LastName || user.lastName;
    const email = user.Email || user.email;
    
    if (firstName && lastName) {
      accountNameElement.textContent = `${firstName} ${lastName}`;

    } else if (email) {
      accountNameElement.textContent = email;

    } else {
      accountNameElement.textContent = 'User';

    }
  } else {
    console.error('Account name element not found!');
  }

  const acctAvatar = document.getElementById('acct-avatar');
  if (acctAvatar) {
    const profilePic = user.ProfilePicture || user.profilePicture;
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

function clearAuthData() {
  localStorage.removeItem('hippo_user');
  localStorage.removeItem('hippo_token');
  localStorage.removeItem('userToken');
  localStorage.removeItem('userData');
  // Keep location filter when signing out - it's user preference, not auth data
  sessionStorage.removeItem('userToken');
  sessionStorage.removeItem('userData');
  
  document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

// Signout functionality
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
  clearAuthData();
  window.location.href = './Login.html';
}

/* ===== Location modal + map ===== */
const openBtn = document.getElementById('open-location');
const modal = document.getElementById('location-modal');
const closeModalBtn = document.getElementById('close-location');
const applyBtn = document.getElementById('apply-location');
const clearBtn = document.getElementById('clear-location');
const inputEl = document.getElementById('location-input');
const radiusEl = document.getElementById('radius-select');
const headerEl = document.getElementById('header-location');
const geoBtn = document.getElementById('geo-btn');
const shareLocationBtn = document.getElementById('share-location-btn');

let map, marker, circle;
let lastGeocodedQuery = '';
const defaultPos = { lat: 36.1628, lng: -85.5016 };

const milesToMeters = (mi) => parseFloat(mi) * 1609.344;

function ensureMap() {
  if (map) return;
  map = L.map('location-map', { zoomControl: true, scrollWheelZoom: true })
    .setView([defaultPos.lat, defaultPos.lng], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  marker = L.marker([defaultPos.lat, defaultPos.lng], { draggable: true }).addTo(map);
  circle = L.circle([defaultPos.lat, defaultPos.lng], {
    radius: milesToMeters((radiusEl.value || '40').split(' ')[0]),
    color: '#60a5fa', fillColor: '#60a5fa', fillOpacity: 0.12, weight: 2
  }).addTo(map);
  marker.on('drag', e => circle.setLatLng(e.latlng));
}

function setMapTo(lat, lon) {
  const ll = [lat, lon];
  marker.setLatLng(ll);
  circle.setLatLng(ll);
  map.setView(ll, 11);
}

openBtn?.addEventListener('click', () => {
  modal.classList.add('active');
  ensureMap();
  setTimeout(() => map.invalidateSize(), 100);
  
  // Restore saved location in modal if available
  const displayInfo = localStorage.getItem('hippo_location_display');
  if (displayInfo) {
    try {
      const display = JSON.parse(displayInfo);
      if (display.inputValue && inputEl) {
        inputEl.value = display.inputValue;
      }
      
      // Restore radius if we have a saved location filter
      if (currentLocationFilter && radiusEl) {
        radiusEl.value = `${currentLocationFilter.radius} mi`;
        if (circle) {
          circle.setRadius(milesToMeters(currentLocationFilter.radius));
        }
      }
      
      // Set map to saved location
      if (currentLocationFilter && map && marker) {
        setMapTo(currentLocationFilter.lat, currentLocationFilter.lng);
      }
    } catch (error) {
      console.error('Error restoring location modal state:', error);
    }
  }
});
closeModalBtn?.addEventListener('click', () => modal.classList.remove('active'));
modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

radiusEl?.addEventListener('change', () => {
  const miles = (radiusEl.value || '40').split(' ')[0];
  circle?.setRadius(milesToMeters(miles));
});

async function geocode(query) {
  if (!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data && data[0]) {
      const { lat, lon, display_name } = data[0];
      return { lat: parseFloat(lat), lon: parseFloat(lon), display_name };
    }
  } catch (e) { console.error('Geocode failed', e); }
  return null;
}

let t = null;
inputEl?.addEventListener('input', () => {
  clearTimeout(t);
  const q = inputEl.value.trim();
  t = setTimeout(async () => {
    if (!q || q === lastGeocodedQuery) return;
    const result = await geocode(q);
    if (result) { ensureMap(); setMapTo(result.lat, result.lon); lastGeocodedQuery = q; }
  }, 500);
});

inputEl?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const q = inputEl.value.trim();
    if (q) {
      const result = await geocode(q);
      if (result) {
        ensureMap();
        setMapTo(result.lat, result.lon);
        lastGeocodedQuery = q;
        inputEl.value = result.display_name;
      }
    }
  }
});

geoBtn?.addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    ensureMap();
    setMapTo(latitude, longitude);
    lastGeocodedQuery = '';
  });
});

shareLocationBtn?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by this browser.');
    return;
  }
  
  shareLocationBtn.disabled = true;
  shareLocationBtn.innerHTML = `
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    Getting Location...
  `;
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      ensureMap();
      setMapTo(latitude, longitude);
      lastGeocodedQuery = '';
      
      // Reverse geocode to get address
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
        .then(response => response.json())
        .then(data => {
          if (data && data.display_name) {
            const address = data.display_name.split(',').slice(0, 2).join(',');
            inputEl.value = address;
            lastGeocodedQuery = address;
          }
        })
        .catch(error => {
          console.error('Reverse geocoding failed:', error);
        })
        .finally(() => {
          shareLocationBtn.disabled = false;
          shareLocationBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a1 1 0 0 1 1 1v1.055a8.001 8.001 0 0 1 6.945 6.945H21a1 1 0 1 1 0 2h-1.055A8.001 8.001 0 0 1 13 19.945V21a1 1 0 1 1-2 0v-1.055A8.001 8.001 0 0 1 4.055 13H3a1 1 0 1 1 0-2h1.055A8.001 8.001 0 0 1 11 4.055V3a1 1 0 0 1 1-1Z" />
            </svg>
            Share My Location
          `;
        });
    },
    (error) => {
      console.error('Geolocation error:', error);
      let errorMessage = 'Unable to get your location. ';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Please allow location access and try again.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          errorMessage += 'Location request timed out.';
          break;
        default:
          errorMessage += 'An unknown error occurred.';
          break;
      }
      alert(errorMessage);
      
      shareLocationBtn.disabled = false;
      shareLocationBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a1 1 0 0 1 1 1v1.055a8.001 8.001 0 0 1 6.945 6.945H21a1 1 0 1 1 0 2h-1.055A8.001 8.001 0 0 1 13 19.945V21a1 1 0 1 1-2 0v-1.055A8.001 8.001 0 0 1 4.055 13H3a1 1 0 1 1 0-2h1.055A8.001 8.001 0 0 1 11 4.055V3a1 1 0 0 1 1-1Z" />
        </svg>
        Share My Location
      `;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    }
  );
});

function updateHeader(cityText, milesText) {
  headerEl.textContent = `${cityText} — ${milesText}`;
  // Don't change item locations anymore - just update the header
}


clearBtn?.addEventListener('click', async () => {
  // Clear the location filter
  currentLocationFilter = null;
  
  // Clear saved location from localStorage
  saveLocationFilter(null);
  
  // Reset the header to show all items
  headerEl.textContent = 'All locations';
  
  // Clear the input and reset map
  inputEl.value = '';
  lastGeocodedQuery = '';
  
  if (map) {
    setMapTo(defaultPos.lat, defaultPos.lng);
  }
  
  // Close modal immediately
  modal.classList.remove('active');
  
  // Show loading screen
  showLocationLoadingScreen();
  
  // Re-apply filters and re-render in background
  try {
    if (currentSearchQuery) {
      await performSearch(currentSearchQuery);
    } else {
      await filterByCategory(currentCategory);
    }
  } catch (error) {
    console.error('Error clearing location filter:', error);
  } finally {
    // Hide loading screen
    hideLocationLoadingScreen();
  }
});
