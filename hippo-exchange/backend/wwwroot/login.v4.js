// login.js (drop-in)

// debug banner
console.log("login.js loaded at", location.href);

(() => {
  // ---- API base detection ----
  // Default: same-origin (works when the backend serves your static files)
  // To override, add data-api="http://localhost:5000" on the <script src="login.js"> tag
  const scriptEl = document.currentScript || document.querySelector('script[src*="login"]');
  const overrideApi = scriptEl?.getAttribute("data-api");
  const API_BASE = (overrideApi && overrideApi.trim()) || location.origin;

  async function api(path, { method = "POST", body = undefined, headers = {} } = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // Try to extract useful error text
    if (!res.ok) {
      let detail = "";
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try {
          const j = await res.json();
          detail =
            j?.error ||
            j?.message ||
            j?.detail ||
            (typeof j === "string" ? j : JSON.stringify(j));
        } catch { }
      } else {
        try {
          detail = await res.text();
        } catch { }
      }
      const msg = `${res.status} ${res.statusText}${detail ? " — " + detail : ""}`;
      throw new Error(msg);
    }

    if ((res.headers.get("content-type") || "").includes("application/json")) {
      return res.json();
    }
    return {};
  }

  // ---- Elements ----
  const messageBox = document.getElementById("message-box");
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const showRegister = document.getElementById("show-register-btn");
  const showLogin = document.getElementById("show-login-btn");
  const appSection = document.getElementById("app-section");
  const logoutBtn = document.getElementById("logout-btn");
  const passwordInput = document.getElementById("register-password");
  const passwordReqs = document.getElementById("password-requirements");

  // ---- UI helpers ----
  function showMessage(message, type = "info") {
    if (!message) {
      if (messageBox) {
        messageBox.classList.add("hidden");
        messageBox.textContent = "";
      }
      return;
    }
    const stylesBy = {
      success: ["bg-green-100", "text-green-800"],
      error: ["bg-red-100", "text-red-800"],
      info: ["bg-blue-100", "text-blue-800"],
    };
    const styles = stylesBy[type] || stylesBy.info;
    if (messageBox) {
      messageBox.className = `mb-4 p-3 rounded-lg text-sm transition-all duration-300 ${styles[0]} ${styles[1]}`;
      messageBox.textContent = message;
      messageBox.classList.remove("hidden");
    } else {
      // fallback to console if no UI element exists
      console[type === "error" ? "error" : "log"](message);
    }
  }

  function setAuthUI(isLoggedIn) {
    if (!registerForm || !loginForm || !appSection) return;
    if (isLoggedIn) {
      registerForm.classList.remove("active");
      loginForm.classList.remove("active");
      appSection.classList.remove("hidden");
      appSection.classList.add("active");
    } else {
      appSection.classList.remove("active");
      appSection.classList.add("hidden");
      registerForm.classList.add("active");
      loginForm.classList.remove("active");
    }
  }

  function swapForms(formToShow, formToHide) {
    if (!formToShow || !formToHide) return;
    formToHide.classList.remove("active");
    setTimeout(() => formToShow.classList.add("active"), 220);
  }

  // ---- Password rules ----
  function validatePassword(password) {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
  }
  function updatePasswordRequirements(password) {
    if (!passwordReqs) return;
    const reqs = validatePassword(password);
    for (const key of Object.keys(reqs)) {
      const row = passwordReqs.querySelector(`[data-requirement="${key}"]`);
      if (!row) continue;
      const icon = row.querySelector(".req-icon");
      if (reqs[key]) {
        row.classList.add("valid");
        row.classList.remove("invalid");
        if (icon) icon.textContent = "✓";
      } else {
        row.classList.add("invalid");
        row.classList.remove("valid");
        if (icon) icon.textContent = "✗";
      }
    }
  }
  const isPasswordValid = (pw) => Object.values(validatePassword(pw)).every(Boolean);
  passwordInput?.addEventListener("input", (e) => updatePasswordRequirements(e.target.value));

  // ---- Toggle between forms ----
  showRegister?.addEventListener("click", () => { if (registerForm && loginForm) { swapForms(registerForm, loginForm); showMessage(""); } });
  showLogin?.addEventListener("click", () => { if (registerForm && loginForm) { swapForms(loginForm, registerForm); showMessage(""); } });

  // ---- Register ----
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("register submit -> /auth/register");

      const firstname = e.target["register-firstname"]?.value?.trim() || "";
      const lastname = e.target["register-lastname"]?.value?.trim() || "";
      const email = e.target["register-email"]?.value?.trim() || "";
      const password = e.target["register-password"]?.value || "";
      const confirm = e.target["confirm-password"]?.value || "";

      if (!email) { showMessage("Email is required.", "error"); return; }
      if (!isPasswordValid(password)) { showMessage("Password does not meet all requirements.", "error"); return; }
      if (password !== confirm) { showMessage("Passwords do not match.", "error"); return; }

      try {
        await api("/auth/register", { body: { email, name: `${firstname} ${lastname}`.trim(), password } });
        showMessage("Registration successful! Please log in.", "success");
        if (loginForm) swapForms(loginForm, registerForm);
      } catch (err) {
        console.error(err);
        showMessage(err.message || "Registration failed.", "error");
      }
    });
  }

  // ---- Login ----
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("login submit -> /auth/login");

      const email = e.target["login-email"]?.value?.trim() || "";
      const password = e.target["login-password"]?.value || "";
      if (!email || !password) { showMessage("Email and password are required.", "error"); return; }

      try {
        const user = await api("/auth/login", { body: { email, password } });
        localStorage.setItem("hippo_user", JSON.stringify(user));
        showMessage("Login successful! Redirecting...", "success");
        setTimeout(() => { window.location.href = "./Home.html"; }, 1200);
      } catch (err) {
        console.error(err);
        showMessage(err.message || "Login failed.", "error");
      }
    });
  }

  // ---- Logout ----
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("hippo_user");
    setAuthUI(false);
    showMessage("You have been logged out.", "info");
    setTimeout(() => messageBox?.classList.add("hidden"), 1800);
  });

  // ---- Init ----
  setAuthUI(false);
})();
