import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { renderNotice, requireNonEmpty, fmtDate } from "./ui.js";
import { adminCreateClientAndUser, adminListClients } from "./db.js";

const state = document.getElementById("state");
const form = document.getElementById("form");
const submitBtn = document.getElementById("submit");
const clearBtn = document.getElementById("clear");
const logoutEl = document.getElementById("logout");
const clientsListState = document.getElementById("clientsListState");
const clientsListWrap = document.getElementById("clientsListWrap");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/admin/login.html");
});

function normalizeClientId(v) {
  const raw = (v ?? "").toString().trim();
  // Keep simple: lowercase + dashes
  return raw.toLowerCase().replace(/\s+/g, "-");
}

renderNotice(state, { type: "info", title: "Loading…", message: "Checking access." });

async function loadClientsList() {
  renderNotice(clientsListState, { type: "info", title: "Loading…", message: "Fetching clients." });
  clientsListWrap.innerHTML = "";
  try {
    const clients = await adminListClients();
    clientsListState.innerHTML = "";
    if (!clients.length) {
      renderNotice(clientsListState, { type: "info", title: "No clients", message: "No clients created yet." });
      return;
    }
    clients.forEach((c) => {
      const a = document.createElement("a");
      a.href = `/portal/admin/client-detail.html?id=${encodeURIComponent(c.id)}`;
      a.className = "client-tile";
      a.innerHTML = `
        <div class="client-tile__name">${c.name || c.id}</div>
        <div class="client-tile__id">${c.id}</div>
        ${c.primaryEmail ? `<div class="client-tile__email">${c.primaryEmail}</div>` : ""}
        <div class="client-tile__date">Created: ${fmtDate(c.createdAt)}</div>
      `;
      clientsListWrap.appendChild(a);
    });
  } catch (err) {
    renderNotice(clientsListState, { type: "error", title: "Could not load clients", message: err?.message || "Please refresh." });
  }
}

await guardPage({
  requireAuth: true,
  role: "admin",
  onReady: async () => {
    state.innerHTML = "";

    clearBtn.addEventListener("click", () => {
      form.reset();
      state.innerHTML = "";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      renderNotice(state, { type: "info", title: "Creating…", message: "Creating Auth user and Firestore records." });

      try {
        const clientId = normalizeClientId(requireNonEmpty(form.clientId.value, "Client ID"));
        const clientName = requireNonEmpty(form.clientName.value, "Client name");
        const primaryEmail = (form.primaryEmail.value || "").trim();
        const userEmail = requireNonEmpty(form.userEmail.value, "Username / email");
        const password = requireNonEmpty(form.password.value, "Temporary password");

        if (!/^[a-z0-9-]{3,64}$/.test(clientId)) {
          throw new Error("Client ID must be 3-64 chars and contain only lowercase letters, numbers, and dashes.");
        }
        if (password.length < 8) throw new Error("Temporary password must be at least 8 characters.");

        const result = await adminCreateClientAndUser({ clientId, clientName, primaryEmail, userEmail, password });

        renderNotice(state, {
          type: "ok",
          title: "Client created",
          message: `Client '${result.clientId}' created. New user UID: ${result.uid}`,
        });
        await loadClientsList();
      } catch (err) {
        renderNotice(state, { type: "error", title: "Could not create client", message: err?.message || "Please try again." });
      } finally {
        submitBtn.disabled = false;
      }
    });

    await loadClientsList();
  },
});
