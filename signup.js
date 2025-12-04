// =============================================
// 🏆 TOURNEYHUB - SIGNUP SCRIPT
// =============================================

// 🔧 Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
  authDomain: "authapp-386ee.firebaseapp.com",
  projectId: "authapp-386ee",
  storageBucket: "authapp-386ee.firebasestorage.app",
  messagingSenderId: "809698525310",
  appId: "1:809698525310:web:5cb7de80bde9ed1f26982f",
  measurementId: "G-EJZTSBSGQT"
};

// 🚀 Initialize Firebase
let auth, db;

// =============================================
// 🎯 DOM ELEMENTS
// =============================================

let loadingScreen, mainContent, signupForm, verificationNotice;
let emailInput, passwordInput, confirmPasswordInput;
let passwordToggle, confirmPasswordToggle;
let signupBtn, resendVerificationBtn, continueToLoginBtn;
let agreeTerms, newsletter, signupSpinner;
let emailHint, passwordStrength, strengthFill, strengthText, confirmHint;
let notificationToast, toastIcon, toastMessage, toastClose;

// =============================================
// 🎮 STATE MANAGEMENT
// =============================================

const state = {
  passwordValid: false,
  passwordsMatch: false,
  currentUser: null,
  isSubmitting: false
};

// =============================================
// 🎨 ANIMATION & UI FUNCTIONS
// =============================================

/**
 * 🎭 Show elegant notification toast
 */
function showNotification(message, type = 'info') {
  if (!notificationToast) return;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  toastIcon.textContent = icons[type] || icons.info;
  toastMessage.textContent = message;
  notificationToast.className = `notification-toast show ${type}`;

  // Auto-hide with different timing based on type
  const hideTime = type === 'error' ? 8000 : 5000;
  setTimeout(hideNotification, hideTime);
}

/**
 * 🎭 Hide notification toast
 */
function hideNotification() {
  if (notificationToast) {
    notificationToast.classList.remove('show');
  }
}

/**
 * 🎯 Show main content with smooth transition
 */
function showMainContent() {
  setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.pointerEvents = 'none';
    }
    if (mainContent) {
      mainContent.style.opacity = '1';
      mainContent.style.transform = 'translateY(0)';
    }
  }, 1000);
}

/**
 * 📧 Show verification notice
 */
function showVerificationNotice() {
  if (verificationNotice) {
    signupForm.style.display = 'none';
    verificationNotice.style.display = 'block';
    
    // Add entrance animation
    setTimeout(() => {
      verificationNotice.style.transform = 'scale(1)';
      verificationNotice.style.opacity = '1';
    }, 100);
  }
}

/**
 * 🔄 Set button loading state
 */
function setButtonLoading(button, isLoading) {
  if (!button) return;
  
  if (isLoading) {
    button.classList.add('loading');
    button.disabled = true;
    if (signupSpinner) {
      signupSpinner.style.display = 'block';
    }
  } else {
    button.classList.remove('loading');
    button.disabled = false;
    if (signupSpinner) {
      signupSpinner.style.display = 'none';
    }
  }
}

// =============================================
// 🔐 VALIDATION FUNCTIONS
// =============================================

/**
 * ✉️ Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 💪 Check password strength with detailed analysis
 */
function checkPasswordStrength(password) {
  if (!strengthFill || !strengthText) return { strength: 0, valid: false };

  let strength = 0;
  
  // Criteria checks
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]/)) strength++;
  if (password.match(/[A-Z]/)) strength++;
  if (password.match(/\d/)) strength++;
  if (password.match(/[^a-zA-Z\d]/)) strength++;

  // Reset visual state
  strengthFill.className = 'strength-fill';
  strengthText.className = 'strength-text';

  if (password.length === 0) {
    strengthText.textContent = 'Password strength';
    state.passwordValid = false;
    return { strength: 0, valid: false };
  }

  // Determine strength level
  if (strength <= 2) {
    strengthFill.classList.add('weak');
    strengthText.classList.add('weak');
    strengthText.textContent = 'Weak password';
    state.passwordValid = false;
  } else if (strength <= 4) {
    strengthFill.classList.add('medium');
    strengthText.classList.add('medium');
    strengthText.textContent = 'Medium strength';
    state.passwordValid = true;
  } else {
    strengthFill.classList.add('strong');
    strengthText.classList.add('strong');
    strengthText.textContent = 'Strong password';
    state.passwordValid = true;
  }

  return { strength, valid: state.passwordValid };
}

