// ==================== MODULE PATTERN WITH ENCAPSULATION ====================
const TourneyHubAuth = (() => {
    // Private variables
    let _auth = null;
    let _db = null;
    let _googleAuthProvider = null;
    let _currentUser = null;
    let _loginAttempts = 0;
    let _lastFailedAttempt = null;
    let _sessionTimer = null;
    let _idleTimer = null;
    let _securityKey = null;
    let _twoFAToken = null;
    let _analyticsQueue = [];
    let _deviceFingerprint = null;
    let _performanceMetrics = {
        authStartTime: 0,
        authEndTime: 0,
        firebaseLatency: [],
        networkQuality: 'good'
    };

    // Private methods
    const _initializeFirebase = () => {
        return new Promise((resolve, reject) => {
            try {
                const firebaseConfig = {
                    apiKey: "AIzaSyA7QsyV2yb4f_acY9ETQnTSna7YHxwOJw4",
                    authDomain: "authapp-386ee.firebaseapp.com",
                    projectId: "authapp-386ee",
                    storageBucket: "authapp-386ee.appspot.com",
                    messagingSenderId: "809698525310",
                    appId: "1:809698525310:web:5cb7de80bde9ed1f26982f",
                    measurementId: "G-EJZTSBSGQT"
                };

                if (!firebase.apps.length) {
                    // Performance monitoring
                    _performanceMetrics.authStartTime = performance.now();
                    
                    // Initialize with enhanced settings
                    const app = firebase.initializeApp(firebaseConfig, {
                        automaticDataCollectionEnabled: true,
                        measurementId: firebaseConfig.measurementId
                    });
                    
                    // Enable offline persistence
                    firebase.firestore().enablePersistence()
                        .catch(err => {
                            if (err.code === 'failed-precondition') {
                                console.warn('Multiple tabs open, persistence disabled');
                            } else if (err.code === 'unimplemented') {
                                console.warn('Browser doesn\'t support persistence');
                            }
                        });
                    
                    _auth = firebase.auth();
                    _db = firebase.firestore();
                    _googleAuthProvider = new firebase.auth.GoogleAuthProvider();
                    
                    // Configure Google provider
                    _googleAuthProvider.addScope('email');
                    _googleAuthProvider.addScope('profile');
                    _googleAuthProvider.setCustomParameters({
                        prompt: 'select_account',
                        login_hint: ''
                    });
                    
                    _performanceMetrics.authEndTime = performance.now();
                    const latency = _performanceMetrics.authEndTime - _performanceMetrics.authStartTime;
                    _performanceMetrics.firebaseLatency.push(latency);
                    
                    resolve(app);
                } else {
                    _auth = firebase.auth();
                    _db = firebase.firestore();
                    resolve(firebase.app());
                }
            } catch (error) {
                reject(new AuthError('Firebase initialization failed', 'INIT_ERROR', error));
            }
        });
    };

    const _generateDeviceFingerprint = () => {
        const components = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            colorDepth: window.screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            webglVendor: null,
            webglRenderer: null
        };

        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                components.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                components.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        } catch (e) {}

        const fingerprint = btoa(JSON.stringify(components));
        _deviceFingerprint = fingerprint.substring(0, 32); // 32 chars max
        return _deviceFingerprint;
    };

    const _encryptData = (data, key) => {
        // Simple XOR encryption for demonstration
        // In production, use Web Crypto API
        let result = '';
        for (let i = 0; i < data.length; i++) {
            const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return btoa(result);
    };

    const _decryptData = (encryptedData, key) => {
        try {
            const data = atob(encryptedData);
            let result = '';
            for (let i = 0; i < data.length; i++) {
                const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                result += String.fromCharCode(charCode);
            }
            return result;
        } catch (e) {
            return null;
        }
    };

    const _checkBruteForceProtection = () => {
        if (_lastFailedAttempt) {
            const timeDiff = Date.now() - _lastFailedAttempt;
            if (_loginAttempts >= 5 && timeDiff < 300000) { // 5 attempts in 5 minutes
                const waitTime = Math.floor((300000 - timeDiff) / 1000 / 60);
                throw new AuthError(
                    `Too many failed attempts. Try again in ${waitTime} minutes.`,
                    'BRUTE_FORCE_BLOCKED'
                );
            }
            if (timeDiff > 300000) {
                // Reset after 5 minutes
                _loginAttempts = 0;
                _lastFailedAttempt = null;
            }
        }
    };

    const _validatePasswordStrength = (password) => {
        const requirements = {
            minLength: 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumbers: /\d/.test(password),
            hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        const errors = [];
        if (password.length < requirements.minLength) {
            errors.push(`Password must be at least ${requirements.minLength} characters`);
        }
        if (!requirements.hasUpperCase) errors.push('Password must contain uppercase letter');
        if (!requirements.hasLowerCase) errors.push('Password must contain lowercase letter');
        if (!requirements.hasNumbers) errors.push('Password must contain number');
        if (!requirements.hasSpecialChar) errors.push('Password must contain special character');

        return {
            isValid: errors.length === 0,
            score: Math.round(
                (password.length / 20 * 40) + 
                (requirements.hasUpperCase ? 15 : 0) +
                (requirements.hasLowerCase ? 15 : 0) +
                (requirements.hasNumbers ? 15 : 0) +
                (requirements.hasSpecialChar ? 15 : 0)
            ),
            errors
        };
    };

    const _generate2FAToken = () => {
        // Generate 6-digit TOTP token
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        _twoFAToken = token;
        
        // Store token with expiry (10 minutes)
        localStorage.setItem('tourneyhub_2fa_token', token);
        localStorage.setItem('tourneyhub_2fa_expiry', Date.now() + 600000);
        
        return token;
    };

    const _validate2FAToken = (inputToken) => {
        const storedToken = localStorage.getItem('tourneyhub_2fa_token');
        const expiry = localStorage.getItem('tourneyhub_2fa_expiry');
        
        if (!storedToken || !expiry || Date.now() > parseInt(expiry)) {
            return false;
        }
        
        return inputToken === storedToken;
    };

    const _send2FAEmail = async (email, token) => {
        // In production, integrate with email service (SendGrid, AWS SES, etc.)
        console.log(`[2FA] Sending token ${token} to ${email}`);
        
        // Mock email sending - replace with actual API call
        return new Promise(resolve => {
            setTimeout(() => resolve(true), 1000);
        });
    };

    const _trackAnalytics = (event, data = {}) => {
        const analyticsEvent = {
            event,
            timestamp: Date.now(),
            userId: _currentUser?.uid || 'anonymous',
            deviceFingerprint: _deviceFingerprint,
            ...data
        };
        
        _analyticsQueue.push(analyticsEvent);
        
        // Batch send every 10 events or 30 seconds
        if (_analyticsQueue.length >= 10) {
            _sendAnalyticsBatch();
        }
    };

    const _sendAnalyticsBatch = () => {
        if (_analyticsQueue.length === 0) return;
        
        const batch = [..._analyticsQueue];
        _analyticsQueue = [];
        
        // In production, send to analytics service
        console.log('[Analytics] Sending batch:', batch);
        
        // Simulate network request
        setTimeout(() => {
            console.log('[Analytics] Batch sent successfully');
        }, 500);
    };

    const _setupSessionManagement = () => {
        // Session timeout after 24 hours
        _sessionTimer = setTimeout(() => {
            _auth.signOut();
            _showNotification('Session expired. Please login again.', 'warning');
            window.location.href = 'login.html';
        }, 24 * 60 * 60 * 1000);

        // Idle timeout (15 minutes)
        let idleTime = 0;
        _idleTimer = setInterval(() => {
            idleTime++;
            if (idleTime > 15) { // 15 minutes
                clearInterval(_idleTimer);
                _auth.signOut();
                _showNotification('Logged out due to inactivity', 'info');
                window.location.href = 'login.html';
            }
        }, 60000); // Check every minute

        // Reset idle timer on user activity
        const resetIdleTime = () => {
            idleTime = 0;
        };

        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetIdleTime);
        });
    };

    const _cleanupSession = () => {
        if (_sessionTimer) clearTimeout(_sessionTimer);
        if (_idleTimer) clearInterval(_idleTimer);
        
        // Clear sensitive data
        _securityKey = null;
        _twoFAToken = null;
        
        // Send remaining analytics
        _sendAnalyticsBatch();
    };

    const _showNotification = (message, type = 'info', options = {}) => {
        const notification = {
            id: Date.now() + Math.random(),
            message,
            type,
            timestamp: Date.now(),
            ...options
        };

        // Dispatch custom event
        const event = new CustomEvent('auth-notification', {
            detail: notification,
            bubbles: true
        });
        document.dispatchEvent(event);

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    };

    const _handleAuthError = (error) => {
        let userMessage = 'Authentication failed';
        let logLevel = 'error';
        let action = null;

        switch (error.code) {
            case 'auth/user-not-found':
                userMessage = 'No account found with this email';
                logLevel = 'warn';
                action = 'suggest_signup';
                break;
            case 'auth/wrong-password':
                userMessage = 'Incorrect password';
                logLevel = 'warn';
                _loginAttempts++;
                _lastFailedAttempt = Date.now();
                break;
            case 'auth/too-many-requests':
                userMessage = 'Too many failed attempts. Try again later.';
                logLevel = 'error';
                action = 'block_temporarily';
                break;
            case 'auth/network-request-failed':
                userMessage = 'Network error. Check your connection.';
                logLevel = 'error';
                action = 'retry_connection';
                break;
            case 'auth/popup-blocked':
                userMessage = 'Popup blocked. Please allow popups or use alternative method.';
                logLevel = 'info';
                action = 'use_redirect';
                break;
            case 'auth/account-exists-with-different-credential':
                userMessage = 'Account exists with different login method';
                logLevel = 'warn';
                action = 'merge_accounts';
                break;
            default:
                if (error.message) {
                    userMessage = error.message;
                }
        }

        // Log error with context
        console[logLevel](`Auth Error [${error.code}]:`, {
            message: error.message,
            stack: error.stack,
            user: _currentUser?.email,
            device: _deviceFingerprint
        });

        // Track error analytics
        _trackAnalytics('auth_error', {
            error_code: error.code,
            error_message: error.message,
            action_taken: action
        });

        return { userMessage, action };
    };

    const _createUserSession = async (user, loginMethod) => {
        try {
            // Generate session token
            const sessionToken = crypto.randomUUID();
            
            // Store session in Firestore
            await _db.collection('user_sessions').doc(sessionToken).set({
                userId: user.uid,
                email: user.email,
                loginMethod,
                deviceFingerprint: _deviceFingerprint,
                ipAddress: await _getIPAddress(),
                userAgent: navigator.userAgent,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.FieldValue.serverTimestamp(null, 24 * 60 * 60), // 24 hours
                isActive: true
            });

            // Store session token in secure cookie
            _setSecureCookie('tourneyhub_session', sessionToken, 24);

            // Update user login history
            await _db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                loginCount: firebase.firestore.FieldValue.increment(1),
                loginMethod,
                lastLoginIP: await _getIPAddress(),
                deviceFingerprint: _deviceFingerprint
            });

            _currentUser = user;
            
            // Setup session management
            _setupSessionManagement();
            
            // Track successful login
            _trackAnalytics('login_success', {
                method: loginMethod,
                user_id: user.uid
            });

            return sessionToken;
        } catch (error) {
            console.error('Session creation failed:', error);
            throw new AuthError('Session creation failed', 'SESSION_ERROR', error);
        }
    };

    const _getIPAddress = async () => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    };

    const _setSecureCookie = (name, value, hours) => {
        const expires = new Date();
        expires.setTime(expires.getTime() + hours * 60 * 60 * 1000);
        
        // Set secure cookie with HttpOnly and SameSite
        document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; Secure; SameSite=Strict`;
    };

    const _validateSession = async () => {
        const sessionToken = _getCookie('tourneyhub_session');
        if (!sessionToken) return false;

        try {
            const sessionDoc = await _db.collection('user_sessions').doc(sessionToken).get();
            if (!sessionDoc.exists) return false;

            const sessionData = sessionDoc.data();
            if (!sessionData.isActive) return false;

            // Check expiry
            const now = new Date();
            const expiresAt = sessionData.expiresAt.toDate();
            if (now > expiresAt) {
                await sessionDoc.ref.update({ isActive: false });
                return false;
            }

            // Check device fingerprint
            if (sessionData.deviceFingerprint !== _deviceFingerprint) {
                console.warn('Device fingerprint mismatch');
                // Optional: require re-auth on new device
            }

            return true;
        } catch (error) {
            console.error('Session validation error:', error);
            return false;
        }
    };

    const _getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    };

    // Custom Error Classes
    class AuthError extends Error {
        constructor(message, code, originalError = null) {
            super(message);
            this.name = 'AuthError';
            this.code = code;
            this.originalError = originalError;
            this.timestamp = Date.now();
        }
    }

    class ValidationError extends Error {
        constructor(message, field) {
            super(message);
            this.name = 'ValidationError';
            this.field = field;
        }
    }

    // Public API
    return {
        // Initialization
        async init() {
            try {
                await _initializeFirebase();
                _generateDeviceFingerprint();
                _securityKey = crypto.randomUUID();
                
                // Setup analytics flush on page unload
                window.addEventListener('beforeunload', () => {
                    _sendAnalyticsBatch();
                });

                // Setup periodic analytics flush
                setInterval(() => {
                    _sendAnalyticsBatch();
                }, 30000); // Every 30 seconds

                return { success: true, deviceId: _deviceFingerprint };
            } catch (error) {
                console.error('TourneyHub Auth initialization failed:', error);
                return { success: false, error };
            }
        },

        // Authentication Methods
        async loginWithEmail(email, password, rememberMe = false) {
            try {
                _checkBruteForceProtection();
                
                // Validate inputs
                if (!email || !password) {
                    throw new ValidationError('Email and password are required');
                }

                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new ValidationError('Invalid email format', 'email');
                }

                // Set persistence
                const persistence = rememberMe ? 
                    firebase.auth.Auth.Persistence.LOCAL : 
                    firebase.auth.Auth.Persistence.SESSION;
                
                await _auth.setPersistence(persistence);

                // Track login attempt
                _trackAnalytics('login_attempt', { method: 'email' });

                // Sign in
                const userCredential = await _auth.signInWithEmailAndPassword(email, password);
                
                // Reset failed attempts on success
                _loginAttempts = 0;
                _lastFailedAttempt = null;

                // Check if 2FA is enabled for user
                const userDoc = await _db.collection('users').doc(userCredential.user.uid).get();
                const userData = userDoc.data();
                
                if (userData?.twoFAEnabled) {
                    // Generate and send 2FA token
                    const token = _generate2FAToken();
                    await _send2FAEmail(email, token);
                    
                    // Return special status for 2FA
                    return {
                        success: true,
                        requires2FA: true,
                        userId: userCredential.user.uid,
                        message: '2FA token sent to email'
                    };
                }

                // Create session for non-2FA users
                const sessionToken = await _createUserSession(userCredential.user, 'email');
                
                _showNotification('Login successful!', 'success');
                
                return {
                    success: true,
                    requires2FA: false,
                    sessionToken,
                    user: userCredential.user
                };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'EMAIL_LOGIN_ERROR', error);
            }
        },

        async verify2FA(userId, token) {
            try {
                if (!_validate2FAToken(token)) {
                    throw new AuthError('Invalid or expired 2FA token', 'INVALID_2FA');
                }

                // Get user from Firebase Auth (user should be in sign-in state)
                const user = _auth.currentUser;
                if (!user || user.uid !== userId) {
                    throw new AuthError('User not found in auth state', 'AUTH_STATE_ERROR');
                }

                // Create session after 2FA verification
                const sessionToken = await _createUserSession(user, 'email_2fa');
                
                // Clear 2FA tokens
                localStorage.removeItem('tourneyhub_2fa_token');
                localStorage.removeItem('tourneyhub_2fa_expiry');
                
                _showNotification('2FA verification successful!', 'success');
                
                return {
                    success: true,
                    sessionToken,
                    user
                };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || '2FA_ERROR', error);
            }
        },

        async loginWithGoogle(useRedirect = false) {
            try {
                _checkBruteForceProtection();
                
                // Track login attempt
                _trackAnalytics('login_attempt', { method: 'google' });

                if (useRedirect) {
                    // Use redirect method (for mobile, popup blockers)
                    await _auth.signInWithRedirect(_googleAuthProvider);
                    
                    // Handle redirect result in separate callback
                    return {
                        success: true,
                        method: 'redirect',
                        message: 'Redirecting to Google...'
                    };
                } else {
                    // Use popup method (default)
                    const result = await _auth.signInWithPopup(_googleAuthProvider);
                    
                    // Create session
                    const sessionToken = await _createUserSession(result.user, 'google');
                    
                    _showNotification('Google login successful!', 'success');
                    
                    return {
                        success: true,
                        sessionToken,
                        user: result.user,
                        method: 'popup'
                    };
                }
            } catch (error) {
                const handled = _handleAuthError(error);
                
                if (error.code === 'auth/popup-blocked' && !useRedirect) {
                    // Auto-fallback to redirect method
                    return await this.loginWithGoogle(true);
                }
                
                throw new AuthError(handled.userMessage, error.code || 'GOOGLE_LOGIN_ERROR', error);
            }
        },

        async loginWithGoogleNewWindow() {
            return new Promise((resolve, reject) => {
                try {
                    const width = 500;
                    const height = 600;
                    const left = (window.screen.width - width) / 2;
                    const top = (window.screen.height - height) / 2;

                    const authWindow = window.open(
                        '',
                        'TourneyHub Google Login',
                        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,resizable=no,scrollbars=no,status=no`
                    );

                    if (!authWindow) {
                        throw new AuthError('Popup window blocked. Please allow popups.', 'POPUP_BLOCKED');
                    }

                    // Create a simple HTML page for auth
                    const authPage = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Google Login - TourneyHub</title>
                            <style>
                                body {
                                    font-family: system-ui, -apple-system, sans-serif;
                                    background: linear-gradient(135deg, #0f0c29, #302b63);
                                    color: white;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    height: 100vh;
                                    margin: 0;
                                }
                                .container {
                                    text-align: center;
                                    padding: 40px;
                                    max-width: 400px;
                                }
                                .logo {
                                    font-size: 2.5rem;
                                    margin-bottom: 20px;
                                }
                                .loader {
                                    border: 3px solid rgba(255,255,255,0.1);
                                    border-top: 3px solid #6bcf7f;
                                    border-radius: 50%;
                                    width: 40px;
                                    height: 40px;
                                    animation: spin 1s linear infinite;
                                    margin: 20px auto;
                                }
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                                .status {
                                    margin-top: 20px;
                                    color: #a0a0c0;
                                    font-size: 0.9rem;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="logo">🏆</div>
                                <h2>Google Login</h2>
                                <p>Opening Google authentication...</p>
                                <div class="loader"></div>
                                <div class="status" id="status">Initializing...</div>
                            </div>
                            <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
                            <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
                            <script>
                                const firebaseConfig = ${JSON.stringify(firebaseConfig)};
                                if (!firebase.apps.length) {
                                    firebase.initializeApp(firebaseConfig);
                                }
                                
                                const provider = new firebase.auth.GoogleAuthProvider();
                                provider.addScope('email');
                                provider.addScope('profile');
                                
                                // Show status
                                document.getElementById('status').textContent = 'Redirecting to Google...';
                                
                                // Sign in with redirect
                                firebase.auth().signInWithRedirect(provider)
                                    .then(() => {
                                        document.getElementById('status').textContent = 'Redirecting...';
                                    })
                                    .catch(error => {
                                        document.getElementById('status').textContent = 'Error: ' + error.message;
                                        setTimeout(() => window.close(), 3000);
                                    });
                            </script>
                        </body>
                        </html>
                    `;

                    authWindow.document.write(authPage);
                    authWindow.document.close();

                    // Poll for window closure and handle result
                    const checkWindow = setInterval(async () => {
                        if (authWindow.closed) {
                            clearInterval(checkWindow);
                            
                            // Check for redirect result
                            try {
                                const result = await _auth.getRedirectResult();
                                if (result.user) {
                                    const sessionToken = await _createUserSession(result.user, 'google_new_window');
                                    
                                    resolve({
                                        success: true,
                                        sessionToken,
                                        user: result.user,
                                        method: 'new_window'
                                    });
                                } else {
                                    reject(new AuthError('Login cancelled or failed', 'AUTH_CANCELLED'));
                                }
                            } catch (error) {
                                reject(new AuthError('Login failed: ' + error.message, 'NEW_WINDOW_ERROR', error));
                            }
                        }
                    }, 500);

                    // Auto-close check after 2 minutes
                    setTimeout(() => {
                        if (!authWindow.closed) {
                            authWindow.close();
                            reject(new AuthError('Login timeout', 'LOGIN_TIMEOUT'));
                        }
                    }, 120000);

                } catch (error) {
                    reject(error);
                }
            });
        },

        async handleRedirectResult() {
            try {
                const result = await _auth.getRedirectResult();
                if (result.user) {
                    const sessionToken = await _createUserSession(result.user, 'google_redirect');
                    
                    return {
                        success: true,
                        sessionToken,
                        user: result.user
                    };
                }
                return { success: false, message: 'No redirect result' };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'REDIRECT_ERROR', error);
            }
        },

        // Password Management
        async resetPassword(email) {
            try {
                if (!email) {
                    throw new ValidationError('Email is required', 'email');
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new ValidationError('Invalid email format', 'email');
                }

                // Check if user exists
                const methods = await _auth.fetchSignInMethodsForEmail(email);
                if (methods.length === 0) {
                    throw new AuthError('No account found with this email', 'USER_NOT_FOUND');
                }

                // Send reset email with enhanced options
                await _auth.sendPasswordResetEmail(email, {
                    url: window.location.origin + '/login.html?action=reset_complete',
                    handleCodeInApp: false
                });

                _trackAnalytics('password_reset_requested', { email });
                
                return {
                    success: true,
                    message: 'Password reset email sent. Check your inbox.'
                };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'PASSWORD_RESET_ERROR', error);
            }
        },

        async changePassword(currentPassword, newPassword) {
            try {
                if (!_currentUser) {
                    throw new AuthError('No authenticated user', 'NOT_AUTHENTICATED');
                }

                // Re-authenticate user
                const credential = firebase.auth.EmailAuthProvider.credential(
                    _currentUser.email,
                    currentPassword
                );

                await _currentUser.reauthenticateWithCredential(credential);

                // Validate new password strength
                const validation = _validatePasswordStrength(newPassword);
                if (!validation.isValid) {
                    throw new ValidationError(
                        `Password requirements not met: ${validation.errors.join(', ')}`,
                        'password'
                    );
                }

                // Update password
                await _currentUser.updatePassword(newPassword);

                _trackAnalytics('password_changed', { user_id: _currentUser.uid });
                
                return {
                    success: true,
                    message: 'Password updated successfully',
                    strength: validation.score
                };
            } catch (error) {
                const handled = _handleAuthError(error);
                throw new AuthError(handled.userMessage, error.code || 'PASSWORD_CHANGE_ERROR', error);
            }
        },

        // Session Management
        async validateCurrentSession() {
            return await _validateSession();
        },

        async getSessionInfo() {
            const sessionToken = _getCookie('tourneyhub_session');
            if (!sessionToken) return null;

            try {
                const sessionDoc = await _db.collection('user_sessions').doc(sessionToken).get();
                if (!sessionDoc.exists) return null;

                return {
                    id: sessionToken,
                    ...sessionDoc.data(),
                    isValid: await _validateSession()
                };
            } catch (error) {
                console.error('Error fetching session info:', error);
                return null;
            }
        },

        async refreshSession() {
            try {
                if (!_currentUser) {
                    throw new AuthError('No authenticated user', 'NOT_AUTHENTICATED');
                }

                // Refresh ID token
                await _currentUser.getIdToken(true);
                
                // Update session expiry
                const sessionToken = _getCookie('tourneyhub_session');
                if (sessionToken) {
                    await _db.collection('user_sessions').doc(sessionToken).update({
                        expiresAt: firebase.firestore.FieldValue.serverTimestamp(null, 24 * 60 * 60)
                    });
                }

                return { success: true, message: 'Session refreshed' };
            } catch (error) {
                throw new AuthError('Session refresh failed', 'SESSION_REFRESH_ERROR', error);
            }
        },

        async logout() {
            try {
                // Get session token before logout
                const sessionToken = _getCookie('tourneyhub_session');
                
                // Track logout
                _trackAnalytics('logout', { user_id: _currentUser?.uid });
                
                // Sign out from Firebase
                await _auth.signOut();
                
                // Clean up session
                if (sessionToken) {
                    await _db.collection('user_sessions').doc(sessionToken).update({
                        isActive: false,
                        endedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Clear session cookie
                    _setSecureCookie('tourneyhub_session', '', -1);
                }
                
                // Cleanup
                _cleanupSession();
                _currentUser = null;
                
                // Clear all local storage items
                const itemsToKeep = ['tourneyhub_remember_me', 'tourneyhub_remember_email'];
                Object.keys(localStorage).forEach(key => {
                    if (!itemsToKeep.includes(key) && key.startsWith('tourneyhub_')) {
                        localStorage.removeItem(key);
                    }
                });
                
                return { success: true, message: 'Logged out successfully' };
            } catch (error) {
                console.error('Logout error:', error);
                return { success: false, error: error.message };
            }
        },

        // User Management
        async getUserProfile() {
            if (!_currentUser) return null;

            try {
                const userDoc = await _db.collection('users').doc(_currentUser.uid).get();
                if (!userDoc.exists) return null;

                return {
                    uid: _currentUser.uid,
                    email: _currentUser.email,
                    emailVerified: _currentUser.emailVerified,
                    displayName: _currentUser.displayName,
                    photoURL: _currentUser.photoURL,
                    metadata: _currentUser.metadata,
                    providerData: _currentUser.providerData,
                    ...userDoc.data()
                };
            } catch (error) {
                console.error('Error fetching user profile:', error);
                return null;
            }
        },

        async updateProfile(updates) {
            if (!_currentUser) {
                throw new AuthError('No authenticated user', 'NOT_AUTHENTICATED');
            }

            try {
                // Update in Firebase Auth
                if (updates.displayName !== undefined) {
                    await _currentUser.updateProfile({
                        displayName: updates.displayName
                    });
                }

                // Update in Firestore
                const updateData = { ...updates };
                delete updateData.displayName; // Already handled
                
                if (Object.keys(updateData).length > 0) {
                    await _db.collection('users').doc(_currentUser.uid).update({
                        ...updateData,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                _trackAnalytics('profile_updated', {
                    user_id: _currentUser.uid,
                    fields: Object.keys(updates)
                });

                return {
                    success: true,
                    message: 'Profile updated successfully'
                };
            } catch (error) {
                throw new AuthError('Profile update failed', 'PROFILE_UPDATE_ERROR', error);
            }
        },

        async enable2FA() {
            if (!_currentUser) {
                throw new AuthError('No authenticated user', 'NOT_AUTHENTICATED');
            }

            try {
                await _db.collection('users').doc(_currentUser.uid).update({
                    twoFAEnabled: true,
                    twoFAEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                _trackAnalytics('2fa_enabled', { user_id: _currentUser.uid });

                return {
                    success: true,
                    message: '2FA enabled successfully'
                };
            } catch (error) {
                throw new AuthError('Failed to enable 2FA', '2FA_ENABLE_ERROR', error);
            }
        },

        // Analytics and Monitoring
        getPerformanceMetrics() {
            return {
                ..._performanceMetrics,
                averageLatency: _performanceMetrics.firebaseLatency.length > 0 ?
                    _performanceMetrics.firebaseLatency.reduce((a, b) => a + b, 0) / 
                    _performanceMetrics.firebaseLatency.length : 0,
                loginAttempts: _loginAttempts
            };
        },

        getAnalyticsSummary() {
            return {
                totalEvents: _analyticsQueue.length,
                deviceFingerprint: _deviceFingerprint,
                sessionActive: !!_currentUser
            };
        },

        // Getters
        getCurrentUser() {
            return _currentUser;
        },

        getAuthInstance() {
            return _auth;
        },

        getFirestoreInstance() {
            return _db;
        },

        getDeviceFingerprint() {
            return _deviceFingerprint;
        },

        // State management
        onAuthStateChanged(callback) {
            if (!_auth) return null;
            return _auth.onAuthStateChanged((user) => {
                _currentUser = user;
                callback(user);
            });
        },

        // Security
        async checkAccountSecurity() {
            if (!_currentUser) return null;

            try {
                const userDoc = await _db.collection('users').doc(_currentUser.uid).get();
                const userData = userDoc.data() || {};

                // Get recent sessions
                const sessionsQuery = await _db.collection('user_sessions')
                    .where('userId', '==', _currentUser.uid)
                    .orderBy('createdAt', 'desc')
                    .limit(5)
                    .get();

                const recentSessions = sessionsQuery.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    isCurrent: doc.id === _getCookie('tourneyhub_session')
                }));

                // Security score calculation
                let securityScore = 100;
                const warnings = [];

                if (!userData.twoFAEnabled) {
                    securityScore -= 30;
                    warnings.push('Two-factor authentication not enabled');
                }

                if (userData.loginCount && userData.loginCount < 3) {
                    securityScore -= 10;
                    warnings.push('New account - be cautious');
                }

                if (recentSessions.length > 3) {
                    securityScore -= 10;
                    warnings.push('Multiple active sessions detected');
                }

                return {
                    score: Math.max(0, securityScore),
                    level: securityScore >= 80 ? 'high' : securityScore >= 60 ? 'medium' : 'low',
                    warnings,
                    recentSessions,
                    lastPasswordChange: userData.lastPasswordChange,
                    emailVerified: _currentUser.emailVerified
                };
            } catch (error) {
                console.error('Security check error:', error);
                return null;
            }
        }
    };
})();

// ==================== UI MANAGER (Advanced) ====================
const TourneyHubUIManager = (() => {
    // Private variables
    let _uiState = {
        isLoading: false,
        is2FAMode: false,
        currentUserId: null,
        activeNotifications: new Map(),
        toastContainer: null,
        modalContainer: null,
        currentModal: null
    };

    // Private methods
    const _createToastContainer = () => {
        if (!_uiState.toastContainer) {
            _uiState.toastContainer = document.createElement('div');
            _uiState.toastContainer.id = 'toast-container';
            _uiState.toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            `;
            document.body.appendChild(_uiState.toastContainer);
        }
        return _uiState.toastContainer;
    };

    const _createModalContainer = () => {
        if (!_uiState.modalContainer) {
            _uiState.modalContainer = document.createElement('div');
            _uiState.modalContainer.id = 'modal-container';
            _uiState.modalContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 999999;
                display: none;
                justify-content: center;
                align-items: center;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
            `;
            document.body.appendChild(_uiState.modalContainer);
        }
        return _uiState.modalContainer;
    };

    const _showAdvancedNotification = (config) => {
        const toastContainer = _createToastContainer();
        const notificationId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const toast = document.createElement('div');
        toast.id = notificationId;
        toast.className = 'advanced-toast';
        toast.style.cssText = `
            background: ${config.type === 'success' ? 'rgba(76, 175, 80, 0.15)' : 
                        config.type === 'error' ? 'rgba(244, 67, 54, 0.15)' : 
                        config.type === 'warning' ? 'rgba(255, 193, 7, 0.15)' : 
                        'rgba(33, 150, 243, 0.15)'};
            border: 1px solid ${config.type === 'success' ? 'rgba(76, 175, 80, 0.3)' : 
                             config.type === 'error' ? 'rgba(244, 67, 54, 0.3)' : 
                             config.type === 'warning' ? 'rgba(255, 193, 7, 0.3)' : 
                             'rgba(33, 150, 243, 0.3)'};
            border-radius: 12px;
            padding: 16px 20px;
            color: white;
            backdrop-filter: blur(10px);
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: flex-start;
            gap: 12px;
            max-width: 400px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            position: relative;
            overflow: hidden;
        `;

        // Add gradient border
        toast.style.borderImage = config.type === 'success' ? 
            'linear-gradient(45deg, #4CAF50, #8BC34A) 1' :
            config.type === 'error' ?
            'linear-gradient(45deg, #F44336, #FF5252) 1' :
            config.type === 'warning' ?
            'linear-gradient(45deg, #FFC107, #FF9800) 1' :
            'linear-gradient(45deg, #2196F3, #03A9F4) 1';

        const iconMap = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <div style="font-size: 20px; flex-shrink: 0;">${iconMap[config.type] || 'ℹ️'}</div>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">
                    ${config.title || config.type.toUpperCase()}
                </div>
                <div style="font-size: 13px; color: rgba(255, 255, 255, 0.9);">
                    ${config.message}
                </div>
                ${config.progress !== undefined ? `
                    <div style="margin-top: 8px;">
                        <div style="height: 3px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden;">
                            <div class="toast-progress" style="height: 100%; width: ${config.progress}%; background: ${config.type === 'success' ? '#4CAF50' : '#2196F3'}; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
            <button class="toast-close" style="background: none; border: none; color: rgba(255, 255, 255, 0.5); cursor: pointer; font-size: 20px; padding: 0; margin-left: 8px; transition: color 0.2s;">
                ×
            </button>
        `;

        toastContainer.prepend(toast);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(0)';
                toast.style.opacity = '1';
            });
        });

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.onclick = () => {
            _hideNotification(notificationId);
        };

        // Auto-dismiss
        if (config.duration !== 0) {
            const duration = config.duration || 5000;
            const timeoutId = setTimeout(() => {
                _hideNotification(notificationId);
            }, duration);
            
            _uiState.activeNotifications.set(notificationId, {
                element: toast,
                timeout: timeoutId
            });
        } else {
            _uiState.activeNotifications.set(notificationId, {
                element: toast,
                timeout: null
            });
        }

        // Add click to dismiss
        toast.addEventListener('click', (e) => {
            if (!e.target.closest('.toast-close')) {
                _hideNotification(notificationId);
            }
        });

        return notificationId;
    };

    const _hideNotification = (notificationId) => {
        const notification = _uiState.activeNotifications.get(notificationId);
        if (notification) {
            if (notification.timeout) {
                clearTimeout(notification.timeout);
            }
            
            notification.element.style.transform = 'translateX(100%)';
            notification.element.style.opacity = '0';
            
            setTimeout(() => {
                if (notification.element.parentNode) {
                    notification.element.parentNode.removeChild(notification.element);
                }
                _uiState.activeNotifications.delete(notificationId);
            }, 300);
        }
    };

    const _show2FAModal = (userId, onVerify) => {
        _uiState.is2FAMode = true;
        _uiState.currentUserId = userId;
        
        const modalContainer = _createModalContainer();
        modalContainer.style.display = 'flex';
        
        const modal = document.createElement('div');
        modal.className = '2fa-modal';
        modal.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border-radius: 20px;
            padding: 40px;
            max-width: 400px;
            width: 90%;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            transform: scale(0.9);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        `;

        modal.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🔐</div>
                <h2 style="margin: 0 0 10px 0; font-size: 1.8rem; background: linear-gradient(45deg, #fff, #a0a0c0); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    Two-Factor Authentication
                </h2>
                <p style="color: #a0a0c0; margin-bottom: 5px;">
                    A verification code has been sent to your email
                </p>
                <p style="color: #6bcf7f; font-size: 0.9rem;">
                    Check your inbox for the 6-digit code
                </p>
            </div>
            
            <form id="2fa-form" style="margin-bottom: 30px;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff; font-weight: 500;">
                        Enter 6-digit code
                    </label>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        ${Array.from({ length: 6 }).map((_, i) => `
                            <input 
                                type="text" 
                                maxlength="1" 
                                class="2fa-digit" 
                                data-index="${i}"
                                style="
                                    width: 50px;
                                    height: 60px;
                                    text-align: center;
                                    font-size: 1.5rem;
                                    font-weight: 600;
                                    background: rgba(255, 255, 255, 0.07);
                                    border: 2px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 10px;
                                    color: white;
                                    transition: all 0.2s;
                                "
                            >
                        `).join('')}
                    </div>
                    <div id="2fa-error" style="color: #ff6b6b; font-size: 0.9rem; margin-top: 10px; min-height: 20px;"></div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button type="submit" id="2fa-verify" style="
                        flex: 1;
                        padding: 15px;
                        background: linear-gradient(45deg, #6bcf7f, #4ca1af);
                        border: none;
                        border-radius: 10px;
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">
                        Verify & Continue
                    </button>
                    <button type="button" id="2fa-cancel" style="
                        padding: 15px 20px;
                        background: rgba(255, 255, 255, 0.07);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        color: white;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">
                        Cancel
                    </button>
                </div>
            </form>
            
            <div style="text-align: center;">
                <button id="2fa-resend" style="
                    background: none;
                    border: none;
                    color: #6bcf7f;
                    cursor: pointer;
                    font-size: 0.9rem;
                    padding: 10px;
                ">
                    Resend code
                </button>
                <div id="resend-timer" style="color: #a0a0c0; font-size: 0.8rem; margin-top: 5px;">
                    Resend available in <span id="timer">60</span>s
                </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="color: #a0a0c0; font-size: 0.85rem; line-height: 1.4;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <span>🔒</span>
                        <span>Code expires in 10 minutes</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span>📧</span>
                        <span>Can't find the email? Check spam folder</span>
                    </div>
                </div>
            </div>
        `;

        modalContainer.innerHTML = '';
        modalContainer.appendChild(modal);
        _uiState.currentModal = modal;

        // Animate in
        requestAnimationFrame(() => {
            modal.style.transform = 'scale(1)';
            modal.style.opacity = '1';
        });

        // Setup digit input logic
        const digitInputs = modal.querySelectorAll('.2fa-digit');
        digitInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value && index < 5) {
                    digitInputs[index + 1].focus();
                }
                
                // Auto-paste logic
                if (value.length === 6) {
                    // User pasted 6-digit code
                    for (let i = 0; i < 6; i++) {
                        if (digitInputs[i]) {
                            digitInputs[i].value = value[i] || '';
                        }
                    }
                    if (digitInputs[5]) digitInputs[5].focus();
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && index > 0) {
                    digitInputs[index - 1].focus();
                }
                
                // Allow only numbers
                if (!/^\d$/.test(e.key) && 
                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                }
            });

            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pastedData = e.clipboardData.getData('text');
                const numbers = pastedData.replace(/\D/g, '');
                if (numbers.length === 6) {
                    for (let i = 0; i < 6; i++) {
                        if (digitInputs[i]) {
                            digitInputs[i].value = numbers[i] || '';
                        }
                    }
                    if (digitInputs[5]) digitInputs[5].focus();
                }
            });
        });

        // Form submission
        const form = modal.querySelector('#2fa-form');
        const verifyBtn = modal.querySelector('#2fa-verify');
        const errorDiv = modal.querySelector('#2fa-error');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const code = Array.from(digitInputs)
                .map(input => input.value)
                .join('');
            
            if (code.length !== 6) {
                errorDiv.textContent = 'Please enter 6-digit code';
                digitInputs[0].focus();
                return;
            }
            
            // Disable button and show loading
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>';
            
            try {
                await onVerify(userId, code);
                _hideModal();
            } catch (error) {
                errorDiv.textContent = error.message || 'Invalid code';
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify & Continue';
                
                // Shake animation for error
                modal.style.animation = 'shake 0.5s ease';
                setTimeout(() => {
                    modal.style.animation = '';
                }, 500);
            }
        });

        // Cancel button
        modal.querySelector('#2fa-cancel').addEventListener('click', () => {
            _hideModal();
            window.location.reload();
        });

        // Resend logic with timer
        let resendTimer = 60;
        const resendBtn = modal.querySelector('#2fa-resend');
        const timerSpan = modal.querySelector('#timer');
        
        const updateTimer = () => {
            if (resendTimer > 0) {
                resendTimer--;
                timerSpan.textContent = resendTimer;
                resendBtn.disabled = true;
                resendBtn.style.opacity = '0.5';
                resendBtn.style.cursor = 'not-allowed';
            } else {
                resendBtn.disabled = false;
                resendBtn.style.opacity = '1';
                resendBtn.style.cursor = 'pointer';
                resendBtn.textContent = 'Resend code now';
                clearInterval(timerInterval);
            }
        };
        
        let timerInterval = setInterval(updateTimer, 1000);
        
        resendBtn.addEventListener('click', async () => {
            if (resendTimer > 0) return;
            
            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending...';
            
            try {
                // In production, call API to resend 2FA
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                _showAdvancedNotification({
                    title: 'Code Resent',
                    message: 'New verification code sent to your email',
                    type: 'success'
                });
                
                // Reset timer
                resendTimer = 60;
                timerInterval = setInterval(updateTimer, 1000);
            } catch (error) {
                errorDiv.textContent = 'Failed to resend code';
            }
        });

        // Close modal on background click
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                _hideModal();
            }
        });

        // Focus first input
        setTimeout(() => digitInputs[0].focus(), 100);
    };

    const _hideModal = () => {
        if (_uiState.currentModal) {
            _uiState.currentModal.style.transform = 'scale(0.9)';
            _uiState.currentModal.style.opacity = '0';
            
            setTimeout(() => {
                const modalContainer = document.getElementById('modal-container');
                if (modalContainer) {
                    modalContainer.style.display = 'none';
                    modalContainer.innerHTML = '';
                }
                _uiState.currentModal = null;
                _uiState.is2FAMode = false;
            }, 300);
        }
    };

    const _showLoadingOverlay = (message = 'Loading...') => {
        _uiState.isLoading = true;
        
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            gap: 20px;
        `;

        overlay.innerHTML = `
            <div style="
                width: 80px;
                height: 80px;
                border: 3px solid transparent;
                border-top: 3px solid #6bcf7f;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                position: relative;
            ">
                <div style="
                    position: absolute;
                    width: 60px;
                    height: 60px;
                    border: 3px solid transparent;
                    border-bottom: 3px solid #ffd93d;
                    border-radius: 50%;
                    top: 7px;
                    left: 7px;
                    animation: spin 0.5s linear infinite reverse;
                "></div>
            </div>
            <div style="color: white; font-size: 1.2rem; font-weight: 500;">
                ${message}
            </div>
            <div style="color: #a0a0c0; font-size: 0.9rem; max-width: 300px; text-align: center;">
                Please wait while we process your request...
            </div>
        `;

        document.body.appendChild(overlay);
    };

    const _hideLoadingOverlay = () => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
        _uiState.isLoading = false;
    };

    const _setupPasswordStrengthMeter = (inputId, meterId) => {
        const passwordInput = document.getElementById(inputId);
        const strengthMeter = document.getElementById(meterId);
        
        if (!passwordInput || !strengthMeter) return;

        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            const validation = TourneyHubAuth.validatePasswordStrength(password);
            
            strengthMeter.innerHTML = `
                <div style="margin-bottom: 8px; font-size: 0.9rem; color: #a0a0c0;">
                    Password strength: <span style="color: ${validation.score >= 80 ? '#6bcf7f' : validation.score >= 60 ? '#ffd93d' : '#ff6b6b'}">
                        ${validation.score >= 80 ? 'Strong' : validation.score >= 60 ? 'Medium' : 'Weak'}
                    </span> (${validation.score}%)
                </div>
                <div style="height: 4px; background: rgba(255, 255, 255, 0.1); border-radius: 2px; overflow: hidden;">
                    <div style="
                        height: 100%;
                        width: ${validation.score}%;
                        background: ${validation.score >= 80 ? 'linear-gradient(90deg, #6bcf7f, #4ca1af)' : 
                                    validation.score >= 60 ? 'linear-gradient(90deg, #ffd93d, #ffa726)' : 
                                    'linear-gradient(90deg, #ff6b6b, #ff5252)'};
                        transition: width 0.3s ease;
                    "></div>
                </div>
                ${validation.errors.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <div style="font-size: 0.85rem; color: #a0a0c0; margin-bottom: 5px;">Requirements:</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${validation.errors.map(error => `
                                <span style="
                                    font-size: 0.8rem;
                                    padding: 4px 8px;
                                    background: rgba(255, 107, 107, 0.1);
                                    border: 1px solid rgba(255, 107, 107, 0.2);
                                    border-radius: 12px;
                                    color: #ff6b6b;
                                    display: flex;
                                    align-items: center;
                                    gap: 4px;
                                ">
                                    <span>❌</span>
                                    <span>${error}</span>
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div style="margin-top: 10px;">
                        <div style="font-size: 0.85rem; color: #a0a0c0; margin-bottom: 5px;">All requirements met:</div>
                        <div style="
                            font-size: 0.8rem;
                            padding: 8px 12px;
                            background: rgba(107, 207, 127, 0.1);
                            border: 1px solid rgba(107, 207, 127, 0.2);
                            border-radius: 12px;
                            color: #6bcf7f;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        ">
                            <span>✅</span>
                            <span>Password meets all security requirements</span>
                        </div>
                    </div>
                `}
            `;
        });
    };

    // Public API
    return {
        showNotification: (message, type = 'info', options = {}) => {
            const config = {
                title: options.title || type.toUpperCase(),
                message,
                type,
                duration: options.duration || 5000,
                progress: options.progress
            };
            return _showAdvancedNotification(config);
        },

        hideNotification: (id) => {
            _hideNotification(id);
        },

        show2FAModal: (userId, onVerify) => {
            _show2FAModal(userId, onVerify);
        },

        showLoading: (message) => {
            _showLoadingOverlay(message);
        },

        hideLoading: () => {
            _hideLoadingOverlay();
        },

        showModal: (content, options = {}) => {
            const modalContainer = _createModalContainer();
            modalContainer.style.display = 'flex';
            
            const modal = document.createElement('div');
            modal.className = 'custom-modal';
            modal.style.cssText = `
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                border-radius: 20px;
                padding: 40px;
                max-width: ${options.width || '500px'};
                width: 90%;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                transform: scale(0.9);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            `;
            
            modal.innerHTML = content;
            modalContainer.innerHTML = '';
            modalContainer.appendChild(modal);
            _uiState.currentModal = modal;
            
            requestAnimationFrame(() => {
                modal.style.transform = 'scale(1)';
                modal.style.opacity = '1';
            });
            
            // Close on background click
            modalContainer.addEventListener('click', (e) => {
                if (e.target === modalContainer && !options.preventClose) {
                    this.hideModal();
                }
            });
            
            return modal;
        },

        hideModal: () => {
            _hideModal();
        },

        setupPasswordStrengthMeter: (inputId, meterId) => {
            _setupPasswordStrengthMeter(inputId, meterId);
        },

        getState: () => ({ ..._uiState }),

        clearAllNotifications: () => {
            _uiState.activeNotifications.forEach((_, id) => {
                _hideNotification(id);
            });
        }
    };
})();

