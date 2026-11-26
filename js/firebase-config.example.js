/* Accounts & cross-device sync (js/account.js) use Firebase.
 * 1. Create a project at https://console.firebase.google.com  (free "Spark" plan is enough).
 * 2. Authentication › Sign-in method › enable "Email/Password".
 * 3. Firestore Database › Create database (production mode), then paste the rules from firestore.rules into its Rules tab.
 * 4. Project settings › Your apps › add a Web app, and copy its config into js/firebase-config.local.js like this,
 *    then deploy that file as js/firebase-config.js (replacing the placeholder).
 *
 * js/firebase-config.local.js is in .gitignore. (A Firebase web config is meant to be public, since browsers need it; the
 * security comes from the Firestore rules, which only let each signed-in account read and write its own saves.)
 */
window.RL_FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
};
