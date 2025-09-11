// listing.js — read from listings.json only (full details)
document.addEventListener('DOMContentLoaded', () => {
  const API_URL = 'listings.json'; // same folder as listing.html

  const $ = (id) => document.getElementById(id);
  const PLACEHOLDER_IMG = 'https://placehold.co/1200x700/ffffff/111111?text=Listing+Image';
  const money = (n) =>
    (n === null || n === undefined || n === '')
      ? '$—'
      : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n));

  // Get id or slug from ?id= / ?slug=
  const qs = new URLSearchParams(location.search);
  const key = qs.get('id') || qs.get('slug');

  async function readListing() {
    const res = await fetch(API_URL, { headers: { 'Accept':'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    const list = Array.isArray(items) ? items : (items.items || []);
    if (!list.length) throw new Error('Empty listings.json');

    if (key) {
      return list.find(x => x.id === key || x.slug === key) ?? list[0];
    }
    return list[0];
  }

  function render(listing) {
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
  }

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