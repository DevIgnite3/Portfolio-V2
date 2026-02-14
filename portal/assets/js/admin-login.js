import { guardPage, getReturnTo, redirect } from "./router-guard.js";
import { signIn, loadUserProfile, logout } from "./auth.js";
import { renderNotice, requireNonEmpty } from "./ui.js";
import { syncMyClaims } from "./db.js";

const state = document.getElementById("state");
const form = document.getElementById("form");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const submitBtn = document.getElementById("submit");

await guardPage({ requireAuth: false });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  renderNotice(state, { type: "info", title: "Signing in…", message: "Please wait." });

  try {
    const email = requireNonEmpty(emailEl.value, "Email");
    const password = requireNonEmpty(passwordEl.value, "Password");

    const user = await signIn(email, password);
    await syncMyClaims();
    await user.getIdToken(true);
    const profile = await loadUserProfile(true);

    if (profile?.role !== "admin") {
      await logout();
      renderNotice(state, {
        type: "error",
        title: "Access denied",
        message: "This account is not an admin. If you believe this is a mistake, set users/{uid}.role = 'admin'.",
      });
      return;
    }

    const returnTo = getReturnTo();
    if (returnTo && returnTo.startsWith("/portal/admin/")) {
      redirect(returnTo);
      return;
    }

    redirect("/portal/admin/dashboard.html");
  } catch (err) {
    renderNotice(state, {
      type: "error",
      title: "Login failed",
      message: err?.message || "Please check your credentials and try again.",
    });
  } finally {
    submitBtn.disabled = false;
  }
});
