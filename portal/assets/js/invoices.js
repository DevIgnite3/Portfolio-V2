import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { listClientInvoices, getFileDownloadUrl } from "./db.js";
import { renderNotice, fmtDate, fmtMoney, friendlyErrorMessage } from "./ui.js";
import { getFirebase } from "./firebase.js";

const state = document.getElementById("state");
const listEl = document.getElementById("list");
const logoutEl = document.getElementById("logout");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/login.html");
});

function renderItem(inv, currencyFallback) {
  const li = document.createElement("li");
  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = `Invoice ${inv.invoiceNumber || inv.id}`;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `<span>Date: ${fmtDate(inv.date) || ""}</span><span>Amount: ${fmtMoney(inv.amount, inv.currency || currencyFallback) || ""}</span><span>Status: ${inv.status || ""}</span>`;

  const actions = document.createElement("div");
  actions.className = "actions";

  // Resolve the download URL: prefer pre-saved pdfUrl, fall back to Storage SDK
  async function resolveUrl() {
    if (inv.pdfUrl) return inv.pdfUrl;
    return getFileDownloadUrl(inv.pdfPath);
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
      alert("Could not open invoice: " + (err.message || err));
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
      a.download = `invoice-${inv.invoiceNumber || inv.id}.pdf`;
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

renderNotice(state, { type: "info", title: "Loading…", message: "Fetching your invoices." });

await guardPage({
  requireAuth: true,
  role: "client",
  onReady: async (profile) => {
    try {
      const { portalConfig } = await getFirebase();
      const currencyFallback = portalConfig?.defaultCurrency || "ZAR";

      if (!profile?.clientId) {
        renderNotice(state, { type: "error", title: "Account not linked", message: "Missing clientId on your user profile." });
        return;
      }

      const items = await listClientInvoices(profile.clientId);
      state.innerHTML = "";
      listEl.innerHTML = "";

      if (!items.length) {
        renderNotice(state, { type: "info", title: "No invoices", message: "No invoice PDFs are available yet." });
        return;
      }

      items.forEach((inv) => listEl.appendChild(renderItem(inv, currencyFallback)));
    } catch (err) {
      renderNotice(state, { type: "error", title: "Could not load invoices", message: friendlyErrorMessage(err) });
    }
  },
});
