import { getFirebase } from "./firebase.js";

function nowTs(fsMod) {
  const { serverTimestamp } = fsMod;
  return serverTimestamp();
}

export async function getClientDoc(clientId) {
  const { db, mod } = await getFirebase();
  const { doc, getDoc } = mod.fsMod;
  const snap = await getDoc(doc(db, "clients", clientId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createContentRequest({ clientId, createdByUid, data, files = [] }, { onProgress } = {}) {
  const { db, storage, mod } = await getFirebase();
  const {
    collection,
    doc,
    setDoc,
  } = mod.fsMod;
  const { ref, uploadBytesResumable, getMetadata } = mod.stMod;

  const requestsCol = collection(db, "clients", clientId, "contentRequests");
  const reqRef = doc(requestsCol);

  const uploadedRefs = [];
  for (const file of files) {
    const path = `client-content/${clientId}/${reqRef.id}/${file.name}`;
    const r = ref(storage, path);

    const task = uploadBytesResumable(r, file, {
      contentType: file.type || undefined,
      customMetadata: {
        clientId,
        requestId: reqRef.id,
      },
    });

    await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          if (onProgress) {
            const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
            onProgress({ fileName: file.name, percent: pct });
          }
        },
        reject,
        resolve
      );
    });

    const meta = await getMetadata(task.snapshot.ref);
    uploadedRefs.push({
      path,
      name: file.name,
      contentType: meta.contentType ?? file.type ?? "",
      size: meta.size ?? file.size ?? 0,
    });
  }

  const base = {
    clientId,
    projectName: data.projectName,
    pageOrSection: data.pageOrSection,
    requestType: data.requestType,
    details: data.details,
    priority: data.priority,
    dueDate: data.dueDate ?? null,
    fileRefs: uploadedRefs,
    status: "submitted",
    adminNotes: "",
    clientNotes: data.clientNotes ?? "",
    createdAt: nowTs(mod.fsMod),
    updatedAt: nowTs(mod.fsMod),
    createdByUid,
  };

  await setDoc(reqRef, base);

  return { id: reqRef.id, ...base };
}

export async function listClientContentRequests(clientId, createdByUid, { limitCount = 25 } = {}) {
  const { db, mod } = await getFirebase();
  const { collection, query, where, orderBy, limit, getDocs } = mod.fsMod;

  const q = query(
    collection(db, "clients", clientId, "contentRequests"),
    where("createdByUid", "==", createdByUid),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listClientInvoices(clientId, { limitCount = 50 } = {}) {
  const { db, mod } = await getFirebase();
  const { collection, query, orderBy, limit, getDocs } = mod.fsMod;
  const q = query(collection(db, "clients", clientId, "invoices"), orderBy("date", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listClientContracts(clientId, { limitCount = 50 } = {}) {
  const { db, mod } = await getFirebase();
  const { collection, query, orderBy, limit, getDocs } = mod.fsMod;
  const q = query(collection(db, "clients", clientId, "contracts"), orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFileDownloadUrl(storagePath) {
  // Use the server-side getFileUrl callable function which bypasses
  // Storage security rules and does its own Firestore-based permission check.
  const { functions, mod } = await getFirebase();
  const { httpsCallable } = mod.fnMod;
  const call = httpsCallable(functions, "getFileUrl");
  const res = await call({ storagePath });
  return res.data.url;
}

// -------------------- Admin --------------------

export async function adminListClients({ limitCount = 200 } = {}) {
  const { db, mod } = await getFirebase();
  const { collection, query, orderBy, limit, getDocs } = mod.fsMod;
  const q = query(collection(db, "clients"), orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminListRecentContentRequests({ status = "", clientId = "", limitCount = 60 } = {}) {
  const { db, mod } = await getFirebase();
  const { collectionGroup, query, where, orderBy, limit, getDocs } = mod.fsMod;

  const clauses = [collectionGroup(db, "contentRequests")];
  if (status) clauses.push(where("status", "==", status));
  if (clientId) clauses.push(where("clientId", "==", clientId));

  // Keep ordering last to reduce index headaches when filters are empty.
  clauses.push(orderBy("createdAt", "desc"));
  clauses.push(limit(limitCount));

  const q = query(...clauses);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, path: d.ref.path, ...d.data() }));
}

export async function adminUpdateContentRequest({ clientId, requestId, patch }) {
  const { db, mod } = await getFirebase();
  const { doc, updateDoc } = mod.fsMod;
  const ref = doc(db, "clients", clientId, "contentRequests", requestId);
  await updateDoc(ref, { ...patch, updatedAt: nowTs(mod.fsMod) });
}

export async function adminCreateInvoice({ clientId, createdByUid, invoice, pdfFile }, { onProgress } = {}) {
  const { db, storage, mod } = await getFirebase();
  const { collection, doc, setDoc } = mod.fsMod;
  const { ref, uploadBytesResumable, getMetadata, getDownloadURL } = mod.stMod;

  const invoicesCol = collection(db, "clients", clientId, "invoices");
  const invRef = doc(invoicesCol);
  const pdfPath = `invoices/${clientId}/${invRef.id}.pdf`;

  if (!pdfFile) throw new Error("Invoice PDF is required.");

  const storageRef = ref(storage, pdfPath);
  const task = uploadBytesResumable(storageRef, pdfFile, {
    contentType: pdfFile.type || "application/pdf",
    customMetadata: { clientId, invoiceId: invRef.id },
  });

  await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress) {
          const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          onProgress({ percent: pct });
        }
      },
      reject,
      resolve
    );
  });

  const meta = await getMetadata(task.snapshot.ref);
  // Save the download URL so clients can access the file without Storage rule checks
  const pdfUrl = await getDownloadURL(storageRef);

  await setDoc(invRef, {
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
    pdfPath,
    pdfUrl,
    pdfMeta: {
      size: meta.size ?? pdfFile.size ?? 0,
      contentType: meta.contentType ?? "application/pdf",
      name: pdfFile.name,
    },
    createdAt: nowTs(mod.fsMod),
    createdByUid,
  });

  return { id: invRef.id, pdfPath, pdfUrl };
}

export async function adminUploadContract({ clientId, createdByUid, title, status, pdfFile, supersedeOthers = false }) {
  const { db, storage, mod } = await getFirebase();
  const { collection, doc, setDoc, query, where, getDocs, writeBatch } = mod.fsMod;
  const { ref, uploadBytes, getDownloadURL } = mod.stMod;

  if (!pdfFile) throw new Error("Contract PDF is required.");
  const contractsCol = collection(db, "clients", clientId, "contracts");
  const cRef = doc(contractsCol);
  const pdfPath = `contracts/${clientId}/${cRef.id}.pdf`;

  const storageRef = ref(storage, pdfPath);
  await uploadBytes(storageRef, pdfFile, { contentType: pdfFile.type || "application/pdf" });
  // Save the download URL so clients can access the file without Storage rule checks
  const pdfUrl = await getDownloadURL(storageRef);

  const batch = writeBatch(db);
  batch.set(cRef, {
    title,
    status,
    pdfPath,
    pdfUrl,
    createdAt: nowTs(mod.fsMod),
    createdByUid,
  });

  if (supersedeOthers && status === "active") {
    const q = query(contractsCol, where("status", "==", "active"));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      if (d.id !== cRef.id) batch.update(d.ref, { status: "superseded" });
    });
  }

  await batch.commit();
  return { id: cRef.id, pdfPath, pdfUrl };
}

