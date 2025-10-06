class AssetHub {
  constructor() {
    this.currentUserId = "user123"; // TODO: replace with real session/user id
    this.API_BASE = "http://localhost:5000";
    this.editingItem = null;
    this.deletingItem = null;
  }

  async init() {
    this.bindTabEvents();
    this.bindSearch();
    this.bindMobileMenu();
    this.bindModalButtons();
    this.bindAddItemButton();
    await this.loadOwnedAssets();
  }

  // --------------------- Load Data ---------------------
  async loadOwnedAssets() {
    try {
      const res = await fetch(`${this.API_BASE}/users/${this.currentUserId}/items`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ownedItems = await res.json();

      this.renderItems("owned", ownedItems);
      document.getElementById("owned-count").textContent = ownedItems.length;
    } catch (err) {
      console.error("Error loading owned assets:", err);
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

      clone.querySelector(".card-img").src = item.imageUrl || "placeholder.png";
      clone.querySelector(".title").textContent = item.title || "(Untitled)";
      clone.querySelector(".description").textContent = item.description || "";
      clone.querySelector(".created-date").textContent =
        new Date(item.createdAt).toLocaleDateString();
      clone.querySelector(".status-badge").textContent = item.available ? "Available" : "Not Available";

      clone.querySelector(".view-btn").addEventListener("click", () => this.viewItem(item));
      clone.querySelector(".edit-btn").addEventListener("click", () => this.openEdit(item));
      clone.querySelector(".delete-btn").addEventListener("click", () => this.openDelete(item));

      grid.appendChild(clone);
    });
  }

  // --------------------- CRUD ---------------------
  async addItem(newItem) {
    try {
      const res = await fetch(`${this.API_BASE}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, ownerId: this.currentUserId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.loadOwnedAssets();
    } catch (err) {
      console.error("Error adding item:", err);
    }
  }

  async updateItem(id, updates) {
    try {
      const res = await fetch(`${this.API_BASE}/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.loadOwnedAssets();
    } catch (err) {
      console.error("Error updating item:", err);
    }
  }

  async deleteItem(id) {
    try {
      const res = await fetch(`${this.API_BASE}/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.loadOwnedAssets();
    } catch (err) {
      console.error("Error deleting item:", err);
    }
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
    document.getElementById("edit-cancel").onclick = () => {
      document.getElementById("edit-modal").classList.add("hidden");
    };
    document.getElementById("edit-save").onclick = async () => {
      if (this.editingItem) {
        const updates = {
          title: document.getElementById("edit-title").value,
          description: document.getElementById("edit-description").value,
        };
        await this.updateItem(this.editingItem.id, updates);
        document.getElementById("edit-modal").classList.add("hidden");
      }
    };

    document.getElementById("delete-cancel").onclick = () => {
      document.getElementById("delete-modal").classList.add("hidden");
    };
    document.getElementById("delete-confirm").onclick = async () => {
      if (this.deletingItem) {
        await this.deleteItem(this.deletingItem.id);
        document.getElementById("delete-modal").classList.add("hidden");
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
