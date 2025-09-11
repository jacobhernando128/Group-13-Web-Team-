// login.js
(() => {
  // Placeholder for your backend API
  const BACKEND_API_URL = 'https://your-backend-api.com/api/v1';

  // Elements
  const messageBox     = document.getElementById('message-box');
  const registerForm   = document.getElementById('register-form');
  const loginForm      = document.getElementById('login-form');
  const showRegister   = document.getElementById('show-register-btn');
  const showLogin      = document.getElementById('show-login-btn');
  const appSection     = document.getElementById('app-section');
  const userIdDisplay  = document.getElementById('user-id');
  const logoutBtn      = document.getElementById('logout-btn');
<<<<<<< HEAD
=======
  const passwordInput  = document.getElementById('register-password');
  const passwordReqs   = document.getElementById('password-requirements');
>>>>>>> b55186782b56b5dde0ad0ae430ab84fa4e64302b

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

  function setAuthUI(isLoggedIn) {
    if (isLoggedIn) {
      registerForm.classList.remove('active');
      loginForm.classList.remove('active');
      appSection.classList.remove('hidden');
      appSection.classList.add('active');
    } else {
      appSection.classList.remove('active');
      appSection.classList.add('hidden');
      registerForm.classList.add('active');
      loginForm.classList.remove('active');
    }
  }

  function swapForms(formToShow, formToHide) {
    formToHide.classList.remove('active');
    setTimeout(() => formToShow.classList.add('active'), 220);
  }

<<<<<<< HEAD
=======
  // Password validation function
  function validatePassword(password) {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    return requirements;
  }

  // Update password requirements display
  function updatePasswordRequirements(password) {
    if (!passwordReqs) return;
    
    const requirements = validatePassword(password);
    
    Object.keys(requirements).forEach(req => {
      const reqElement = passwordReqs.querySelector(`[data-requirement="${req}"]`);
      if (reqElement) {
        const icon = reqElement.querySelector('.req-icon');
        if (requirements[req]) {
          reqElement.classList.add('valid');
          reqElement.classList.remove('invalid');
          icon.textContent = '✓';
        } else {
          reqElement.classList.add('invalid');
          reqElement.classList.remove('valid');
          icon.textContent = '✗';
        }
      }
    });
  }

  // Check if password meets all requirements
  function isPasswordValid(password) {
    const requirements = validatePassword(password);
    return Object.values(requirements).every(req => req === true);
  }

>>>>>>> b55186782b56b5dde0ad0ae430ab84fa4e64302b
  // Form toggles
  showRegister?.addEventListener('click', () => { swapForms(registerForm, loginForm); showMessage(''); });
  showLogin?.addEventListener('click',    () => { swapForms(loginForm, registerForm); showMessage(''); });

  // Show/hide password toggles
  document.querySelectorAll('.toggle-eye').forEach(span => {
    span.addEventListener('click', () => {
      const id = span.getAttribute('data-toggle');
      const input = document.getElementById(id);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

<<<<<<< HEAD
=======
  // Password input validation
  passwordInput?.addEventListener('input', (e) => {
    updatePasswordRequirements(e.target.value);
  });

>>>>>>> b55186782b56b5dde0ad0ae430ab84fa4e64302b
  // Register submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstname       = e.target['register-firstname'].value.trim();
    const lastname        = e.target['register-lastname'].value.trim();
    const email           = e.target['register-email'].value.trim();
    const phone           = e.target['register-phone'].value.trim();
    const password        = e.target['register-password'].value;
    const confirmPassword = e.target['confirm-password'].value;

<<<<<<< HEAD
=======
    // Validate password requirements
    if (!isPasswordValid(password)) {
      showMessage('Password does not meet all requirements. Please check the requirements below.', 'error');
      return;
    }

>>>>>>> b55186782b56b5dde0ad0ae430ab84fa4e64302b
    if (password !== confirmPassword) {
      showMessage('Passwords do not match.', 'error');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstname, lastname, email, phone, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Registration failed.');
      }
      showMessage('Registration successful! Please log in.', 'success');
      swapForms(loginForm, registerForm);
    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    }
  });

  // Login submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = e.target['login-email'].value.trim();
    const password = e.target['login-password'].value;

    try {
      const res = await fetch(`${BACKEND_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Login failed.');
      }
      const data = await res.json().catch(() => ({ userId: 'unknown' }));
<<<<<<< HEAD
      showMessage('Login successful!', 'success');
      userIdDisplay.textContent = `Your User ID: ${data.userId ?? '—'}`;
      setAuthUI(true);
=======
      showMessage('Login successful! Redirecting...', 'success');
      
      // Redirect to home page after successful login
      setTimeout(() => {
        window.location.href = './Home.html';
      }, 1500);
>>>>>>> b55186782b56b5dde0ad0ae430ab84fa4e64302b
    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    }
  });

  // Logout
  logoutBtn?.addEventListener('click', () => {
    setAuthUI(false);
    showMessage('You have been logged out.', 'info');
    setTimeout(() => messageBox.classList.add('hidden'), 2200);
  });

  // Init
  setAuthUI(false);
})();
