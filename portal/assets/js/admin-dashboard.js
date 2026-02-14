import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { adminStats } from "./db.js";
import { renderNotice, friendlyErrorMessage } from "./ui.js";

const state = document.getElementById("state");
const statsEl = document.getElementById("stats");
const logoutEl = document.getElementById("logout");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/admin/login.html");
});

renderNotice(state, { type: "info", title: "Loading…", message: "Fetching admin stats." });

await guardPage({
  requireAuth: true,
  role: "admin",
  onReady: async () => {
    try {
      const stats = await adminStats();
      state.innerHTML = "";
      statsEl.innerHTML = "";

      const card1 = document.createElement("div");
      card1.className = "stat-card";
      card1.innerHTML = `<div class="stat-card__value">${stats.newRequests}</div><div class="stat-card__label">New Requests</div>`;

      const card2 = document.createElement("div");
      card2.className = "stat-card";
      card2.innerHTML = `<div class="stat-card__value">${stats.invoicesThisMonth}</div><div class="stat-card__label">Invoices This Month</div>`;

      statsEl.appendChild(card1);
      statsEl.appendChild(card2);
    } catch (err) {
      renderNotice(state, { type: "error", title: "Could not load stats", message: friendlyErrorMessage(err) });
    }
  },
});
