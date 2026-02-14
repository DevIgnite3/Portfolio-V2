import { guardPage, getReturnTo, redirect } from "./router-guard.js";
import { signIn, loadUserProfile } from "./auth.js";
import { renderNotice, requireNonEmpty } from "./ui.js";
import { syncMyClaims } from "./db.js";

const state = document.getElementById("state");
const form = document.getElementById("form");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const submitBtn = document.getElementById("submit");

function setLoading(isLoading, message = "") {
  submitBtn.disabled = isLoading;
  renderNotice(state, isLoading
    ? { type: "info", title: "Signing in…", message: message || "Please wait." }
    : { type: "info", title: "", message: "" }
  );
  if (!isLoading) state.innerHTML = "";
}

await guardPage({
  requireAuth: false,
  onReady: () => {
    // page is ready
  },
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const email = requireNonEmpty(emailEl.value, "Email");
    const password = requireNonEmpty(passwordEl.value, "Password");

    setLoading(true);
    const user = await signIn(email, password);
    await syncMyClaims();
    await user.getIdToken(true);
    const profile = await loadUserProfile(true);

    // If an admin signs in here, route them to the admin portal.
    if (profile?.role === "admin") {
      redirect("/portal/admin/dashboard.html");
      return;
    }

    const returnTo = getReturnTo();
    if (returnTo && returnTo.startsWith("/portal/") && !returnTo.startsWith("/portal/admin/")) {
      redirect(returnTo);
      return;
    }

    redirect("/portal/dashboard.html");
  } catch (err) {
    renderNotice(state, {
      type: "error",
      title: "Login failed",
      message: err?.message || "Please check your email and password and try again.",
    });
  } finally {
    submitBtn.disabled = false;
  }
});
