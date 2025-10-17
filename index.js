// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
    authDomain: "authapp-386ee.firebaseapp.com",
    projectId: "authapp-386ee",
    storageBucket: "authapp-386ee.firebasestorage.app",
    messagingSenderId: "809698525310",
    appId: "1:809698525310:web:5cb7de80bde9ed1f26982f",
    measurementId: "G-EJZTSBSGQT"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;

// Check authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        console.log('User signed in:', user.email);
        updateUIForUser(user);
    } else {
        console.log('No user signed in');
        // Still show tournaments but with limited functionality
        updateUIForGuest();
    }
    
    loadLiveTournaments();
});

// Update UI for logged-in user
function updateUIForUser(user) {
    // Update user info if elements exist
    const userInfo = document.getElementById("user-info");
    if (userInfo) userInfo.textContent = user.email;
    
    // Enable user-specific features
    const registerButtons = document.querySelectorAll('.btn-register');
    registerButtons.forEach(btn => {
        btn.style.display = 'inline-flex';
        btn.onclick = function() {
            const tournamentId = this.getAttribute('data-tournament-id');
            joinTournament(tournamentId);
        };
    });
}

// Update UI for guest user
function updateUIForGuest() {
    const registerButtons = document.querySelectorAll('.btn-register');
    registerButtons.forEach(btn => {
        btn.onclick = function() {
            window.location.href = 'login.html';
        };
        btn.innerHTML = '<span class="btn-icon">🔒</span> Login to Join';
    });
}

