import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { adminListRecentContentRequests, adminUpdateContentRequest } from "./db.js";
import { renderNotice, fmtDate, requireNonEmpty, friendlyErrorMessage } from "./ui.js";

const state = document.getElementById("state");
const listWrap = document.getElementById("list");
const refreshBtn = document.getElementById("refresh");
const clientIdEl = document.getElementById("clientId");
const statusEl = document.getElementById("status");
const logoutEl = document.getElementById("logout");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/admin/login.html");
});

function isIndexError(err) {
  const msg = (err?.message || "").toLowerCase();
  return msg.includes("requires an index") || msg.includes("failed_precondition");
}

function renderRequestCard(item) {
  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "12px";

  const header = document.createElement("div");
  header.innerHTML = `
    <div style="font-weight:700">${item.projectName || "(No project)"} • ${item.pageOrSection || ""}</div>
    <div class="meta">
      <span>Client: ${item.clientId || ""}</span>
      <span>Status: ${item.status || ""}</span>
      <span>Created: ${fmtDate(item.createdAt) || ""}</span>
      <span>Due: ${fmtDate(item.dueDate) || ""}</span>
    </div>
  `;

  const details = document.createElement("div");
  details.className = "small";
  details.style.marginTop = "10px";
  details.textContent = item.details || "";

  const notes = document.createElement("div");
  notes.style.marginTop = "10px";
  notes.innerHTML = `
    <div class="small"><strong>Client notes:</strong> ${item.clientNotes ? item.clientNotes : "(none)"}</div>
  `;

  const files = document.createElement("div");
  files.className = "small";
  files.style.marginTop = "8px";
  if (Array.isArray(item.fileRefs) && item.fileRefs.length) {
    files.innerHTML = `<strong>Files:</strong> ${item.fileRefs.map((f) => f.name).join(", ")}`;
  } else {
    files.innerHTML = `<strong>Files:</strong> (none)`;
  }

  const form = document.createElement("form");
  form.style.marginTop = "12px";

  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Update status";

  const sel = document.createElement("select");
  sel.innerHTML = `
    <option value="submitted">submitted</option>
    <option value="in_review">in_review</option>
    <option value="needs_info">needs_info</option>
    <option value="approved">approved</option>
    <option value="delivered">delivered</option>
  `;
  sel.value = item.status || "submitted";

  const notesLabel = document.createElement("label");
  notesLabel.textContent = "Admin notes (visible to client)";

  const ta = document.createElement("textarea");
  ta.value = item.adminNotes || "";

  const actions = document.createElement("div");
  actions.className = "actions";

  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save";

  const msg = document.createElement("div");
  msg.className = "small";

  actions.appendChild(save);
  actions.appendChild(msg);

  form.appendChild(statusLabel);
  form.appendChild(sel);
  form.appendChild(notesLabel);
  form.appendChild(ta);
  form.appendChild(actions);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    save.disabled = true;
    msg.textContent = "Saving…";

    try {
      const clientId = requireNonEmpty(item.clientId, "clientId");
      const requestId = requireNonEmpty(item.id, "requestId");

      await adminUpdateContentRequest({
        clientId,
        requestId,
        patch: {
          status: sel.value,
          adminNotes: ta.value || "",
        },
      });

      msg.textContent = "Saved.";
    } catch (err) {
      msg.textContent = err?.message || "Save failed.";
    } finally {
      save.disabled = false;
      window.setTimeout(() => {
        msg.textContent = "";
      }, 2500);
    }
  });

  card.appendChild(header);
  card.appendChild(details);
  card.appendChild(notes);
  card.appendChild(files);
  card.appendChild(form);
  return card;
}

async function load() {
  renderNotice(state, { type: "info", title: "Loading…", message: "Fetching latest requests." });
  listWrap.innerHTML = "";

  const status = statusEl.value || "";
  const clientId = (clientIdEl.value || "").trim();

  try {
    const items = await adminListRecentContentRequests({ status, clientId });
    state.innerHTML = "";

    if (!items.length) {
      renderNotice(state, { type: "info", title: "No results", message: "No matching requests found." });
      return;
    }

    items.forEach((it) => listWrap.appendChild(renderRequestCard(it)));
  } catch (err) {
    if (isIndexError(err)) {
      renderNotice(state, {
        type: "error",
        title: "Firestore index required",
        message: "This query needs a composite index (clientId + status). Either create the index in Firebase Console, or filter by only one field at a time.",
      });
      return;
    }

    renderNotice(state, { type: "error", title: "Could not load requests", message: friendlyErrorMessage(err) });
  }
}

renderNotice(state, { type: "info", title: "Loading…", message: "Checking access." });

await guardPage({
  requireAuth: true,
  role: "admin",
  onReady: async () => {
    await load();
    refreshBtn.addEventListener("click", load);
  },
});
