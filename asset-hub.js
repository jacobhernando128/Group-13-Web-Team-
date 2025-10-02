class AssetHub {
  constructor() {
    this.currentUserId = "user123"; // TODO: replace with real session/user id
    this.editingItem = null;
    this.deletingItem = null;
    this.maintenanceItem = null;
  }

  async init() {
    this.bindTabEvents();
    this.bindSearch();
    this.bindMobileMenu();
    this.bindModalButtons();
    this.bindAddItemButton();

    await this.loadUserAssets();
  }

  // --------------------- Load Data ---------------------
  async loadUserAssets() {
    try {
      // Fetch owned items
      const ownedRes = await fetch(`/api/assets/owned/${this.currentUserId}`);
      const ownedItems = await ownedRes.json();

      // Fetch borrowed items
      const borrowedRes = await fetch(`/api/assets/borrowed/${this.currentUserId}`);
      const borrowedItems = await borrowedRes.json();

      this.renderItems("owned", ownedItems);
      this.renderItems("borrowed", borrowedItems);

      document.getElementById("owned-count").textContent = ownedItems.length;
      document.getElementById("borrowed-count").textContent = borrowedItems.length;
    } catch (err) {
      console.error("Error loading user assets:", err);
    }
  }

  // --------------------- Render ---------------------
  renderItems(type, items) {
    const grid = document.getElementById(`${type}-items-grid`);
    const emptyState = document.getElementById(`${type}-empty`);
    grid.innerHTML = "";

    if (!items.length) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    const template = document.getElementById("asset-card-template");

    items.forEach(item => {
      const clone = template.content.cloneNode(true);
      const card = clone.querySelector("article");
      card.dataset.id = item.id;

      clone.querySelector(".card-img").src = item.image_url || "placeholder.png";
      clone.querySelector(".title").textContent = item.title;
      clone.querySelector(".description").textContent = item.description || "";
      clone.querySelector(".created-date").textContent = new Date(item.created_at).toLocaleDateString();
      clone.querySelector(".status-badge").textContent = item.available ? "Available" : "Not Available";

      // Buttons
      clone.querySelector(".view-btn").addEventListener("click", () => this.viewItem(item));
      clone.querySelector(".edit-btn").addEventListener("click", () => this.openEdit(item));
      clone.querySelector(".delete-btn").addEventListener("click", () => this.openDelete(item));

      const maintenanceBtn = clone.querySelector(".maintenance-btn");
      if (type === "owned") {
        maintenanceBtn.classList.remove("hidden");
        maintenanceBtn.addEventListener("click", () => this.openMaintenance(item));
      }

      grid.appendChild(clone);
    });
  }

  // --------------------- CRUD ---------------------
  async addItem(newItem) {
    await fetch(`/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newItem, owner_id: this.currentUserId })
    });
    await this.loadUserAssets();
  }

  async updateItem(id, updates) {
    await fetch(`/api/assets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    await this.loadUserAssets();
  }

  async deleteItem(id) {
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    await this.loadUserAssets();
  }

  // --------------------- UI Actions ---------------------
  openEdit(item) {
    this.editingItem = item;
    document.getElementById("edit-title").value = item.title;
    document.getElementById("edit-description").value = item.description;
    document.getElementById("edit-modal").classList.remove("hidden");
  }

  openDelete(item) {
    this.deletingItem = item;
    document.getElementById("delete-modal").classList.remove("hidden");
  }

  openMaintenance(item) {
    this.maintenanceItem = item;
    document.getElementById("maintenance-modal").classList.remove("hidden");
  }

  viewItem(item) {
    alert(`Viewing: ${item.title}`);
  }

  // --------------------- Helpers ---------------------
  bindTabEvents() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(btn => {
      btn.addEventListener("click", () => {
        tabs.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".tab-content").forEach(tab => tab.classList.add("hidden"));
        document.getElementById(`${btn.dataset.tab}-tab`).classList.remove("hidden");
      });
    });
  }

  bindSearch() {
    const input = document.getElementById("search");
    input.addEventListener("input", () => {
      const term = input.value.toLowerCase();
      document.querySelectorAll("article").forEach(card => {
        const title = card.querySelector(".title").textContent.toLowerCase();
        const desc = card.querySelector(".description").textContent.toLowerCase();
        card.style.display = title.includes(term) || desc.includes(term) ? "" : "none";
      });
    });
  }

  bindMobileMenu() {
    document.getElementById("mobile-menu-btn").addEventListener("click", () => {
      alert("Mobile menu toggle");
    });
  }

  bindModalButtons() {
    // Edit modal
    document.getElementById("edit-cancel").onclick = () => {
      document.getElementById("edit-modal").classList.add("hidden");
    };
    document.getElementById("edit-save").onclick = async () => {
      if (this.editingItem) {
        const updates = {
          title: document.getElementById("edit-title").value,
          description: document.getElementById("edit-description").value
        };
        await this.updateItem(this.editingItem.id, updates);
        document.getElementById("edit-modal").classList.add("hidden");
      }
    };

    // Delete modal
    document.getElementById("delete-cancel").onclick = () => {
      document.getElementById("delete-modal").classList.add("hidden");
    };
    document.getElementById("delete-confirm").onclick = async () => {
      if (this.deletingItem) {
        await this.deleteItem(this.deletingItem.id);
        document.getElementById("delete-modal").classList.add("hidden");
      }
    };

    // Maintenance modal
    document.getElementById("maintenance-cancel").onclick = () => {
      document.getElementById("maintenance-modal").classList.add("hidden");
    };
    document.getElementById("maintenance-submit").onclick = async () => {
      if (this.maintenanceItem) {
        const notes = document.getElementById("maintenance-notes").value;
        await fetch(`/api/maintenance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset_id: this.maintenanceItem.id, notes })
        });
        document.getElementById("maintenance-modal").classList.add("hidden");
      }
    };
  }

  bindAddItemButton() {
    document.getElementById("add-item-btn").addEventListener("click", async () => {
      const title = prompt("New asset title?");
      if (title) {
        await this.addItem({ title, description: "" });
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const hub = new AssetHub();
  hub.init();
});