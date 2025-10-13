// Enhanced create-listing.js - Production version
document.addEventListener('DOMContentLoaded', () => {
    console.log('Create listing page loaded, starting authentication check...');
    // Check authentication and load user data
    checkAuthAndLoadUser();

    // ===== CONFIGURATION =====
    const API_BASE_URL = (typeof location !== 'undefined' && location.origin) ? location.origin : 'http://localhost:5000';

    const form = document.getElementById('create-form');
    const message = document.getElementById('message');
    const nextBtn = document.querySelector('.next-btn');
    const maintenanceStep = document.getElementById('maintenance-step');
    const backToDetailsBtn = document.getElementById('back-to-details');
    const createListingBtn = document.getElementById('create-listing-btn');

    // Mobile menu functionality
    const menuButton = document.getElementById('menu-button');
    const closeMenuBtn = document.getElementById('close-menu');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    function toggleMobileMenu() {
        const isOpen = sidebar.classList.contains('translate-x-0');
        if (isOpen) {
            closeMobileMenu();
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

    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', closeMobileMenu);
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeMobileMenu);
    }

    const navLinks = sidebar?.querySelectorAll('a') || [];
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

    // Form elements
    const titleInput = document.getElementById('title');
    const priceInput = document.getElementById('price');
    const categoryInput = document.getElementById('category');
    const conditionInput = document.getElementById('condition');
    const descriptionInput = document.getElementById('description');
    const locationInput = document.getElementById('location');

    // Preview elements
    const previewTitle = document.getElementById('preview-title');
    const previewPrice = document.getElementById('preview-price');
    const previewLocation = document.getElementById('preview-location');
    const previewDescription = document.getElementById('preview-description');
    const previewHero = document.getElementById('preview-hero');

    // Media upload
    const photoUpload = document.getElementById('photo-upload');
    const videoUpload = document.getElementById('video-upload');
    const photoCount = document.getElementById('photo-count');
    const videoCount = document.getElementById('video-count');

    // Maintenance elements
    const addMaintenanceBtn = document.getElementById('add-maintenance-btn');
    const maintenanceEntries = document.getElementById('maintenance-entries');
    const maintenanceModal = document.getElementById('maintenance-modal');
    const maintenanceForm = document.getElementById('maintenance-form');
    const closeMaintenanceBtn = document.getElementById('close-maintenance');
    const cancelMaintenanceBtn = document.getElementById('cancel-maintenance');

    let uploadedPhotos = [];
    let uploadedPhotoFiles = [];
    let uploadedVideos = [];
    let maintenanceList = [];
    let currentStep = 1;
    let currentUser = null; // Store current user data

    function showMessage(text, type) {
        const styles = {
            success: ['bg-green-100', 'text-green-800'],
            error: ['bg-red-100', 'text-red-800'],
            info: ['bg-blue-100', 'text-blue-800']
        }[type] || ['bg-blue-100', 'text-blue-800'];
        message.className = `p-3 rounded-lg ${styles[0]} ${styles[1]}`;
        message.textContent = text;
        message.classList.remove('hidden');

        // Auto-hide success/info messages
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (!message.classList.contains('hidden')) {
                    message.classList.add('hidden');
                }
            }, 5000);
        }
    }

    function clearMessage() {
        message.classList.add('hidden');
        message.textContent = '';
    }

    function updateProgress() {
        const hasRequired = titleInput.value.trim();
        nextBtn.disabled = !hasRequired;
    }

    function updatePreview() {
        previewTitle.textContent = titleInput.value || 'Title';
        previewPrice.textContent = priceInput.value ? `$${priceInput.value}` : 'Price';
        previewLocation.textContent = `Listed a few seconds ago in ${locationInput.value || 'Location'}`;
        previewDescription.textContent = descriptionInput.value || 'Description will appear here.';

        if (uploadedPhotos.length > 0) {
            previewHero.innerHTML = `<img src="${uploadedPhotos[0]}" alt="Preview" class="w-full h-full object-cover" />`;
        } else {
            previewHero.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400 text-sm">No image</div>';
        }
    }

    function showStep(step) {
        if (step === 1) {
            form.classList.remove('hidden');
            maintenanceStep.classList.add('hidden');
            currentStep = 1;
        } else if (step === 2) {
            form.classList.add('hidden');
            maintenanceStep.classList.remove('hidden');
            currentStep = 2;
        }
    }

    function renderMaintenanceEntries() {
        maintenanceEntries.innerHTML = '';

        if (maintenanceList.length === 0) {
            maintenanceEntries.innerHTML = `
                <div class="text-center py-6 text-slate-500">
                    <svg class="w-12 h-12 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-sm">No maintenance entries added yet</p>
                </div>
            `;
            return;
        }

        const sortedMaintenance = [...maintenanceList]; // No need to sort without dates

        sortedMaintenance.forEach((maintenance, index) => {
            const entry = document.createElement('div');

            const frequencyColors = {
                cleaning: 'border-green-500',
                repair: 'border-red-500',
                inspection: 'border-yellow-500',
                upgrade: 'border-purple-500',
                maintenance: 'border-blue-500'
            };

            entry.className = `glass p-3 rounded-lg border-l-4 ${frequencyColors[maintenance.frequency] || 'border-blue-500'}`;

            entry.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                ${maintenance.frequency.charAt(0).toUpperCase() + maintenance.frequency.slice(1)}
                            </span>
                            <span class="text-sm text-slate-600">Frequency</span>
                        </div>
                        <p class="text-slate-700 text-sm">${maintenance.description}</p>
                    </div>
                    <button class="delete-maintenance-btn p-1 text-slate-400 hover:text-red-500 transition-colors" data-index="${index}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            `;

            maintenanceEntries.appendChild(entry);
        });

        maintenanceEntries.querySelectorAll('.delete-maintenance-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                maintenanceList.splice(index, 1);
                renderMaintenanceEntries();
                showMessage('Maintenance entry deleted', 'info');
            });
        });
    }

    function openMaintenanceModal() {
        maintenanceModal.classList.add('active');
    }

    function closeMaintenanceModal() {
        maintenanceModal.classList.remove('active');
        maintenanceForm.reset();
    }

    function handleMaintenanceSubmit(e) {
        e.preventDefault();

        const formData = {
            itemId: 'temp_' + Date.now(), // Will be updated with actual item ID after creation
            description: document.getElementById('maintenance-description-input').value,
            frequency: document.getElementById('maintenance-type-input').value // Using type as frequency
        };

        maintenanceList.push(formData);
        renderMaintenanceEntries();
        closeMaintenanceModal();
        showMessage('✅ Maintenance entry added', 'success');
    }

    async function createListing() {
        clearMessage();

        // Disable button during submission
        createListingBtn.disabled = true;
        const originalText = createListingBtn.textContent;
        createListingBtn.textContent = 'Creating...';

        showMessage('Creating listing...', 'info');

        try {
            // Build comprehensive description (keep original description clean)
            let fullDescription = descriptionInput.value.trim() || '';

            // Add photo information to description
            if (uploadedPhotoFiles.length > 0) {
                fullDescription += `\n\n📸 ${uploadedPhotoFiles.length} photo${uploadedPhotoFiles.length > 1 ? 's' : ''} uploaded`;
            }

            // Note: Maintenance entries will be sent separately to /maintenance endpoint

            // Get the current user ID from authentication data
            const userId = currentUser?.Id || currentUser?.id || currentUser?.userId;
            if (!userId) {
                throw new Error('User not authenticated. Please log in again.');
            }

            // Data matching backend Item model with proper field structure
            const data = {
                id: null, // Will be generated by backend
                userId: userId, // Use actual authenticated user ID
                title: titleInput.value.trim(),
                description: fullDescription || null,
                condition: conditionInput.value || null,
                location: locationInput.value.trim() || null,
                dollarCost: priceInput.value ? parseFloat(priceInput.value) : 0, // Changed from price to dollarCost
                repCost: 0, // Default reputation cost
                categories: categoryInput.value ? [categoryInput.value] : [], // Changed from category to categories array
                // Additional fields for our app
                available: true,
                ships: true,
                images: uploadedPhotos
                // Note: maintenance entries will be sent separately
            };

            if (!data.title) {
                throw new Error('Title is required.');
            }

            console.log('📤 Sending data to backend:', data);

            const res = await fetch(`${API_BASE_URL}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            console.log('📥 Response status:', res.status);

            if (!res.ok) {
                let errorMessage = `Server error: ${res.status}`;
                try {
                    const errorData = await res.json();
                    console.error('Error response:', errorData);
                    errorMessage = errorData.title || errorData.detail || errorData.message || errorMessage;
                } catch (e) {
                    const errorText = await res.text();
                    console.error('Error text:', errorText);
                    if (errorText) errorMessage = errorText;
                }
                throw new Error(errorMessage);
            }

            const created = await res.json();
            console.log('✅ Created item:', created);

            // Send maintenance entries separately if any exist
            if (maintenanceList.length > 0) {
                try {
                    const itemId = created.id || created.Id;
                    console.log('📤 Sending maintenance entries for item:', itemId);

                    for (const maintenance of maintenanceList) {
                        const maintenanceData = {
                            itemId: itemId,
                            description: maintenance.description,
                            frequency: maintenance.frequency
                        };

                        const maintenanceRes = await fetch(`${API_BASE_URL}/maintenance`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify(maintenanceData)
                        });

                        if (!maintenanceRes.ok) {
                            console.warn('⚠️ Failed to create maintenance entry:', maintenanceRes.status);
                        } else {
                            console.log('✅ Created maintenance entry:', await maintenanceRes.json());
                        }
                    }
                } catch (maintenanceErr) {
                    console.warn('⚠️ Error creating maintenance entries:', maintenanceErr);
                    // Don't fail the whole process if maintenance fails
                }
            }

            showMessage('✅ Listing created successfully!', 'success');

            setTimeout(() => {
                window.location.href = `./listing.html?id=${encodeURIComponent(created.id || created.Id)}`;
            }, 1500);

        } catch (err) {
            console.error('❌ Error creating listing:', err);
            showMessage(`❌ Error: ${err.message}`, 'error');

            // Re-enable button
            createListingBtn.disabled = false;
            createListingBtn.textContent = originalText;
        }
    }

    // File upload handlers with validation
    photoUpload.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);

        // Validation
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        const MAX_FILES = 10;
        const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

        if (files.length > MAX_FILES) {
            showMessage(`Maximum ${MAX_FILES} photos allowed`, 'error');
            e.target.value = '';
            return;
        }

        const invalidFiles = files.filter(file =>
            file.size > MAX_SIZE || !ALLOWED_TYPES.includes(file.type)
        );

        if (invalidFiles.length > 0) {
            showMessage('Some files are too large (max 5MB) or invalid format (JPG/PNG only)', 'error');
            e.target.value = '';
            return;
        }

        // Store files and create preview URLs
        uploadedPhotoFiles = files;
        uploadedPhotos = files.map(file => URL.createObjectURL(file));
        photoCount.textContent = uploadedPhotos.length;
        updatePreview();

        showMessage(`✅ ${files.length} photo${files.length > 1 ? 's' : ''} uploaded`, 'success');
    });

    videoUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);

        if (files.length > 1) {
            showMessage('Only 1 video allowed', 'error');
            e.target.value = '';
            return;
        }

        const MAX_SIZE = 50 * 1024 * 1024; // 50MB
        if (files[0] && files[0].size > MAX_SIZE) {
            showMessage('Video too large (max 50MB)', 'error');
            e.target.value = '';
            return;
        }

        uploadedVideos = files.map(file => URL.createObjectURL(file));
        videoCount.textContent = uploadedVideos.length;

        if (files.length > 0) {
            showMessage('✅ Video uploaded', 'success');
        }
    });

    // Live preview updates
    [titleInput, priceInput, categoryInput, conditionInput, descriptionInput, locationInput].forEach(input => {
        if (!input) return;
        const evt = input.tagName === 'SELECT' ? 'change' : 'input';
        input.addEventListener(evt, () => {
            updateProgress();
            updatePreview();
        });
    });

    // Step 1: Form submission
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage();
        showStep(2);
    });

    // Step 2: Back to details
    backToDetailsBtn?.addEventListener('click', () => {
        clearMessage();
        showStep(1);
    });

    // Step 2: Create listing
    createListingBtn?.addEventListener('click', createListing);

    // Maintenance modal handlers
    addMaintenanceBtn?.addEventListener('click', openMaintenanceModal);
    closeMaintenanceBtn?.addEventListener('click', closeMaintenanceModal);
    cancelMaintenanceBtn?.addEventListener('click', closeMaintenanceModal);
    maintenanceForm?.addEventListener('submit', handleMaintenanceSubmit);

    // Close modal on backdrop click
    maintenanceModal?.addEventListener('click', (e) => {
        if (e.target === maintenanceModal) {
            closeMaintenanceModal();
        }
    });

    // Initialize
    updateProgress();
    updatePreview();
    renderMaintenanceEntries();

    console.log('✅ Create listing page initialized');
});

// Authentication and user data functions
async function checkAuthAndLoadUser() {
    console.log('Checking authentication...');
    const token = localStorage.getItem('hippo_token');
    const userData = localStorage.getItem('hippo_user');

    console.log('Token exists:', !!token);
    console.log('User data exists:', !!userData);

    if (!token || !userData) {
        console.log('No token or user data, redirecting to login');
        // No token or user data, redirect to login
        window.location.href = './Login.html';
        return;
    }

    // First, try to display user info from localStorage as a fallback
    try {
        const storedUser = JSON.parse(userData);
        console.log('Stored user data:', storedUser);
        displayUserInfo(storedUser);
    } catch (error) {
        console.error('Error parsing stored user data:', error);
    }

    try {
        console.log('Verifying token with /auth/me...');
        // Verify token is still valid by calling /auth/me
        const response = await fetch('/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Auth response status:', response.status);

        if (!response.ok) {
            console.log('Token invalid, but keeping stored user data for now');
            // Don't redirect immediately, keep the stored user data
            return;
        }

        const currentUser = await response.json();
        console.log('Current user from /auth/me:', currentUser);
        displayUserInfo(currentUser);

    } catch (error) {
        console.error('Auth check failed:', error);
        // Don't redirect on network errors, keep the stored user data
        console.log('Network error, keeping stored user data');
    }
}

function displayUserInfo(user) {
    console.log('Displaying user info:', user); // Debug log

    // Store current user data for use in createListing function
    currentUser = user;

    // Check for both uppercase and lowercase property names
    const firstName = user.FirstName || user.firstName;
    const lastName = user.LastName || user.lastName;
    const email = user.Email || user.email;

    let displayName = 'User';
    if (firstName && lastName) {
        displayName = `${firstName} ${lastName}`;
    } else if (email) {
        displayName = email;
    }

    // Update the account name display in sidebar
    const accountNameElement = document.getElementById('acct-name');
    if (accountNameElement) {
        accountNameElement.textContent = displayName;
        console.log('Set account name to:', displayName);
    } else {
        console.error('Account name element not found!');
    }

    // Update the listing owner name
    const listingOwnerNameElement = document.getElementById('listing-owner-name');
    if (listingOwnerNameElement) {
        listingOwnerNameElement.textContent = displayName;
        console.log('Set listing owner name to:', displayName);
    }

    // Update the preview seller name
    const previewSellerNameElement = document.getElementById('preview-seller-name');
    if (previewSellerNameElement) {
        previewSellerNameElement.textContent = displayName;
        console.log('Set preview seller name to:', displayName);
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