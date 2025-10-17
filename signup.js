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
try {
  firebase.initializeApp(firebaseConfig);
  console.log('🎯 Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

const auth = firebase.auth();
const db = firebase.firestore();

// =============================================
// 🎯 DOM ELEMENTS
// =============================================

// 🖼️ Layout Elements
const loadingScreen = document.getElementById('loadingScreen');
const mainContent = document.getElementById('mainContent');
const signupForm = document.getElementById('signupForm');
const verificationNotice = document.getElementById('verificationNotice');

// 📝 Form Inputs
const emailInput = document.getElementById('signup-email');
const passwordInput = document.getElementById('signup-password');
const confirmPasswordInput = document.getElementById('confirm-password');

// 👁️ Password Toggles
const passwordToggle = document.getElementById('passwordToggle');
const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');

// 🔘 Buttons
const signupBtn = document.getElementById('signupBtn');
const resendVerificationBtn = document.getElementById('resendVerification');
const continueToLoginBtn = document.getElementById('continueToLogin');

// 🎛️ Form Elements
const agreeTerms = document.getElementById('agreeTerms');
const newsletter = document.getElementById('newsletter');
const signupSpinner = document.getElementById('signupSpinner');

// 💬 Hints & Feedback
const emailHint = document.getElementById('emailHint');
const passwordStrength = document.getElementById('passwordStrength');
const strengthFill = document.getElementById('strengthFill');
const strengthText = document.getElementById('strengthText');
const confirmHint = document.getElementById('confirmHint');

// 🔔 Notifications
const notificationToast = document.getElementById('notificationToast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');
const toastClose = document.getElementById('toastClose');

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
    loadingScreen?.classList.add('hidden');
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
    verificationNotice.classList.add('show');
    signupForm.style.display = 'none';
    
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
  if (isLoading) {
    button.classList.add('loading');
    button.disabled = true;
  } else {
    button.classList.remove('loading');
    button.disabled = false;
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
  let strength = 0;
  const feedback = [];

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
    return { strength: 0, valid: false, feedback: [] };
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
  const password = passwordInput.value;
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
  if (!agreeTerms.checked) {
    showNotification('📜 Please agree to the Terms of Service and Privacy Policy', 'error');
    agreeTerms.focus();
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
async function createUserProfile(user, email) {
  try {
    const userData = {
      email: email,
      displayName: email.split('@')[0],
      role: 'user',
      walletBalance: 0,
      tournamentsJoined: 0,
      tournamentsWon: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      newsletterSubscribed: newsletter.checked,
      emailVerified: false,
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

    // Fallback: Try without custom redirect
    if (error.code === 'auth/unauthorized-continue-uri') {
      try {
        console.log('🔄 Trying fallback without custom redirect...');
        await user.sendEmailVerification();
        console.log('✅ Fallback email sent successfully');
        return true;
      } catch (fallbackError) {
        throw new Error('Please add "mishbahop.github.io" to authorized domains in Firebase Console');
      }
    }

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

// =============================================
// 🎛️ UI INTERACTION FUNCTIONS
// =============================================

/**
 * 👁️ Toggle password visibility
 */
function togglePasswordVisibility(inputElement, toggleButton) {
  const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
  inputElement.setAttribute('type', type);
  
  const toggleIcon = toggleButton.querySelector('.toggle-icon');
  toggleIcon.textContent = type === 'password' ? '👁️' : '🔒';
  
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
  
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();

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

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideNotification();
    }
  });

  // Enter key to submit form
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !state.isSubmitting) {
        handleSignup(e);
      }
    });
  }
}

// =============================================
// 🎉 APPLICATION START
// =============================================

/**
 * 🏃‍♂️ Start the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('🎊 DOM fully loaded - Starting TourneyHub');
  
  setupEventListeners();
  initApp();
  
  // Add some fun console messages
  console.log('🌈 Welcome to TourneyHub! Ready for some tournaments? 🏆');
});

/**
 * 🕐 Fallback: Force show content if loading takes too long
 */
setTimeout(() => {
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
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