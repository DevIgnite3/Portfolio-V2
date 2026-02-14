import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { adminListClients, adminUploadContract } from "./db.js";
import { renderNotice, requireNonEmpty } from "./ui.js";

const state = document.getElementById("state");
const form = document.getElementById("form");
const clientSel = document.getElementById("client");
const refreshBtn = document.getElementById("refresh");
const submitBtn = document.getElementById("submit");
const logoutEl = document.getElementById("logout");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/admin/login.html");
});

async function loadClients() {
  clientSel.innerHTML = "";
  const o = document.createElement("option");
  o.value = "";
  o.textContent = "Loading…";
  clientSel.appendChild(o);

  try {
    const clients = await adminListClients();
    clientSel.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a client…";
    clientSel.appendChild(placeholder);

    clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name || c.id} (${c.id})`;
      clientSel.appendChild(opt);
    });

    if (!clients.length) {
      renderNotice(state, { type: "info", title: "No clients", message: "Create clients/{clientId} docs first." });
    } else {
      state.innerHTML = "";
    }
  } catch (err) {
    renderNotice(state, { type: "error", title: "Could not load clients", message: err?.message || "Please refresh." });
  }
}

renderNotice(state, { type: "info", title: "Loading…", message: "Checking access." });

await guardPage({
  requireAuth: true,
  role: "admin",
  onReady: async (profile) => {
    await loadClients();

    refreshBtn.addEventListener("click", async () => {
      renderNotice(state, { type: "info", title: "Loading…", message: "Reloading clients." });
      await loadClients();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      renderNotice(state, { type: "info", title: "Uploading…", message: "Uploading contract and saving record." });

      try {
        const clientId = requireNonEmpty(clientSel.value, "Client");
        const title = requireNonEmpty(form.title.value, "Title");
        const status = requireNonEmpty(form.status.value, "Status");
        const supersedeOthers = !!document.getElementById("supersede").checked;

        const pdfFile = form.pdf.files?.[0];
        if (!pdfFile) throw new Error("Contract PDF is required.");
        if (pdfFile.type && pdfFile.type !== "application/pdf") throw new Error("Please upload a PDF file.");

        await adminUploadContract({
          clientId,
          createdByUid: profile.uid,
          title,
          status,
          pdfFile,
          supersedeOthers,
        });

        renderNotice(state, { type: "ok", title: "Uploaded", message: "Contract saved successfully." });
        form.reset();
      } catch (err) {
        renderNotice(state, { type: "error", title: "Upload failed", message: err?.message || "Please try again." });
      } finally {
        submitBtn.disabled = false;
      }
    });
  },
});
