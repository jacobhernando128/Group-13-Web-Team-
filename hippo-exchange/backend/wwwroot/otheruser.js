// otheruser.js — Load and display listings for a specific user
document.addEventListener('DOMContentLoaded', () => {
  const API_URL = 'listings.json'; // same folder as home.html
  const grid = document.getElementById('user-listings-grid');
  const tpl = document.getElementById('item-card-template');
  const itemsCount = document.getElementById('items-count');
  const noListings = document.getElementById('no-listings');

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

  const PLACEHOLDER_IMG = 'https://placehold.co/600x400/ffffff/111111?text=Listing+Image';

  // Get user information from URL parameters or default
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId') || 'jane_doe'; // Default to jane_doe for demo
  const userName = urlParams.get('userName') || 'Jane Doe'; // Default name

  // Update the page title and heading with the user's name
  const userNameElements = document.querySelectorAll('h3.section-title');
  userNameElements.forEach(el => {
    if (el.textContent.includes("Jane's Items Available")) {
      el.textContent = `${userName.split(' ')[0]}'s Items Available`;
    }
  });

  const formatPrice = (val) =>
    (val === null || val === undefined || val === '')
      ? '$—'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(Number(val));

  const pickUserFields = (item) => {
    const hero = item.imageUrl || (Array.isArray(item.images) && item.images[0]) || PLACEHOLDER_IMG;
    return {
      id: item.id ?? '',
      slug: item.slug ?? '',
      title: item.title ?? 'Untitled listing',
      price: item.price ?? '',
      locationLabel: item.locationLabel ?? (item.ships ? 'Ships to you' : ''),
      imageUrl: hero,
      isNew: !!item.isNew,
      ships: !!item.ships,
      owner: item.owner ?? ''
    };
  };

  function toCard(min) {
    const el = tpl?.content?.firstElementChild
      ? tpl.content.firstElementChild.cloneNode(true)
      : document.createElement('article');

    // Fallback markup if template tag is missing
    if (!tpl) {
      el.className = 'glass rounded-lg overflow-hidden shadow-lg transition duration-200 hover:-translate-y-1';
      el.innerHTML = `
        <div class="relative">
          <img class="card-img w-full h-[170px] object-cover" alt="">
          <span class="badge absolute top-2 left-2 text-xs font-semibold px-2 py-1 rounded-full bg-blue-600 text-white">Just listed</span>
        </div>
        <div class="p-4">
          <h3 class="price text-lg font-semibold text-slate-900"></h3>
          <p class="title text-slate-700 text-sm"></p>
          <p class="sub text-slate-600 text-xs mt-1" data-field="location"></p>
        </div>`;
    }

    el.dataset.id = min.id;
    const img = el.querySelector('.card-img');
    const price = el.querySelector('.price');
    const title = el.querySelector('.title');
    const loc = el.querySelector('[data-field="location"]');
    const badge = el.querySelector('.badge');

    img.src = min.imageUrl || PLACEHOLDER_IMG;
    img.alt = min.title ? `${min.title} photo` : 'Listing image';

    price.textContent = formatPrice(min.price);
    title.textContent = min.title;
    loc.textContent = min.locationLabel || (min.ships ? 'Ships to you' : '');

    if (!min.isNew) badge?.remove();

    el.addEventListener('click', () => {
      if (min.slug) location.href = `listing.html?slug=${encodeURIComponent(min.slug)}`;
      else if (min.id) location.href = `listing.html?id=${encodeURIComponent(min.id)}`;
    });

    return el;
  }

  function renderUserListings(items) {
    grid.replaceChildren();
    
    if (items.length === 0) {
      noListings.classList.remove('hidden');
      itemsCount.textContent = 'No items';
      return;
    }

    noListings.classList.add('hidden');
    itemsCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
    
    items.map(pickUserFields).forEach(min => grid.appendChild(toCard(min)));
  }

  async function loadUserListings() {
    try {
      itemsCount.textContent = 'Loading...';
      const res = await fetch(API_URL, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const allListings = Array.isArray(data) ? data : (data.items || []);
      
      // Filter listings for the specific user
      // For demo purposes, we'll match by owner field or use sample data
      let userListings = allListings.filter(item => 
        item.owner === userId || 
        item.owner === userName ||
        (userId === 'jane_doe' && (item.owner === 'Jane Doe' || item.owner === 'jane'))
      );
      
      // If no specific user listings found, create some sample listings for demo
      if (userListings.length === 0 && userId === 'jane_doe') {
        userListings = [
          {
            id: 'jane_001',
            slug: 'vintage-camera-jane001',
            title: 'Vintage Film Camera',
            price: 45,
            locationLabel: 'Cookeville, TN',
            imageUrl: 'https://placehold.co/600x400/f8fafc/334155?text=Vintage+Camera',
            isNew: true,
            ships: false,
            owner: 'jane_doe'
          },
          {
            id: 'jane_002',
            slug: 'bike-helmet-jane002',
            title: 'Safety Bike Helmet',
            price: 15,
            locationLabel: 'Cookeville, TN',
            imageUrl: 'https://placehold.co/600x400/f8fafc/334155?text=Bike+Helmet',
            isNew: false,
            ships: true,
            owner: 'jane_doe'
          },
          {
            id: 'jane_003',
            slug: 'coffee-table-jane003',
            title: 'Wooden Coffee Table',
            price: 80,
            locationLabel: 'Cookeville, TN',
            imageUrl: 'https://placehold.co/600x400/f8fafc/334155?text=Coffee+Table',
            isNew: false,
            ships: false,
            owner: 'jane_doe'
          },
          {
            id: 'jane_004',
            slug: 'textbooks-jane004',
            title: 'Chemistry Textbook Set',
            price: 120,
            locationLabel: 'Cookeville, TN',
            imageUrl: 'https://placehold.co/600x400/f8fafc/334155?text=Textbooks',
            isNew: false,
            ships: true,
            owner: 'jane_doe'
          }
        ];
      }
      
      renderUserListings(userListings);
    } catch (err) {
      console.error('Failed to load user listings:', err);
      itemsCount.textContent = 'Error loading';
      // Show fallback listings on error
      renderUserListings([
        {
          id: 'fallback_001',
          slug: 'sample-item-001',
          title: 'Sample Item',
          price: 25,
          locationLabel: 'Cookeville, TN',
          imageUrl: PLACEHOLDER_IMG,
          isNew: false,
          ships: false,
          owner: userId
        }
      ]);
    }
  }

  // Load the user's listings when the page loads
  loadUserListings();
});
