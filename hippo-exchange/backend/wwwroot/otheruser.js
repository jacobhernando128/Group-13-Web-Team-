// otheruser.js – Load and display complete user profile

let grid, itemsCount, noListings;
let currentUserId, viewingUserId;
let selectedRating = 0;

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
    viewingUserId = urlParams.get('userId');

    if (!viewingUserId) {
        console.error('No userId provided in URL');
        showError('User not found');
        return;
    }



    // Check authentication for current user
    await checkAuthAndLoadCurrentUser();

    // Mobile menu functionality
    setupMobileMenu();

    // Load the viewed user's complete profile
    await loadUserProfile(viewingUserId);

    // Load user's items
    await loadUserItems(viewingUserId);

    // Load user's reviews
    await loadUserReviews(viewingUserId);

    // Setup review creation functionality
    setupReviewCreation();

    // Auto-refresh functionality (5 seconds)
    let autoRefreshInterval = null;
    
    function startAutoRefresh() {
        // Clear any existing interval
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        
        // Set up new interval for 60 seconds (1 minute)
        autoRefreshInterval = setInterval(() => {

            loadUserProfile(viewingUserId);
            loadUserItems(viewingUserId);
            loadUserReviews(viewingUserId);
        }, 60000);
        
        console.log('✅ Auto-refresh started for other user page (60 seconds)');
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
    const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
    const userData = localStorage.getItem('hippo_user') || localStorage.getItem('userData');



    if (!token || !userData) {

        return;
    }

    try {
        // First try to get fresh user data from API

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });



        if (response.ok) {
            const user = await response.json();

            currentUserId = user.Id || user.id;
            updateSidebarAccount(user);
            return;
        }
    } catch (error) {
        console.error('❌ Auth error:', error);
    }

    // Fallback to stored user data
    try {
        const storedUser = JSON.parse(userData);

        currentUserId = storedUser.Id || storedUser.id;
        updateSidebarAccount(storedUser);
    } catch (error) {
        console.error('❌ Error parsing stored user data:', error);
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
    if (acctAvatar) {
        acctAvatar.innerHTML = generateProfilePictureHTML(profilePic, user, 'md');
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
        const avatarContainer = profileCard.querySelector('.w-20.h-20.mx-auto.rounded-xl.overflow-hidden');
        if (avatarContainer) {
            avatarContainer.innerHTML = generateProfilePictureHTML(profilePic, user, '2xl');
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
        if (itemsCount) {
            itemsCount.textContent = 'Loading...';
        }

        const response = await fetch(`${API_BASE_URL}/users/${userId}/items`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const items = await response.json();


        renderUserItems(Array.isArray(items) ? items : []);

    } catch (error) {
        console.error('Error loading user items:', error);
        if (itemsCount) {
            itemsCount.textContent = 'Error';
        }
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
async function loadUserReviews(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/reviews/user/${userId}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {

            displayReviews([]);
            return;
        }

        const reviews = await response.json();

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
    const reviewsCount = document.getElementById('reviews-count');
    if (!reviewsContainer) return;



    // Update reviews count
    if (reviewsCount) {
        const count = reviews ? reviews.length : 0;
        reviewsCount.textContent = count === 0 ? 'No reviews' : `${count} review${count !== 1 ? 's' : ''}`;
    }

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

        // Fetch reviewer info and profile picture
        let reviewerName = 'Marketplace User';
        let reviewerProfilePic = null;
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
                    reviewerProfilePic = reviewer.ProfilePicture || reviewer.profilePicture;
                }
            } catch (error) {
                console.error('Error fetching reviewer info:', error);
            }
        }

        const reviewArticle = document.createElement('article');
        reviewArticle.className = 'review p-4 rounded-lg bg-white/50 hover:bg-white/70 transition-all duration-200';

        reviewArticle.innerHTML = `
            <div class="avatar ring-2 ring-white/60">
                ${generateProfilePictureHTML(reviewerProfilePic, {FirstName: reviewerName.split(' ')[0], LastName: reviewerName.split(' ')[1]}, 'lg')}
            </div>
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <p class="font-semibold text-slate-800 text-sm">${escapeHtml(reviewerName)}</p>
                    <div class="flex items-center gap-1">
                        ${generateStarRating(rating)}
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

// Use the utility function from profile-utils.js

// Update average rating in profile card
function updateAverageRating(reviews) {
    const profileCard = document.querySelector('aside .glass.p-6.rounded-xl.text-center');
    if (!profileCard) return;

    const ratingContainer = profileCard.querySelector('.flex.items-center.justify-center.gap-2.mb-3');
    if (!ratingContainer) return;

    if (!reviews || reviews.length === 0) {
        ratingContainer.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <div class="flex items-center gap-1">
                    ${generateStarRating(0)}
                </div>
                <span class="text-slate-700 font-semibold text-sm">0.0</span>
            </div>
        `;
        return;
    }

    const avgRating = reviews.reduce((sum, r) => sum + (r.Rating || r.rating || 0), 0) / reviews.length;
    const ratingText = avgRating.toFixed(1);

    ratingContainer.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <div class="flex items-center gap-1">
                ${generateStarRating(avgRating)}
            </div>
            <span class="text-slate-700 font-semibold text-sm">${ratingText}</span>
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

// Setup review creation functionality
function setupReviewCreation() {
    const createReviewBtn = document.getElementById('create-review-btn');
    const reviewModal = document.getElementById('review-modal');
    const closeReviewBtn = document.getElementById('close-review');
    const cancelReviewBtn = document.getElementById('cancel-review');
    const submitReviewBtn = document.getElementById('submit-review');
    const ratingStars = document.querySelectorAll('.star-rating');
    const reviewDescription = document.getElementById('review-description');






    // Show/hide create review button based on whether user is viewing their own profile
    if (currentUserId && currentUserId !== viewingUserId) {

        createReviewBtn.classList.remove('hidden');
    } else {




    }

    // Open review modal
    if (createReviewBtn) {

        createReviewBtn.addEventListener('click', () => {

            reviewModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    } else {
        console.error('❌ Create review button not found!');
    }

    // Close review modal
    const closeModal = () => {

        reviewModal.classList.remove('active');
        document.body.style.overflow = '';
        resetReviewForm();
    };

    closeReviewBtn?.addEventListener('click', closeModal);
    cancelReviewBtn?.addEventListener('click', closeModal);

    // Close modal when clicking outside
    reviewModal?.addEventListener('click', (e) => {
        if (e.target === reviewModal) {
            closeModal();
        }
    });

    // Star rating functionality
    ratingStars.forEach((star, index) => {
        star.addEventListener('click', () => {
            selectedRating = index + 1;
            updateStarDisplay();
            updateSubmitButton();
        });

        star.addEventListener('mouseenter', () => {
            highlightStars(index + 1);
        });
    });

    // Reset stars on mouse leave
    document.getElementById('rating-stars')?.addEventListener('mouseleave', () => {
        updateStarDisplay();
    });

    // Update submit button based on form completion
    reviewDescription?.addEventListener('input', updateSubmitButton);

    // Submit review
    submitReviewBtn?.addEventListener('click', async () => {
        if (selectedRating === 0 || !reviewDescription.value.trim()) {
            return;
        }

        await submitReview(selectedRating, reviewDescription.value.trim());
        closeModal();
    });
}

// Update star display
function updateStarDisplay() {
    const ratingStars = document.querySelectorAll('.star-rating');
    ratingStars.forEach((star, index) => {
        const svg = star.querySelector('svg');
        if (index < selectedRating) {
            svg.classList.remove('text-slate-400');
            svg.classList.add('text-blue-500');
            svg.querySelector('path').setAttribute('fill', 'currentColor');
        } else {
            svg.classList.remove('text-blue-500');
            svg.classList.add('text-slate-400');
            svg.querySelector('path').removeAttribute('fill');
        }
    });
}

// Highlight stars on hover
function highlightStars(rating) {
    const ratingStars = document.querySelectorAll('.star-rating');
    ratingStars.forEach((star, index) => {
        const svg = star.querySelector('svg');
        if (index < rating) {
            svg.classList.remove('text-slate-400');
            svg.classList.add('text-blue-500');
        } else {
            svg.classList.remove('text-blue-500');
            svg.classList.add('text-slate-400');
        }
    });
}

// Update submit button state
function updateSubmitButton() {
    const submitBtn = document.getElementById('submit-review');
    const description = document.getElementById('review-description');
    
    if (selectedRating > 0 && description.value.trim()) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// Reset review form
function resetReviewForm() {
    selectedRating = 0;
    document.getElementById('review-description').value = '';
    updateStarDisplay();
    updateSubmitButton();
}

// Submit review to backend
async function submitReview(rating, description) {
    const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');

    
    if (!token) {
        alert('Please log in to submit a review');
        return;
    }

    if (!currentUserId) {
        alert('Unable to identify current user. Please refresh the page and try again.');
        return;
    }

    try {
        const reviewData = {
            rating: rating,
            raterId: currentUserId,
            userId: viewingUserId,
            description: description
        };
        

        
        const response = await fetch(`${API_BASE_URL}/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(reviewData)
        });



        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Review submission failed:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();


        // Reload reviews to show the new one
        await loadUserReviews(viewingUserId);

        // Show success message
        showSuccessMessage('Review submitted successfully!');

    } catch (error) {
        console.error('❌ Error submitting review:', error);
        alert(`Failed to submit review: ${error.message}`);
    }
}

// Show success message
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.opacity = '0';
        successDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(successDiv);
        }, 300);
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
