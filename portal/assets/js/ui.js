const toastRootId = "portal-toast";

function ensureToastRoot() {
  let root = document.getElementById(toastRootId);
  if (!root) {
    root = document.createElement("div");
    root.id = toastRootId;
    root.className = "toast";
    document.body.appendChild(root);
  }
  return root;
}

export function setText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}

export function show(el) {
  if (!el) return;
  el.hidden = false;
}

export function hide(el) {
  if (!el) return;
  el.hidden = true;
}

export function renderNotice(container, { type = "info", title, message }) {
  if (!container) return;
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = `notice ${type === "error" ? "err" : type === "ok" ? "ok" : ""}`;
  const strong = document.createElement("strong");
  strong.textContent = title ?? (type === "error" ? "Something went wrong" : "Notice");
  const p = document.createElement("div");
  p.className = "small";
  p.textContent = message ?? "";
  div.appendChild(strong);
  div.appendChild(p);
  container.appendChild(div);
}

export function toast({ title, message, type = "info", timeoutMs = 4500 }) {
  const root = ensureToastRoot();
  const item = document.createElement("div");
  item.className = "item";
  item.style.borderColor =
    type === "error"
      ? "rgba(255,107,107,.35)"
      : type === "ok"
        ? "rgba(49,196,141,.35)"
        : "rgba(231,238,252,.14)";

  const strong = document.createElement("strong");
  strong.textContent = title ?? "";
  const body = document.createElement("div");
  body.className = "small";
  body.textContent = message ?? "";

  item.appendChild(strong);
  item.appendChild(body);
  root.appendChild(item);

  window.setTimeout(() => {
    item.remove();
  }, timeoutMs);
}

export function fmtDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : value.toDate?.() ?? new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function fmtMoney(amount, currency = "ZAR") {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function requireNonEmpty(value, fieldLabel) {
  const v = (value ?? "").toString().trim();
  if (!v) throw new Error(`${fieldLabel} is required.`);
  return v;
}

export function friendlyErrorMessage(err) {
  const code = err?.code || err?.name || "";
  const msg = err?.message || "";

  if (code === "permission-denied" || msg.toLowerCase().includes("missing or insufficient permissions")) {
    return (
      "Missing or insufficient permissions. " +
      "Check that Firestore/Storage rules are deployed, and that your user document exists in Firestore (users/{uid}) with the correct role/clientId."
    );
  }

  return msg || "Something went wrong. Please try again.";
}