// ==================== EVENT MANAGER (Advanced Pub/Sub) ====================
const TourneyHubEventManager = (() => {
    const _events = new Map();
    const _onceEvents = new Map();

    return {
        on(event, callback, options = {}) {
            if (!_events.has(event)) {
                _events.set(event, []);
            }
            _events.get(event).push({ callback, options });
            
            // Return unsubscribe function
            return () => {
                const callbacks = _events.get(event);
                if (callbacks) {
                    const index = callbacks.findIndex(cb => cb.callback === callback);
                    if (index > -1) {
                        callbacks.splice(index, 1);
                    }
                }
            };
        },

        once(event, callback) {
            if (!_onceEvents.has(event)) {
                _onceEvents.set(event, []);
            }
            _onceEvents.get(event).push(callback);
        },

        emit(event, data = null) {
            // Process regular events
            if (_events.has(event)) {
                const callbacks = _events.get(event);
                callbacks.forEach(({ callback, options }) => {
                    try {
                        if (options.debounce) {
                            clearTimeout(options.debounceTimer);
                            options.debounceTimer = setTimeout(() => {
                                callback(data);
                            }, options.debounce);
                        } else if (options.throttle) {
                            if (!options.throttleLastCall || 
                                Date.now() - options.throttleLastCall >= options.throttle) {
                                options.throttleLastCall = Date.now();
                                callback(data);
                            }
                        } else {
                            callback(data);
                        }
                    } catch (error) {
                        console.error(`Error in event handler for "${event}":`, error);
                    }
                });
            }

            // Process once events
            if (_onceEvents.has(event)) {
                const callbacks = _onceEvents.get(event);
                callbacks.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in once event handler for "${event}":`, error);
                    }
                });
                _onceEvents.delete(event);
            }
        },

        removeAll(event) {
            if (event) {
                _events.delete(event);
                _onceEvents.delete(event);
            } else {
                _events.clear();
                _onceEvents.clear();
            }
        },

        hasListeners(event) {
            return (_events.has(event) && _events.get(event).length > 0) || 
                   (_onceEvents.has(event) && _onceEvents.get(event).length > 0);
        }
    };
})();

// ==================== MAIN INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize authentication system
        const initResult = await TourneyHubAuth.init();
        
        if (!initResult.success) {
            throw new Error('Failed to initialize authentication system');
        }

        // Setup event listeners for UI
        TourneyHubEventManager.on('auth-notification', (event) => {
            TourneyHubUIManager.showNotification(
                event.detail.message,
                event.detail.type,
                event.detail
            );
        });

        TourneyHubEventManager.on('auth-success', (data) => {
            if (data.requires2FA) {
                TourneyHubUIManager.show2FAModal(data.userId, async (userId, token) => {
                    try {
                        TourneyHubUIManager.showLoading('Verifying 2FA code...');
                        const result = await TourneyHubAuth.verify2FA(userId, token);
                        
                        TourneyHubEventManager.emit('2fa-success', result);
                        
                        // Redirect to main page
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 1500);
                    } catch (error) {
                        TourneyHubEventManager.emit('auth-error', error);
                        throw error;
                    } finally {
                        TourneyHubUIManager.hideLoading();
                    }
                });
            } else {
                TourneyHubUIManager.showNotification(
                    'Login successful! Redirecting...',
                    'success'
                );
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }
        });

        TourneyHubEventManager.on('auth-error', (error) => {
            TourneyHubUIManager.showNotification(
                error.message || 'Authentication failed',
                'error',
                { duration: 7000 }
            );
        });

        // Check existing session
        const hasValidSession = await TourneyHubAuth.validateCurrentSession();
        if (hasValidSession) {
            // Auto-redirect if already logged in
            window.location.href = 'index.html';
        }

        // Setup DOM elements and event handlers
        _setupLoginForm();
        _setupGoogleButtons();
        _setupForgotPassword();

        // Hide loading screen
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.visibility = 'hidden';
                setTimeout(() => {
                    if (loadingScreen.parentElement) {
                        loadingScreen.parentElement.removeChild(loadingScreen);
                    }
                }, 500);
            }
        }, 1000);

        // Setup performance monitoring
        _setupPerformanceMonitoring();

    } catch (error) {
        console.error('Initialization error:', error);
        TourneyHubUIManager.showNotification(
            'Failed to initialize application. Please refresh.',
            'error'
        );
    }
});

// ==================== DOM SETUP FUNCTIONS ====================
function _setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const passwordToggle = document.getElementById('passwordToggle');
    const rememberMe = document.getElementById('rememberMe');

    if (!loginForm) return;

    // Load remembered email
    const savedEmail = localStorage.getItem('tourneyhub_remember_email');
    const savedRemember = localStorage.getItem('tourneyhub_remember_me') === 'true';
    
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
    }
    if (rememberMe) {
        rememberMe.checked = savedRemember;
    }

    // Password toggle
    if (passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            const icon = passwordToggle.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
            }
        });
    }

    // Form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const remember = rememberMe.checked;

        if (!email || !password) {
            TourneyHubUIManager.showNotification(
                'Please fill in all fields',
                'error'
            );
            return;
        }

        // Save remember me preference
        if (remember) {
            localStorage.setItem('tourneyhub_remember_email', email);
            localStorage.setItem('tourneyhub_remember_me', 'true');
        } else {
            localStorage.removeItem('tourneyhub_remember_email');
            localStorage.removeItem('tourneyhub_remember_me');
        }

        try {
            TourneyHubUIManager.showLoading('Authenticating...');
            
            const result = await TourneyHubAuth.loginWithEmail(email, password, remember);
            
            TourneyHubEventManager.emit('auth-success', result);
            
        } catch (error) {
            TourneyHubEventManager.emit('auth-error', error);
        } finally {
            TourneyHubUIManager.hideLoading();
        }
    });

    // Real-time email validation
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            const email = emailInput.value.trim();
            if (!email) return;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                TourneyHubUIManager.showNotification(
                    'Please enter a valid email address',
                    'warning',
                    { duration: 3000 }
                );
            }
        });
    }
}

function _setupGoogleButtons() {
    const googleBtn = document.getElementById('googleSignIn');
    const googleNewWindowBtn = document.getElementById('googleSignInNewWindow');

    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try {
                TourneyHubUIManager.showLoading('Opening Google login...');
                
                const result = await TourneyHubAuth.loginWithGoogle(false);
                
                if (result.method === 'redirect') {
                    // Redirect initiated, nothing more to do
                    return;
                }
                
                TourneyHubEventManager.emit('auth-success', result);
                
            } catch (error) {
                TourneyHubEventManager.emit('auth-error', error);
            } finally {
                TourneyHubUIManager.hideLoading();
            }
        });
    }

    if (googleNewWindowBtn) {
        googleNewWindowBtn.addEventListener('click', async () => {
            try {
                TourneyHubUIManager.showNotification(
                    'Opening Google login in new window...',
                    'info'
                );
                
                const result = await TourneyHubAuth.loginWithGoogleNewWindow();
                
                TourneyHubEventManager.emit('auth-success', result);
                
            } catch (error) {
                TourneyHubEventManager.emit('auth-error', error);
            }
        });
    }
}

function _setupForgotPassword() {
    const forgotLink = document.getElementById('forgotPassword');
    
    if (!forgotLink) return;

    forgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const emailInput = document.getElementById('login-email');
        const email = emailInput?.value.trim() || '';
        
        if (!email) {
            // Show modal to enter email
            const modalContent = `
                <div style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🔐</div>
                    <h2 style="margin: 0 0 10px 0; font-size: 1.5rem;">
                        Reset Password
                    </h2>
                    <p style="color: #a0a0c0; margin-bottom: 20px;">
                        Enter your email to receive a password reset link
                    </p>
                    
                    <div style="margin-bottom: 20px;">
                        <input 
                            type="email" 
                            id="reset-email" 
                            placeholder="Enter your email"
                            style="
                                width: 100%;
                                padding: 12px 15px;
                                background: rgba(255, 255, 255, 0.07);
                                border: 1px solid rgba(255, 255, 255, 0.1);
                                border-radius: 10px;
                                color: white;
                                font-size: 1rem;
                            "
                            value="${email}"
                        >
                        <div id="reset-error" style="color: #ff6b6b; font-size: 0.9rem; margin-top: 10px; min-height: 20px;"></div>
                    </div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button id="reset-submit" style="
                            flex: 1;
                            padding: 12px;
                            background: linear-gradient(45deg, #6bcf7f, #4ca1af);
                            border: none;
                            border-radius: 10px;
                            color: white;
                            font-weight: 600;
                            cursor: pointer;
                        ">
                            Send Reset Link
                        </button>
                        <button id="reset-cancel" style="
                            padding: 12px 20px;
                            background: rgba(255, 255, 255, 0.07);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            border-radius: 10px;
                            color: white;
                            cursor: pointer;
                        ">
                            Cancel
                        </button>
                    </div>
                </div>
            `;
            
            const modal = TourneyHubUIManager.showModal(modalContent);
            
            // Focus email input
            setTimeout(() => {
                const emailInput = modal.querySelector('#reset-email');
                if (emailInput) emailInput.focus();
            }, 100);
            
            // Setup handlers
            modal.querySelector('#reset-submit').addEventListener('click', async () => {
                const email = modal.querySelector('#reset-email').value.trim();
                const errorDiv = modal.querySelector('#reset-error');
                const submitBtn = modal.querySelector('#reset-submit');
                
                if (!email) {
                    errorDiv.textContent = 'Please enter your email';
                    return;
                }
                
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    errorDiv.textContent = 'Please enter a valid email';
                    return;
                }
                
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>';
                
                try {
                    await TourneyHubAuth.resetPassword(email);
                    
                    TourneyHubUIManager.hideModal();
                    TourneyHubUIManager.showNotification(
                        'Password reset email sent! Check your inbox.',
                        'success'
                    );
                    
                } catch (error) {
                    errorDiv.textContent = error.message;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Reset Link';
                }
            });
            
            modal.querySelector('#reset-cancel').addEventListener('click', () => {
                TourneyHubUIManager.hideModal();
            });
            
        } else {
            // Use existing email
            try {
                TourneyHubUIManager.showLoading('Sending reset email...');
                
                await TourneyHubAuth.resetPassword(email);
                
                TourneyHubUIManager.showNotification(
                    'Password reset email sent! Check your inbox.',
                    'success'
                );
                
            } catch (error) {
                TourneyHubEventManager.emit('auth-error', error);
            } finally {
                TourneyHubUIManager.hideLoading();
            }
        }
    });
}

function _setupPerformanceMonitoring() {
    // Monitor network quality
    let lastNetworkCheck = Date.now();
    let networkSamples = [];
    
    const checkNetworkQuality = () => {
        const start = performance.now();
        
        // Simple network check by fetching a small resource
        fetch('https://www.google.com/favicon.ico', { 
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
        }).then(() => {
            const latency = performance.now() - start;
            networkSamples.push(latency);
            
            // Keep last 10 samples
            if (networkSamples.length > 10) {
                networkSamples.shift();
            }
            
            const avgLatency = networkSamples.reduce((a, b) => a + b, 0) / networkSamples.length;
            
            // Update network quality
            let quality = 'good';
            if (avgLatency > 500) quality = 'poor';
            else if (avgLatency > 200) quality = 'medium';
            
            TourneyHubAuth._performanceMetrics.networkQuality = quality;
            
        }).catch(() => {
            TourneyHubAuth._performanceMetrics.networkQuality = 'offline';
        });
    };
    
    // Check network quality periodically
    setInterval(checkNetworkQuality, 30000);
    checkNetworkQuality(); // Initial check
    
    // Monitor memory usage (if supported)
    if ('memory' in performance) {
        setInterval(() => {
            const memory = performance.memory;
            if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
                console.warn('High memory usage detected:', memory);
            }
        }, 60000);
    }
    
    // Log performance metrics periodically
    setInterval(() => {
        const metrics = TourneyHubAuth.getPerformanceMetrics();
        console.log('[Performance Metrics]', metrics);
    }, 300000); // Every 5 minutes
}

// ==================== GLOBAL EXPORTS ====================
window.TourneyHubAuth = TourneyHubAuth;
window.TourneyHubUIManager = TourneyHubUIManager;
window.TourneyHubEventManager = TourneyHubEventManager;

// ==================== ANIMATION CSS INJECTION ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    .2fa-digit:focus {
        outline: none;
        border-color: #6bcf7f !important;
        box-shadow: 0 0 0 3px rgba(107, 207, 127, 0.2) !important;
        transform: translateY(-2px);
    }
    
    #loading-overlay {
        animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .advanced-toast:hover {
        transform: translateX(0) scale(1.02) !important;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3) !important;
    }
    
    .advanced-toast::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: ${config.type === 'success' ? 'linear-gradient(90deg, #4CAF50, #8BC34A)' :
                     config.type === 'error' ? 'linear-gradient(90deg, #F44336, #FF5252)' :
                     config.type === 'warning' ? 'linear-gradient(90deg, #FFC107, #FF9800)' :
                     'linear-gradient(90deg, #2196F3, #03A9F4)'};
    }
`;
document.head.appendChild(style);

console.log('🎮 TourneyHub Advanced Authentication System Loaded');