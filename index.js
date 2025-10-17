
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
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
} else {
    firebase.app();
}

const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let tournamentsListener = null;
let currentProgress = 0;

// ==================== LOADING SCREEN ====================
function updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const loadingText = document.getElementById('loadingText');
    
    if (currentProgress < 100) {
        currentProgress += Math.random() * 10 + 5;
        
        if (currentProgress > 100) currentProgress = 100;
        
        if (progressFill) {
            progressFill.style.width = currentProgress + '%';
        }
        
        // Update loading text
        if (loadingText) {
            if (currentProgress < 30) {
                loadingText.textContent = 'Loading tournaments...';
            } else if (currentProgress < 60) {
                loadingText.textContent = 'Setting up gaming environment...';
            } else if (currentProgress < 90) {
                loadingText.textContent = 'Almost ready...';
            } else {
                loadingText.textContent = 'Ready to compete!';
            }
        }
        
        if (currentProgress >= 100) {
            setTimeout(hideLoadingScreen, 500);
        } else {
            setTimeout(updateProgress, 200 + Math.random() * 200);
        }
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            if (loadingScreen.parentElement) {
                loadingScreen.remove();
            }
        }, 600);
    }
}

// ==================== AUTHENTICATION ====================
// Check authentication state
auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
        console.log('User signed in:', user.email);
        updateUIForUser(user);
    } else {
        console.log('No user signed in');
        updateUIForGuest();
    }
    
    loadLiveTournaments();
});

// Update UI for logged-in user
function updateUIForUser(user) {
    // Update any user-specific UI elements
    const userElements = document.querySelectorAll('.user-info');
    userElements.forEach(element => {
        element.textContent = user.email || 'User';
    });
    
    // Enable tournament registration
    setupTournamentButtons();
}

// Update UI for guest user
function updateUIForGuest() {
    // Update guest-specific UI elements
    const userElements = document.querySelectorAll('.user-info');
    userElements.forEach(element => {
        element.textContent = 'Guest';
    });
    
    // Setup tournament buttons for guests
    setupTournamentButtons();
}

