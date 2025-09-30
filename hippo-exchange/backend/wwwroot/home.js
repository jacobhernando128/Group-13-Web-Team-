// home.js — Backend API powered grid
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('listings-grid');
  const tpl  = document.getElementById('item-card-template');
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
  let currentSearchQuery = '';

  function performSearch(query) {
    currentSearchQuery = query.trim();
    
    let filteredItems = allListings;
    
    if (currentCategory !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === currentCategory);
    }
    
    if (currentSearchQuery) {
      const searchTerm = currentSearchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item => {
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const category = (item.category || '').toLowerCase();
        const location = (item.location || '').toLowerCase();
        
        return title.includes(searchTerm) || 
               description.includes(searchTerm) || 
               category.includes(searchTerm) || 
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
      
      searchTimeout = setTimeout(() => {
        performSearch(query);
      }, 300);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        performSearch(e.target.value);
      }
    });
  }

  const PLACEHOLDER_IMG = 'https://placehold.co/600x400/ffffff/111111?text=Listing+Image';
  
  let currentCategory = 'all';
  let allListings = [];

  const formatPrice = (val) =>
    (val === null || val === undefined || val === '')
      ? '$—'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(Number(val));

  const pickHomeFields = (item) => {
    const hero = item.imageUrl || (Array.isArray(item.images) && item.images[0]) || PLACEHOLDER_IMG;
    return {
      id: item.id ?? '',
      slug: item.slug ?? '',
      title: item.title ?? 'Untitled listing',
      price: item.price ?? '',
      locationLabel: item.locationLabel ?? (item.ships ? 'Ships to you' : ''),
      imageUrl: hero,
      isNew: !!item.isNew,
      ships: !!item.ships
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
          <h3 class="price text-lg font-semibold text-slate-900"></h3>
          <p class="title text-slate-700 text-sm"></p>
          <p class="sub text-slate-600 text-xs mt-1" data-field="location"></p>
        </div>`;
    }

    el.dataset.id = min.id;
    const img   = el.querySelector('.card-img');
    const price = el.querySelector('.price');
    const title = el.querySelector('.title');
    const loc   = el.querySelector('[data-field="location"]');
    const badge = el.querySelector('.badge');

    img.src = min.imageUrl || PLACEHOLDER_IMG;
    img.alt = min.title ? `${min.title} photo` : 'Listing image';

    price.textContent = formatPrice(min.price);
    title.textContent = min.title;
    loc.textContent   = min.locationLabel || (min.ships ? 'Ships to you' : '');

    if (!min.isNew) badge?.remove();

    el.addEventListener('click', () => {
      if (min.slug) location.href = `listing.html?slug=${encodeURIComponent(min.slug)}`;
      else if (min.id) location.href = `listing.html?id=${encodeURIComponent(min.id)}`;
    });

    return el;
  }

  function render(items) {
    grid.replaceChildren();
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
  
  function filterByCategory(category) {
    currentCategory = category;
    
    let filteredItems = allListings;
    
    if (category !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === category);
    }
    
    if (currentSearchQuery) {
      const searchTerm = currentSearchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item => {
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const category = (item.category || '').toLowerCase();
        const location = (item.location || '').toLowerCase();
        
        return title.includes(searchTerm) || 
               description.includes(searchTerm) || 
               category.includes(searchTerm) || 
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
        button.classList.add('active', 'bg-blue-500', 'text-white', 'shadow-md');
        button.classList.remove('bg-white/40', 'text-slate-700');
      } else {
        button.classList.remove('active', 'bg-blue-500', 'text-white', 'shadow-md');
        button.classList.add('bg-white/40', 'text-slate-700');
      }
    });
  }

  async function load() {
    try {
      grid.innerHTML = '<div class="col-span-full text-center text-slate-600 py-8">Loading listings...</div>';

      const res = await fetch('/items', { 
        headers: { 'Accept': 'application/json' } 
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      allListings = Array.isArray(data) ? data : [];
      
      console.log(`Loaded ${allListings.length} listings from backend`);
      render(allListings);
      
    } catch (err) {
      console.error('Failed to load listings from API:', err);
      
      try {
        const res = await fetch('listings.json');
        if (res.ok) {
          const data = await res.json();
          allListings = Array.isArray(data) ? data : (data.items || []);
          console.log('Using fallback listings.json');
          render(allListings);
          return;
        }
      } catch (fallbackErr) {
        console.error('Fallback failed:', fallbackErr);
      }
      
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
      
      grid.innerHTML += '<div class="col-span-full text-center text-red-600 text-sm mt-4 glass p-4 rounded-lg">Could not load listings from server. Showing sample data. Check browser console for details.</div>';
    }
  }

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('category-filter')) {
      const category = e.target.dataset.category;
      filterByCategory(category);
    }
  });

  load();
});

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
  localStorage.removeItem('userToken');
  localStorage.removeItem('userData');
  sessionStorage.removeItem('userToken');
  sessionStorage.removeItem('userData');
  
  document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  window.location.href = './Login.html';
}

/* ===== Location modal + map ===== */
const openBtn = document.getElementById('open-location');
const modal = document.getElementById('location-modal');
const closeModalBtn = document.getElementById('close-location');
const applyBtn = document.getElementById('apply-location');
const inputEl = document.getElementById('location-input');
const radiusEl = document.getElementById('radius-select');
const headerEl = document.getElementById('header-location');
const geoBtn = document.getElementById('geo-btn');

let map, marker, circle;
let lastGeocodedQuery = '';
const defaultPos = { lat: 36.1628, lng: -85.5016 };

const milesToMeters = (mi) => parseFloat(mi) * 1609.344;

function ensureMap(){
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

function setMapTo(lat, lon){
  const ll = [lat, lon];
  marker.setLatLng(ll);
  circle.setLatLng(ll);
  map.setView(ll, 11);
}

openBtn?.addEventListener('click', () => {
  modal.classList.add('active');
  ensureMap();
  setTimeout(() => map.invalidateSize(), 100);
});
closeModalBtn?.addEventListener('click', () => modal.classList.remove('active'));
modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

radiusEl?.addEventListener('change', () => {
  const miles = (radiusEl.value || '40').split(' ')[0];
  circle?.setRadius(milesToMeters(miles));
});

async function geocode(query){
  if(!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers:{'Accept-Language':'en'} });
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
    if(!q || q === lastGeocodedQuery) return;
    const result = await geocode(q);
    if(result){ ensureMap(); setMapTo(result.lat, result.lon); lastGeocodedQuery = q; }
  }, 500);
});

inputEl?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const q = inputEl.value.trim();
    if(q){
      const result = await geocode(q);
      if(result){
        ensureMap();
        setMapTo(result.lat, result.lon);
        lastGeocodedQuery = q;
        inputEl.value = result.display_name;
      }
    }
  }
});

geoBtn?.addEventListener('click', () => {
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    ensureMap();
    setMapTo(latitude, longitude);
    lastGeocodedQuery = '';
  });
});

function updateHeader(cityText, milesText){
  headerEl.textContent = `${cityText} — ${milesText}`;
  document.querySelectorAll('#listings-grid [data-field="location"]').forEach(n => n.textContent = cityText);
}

applyBtn?.addEventListener('click', async () => {
  const milesText = radiusEl.value || '40 mi';
  let cityText = inputEl.value && inputEl.value.trim() ? inputEl.value.trim() : 'Custom location';

  if(cityText && cityText !== lastGeocodedQuery){
    const result = await geocode(cityText);
    if(result){
      ensureMap();
      setMapTo(result.lat, result.lon);
      cityText = result.display_name.split(',').slice(0,2).join(',');
      lastGeocodedQuery = inputEl.value.trim();
    }
  } else {
    const miles = (milesText || '40').split(' ')[0];
    circle?.setRadius(milesToMeters(miles));
  }

  const shortCity = cityText.split(',').slice(0,2).join(',');
  updateHeader(shortCity, milesText);
  modal.classList.remove('active');
});