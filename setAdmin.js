/**
 * setAdmin.js
 *
 * One‑time script to assign the "admin" custom claim
 * to a Firebase Authentication user.
 *
 * Steps:
 *   1. npm init -y
 *   2. npm install firebase-admin
 *   3. Download your service account key JSON from
 *      Firebase Console → Project Settings → Service Accounts
 *      Save it as serviceAccountKey.json in this folder.
 *   4. Replace YOUR_UID_HERE with your Firebase Auth UID
 *   5. Run: node setAdmin.js
 */

const admin = require("firebase-admin");

// Load service account key
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Function to set admin claim
async function setAdmin() {
  try {
    const uid = "n61S7xnh8dSXSyNeiL8k29ZdBWG3"; // 🔑 Replace with your Firebase Auth UID
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`✅ Admin claim set for UID: ${uid}`);
    console.log("Now sign out and sign back in with this account to refresh the claim.");
  } catch (err) {
    console.error("❌ Error setting admin claim:", err);
  }
}

setAdmin();
