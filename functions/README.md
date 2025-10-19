# Cloud Functions (local testing)

This folder contains a callable Cloud Function `approveDeposit` which should be used by admins to approve deposit requests.

Setup
1. Install dependencies:

```powershell
cd functions
npm install
```

2. Install Firebase CLI and initialize emulators (if not already):

```powershell
npm install -g firebase-tools
firebase login
firebase init emulators functions firestore
```

Run emulators

```powershell
cd functions
npm run start
```

Call the function from the client (example using firebase v9 compat):

```javascript
// client: ensure user is signed in as admin and has custom claim or users/{uid}.role == 'admin'
const approveDeposit = firebase.functions().httpsCallable('approveDeposit');
approveDeposit({ depositId: 'DEPOSIT_DOC_ID' })
  .then(res => console.log('approved', res.data))
  .catch(err => console.error('approve failed', err));
```

Security note
- The function double-checks admin status by reading `users/{uid}` and also checks custom claims if available. Use server-side checks and least privilege for admin accounts.
