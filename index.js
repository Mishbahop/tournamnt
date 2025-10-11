// Firebase Configuration
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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const mainContent = document.getElementById('mainContent');
const trendingTournaments = document.getElementById('trendingTournaments');

// Sample tournament data (in production, this would come from Firestore)
const sampleTournaments = [
  {
    id: 1,
    game: 'Valorant',
    gameIcon: '🎯',
    title: 'Valorant Showdown Championship',
    status: 'live',
    statusText: 'LIVE',
    prizePool: '₹50,000',
    type: 'Solo & Team',
    players: '32/64',
    date: 'Today, 8:00 PM',
    entryFee: '₹500'
  },
  {
    id: 2,
    game: 'Free Fire',
    gameIcon: '🔥',
    title: 'Free Fire Clash Royale',
    status: 'registering',
    statusText: 'REGISTERING',
    prizePool: '₹25,000',
    type: 'Squad Only',
    players: '24/32',
    date: 'Tomorrow, 6:00 PM',
    entryFee: '₹300'
  },
  {
    id: 3,
    game: 'COD Mobile',
    gameIcon: '🎮',
    title: 'COD Mobile Masters Cup',
    status: 'upcoming',
    statusText: 'UPCOMING',
    prizePool: '₹40,000',
    type: 'Duo & Squad',
    players: '16/48',
    date: 'Dec 15, 7:00 PM',
    entryFee: '₹400'
  },
  {
    id: 4,
    game: 'BGMI',
    gameIcon: '🎖️',
    title: 'BGMI Battle Royale',
    status: 'registering',
    statusText: 'REGISTERING',
    prizePool: '₹35,000',
    type: 'Squad Only',
    players: '40/64',
    date: 'Dec 12, 9:00 PM',
    entryFee: '₹350'
  }
];

// Initialize Application
function initApp() {
  // Check authentication status
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is signed in
      console.log('User signed in:', user.email);
    } else {
      // User is signed out - but we don't redirect from homepage
      console.log('User not signed in');
    }
    
    // Show main content regardless of auth status for homepage
    showMainContent();
  });
}

// Show Main Content
function showMainContent() {
  // Load trending tournaments
  loadTrendingTournaments();
  
  // Hide loading screen and show main content
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    mainContent.style.display = 'block';
    
    // Add fade-in animation
    setTimeout(() => {
      mainContent.style.opacity = '1';
    }, 50);
  }, 1500);
}

// Load Trending Tournaments
function loadTrendingTournaments() {
  if (!trendingTournaments) return;
  
  // In production, you would fetch this from Firestore
  // For now, we'll use sample data
  const tournamentsHTML = sampleTournaments.map(tournament => `
    <div class="tournament-card" data-tournament-id="${tournament.id}">
      <div class="tournament-header">
        <div class="tournament-game">
          <span class="game-icon-small">${tournament.gameIcon}</span>
          <span>${tournament.game}</span>
        </div>
        <span class="tournament-status status-${tournament.status}">
          ${tournament.statusText}
        </span>
      </div>
      
      <h3 class="tournament-title">${tournament.title}</h3>
      
      <div class="tournament-details">
        <div class="detail-item">
          <span class="detail-label">Prize Pool</span>
          <span class="detail-value prize-pool">${tournament.prizePool}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Type</span>
          <span class="detail-value">${tournament.type}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Players</span>
          <span class="detail-value">${tournament.players}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Date</span>
          <span class="detail-value">${tournament.date}</span>
        </div>
      </div>
      
      <div class="tournament-actions">
        <button class="btn btn-primary" style="flex: 2;" onclick="joinTournament(${tournament.id})">
          <span class="btn-icon">🎮</span>
          Join Tournament
        </button>
        <button class="btn btn-secondary" style="flex: 1;" onclick="viewTournament(${tournament.id})">
          <span class="btn-icon">👁️</span>
          View
        </button>
      </div>
    </div>
  `).join('');
  
  trendingTournaments.innerHTML = tournamentsHTML;
}

// Join Tournament Function
function joinTournament(tournamentId) {
  const tournament = sampleTournaments.find(t => t.id === tournamentId);
  if (!tournament) return;
  
  // Check if user is authenticated
  const user = auth.currentUser;
  if (!user) {
    // Redirect to login page
    window.location.href = 'login.html';
    return;
  }
  
  // Show confirmation dialog
  if (confirm(`Join ${tournament.title}?\nEntry Fee: ${tournament.entryFee}`)) {
    // In production, you would add the user to the tournament in Firestore
    console.log(`Joining tournament: ${tournament.title}`);
    
    // Show success message
    showNotification(`Successfully joined ${tournament.title}!`, 'success');
    
    // Redirect to tournaments page
    setTimeout(() => {
      window.location.href = 'tournaments.html';
    }, 2000);
  }
}

// View Tournament Function
function viewTournament(tournamentId) {
  // Redirect to tournaments page
  window.location.href = 'tournaments.html';
}

// Show Notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    animation: slideInRight 0.3s ease;
    ${type === 'success' ? 'background: #10b981;' : 
      type === 'error' ? 'background: #ef4444;' : 
      'background: #6366f1;'}
  `;
  
  document.body.appendChild(notification);
  
  // Remove notification after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Add CSS animations for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(notificationStyles);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Add intersection observer for animations
function initAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);

  // Observe all tournament cards and feature cards
  document.querySelectorAll('.tournament-card, .feature-card').forEach(el => {
    observer.observe(el);
  });
}

// Initialize animations after content is loaded
setTimeout(initAnimations, 2000);