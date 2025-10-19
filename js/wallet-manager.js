// Wallet Management Functions
const WalletManager = {
    // Initialize a user's wallet
    async initializeWallet(userId, email) {
        try {
            const walletRef = firebase.firestore().collection('wallets').doc(userId);
            const walletDoc = await walletRef.get();

            if (!walletDoc.exists) {
                await walletRef.set({
                    balance: 1000, // Initial balance for new users
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: userId,
                    email: email,
                    transactions: []
                });
                return 1000;
            }

            return walletDoc.data().balance;
        } catch (error) {
            console.error('Error initializing wallet:', error);
            throw new Error('Failed to initialize wallet');
        }
    },

    // Get wallet balance
    async getBalance(userId) {
        try {
            const walletDoc = await firebase.firestore()
                .collection('wallets')
                .doc(userId)
                .get();

            if (!walletDoc.exists) {
                throw new Error('Wallet not found');
            }

            return walletDoc.data().balance;
        } catch (error) {
            console.error('Error getting wallet balance:', error);
            throw new Error('Failed to get wallet balance');
        }
    },

    // Process a transaction
    async processTransaction(userId, amount, type, description) {
        try {
            const db = firebase.firestore();
            await db.runTransaction(async (transaction) => {
                const walletRef = db.collection('wallets').doc(userId);
                const walletDoc = await transaction.get(walletRef);

                if (!walletDoc.exists) {
                    throw new Error('Wallet not found');
                }

                const currentBalance = walletDoc.data().balance;
                if (type === 'debit' && currentBalance < amount) {
                    throw new Error('Insufficient balance');
                }

                const newBalance = type === 'debit' 
                    ? currentBalance - amount 
                    : currentBalance + amount;

                const transactionData = {
                    type: type,
                    amount: amount,
                    description: description,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    previousBalance: currentBalance,
                    newBalance: newBalance
                };

                // Update wallet balance
                transaction.update(walletRef, {
                    balance: newBalance,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    transactions: firebase.firestore.FieldValue.arrayUnion(transactionData)
                });

                return newBalance;
            });

            return true;
        } catch (error) {
            console.error('Transaction error:', error);
            throw error;
        }
    },

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    }
};

// Export if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WalletManager;
}