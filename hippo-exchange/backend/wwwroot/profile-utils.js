// profile-utils.js - Utility functions for profile picture display across all pages

let API_BASE_URL = (typeof location !== 'undefined' && location.origin) ? location.origin : 'http://localhost:5000';

/**
 * Fetch profile picture URL for a user
 * @param {string} userId - User ID to fetch profile picture for
 * @returns {Promise<string|null>} Profile picture URL or null if not found
 */
async function fetchProfilePicture(userId) {
    if (!userId) return null;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/profile-picture`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.profilePicture || null;
        }
    } catch (error) {
        console.error('Error fetching profile picture:', error);
    }
    
    return null;
}

/**
 * Generate profile picture HTML with first letter fallback
 * @param {string} profilePic - Profile picture URL
 * @param {Object} user - User object with name/email properties
 * @param {string} size - Size class (sm, md, lg, xl)
 * @param {string} className - Additional CSS classes
 * @returns {string} HTML string for profile picture
 */
function generateProfilePictureHTML(profilePic, user, size = 'md', className = '') {
    const sizeClasses = {
        sm: 'w-6 h-6 text-xs',
        md: 'w-9 h-9 text-sm', 
        lg: 'w-12 h-12 text-lg',
        xl: 'w-16 h-16 text-xl',
        '2xl': 'w-20 h-20 text-2xl'
    };
    
    const sizeClass = sizeClasses[size] || sizeClasses.md;
    
    // Use custom className if provided, otherwise use size class
    const finalSizeClass = className ? className : sizeClass;
    
    // Get first letter from user data
    let firstLetter = '';
    if (user) {
        const firstName = user.FirstName || user.firstName || '';
        const lastName = user.LastName || user.lastName || '';
        const email = user.Email || user.email || '';
        
        if (firstName) {
            firstLetter = firstName.charAt(0).toUpperCase();
        } else if (lastName) {
            firstLetter = lastName.charAt(0).toUpperCase();
        } else if (email) {
            firstLetter = email.charAt(0).toUpperCase();
        }
    }
    
    if (profilePic && profilePic.trim()) {
        // Has profile picture
        return `
            <img src="${profilePic}" 
                 alt="Profile picture" 
                 class="${finalSizeClass} rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg object-cover"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="${finalSizeClass} rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg flex items-center justify-center text-white font-bold" style="display: none;">
                ${firstLetter || '?'}
            </div>
        `;
    } else {
        // No profile picture, show first letter
        return `
            <div class="${finalSizeClass} rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg flex items-center justify-center text-white font-bold">
                ${firstLetter || '?'}
            </div>
        `;
    }
}

/**
 * Update an existing profile picture element
 * @param {HTMLElement} element - The element to update
 * @param {string} profilePic - Profile picture URL
 * @param {Object} user - User object with name/email properties
 * @param {string} size - Size class (sm, md, lg, xl)
 */
function updateProfilePictureElement(element, profilePic, user, size = 'md') {
    if (!element) return;
    
    element.innerHTML = generateProfilePictureHTML(profilePic, user, size);
}

/**
 * Get user display name
 * @param {Object} user - User object
 * @returns {string} Display name
 */
function getUserDisplayName(user) {
    if (!user) return 'User';
    
    const firstName = user.FirstName || user.firstName || '';
    const lastName = user.LastName || user.lastName || '';
    const email = user.Email || user.email || '';
    
    if (firstName && lastName) {
        return `${firstName} ${lastName}`;
    } else if (firstName) {
        return firstName;
    } else if (lastName) {
        return lastName;
    } else if (email) {
        return email;
    }
    
    return 'User';
}

/**
 * Generate star rating HTML
 * @param {number} rating - Rating value (0-5)
 * @param {string} size - Size class (sm, md, lg)
 * @returns {string} HTML string for star rating
 */
function generateStarRating(rating, size = 'md') {
    const sizeClasses = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    };
    
    const sizeClass = sizeClasses[size] || sizeClasses.md;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHTML = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        starsHTML += `<svg class="${sizeClass} text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.23 3.78a1 1 0 00.95.69h3.977c.969 0 1.371 1.24.588 1.81l-3.218 2.338a1 1 0 00-.364 1.118l1.23 3.78c.3.922-.755 1.688-1.54 1.118l-3.218-2.338a1 1 0 00-1.176 0l-3.218 2.338c-.784.57-1.838-.196-1.539-1.118l1.23-3.78a1 1 0 00-.364-1.118L2.204 9.207c-.783-.57-.38-1.81.588-1.81h3.977a1 1 0 00.95-.69l1.23-3.78z" />
        </svg>`;
    }
    
    // Half star
    if (hasHalfStar) {
        starsHTML += `<svg class="${sizeClass} text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <defs>
                <linearGradient id="half-star-${Date.now()}">
                    <stop offset="50%" stop-color="currentColor" />
                    <stop offset="50%" stop-color="#e5e7eb" />
                </linearGradient>
            </defs>
            <path fill="url(#half-star-${Date.now()})" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.23 3.78a1 1 0 00.95.69h3.977c.969 0 1.371 1.24.588 1.81l-3.218 2.338a1 1 0 00-.364 1.118l1.23 3.78c.3.922-.755 1.688-1.54 1.118l-3.218-2.338a1 1 0 00-1.176 0l-3.218 2.338c-.784.57-1.838-.196-1.539-1.118l1.23-3.78a1 1 0 00-.364-1.118L2.204 9.207c-.783-.57-.38-1.81.588-1.81h3.977a1 1 0 00.95-.69l1.23-3.78z" />
        </svg>`;
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += `<svg class="${sizeClass} text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.23 3.78a1 1 0 00.95.69h3.977c.969 0 1.371 1.24.588 1.81l-3.218 2.338a1 1 0 00-.364 1.118l1.23 3.78c.3.922-.755 1.688-1.54 1.118l-3.218-2.338a1 1 0 00-1.176 0l-3.218 2.338c-.784.57-1.838-.196-1.539-1.118l1.23-3.78a1 1 0 00-.364-1.118L2.204 9.207c-.783-.57-.38-1.81.588-1.81h3.977a1 1 0 00.95-.69l1.23-3.78z" />
        </svg>`;
    }
    
    return starsHTML;
}

/**
 * Generate profile picture HTML with automatic fetching
 * @param {string} userId - User ID to fetch profile picture for
 * @param {Object} user - User object with name/email properties
 * @param {string} size - Size class (sm, md, lg, xl)
 * @param {string} className - Additional CSS classes
 * @returns {Promise<string>} HTML string for profile picture
 */
async function generateProfilePictureHTMLWithFetch(userId, user, size = 'md', className = '') {
    const profilePic = await fetchProfilePicture(userId);
    return generateProfilePictureHTML(profilePic, user, size, className);
}

/**
 * Update profile picture element with automatic fetching
 * @param {HTMLElement} element - The element to update
 * @param {string} userId - User ID to fetch profile picture for
 * @param {Object} user - User object with name/email properties
 * @param {string} size - Size class (sm, md, lg, xl)
 */
async function updateProfilePictureElementWithFetch(element, userId, user, size = 'md') {
    if (!element) return;
    
    const profilePic = await fetchProfilePicture(userId);
    element.innerHTML = generateProfilePictureHTML(profilePic, user, size);
}

// Make functions available globally
window.generateProfilePictureHTML = generateProfilePictureHTML;
window.updateProfilePictureElement = updateProfilePictureElement;
window.generateProfilePictureHTMLWithFetch = generateProfilePictureHTMLWithFetch;
window.updateProfilePictureElementWithFetch = updateProfilePictureElementWithFetch;
window.fetchProfilePicture = fetchProfilePicture;
window.getUserDisplayName = getUserDisplayName;
window.generateStarRating = generateStarRating;
