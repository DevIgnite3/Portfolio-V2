const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

function requireAuthed(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  return request.auth.uid;
}

async function requireAdminUid(uid) {
  const db = admin.firestore();
  const snap = await db.doc(`users/${uid}`).get();
  const role = snap.exists ? snap.data().role : null;
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

function cleanString(v) {
  return (v ?? "").toString().trim();
}

exports.createClientAndUser = onCall(
  {
    region: process.env.FUNCTIONS_REGION || "us-central1",
    // CORS is not a security boundary; auth + role checks below are.
    cors: true,
  },
  async (request) => {
    const uid = requireAuthed(request);
    await requireAdminUid(uid);

    const input = request.data || {};
    const clientId = cleanString(input.clientId);
    const clientName = cleanString(input.clientName);
    const primaryEmail = cleanString(input.primaryEmail);
    const userEmail = cleanString(input.userEmail);
    const password = cleanString(input.password);

    if (!clientId) throw new HttpsError("invalid-argument", "clientId is required.");
    if (!clientName) throw new HttpsError("invalid-argument", "clientName is required.");
    if (!userEmail) throw new HttpsError("invalid-argument", "userEmail is required.");
    if (!password || password.length < 8) {
      throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
    }

    const db = admin.firestore();
    const auth = admin.auth();

    const clientRef = db.doc(`clients/${clientId}`);
    const existingClient = await clientRef.get();
    if (existingClient.exists) {
      throw new HttpsError("already-exists", `Client '${clientId}' already exists.`);
    }

    // Ensure email not already used
    try {
      await auth.getUserByEmail(userEmail);
      throw new HttpsError("already-exists", "That email is already in use.");
    } catch (err) {
      if (err && err.code && err.code !== "auth/user-not-found") throw err;
    }

    const userRecord = await auth.createUser({
      email: userEmail,
      password,
      disabled: false,
    });

    // Add custom claims so security rules can use token-based role checks.
    await auth.setCustomUserClaims(userRecord.uid, { role: "client", clientId });

    const batch = db.batch();
    batch.set(clientRef, {
      name: clientName,
      primaryEmail: primaryEmail || userEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(db.doc(`users/${userRecord.uid}`), {
      role: "client",
      clientId,
      email: userEmail,
      displayName: "",
    });

    await batch.commit();

    return { ok: true, uid: userRecord.uid, clientId };
  }
);

exports.syncMyClaims = onCall(
  {
    region: process.env.FUNCTIONS_REGION || "us-central1",
    cors: true,
  },
  async (request) => {
    const uid = requireAuthed(request);

    const db = admin.firestore();
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) {
      throw new HttpsError("failed-precondition", "User profile doc users/{uid} does not exist.");
    }

    const data = snap.data() || {};
    const role = data.role || "client";
    const clientId = data.clientId || null;

    const auth = admin.auth();
    await auth.setCustomUserClaims(uid, { role, clientId });

    return { ok: true, role, clientId };
  }
);

/**
 * getFileUrl – callable function that returns a signed download URL for a
 * Storage file after verifying the caller has permission.
 *
 * Admins can access any file.  Clients can only access files whose path
 * starts with their own clientId segment (invoices/{clientId}/…,
 * contracts/{clientId}/…, client-content/{clientId}/…).
 *
 * Uses the Admin SDK so Storage security rules are bypassed entirely –
 * only this server-side check matters.
 */
exports.getFileUrl = onCall(
  {
    region: process.env.FUNCTIONS_REGION || "us-central1",
    cors: true,
  },
  async (request) => {
    const uid = requireAuthed(request);

    const storagePath = cleanString((request.data || {}).storagePath);
    if (!storagePath) {
      throw new HttpsError("invalid-argument", "storagePath is required.");
    }

    // Look up the caller's role + clientId
    const db = admin.firestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      throw new HttpsError("permission-denied", "No user profile found.");
    }
    const userData = userSnap.data() || {};
    const role = userData.role;
    const userClientId = userData.clientId;

    if (role === "admin") {
      // admins can access anything
    } else if (role === "client" && userClientId) {
      // clients may only access paths that contain their clientId
      // e.g. invoices/{clientId}/file.pdf  or  contracts/{clientId}/file.pdf
      const segments = storagePath.split("/");
      // The clientId is always the second segment: collection/clientId/...
      if (segments.length < 2 || segments[1] !== userClientId) {
        throw new HttpsError("permission-denied", "You do not have access to this file.");
      }
    } else {
      throw new HttpsError("permission-denied", "Access denied.");
    }

    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    // Check the file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError("not-found", "File not found in storage.");
    }

    // Generate a signed URL valid for 15 minutes
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000, // 15 min
    });

    return { url: signedUrl };
  }
);
