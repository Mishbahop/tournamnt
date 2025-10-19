// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
    authDomain: "authapp-386ee.firebaseapp.com",
    projectId: "authapp-386ee",
    storageBucket: "authapp-386ee.appspot.com",
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
    // Prefer the loading subtitle element present in HTML (class "loading-subtitle")
    const loadingTextEl = document.querySelector('.loading-subtitle');
    if (currentProgress < 100) {
        currentProgress += Math.random() * 10 + 5;
        if (currentProgress > 100) currentProgress = 100;
        // update visible loading text (if present)
        if (loadingTextEl) {
            if (currentProgress < 30) {
                loadingTextEl.textContent = 'Loading tournaments...';
            } else if (currentProgress < 60) {
                loadingTextEl.textContent = 'Setting up gaming environment...';
            } else if (currentProgress < 90) {
                loadingTextEl.textContent = 'Almost ready...';
            } else {
                loadingTextEl.textContent = 'Ready to compete!';
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
            if (loadingScreen.parentElement) loadingScreen.remove();
        }, 600);
    }
}

/* --- Fallback: force-hide loading UI if initialization hangs --- */
(function() {
	// Time (ms) before forcing UI to proceed
	const FORCE_HIDE_TIMEOUT = 8000;

	function forceHideLoading() {
		try {
			// Hide any global loading-screen
			document.querySelectorAll('.loading-screen').forEach(el => {
				el.classList.add('hidden');
				// remove after a short delay to allow CSS transition
				setTimeout(() => el.remove(), 600);
			});

			// Replace common inline loading placeholders (so sections don't show indefinite "Loading...")
			document.querySelectorAll('.loading, .loading-spinner, .loading-state').forEach(el => {
				// If the element is inside a known container (like live-tournaments), swap to a friendly no-data message
				const parent = el.closest('#live-tournaments, #my-tournaments, #my-matches, #wallet-balance, #content, #tabContent');
				if (parent) {
					parent.innerHTML = `<div class="no-data">No data available right now — try refreshing.</div>`;
				} else {
					// otherwise remove the stub
					el.remove();
				}
			});

			// Ensure main content areas are visible (if they exist)
			document.querySelectorAll('#mainContent, .main-content, .container, .wallet-container').forEach(el => {
				el.style.display = el.style.display || 'block';
				el.classList.add('fade-in');
			});

			console.info('forceHideLoading: fallback UI shown');
		} catch (err) {
			console.warn('forceHideLoading error', err);
		}
	}

	// Schedule the fallback — will be no-op if hideLoadingScreen already ran
	window.addEventListener('load', () => {
		setTimeout(() => {
			// If any .loading-screen still exists and is visible, force-hide
			const anyLoading = Array.from(document.querySelectorAll('.loading-screen')).some(el => {
				return el && (getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0');
			});
			if (anyLoading) forceHideLoading();
		}, FORCE_HIDE_TIMEOUT);
	});

	// Also run a safety fallback if DOMContentLoaded fired but app didn't finish init
	document.addEventListener('DOMContentLoaded', () => {
		setTimeout(() => {
			const anyLoading = document.querySelector('.loading-screen');
			if (anyLoading) forceHideLoading();
		}, FORCE_HIDE_TIMEOUT);
	});
})();

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
function loadLiveTournaments() {
    // guard to avoid rapid re-invocations / duplicate listener setup
    if (loadLiveTournaments._last && Date.now() - loadLiveTournaments._last < 700) {
        console.log('loadLiveTournaments: debounced');
        return;
    }
    loadLiveTournaments._last = Date.now();

    const container = document.getElementById('live-tournaments');
    if (!container) {
        console.log('Tournaments container not found');
        return;
    }

    // Show temporary loading state
    container.innerHTML = `<div class="loading">Loading live tournaments...</div>`;

    // Clean up previous listener if exists
    if (window.__tournamentsListenerCleanup) {
        try { window.__tournamentsListenerCleanup(); } catch (e) { console.warn(e); }
        window.__tournamentsListenerCleanup = null;
    }

    try {
        // attach listener
        const q = db.collection("tournaments")
            .where("status", "in", ["live", "registering", "upcoming"])
            .orderBy("status")
            .orderBy("startDate", "asc")
            .limit(18);

        const unsubscribe = q.onSnapshot(snapshot => {
            if (snapshot.empty) {
                container.innerHTML = `<div class="no-data">No tournaments available</div>`;
                return;
            }
            let html = '';
            let featuredCount = 0;
            snapshot.forEach(doc => {
                const tournament = { id: doc.id, ...doc.data() };
                if (tournament.featured && featuredCount < 2) { featuredCount++; }
                else { tournament.featured = false; }
                html += createTournamentCard(tournament);
            });
            container.innerHTML = html;
            // setup delegation (single call is fine)
            attachTournamentDelegation();
            addScrollAnimations();
        }, err => {
            console.error('Tournaments snapshot error:', err);
            container.innerHTML = `<div class="no-data">Error loading tournaments</div>`;
        });

        // store cleanup
        window.__tournamentsListenerCleanup = unsubscribe;
    } catch (error) {
        console.error('Error in loadLiveTournaments:', error);
        container.innerHTML = `<div class="no-data">Error loading tournaments</div>`;
    }
}

// --- Event delegation for tournament actions ---
function attachTournamentDelegation() {
    const container = document.getElementById('live-tournaments');
    if (!container || container.__listenerAttached) return;
    container.__listenerAttached = true;

    container.addEventListener('click', function (e) {
        const el = e.target.closest('button');
        if (!el) return;
        // Register / Join button
        if (el.classList.contains('btn-register')) {
            e.preventDefault();
            const tournamentId = el.getAttribute('data-tournament-id');
            if (!tournamentId) return;
            // visual feedback
            el.disabled = true;
            setTimeout(() => el.disabled = false, 600);
            joinTournament(tournamentId).catch(err => {
                console.error(err);
                showNotification(err.message || 'Unable to join', 'error');
            });
            return;
        }
        // Details button (data attribute)
        if (el.classList.contains('btn-details')) {
            e.preventDefault();
            const parentCard = el.closest('.tournament-card');
            const tid = parentCard && parentCard.querySelector('.btn-register') && parentCard.querySelector('.btn-register').getAttribute('data-tournament-id');
            if (tid) viewTournamentDetails(tid);
            return;
        }
    });

    // keyboard activation for buttons inside container
    container.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            const btn = document.activeElement.closest && document.activeElement.closest('button');
            if (btn) {
                btn.click();
                e.preventDefault();
            }
        }
    });
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

