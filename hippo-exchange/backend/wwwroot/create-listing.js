// Enhanced create-listing.js - Production version
// Global variables
let currentUser = null; // Store current user data

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Create listing page loaded, starting authentication check...');
    // Check authentication and load user data FIRST
    await checkAuthAndLoadUser();
    console.log('Authentication check completed, currentUser:', currentUser);

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
    let uploadedVideoFiles = [];
    let uploadedVideos = [];
    let maintenanceList = [];
    let currentStep = 1;
    let currentMaintenanceReceipts = []; // Store receipt files for current maintenance entry

    // Convert frequency string to days (integer)
    function convertFrequencyToDays(frequency) {
        const frequencyMap = {
            'daily': 1,
            'weekly': 7,
            'monthly': 30,
            'quarterly': 90,
            'yearly': 365,
            'as-needed': null
        };
        return frequencyMap[frequency] || null;
    }

    // Convert days back to user-friendly frequency text
    function convertDaysToFrequencyText(days) {
        const daysMap = {
            1: 'Daily',
            7: 'Weekly',
            30: 'Monthly',
            90: 'Quarterly',
            365: 'Yearly'
        };
        return daysMap[days] || `${days} days`;
    }

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

            const categoryColors = {
                cleaning: 'border-green-500',
                repair: 'border-red-500',
                inspection: 'border-yellow-500',
                upgrade: 'border-purple-500',
                'general-maintenance': 'border-blue-500'
            };

            entry.className = `glass p-3 rounded-lg border-l-4 ${categoryColors[maintenance.category] || 'border-blue-500'}`;

            const typeBadge = maintenance.type === 'required' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
            const typeText = maintenance.type === 'required' ? 'Required' : 'History';

            entry.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-1 ${typeBadge} rounded-full text-xs font-medium">
                                ${typeText}
                            </span>
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                ${maintenance.category.charAt(0).toUpperCase() + maintenance.category.slice(1).replace('-', ' ')}
                            </span>
                            ${maintenance.frequency ? `<span class="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                ${convertDaysToFrequencyText(maintenance.frequency)}
                            </span>` : ''}
                            ${maintenance.receipts && maintenance.receipts.length > 0 ? `<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                📄 ${maintenance.receipts.length} receipt${maintenance.receipts.length > 1 ? 's' : ''}
                            </span>` : ''}
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
        currentMaintenanceReceipts = [];
        document.getElementById('receipt-preview').innerHTML = '';
    }

    function handleMaintenanceSubmit(e) {
        e.preventDefault();

        // Get form data
        const maintenanceType = document.querySelector('input[name="maintenance-type"]:checked')?.value;
        const category = document.getElementById('maintenance-category-input').value;
        const frequency = document.getElementById('maintenance-frequency-input').value;
        const description = document.getElementById('maintenance-description-input').value;

        // Validate required fields
        if (!maintenanceType) {
            showMessage('Please select a maintenance type.', 'error');
            return;
        }

        if (!category) {
            showMessage('Please select a maintenance category.', 'error');
            return;
        }

        if (maintenanceType === 'required' && !frequency) {
            showMessage('Please select a frequency for required maintenance.', 'error');
            return;
        }

        if (!description.trim()) {
            showMessage('Please provide a description.', 'error');
            return;
        }

        // Convert frequency string to days (integer) - only for required maintenance
        const frequencyInDays = maintenanceType === 'required' ? convertFrequencyToDays(frequency) : null;

        const formData = {
            itemId: 'temp_' + Date.now(), // Will be updated with actual item ID after creation
            type: maintenanceType,
            category: category,
            frequency: frequencyInDays,
            description: description,
            receipts: currentMaintenanceReceipts // Store receipt files
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

            // Photo information is handled separately via media upload, not in description

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
                ships: true
                // Note: images will be uploaded separately after item creation
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

            // Upload images if any
            if (uploadedPhotoFiles && uploadedPhotoFiles.length > 0) {
                console.log('📸 Uploading photos:', uploadedPhotoFiles.length);
                for (const photoFile of uploadedPhotoFiles) {
                    try {
                        const formData = new FormData();
                        formData.append('file', photoFile);
                        formData.append('userId', userId);
                        formData.append('itemId', created.id || created.Id);
                        formData.append('target', 'pictures');

                        const uploadRes = await fetch(`${API_BASE_URL}/media/uploadAndAttach`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!uploadRes.ok) {
                            console.warn('⚠️ Failed to upload photo:', photoFile.name, 'Status:', uploadRes.status);
                            // Try to get more details about the error
                            try {
                                const errorData = await uploadRes.text();
                                console.warn('⚠️ Upload error details:', errorData);
                            } catch (e) {
                                console.warn('⚠️ Could not read error response');
                            }
                        } else {
                            const uploadResult = await uploadRes.json();
                            console.log('✅ Photo uploaded:', uploadResult.url);
                        }
                    } catch (err) {
                        console.warn('⚠️ Error uploading photo:', err);
                        if (err.message.includes('404')) {
                            console.warn('⚠️ The /media/uploadAndAttach endpoint is not available. The backend may need to be restarted.');
                        }
                    }
                }
            }

            // Upload videos if any
            if (uploadedVideoFiles && uploadedVideoFiles.length > 0) {
                console.log('🎥 Uploading videos:', uploadedVideoFiles.length);
                for (const videoFile of uploadedVideoFiles) {
                    try {
                        const formData = new FormData();
                        formData.append('file', videoFile);
                        formData.append('userId', userId);
                        formData.append('itemId', created.id || created.Id);
                        formData.append('target', 'videos');

                        const uploadRes = await fetch(`${API_BASE_URL}/media/uploadAndAttach`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!uploadRes.ok) {
                            console.warn('⚠️ Failed to upload video:', videoFile.name, 'Status:', uploadRes.status);
                            // Try to get more details about the error
                            try {
                                const errorData = await uploadRes.text();
                                console.warn('⚠️ Upload error details:', errorData);
                            } catch (e) {
                                console.warn('⚠️ Could not read error response');
                            }
                        } else {
                            const uploadResult = await uploadRes.json();
                            console.log('✅ Video uploaded:', uploadResult.url);
                        }
                    } catch (err) {
                        console.warn('⚠️ Error uploading video:', err);
                        if (err.message.includes('404')) {
                            console.warn('⚠️ The /media/uploadAndAttach endpoint is not available. The backend may need to be restarted.');
                        }
                    }
                }
            }

            // Send maintenance entries separately if any exist
            if (maintenanceList.length > 0) {
                try {
                    const itemId = created.id || created.Id;
                    console.log('📤 Sending maintenance entries for item:', itemId);

                    for (const maintenance of maintenanceList) {
                        const maintenanceData = {
                            ItemId: itemId,
                            Type: maintenance.type,
                            Category: maintenance.category,
                            Frequency: maintenance.frequency, // This is now an integer (days) or null
                            Description: maintenance.description
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
                            const createdMaintenance = await maintenanceRes.json();
                            console.log('✅ Created maintenance entry:', createdMaintenance);

                            // Upload receipts if any exist
                            if (maintenance.receipts && maintenance.receipts.length > 0) {
                                console.log('📄 Uploading receipts for maintenance:', maintenance.receipts.length);
                                
                                for (const receiptFile of maintenance.receipts) {
                                    try {
                                        const formData = new FormData();
                                        formData.append('file', receiptFile);
                                        formData.append('maintenanceId', createdMaintenance.id || createdMaintenance.Id);
                                        formData.append('Description', `Receipt for ${maintenance.description}`);

                                        const receiptRes = await fetch(`${API_BASE_URL}/documents`, {
                                            method: 'POST',
                                            body: formData
                                        });

                                        if (!receiptRes.ok) {
                                            console.warn('⚠️ Failed to upload receipt:', receiptFile.name, 'Status:', receiptRes.status);
                                        } else {
                                            console.log('✅ Uploaded receipt:', receiptFile.name);
                                        }
                                    } catch (err) {
                                        console.warn('⚠️ Error uploading receipt:', err);
                                    }
                                }
                            }
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
        
        // Prevent focus from moving to other fields
        e.target.blur();
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

        uploadedVideoFiles = files;
        uploadedVideos = files.map(file => URL.createObjectURL(file));
        videoCount.textContent = uploadedVideos.length;

        if (files.length > 0) {
            showMessage('✅ Video uploaded', 'success');
        }
        
        // Prevent focus from moving to other fields
        e.target.blur();
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

    // Handle maintenance type change to show/hide frequency field and receipt section
    const maintenanceTypeRadios = document.querySelectorAll('input[name="maintenance-type"]');
    maintenanceTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const frequencySection = document.getElementById('frequency-section');
            const frequencyInput = document.getElementById('maintenance-frequency-input');
            const receiptSection = document.getElementById('receipt-section');
            
            if (e.target.value === 'required') {
                frequencySection.style.display = 'block';
                frequencyInput.required = true;
                receiptSection.style.display = 'none';
            } else {
                frequencySection.style.display = 'none';
                frequencyInput.required = false;
                frequencyInput.value = '';
                receiptSection.style.display = 'block';
            }
        });
    });

    // Initialize frequency field visibility based on default selection
    const defaultRequiredRadio = document.querySelector('input[name="maintenance-type"][value="required"]');
    if (defaultRequiredRadio && defaultRequiredRadio.checked) {
        const frequencySection = document.getElementById('frequency-section');
        const frequencyInput = document.getElementById('maintenance-frequency-input');
        frequencySection.style.display = 'block';
        frequencyInput.required = true;
    }

    // Receipt upload functionality
    const receiptUploadBtn = document.getElementById('receipt-upload-btn');
    const receiptUploadInput = document.getElementById('maintenance-receipt-upload');
    const receiptPreview = document.getElementById('receipt-preview');

    receiptUploadBtn?.addEventListener('click', () => {
        receiptUploadInput.click();
    });

    receiptUploadInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        // Validate files
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        
        const validFiles = files.filter(file => {
            if (file.size > MAX_SIZE) {
                showMessage(`File ${file.name} is too large (max 5MB)`, 'error');
                return false;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                showMessage(`File ${file.name} is not a valid image format`, 'error');
                return false;
            }
            return true;
        });

        // Store valid files
        currentMaintenanceReceipts = validFiles;
        
        // Update preview
        updateReceiptPreview();
    });

    function updateReceiptPreview() {
        receiptPreview.innerHTML = '';
        
        currentMaintenanceReceipts.forEach((file, index) => {
            const preview = document.createElement('div');
            preview.className = 'flex items-center gap-2 p-2 bg-slate-700 rounded';
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'w-12 h-12 object-cover rounded';
            
            const info = document.createElement('div');
            info.className = 'flex-1 text-sm text-slate-300';
            info.textContent = file.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'text-red-400 hover:text-red-300';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => {
                currentMaintenanceReceipts.splice(index, 1);
                updateReceiptPreview();
            };
            
            preview.appendChild(img);
            preview.appendChild(info);
            preview.appendChild(removeBtn);
            receiptPreview.appendChild(preview);
        });
    }

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