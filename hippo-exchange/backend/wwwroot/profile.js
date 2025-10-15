// profile.js - Handles user profile page functionality

let currentProfilePicture = null; // Store the selected profile picture temporarily
let currentProfilePictureFile = null; // Store the actual file object
let currentUserId = null; // Store current user ID globally
let lastSaveTime = 0; // Cooldown tracking
const SAVE_COOLDOWN_MS = 5000; // 5 seconds cooldown

document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = 'http://localhost:5000';

    console.log('Profile page loaded, starting authentication check...');

    // Check authentication FIRST and get user data
    await checkAuthAndLoadUser();

    // Get userId from localStorage after auth check
    const userData = localStorage.getItem('hippo_user');
    let viewingUserId;

    if (userData) {
        try {
            const user = JSON.parse(userData);
            viewingUserId = user.Id || user.id;
            currentUserId = viewingUserId;
            console.log('Got userId from localStorage:', viewingUserId);
        } catch (error) {
            console.error('Error parsing user data:', error);
        }
    }

    // Fallback to default if still no userId
    if (!viewingUserId) {
        viewingUserId = 'f8177ed15fe24b5ca1818feb03bb5f32';
        currentUserId = viewingUserId;
    }

    console.log('Using User ID:', viewingUserId);

    // Mobile menu functionality
    setupMobileMenu();

    // Load and display user profile
    await loadUserProfile(viewingUserId, API_BASE_URL);

    // Setup form listeners
    setupEventListeners(viewingUserId, API_BASE_URL);

    // Load reviews
    await loadUserReviews(viewingUserId, API_BASE_URL);

    // Setup profile picture upload
    setupProfilePictureUpload(viewingUserId, API_BASE_URL);
});

// Mobile menu setup
function setupMobileMenu() {
    const menuButton = document.getElementById('menu-button');
    const closeMenu = document.getElementById('close-menu');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    function toggleMenu(open) {
        if (open) {
            sidebar?.classList.remove('-translate-x-full');
            backdrop?.classList.remove('hidden');
            menuButton?.setAttribute('aria-expanded', 'true');
        } else {
            sidebar?.classList.add('-translate-x-full');
            backdrop?.classList.add('hidden');
            menuButton?.setAttribute('aria-expanded', 'false');
        }
    }

    menuButton?.addEventListener('click', () => {
        const isOpen = !sidebar?.classList.contains('-translate-x-full');
        toggleMenu(!isOpen);
    });

    closeMenu?.addEventListener('click', () => toggleMenu(false));
    backdrop?.addEventListener('click', () => toggleMenu(false));

    sidebar?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) toggleMenu(false);
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) toggleMenu(false);
    });
}

