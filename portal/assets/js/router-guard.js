import { onAuthState, loadUserProfile } from "./auth.js";
import { renderNotice } from "./ui.js";

export function redirect(url) {
  window.location.assign(url);
}

export function getReturnTo() {
  const params = new URLSearchParams(window.location.search);
  return params.get("returnTo") || "";
}

export function withReturnTo(url) {
  const u = new URL(url, window.location.origin);
  u.searchParams.set("returnTo", window.location.pathname);
  return u.pathname + u.search;
}

export async function guardPage({ requireAuth = true, role = null, onReady }) {
  // Displays nothing by itself; pages should render their own loading state.
  // This helper only handles redirect decisions.

  try {
    const unsubscribe = await onAuthState(async (user) => {
    if (requireAuth && !user) {
      const login = role === "admin" ? "/portal/admin/login.html" : "/portal/login.html";
      redirect(withReturnTo(login));
      return;
    }

    if (!requireAuth && user) {
      // If already signed in, send them to the correct dashboard.
      const profile = await loadUserProfile();
      if (profile?.role === "admin") redirect("/portal/admin/dashboard.html");
      else redirect("/portal/dashboard.html");
      return;
    }

    if (role) {
      const profile = await loadUserProfile();
      if (!profile?.role) {
        redirect("/portal/login.html");
        return;
      }
      if (profile.role !== role) {
        // If client tries to open admin area (or vice versa), redirect safely.
        redirect(profile.role === "admin" ? "/portal/admin/dashboard.html" : "/portal/dashboard.html");
        return;
      }
    }

      onReady?.(await loadUserProfile());
    });

    return unsubscribe;
  } catch (err) {
    // Most commonly: /portal/assets/js/config.js is missing.
    document.body.innerHTML = `
      <div class="portal-wrap" style="justify-content:center;align-items:center">
        <div class="container" style="max-width:700px">
          <div class="card card--narrow text-center">
            <div class="page-title">
              <h1>Portal Setup Required</h1>
              <p class="subtitle">This portal can't start until Firebase config is provided.</p>
            </div>
            <div id="fatal" style="margin-top:12px"></div>
            <p class="small mt-2">
              Create <strong class="text-accent">/portal/assets/js/config.js</strong> from <strong>config.example.js</strong>, then refresh.
            </p>
            <div class="actions" style="justify-content:center;margin-top:2rem">
              <a href="/portal/index.html"><button type="button" class="btn-secondary">Portal Home</button></a>
              <a href="/"><button type="button" class="btn-secondary">Main Site</button></a>
            </div>
          </div>
        </div>
      </div>
    `;
    const fatal = document.getElementById("fatal");
    renderNotice(fatal, {
      type: "error",
      title: "Initialization failed",
      message: err?.message || "Missing or invalid Firebase configuration.",
    });
    return () => {};
  }
}
