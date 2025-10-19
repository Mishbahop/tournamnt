# Firestore Rules Tests

This folder contains unit tests for Firestore security rules using the Firebase Rules Unit Testing SDK.

Prerequisites
- Node.js 16+ (recommended)
- npm

Install dev dependencies:

```powershell
cd firestore-tests
npm install
```

Run tests (this will start the emulator automatically):

```powershell
npm test
```

Notes
- Tests read the `../firestore.rules` file from the repository root. Ensure the rules file exists and is the version you want to test.
- The tests use the rules-unit-testing library and run against an in-memory emulator; they do not modify your production project.