// Load user profile from API
async function loadUserProfile(userId, apiUrl) {
    try {
        const token = localStorage.getItem('hippo_token');
        const headers = {
            'Accept': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        console.log('Fetching user profile for:', userId);
        const response = await fetch(`${apiUrl}/users/${userId}`, { headers });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const user = await response.json();
        console.log('Loaded user profile:', user);

        // Store in localStorage for persistence
        localStorage.setItem('hippo_user', JSON.stringify(user));

        // Populate form fields
        populateProfileForm(user);

        // Update sidebar account section
        updateAccountSection(user);

        // Update profile picture preview - handle both property names
        const profilePic = user.ProfilePicture || user.profilePicture;
        updateProfilePicturePreview(profilePic, user);

        // Store current profile picture URL (not the file)
        currentProfilePicture = profilePic;
        currentProfilePictureFile = null; // Reset file when loading

    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Failed to load profile data', 'error');
    }
}

// Populate the profile form
function populateProfileForm(user) {
    const firstNameInput = document.getElementById('first-name');
    const lastNameInput = document.getElementById('last-name');
    const emailInput = document.getElementById('email');
    const bioInput = document.getElementById('bio');

    // Handle both uppercase and lowercase property names from API
    const firstName = user.FirstName || user.firstName || '';
    const lastName = user.LastName || user.lastName || '';
    const email = user.Email || user.email || '';
    const bio = user.Description || user.description || '';

    if (firstNameInput) {
        firstNameInput.value = firstName;
        console.log('Set first name:', firstName);
    }
    if (lastNameInput) {
        lastNameInput.value = lastName;
        console.log('Set last name:', lastName);
    }
    if (emailInput) {
        emailInput.value = email;
        console.log('Set email:', email);
    }
    if (bioInput) {
        bioInput.value = bio;
        console.log('Set bio:', bio);
    }

    updateCharacterCount();
}

// Update sidebar account section with user info
function updateAccountSection(user) {
    const acctName = document.getElementById('acct-name');
    const acctRank = document.getElementById('acct-rank');
    const acctBalance = document.getElementById('acct-balance');
    const acctAvatar = document.getElementById('acct-avatar');

    // Handle both uppercase and lowercase property names
    const firstName = user.FirstName || user.firstName || '';
    const lastName = user.LastName || user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'User';

    if (acctName) {
        acctName.textContent = fullName;
        console.log('Updated sidebar name to:', fullName);
    }
    if (acctRank) acctRank.textContent = calculateRank(user);
    if (acctBalance) {
        const totalLended = user.TotalLended || user.totalLended || 0;
        acctBalance.textContent = `${totalLended} HXB`;
    }

    const profilePic = user.ProfilePicture || user.profilePicture;
    if (acctAvatar) {
        updateProfilePictureElement(acctAvatar, profilePic, user, 'md');
    }
}

// Calculate user rank
function calculateRank(user) {
    // Handle both uppercase and lowercase property names
    const totalLended = user.TotalLended || user.totalLended || 0;
    const totalBorrowed = user.TotalBorrowed || user.totalBorrowed || 0;
    const total = totalLended + totalBorrowed;

    if (total >= 100) return 'Elite Member';
    if (total >= 50) return 'Active Member';
    if (total >= 10) return 'Member';
    return 'New Member';
}

// Setup event listeners
function setupEventListeners(userId, apiUrl) {
    // Save button
    const saveBtn = document.getElementById('save-btn');
    saveBtn?.addEventListener('click', () => handleSaveProfile(userId, apiUrl));

    // Cancel button
    const cancelBtn = document.getElementById('cancel-btn');
    cancelBtn?.addEventListener('click', () => {
        loadUserProfile(userId, apiUrl);
        currentProfilePictureFile = null; // Reset file on cancel
        showNotification('Changes discarded', 'info');
    });

    // Bio character counter
    const bioTextarea = document.getElementById('bio');
    bioTextarea?.addEventListener('input', updateCharacterCount);

    // Sign out
    document.querySelectorAll('a').forEach(link => {
        if (link.textContent.trim() === 'Sign out') {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                handleSignOut();
            });
        }
    });
}

// Update character count
function updateCharacterCount() {
    const bioTextarea = document.getElementById('bio');
    const charCountEl = document.getElementById('bio-counter');

    if (!bioTextarea || !charCountEl) return;

    const length = bioTextarea.value.length;
    const maxLength = 500;

    charCountEl.textContent = `${length} / ${maxLength}`;

    if (length > maxLength) {
        charCountEl.classList.add('text-red-500');
        charCountEl.classList.remove('text-slate-500');
    } else {
        charCountEl.classList.remove('text-red-500');
        charCountEl.classList.add('text-slate-500');
    }
}

