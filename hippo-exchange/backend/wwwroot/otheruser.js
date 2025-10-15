// otheruser.js – Load and display complete user profile

const API_BASE_URL = 'http://localhost:5000';
let grid, itemsCount, noListings;

document.addEventListener('DOMContentLoaded', async () => {
    // Only run on otheruser.html page
    if (!window.location.pathname.includes('otheruser.html')) {
        return;
    }

    // Initialize DOM elements
    grid = document.getElementById('user-listings-grid');
    itemsCount = document.getElementById('items-count');
    noListings = document.getElementById('no-listings');

    const urlParams = new URLSearchParams(window.location.search);
    let viewingUserId = urlParams.get('userId');

    if (!viewingUserId) {
        console.error('No userId provided in URL');
        showError('User not found');
        return;
    }

    console.log('Loading profile for user:', viewingUserId);

    // Check authentication for current user
    await checkAuthAndLoadCurrentUser();

    // Mobile menu functionality
    setupMobileMenu();

    // Load the viewed user's complete profile
    await loadUserProfile(viewingUserId, API_BASE_URL);

    // Load user's items
    await loadUserItems(viewingUserId, API_BASE_URL);

    // Load user's reviews
    await loadUserReviews(viewingUserId, API_BASE_URL);
});

// Mobile menu setup
function setupMobileMenu() {
    const menuButton = document.getElementById('menu-button');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const closeMenuBtn = document.getElementById('close-menu');

    function toggleMobileMenu() {
        const isOpen = !sidebar.classList.contains('-translate-x-full');

        if (isOpen) {
            sidebar.classList.add('-translate-x-full');
            sidebarBackdrop.classList.add('hidden');
            menuButton?.setAttribute('aria-expanded', 'false');
        } else {
            sidebar.classList.remove('-translate-x-full');
            sidebarBackdrop.classList.remove('hidden');
            menuButton?.setAttribute('aria-expanded', 'true');
        }
    }

    function closeMobileMenu() {
        sidebar.classList.add('-translate-x-full');
        sidebarBackdrop.classList.add('hidden');
        menuButton?.setAttribute('aria-expanded', 'false');
    }

    menuButton?.addEventListener('click', toggleMobileMenu);
    sidebarBackdrop?.addEventListener('click', closeMobileMenu);
    closeMenuBtn?.addEventListener('click', closeMobileMenu);

    sidebar?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) closeMobileMenu();
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) closeMobileMenu();
    });
}

// Check authentication and load current user (for sidebar)
async function checkAuthAndLoadCurrentUser() {
    const token = localStorage.getItem('hippo_token');
    const userData = localStorage.getItem('hippo_user');

    if (!token || !userData) {
        console.log('No authentication found');
        return;
    }

    try {
        const storedUser = JSON.parse(userData);
        updateSidebarAccount(storedUser);
    } catch (error) {
        console.error('Error parsing stored user data:', error);
    }
}

// Update sidebar with current user info
function updateSidebarAccount(user) {
    const acctName = document.getElementById('acct-name');
    const acctAvatar = document.getElementById('acct-avatar');

    const firstName = user.FirstName || user.firstName || '';
    const lastName = user.LastName || user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || user.Email || user.email || 'User';

    if (acctName) acctName.textContent = fullName;

    const profilePic = user.ProfilePicture || user.profilePicture;
    if (acctAvatar && profilePic) {
        acctAvatar.src = profilePic;
    }
}

// Load complete user profile
async function loadUserProfile(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const user = await response.json();
        console.log('Loaded user profile:', user);

        // Update profile info in the right sidebar
        updateProfileInfo(user);

    } catch (error) {
        console.error('Error loading user profile:', error);
        showError('Failed to load user profile');
    }
}

