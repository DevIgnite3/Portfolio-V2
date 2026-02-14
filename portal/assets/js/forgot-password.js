import { guardPage } from "./router-guard.js";
import { sendResetEmail } from "./auth.js";
import { renderNotice, requireNonEmpty } from "./ui.js";

const state = document.getElementById("state");
const form = document.getElementById("form");
const emailEl = document.getElementById("email");
const submitBtn = document.getElementById("submit");

await guardPage({ requireAuth: false });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  renderNotice(state, { type: "info", title: "Sending…", message: "Please wait." });

  try {
    const email = requireNonEmpty(emailEl.value, "Email");
    await sendResetEmail(email);
    renderNotice(state, {
      type: "ok",
      title: "Email sent",
      message: "If the address is registered, you’ll receive a reset link shortly.",
    });
  } catch (err) {
    renderNotice(state, {
      type: "error",
      title: "Could not send reset email",
      message: err?.message || "Please try again in a moment.",
    });
  } finally {
    submitBtn.disabled = false;
  }
});