// Handle save profile - FIXED TO USE FORMDATA
async function handleSaveProfile(userId, apiUrl) {
    // Check cooldown
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTime;
    const remainingCooldown = SAVE_COOLDOWN_MS - timeSinceLastSave;

    if (timeSinceLastSave < SAVE_COOLDOWN_MS) {
        const secondsRemaining = Math.ceil(remainingCooldown / 1000);
        showNotification(`Please wait ${secondsRemaining} more second${secondsRemaining !== 1 ? 's' : ''} before saving changes again.`, 'error');
        return;
    }

    const firstName = document.getElementById('first-name')?.value.trim();
    const lastName = document.getElementById('last-name')?.value.trim();
    const bio = document.getElementById('bio')?.value.trim();

    // Validation
    if (!firstName || !lastName) {
        showNotification('First and last name are required', 'error');
        return;
    }

    if (bio.length > 500) {
        showNotification('Bio must be 500 characters or less', 'error');
        return;
    }

    // Create FormData object (matching Program.cs expectations)
    const formData = new FormData();

    // Add text fields (only if they have values)
    if (firstName) formData.append('FirstName', firstName);
    if (lastName) formData.append('LastName', lastName);
    if (bio) formData.append('Description', bio);

    // Add profile picture file if one was selected
    if (currentProfilePictureFile) {
        formData.append('file', currentProfilePictureFile);
        console.log('Adding profile picture file to upload');
    }

    console.log('Saving profile with FormData...');

    try {
        const token = localStorage.getItem('hippo_token');
        const headers = {
            'Accept': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // DO NOT set Content-Type header - browser will set it automatically with boundary

        const response = await fetch(`${apiUrl}/users/${userId}`, {
            method: 'PUT',
            headers: headers,
            body: formData
        });

        if (response.ok) {
            const updatedUser = await response.json();
            console.log('Profile updated successfully:', updatedUser);

            // Update localStorage with new data
            localStorage.setItem('hippo_user', JSON.stringify(updatedUser));

            // Update last save time
            lastSaveTime = Date.now();

            // Clear the file reference after successful save
            currentProfilePictureFile = null;

            showNotification('Profile updated successfully!', 'success');
            await loadUserProfile(userId, apiUrl);
            displayUserInfo(updatedUser);
        } else {
            const errorText = await response.text();
            console.error('Update failed:', errorText);
            throw new Error('Update failed');
        }

    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Failed to save profile', 'error');
    }
}

// Load user reviews
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
        updateRatingDisplay(reviews);

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
                ${generateProfilePictureHTML(null, {FirstName: reviewerName.split(' ')[0], LastName: reviewerName.split(' ')[1]}, 'lg')}
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



// Use the utility function from profile-utils.js

// Update rating display with same style as otheruser page
function updateRatingDisplay(reviews) {
    const ratingContainer = document.querySelector('.glass.p-5.rounded-lg:has(#rating-stars)');

    if (!ratingContainer) return;

    if (!reviews || reviews.length === 0) {
        ratingContainer.innerHTML = `
            <h3 class="section-title mb-3">Your rating</h3>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-1">
                    ${generateStarRating(0)}
                </div>
                <span class="text-slate-700 font-semibold">0.0</span>
            </div>
            <p class="field-help mt-2">Average from all reviews you've received.</p>
        `;
        return;
    }

    const avgRating = reviews.reduce((sum, r) => sum + (r.Rating || r.rating || 0), 0) / reviews.length;
    const ratingText = avgRating.toFixed(1);

    ratingContainer.innerHTML = `
        <h3 class="section-title mb-3">Your rating</h3>
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-1">
                ${generateStarRating(avgRating)}
            </div>
            <span class="text-slate-700 font-semibold">${ratingText}</span>
        </div>
        <p class="field-help mt-2">Average from ${reviews.length} review${reviews.length !== 1 ? 's' : ''} you've received.</p>
    `;
}

// Setup profile picture upload - FIXED TO STORE FILE OBJECT
function setupProfilePictureUpload(userId, apiUrl) {
    const fileInput = document.getElementById('profile-pic-input');
    const uploadContainer = document.querySelector('.profile-pic-upload');

    fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification('Please select an image file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('Image must be less than 5MB', 'error');
            return;
        }

        // Store the actual file object for upload
        currentProfilePictureFile = file;

        // Show preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
            updateProfilePicturePreviewWithImage(e.target?.result);
            showNotification('Profile picture selected. Click "Save changes" to update your profile.', 'info');
        };
        reader.readAsDataURL(file);
    });

    // Click anywhere on the container to trigger upload
    uploadContainer?.addEventListener('click', () => {
        fileInput?.click();
    });
}

