const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Helper: check admin role (from users collection). Prefer custom claims if available.
async function isCallerAdmin(uid) {
  try {
    // Check custom claims first
    const user = await admin.auth().getUser(uid);
    if (user.customClaims && user.customClaims.admin === true) return true;
  } catch (e) {
    console.warn('Unable to read custom claims for', uid, e.message);
  }

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const role = userDoc.data().role;
      return role === 'admin';
    }
  } catch (e) {
    console.warn('Unable to read users doc for', uid, e.message);
  }

  return false;
}

exports.approveDeposit = functions.https.onCall(async (data, context) => {
  // data: { depositId }
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Request has no auth context');
  }
  const callerUid = context.auth.uid;
  const depositId = data && data.depositId;
  if (!depositId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing depositId');
  }

  // Verify caller is admin
  const allowed = await isCallerAdmin(callerUid);
  if (!allowed) {
    throw new functions.https.HttpsError('permission-denied', 'Must be an admin to approve deposits');
  }

  // Approve deposit in a transaction and update wallet
  const depositRef = db.collection('deposits').doc(depositId);

  return db.runTransaction(async (tx) => {
    const depositSnap = await tx.get(depositRef);
    if (!depositSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Deposit not found');
    }

    const deposit = depositSnap.data();
    if (deposit.status === 'approved') {
      return { ok: true, message: 'Deposit already approved' };
    }

    if (deposit.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Deposit not in pending state');
    }

    const userId = deposit.userId;
    const amount = Number(deposit.amount || 0);
    if (amount <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Deposit amount invalid');
    }

    // Update deposit status
    tx.update(depositRef, {
      status: 'approved',
      approvedBy: callerUid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update wallet summary (create if missing) and add transaction
    const walletRef = db.collection('wallets').doc(userId);
    tx.set(walletRef, {
      balance: admin.firestore.FieldValue.increment(amount),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const txRef = walletRef.collection('transactions').doc();
    tx.set(txRef, {
      userId,
      amount,
      type: 'deposit',
      status: 'approved',
      depositId,
      description: 'Deposit approved by admin',
      date: admin.firestore.FieldValue.serverTimestamp()
    });

    // Write admin log
    const logRef = db.collection('adminLogs').doc();
    tx.set(logRef, {
      action: 'approve_deposit',
      adminUid: callerUid,
      depositId,
      userId,
      amount,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { ok: true };
  });
});
