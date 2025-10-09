// save as setAdmin.js and run with: node setAdmin.js
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

async function setAdmin() {
  const uid = "n61S7xnh8dSXSyNeiL8k29ZdBWG3"; // find this in Firebase Console → Authentication → Users
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  console.log("✅ Admin claim set for UID:", uid);
}
setAdmin();
      return;
