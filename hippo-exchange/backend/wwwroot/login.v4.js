// login.js

// check console for "login.js loaded" to verify it's loaded
console.log("login.js v4 loaded at", location.href);

(() => {
  const API_BASE = ""; // same-origin, e.g. https://localhost:7173

  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.headers.get("content-type")?.includes("application/json")
      ? res.json()
      : {};
  }

  // Elements
  const messageBox = document.getElementById('message-box');
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const showRegister = document.getElementById('show-register-btn');
  const showLogin = document.getElementById('show-login-btn');
  const appSection = document.getElementById('app-section');
  const userIdDisplay = document.getElementById('user-id');
  const logoutBtn = document.getElementById('logout-btn');
  const passwordInput = document.getElementById('register-password');
  const passwordReqs = document.getElementById('password-requirements');

  // Helpers
  function showMessage(message, type = 'info') {
    if (!message) { messageBox.classList.add('hidden'); messageBox.textContent = ''; return; }
    const styles = { success: ['bg-green-100', 'text-green-800'], error: ['bg-red-100', 'text-red-800'], info: ['bg-blue-100', 'text-blue-800'] }[type] || ['bg-blue-100', 'text-blue-800'];
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

  // Password validation
  function validatePassword(password) {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
  }
  function updatePasswordRequirements(password) {
    if (!passwordReqs) return;
    const reqs = validatePassword(password);
    Object.keys(reqs).forEach(req => {
      const row = passwordReqs.querySelector(`[data-requirement="${req}"]`);
      if (!row) return;
      const icon = row.querySelector('.req-icon');
      if (reqs[req]) { row.classList.add('valid'); row.classList.remove('invalid'); if (icon) icon.textContent = '✓'; }
      else { row.classList.add('invalid'); row.classList.remove('valid'); if (icon) icon.textContent = '✗'; }
    });
  }
  const isPasswordValid = (pw) => Object.values(validatePassword(pw)).every(Boolean);

  // Form toggles
  showRegister?.addEventListener('click', () => { swapForms(registerForm, loginForm); showMessage(''); });
  showLogin?.addEventListener('click', () => { swapForms(loginForm, registerForm); showMessage(''); });

  // Show/hide password
  document.querySelectorAll('.toggle-eye').forEach(span => {
    span.addEventListener('click', () => {
      const id = span.getAttribute('data-toggle');
      const input = document.getElementById(id);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  passwordInput?.addEventListener('input', (e) => updatePasswordRequirements(e.target.value));

  // Register -> POST /auth/register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Debug log to confirm form submission
    console.log("register submit using /auth/register")

    const firstname = e.target['register-firstname'].value.trim();
    const lastname = e.target['register-lastname'].value.trim();
    const email = e.target['register-email'].value.trim();
    const password = e.target['register-password'].value;
    const confirm = e.target['confirm-password'].value;

    if (!isPasswordValid(password)) { showMessage('Password does not meet all requirements.', 'error'); return; }
    if (password !== confirm) { showMessage('Passwords do not match.', 'error'); return; }

    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, name: `${firstname} ${lastname}`.trim(), password }),
      });
      showMessage('Registration successful! Please log in.', 'success');
      swapForms(loginForm, registerForm);
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Registration failed.', 'error');
    }
  });

  // Login -> POST /auth/login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Debug log to confirm form submission
    console.log("login submit using /auth/login")
    const email = e.target['login-email'].value.trim();
    const password = e.target['login-password'].value;

    try {
      const user = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('hippo_user', JSON.stringify(user));
      showMessage('Login successful! Redirecting...', 'success');
      setTimeout(() => { window.location.href = './Home.html'; }, 1500);
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Login failed.', 'error');
    }
  });

  // Logout
  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('hippo_user');
    setAuthUI(false);
    showMessage('You have been logged out.', 'info');
    setTimeout(() => messageBox.classList.add('hidden'), 2200);
  });

  // Init
  setAuthUI(false);
})();
