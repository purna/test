/**
 * Firebase Configuration
 * This file initializes Firebase using config from config.js
 */

// Firebase is initialized using appFirebaseConfig from config.js
let firebaseApp = null;
let firebaseAuth = null;

// Check if Firebase is configured (config.js must be loaded first)
if (typeof appFirebaseConfig !== 'undefined' && appFirebaseConfig.apiKey && appFirebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        firebaseApp = firebase.initializeApp(appFirebaseConfig);
        firebaseAuth = firebase.auth();
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.warn('Firebase initialization failed:', error.message);
    }
} else {
    console.warn('Firebase not configured. Please add your Firebase config to js/config.js');
}

// Google Auth Provider - initialize only if firebaseAuth exists
let googleProvider = null;
if (typeof firebase !== 'undefined' && firebaseAuth) {
    googleProvider = new firebase.auth.GoogleAuthProvider();
}

// Sign in with Google
async function signInWithGoogle() {
    if (!firebaseAuth) {
        alert('Firebase is not configured. Please add your Firebase config to js/config.js');
        return null;
    }
    
    try {
        const result = await firebaseAuth.signInWithPopup(googleProvider);
        const user = result.user;
        console.log('Google sign-in successful:', user.displayName);
        return user;
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
}

// Sign out
async function signOut() {
    if (!firebaseAuth) return;
    
    try {
        await firebaseAuth.signOut();
        console.log('Signed out successfully');
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

// Get current user
function getCurrentFirebaseUser() {
    return firebaseAuth ? firebaseAuth.currentUser : null;
}

// Global Google Sign-In callback for Google Identity Services
// This must be defined before the GSI library loads
window.handleGoogleSignIn = async (response) => {
    try {
        // The response contains an ID token that can be exchanged for credentials
        const credential = firebaseAuth?.signInWithCredential(
            firebase.auth.GoogleAuthProvider.credential(response.credential)
        );
        if (credential) {
            console.log('Google sign-in successful via GSI');
        }
        return credential;
    } catch (error) {
        console.error('GSI sign-in error:', error);
        throw error;
    }
};

// Export for use in other scripts (do not redeclare isFirebaseConfigured)
// Use config.js's isFirebaseConfigured() which now checks firebaseAuth