// ==================== TOURNAMENTS ====================
// Load Live Tournaments for Homepage
async function loadLiveTournaments() {
    const container = document.getElementById('liveTournamentsContainer');
    if (!container) {
        console.log('Tournaments container not found');
        return;
    }
    
    // Show loading state
    container.innerHTML = `
        <div class="loading-tournaments">
            <div class="loading-spinner"></div>
            <p>Loading tournaments...</p>
        </div>
    `;
    
    try {
        console.log('Fetching tournaments from Firestore...');
        
        // Clean up previous listener
        if (tournamentsListener) {
            tournamentsListener();
        }
        
        // Get tournaments with different statuses
        tournamentsListener = db.collection("tournaments")
            .where("status", "in", ["live", "registering", "upcoming"])
            .orderBy("status")
            .orderBy("startDate", "asc")
            .limit(6)
            .onSnapshot(async (snapshot) => {
                console.log(`Found ${snapshot.size} tournaments`);
                
                if (snapshot.empty) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary); grid-column: 1 / -1;">
                            <div style="font-size: 4rem; margin-bottom: 20px;">🎮</div>
                            <h3 style="margin-bottom: 15px; color: var(--text-primary);">No Tournaments Available</h3>
                            <p style="margin-bottom: 25px;">Check back later for new tournaments!</p>
                            ${currentUser ? '<a href="create-tournament.html" class="btn btn-primary">Create Tournament</a>' : ''}
                        </div>
                    `;
                    return;
                }

                let tournamentsHTML = '';
                let featuredCount = 0;
                
                snapshot.forEach(doc => {
                    const tournament = {
                        id: doc.id,
                        ...doc.data()
                    };
                    
                    // Limit featured tournaments
                    if (tournament.featured && featuredCount < 2) {
                        featuredCount++;
                    } else {
                        tournament.featured = false;
                    }
                    
                    tournamentsHTML += createTournamentCard(tournament);
                });

                container.innerHTML = tournamentsHTML;
                setupTournamentButtons();
                addScrollAnimations();
                
            }, (error) => {
                console.error("Error in tournaments listener:", error);
                showErrorState(container, error);
            });

    } catch (error) {
        console.error("Error setting up tournaments listener:", error);
        showErrorState(container, error);
    }
}

// Show error state
function showErrorState(container, error) {
    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary); grid-column: 1 / -1;">
            <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
            <h3 style="margin-bottom: 15px; color: var(--text-primary);">Error Loading Tournaments</h3>
            <p style="margin-bottom: 25px;">${error.message || 'Please try refreshing the page'}</p>
            <button onclick="loadLiveTournaments()" class="btn btn-primary">Try Again</button>
        </div>
    `;
}

// Create Tournament Card HTML
function createTournamentCard(tournament) {
    const status = tournament.status || 'upcoming';
    const statusClass = `status-${status}`;
    const statusText = status.charAt(0).toUpperCase() + status.slice(1);
    const gameIcon = getGameIcon(tournament.game);
    const prizeAmount = tournament.prizePool ? `₹${numberWithCommas(tournament.prizePool)}` : '₹0';
    const entryFee = tournament.entryFee ? `₹${numberWithCommas(tournament.entryFee)}` : 'Free';
    const currentPlayers = tournament.currentPlayers || 0;
    const maxPlayers = tournament.maxPlayers || 0;
    const progressPercent = maxPlayers ? Math.min(100, (currentPlayers / maxPlayers) * 100) : 0;
    
    // Format date
    const startDate = tournament.startDate ? formatDate(tournament.startDate) : 'TBD';
    
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
                        <span class="detail-icon">📅</span>
                        <span>${startDate}</span>
                    </div>
                </div>
                
                ${status === 'registering' ? `
                <div class="tournament-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-text">${Math.round(progressPercent)}% filled • ${maxPlayers - currentPlayers} spots left</div>
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

// Setup tournament action buttons
function setupTournamentButtons() {
    const registerButtons = document.querySelectorAll('.btn-register');
    registerButtons.forEach(btn => {
        if (currentUser) {
            // User is logged in
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Add click feedback
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
                
                const tournamentId = this.getAttribute('data-tournament-id');
                if (tournamentId) {
                    joinTournament(tournamentId);
                }
            };
            btn.innerHTML = '<span class="btn-icon">🎮</span> Join Tournament';
        } else {
            // User is guest
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Add click feedback
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
                
                showNotification('Please login to join tournaments', 'info');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            };
            btn.innerHTML = '<span class="btn-icon">🔒</span> Login to Join';
        }
    });

    // Setup details buttons
    const detailsButtons = document.querySelectorAll('.btn-details');
    detailsButtons.forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Add click feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        };
    });
}

// Join Tournament Function
async function joinTournament(tournamentId) {
    if (!currentUser) {
        showNotification('Please login to join tournaments', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
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
        
        // Check if registration is open
        if (tournamentData.status !== 'registering') {
            showNotification('Registration for this tournament is closed!', 'error');
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
        
        showNotification('Successfully joined the tournament! 🎉', 'success');
        
        // Refresh tournaments to update counts
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

// ==================== HELPER FUNCTIONS ====================
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
        'rocket league': '🚗',
        'clash royale': '👑',
        'chess': '♟️',
        'fifa': '⚽'
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
        
        // Check if date is today
        const today = new Date();
        const isToday = dateObj.toDateString() === today.toDateString();
        
        if (isToday) {
            return `Today, ${dateObj.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            })}`;
        }
        
        // Check if date is tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = dateObj.toDateString() === tomorrow.toDateString();
        
        if (isTomorrow) {
            return `Tomorrow, ${dateObj.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            })}`;
        }
        
        return dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        return 'Date TBD';
    }
}

function numberWithCommas(x) {
    if (!x) return '0';
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ==================== NOTIFICATION SYSTEM ====================
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

// ==================== SCROLL ANIMATIONS ====================
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

// ==================== TOUCH & NAVIGATION HANDLING ====================
// Prevent context menu on long press
document.addEventListener('contextmenu', function(e) {
    if (e.target.closest('.nav-item') || 
        e.target.closest('.btn') || 
        e.target.closest('.tournament-card') ||
        e.target.closest('.game-card') ||
        e.target.closest('.feature-card')) {
        e.preventDefault();
        return false;
    }
});

// Prevent text selection on long press
document.addEventListener('selectstart', function(e) {
    if (e.target.closest('.nav-item') || 
        e.target.closest('.btn') || 
        e.target.closest('.tournament-card') ||
        e.target.closest('.game-card') ||
        e.target.closest('.feature-card')) {
        e.preventDefault();
        return false;
    }
});

// Handle touch events to prevent defaults
document.addEventListener('touchstart', function(e) {
    // Add active state for touch feedback
    if (e.target.closest('.nav-item')) {
        e.target.closest('.nav-item').classList.add('touch-active');
    }
    if (e.target.closest('.btn')) {
        e.target.closest('.btn').classList.add('touch-active');
    }
}, { passive: true });

document.addEventListener('touchend', function(e) {
    // Remove active state
    document.querySelectorAll('.nav-item.touch-active, .btn.touch-active').forEach(el => {
        el.classList.remove('touch-active');
    });
}, { passive: true });

// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

// Enhanced navigation setup
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    navItems.forEach(item => {
        // Set active state based on current page
        const href = item.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            item.classList.add('active');
        }
        
        // Enhanced click handler
        item.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
            
            // Add click feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            // Navigate after a short delay for better UX
            setTimeout(() => {
                const href = this.getAttribute('href');
                if (href && href !== '#') {
                    window.location.href = href;
                }
            }, 200);
        });
    });
}

// Enhanced button handlers
function setupButtons() {
    const buttons = document.querySelectorAll('.btn:not(.btn-register):not(.btn-details)');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Add click feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            // Handle button actions
            const href = this.getAttribute('href');
            const onclick = this.getAttribute('onclick');
            
            if (href && href !== '#') {
                setTimeout(() => {
                    window.location.href = href;
                }, 200);
            } else if (onclick) {
                setTimeout(() => {
                    eval(onclick);
                }, 50);
            }
        });
    });
}

// Prevent drag and drop of images and links
document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'A') {
        e.preventDefault();
    }
});

// Add CSS for touch active states
const style = document.createElement('style');
style.textContent = `
    .nav-item.touch-active {
        transform: scale(0.95) !important;
        transition: transform 0.1s ease !important;
    }
    
    .btn.touch-active {
        transform: scale(0.95) !important;
        transition: transform 0.1s ease !important;
    }
    
    .nav-item.active.touch-active {
        transform: translateY(-8px) scale(0.93) !important;
    }
    
    /* Ensure no outline on focus for mobile */
    .nav-item:focus,
    .btn:focus {
        outline: none !important;
        box-shadow: none !important;
    }
