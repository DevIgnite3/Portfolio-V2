import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { adminListClients, adminCreateInvoice } from "./db.js";
import { renderNotice, requireNonEmpty, setText } from "./ui.js";
import { getFirebase } from "./firebase.js";

const state = document.getElementById("state");
const form = document.getElementById("form");
const clientSel = document.getElementById("client");
const refreshBtn = document.getElementById("refresh");
const submitBtn = document.getElementById("submit");
const logoutEl = document.getElementById("logout");

const uploadProgressWrap = document.getElementById("uploadProgress");
const bar = document.getElementById("bar");
const progressText = document.getElementById("progressText");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/admin/login.html");
});

function clearProgress() {
  uploadProgressWrap.hidden = true;
  bar.style.width = "0%";
  setText(progressText, "");
}

function setProgress(percent) {
  uploadProgressWrap.hidden = false;
  bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  setText(progressText, `${percent}%`);
}

async function loadClients() {
  clientSel.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = "Loading…";
  clientSel.appendChild(opt);

  try {
    const clients = await adminListClients();
    clientSel.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a client…";
    clientSel.appendChild(placeholder);

    clients.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.name || c.id} (${c.id})`;
      clientSel.appendChild(o);
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
    const { mod } = await getFirebase();
    const { Timestamp } = mod.fsMod;

    await loadClients();

    refreshBtn.addEventListener("click", async () => {
      renderNotice(state, { type: "info", title: "Loading…", message: "Reloading clients." });
      await loadClients();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      clearProgress();

      try {
        const clientId = requireNonEmpty(clientSel.value, "Client");
        const invoiceNumber = requireNonEmpty(form.invoiceNumber.value, "Invoice number");
        const dateStr = requireNonEmpty(form.date.value, "Invoice date");
        const amount = Number(requireNonEmpty(form.amount.value, "Amount"));
        const currency = requireNonEmpty(form.currency.value, "Currency");
        const status = requireNonEmpty(form.status.value, "Status");

        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive number.");
        const dateObj = new Date(dateStr + "T00:00:00");
        if (Number.isNaN(dateObj.getTime())) throw new Error("Invoice date is invalid.");

        const pdfFile = form.pdf.files?.[0];
        if (!pdfFile) throw new Error("Invoice PDF is required.");
        if (pdfFile.type && pdfFile.type !== "application/pdf") throw new Error("Please upload a PDF file.");

        renderNotice(state, { type: "info", title: "Uploading…", message: "Uploading PDF and saving invoice record." });

        await adminCreateInvoice(
          {
            clientId,
            createdByUid: profile.uid,
            invoice: {
              invoiceNumber,
              date: Timestamp.fromDate(dateObj),
              amount,
              currency,
              status,
            },
            pdfFile,
          },
          {
            onProgress: ({ percent }) => setProgress(percent),
          }
        );

        renderNotice(state, { type: "ok", title: "Uploaded", message: "Invoice saved successfully." });
        form.reset();
        clearProgress();
        // keep currency default
        form.currency.value = currency;
      } catch (err) {
        renderNotice(state, { type: "error", title: "Upload failed", message: err?.message || "Please try again." });
      } finally {
        submitBtn.disabled = false;
      }
    });
  },
});
