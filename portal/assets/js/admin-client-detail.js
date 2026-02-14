import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import {
  getClientDoc,
  adminListClientContentRequests,
  listClientInvoices,
  listClientContracts,
  adminUpdateContentRequest,
  adminUpdateInvoice,
  getFileDownloadUrl,
} from "./db.js";
import { renderNotice, fmtDate, fmtMoney, friendlyErrorMessage, setText } from "./ui.js";

/* ── DOM refs ── */
const stateEl = document.getElementById("state");
const logoutEl = document.getElementById("logout");
const pageHeading = document.getElementById("pageHeading");
const pageSubtitle = document.getElementById("pageSubtitle");
const clientInfoEl = document.getElementById("clientInfo");
const clientNameEl = document.getElementById("clientName");
const clientEmailEl = document.getElementById("clientEmail");
const clientIdBadge = document.getElementById("clientIdBadge");
const tabsWrap = document.getElementById("tabsWrap");

const panels = {
  requests: document.getElementById("panel-requests"),
  invoices: document.getElementById("panel-invoices"),
  contracts: document.getElementById("panel-contracts"),
};
const stateEls = {
  requests: document.getElementById("requestsState"),
  invoices: document.getElementById("invoicesState"),
  contracts: document.getElementById("contractsState"),
};
const listEls = {
  requests: document.getElementById("requestsList"),
  invoices: document.getElementById("invoicesList"),
  contracts: document.getElementById("contractsList"),
};

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/admin/login.html");
});

/* ── Tabs ── */
function activateTab(key) {
  tabsWrap.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === key);
  });
  Object.entries(panels).forEach(([k, panel]) => {
    panel.hidden = k !== key;
  });
}

tabsWrap.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  activateTab(btn.dataset.tab);
});

/* ── Helpers ── */
function badgeClass(status) {
  const s = (status || "").replace(/[\s-]/g, "_").toLowerCase();
  return `badge badge--${s}`;
}

async function openFile(storagePath) {
  try {
    const url = await getFileDownloadUrl(storagePath);
    window.open(url, "_blank");
  } catch (err) {
    alert("Could not open file: " + (err?.message || "Unknown error"));
  }
}

/* ── Render: Content Requests ── */
function renderRequestCard(item, clientId) {
  const card = document.createElement("div");
  card.className = "request-card";

  const header = document.createElement("div");
  header.className = "request-card__header";
  header.innerHTML = `
    <div>
      <h3>${item.projectName || "(No project)"} &bull; ${item.pageOrSection || ""}</h3>
      <span class="${badgeClass(item.status)}">${item.status || ""}</span>
    </div>
    <div class="meta" style="margin-top:0">
      <span>Type: ${item.requestType || ""}</span>
      <span>Priority: ${item.priority || ""}</span>
      <span>Created: ${fmtDate(item.createdAt)}</span>
      ${item.dueDate ? `<span>Due: ${fmtDate(item.dueDate)}</span>` : ""}
    </div>
  `;

  const details = document.createElement("div");
  details.className = "small mt-1";
  details.textContent = item.details || "";

  if (item.clientNotes) {
    const cn = document.createElement("div");
    cn.className = "small mt-1";
    cn.innerHTML = `<strong>Client notes:</strong> ${item.clientNotes}`;
    details.appendChild(cn);
  }

  /* Files with download links */
  const filesDiv = document.createElement("div");
  filesDiv.className = "small mt-1";
  if (Array.isArray(item.fileRefs) && item.fileRefs.length) {
    const label = document.createElement("strong");
    label.textContent = "Files: ";
    filesDiv.appendChild(label);
    item.fileRefs.forEach((f, i) => {
      if (i > 0) filesDiv.appendChild(document.createTextNode(", "));
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = f.name;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        openFile(f.path);
      });
      filesDiv.appendChild(link);
    });
  } else {
    filesDiv.innerHTML = "<strong>Files:</strong> (none)";
  }

  /* Inline edit form */
  const form = document.createElement("form");
  form.className = "mt-1";
  form.style.borderTop = "1px solid var(--border)";
  form.style.paddingTop = "1rem";
  form.style.marginTop = "1rem";

  form.innerHTML = `
    <div class="row">
      <div>
        <label>Update Status</label>
        <select name="status">
          <option value="submitted">submitted</option>
          <option value="in_review">in_review</option>
          <option value="needs_info">needs_info</option>
          <option value="approved">approved</option>
          <option value="delivered">delivered</option>
        </select>
      </div>
      <div>
        <label>Admin Notes</label>
        <textarea name="adminNotes" style="min-height:60px"></textarea>
      </div>
    </div>
    <div class="actions">
      <button type="submit" class="btn--small">Save</button>
      <span class="small" data-msg></span>
    </div>
  `;

  form.querySelector("[name=status]").value = item.status || "submitted";
  form.querySelector("[name=adminNotes]").value = item.adminNotes || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button");
    const msg = form.querySelector("[data-msg]");
    btn.disabled = true;
    msg.textContent = "Saving…";
    try {
      await adminUpdateContentRequest({
        clientId,
        requestId: item.id,
        patch: {
          status: form.querySelector("[name=status]").value,
          adminNotes: form.querySelector("[name=adminNotes]").value,
        },
      });
      msg.textContent = "Saved!";
      // Update badge
      const badge = card.querySelector(".badge");
      if (badge) {
        const newStatus = form.querySelector("[name=status]").value;
        badge.className = badgeClass(newStatus);
        badge.textContent = newStatus;
      }
    } catch (err) {
      msg.textContent = err?.message || "Save failed.";
    } finally {
      btn.disabled = false;
      setTimeout(() => (msg.textContent = ""), 3000);
    }
  });

  card.appendChild(header);
  card.appendChild(details);
  card.appendChild(filesDiv);
  card.appendChild(form);
  return card;
}