/**
 * One-time backfill: for every invoice / contract that has pdfPath but no pdfUrl,
 * resolve the download URL and write it back to Firestore.
 * Call from the browser console while signed in as admin.
 */
export async function adminBackfillPdfUrls() {
  const { db, storage, mod } = await getFirebase();
  const { collectionGroup, getDocs, writeBatch, query } = mod.fsMod;
  const { ref, getDownloadURL } = mod.stMod;

  let updated = 0;
  for (const colName of ["invoices", "contracts"]) {
    const snap = await getDocs(query(collectionGroup(db, colName)));
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      const data = d.data();
      if (data.pdfPath && !data.pdfUrl) {
        try {
          const url = await getDownloadURL(ref(storage, data.pdfPath));
          batch.update(d.ref, { pdfUrl: url });
          updated++;
        } catch (err) {
          console.warn(`Skipped ${d.ref.path}: ${err.message}`);
        }
      }
    }
    await batch.commit();
  }
  console.log(`Backfilled pdfUrl on ${updated} document(s).`);
  return updated;
}

export async function adminStats() {
  const { db, mod } = await getFirebase();
  const { collectionGroup, query, where, getCountFromServer, Timestamp } = mod.fsMod;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const newReqCount = await getCountFromServer(
    query(collectionGroup(db, "contentRequests"), where("status", "==", "submitted"))
  );

  const invoicesThisMonth = await getCountFromServer(
    query(collectionGroup(db, "invoices"), where("date", ">=", Timestamp.fromDate(startOfMonth)))
  );

  return {
    newRequests: newReqCount.data().count,
    invoicesThisMonth: invoicesThisMonth.data().count,
  };
}

export async function adminCreateClientAndUser({ clientId, clientName, primaryEmail = "", userEmail, password }) {
  const { functions, mod } = await getFirebase();
  const { httpsCallable } = mod.fnMod;

  const call = httpsCallable(functions, "createClientAndUser");
  const res = await call({ clientId, clientName, primaryEmail, userEmail, password });
  return res.data;
}

export async function syncMyClaims() {
  const { functions, mod } = await getFirebase();
  const { httpsCallable } = mod.fnMod;
  const call = httpsCallable(functions, "syncMyClaims");
  const res = await call({});
  return res.data;
}