// Helper function to update preview with overlay
function updateProfilePicturePreviewWithImage(imageUrl) {
    const preview = document.getElementById('profile-pic-preview');
    if (!preview) return;

    // Use the utility function for consistent profile picture display
    const profilePictureHTML = generateProfilePictureHTML(imageUrl, null, '2xl');
    
    preview.innerHTML = `
        ${profilePictureHTML}
        <div class="upload-overlay">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
        </div>
    `;
}

// Update profile picture preview with first letter fallback
function updateProfilePicturePreview(pictureUrl, user = null) {
    const preview = document.getElementById('profile-pic-preview');
    if (!preview) return;

    // Use the utility function for consistent profile picture display
    const profilePictureHTML = generateProfilePictureHTML(pictureUrl, user, '2xl');
    
    // Add the upload overlay to the profile picture
    preview.innerHTML = `
        ${profilePictureHTML}
        <div class="upload-overlay">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
        </div>
    `;
    
    currentProfilePicture = pictureUrl;
    console.log('Updated profile picture preview:', pictureUrl || 'none');
}

// Validate email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white ${type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
            'bg-blue-500'
        }`;
    notification.textContent = message;
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';

    document.body.appendChild(notification);

    setTimeout(() => notification.style.opacity = '1', 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Handle sign out
function handleSignOut() {
    if (confirm('Are you sure you want to sign out?')) {
        clearAuthData();
        window.location.href = './Login.html';
    }
}

// Authentication and user data functions (matching home.js pattern)
async function checkAuthAndLoadUser() {
    console.log('Checking authentication...');
    const token = localStorage.getItem('hippo_token');
    const userData = localStorage.getItem('hippo_user');

    console.log('Token exists:', !!token);
    console.log('User data exists:', !!userData);

    if (!token || !userData) {
        console.log('No token or user data, redirecting to login');
        window.location.href = './Login.html';
        return;
    }

    // First, display user info from localStorage
    try {
        const storedUser = JSON.parse(userData);
        console.log('Stored user data:', storedUser);
        displayUserInfo(storedUser);
    } catch (error) {
        console.error('Error parsing stored user data:', error);
    }

    try {
        console.log('Verifying token with /auth/me...');
        const response = await fetch('http://localhost:5000/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Auth response status:', response.status);

        if (!response.ok) {
            console.log('Token invalid, but keeping stored user data for now');
            return;
        }

        const currentUser = await response.json();
        console.log('Current user from /auth/me:', currentUser);
        displayUserInfo(currentUser);

    } catch (error) {
        console.error('Auth check failed:', error);
        console.log('Network error, keeping stored user data');
    }
}

function displayUserInfo(user) {
    console.log('Displaying user info:', user);

    const accountNameElement = document.getElementById('acct-name');
    if (accountNameElement) {
        const firstName = user.FirstName || user.firstName;
        const lastName = user.LastName || user.lastName;
        const email = user.Email || user.email;

        if (firstName && lastName) {
            accountNameElement.textContent = `${firstName} ${lastName}`;
            console.log('Set name to:', `${firstName} ${lastName}`);
        } else if (email) {
            accountNameElement.textContent = email;
            console.log('Set name to email:', email);
        } else {
            accountNameElement.textContent = 'User';
            console.log('Set name to default: User');
        }
    } else {
        console.error('Account name element not found!');
    }

    // Update rank and balance if available
    const acctRank = document.getElementById('acct-rank');
    const acctBalance = document.getElementById('acct-balance');

    if (acctRank) {
        acctRank.textContent = calculateRank(user);
    }

    if (acctBalance) {
        const totalLended = user.TotalLended || user.totalLended || 0;
        acctBalance.textContent = `${totalLended} HXB`;
    }

    // Update profile picture if available
    const acctAvatar = document.getElementById('acct-avatar');
    if (acctAvatar) {
        const profilePic = user.ProfilePicture || user.profilePicture;
        updateProfilePictureElement(acctAvatar, profilePic, user, 'md');
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