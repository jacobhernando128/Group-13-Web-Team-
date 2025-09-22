// create-listing.js — Facebook Marketplace-style form with live preview
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-form');
  const message = document.getElementById('message');
  const nextBtn = document.querySelector('.next-btn');
  
  // Form elements
  const titleInput = document.getElementById('title');
  const priceInput = document.getElementById('price');
  const categoryInput = document.getElementById('category');
  const conditionInput = document.getElementById('condition');
  const descriptionInput = document.getElementById('description');
  const locationInput = document.getElementById('location');
  // removed: brand, ships, pickup
  
  // Preview elements
  const previewTitle = document.getElementById('preview-title');
  const previewPrice = document.getElementById('preview-price');
  const previewLocation = document.getElementById('preview-location');
  const previewDescription = document.getElementById('preview-description');
  const previewHero = document.getElementById('preview-hero');
  
  // progress bars removed
  
  // Media upload
  const photoUpload = document.getElementById('photo-upload');
  const videoUpload = document.getElementById('video-upload');
  const photoCount = document.getElementById('photo-count');
  const videoCount = document.getElementById('video-count');
  
  let uploadedPhotos = [];
  let uploadedVideos = [];

  function showMessage(text, type) {
    const styles = {
      success: ['bg-green-100', 'text-green-800'],
      error:   ['bg-red-100',   'text-red-800'],
      info:    ['bg-blue-100',  'text-blue-800']
    }[type] || ['bg-blue-100', 'text-blue-800'];
    message.className = `p-3 rounded-lg ${styles[0]} ${styles[1]}`;
    message.textContent = text;
    message.classList.remove('hidden');
  }

  function clearMessage(){
    message.classList.add('hidden');
    message.textContent = '';
  }

  function updateProgress() {
    // Enable/disable Next button based on required fields
    const hasRequired = titleInput.value.trim() && (priceInput.value || categoryInput.value);
    nextBtn.disabled = !hasRequired;
  }

  function updatePreview() {
    // Update preview content
    previewTitle.textContent = titleInput.value || 'Title';
    previewPrice.textContent = priceInput.value ? `$${priceInput.value}` : 'Price';
    previewLocation.textContent = `Listed a few seconds ago in ${locationInput.value || 'Location'}`;
    previewDescription.textContent = descriptionInput.value || 'Description will appear here.';
    
    // Update image preview if photos uploaded
    if (uploadedPhotos.length > 0) {
      previewHero.innerHTML = `<img src="${uploadedPhotos[0]}" alt="Preview" class="w-full h-full object-cover" />`;
    } else {
      previewHero.textContent = 'No image';
    }
  }

  function toggleMoreDetails() {
    const content = document.getElementById('more-details-content');
    const arrow = document.getElementById('more-details-arrow');
    
    if (content.classList.contains('hidden')) {
      content.classList.remove('hidden');
      arrow.style.transform = 'rotate(180deg)';
    } else {
      content.classList.add('hidden');
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  // Make toggleMoreDetails global
  window.toggleMoreDetails = toggleMoreDetails;

  // File upload handlers
  photoUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    uploadedPhotos = files.map(file => URL.createObjectURL(file));
    photoCount.textContent = uploadedPhotos.length;
    updatePreview();
  });

  videoUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    uploadedVideos = files.map(file => URL.createObjectURL(file));
    videoCount.textContent = uploadedVideos.length;
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

  // Form submission
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessage();

    const data = {
      ownerId: 'user123', // TODO: Get from auth
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim() || null,
      available: true,
      price: priceInput.value ? parseFloat(priceInput.value) : null,
      category: categoryInput.value || null,
      condition: conditionInput.value || null,
      location: locationInput.value.trim() || null,
      // removed brand/shipping fields per spec
      images: uploadedPhotos // Store image URLs
    };

    if (!data.title) {
      showMessage('Title is required.', 'error');
      return;
    }

    try {
      const res = await fetch('/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.title || err.detail || `Failed with ${res.status}`);
      }
      
      const created = await res.json();
      showMessage('Listing created successfully! Redirecting…', 'success');
      
      setTimeout(() => {
        window.location.href = `./listing.html?id=${encodeURIComponent(created.id || created.Id)}`;
      }, 1500);
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Failed to create listing.', 'error');
    }
  });

  // Initialize
  updateProgress();
  updatePreview();
});


