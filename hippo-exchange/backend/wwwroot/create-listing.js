// Enhanced create-listing.js - Production version
document.addEventListener('DOMContentLoaded', () => {
    // ===== CONFIGURATION =====
    const API_BASE_URL = 'http://localhost:5000';

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

        const sortedMaintenance = [...maintenanceList].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedMaintenance.forEach((maintenance, index) => {
            const entry = document.createElement('div');

            const typeColors = {
                cleaning: 'border-green-500',
                repair: 'border-red-500',
                inspection: 'border-yellow-500',
                upgrade: 'border-purple-500',
                maintenance: 'border-blue-500'
            };

            entry.className = `glass p-3 rounded-lg border-l-4 ${typeColors[maintenance.type] || 'border-blue-500'}`;

            entry.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                ${maintenance.type.charAt(0).toUpperCase() + maintenance.type.slice(1)}
                            </span>
                            <span class="text-sm text-slate-600">${new Date(maintenance.date).toLocaleDateString()}</span>
                            ${maintenance.cost > 0 ? `<span class="text-sm font-semibold text-green-600">$${maintenance.cost.toFixed(2)}</span>` : ''}
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
        document.getElementById('maintenance-date-input').value = new Date().toISOString().split('T')[0];
        maintenanceModal.classList.add('active');
    }

    function closeMaintenanceModal() {
        maintenanceModal.classList.remove('active');
        maintenanceForm.reset();
    }

    function handleMaintenanceSubmit(e) {
        e.preventDefault();

        const formData = {
            id: 'maint_' + Date.now(),
            date: document.getElementById('maintenance-date-input').value,
            type: document.getElementById('maintenance-type-input').value,
            description: document.getElementById('maintenance-description-input').value,
            cost: parseFloat(document.getElementById('maintenance-cost-input').value) || 0
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
            // Build comprehensive description
            let fullDescription = descriptionInput.value.trim() || '';

            // Append form details to description
            const additionalInfo = [];
            if (priceInput.value) additionalInfo.push(`Price: $${priceInput.value}`);
            if (categoryInput.value) additionalInfo.push(`Category: ${categoryInput.value}`);
            if (conditionInput.value) additionalInfo.push(`Condition: ${conditionInput.value}`);
            if (locationInput.value.trim()) additionalInfo.push(`Location: ${locationInput.value.trim()}`);

            if (additionalInfo.length > 0) {
                fullDescription += '\n\n' + additionalInfo.join(' | ');
            }

            // Add photo information
            if (uploadedPhotoFiles.length > 0) {
                fullDescription += `\n\n📸 ${uploadedPhotoFiles.length} photo${uploadedPhotoFiles.length > 1 ? 's' : ''} uploaded`;
            }

            // Add maintenance history
            if (maintenanceList.length > 0) {
                fullDescription += '\n\n🔧 Maintenance History:\n';
                maintenanceList.forEach(m => {
                    fullDescription += `• ${new Date(m.date).toLocaleDateString()}: ${m.type} - ${m.description}`;
                    if (m.cost > 0) fullDescription += ` ($${m.cost.toFixed(2)})`;
                    fullDescription += '\n';
                });
            }

            // Data matching backend Item model
            const data = {
                ownerId: 'user123',
                title: titleInput.value.trim(),
                description: fullDescription || null,
                available: true
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