// --- Robust joinTournament using Firestore transaction ---
async function joinTournament(tournamentId) {
    if (!currentUser) {
        showNotification('Please login to join tournaments', 'info');
        setTimeout(() => window.location.href = 'login.html', 1200);
        return;
    }

    try {
        showNotification('Processing your registration...', 'info');

        const tRef = db.collection('tournaments').doc(tournamentId);
        const userRef = db.collection('userTournaments').doc(currentUser.uid);
        const walletRef = db.collection('wallets').doc(currentUser.uid);

        await db.runTransaction(async tx => {
            const tDoc = await tx.get(tRef);
            if (!tDoc.exists) throw new Error('Tournament not found');

            const tData = tDoc.data();
            const currentPlayers = tData.currentPlayers || 0;
            const maxPlayers = tData.maxPlayers || 0;
            const status = tData.status || 'upcoming';

            if (currentPlayers >= maxPlayers) throw new Error('Tournament is full');
            if (status !== 'registering') throw new Error('Registration for this tournament is closed');

            // handle entry fee
            const entryFee = tData.entryFee || 0;
            if (entryFee > 0) {
                const wDoc = await tx.get(walletRef);
                const balance = (wDoc.exists && wDoc.data().balance) || 0;
                if (balance < entryFee) throw new Error(`Insufficient balance (requires ₹${entryFee})`);
                tx.update(walletRef, {
                    balance: firebase.firestore.FieldValue.increment(-entryFee),
                    transactions: firebase.firestore.FieldValue.arrayUnion({
                        amount: -entryFee,
                        description: `Entry fee for ${tData.name || tData.title || 'tournament'}`,
                        date: firebase.firestore.FieldValue.serverTimestamp(),
                        type: 'tournament_entry'
                    }),
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // mark user registered
            tx.set(userRef, {
                tournamentIds: firebase.firestore.FieldValue.arrayUnion(tRef.id),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // increment player count
            tx.update(tRef, {
                currentPlayers: firebase.firestore.FieldValue.increment(1),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        showNotification('Successfully joined the tournament! 🎉', 'success');
        // refresh local UI quickly
        setTimeout(loadLiveTournaments, 800);
    } catch (err) {
        console.error('joinTournament error:', err);
        // better user-facing messages for known cases
        const msg = err.message || 'Unable to join tournament';
        showNotification(msg, 'error');
        throw err;
    }
}

// --- Accessible, improved notifications ---
function showNotification(message, type = 'info', dismissAfter = 5000) {
    // ensure container
    let container = document.getElementById('siteNotifications');
    if (!container) {
        container = document.createElement('div');
        container.id = 'siteNotifications';
        container.style.position = 'fixed';
        container.style.top = '16px';
        container.style.right = '16px';
        container.style.zIndex = 99999;
        document.body.appendChild(container);
    }

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.setAttribute('role', type === 'error' ? 'alert' : 'status');
    notif.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    notif.style.marginBottom = '8px';
    notif.style.minWidth = '220px';
    notif.style.padding = '12px 14px';
    notif.style.borderRadius = '8px';
    notif.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
    notif.style.background = type === 'success' ? '#052e08' : type === 'error' ? '#2a0510' : '#08102a';
    notif.style.color = '#fff';
    notif.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div style="flex:1">
          <div style="font-weight:600">${type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</div>
          <div style="font-size:0.95rem;margin-top:6px">${message}</div>
        </div>
        <button aria-label="Close notification" style="background:none;border:none;color:inherit;font-size:18px;cursor:pointer">×</button>
      </div>
    `;
    const closeBtn = notif.querySelector('button');
    closeBtn.addEventListener('click', () => notif.remove());
    container.prepend(notif);

    if (dismissAfter > 0) setTimeout(() => notif.remove(), dismissAfter);
}

// --- Keyboard accessibility for nav items (enhancement) ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.setAttribute('tabindex', '0');
        item.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });
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
window.loadLiveTournaments = loadLiveTournaments;
window.showNotification = showNotification;