/**
 * 🔄 Check if passwords match
 */
function checkPasswordMatch() {
  if (!confirmPasswordInput || !confirmHint) return false;
  
  const password = passwordInput ? passwordInput.value : '';
  const confirmPassword = confirmPasswordInput.value;

  if (confirmPassword.length === 0) {
    confirmHint.textContent = 'Passwords must match';
    confirmHint.className = 'input-hint';
    confirmPasswordInput.classList.remove('success', 'error');
    state.passwordsMatch = false;
    return false;
  }

  if (password === confirmPassword) {
    confirmHint.textContent = '🎉 Passwords match!';
    confirmHint.className = 'input-hint success';
    confirmPasswordInput.classList.remove('error');
    confirmPasswordInput.classList.add('success');
    state.passwordsMatch = true;
    return true;
  } else {
    confirmHint.textContent = '❌ Passwords do not match';
    confirmHint.className = 'input-hint error';
    confirmPasswordInput.classList.remove('success');
    confirmPasswordInput.classList.add('error');
    state.passwordsMatch = false;
    return false;
  }
}

/**
 * 📋 Comprehensive form validation
 */
function validateForm(email, password, confirmPassword) {
  if (!emailInput || !passwordInput || !confirmPasswordInput) return false;
  
  // Reset all styles
  emailInput.classList.remove('error', 'success');
  passwordInput.classList.remove('error', 'success');
  confirmPasswordInput.classList.remove('error', 'success');

  // Check empty fields
  if (!email || !password || !confirmPassword) {
    showNotification('📝 Please fill in all fields', 'error');
    return false;
  }

  // Validate email format
  if (!isValidEmail(email)) {
    showNotification('📧 Please enter a valid email address', 'error');
    emailInput.classList.add('error');
    emailInput.focus();
    return false;
  } else {
    emailInput.classList.add('success');
  }

  // Check password strength
  const strengthResult = checkPasswordStrength(password);
  if (!strengthResult.valid) {
    showNotification('🔒 Please use a stronger password (min 8 characters with mix of letters, numbers, and symbols)', 'error');
    passwordInput.classList.add('error');
    passwordInput.focus();
    return false;
  } else {
    passwordInput.classList.add('success');
  }

  // Check password match
  if (!checkPasswordMatch()) {
    showNotification('🔑 Passwords do not match', 'error');
    confirmPasswordInput.focus();
    return false;
  }

  // Check terms agreement
  if (!agreeTerms || !agreeTerms.checked) {
    showNotification('📜 Please agree to the Terms of Service and Privacy Policy', 'error');
    if (agreeTerms) agreeTerms.focus();
    return false;
  }

  return true;
}

// =============================================
// 🔥 FIREBASE FUNCTIONS
// =============================================

/**
 * 👤 Create user profile in Firestore
 */
