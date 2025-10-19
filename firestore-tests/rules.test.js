const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const { expect } = require('chai');

const PROJECT_ID = 'tournamnt-test';
let testEnv;

describe('Firestore security rules', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: fs.readFileSync('../firestore.rules', 'utf8') }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('allows email-verified user to create a deposit (pending)', async () => {
    const alice = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com', email_verified: true });
    const db = alice.firestore();

    const depositRef = db.collection('deposits').doc('d1');
    await assertSucceeds(depositRef.set({
      userId: 'alice-uid',
      email: 'alice@example.com',
      amount: 1000,
      status: 'pending'
    }));
  });

  it('denies unverified user from creating deposit', async () => {
    const bob = testEnv.authenticatedContext('bob-uid', { email: 'bob@example.com', email_verified: false });
    const db = bob.firestore();
    const depositRef = db.collection('deposits').doc('d2');

    await assertFails(depositRef.set({
      userId: 'bob-uid',
      email: 'bob@example.com',
      amount: 500,
      status: 'pending'
    }));
  });

  it('prevents regular user from updating wallet summary', async () => {
    const alice = testEnv.authenticatedContext('alice-uid', { email: 'alice@example.com', email_verified: true });
    const db = alice.firestore();

    const walletRef = db.collection('wallets').doc('alice-uid');
    await assertFails(walletRef.set({ balance: 100000 }));
  });

  it('allows admin to update deposit status to approved', async () => {
    // create initial deposit by alice as pending in the admin context (emulator admin)
    const admin = testEnv.unauthenticatedContext().firestore();
    await admin.collection('deposits').doc('d3').set({ userId: 'alice-uid', email: 'alice@example.com', amount: 250, status: 'pending' });

    // admin auth context: user with role admin in users collection
    const adminCtx = testEnv.authenticatedContext('admin-uid', { email: 'admin@example.com', email_verified: true });
    const adminDb = adminCtx.firestore();

    // set admin user doc (simulate admin role present)
    await admin.collection('users').doc('admin-uid').set({ role: 'admin', email: 'admin@example.com' });

    const depositRef = adminDb.collection('deposits').doc('d3');
    await assertSucceeds(depositRef.update({ status: 'approved' }));
  });
});