// Load Live Tournaments for Homepage
async function loadLiveTournaments() {
    const container = document.getElementById('liveTournamentsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-tournaments">
            <div class="loading-spinner"></div>
            <p>Loading tournaments...</p>
        </div>
    `;
    
    try {
        console.log('Fetching tournaments from Firestore...');
        
        // Get tournaments with different statuses
        const tournamentsRef = db.collection("tournaments")
            .where("status", "in", ["live", "registering", "upcoming"])
            .orderBy("status")
            .orderBy("startDate", "asc")
            .limit(8);

        const snapshot = await tournamentsRef.get();
        console.log(`Found ${snapshot.size} tournaments`);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="no-tournaments">
                    <div class="no-data-icon">🎮</div>
                    <h3>No Tournaments Available</h3>
                    <p>Check back later for new tournaments or host your own!</p>
                    <a href="admin.html" class="btn btn-primary">Host Tournament</a>
                </div>
            `;
            return;
        }

        let tournamentsHTML = '';
        let tournamentCount = 0;
        
        snapshot.forEach(doc => {
            const tournament = {
                id: doc.id,
                ...doc.data()
            };
            tournamentsHTML += createTournamentCard(tournament);
            tournamentCount++;
        });

        container.innerHTML = tournamentsHTML;
        console.log(`Displayed ${tournamentCount} tournaments`);
        
        // Add scroll animations
        addScrollAnimations();

    } catch (error) {
        console.error("Error loading tournaments:", error);
        container.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <h3>Error Loading Tournaments</h3>
                <p>Please try refreshing the page</p>
                <button onclick="loadLiveTournaments()" class="btn btn-primary">Retry</button>
            </div>
        `;
    }
}

// Create Tournament Card HTML
function createTournamentCard(tournament) {
    const status = tournament.status || 'upcoming';
    const statusClass = `status-${status}`;
    const statusText = status.toUpperCase();
    const gameIcon = getGameIcon(tournament.game);
    const prizeAmount = tournament.prizePool ? `₹${numberWithCommas(tournament.prizePool)}` : '₹0';
    const entryFee = tournament.entryFee ? `₹${numberWithCommas(tournament.entryFee)}` : 'Free';
    const currentPlayers = tournament.currentPlayers || 0;
    const maxPlayers = tournament.maxPlayers || 0;
    const progressPercent = maxPlayers ? (currentPlayers / maxPlayers) * 100 : 0;
    
    // Determine button text based on status
    let buttonText = 'View Details';
    let buttonIcon = '📊';
    if (status === 'registering') {
        buttonText = 'Register Now';
        buttonIcon = '🎮';
    } else if (status === 'live') {
        buttonText = 'Join Now';
        buttonIcon = '⚡';
    }

    return `
        <div class="tournament-card fade-in ${tournament.featured ? 'featured' : ''}">
            <div class="tournament-header">
                <div class="tournament-game">
                    <div class="game-icon">${gameIcon}</div>
                    <div class="game-info">
                        <div class="game-name">${tournament.game || 'Unknown Game'}</div>
                        <div class="game-category">${tournament.format || 'Tournament'}</div>
                    </div>
                </div>
                <div class="tournament-status ${statusClass}">
                    ${status === 'live' ? '<span class="live-pulse"></span>' : ''}
                    ${statusText}
                </div>
            </div>
            
            <div class="tournament-body">
                <h3 class="tournament-title">${tournament.name || 'Unnamed Tournament'}</h3>
                
                <div class="tournament-details">
                    <div class="tournament-detail">
                        <span class="detail-icon">💰</span>
                        <span>Prize: ${prizeAmount}</span>
                    </div>
                    <div class="tournament-detail">
                        <span class="detail-icon">🎫</span>
                        <span>Entry: ${entryFee}</span>
                    </div>
                    <div class="tournament-detail">
                        <span class="detail-icon">👥</span>
                        <span>${currentPlayers}/${maxPlayers} Players</span>
                    </div>
                    <div class="tournament-detail">
                        <span class="detail-icon">⚙️</span>
                        <span>${tournament.format || 'Single Elimination'}</span>
                    </div>
                </div>
                
                ${status === 'registering' ? `
                <div class="tournament-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-text">${Math.round(progressPercent)}% filled</div>
                </div>
                ` : ''}
                
                <div class="tournament-prize">
                    <span class="prize-icon">💰</span>
                    <span>${prizeAmount}</span>
                </div>
            </div>
            
            <div class="tournament-footer">
                <div class="tournament-entries">
                    <span class="entries-icon">👥</span>
                    <span class="entries-count">${currentPlayers}/${maxPlayers}</span>
                    <span>Players</span>
                </div>
                <div class="tournament-actions">
                    <button class="btn btn-sm btn-register" data-tournament-id="${tournament.id}">
                        <span class="btn-icon">${buttonIcon}</span>
                        ${buttonText}
                    </button>
                    <button class="btn btn-sm btn-details" onclick="viewTournamentDetails('${tournament.id}')">
                        <span class="btn-icon">📊</span>
                        Details
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Join Tournament Function
async function joinTournament(tournamentId) {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        console.log('Joining tournament:', tournamentId);
        
        // Check if user already registered
        const userTournamentsRef = db.collection("userTournaments").doc(currentUser.uid);
        const userDoc = await userTournamentsRef.get();
        
        let tournamentIds = [];
        if (userDoc.exists) {
            const userData = userDoc.data();
            tournamentIds = userData.tournamentIds || [];
            
            if (tournamentIds.includes(tournamentId)) {
                showNotification('You are already registered for this tournament!', 'warning');
                return;
            }
        }
        
        // Get tournament details
        const tournamentDoc = await db.collection("tournaments").doc(tournamentId).get();
        if (!tournamentDoc.exists) {
            showNotification('Tournament not found!', 'error');
            return;
        }
        
        const tournamentData = tournamentDoc.data();
        
        // Check if tournament is full
        if (tournamentData.currentPlayers >= tournamentData.maxPlayers) {
            showNotification('This tournament is already full!', 'error');
            return;
        }
        
        // Check entry fee
        if (tournamentData.entryFee > 0) {
            const walletRef = db.collection("wallets").doc(currentUser.uid);
            const walletDoc = await walletRef.get();
            const userBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;
            
            if (userBalance < tournamentData.entryFee) {
                showNotification(`Insufficient balance! You need ₹${tournamentData.entryFee} to join this tournament.`, 'error');
                return;
            }
            
            // Deduct entry fee
            await walletRef.set({
                balance: firebase.firestore.FieldValue.increment(-tournamentData.entryFee),
                transactions: firebase.firestore.FieldValue.arrayUnion({
                    amount: -tournamentData.entryFee,
                    description: `Entry fee for ${tournamentData.name}`,
                    date: firebase.firestore.FieldValue.serverTimestamp(),
                    type: 'tournament_entry'
                }),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        
        // Register user for tournament
        await userTournamentsRef.set({
            tournamentIds: firebase.firestore.FieldValue.arrayUnion(tournamentId),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Update tournament player count
        await db.collection("tournaments").doc(tournamentId).update({
            currentPlayers: firebase.firestore.FieldValue.increment(1),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('Successfully joined the tournament!', 'success');
        
        // Reload tournaments to update counts
        setTimeout(() => {
            loadLiveTournaments();
        }, 1000);
        
    } catch (error) {
        console.error("Error joining tournament:", error);
        showNotification('Error joining tournament. Please try again.', 'error');
    }
}

// View Tournament Details
function viewTournamentDetails(tournamentId) {
    window.location.href = `tournament-details.html?id=${tournamentId}`;
}

// Helper Functions
function getGameIcon(gameName) {
    const icons = {
        'valorant': '🎯',
        'free fire': '🔥',
        'cod mobile': '🎮',
        'bgmi': '🏹',
        'pubg': '🎯',
        'pubg mobile': '🎯',
        'fortnite': '🏰',
        'csgo': '🔫',
        'dota': '⚔️',
        'dota 2': '⚔️',
        'lol': '⚡',
        'league of legends': '⚡',
        'overwatch': '🎯',
        'rocket league': '🚗'
    };
    return icons[gameName?.toLowerCase()] || '🎮';
}

function formatDate(date) {
    if (!date) return 'TBD';
    try {
        let dateObj;
        if (date.toDate) {
            dateObj = date.toDate();
        } else if (date instanceof Date) {
            dateObj = date;
        } else {
            dateObj = new Date(date);
        }
        
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
}

// Scroll Animations
function addScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(element => {
        observer.observe(element);
    });
}

// Header scroll effect
window.addEventListener('scroll', function() {
    const header = document.querySelector('.main-header');
    if (header && window.scrollY > 50) {
        header.classList.add('scrolled');
    } else if (header) {
        header.classList.remove('scrolled');
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('TourneyHub initialized');
    addScrollAnimations();
    
    // Add click handlers for register buttons (will be updated when tournaments load)
    document.addEventListener('click', function(e) {
        if (e.target.closest('.btn-register')) {
            const button = e.target.closest('.btn-register');
            const tournamentId = button.getAttribute('data-tournament-id');
            if (tournamentId) {
                joinTournament(tournamentId);
            }
        }
    });
});

// Export functions for global access
window.joinTournament = joinTournament;
window.viewTournamentDetails = viewTournamentDetails;
window.loadLiveTournaments = loadLiveTournaments;