async function createUserProfile(user, email, displayName = null) {
  try {
    const userData = {
      email: email,
      displayName: displayName || email.split('@')[0],
      role: 'user',
      walletBalance: 0,
      tournamentsJoined: 0,
      tournamentsWon: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      newsletterSubscribed: newsletter ? newsletter.checked : false,
      emailVerified: user.emailVerified,
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(user.uid).set(userData);
    console.log('✅ User profile created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error creating user profile:', error);
    throw new Error('Failed to create user profile');
  }
}

/**
 * 📨 Send email verification with GitHub Pages support
 */
async function sendEmailVerification(user) {
  try {
    console.log('📧 Sending email verification...');

    // Use GitHub Pages URL for redirect
    const actionCodeSettings = {
      url: 'https://mishbahop.github.io/tournamnt/login.html',
      handleCodeInApp: false
    };

    await user.sendEmailVerification(actionCodeSettings);
    console.log('✅ Verification email sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Email verification error:', error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

/**
 * 🔄 Resend verification email
 */
async function resendVerificationEmail() {
  if (!state.currentUser) {
    showNotification('❌ No user found. Please sign up again.', 'error');
    return;
  }

  try {
    setButtonLoading(resendVerificationBtn, true);
    resendVerificationBtn.innerHTML = '<span class="btn-text">Sending...</span>';

    await sendEmailVerification(state.currentUser);
    showNotification('✅ Verification email sent! Check your inbox.', 'success');

    // Disable resend for 30 seconds
    setTimeout(() => {
      setButtonLoading(resendVerificationBtn, false);
      resendVerificationBtn.innerHTML = '<span class="btn-text">Resend Verification Email</span>';
    }, 30000);

  } catch (error) {
    console.error('❌ Resend error:', error);
    showNotification(error.message, 'error');
    setButtonLoading(resendVerificationBtn, false);
    resendVerificationBtn.innerHTML = '<span class="btn-text">Resend Verification Email</span>';
  }
}

/**
 * 🎮 Handle Google Signup
 */
async function handleGoogleSignup() {
  const provider = new firebase.auth.GoogleAuthProvider();

  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    // Create user profile if new user
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      await createUserProfile(user, user.email, user.displayName);
    }

    showNotification('✅ Google sign-in successful!', 'success');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
  } catch (error) {
    console.error('❌ Google sign-in error:', error);
    showNotification(`Google sign-in failed: ${error.message}`, 'error');
  }
}

// =============================================
// 🎛️ UI INTERACTION FUNCTIONS
// =============================================

/**
 * 👁️ Toggle password visibility
 */
function togglePasswordVisibility(inputElement, toggleButton) {
  if (!inputElement || !toggleButton) return;
  
  const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
  inputElement.setAttribute('type', type);
  
  const toggleIcon = toggleButton.querySelector('.toggle-icon');
  if (toggleIcon) {
    toggleIcon.textContent = type === 'password' ? '👁️' : '🔒';
  }
  
  // Add smooth animation
  toggleButton.style.transform = 'scale(0.95)';
  setTimeout(() => {
    toggleButton.style.transform = 'scale(1)';
  }, 150);
}

/**
 * 📧 Handle email input with real-time validation
 */
function handleEmailInput() {
  if (!emailInput || !emailHint) return;
  
  const email = emailInput.value.trim();
  
  if (email && !isValidEmail(email)) {
    emailInput.classList.add('error');
    emailHint.textContent = '❌ Please enter a valid email address';
    emailHint.className = 'input-hint error';
  } else if (email) {
    emailInput.classList.remove('error');
    emailInput.classList.add('success');
    emailHint.textContent = '✅ Valid email address';
    emailHint.className = 'input-hint success';
  } else {
    emailInput.classList.remove('error', 'success');
    emailHint.textContent = '📧 We\'ll send a verification link to this email';
    emailHint.className = 'input-hint';
  }
}

// =============================================
// 🚀 MAIN SIGNUP FUNCTION
// =============================================

/**
 * 🎯 Handle signup form submission
 */
async function handleSignup(event) {
  event.preventDefault();
  
  if (state.isSubmitting) return;
  
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : '';

  // Validate form
  if (!validateForm(email, password, confirmPassword)) {
    return;
  }

  // Set loading state
  state.isSubmitting = true;
  setButtonLoading(signupBtn, true);
  showNotification('🔄 Creating your account...', 'info');

  try {
    console.log('🚀 Starting signup process...');

    // Create user with Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    state.currentUser = userCredential.user;

    console.log('✅ Firebase Auth user created:', state.currentUser.uid);

    // Create user profile in Firestore
    await createUserProfile(state.currentUser, email);

    // Send verification email
    await sendEmailVerification(state.currentUser);

    // Show success state
    showNotification(`🎉 Welcome to TourneyHub, ${state.currentUser.email.split('@')[0]}! Verification email sent.`, 'success');
    
    // Show verification notice with delay for better UX
    setTimeout(() => {
      showVerificationNotice();
    }, 1500);

  } catch (error) {
    console.error('❌ Signup error:', error);
    
    const errorMessages = {
      'auth/email-already-in-use': '📧 This email is already registered. Please login instead.',
      'auth/invalid-email': '❌ Invalid email address format.',
      'auth/weak-password': '🔒 Password is too weak. Please use a stronger password.',
      'auth/operation-not-allowed': '⚙️ Email/password accounts are not enabled. Please contact support.',
      'auth/network-request-failed': '📡 Network error. Please check your connection.',
      'auth/too-many-requests': '🚫 Too many attempts. Please try again later.'
    };

    const errorMessage = errorMessages[error.code] || `Signup failed: ${error.message}`;
    showNotification(errorMessage, 'error');

  } finally {
    state.isSubmitting = false;
    setButtonLoading(signupBtn, false);
  }
}

// =============================================
// 🎪 APPLICATION INITIALIZATION
// =============================================

/**
 * 🏁 Initialize the application
 */
function initApp() {
  console.log('🎮 Initializing TourneyHub Signup...');

  // Check authentication state
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('🔐 User session found:', user.email);
      state.currentUser = user;

      if (user.emailVerified) {
        showNotification('✅ Welcome back! Redirecting to dashboard...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 2000);
      } else {
        showMainContent();
        showVerificationNotice();
      }
    } else {
      showMainContent();
    }
  });
}