/* ── Render: Invoice Card ── */
function renderInvoiceCard(inv, clientId) {
  const card = document.createElement("div");
  card.className = "request-card";

  const header = document.createElement("div");
  header.className = "request-card__header";
  header.innerHTML = `
    <div>
      <h3>${inv.invoiceNumber || "(No number)"}</h3>
      <span class="${badgeClass(inv.status)}">${inv.status || ""}</span>
    </div>
    <div class="meta" style="margin-top:0">
      <span>${fmtMoney(inv.amount, inv.currency)}</span>
      <span>Date: ${fmtDate(inv.date)}</span>
    </div>
  `;

  /* PDF link */
  const pdfDiv = document.createElement("div");
  pdfDiv.className = "small mt-1";
  if (inv.pdfUrl) {
    const link = document.createElement("a");
    link.href = inv.pdfUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View PDF";
    pdfDiv.appendChild(link);
  } else if (inv.pdfPath) {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "View PDF";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openFile(inv.pdfPath);
    });
    pdfDiv.appendChild(link);
  }

  /* Status edit */
  const form = document.createElement("form");
  form.className = "mt-1";
  form.style.borderTop = "1px solid var(--border)";
  form.style.paddingTop = "1rem";
  form.style.marginTop = "1rem";

  form.innerHTML = `
    <div class="row">
      <div>
        <label>Update Status</label>
        <select name="status">
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
    </div>
    <div class="actions">
      <button type="submit" class="btn--small">Save Status</button>
      <span class="small" data-msg></span>
    </div>
  `;

  form.querySelector("[name=status]").value = inv.status || "unpaid";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button");
    const msg = form.querySelector("[data-msg]");
    btn.disabled = true;
    msg.textContent = "Saving…";
    try {
      await adminUpdateInvoice({
        clientId,
        invoiceId: inv.id,
        patch: { status: form.querySelector("[name=status]").value },
      });
      msg.textContent = "Saved!";
      const badge = card.querySelector(".badge");
      if (badge) {
        const newStatus = form.querySelector("[name=status]").value;
        badge.className = badgeClass(newStatus);
        badge.textContent = newStatus;
      }
    } catch (err) {
      msg.textContent = err?.message || "Save failed.";
    } finally {
      btn.disabled = false;
      setTimeout(() => (msg.textContent = ""), 3000);
    }
  });

  card.appendChild(header);
  card.appendChild(pdfDiv);
  card.appendChild(form);
  return card;
}