// Update profile information display
function updateProfileInfo(user) {
    const firstName = user.FirstName || user.firstName || '';
    const lastName = user.LastName || user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'User';
    const location = user.Location || user.location || 'Cookeville, TN';
    const bio = user.Description || user.description || 'No bio available.';
    const profilePic = user.ProfilePicture || user.profilePicture;
    const totalLended = user.TotalLended || user.totalLended || 0;
    const totalBorrowed = user.TotalBorrowed || user.totalBorrowed || 0;
    const createdUtc = user.CreatedUtc || user.createdUtc;

    // Update name in heading
    const headingElement = document.querySelector('.glass.p-6.rounded-xl h3');
    if (headingElement && headingElement.textContent.includes('Items Available')) {
        headingElement.textContent = `${firstName}'s Items Available`;
    }

    // Update profile card
    const profileCard = document.querySelector('aside .glass.p-6.rounded-xl.text-center');
    if (profileCard) {
        // Update avatar
        const avatar = profileCard.querySelector('img');
        if (avatar && profilePic) {
            avatar.src = profilePic;
        }

        // Update name
        const nameEl = profileCard.querySelector('h2');
        if (nameEl) nameEl.textContent = fullName;

        // Update location
        const locationEl = profileCard.querySelector('.text-slate-600.text-sm.mb-3');
        if (locationEl) locationEl.textContent = location;

        // Update member since
        const memberSinceEl = profileCard.querySelector('.text-slate-600.text-sm.mb-4');
        if (memberSinceEl && createdUtc) {
            const date = new Date(createdUtc);
            const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            memberSinceEl.textContent = `Member since ${monthYear}`;
        }

        // Update stats
        const statsGrid = profileCard.querySelector('.grid.grid-cols-2');
        if (statsGrid) {
            const lentStat = statsGrid.querySelector('.text-blue-600');
            const borrowedStat = statsGrid.querySelector('.text-green-600');
            if (lentStat) lentStat.textContent = totalLended;
            if (borrowedStat) borrowedStat.textContent = totalBorrowed;
        }
    }

    // Update bio section
    const bioSection = document.querySelector('aside .glass.p-6.rounded-xl:last-child');
    if (bioSection) {
        const bioHeading = bioSection.querySelector('h3');
        if (bioHeading) bioHeading.textContent = `About ${firstName}`;

        const bioText = bioSection.querySelector('p');
        if (bioText) bioText.textContent = bio;
    }
}

