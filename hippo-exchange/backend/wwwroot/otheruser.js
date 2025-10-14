// otheruser.js - User Profile Page with Authentication
// This page shows a specific user's profile (from URL parameter) while displaying
// the current authenticated user's info in the sidebar
console.log('🚀 otheruser.js script loaded!');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOMContentLoaded event fired!');
    const API_BASE = (typeof location !== 'undefined' && location.origin) ? location.origin : 'http://localhost:5000';
    let currentUser = null; // The authenticated user viewing the profile

    // Get the user ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const viewingUserId = urlParams.get('userId');

    console.log('🔍 Otheruser page loaded, viewing user ID:', viewingUserId);
    console.log('🔍 Full URL:', window.location.href);
    console.log('🔍 URL search params:', window.location.search);

    // Test API call immediately to see if it's working
    if (viewingUserId) {
        console.log('🧪 Testing API call immediately...');
        console.log('🧪 Viewing user ID:', viewingUserId);
        console.log('🧪 Full URL:', `http://localhost:5000/users/by-id?id=${viewingUserId}`);

        fetch(`http://localhost:5000/users/by-id?id=${viewingUserId}`)
            .then(response => {
                console.log('🧪 Test API response status:', response.status);
                console.log('🧪 Test API response ok:', response.ok);
                if (!response.ok) {
                    console.error('🧪 API call failed with status:', response.status);
                    return response.text().then(text => {
                        console.error('🧪 Error response text:', text);
                        throw new Error(`API call failed: ${response.status} - ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('🧪 Test API response data:', data);
                console.log('🧪 Data type:', typeof data);
                console.log('🧪 Data keys:', Object.keys(data));
            })
            .catch(error => {
                console.error('🧪 Test API error:', error);
                console.error('🧪 Error stack:', error.stack);
            });
    }

    if (!viewingUserId) {
        showError('No user ID provided in URL. Please navigate to this page from a user link.');
        return;
    }

    // Check authentication first
    await checkAuthAndLoadUser();

    // Initialize the page
    await init();

    async function checkAuthAndLoadUser() {
        const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
        const userData = localStorage.getItem('hippo_user') || localStorage.getItem('userData');

        console.log('Otheruser: Checking authentication...');
        console.log('Token exists:', !!token);
        console.log('User data exists:', !!userData);

        if (!token || !userData) {
            console.log('No authentication data found, redirecting to login...');
            window.location.href = './Login.html';
            return;
        }

        try {
            // Verify token with backend
            const response = await fetch(`${API_BASE}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            console.log('Auth response status:', response.status);

            if (response.ok) {
                const user = await response.json();
                console.log('Current user from /auth/me:', user);
                currentUser = user;
                displayCurrentUserInfo(user);
            } else {
                console.log('Token invalid, response status:', response.status);
                clearAuthData();
                window.location.href = './Login.html';
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            clearAuthData();
            window.location.href = './Login.html';
        }
    }

    function displayCurrentUserInfo(user) {
        console.log('Displaying current user info in sidebar:', user);

        // Check for both uppercase and lowercase property names
        const displayName = user?.FirstName && user?.LastName
            ? `${user.FirstName} ${user.LastName}`
            : user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || 'User';

        console.log('Computed display name for sidebar:', displayName);

        // Update account name in sidebar
        const acctNameEl = document.getElementById('acct-name');
        if (acctNameEl) {
            acctNameEl.textContent = displayName;
            console.log('Updated sidebar account name to:', displayName);
        }

        // Update account rank in sidebar
        const acctRankEl = document.getElementById('acct-rank');
        if (acctRankEl) {
            acctRankEl.textContent = 'Member';
            console.log('Updated sidebar account rank to: Member');
        }

        // Balance display intentionally omitted
    }

    function clearAuthData() {
        localStorage.removeItem('hippo_token');
        localStorage.removeItem('hippo_user');
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
    }

    function signOut() {
        clearAuthData();
        window.location.href = './Login.html';
    }

    // Setup sign out button
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
    }

    async function init() {
        try {
            console.log('🚀 Initializing otheruser page for user ID:', viewingUserId);

            // Load user profile first to see what happens
            console.log('🔍 Loading user profile...');
            await loadUserProfile(viewingUserId);
            console.log('✅ User profile loaded');

            // Then load items and reviews
            console.log('🔍 Loading user items...');
            await loadUserItems(viewingUserId);
            console.log('✅ User items loaded');

            console.log('🔍 Loading user reviews...');
            await loadUserReviews(viewingUserId);
            console.log('✅ User reviews loaded');

            console.log('✅ All data loaded successfully');
        } catch (error) {
            console.error('❌ Error initializing page:', error);
            showError('Failed to load user profile. Make sure the API is running on http://localhost:5000');
        }
    }

    // Endpoint /users/{userId} - Load the profile of the user being viewed (not the current user)
    async function loadUserProfile(userId) {
        try {
            console.log('🔍 Loading profile for user ID:', userId);
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            console.log('🔍 Token exists:', !!token);

            // Try the /users/by-id endpoint first as it might be more reliable
            const url = `${API_BASE}/users/by-id?id=${userId}`;
            console.log('🔍 Fetching from URL:', url);
            console.log('🔍 Using token:', token ? `${token.substring(0, 20)}...` : 'null');

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('📡 User profile response status:', response.status);
            console.log('📡 User profile response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Failed to load user profile with auth:', response.status, errorText);

                // Try the original /users/{userId} endpoint as fallback
                console.log('🔄 Trying original /users/{userId} endpoint...');
                const fallbackUrl = `${API_BASE}/users/${userId}`;
                const publicResponse = await fetch(fallbackUrl, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                console.log('📡 Public response status:', publicResponse.status);

                if (publicResponse.ok) {
                    const publicUser = await publicResponse.json();
                    console.log('✅ Public user data loaded:', publicUser);
                    console.log('✅ Public user data type:', typeof publicUser);
                    console.log('✅ Public user data keys:', Object.keys(publicUser));
                    console.log('✅ Public user firstName:', publicUser.FirstName);
                    console.log('✅ Public user lastName:', publicUser.LastName);
                    await displayUserProfile(publicUser);
                    return;
                } else {
                    const publicErrorText = await publicResponse.text();
                    console.error('❌ Public request also failed:', publicResponse.status, publicErrorText);
                    throw new Error(`Failed to load user profile: ${response.status} - ${errorText}`);
                }
            }

            const user = await response.json();
            console.log('✅ User data loaded:', user);
            console.log('✅ User data type:', typeof user);
            console.log('✅ User data keys:', Object.keys(user));
            console.log('✅ User firstName:', user.firstName);
            console.log('✅ User lastName:', user.lastName);
            console.log('✅ User name:', user.name);
            await displayUserProfile(user);
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            throw error;
        }
    }

    async function displayUserProfile(user) {
        try {
            console.log('🎨 Displaying user profile:', user);
            console.log('🔍 User object keys:', Object.keys(user));
            console.log('🔍 User FirstName:', user.FirstName);
            console.log('🔍 User LastName:', user.LastName);
            console.log('🔍 User Email:', user.Email);
            console.log('🔍 User firstName (lowercase):', user.firstName);
            console.log('🔍 User lastName (lowercase):', user.lastName);
            console.log('🔍 User email (lowercase):', user.email);
            console.log('🔍 User name (computed):', user.name);

            // Profile user full name - try both uppercase and lowercase field names
            const fullName = user.name ||
                `${user.FirstName || user.firstName || ''} ${user.LastName || user.lastName || ''}`.trim() ||
                user.Email || user.email || 'User';
            console.log('Full name computed:', fullName);

            // Profile section name (main content area - this is the viewed user)
            const profileNameElement = document.getElementById('user-name-display');
            console.log('🔍 Profile name element found:', !!profileNameElement);
            if (profileNameElement) {
                profileNameElement.textContent = fullName || 'User';
                console.log('✅ Profile section name updated to:', fullName);
            } else {
                console.error('❌ Profile name element not found!');
            }

            // Also update other name displays in the profile section
            const profileNameElement2 = document.getElementById('user-name-display-2');
            console.log('🔍 Profile name element 2 found:', !!profileNameElement2);
            if (profileNameElement2) {
                profileNameElement2.textContent = fullName || 'User';
                console.log('✅ Profile section name 2 updated to:', fullName);
            } else {
                console.error('❌ Profile name element 2 not found!');
            }

            const profileNameElement3 = document.getElementById('user-name-display-3');
            console.log('🔍 Profile name element 3 found:', !!profileNameElement3);
            if (profileNameElement3) {
                profileNameElement3.textContent = fullName || 'User';
                console.log('✅ Profile section name 3 updated to:', fullName);
            } else {
                console.error('❌ Profile name element 3 not found!');
            }

            // Bio
            const bioElement = document.getElementById('user-bio-text');
            console.log('🔍 Bio element found:', !!bioElement);
            if (bioElement) {
                const bioText = user.Description || user.description || 'No description available.';
                bioElement.textContent = bioText;
                console.log('✅ Bio updated to:', bioText);
            } else {
                console.error('❌ Bio element not found!');
            }

            // Display location
            const locationElement = document.getElementById('user-location');
            console.log('🔍 Location element found:', !!locationElement);
            if (locationElement) {
                const location = user.Location || user.location || 'Location not specified';
                locationElement.textContent = location;
                console.log('✅ Location updated to:', location);
            } else {
                console.error('❌ Location element not found!');
            }

            // Display member since
            const createdDate = user.CreatedUtc || user.createdUtc;
            if (createdDate) {
                console.log('🔍 Created date exists:', createdDate);
                const memberSince = new Date(createdDate).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric'
                });
                console.log('Member since date formatted:', memberSince);

                const memberSinceElement = document.getElementById('member-since-date');
                console.log('🔍 Member since element found:', !!memberSinceElement);
                if (memberSinceElement) {
                    memberSinceElement.textContent = `Member since ${memberSince}`;
                    console.log('✅ Member since updated:', memberSince);
                } else {
                    console.error('❌ Member since element not found');
                }
            } else {
                console.log('⚠️ No created date found');
            }

            // Display borrowed and lended
            const lentPill = document.getElementById('items-lent-pill');
            const borrowedPill = document.getElementById('items-borrowed-pill');

            console.log('🔍 Lent pill element found:', !!lentPill);
            if (lentPill) {
                const lentCount = user.TotalLended || user.totalLended || 0;
                lentPill.textContent = `${lentCount} items lent`;
                console.log('✅ Lent pill updated to:', lentCount);
            } else {
                console.error('❌ Lent pill element not found!');
            }

            console.log('🔍 Borrowed pill element found:', !!borrowedPill);
            if (borrowedPill) {
                const borrowedCount = user.TotalBorrowed || user.totalBorrowed || 0;
                borrowedPill.textContent = `${borrowedCount} items borrowed`;
                console.log('✅ Borrowed pill updated to:', borrowedCount);
            } else {
                console.error('❌ Borrowed pill element not found!');
            }

            // Display profile picture
            if (user.ProfilePicture) {
                const avatarImgs = document.querySelectorAll('img[alt="User avatar"]');
                console.log('Found', avatarImgs.length, 'avatar images');
                avatarImgs.forEach(img => {
                    img.src = user.ProfilePicture;
                });
            }

        } catch (error) {
            console.error('Error loading user profile:', error);
            throw error;
        }
    }

    // Endpoint /users/{userId}/items
    async function loadUserItems(userId) {
        try {
            console.log('🔍 Loading items for user ID:', userId);
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');

            const url = `${API_BASE}/users/${userId}/items`;
            console.log('🔍 Fetching items from URL:', url);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            console.log('📡 User items response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Failed to load user items:', response.status, errorText);
                throw new Error(`Failed to load user items: ${response.status} - ${errorText}`);
            }

            const items = await response.json();
            console.log('✅ User items loaded:', items);

            // Display items
            displayItemPreviews(items);

        } catch (error) {
            console.error('Error loading user items:', error);
            displayItemPreviews([]);
        }
    }

    function displayItemPreviews(items) {
        console.log('🎨 Displaying item previews for', items.length, 'items');
        console.log('🎨 Items data:', items);

        let itemsSection = document.querySelector('#user-items-section');

        if (!itemsSection) {
            console.log('🎨 Creating new items section');
            const mainSection = document.querySelector('section.lg\\:col-span-2');
            if (!mainSection) {
                console.error('❌ Could not find main section');
                return;
            }

            itemsSection = document.createElement('div');
            itemsSection.id = 'user-items-section';
            itemsSection.className = 'glass p-5 rounded-lg mb-6';
            itemsSection.innerHTML = `
               <div class="flex items-center justify-between mb-4">
                   <h3 class="section-title">Available Items</h3>
                   <span class="pill">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
               </div>
               <div id="items-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
           `;
            mainSection.insertBefore(itemsSection, mainSection.firstChild);
        }

        const itemsGrid = document.getElementById('items-grid');
        if (!itemsGrid) {
            console.error('❌ Could not find items grid');
            return;
        }

        itemsGrid.innerHTML = '';

        if (items.length === 0) {
            console.log('🎨 No items to display');
            itemsGrid.innerHTML = '<p class="text-slate-600 col-span-2">No items available</p>';
            return;
        }

        console.log('🎨 Creating cards for', items.length, 'items');
        items.forEach((item, index) => {
            console.log(`🎨 Creating card ${index + 1}:`, item);
            const itemCard = createItemCard(item);
            itemsGrid.appendChild(itemCard);
        });

        console.log('✅ Displayed', items.length, 'items');
    }

    function createItemCard(item) {
        console.log('🎨 Creating item card for:', item);

        const card = document.createElement('article');
        card.className = 'glass rounded-lg overflow-hidden shadow-lg hover:-translate-y-1 transition duration-200 cursor-pointer';
        card.onclick = () => window.location.href = `listing.html?id=${item.Id || item.id}`;

        console.log('🖼️ Item pictures data:', item.Pictures);
        console.log('🖼️ Item pictures (lowercase):', item.pictures);
        console.log('🖼️ Item images:', item.Images);
        console.log('🖼️ Item images (lowercase):', item.images);
        console.log('🖼️ Item imageUrl:', item.ImageUrl);
        console.log('🖼️ Item imageUrl (lowercase):', item.imageUrl);

        // Try multiple possible field names for pictures
        const pictures = item.Pictures || item.pictures || item.Images || item.images || [];
        const imageUrl = item.ImageUrl || item.imageUrl || (pictures && pictures.length > 0 ? pictures[0] : null);

        console.log('🖼️ Pictures array length:', pictures ? pictures.length : 'null/undefined');
        console.log('🖼️ Final image URL:', imageUrl || 'Using placeholder');

        const finalImageUrl = imageUrl || 'https://placehold.co/600x400?text=Item+Image';

        const available = 'Available';
        const availableClass = 'bg-green-500';

        const title = item.Title || item.title || 'Untitled Item';
        const description = item.Description || item.description || 'No description';
        const createdDate = item.CreatedUtc || item.createdUtc;

        console.log('🎨 Item details:', { title, description, createdDate, finalImageUrl });

        card.innerHTML = `
           <div class="relative">
               <img src="${finalImageUrl}" alt="${title}" class="w-full h-[170px] object-cover">
               <span class="absolute top-2 right-2 px-2 py-1 rounded text-white text-xs font-semibold ${availableClass}">${available}</span>
           </div>
           <div class="p-4">
               <h3 class="text-lg font-semibold text-slate-900">${title}</h3>
               <p class="text-slate-700 text-sm mt-1">${description}</p>
               <p class="text-slate-600 text-xs mt-2">Created: ${createdDate ? new Date(createdDate).toLocaleDateString() : 'Unknown'}</p>
           </div>
       `;

        return card;
    }

    // Endpoint reviews/user/{userId}
    async function loadUserReviews(userId) {
        try {
            const endpoint = `${API_BASE}/reviews/user/${userId}`;
            console.log('Fetching reviews from:', endpoint);
            const token = localStorage.getItem('hippo_token') || localStorage.getItem('userToken');
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.warn(`Reviews endpoint returned ${response.status}`);
                displayReviews([]);
                return;
            }

            const reviews = await response.json();
            console.log('Reviews loaded:', reviews);
            console.log('Number of reviews:', reviews.length);

            // Fetch names for reviews
            const reviewsWithNames = await Promise.all(reviews.map(async (review) => {
                if (review.raterId) {
                    try {
                        const userResponse = await fetch(`${API_BASE}/users/${review.raterId}`, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('hippo_token') || localStorage.getItem('userToken')}`,
                                'Accept': 'application/json'
                            }
                        });
                        if (userResponse.ok) {
                            const raterUser = await userResponse.json();
                            review.reviewerName = `${raterUser.FirstName || ''} ${raterUser.LastName || ''}`.trim() || raterUser.Email || 'Anonymous';
                            review.reviewerAvatar = raterUser.ProfilePicture;
                        }
                    } catch (error) {
                        console.warn('Could not fetch reviewer info for:', review.raterId);
                    }
                }
                return review;
            }));

            displayReviews(reviewsWithNames);

        } catch (error) {
            console.error('Error loading reviews:', error);
            displayReviews([]);
        }
    }

    function createReview(review) {
        const article = document.createElement('article');
        article.className = 'review';

        const reviewerName = review.reviewerName || 'Anonymous User';
        const reviewerAvatar = review.reviewerAvatar || 'hippo-exchange-logo.png';
        const comment = review.description || 'No comment provided';
        const timeAgo = 'Recently';

        article.innerHTML = `
          <div class="avatar ring-2 ring-white/60">
              <img src="${reviewerAvatar}" alt="${reviewerName}'s avatar" class="w-full h-full object-cover"/>
          </div>
          <div>
              <div class="flex items-center gap-2">
                  <p class="font-semibold text-slate-800">${reviewerName}</p>
                  <span class="text-xs text-slate-500">· ${timeAgo}</span>
              </div>
              <p class="text-slate-700 mt-1">${comment}</p>
          </div>
      `;

        return article;
    }

    function displayReviews(reviews) {
        const reviewsSection = document.querySelector('section.lg\\:col-span-2');
        if (!reviewsSection) {
            console.error('Main section not found');
            return;
        }

        const reviewsCard = Array.from(reviewsSection.querySelectorAll('.glass')).find(card =>
            card.textContent.includes('Reviews')
        );

        if (!reviewsCard) {
            console.error('Reviews card not found');
            return;
        }

        const reviewsContainer = reviewsCard.querySelector('.space-y-4');
        if (!reviewsContainer) {
            console.error('Reviews container not found');
            return;
        }

        reviewsContainer.innerHTML = '';

        if (reviews.length === 0) {
            reviewsContainer.innerHTML = '<p class="text-slate-600">No reviews yet</p>';
            return;
        }

        reviews.forEach(review => {
            const reviewElement = createReview(review);
            reviewsContainer.appendChild(reviewElement);
        });

        const reviewPill = reviewsCard.querySelector('.pill');
        if (reviewPill) {
            reviewPill.textContent = `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`;
        }
        console.log('Displayed', reviews.length, 'reviews');
    }

    // Error message Pop-up
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-md';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        setTimeout(() => errorDiv.remove(), 5000);
    }
});