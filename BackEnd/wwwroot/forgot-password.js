// forgot-password.js
(() => {
  // Backend API URL - using local backend
  const BACKEND_API_URL = '/api/v1';

  // Elements
  const messageBox = document.getElementById('message-box');
  const forgotForm = document.getElementById('forgot-password-form');
  const successSection = document.getElementById('success-section');
  const resetEmailDisplay = document.getElementById('reset-email-display');
  const resendBtn = document.getElementById('resend-btn');

  // Helpers
  function showMessage(message, type = 'info') {
    if (!message) {
      messageBox.classList.add('hidden'); 
      messageBox.textContent = '';
      return;
    }
    const styles = {
      success: ['bg-green-100', 'text-green-800'],
      error:   ['bg-red-100',   'text-red-800'],
      info:    ['bg-blue-100',  'text-blue-800']
    }[type] || ['bg-blue-100', 'text-blue-800'];

    messageBox.className = `mb-4 p-3 rounded-lg text-sm transition-all duration-300 ${styles[0]} ${styles[1]}`;
    messageBox.textContent = message;
    messageBox.classList.remove('hidden');
  }

  function showSuccess(email) {
    forgotForm.classList.remove('active');
    setTimeout(() => {
      successSection.classList.remove('hidden');
      successSection.classList.add('active');
      resetEmailDisplay.textContent = email;
    }, 220);
  }

  function showForm() {
    successSection.classList.remove('active');
    setTimeout(() => {
      successSection.classList.add('hidden');
      forgotForm.classList.add('active');
    }, 220);
  }

  // Forgot password form submit
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target['reset-email'].value.trim();

    if (!email) {
      showMessage('Please enter your email address.', 'error');
      return;
    }

    try {
      showMessage('Sending reset instructions...', 'info');
      
      const res = await fetch(`${BACKEND_API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to send reset instructions.');
      }

      showMessage('');
      showSuccess(email);
    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    }
  });

  // Resend button
  resendBtn?.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    
    if (!email) {
      showMessage('Please enter your email address.', 'error');
      showForm();
      return;
    }

    try {
      showMessage('Resending instructions...', 'info');
      
      const res = await fetch(`${BACKEND_API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to resend instructions.');
      }

      showMessage('Instructions resent successfully!', 'success');
      setTimeout(() => showMessage(''), 3000);
    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    }
  });

  // Init
  showMessage('');
})();
