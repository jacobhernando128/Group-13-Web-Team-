// login.js
console.log("login.js loaded at", location.href);

(() => {
  // ---- API base ----
  const scriptEl = document.currentScript || document.querySelector('script[src*="login"]');
  const overrideApi = scriptEl?.getAttribute("data-api");
  const API_BASE = (overrideApi && overrideApi.trim()) || location.origin;

  // ---- Simple API-based authentication (like home.js) ----

  // ---- Generic API helper ----
  async function api(path, { method = "POST", body = undefined, headers = {} } = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let detail = "";
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try {
          const j = await res.json();
          detail = j?.error || j?.message || j?.detail || (typeof j === "string" ? j : JSON.stringify(j));
        } catch { }
      } else {
        try { detail = await res.text(); } catch { }
      }
      throw new Error(`${res.status} ${res.statusText}${detail ? " — " + detail : ""}`);
    }
    return (res.headers.get("content-type") || "").includes("application/json") ? res.json() : {};
  }

  // ---- Elements ----
  const messageBox = document.getElementById("message-box");
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const showRegister = document.getElementById("show-login-btn");
  const showLogin = document.getElementById("show-register-btn");
  const appSection = document.getElementById("app-section");
  const logoutBtn = document.getElementById("logout-btn");
  const passwordInput = document.getElementById("register-password");
  const passwordReqs = document.getElementById("password-requirements");

  // ---- UI helpers ----
  function showMessage(message, type = "info") {
    if (!message) { messageBox?.classList.add("hidden"); if (messageBox) messageBox.textContent = ""; return; }
    const styles = { success: ["bg-green-100", "text-green-800"], error: ["bg-red-100", "text-red-800"], info: ["bg-blue-100", "text-blue-800"] }[type] || ["bg-blue-100", "text-blue-800"];
    if (messageBox) {
      messageBox.className = `mb-4 p-3 rounded-lg text-sm transition-all duration-300 ${styles[0]} ${styles[1]}`;
      messageBox.textContent = message; messageBox.classList.remove("hidden");
    } else {
      console[type === "error" ? "error" : "log"](message);
    }
  }
  function setAuthUI(isLoggedIn) {
    if (!registerForm || !loginForm || !appSection) return;
    if (isLoggedIn) {
      registerForm.classList.remove("active"); loginForm.classList.remove("active");
      appSection.classList.remove("hidden"); appSection.classList.add("active");
    } else {
      appSection.classList.remove("active"); appSection.classList.add("hidden");
      registerForm.classList.add("active"); loginForm.classList.remove("active");
    }
  }
  function swapForms(formToShow, formToHide) {
    if (!formToShow || !formToHide) return;
    formToHide.classList.remove("active"); setTimeout(() => formToShow.classList.add("active"), 220);
  }

  // ---- Password rules ----
  function validatePassword(pw) {
    return {
      length: pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      lowercase: /[a-z]/.test(pw),
      number: /\d/.test(pw),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
    };
  }
  function updatePasswordRequirements(password) {
    if (!passwordReqs) return;
    const reqs = validatePassword(password);
    for (const key of Object.keys(reqs)) {
      const row = passwordReqs.querySelector(`[data-requirement="${key}"]`);
      if (!row) continue;
      const icon = row.querySelector(".req-icon");
      if (reqs[key]) { row.classList.add("valid"); row.classList.remove("invalid"); if (icon) icon.textContent = "✓"; }
      else { row.classList.add("invalid"); row.classList.remove("valid"); if (icon) icon.textContent = "✗"; }
    }
  }
  const isPasswordValid = (pw) => Object.values(validatePassword(pw)).every(Boolean);
  passwordInput?.addEventListener("input", (e) => updatePasswordRequirements(e.target.value));

  // ---- Show/hide password (eye icons) ----
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-eye');
    if (!btn) return;
    const id = btn.getAttribute('data-toggle');
    const input = document.getElementById(id);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(isHidden));
  });

  // ---- Toggle between forms ----
  showLogin?.addEventListener("click", () => { if (registerForm && loginForm) { swapForms(registerForm, loginForm); showMessage(""); } });
  showRegister?.addEventListener("click", () => { if (registerForm && loginForm) { swapForms(loginForm, registerForm); showMessage(""); } });

  // ---- Register ----
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstname = e.target["register-firstname"]?.value?.trim() || "";
    const lastname = e.target["register-lastname"]?.value?.trim() || "";
    const email = e.target["register-email"]?.value?.trim() || "";
    const phone = e.target["register-phone"]?.value?.trim() || "";
    const password = e.target["register-password"]?.value || "";
    const confirm = e.target["confirm-password"]?.value || "";

    if (!email) { showMessage("Email is required.", "error"); return; }
    if (!isPasswordValid(password)) { showMessage("Password does not meet all requirements.", "error"); return; }
    if (password !== confirm) { showMessage("Passwords do not match.", "error"); return; }

    try {
      // Use BCrypt registration (simple approach like home.js)
      const userProfile = await api("/auth/register", {
        body: {
          email,
          password,
          firstName: firstname || undefined,
          lastName: lastname || undefined,
          phone: phone || undefined
        }
      });

      if (!userProfile?.id) {
        throw new Error("User profile not found after registration.");
      }

      // Store user data and token
      localStorage.setItem("hippo_user", JSON.stringify(userProfile));
      if (userProfile.token) {
        localStorage.setItem("hippo_token", userProfile.token);
      }
      
      showMessage("Registration successful! Redirecting...", "success");
      setTimeout(() => { window.location.href = "./Home.html"; }, 1200);
    } catch (err) {
      console.error(err);
      let errorMessage = "Registration failed.";
      
      // Handle specific error cases
      if (err.message.includes("already registered") || err.message.includes("Email already")) {
        errorMessage = "This email is already registered.";
      } else if (err.message.includes("weak password")) {
        errorMessage = "Password is too weak.";
      } else if (err.message.includes("invalid email")) {
        errorMessage = "Invalid email address.";
      } else {
        errorMessage = err.message || "Registration failed.";
      }
      
      showMessage(errorMessage, "error");
    }
  });

  // ---- Login (simple BCrypt approach like home.js) ----
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = e.target["login-email"]?.value?.trim() || "";
    const password = e.target["login-password"]?.value || "";
    if (!email || !password) { showMessage("Email and password are required.", "error"); return; }
    
    try {
      // Use BCrypt login (simple approach like home.js)
      const userProfile = await api("/auth/login", { 
        body: { email, password } 
      });

      if (!userProfile?.id) {
        throw new Error("User profile not found. Please register first.");
      }

      // Store user data and token
      localStorage.setItem("hippo_user", JSON.stringify(userProfile));
      if (userProfile.token) {
        localStorage.setItem("hippo_token", userProfile.token);
      }
      
      showMessage("Login successful! Redirecting...", "success");
      setTimeout(() => { window.location.href = "./Home.html"; }, 1200);
    } catch (err) {
      console.error(err);
      let errorMessage = "Login failed.";
      
      // Handle specific error cases
      if (err.message.includes("Unauthorized") || err.message.includes("401")) {
        errorMessage = "Invalid email or password.";
      } else if (err.message.includes("user not found")) {
        errorMessage = "No account found with this email.";
      } else if (err.message.includes("wrong password")) {
        errorMessage = "Incorrect password.";
      } else if (err.message.includes("invalid email")) {
        errorMessage = "Invalid email address.";
      } else {
        errorMessage = err.message || "Login failed.";
      }
      
      showMessage(errorMessage, "error");
    }
  });

  // ---- Logout (simple approach like home.js) ----
  const fullLogout = async () => {
    // Clear all user data (like home.js signOut function)
    localStorage.removeItem("hippo_user");
    localStorage.removeItem("hippo_token");
    localStorage.removeItem("userToken");
    localStorage.removeItem("userData");
    sessionStorage.removeItem("userToken");
    sessionStorage.removeItem("userData");
    
    // Clear cookies
    document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    setAuthUI(false);
    showMessage("You have been logged out.", "info");
    setTimeout(() => messageBox?.classList.add("hidden"), 1800);
  };
  logoutBtn?.addEventListener("click", fullLogout);

  /* Enforce Terms-of-Service agreement on registration */
  (function () {
    function init() {
      const regForm   = document.getElementById('register-form');
      if (!regForm) return; // nothing to do if the register form isn't on this view

      const terms     = document.getElementById('terms');                  // the checkbox
      const createBtn = document.getElementById('create-account-btn');     // the submit button
      const msgBox    = document.getElementById('message-box');            // optional status area

      // Keep the button disabled until the user agrees
      const syncTerms = () => {
        if (createBtn) createBtn.disabled = !(terms && terms.checked);
      };
      syncTerms();
      terms?.addEventListener('change', syncTerms);

      // Hard gate on submit (covers scripted submits/AJAX/etc.)
      regForm.addEventListener('submit', (e) => {
        if (!terms || !terms.checked) {
          e.preventDefault();

          if (msgBox) {
            msgBox.textContent = 'Please agree to the Terms before creating an account.';
            msgBox.className = 'mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200';
          }
          terms?.focus();
          return false;
        }

        // Preserve any native validation you rely on
        if (regForm.checkValidity && !regForm.checkValidity()) {
          e.preventDefault();
          regForm.reportValidity?.();
          return false;
        }
      }, { passive: false });
    }

    // Run after DOM is ready (works whether script is in <head> or at the bottom)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();

  // ---- Init ----
  setAuthUI(false);
})();