/* ── Render: Contract Card ── */
function renderContractCard(c) {
  const card = document.createElement("div");
  card.className = "request-card";

  card.innerHTML = `
    <div class="request-card__header">
      <div>
        <h3>${c.title || "(Untitled)"}</h3>
        <span class="${badgeClass(c.status)}">${c.status || ""}</span>
      </div>
      <div class="meta" style="margin-top:0">
        <span>Created: ${fmtDate(c.createdAt)}</span>
      </div>
    </div>
  `;

  const pdfDiv = document.createElement("div");
  pdfDiv.className = "small mt-1";
  if (c.pdfUrl) {
    const link = document.createElement("a");
    link.href = c.pdfUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View PDF";
    pdfDiv.appendChild(link);
  } else if (c.pdfPath) {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "View PDF";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openFile(c.pdfPath);
    });
    pdfDiv.appendChild(link);
  }

  card.appendChild(pdfDiv);
  return card;
}

/* ── Load sections ── */
async function loadRequests(clientId) {
  renderNotice(stateEls.requests, { type: "info", title: "Loading…", message: "Fetching content requests." });
  listEls.requests.innerHTML = "";
  try {
    const items = await adminListClientContentRequests(clientId);
    stateEls.requests.innerHTML = "";
    if (!items.length) {
      renderNotice(stateEls.requests, { type: "info", title: "No requests", message: "This client has no content requests yet." });
      return;
    }
    items.forEach((r) => listEls.requests.appendChild(renderRequestCard(r, clientId)));
  } catch (err) {
    renderNotice(stateEls.requests, { type: "error", title: "Error", message: friendlyErrorMessage(err) });
  }
}

async function loadInvoices(clientId) {
  renderNotice(stateEls.invoices, { type: "info", title: "Loading…", message: "Fetching invoices." });
  listEls.invoices.innerHTML = "";
  try {
    const items = await listClientInvoices(clientId);
    stateEls.invoices.innerHTML = "";
    if (!items.length) {
      renderNotice(stateEls.invoices, { type: "info", title: "No invoices", message: "No invoices found for this client." });
      return;
    }
    items.forEach((inv) => listEls.invoices.appendChild(renderInvoiceCard(inv, clientId)));
  } catch (err) {
    renderNotice(stateEls.invoices, { type: "error", title: "Error", message: friendlyErrorMessage(err) });
  }
}

async function loadContracts(clientId) {
  renderNotice(stateEls.contracts, { type: "info", title: "Loading…", message: "Fetching contracts." });
  listEls.contracts.innerHTML = "";
  try {
    const items = await listClientContracts(clientId);
    stateEls.contracts.innerHTML = "";
    if (!items.length) {
      renderNotice(stateEls.contracts, { type: "info", title: "No contracts", message: "No contracts found for this client." });
      return;
    }
    items.forEach((c) => listEls.contracts.appendChild(renderContractCard(c)));
  } catch (err) {
    renderNotice(stateEls.contracts, { type: "error", title: "Error", message: friendlyErrorMessage(err) });
  }
}

/* ── Init ── */
const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

if (!clientId) {
  renderNotice(stateEl, {
    type: "error",
    title: "Missing client ID",
    message: 'Navigate here from the Clients page, or add ?id=<clientId> to the URL.',
  });
} else {
  renderNotice(stateEl, { type: "info", title: "Loading…", message: "Checking access." });

  await guardPage({
    requireAuth: true,
    role: "admin",
    onReady: async () => {
      try {
        const client = await getClientDoc(clientId);
        if (!client) {
          renderNotice(stateEl, { type: "error", title: "Client not found", message: `No client document found for ID "${clientId}".` });
          return;
        }

        stateEl.innerHTML = "";

        /* Populate header */
        setText(pageHeading, client.name || clientId);
        setText(pageSubtitle, `Client dashboard for ${clientId}`);
        setText(clientNameEl, client.name || clientId);
        setText(clientEmailEl, client.primaryEmail || client.email || "");
        setText(clientIdBadge, clientId);
        clientInfoEl.hidden = false;
        tabsWrap.hidden = false;

        /* Load all three sections in parallel */
        await Promise.all([
          loadRequests(clientId),
          loadInvoices(clientId),
          loadContracts(clientId),
        ]);
      } catch (err) {
        renderNotice(stateEl, { type: "error", title: "Could not load client", message: friendlyErrorMessage(err) });
      }
    },
  });
}
