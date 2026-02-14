# DevIgnite Portfolio v2

## Portal setup

This repo includes a self-contained, static Firebase-backed client portal under `/portal/`.

### 1) Create Firebase config

- Copy `/portal/assets/js/config.example.js` to `/portal/assets/js/config.js`
- Fill in your Firebase project settings:
  - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`

Important:
- Do **not** commit `config.js` (it is ignored via `/portal/.gitignore`).

### 2) Deploy the admin Cloud Function (required for “Create client”)

The admin portal can create new clients + username/password accounts via a Firebase **Callable Cloud Function** (Admin SDK). This is required because a static client app cannot securely create other users in Firebase Auth.

- Function source: `/functions/index.js`

Typical flow (from repo root):
- `npm i -g firebase-tools`
- `firebase login`
- `firebase init functions` (if not already initialized for this repo)
- `cd functions`
- `npm install`
- `firebase deploy --only functions`

After deploy, admins can use:
- `/portal/admin/clients-create.html`

### 3) Enable Firebase services

In the Firebase console for your project:
- Enable **Authentication** → Email/Password provider
- Enable **Firestore**
- Enable **Storage**

### 4) Deploy security rules (required)

Apply these rules in Firebase:
- Firestore rules: `/firebase/firestore.rules`
- Storage rules: `/firebase/storage.rules`

These rules enforce:
- Users can read their own `users/{uid}` doc
- Clients can only read/write their own data
- Admins can read/write everything

### 5) Create an admin user

1. Create a user in Firebase Auth (email/password)
2. In Firestore, create/update:

- `users/{uid}`
  - `role`: `"admin"`
  - `email`: (optional)
  - `displayName`: (optional)

Then sign in at `/portal/admin/login.html`.

### 6) Create a client and link a user

You can still do this manually (Firestore + Auth), but admins can also use the UI:
- `/portal/admin/clients-create.html`

1. Create a client doc:

- `clients/{clientId}`
  - `name`: string
  - `primaryEmail`: string
  - `createdAt`: server timestamp (optional)

2. Create a user in Firebase Auth (email/password)
3. Link the user to the client:

- `users/{uid}`
  - `role`: `"client"`
  - `clientId`: `"{clientId}"`

Then sign in at `/portal/login.html`.

### 7) Data model (Firestore)

- `users/{uid}`
  - `role`: `"client" | "admin"`
  - `clientId`: string (for clients)
  - `email`, `displayName` (optional)

- `clients/{clientId}`
  - `name`, `primaryEmail`, `createdAt`

- `clients/{clientId}/contentRequests/{requestId}`
  - `projectName`, `pageOrSection`, `requestType`, `details`, `priority`, `dueDate`
  - `fileRefs`: `[{path, name, contentType, size}]`
  - `status`, `adminNotes`, `clientNotes`
  - `createdAt`, `updatedAt`, `createdByUid`, `clientId`

- `clients/{clientId}/invoices/{invoiceId}`
  - `invoiceNumber`, `date`, `amount`, `currency`, `status`
  - `pdfPath`
  - `createdAt`, `createdByUid`

- `clients/{clientId}/contracts/{contractId}`
  - `title`, `status (active/superseded)`, `pdfPath`
  - `createdAt`, `createdByUid`

### 8) Storage paths

- `/client-content/{clientId}/{requestId}/{filename}`
- `/invoices/{clientId}/{invoiceId}.pdf`
- `/contracts/{clientId}/{contractId}.pdf`

### 9) Local testing

Because this is a static site, you can serve it with any static server.
For example (PowerShell):

- `python -m http.server 8080`

Then open:
- `http://localhost:8080/portal/`

If you see a “Portal setup required” message, your `config.js` is missing or incomplete.
