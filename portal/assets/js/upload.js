import { guardPage } from "./router-guard.js";
import { logout } from "./auth.js";
import { createContentRequest, listClientContentRequests } from "./db.js";
import { renderNotice, requireNonEmpty, fmtDate, setText, friendlyErrorMessage } from "./ui.js";
import { getFirebase } from "./firebase.js";

const state = document.getElementById("state");
const listState = document.getElementById("listState");
const listEl = document.getElementById("list");
const logoutEl = document.getElementById("logout");

const form = document.getElementById("form");
const submitBtn = document.getElementById("submit");
const resetBtn = document.getElementById("resetBtn");

const uploadProgressWrap = document.getElementById("uploadProgress");
const bar = document.getElementById("bar");
const progressText = document.getElementById("progressText");

logoutEl.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.assign("/portal/login.html");
});

function renderRequestItem(r) {
  const li = document.createElement("li");
  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = `${r.projectName || "(No project)"} • ${r.pageOrSection || ""}`;

  const body = document.createElement("div");
  body.className = "small";
  body.textContent = r.details || "";

  const meta = document.createElement("div");
  meta.className = "meta";
  const created = r.createdAt ? fmtDate(r.createdAt) : "";
  meta.innerHTML = `<span>Status: ${r.status || ""}</span><span>Created: ${created}</span>`;

  if (r.adminNotes) {
    const adminNotes = document.createElement("div");
    adminNotes.className = "small";
    adminNotes.style.marginTop = "8px";
    adminNotes.innerHTML = `<strong>Admin notes:</strong> ${r.adminNotes}`;
    li.appendChild(adminNotes);
  }

  if (Array.isArray(r.fileRefs) && r.fileRefs.length) {
    const files = document.createElement("div");
    files.className = "small";
    files.style.marginTop = "8px";
    files.textContent = `Files: ${r.fileRefs.map((f) => f.name).join(", ")}`;
    li.appendChild(files);
  }

  li.appendChild(title);
  li.appendChild(body);
  li.appendChild(meta);
  return li;
}

async function loadList(clientId, uid) {
  renderNotice(listState, { type: "info", title: "Loading…", message: "Fetching your previous requests." });
  listEl.innerHTML = "";
  try {
    const items = await listClientContentRequests(clientId, uid);
    listState.innerHTML = "";
    if (!items.length) {
      renderNotice(listState, { type: "info", title: "No requests yet", message: "Submit your first request using the form." });
      return;
    }
    items.forEach((r) => listEl.appendChild(renderRequestItem(r)));
  } catch (err) {
    renderNotice(listState, { type: "error", title: "Could not load requests", message: err?.message || "Please refresh." });
  }
}

function setProgress({ fileName = "", percent = 0 }) {
  uploadProgressWrap.hidden = false;
  bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  setText(progressText, fileName ? `${fileName}: ${percent}%` : `${percent}%`);
}

function clearProgress() {
  uploadProgressWrap.hidden = true;
  bar.style.width = "0%";
  setText(progressText, "");
}

renderNotice(state, { type: "info", title: "Loading…", message: "Checking your account." });

await guardPage({
  requireAuth: true,
  role: "client",
  onReady: async (profile) => {
    const { mod } = await getFirebase();
    const { Timestamp } = mod.fsMod;

    if (!profile?.clientId) {
      renderNotice(state, {
        type: "error",
        title: "Account not linked",
        message: "Your user is missing a clientId in Firestore (users/{uid}). Ask an admin to link your account.",
      });
      return;
    }

    state.innerHTML = "";
    await loadList(profile.clientId, profile.uid);

    resetBtn.addEventListener("click", () => {
      form.reset();
      clearProgress();
      state.innerHTML = "";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      clearProgress();

      try {
        const projectName = requireNonEmpty(form.projectName.value, "Project name");
        const pageOrSection = requireNonEmpty(form.pageOrSection.value, "Page / section");
        const requestType = requireNonEmpty(form.requestType.value, "Request type");
        const details = requireNonEmpty(form.details.value, "Details");
        const priority = requireNonEmpty(form.priority.value, "Priority");

        let dueDate = null;
        if (form.dueDate.value) {
          const d = new Date(form.dueDate.value + "T00:00:00");
          if (!Number.isNaN(d.getTime())) dueDate = Timestamp.fromDate(d);
        }

        const files = Array.from(form.files.files || []);
        renderNotice(state, { type: "info", title: "Submitting…", message: files.length ? "Uploading files and saving request." : "Saving request." });

        await createContentRequest(
          {
            clientId: profile.clientId,
            createdByUid: profile.uid,
            data: { projectName, pageOrSection, requestType, details, priority, dueDate },
            files,
          },
          {
            onProgress: ({ fileName, percent }) => setProgress({ fileName, percent }),
          }
        );

        renderNotice(state, { type: "ok", title: "Submitted", message: "Your request has been received." });
        form.reset();
        clearProgress();
        await loadList(profile.clientId, profile.uid);
      } catch (err) {
        renderNotice(state, {
          type: "error",
          title: "Could not submit request",
          message: friendlyErrorMessage(err) || "Please check the form and try again.",
        });
      } finally {
        submitBtn.disabled = false;
      }
    });
  },
});
