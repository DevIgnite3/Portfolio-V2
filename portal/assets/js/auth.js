import { getFirebase } from "./firebase.js";

let userProfileCache = null;

export async function onAuthState(callback) {
  const { auth, mod } = await getFirebase();
  const { onAuthStateChanged } = mod.authMod;
  return onAuthStateChanged(auth, callback);
}

export async function signIn(email, password) {
  const { auth, mod } = await getFirebase();
  const { signInWithEmailAndPassword } = mod.authMod;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  userProfileCache = null;
  return cred.user;
}

export async function sendResetEmail(email) {
  const { auth, mod } = await getFirebase();
  const { sendPasswordResetEmail } = mod.authMod;
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  const { auth, mod } = await getFirebase();
  const { signOut } = mod.authMod;
  userProfileCache = null;
  return signOut(auth);
}

export async function getCurrentUser() {
  const { auth } = await getFirebase();
  return auth.currentUser;
}

export async function loadUserProfile(force = false) {
  if (!force && userProfileCache) return userProfileCache;

  const { auth, db, mod } = await getFirebase();
  const { doc, getDoc } = mod.fsMod;

  const user = auth.currentUser;
  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.exists() ? snap.data() : null;

  userProfileCache = data
    ? {
        uid: user.uid,
        email: user.email ?? data.email ?? "",
        displayName: data.displayName ?? user.displayName ?? "",
        role: data.role ?? "client",
        clientId: data.clientId ?? "",
      }
    : {
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        role: "client",
        clientId: "",
      };

  return userProfileCache;
}

export async function requireRole(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "not_authenticated" };

  const profile = await loadUserProfile();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!profile?.role || !roles.includes(profile.role)) {
    return { ok: false, reason: "wrong_role", profile };
  }
  return { ok: true, profile };
}
