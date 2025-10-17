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
const signupForm = document.getElementById('signupForm');
const emailInput = document.getElementById('signup-email');
const passwordInput = document.getElementById('signup-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const passwordToggle = document.getElementById('passwordToggle');
const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');
const signupBtn = document.getElementById('signupBtn');
const signupSpinner = document.getElementById('signupSpinner');
const agreeTerms = document.getElementById('agreeTerms');
const newsletter = document.getElementById('newsletter');
const emailHint = document.getElementById('emailHint');
const passwordStrength = document.getElementById('passwordStrength');
const strengthFill = document.getElementById('strengthFill');
const strengthText = document.getElementById('strengthText');
const confirmHint = document.getElementById('confirmHint');
const notificationToast = document.getElementById('notificationToast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');
const toastClose = document.getElementById('toastClose');
const verificationNotice = document.getElementById('verificationNotice');
const resendVerificationBtn = document.getElementById('resendVerification');
const continueToLoginBtn = document.getElementById('continueToLogin');

// State variables
let passwordValid = false;
let passwordsMatch = false;
let currentUser = null;

// Initialize Application
function initApp() {
  console.log('Initializing signup application...');
  
  // Check if user is already logged in
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('User already logged in:', user.email);
      currentUser = user;
      
      if (user.emailVerified) {
        // User is verified, redirect to dashboard
        showNotification('Welcome back! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);
      } else {
        // User is logged in but not verified, show verification notice
        showMainContent();
        showVerificationNotice();
      }
    } else {
      // User is not logged in, show the signup form
      showMainContent();
    }
  });
}

// Show Main Content
function showMainContent() {
  console.log('Showing signup form...');
  
  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
    
    if (mainContent) {
      mainContent.style.opacity = '1';
    }
  }, 1000);
}

// Show verification notice
function showVerificationNotice() {
  if (verificationNotice) {
    verificationNotice.classList.add('show');
    // Hide the signup form
    if (signupForm) {
      signupForm.style.display = 'none';
    }
  }
}

