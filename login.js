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

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const passwordToggle = document.getElementById('passwordToggle');
const loginBtn = document.getElementById('loginBtn');
const loginSpinner = document.getElementById('loginSpinner');
const rememberMe = document.getElementById('rememberMe');
const forgotPassword = document.getElementById('forgotPassword');
const notificationToast = document.getElementById('notificationToast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');
const toastClose = document.getElementById('toastClose');

// Initialize Application
function initApp() {
  console.log('Initializing login application...');
  
  // Check if user is already logged in
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('User already logged in, redirecting...');
      showNotification('Welcome back! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = getRedirectUrl() || 'dashboard.html';
      }, 1500);
    } else {
      // User is not logged in, show the login form
      showMainContent();
    }
  });
}

// Show Main Content
function showMainContent() {
  console.log('Showing login form...');
  
  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
    
    if (mainContent) {
      mainContent.style.opacity = '1';
    }
    
    // Load saved email if "Remember me" was checked
    loadSavedCredentials();
  }, 1000);
}

// Get redirect URL from URL parameters
function getRedirectUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('redirect');
}

// Load saved credentials from localStorage
function loadSavedCredentials() {
  const savedEmail = localStorage.getItem('tourneyhub_remembered_email');
  const remember = localStorage.getItem('tourneyhub_remember_me');
  
  if (savedEmail && remember === 'true') {
    emailInput.value = savedEmail;
    rememberMe.checked = true;
  }
}

// Save credentials to localStorage
function saveCredentials(email) {
  if (rememberMe.checked) {
    localStorage.setItem('tourneyhub_remembered_email', email);
    localStorage.setItem('tourneyhub_remember_me', 'true');
  } else {
    localStorage.removeItem('tourneyhub_remembered_email');
    localStorage.removeItem('tourneyhub_remember_me');
  }
}

// Toggle password visibility
function togglePasswordVisibility() {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
  
  // Update toggle button icon
  const toggleIcon = passwordToggle.querySelector('.toggle-icon');
  toggleIcon.textContent = type === 'password' ? '👁️' : '🔒';
}

// Show notification toast
function showNotification(message, type = 'info') {
  // Set appropriate icon based on type
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
  
  toastIcon.textContent = icons[type] || icons.info;
  toastMessage.textContent = message;
  
  // Set toast class based on type
  notificationToast.className = `notification-toast show ${type}`;
  
  // Auto-hide after 5 seconds for success/info, 8 seconds for errors
  const hideTime = type === 'error' ? 8000 : 5000;
  
  setTimeout(() => {
    hideNotification();
  }, hideTime);
}

// Hide notification toast
function hideNotification() {
  notificationToast.classList.remove('show');
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate form inputs
function validateForm(email, password) {
  if (!email || !password) {
    showNotification('Please fill in all fields', 'error');
    return false;
  }
  
  if (!isValidEmail(email)) {
    showNotification('Please enter a valid email address', 'error');
    emailInput.focus();
    return false;
  }
  
  if (password.length < 6) {
    showNotification('Password must be at least 6 characters', 'error');
    passwordInput.focus();
    return false;
  }
  
  return true;
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  // Validate form
  if (!validateForm(email, password)) {
    return;
  }
  
  // Show loading state
  loginBtn.classList.add('loading');
  loginBtn.disabled = true;
  
  try {
    console.log('Attempting login...');
    showNotification('Signing you in...', 'info');
    
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    console.log('Login successful:', user.email);
    
    // Save credentials if "Remember me" is checked
    saveCredentials(email);
    
    // Show success message
    showNotification(`Welcome back, ${user.email.split('@')[0]}!`, 'success');
    
    // Redirect after a short delay
    setTimeout(() => {
      const redirectUrl = getRedirectUrl() || 'dashboard.html';
      window.location.href = redirectUrl;
    }, 1500);
    
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle specific error cases
    let errorMessage = 'Login failed. Please try again.';
    
    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address format.';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled.';
        break;
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password. Please try again.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      default:
        errorMessage = error.message || 'Login failed. Please try again.';
    }
    
    showNotification(errorMessage, 'error');
    
    // Reset loading state
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
  }
}

// Handle forgot password
async function handleForgotPassword() {
  const email = emailInput.value.trim();
  
  if (!email) {
    showNotification('Please enter your email address to reset password', 'error');
    emailInput.focus();
    return;
  }
  
  if (!isValidEmail(email)) {
    showNotification('Please enter a valid email address', 'error');
    emailInput.focus();
    return;
  }
  
  try {
    showNotification('Sending reset email...', 'info');
    
    await auth.sendPasswordResetEmail(email);
    
    showNotification(`Password reset email sent to ${email}`, 'success');
    
  } catch (error) {
    console.error('Password reset error:', error);
    
    let errorMessage = 'Failed to send reset email. Please try again.';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address format.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many attempts. Please try again later.';
        break;
    }
    
    showNotification(errorMessage, 'error');
  }
}

// Event Listeners
function setupEventListeners() {
  // Form submission
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Password visibility toggle
  if (passwordToggle) {
    passwordToggle.addEventListener('click', togglePasswordVisibility);
  }
  
  // Forgot password
  if (forgotPassword) {
    forgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      handleForgotPassword();
    });
  }
  
  // Toast close button
  if (toastClose) {
    toastClose.addEventListener('click', hideNotification);
  }
  
  // Enter key to submit form
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleLogin(e);
      }
    });
  }
  
  // Real-time validation
  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      const email = emailInput.value.trim();
      if (email && !isValidEmail(email)) {
        emailInput.style.borderColor = 'var(--error)';
      } else {
        emailInput.style.borderColor = '';
      }
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded');
  setupEventListeners();
  initApp();
});

// Fallback: if loading takes too long, force show content
setTimeout(() => {
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
    console.log('Fallback: forcing content to show');
    showMainContent();
  }
}, 5000); // 5 second fallback

// Export functions for global access (if needed)
window.handleLogin = handleLogin;
window.togglePasswordVisibility = togglePasswordVisibility;
window.handleForgotPassword = handleForgotPassword;