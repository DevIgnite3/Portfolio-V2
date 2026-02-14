import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { listClientContracts, getFileDownloadUrl } from "./db.js";
import { renderNotice, fmtDate, friendlyErrorMessage } from "./ui.js";

const state = document.getElementById("state");
const listEl = document.getElementById("list");
const logoutEl = document.getElementById("logout");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/login.html");
});

function renderItem(c) {
  const li = document.createElement("li");
  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = c.title || "Contract";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `<span>Status: ${c.status || ""}</span><span>Uploaded: ${fmtDate(c.createdAt) || ""}</span>`;

  const actions = document.createElement("div");
  actions.className = "actions";

  // Resolve the download URL: prefer pre-saved pdfUrl, fall back to Storage SDK
  async function resolveUrl() {
    if (c.pdfUrl) return c.pdfUrl;
    return getFileDownloadUrl(c.pdfPath);
  }

  const view = document.createElement("a");
  view.href = "#";
  view.className = "btn btn--small btn--outline";
  view.textContent = "Open PDF";
  view.addEventListener("click", async (e) => {
    e.preventDefault();
    // Open blank window synchronously to preserve user-gesture (avoids popup-blocker)
    const w = window.open("", "_blank");
    try {
      const url = await resolveUrl();
      w.location.href = url;
    } catch (err) {
      w.close();
      alert("Could not open contract: " + (err.message || err));
    }
  });

  const dl = document.createElement("a");
  dl.href = "#";
  dl.className = "btn btn--small";
  dl.textContent = "Download";
  dl.addEventListener("click", async (e) => {
    e.preventDefault();
    dl.textContent = "Downloading…";
    dl.style.pointerEvents = "none";
    try {
      const url = await resolveUrl();
      // Fetch as blob so the download attribute works (cross-origin URLs ignore it)
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = (c.title || "contract") + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Download failed: " + (err.message || err));
    } finally {
      dl.textContent = "Download";
      dl.style.pointerEvents = "";
    }
  });

  actions.appendChild(view);
  actions.appendChild(dl);

  li.appendChild(title);
  li.appendChild(meta);
  li.appendChild(actions);
  return li;
}

renderNotice(state, { type: "info", title: "Loading…", message: "Fetching your contracts." });

await guardPage({
  requireAuth: true,
  role: "client",
  onReady: async (profile) => {
    try {
      if (!profile?.clientId) {
        renderNotice(state, { type: "error", title: "Account not linked", message: "Missing clientId on your user profile." });
        return;
      }

      const items = await listClientContracts(profile.clientId);
      state.innerHTML = "";
      listEl.innerHTML = "";

      if (!items.length) {
        renderNotice(state, { type: "info", title: "No contracts", message: "No contract PDFs are available yet." });
        return;
      }

      items.forEach((c) => listEl.appendChild(renderItem(c)));
    } catch (err) {
      renderNotice(state, { type: "error", title: "Could not load contracts", message: friendlyErrorMessage(err) });
    }
  },
});