/**
 * 🎯 Setup all event listeners
 */
function setupEventListeners() {
  console.log('🔌 Setting up event listeners...');
  
  // Form submission - FIXED: Properly attach the handler
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
    console.log('✅ Form submit listener attached');
  }

  // Also attach click event to signup button as backup
  if (signupBtn) {
    signupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSignup(e);
    });
    console.log('✅ Button click listener attached');
  }

  // Password visibility toggles
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      togglePasswordVisibility(passwordInput, passwordToggle);
    });
  }

  if (confirmPasswordToggle && confirmPasswordInput) {
    confirmPasswordToggle.addEventListener('click', () => {
      togglePasswordVisibility(confirmPasswordInput, confirmPasswordToggle);
    });
  }

  // Real-time validation
  if (emailInput) {
    emailInput.addEventListener('input', handleEmailInput);
    emailInput.addEventListener('blur', handleEmailInput);
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      checkPasswordStrength(passwordInput.value);
      checkPasswordMatch();
    });
  }

  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
  }

  // Notification close
  if (toastClose) {
    toastClose.addEventListener('click', hideNotification);
  }

  // Verification actions
  if (resendVerificationBtn) {
    resendVerificationBtn.addEventListener('click', resendVerificationEmail);
  }

  if (continueToLoginBtn) {
    continueToLoginBtn.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  }

  // Google Signup
  const googleSignupBtn = document.getElementById('googleSignupBtn');
  if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', handleGoogleSignup);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideNotification();
    }
  });
}

// =============================================
// 🎉 APPLICATION START
// =============================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🎊 DOM fully loaded - Starting TourneyHub');
  
  try {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    showNotification('Failed to initialize app. Please refresh the page.', 'error');
    return;
  }
  
  // 🖼️ Layout Elements
  loadingScreen = document.getElementById('loadingScreen');
  mainContent = document.getElementById('mainContent');
  signupForm = document.getElementById('signupForm');
  verificationNotice = document.getElementById('verificationNotice');

  // 📝 Form Inputs
  emailInput = document.getElementById('signup-email');
  passwordInput = document.getElementById('signup-password');
  confirmPasswordInput = document.getElementById('confirm-password');

  // 👁️ Password Toggles
  passwordToggle = document.getElementById('passwordToggle');
  confirmPasswordToggle = document.getElementById('confirmPasswordToggle');

  // 🔘 Buttons
  signupBtn = document.getElementById('signupBtn');
  resendVerificationBtn = document.getElementById('resendVerification');
  continueToLoginBtn = document.getElementById('continueToLogin');

  // 🎛️ Form Elements
  agreeTerms = document.getElementById('agreeTerms');
  newsletter = document.getElementById('newsletter');
  signupSpinner = document.getElementById('signupSpinner');

  // 💬 Hints & Feedback
  emailHint = document.getElementById('emailHint');
  passwordStrength = document.getElementById('passwordStrength');
  strengthFill = document.getElementById('strengthFill');
  strengthText = document.getElementById('strengthText');
  confirmHint = document.getElementById('confirmHint');

  // 🔔 Notifications
  notificationToast = document.getElementById('notificationToast');
  toastIcon = document.getElementById('toastIcon');
  toastMessage = document.getElementById('toastMessage');
  toastClose = document.getElementById('toastClose');

  setupEventListeners();
  initApp();
  
  console.log('🌈 Welcome to TourneyHub! Ready for some tournaments? 🏆');
});

/**
 * 🕐 Fallback: Force show content if loading takes too long
 */
setTimeout(() => {
  if (loadingScreen && !loadingScreen.classList.contains('hidden') && loadingScreen.style.opacity !== '0') {
    console.log('⏰ Loading timeout - Showing content');
    showMainContent();
  }
}, 5000);

// =============================================
// 🎁 EXPORT FUNCTIONS FOR GLOBAL ACCESS
// =============================================

window.TourneyHub = {
  handleSignup,
  togglePasswordVisibility,
  checkPasswordStrength,
  resendVerificationEmail,
  showNotification,
  hideNotification
};

console.log('🎯 TourneyHub Signup Script Loaded Successfully!');