// Hide verification notice
function hideVerificationNotice() {
  if (verificationNotice) {
    verificationNotice.classList.remove('show');
  }
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

// Check password strength
function checkPasswordStrength(password) {
  let strength = 0;
  let feedback = '';
  
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
  if (password.match(/\d/)) strength++;
  if (password.match(/[^a-zA-Z\d]/)) strength++;
  
  // Update visual feedback
  strengthFill.className = 'strength-fill';
  strengthText.className = 'strength-text';
  
  if (password.length === 0) {
    strengthText.textContent = 'Password strength';
    return { strength: 0, valid: false };
  }
  
  if (strength <= 1) {
    strengthFill.classList.add('weak');
    strengthText.classList.add('weak');
    strengthText.textContent = 'Weak password';
    return { strength: 1, valid: false };
  } else if (strength <= 3) {
    strengthFill.classList.add('medium');
    strengthText.classList.add('medium');
    strengthText.textContent = 'Medium strength';
    return { strength: 2, valid: true };
  } else {
    strengthFill.classList.add('strong');
    strengthText.classList.add('strong');
    strengthText.textContent = 'Strong password';
    return { strength: 3, valid: true };
  }
}

// Check if passwords match
function checkPasswordMatch() {
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  if (confirmPassword.length === 0) {
    confirmHint.textContent = 'Passwords must match';
    confirmHint.className = 'input-hint';
    confirmPasswordInput.classList.remove('success', 'error');
    return false;
  }
  
  if (password === confirmPassword) {
    confirmHint.textContent = 'Passwords match!';
    confirmHint.className = 'input-hint success';
    confirmPasswordInput.classList.remove('error');
    confirmPasswordInput.classList.add('success');
    return true;
  } else {
    confirmHint.textContent = 'Passwords do not match';
    confirmHint.className = 'input-hint error';
    confirmPasswordInput.classList.remove('success');
    confirmPasswordInput.classList.add('error');
    return false;
  }
}

// Validate form inputs
function validateForm(email, password, confirmPassword) {
  // Reset styles
  emailInput.classList.remove('error', 'success');
  passwordInput.classList.remove('error', 'success');
  confirmPasswordInput.classList.remove('error', 'success');
  
  if (!email || !password || !confirmPassword) {
    showNotification('Please fill in all fields', 'error');
    return false;
  }
  
  if (!isValidEmail(email)) {
    showNotification('Please enter a valid email address', 'error');
    emailInput.classList.add('error');
    emailInput.focus();
    return false;
  } else {
    emailInput.classList.add('success');
  }
  
  // Check password strength
  const strengthResult = checkPasswordStrength(password);
  if (!strengthResult.valid) {
    showNotification('Please use a stronger password (min 8 characters with mix of letters, numbers, and symbols)', 'error');
    passwordInput.classList.add('error');
    passwordInput.focus();
    return false;
  } else {
    passwordInput.classList.add('success');
  }
  
  // Check password match
  if (!checkPasswordMatch()) {
    showNotification('Passwords do not match', 'error');
    confirmPasswordInput.focus();
    return false;
  }
  
  if (!agreeTerms.checked) {
    showNotification('Please agree to the Terms of Service and Privacy Policy', 'error');
    agreeTerms.focus();
    return false;
  }
  
  return true;
}

// Create user profile in Firestore
async function createUserProfile(user, email) {
  try {
    await db.collection('users').doc(user.uid).set({
      email: email,
      displayName: email.split('@')[0],
      role: 'user',
      walletBalance: 0,
      tournamentsJoined: 0,
      tournamentsWon: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      newsletterSubscribed: newsletter.checked,
      emailVerified: false
    });
    console.log('User profile created successfully');
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new Error('Failed to create user profile');
  }
}

// FIXED: Send email verification for GitHub Pages
async function sendEmailVerification(user) {
  try {
    console.log('Sending email verification for GitHub Pages...');
    
    // Use GitHub Pages URL as redirect
    const actionCodeSettings = {
      url: 'https://mishbahop.github.io/tournamnt/login.html',
      handleCodeInApp: false
    };
    
    console.log('Using GitHub Pages redirect URL:', actionCodeSettings.url);
    
    await user.sendEmailVerification(actionCodeSettings);
    console.log('Verification email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    
    let errorMessage = 'Failed to send verification email. ';
    
    switch (error.code) {
      case 'auth/too-many-requests':
        errorMessage += 'Too many attempts. Please try again later.';
        break;
      case 'auth/user-not-found':
        errorMessage += 'User not found.';
        break;
      case 'auth/invalid-email':
        errorMessage += 'Invalid email address.';
        break;
      case 'auth/network-request-failed':
        errorMessage += 'Network error. Please check your connection.';
        break;
      case 'auth/unauthorized-continue-uri':
        // Fallback: try without custom redirect
        try {
          console.log('Custom redirect failed, trying without redirect...');
          await user.sendEmailVerification();
          console.log('Fallback: Email sent without custom redirect');
          return true;
        } catch (fallbackError) {
          errorMessage += ' Please make sure "mishbahop.github.io" is added to authorized domains in Firebase Console.';
          throw new Error(errorMessage);
        }
      default:
        errorMessage += error.message || 'Please try again later.';
    }
    
    throw new Error(errorMessage);
  }
}

// Resend verification email
async function resendVerificationEmail() {
  if (!currentUser) {
    showNotification('No user found. Please sign up again.', 'error');
    return;
  }
  
  try {
    resendVerificationBtn.disabled = true;
    resendVerificationBtn.innerHTML = '<span class="btn-text">Sending...</span>';
    
    await sendEmailVerification(currentUser);
    showNotification('Verification email sent successfully! Check your inbox.', 'success');
    
    // Re-enable button after 30 seconds
    setTimeout(() => {
      resendVerificationBtn.disabled = false;
      resendVerificationBtn.innerHTML = '<span class="btn-text">Resend Verification Email</span>';
    }, 30000);
    
  } catch (error) {
    console.error('Error resending verification email:', error);
    showNotification(error.message, 'error');
    resendVerificationBtn.disabled = false;
    resendVerificationBtn.innerHTML = '<span class="btn-text">Resend Verification Email</span>';
  }
}

// Toggle password visibility
function togglePasswordVisibility(inputElement, toggleButton) {
  const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
  inputElement.setAttribute('type', type);
  
  // Update toggle button icon
  const toggleIcon = toggleButton.querySelector('.toggle-icon');
  toggleIcon.textContent = type === 'password' ? '👁️' : '🔒';
}

// Handle signup form submission
async function handleSignup(event) {
  event.preventDefault();
  
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();
  
  // Validate form
  if (!validateForm(email, password, confirmPassword)) {
    return;
  }
  
  // Show loading state
  signupBtn.classList.add('loading');
  signupBtn.disabled = true;
  
  try {
    console.log('Attempting signup...');
    showNotification('Creating your account...', 'info');
    
    // Create user with Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    currentUser = userCredential.user;
    
    console.log('Signup successful:', currentUser.email);
    
    // Create user profile in Firestore
    await createUserProfile(currentUser, email);
    
    // Send email verification
    try {
      await sendEmailVerification(currentUser);
      showNotification(`Welcome to TourneyHub! Verification email sent to ${currentUser.email}`, 'success');
    } catch (verificationError) {
      console.error('Verification email failed:', verificationError);
      // Don't fail the entire signup if verification email fails
      showNotification(`Account created! But verification email failed: ${verificationError.message}`, 'warning');
    }
    
    // Show verification notice
    showVerificationNotice();
    
  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle specific error cases
    let errorMessage = 'Signup failed. Please try again.';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'This email is already registered. Please login instead.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address format.';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password is too weak. Please use a stronger password.';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Email/password accounts are not enabled. Please contact support.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many attempts. Please try again later.';
        break;
      default:
        errorMessage = error.message || 'Signup failed. Please try again.';
    }
    
    showNotification(errorMessage, 'error');
  } finally {
    // Reset loading state
    signupBtn.classList.remove('loading');
    signupBtn.disabled = false;
  }
}

// Continue to login
function continueToLogin() {
  window.location.href = 'login.html';
}

// Event Listeners
function setupEventListeners() {
  // Form submission
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }
  
  // Password visibility toggles
  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      togglePasswordVisibility(passwordInput, passwordToggle);
    });
  }
  
  if (confirmPasswordToggle) {
    confirmPasswordToggle.addEventListener('click', () => {
      togglePasswordVisibility(confirmPasswordInput, confirmPasswordToggle);
    });
  }
  
  // Real-time password strength checking
  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      checkPasswordStrength(passwordInput.value);
      checkPasswordMatch();
    });
  }
  
  // Real-time password match checking
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
  }
  
  // Email validation on blur
  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      const email = emailInput.value.trim();
      if (email && !isValidEmail(email)) {
        emailInput.classList.add('error');
        emailHint.textContent = 'Please enter a valid email address';
        emailHint.className = 'input-hint error';
      } else if (email) {
        emailInput.classList.remove('error');
        emailInput.classList.add('success');
        emailHint.textContent = 'Valid email address';
        emailHint.className = 'input-hint success';
      } else {
        emailInput.classList.remove('error', 'success');
        emailHint.textContent = 'We\'ll send a verification link to this email';
        emailHint.className = 'input-hint';
      }
    });
  }
  
  // Toast close button
  if (toastClose) {
    toastClose.addEventListener('click', hideNotification);
  }
  
  // Resend verification button
  if (resendVerificationBtn) {
    resendVerificationBtn.addEventListener('click', resendVerificationEmail);
  }
  
  // Continue to login button
  if (continueToLoginBtn) {
    continueToLoginBtn.addEventListener('click', continueToLogin);
  }
  
  // Enter key to submit form
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSignup(e);
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
}, 5000);