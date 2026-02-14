// Firebase v9+ modular SDK via ES modules (CDN)
// This file dynamically loads /portal/assets/js/config.js so secrets are not committed.

import { toast } from "./ui.js";

const firebaseCdnBase = "https://www.gstatic.com/firebasejs/10.12.5";

async function loadPortalConfig() {
  try {
    // config.js is intentionally not in git; copy from config.example.js
    const mod = await import("./config.js");
    if (!mod?.firebaseConfig) throw new Error("config.js found but firebaseConfig is missing.");
    return mod;
  } catch (err) {
    const message =
      "Portal config missing. Create /portal/assets/js/config.js from config.example.js and fill in firebaseConfig.";
    toast({ title: "Portal setup required", message, type: "error", timeoutMs: 9000 });
    throw err;
  }
}

let cached = null;

export async function getFirebase() {
  if (cached) return cached;

  const [{ firebaseConfig, portalConfig }, appMod, authMod, fsMod, stMod, fnMod] = await Promise.all([
    loadPortalConfig(),
    import(`${firebaseCdnBase}/firebase-app.js`),
    import(`${firebaseCdnBase}/firebase-auth.js`),
    import(`${firebaseCdnBase}/firebase-firestore.js`),
    import(`${firebaseCdnBase}/firebase-storage.js`),
    import(`${firebaseCdnBase}/firebase-functions.js`),
  ]);

  const { initializeApp } = appMod;
  const { getAuth } = authMod;
  const { getFirestore } = fsMod;
  const { getStorage } = stMod;
  const { getFunctions } = fnMod;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, portalConfig?.functionsRegion || undefined);

  cached = {
    portalConfig: portalConfig ?? {},
    firebaseConfig,
    app,
    auth,
    db,
    storage,
    functions,
    // Re-export modules to avoid re-import churn in callers
    mod: { authMod, fsMod, stMod, fnMod },
  };

  return cached;
}
