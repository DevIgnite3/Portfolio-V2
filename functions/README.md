# DevIgnite Portal Cloud Functions

This folder contains Firebase Cloud Functions used by the portal.

## Deploy

1) Install Firebase CLI (once):
- `npm i -g firebase-tools`

2) Login:
- `firebase login`

3) Init functions (if your Firebase project is not initialized in this repo yet):
- `firebase init functions`

When prompted:
- Choose JavaScript
- Use existing `functions` folder (this one)
- Node 20 runtime

4) Install deps:
- `cd functions`
- `npm install`

5) Deploy functions:
- `firebase deploy --only functions`

## Function(s)

- `createClientAndUser` (callable)
  - Requires caller to be authenticated and have `users/{uid}.role == "admin"`
  - Creates:
    - `clients/{clientId}`
    - Firebase Auth user (email/password)
    - `users/{newUid}` with `{ role: "client", clientId }`
