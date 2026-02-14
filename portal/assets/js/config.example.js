// Copy this file to config.js and fill in your Firebase project settings.
// IMPORTANT: Do not commit config.js (it's ignored by /portal/.gitignore).

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const portalConfig = {
  // Used for display only
  siteName: "DevIgnite Client Portal",
  supportEmail: "support@devignite.co.za",
  // Currency default for invoices UI
  defaultCurrency: "ZAR",
  // Cloud Functions region used by admin features (callable)
  functionsRegion: "us-central1",
};