`;
document.head.appendChild(style);

// ==================== HEADER SCROLL EFFECT ====================
function setupHeaderScroll() {
    const header = document.getElementById('mainHeader');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('TourneyHub Premium initialized');
    
    // Start loading progress
    setTimeout(updateProgress, 300);
    
    // Setup all functionality
    setupNavigation();
    setupButtons();
    setupHeaderScroll();
    addScrollAnimations();
    
    // Additional touch event prevention
    document.addEventListener('touchmove', function(e) {
        if (e.target.closest('.nav-item') || e.target.closest('.btn')) {
            e.preventDefault();
        }
    }, { passive: false });
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (tournamentsListener) {
        tournamentsListener();
    }
});

// Handle online/offline status
window.addEventListener('online', function() {
    showNotification('Connection restored', 'success');
    setTimeout(loadLiveTournaments, 500);
});

window.addEventListener('offline', function() {
    showNotification('You are offline', 'warning');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Page became visible, refresh tournaments
        setTimeout(loadLiveTournaments, 1000);
    }
});

// Fallback loading screen hide
window.addEventListener('load', function() {
    setTimeout(hideLoadingScreen, 2000);
});

// ==================== GLOBAL EXPORTS ====================
window.joinTournament = joinTournament;
window.viewTournamentDetails = viewTournamentDetails;
window.loadLiveTournaments = loadLiveTournaments;
window.showNotification = showNotification;