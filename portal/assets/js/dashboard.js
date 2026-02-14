import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { getClientDoc } from "./db.js";
import { renderNotice, setText } from "./ui.js";
import { getFirebase } from "./firebase.js";

const state = document.getElementById("state");
const emailEl = document.getElementById("email");
const clientNameEl = document.getElementById("clientName");
const supportEl = document.getElementById("support");
const logoutEl = document.getElementById("logout");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/login.html");
});

renderNotice(state, { type: "info", title: "Loading…", message: "Checking your account." });

await guardPage({
  requireAuth: true,
  role: "client",
  onReady: async (profile) => {
    try {
      const { portalConfig } = await getFirebase();
      setText(emailEl, profile?.email || "");
      setText(supportEl, portalConfig?.supportEmail || "support@devignite.co.za");

      if (!profile?.clientId) {
        renderNotice(state, {
          type: "error",
          title: "Account not linked",
          message: "Your user is signed in but is missing a clientId. Ask an admin to link your account in Firestore (users/{uid}).",
        });
        return;
      }

      const client = await getClientDoc(profile.clientId);
      setText(clientNameEl, client?.name || profile.clientId);
      state.innerHTML = "";
    } catch (err) {
      renderNotice(state, {
        type: "error",
        title: "Could not load dashboard",
        message: err?.message || "Please refresh and try again.",
      });
    }
  },
});
