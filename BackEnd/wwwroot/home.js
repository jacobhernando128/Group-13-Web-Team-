// home.js — JSON grid fed by listings.json
document.addEventListener('DOMContentLoaded', () => {
  const API_URL = 'listings.json'; // same folder as home.html
  const grid = document.getElementById('listings-grid');
  const tpl  = document.getElementById('item-card-template');

  const PLACEHOLDER_IMG = 'https://placehold.co/600x400/ffffff/111111?text=Listing+Image';

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

    // Fallback markup if template tag is missing
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
  }

  async function load() {
    try {
      const res = await fetch(API_URL, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      console.error('Failed to load listings:', err);
      render([
        { id:'abc123', slug:'gaming-desktop-abc123', title:'Gaming Desktop (for sale & trade)', price:300, locationLabel:'Cookeville, TN', imageUrl:PLACEHOLDER_IMG, isNew:true, ships:false },
      ]);
    }
  }

  load();
});

// Signout functionality
document.addEventListener('DOMContentLoaded', () => {
  // Find the signout button and add event listener
  const signoutButton = document.querySelector('a[href="./Login.html"]');
  if (signoutButton) {
    signoutButton.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default link behavior
      signOut();
    });
  }
});

function signOut() {
  // Clear any stored authentication data
  localStorage.removeItem('userToken');
  localStorage.removeItem('userData');
  sessionStorage.removeItem('userToken');
  sessionStorage.removeItem('userData');
  
  // Clear any cookies (if using them for auth)
  document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  // Redirect to login page
  window.location.href = './Login.html';
}


/* ===== Location modal + map (restore) ===== */
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
const defaultPos = { lat: 36.1628, lng: -85.5016 }; // Cookeville area

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
  // also reflect on visible cards (optional)
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