// Load user's items/listings
async function loadUserItems(userId) {
    try {
        itemsCount.textContent = 'Loading...';

        const response = await fetch(`${API_BASE_URL}/users/${userId}/items`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const items = await response.json();
        console.log('Loaded user items:', items);

        renderUserItems(Array.isArray(items) ? items : []);

    } catch (error) {
        console.error('Error loading user items:', error);
        itemsCount.textContent = 'Error';
        renderUserItems([]);
    }
}

// Render user items in grid
function renderUserItems(items) {
    const grid = document.getElementById('user-listings-grid');
    const noListings = document.getElementById('no-listings');
    const itemsCount = document.getElementById('items-count');

    if (!grid) return;

    grid.replaceChildren();

    if (items.length === 0) {
        noListings?.classList.remove('hidden');
        grid.classList.add('hidden');
        if (itemsCount) itemsCount.textContent = '0 items';
        return;
    }

    noListings?.classList.add('hidden');
    grid.classList.remove('hidden');
    if (itemsCount) itemsCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    items.forEach(item => {
        const card = createItemCard(item);
        grid.appendChild(card);
    });
}

// Create item card element
function createItemCard(item) {
    const card = document.createElement('article');
    card.className = 'glass rounded-lg overflow-hidden shadow-lg transition duration-200 hover:-translate-y-1 cursor-pointer';

    const title = item.Title || item.title || 'Untitled';
    const dollarCost = item.DollarCost || item.dollarCost;
    const repCost = item.RepCost || item.repCost;
    const location = item.Location || item.location || 'Cookeville, TN';
    const pictures = item.Pictures || item.pictures || [];
    const imageUrl = pictures.length > 0 ? pictures[0] : 'https://placehold.co/600x400/f8fafc/334155?text=No+Image';

    const priceText = dollarCost
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(dollarCost)
        : repCost
            ? `${repCost} HXB`
            : 'Price not set';

    card.innerHTML = `
    <div class="relative">
      <img class="w-full h-[170px] object-cover" src="${imageUrl}" alt="${escapeHtml(title)}" />
    </div>
    <div class="p-4">
      <h3 class="text-lg font-semibold text-slate-900">${priceText}</h3>
      <p class="text-slate-700 text-sm">${escapeHtml(title)}</p>
      <p class="text-slate-600 text-xs mt-1">${escapeHtml(location)}</p>
    </div>
  `;

    card.addEventListener('click', () => {
        const itemId = item.Id || item.id;
        if (itemId) {
            window.location.href = `listing.html?id=${encodeURIComponent(itemId)}`;
        }
    });

    return card;
}

// Load and display user reviews
async function loadUserReviews(userId, apiUrl) {
    try {
        const response = await fetch(`${apiUrl}/reviews/user/${userId}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.log('No reviews found or error loading reviews');
            displayReviews([]);
            return;
        }

        const reviews = await response.json();
        console.log('Loaded reviews:', reviews);
        displayReviews(reviews);
        updateAverageRating(reviews);

    } catch (error) {
        console.error('Error loading reviews:', error);
        displayReviews([]);
    }
}

// Display reviews
async function displayReviews(reviews) {
    const reviewsContainer = document.getElementById('reviews-container');
    if (!reviewsContainer) return;

    console.log('Displaying reviews:', reviews);

    // Clear the container first
    reviewsContainer.innerHTML = '';

    if (!reviews || reviews.length === 0) {
        reviewsContainer.innerHTML = '<p class="text-slate-500 text-center py-4">No reviews yet.</p>';
        return;
    }

    // Process reviews one by one
    for (const review of reviews) {
        const rating = review.Rating || review.rating || 0;
        const description = review.Description || review.description || 'No description provided';
        const ratingText = rating.toFixed(1);
        const raterId = review.RaterId || review.raterId || '';
        const uniqueId = review.Id || review.id || `review-${Math.random().toString(36).substr(2, 9)}`;

        // Format the timestamp
        const createdUtc = review.CreatedUtc || review.createdUtc;
        const timeAgo = createdUtc ? formatTimeAgo(new Date(createdUtc)) : 'Recently';

        // Fetch reviewer info
        let reviewerName = 'Marketplace User';
        if (raterId) {
            try {
                const response = await fetch(`http://localhost:5000/users/${raterId}`, {
                    headers: { 'Accept': 'application/json' }
                });
                if (response.ok) {
                    const reviewer = await response.json();
                    const firstName = reviewer.FirstName || reviewer.firstName || '';
                    const lastName = reviewer.LastName || reviewer.lastName || '';
                    reviewerName = `${firstName} ${lastName}`.trim() || 'Marketplace User';
                }
            } catch (error) {
                console.error('Error fetching reviewer info:', error);
            }
        }

        const reviewArticle = document.createElement('article');
        reviewArticle.className = 'review p-4 rounded-lg bg-white/50 hover:bg-white/70 transition-all duration-200';

        reviewArticle.innerHTML = `
            <div class="avatar ring-2 ring-white/60">
                <img src="hippo-exchange-logo.png" alt="Reviewer avatar" class="w-full h-full object-cover"/>
            </div>
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <p class="font-semibold text-slate-800 text-sm">${escapeHtml(reviewerName)}</p>
                    <div class="relative w-10 h-10 flex-shrink-0" style="filter: drop-shadow(0 1px 3px rgba(251, 191, 36, 0.1));">
                        <svg viewBox="0 0 120 120" class="w-full h-full">
                            <defs>
                                <linearGradient id="starGradient-${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
                                </linearGradient>
                            </defs>
                            <path d="M60 15 C60 15 62 20 65 30 C68 40 70 45 75 45 L90 45 C95 45 100 47 100 52 C100 57 95 62 88 68 L78 76 C73 80 72 85 74 92 L78 105 C80 110 78 115 73 115 C68 115 63 112 58 108 L48 100 C45 98 42 98 39 100 L29 108 C24 112 19 115 14 115 C9 115 7 110 9 105 L13 92 C15 85 14 80 9 76 L-1 68 C-8 62 -13 57 -13 52 C-13 47 -8 45 -3 45 L12 45 C17 45 19 40 22 30 C25 20 27 15 27 15 C27 10 32 8 37 8 L50 8 C55 8 60 10 60 15 Z" 
                                  fill="#ffffff" 
                                  stroke="url(#starGradient-${uniqueId})" 
                                  stroke-width="5" 
                                  stroke-linejoin="round"
                                  stroke-linecap="round"
                                  transform="translate(13, 0)"/>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center" style="padding-top: 2px;">
                            <span class="text-xs font-bold bg-gradient-to-b from-slate-700 to-slate-900 bg-clip-text text-transparent" style="letter-spacing: -0.02em;">${ratingText}</span>
                        </div>
                    </div>
                    <span class="text-xs text-slate-500">· ${timeAgo}</span>
                </div>
                <p class="text-slate-700 text-sm leading-relaxed">${escapeHtml(description)}</p>
            </div>
        `;

        reviewsContainer.appendChild(reviewArticle);
    }
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffInSeconds / 31536000)}y ago`;
}

// Update average rating in profile card
function updateAverageRating(reviews) {
    const profileCard = document.querySelector('aside .glass.p-6.rounded-xl.text-center');
    if (!profileCard) return;

    const ratingContainer = profileCard.querySelector('.flex.items-center.justify-center.gap-2.mb-3');
    if (!ratingContainer) return;

    if (!reviews || reviews.length === 0) {
        ratingContainer.innerHTML = `
            <div class="relative w-36 h-36" style="filter: drop-shadow(0 2px 8px rgba(251, 191, 36, 0.15));">
                <svg viewBox="0 0 120 120" class="w-full h-full">
                    <defs>
                        <linearGradient id="starGradient-profile" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <path d="M60 15 C60 15 62 20 65 30 C68 40 70 45 75 45 L90 45 C95 45 100 47 100 52 C100 57 95 62 88 68 L78 76 C73 80 72 85 74 92 L78 105 C80 110 78 115 73 115 C68 115 63 112 58 108 L48 100 C45 98 42 98 39 100 L29 108 C24 112 19 115 14 115 C9 115 7 110 9 105 L13 92 C15 85 14 80 9 76 L-1 68 C-8 62 -13 57 -13 52 C-13 47 -8 45 -3 45 L12 45 C17 45 19 40 22 30 C25 20 27 15 27 15 C27 10 32 8 37 8 L50 8 C55 8 60 10 60 15 Z" 
                          fill="#ffffff" 
                          stroke="url(#starGradient-profile)" 
                          stroke-width="4" 
                          stroke-linejoin="round"
                          stroke-linecap="round"
                          transform="translate(13, 0)"/>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center" style="padding-top: 10px;">
                    <span class="text-4xl font-bold bg-gradient-to-b from-slate-700 to-slate-900 bg-clip-text text-transparent" style="letter-spacing: -0.03em;">0.0</span>
                </div>
            </div>
        `;
        return;
    }

    const avgRating = reviews.reduce((sum, r) => sum + (r.Rating || r.rating || 0), 0) / reviews.length;
    const ratingText = avgRating.toFixed(1);

    ratingContainer.innerHTML = `
        <div class="relative w-36 h-36" style="filter: drop-shadow(0 2px 8px rgba(251, 191, 36, 0.15));">
            <svg viewBox="0 0 120 120" class="w-full h-full">
                <defs>
                    <linearGradient id="starGradient-profile" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <path d="M60 15 C60 15 62 20 65 30 C68 40 70 45 75 45 L90 45 C95 45 100 47 100 52 C100 57 95 62 88 68 L78 76 C73 80 72 85 74 92 L78 105 C80 110 78 115 73 115 C68 115 63 112 58 108 L48 100 C45 98 42 98 39 100 L29 108 C24 112 19 115 14 115 C9 115 7 110 9 105 L13 92 C15 85 14 80 9 76 L-1 68 C-8 62 -13 57 -13 52 C-13 47 -8 45 -3 45 L12 45 C17 45 19 40 22 30 C25 20 27 15 27 15 C27 10 32 8 37 8 L50 8 C55 8 60 10 60 15 Z" 
                      fill="#ffffff" 
                      stroke="url(#starGradient-profile)" 
                      stroke-width="4" 
                      stroke-linejoin="round"
                      stroke-linecap="round"
                      transform="translate(13, 0)"/>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center" style="padding-top: 10px;">
                <span class="text-4xl font-bold bg-gradient-to-b from-slate-700 to-slate-900 bg-clip-text text-transparent" style="letter-spacing: -0.03em;">${ratingText}</span>
            </div>
        </div>
    `;
}

// Show error message
function showError(message) {
    const main = document.querySelector('main');
    if (main) {
        main.innerHTML = `
      <div class="max-w-2xl mx-auto mt-12 glass p-8 rounded-xl text-center">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-slate-800 mb-2">${message}</h2>
        <p class="text-slate-600 mb-6">The user profile you're looking for could not be found.</p>
        <a href="./Home.html" class="btn-primary inline-block">Return to Home</a>
      </div>
    `;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}