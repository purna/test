/**
 * Firebase Configuration
 * Replace the config values with your own Firebase project settings
 * Get these from: https://console.firebase.google.com/
 * 1. Create a project
 * 2. Enable Authentication > Google sign-in provider
 * 3. Add a web app to get the config
 */

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (only if config is set)
let firebaseApp = null;
let firebaseAuth = null;

if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.warn('Firebase initialization failed:', error.message);
    }
} else {
    console.warn('Firebase not configured. Please add your Firebase config to js/firebaseConfig.js');
}

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Sign in with Google
async function signInWithGoogle() {
    if (!firebaseAuth) {
        alert('Firebase is not configured. Please add your Firebase config to js/firebaseConfig.js');
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

// Check if Firebase is configured
function isFirebaseConfigured() {
    return firebaseAuth !== null;
}
