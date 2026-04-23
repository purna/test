/**
 * Configuration File for pixelKanban
 * 
 * This file contains all configurable options for:
 * - GitHub Boards Integration
 * - Google Sheets Integration
 * - Firebase Authentication
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to js/config.js (it should already exist)
 * 2. Fill in the values for the services you want to use
 * 3. Save the file
 * 
 * For security, never commit this file with actual API keys to version control
 */

/* ============================================================================
 * GITHUB CONFIGURATION
 * ============================================================================
 * 
 * To get a GitHub Personal Access Token (PAT):
 * 1. Go to https://github.com/settings/tokens
 * 2. Click "Generate new token (classic)"
 * 3. Give it a descriptive name (e.g., "pixelKanban")
 * 4. Select the following scopes:
 *    - repo (full control of private repositories)
 *    - read:user (read user profile data)
 *    - read:org (read org and team membership)
 * 5. Click "Generate token"
 * 6. Copy the token (it will only be shown once!)
 * 
 * Alternatively, you can use an OAuth token from a GitHub OAuth App
 */

const githubConfig = {
     /**
      * Your GitHub Personal Access Token or OAuth token
      * 
      * How to get:
      * - PAT: https://github.com/settings/tokens
      * - OAuth: Create an OAuth App at https://github.com/settings/developers
      * 
      * For PAT, the token usually starts with 'ghp_'
      * For OAuth, the token usually starts with 'gho_'
      * 
      * NOTE: For this app, we recommend using a classic PAT with the following scopes:
      *   repo (full control of private repositories)
      *   read:user (read user profile data)
      *   read:org (read org and team membership)
      * 
      * If you want to use a fine-grained token, you need to grant it the necessary permissions
      * for the repositories you want to access (e.g., Contents: read/write, Issues: read/write,
      * Members: read, Metadata: read).
      */
     accessToken: '',  // Configure your token here or via the GitHub modal
     
     /**
      * Authentication method
      * Options: 'pat' (Personal Access Token) or 'oauth' (OAuth Token)
      */
     tokenType: 'pat',
     
     /**
      * Default repository owner/username for GitHub sync
      * Leave empty to select at runtime
      * Format: 'username' or 'org-name'
      */
     defaultOwner: '',  // e.g., 'your-username' or 'your-org'
     
     /**
      * Default repository name for GitHub sync
      * Leave empty to select at runtime
      */
     defaultRepo: '',   // e.g., 'your-repository'
    
    /**
     * Auto-sync settings
     */
    autoSync: {
        /**
         * Enable automatic push to GitHub when saving board
         * WARNING: This will push changes automatically!
         */
        enabled: false,
        
        /**
         * Sync interval in minutes (for background sync)
         * Currently not implemented - reserved for future use
         */
        intervalMinutes: 30
    },
    
    /**
     * Label mapping - maps kanban statuses to GitHub labels
     */
    labels: {
        backlog: 'backlog',
        todo: 'to do',
        inProgress: 'in progress',
        done: 'done'
    },
    
    /**
     * Label colors (hex without #)
     * These colors will be used when creating labels
     */
    labelColors: {
        backlog: '6e7681',    // Gray
        todo: '0e7a86',       // Teal
        inProgress: 'a371f7', // Purple
        done: '3fb950'         // Green
    },
    
    /**
     * Milestone colors (hex without #)
     * These colors will be used when creating milestones
     */
    milestoneColors: {
        backlog: '6e7681',    // Gray
        todo: '0e7a86',       // Teal
        inProgress: 'a371f7', // Purple
        done: '3fb950',      // Green
        'sprint-1': 'f7d358', // Yellow
        'sprint-2': 'ff6b6b', // Red
        release: '4ecdc4'    // Cyan
    },
    
    /**
     * Repository name for storing board data
     * When using GitHub as a database, boards are saved as JSON files
     */
    boardsRepo: 'pixel-kanban-boards'
};

/* ============================================================================
 * GOOGLE SHEETS CONFIGURATION
 * ============================================================================
 * 
 * To get Google Sheets API credentials:
 * 
 * Method 1 - Using Google Identity Services (OAuth):
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing
 * 3. Enable Google Sheets API: https://console.cloud.google.com/apis/library/sheets.googleapis.com
 * 4. Enable Google Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com
 * 5. Go to Credentials: https://console.cloud.google.com/apis/credentials
 * 6. Click "Create Credentials" > "OAuth client ID"
 * 7. Select "Web application" as application type
 * 8. Add authorized JavaScript origins:
 *    - http://localhost (for local development)
 *    - https://yourdomain.com (for production)
 * 9. Click Create
 * 10. Copy the Client ID (ends with .apps.googleusercontent.com)
 * 
 * Method 2 - Using API Key (read-only, not recommended):
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Click "Create Credentials" > "API key"
 * 3. Restrict the key to Google Sheets API
 * 4. Copy the API key
 */

const googleSheetsConfig = {
    /**
     * OAuth 2.0 Client ID
     * 
     * How to get:
     * 1. Go to https://console.cloud.google.com/apis/credentials
     * 2. Create OAuth client ID for web application
     * 3. Add your domain to authorized origins
     * 4. Copy the Client ID
     * 
     * Example: '123456789-abcdefghijklmnop.apps.googleusercontent.com'
     */
    clientId: '',
    
    /**
     * API Key (optional - for read-only access)
     * 
     * How to get:
     * 1. Go to https://console.cloud.google.com/apis/credentials
     * 2. Create API key
     * 3. Optionally restrict to Sheets and Drive APIs
     * 4. Copy the API key
     * 
     * Note: Not required if using OAuth flow above
     */
    apiKey: '',
    
    /**
     * OAuth scopes required for Google Sheets
     * These are the minimum scopes needed for the integration
     */
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',  // Read/write spreadsheets
        'https://www.googleapis.com/auth/drive.file'     // Access files created by this app
    ],
    
    /**
     * Default spreadsheet properties
     */
    defaults: {
        /**
         * Default sheet name when creating new spreadsheets
         */
        sheetName: 'Kanban',
        
        /**
         * Default board name prefix
         */
        boardNamePrefix: 'Kanban Board'
    },
    
    /**
     * Auto-save settings
     */
    autoSave: {
        /**
         * Enable auto-save to Google Sheets
         */
        enabled: false,
        
        /**
         * Auto-save interval in seconds
         */
        intervalSeconds: 60
    }
};

/* ============================================================================
 * FIREBASE CONFIGURATION (Optional)
 * ============================================================================
 * 
 * Firebase is used for user authentication and real-time features.
 * This is OPTIONAL - the kanban board works without Firebase.
 * 
 * To get Firebase config:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new Firebase project
 * 3. Add a web app to the project
  * 4. Copy the appFirebaseConfig object
 * 5. Enable Google sign-in in Authentication > Sign-in method
 */

const appFirebaseConfig = {
    /**
     * Firebase API Key
     * Get from: Project Settings > General > Your apps > Web app
     */
    apiKey: '',
    
    /**
     * Firebase Auth Domain
     * Format: YOUR_PROJECT_ID.firebaseapp.com
     */
    authDomain: '',
    
    /**
     * Firebase Project ID
     * Your project ID from Firebase console
     */
    projectId: '',
    
    /**
     * Firebase Storage Bucket
     * Format: YOUR_PROJECT_ID.appspot.com
     */
    storageBucket: '',
    
    /**
     * Firebase Messaging Sender ID
     * Get from: Project Settings > Cloud Messaging
     */
    messagingSenderId: '',
    
    /**
     * Firebase App ID
     * Get from: Project Settings > General > Your apps
     */
    appId: ''
};

/* ============================================================================
 * APPLICATION SETTINGS
 * ============================================================================
 */

const appConfig = {
    /**
     * Application name
     */
    appName: 'pixelKanban',
    
    /**
     * Version
     */
    version: '1.0.0',
    
    /**
     * Default panel configuration
     */
    defaultPanels: {
        count: 4,
        names: ['Backlog', 'To Do', 'In Progress', 'Done']
    },
    
    /**
     * Storage settings
     */
    storage: {
        /**
         * Primary storage method
         * Options: 'localStorage', 'github', 'googleSheets'
         */
        primary: 'localStorage',
        
        /**
         * Enable localStorage fallback
         */
        fallbackToLocal: true
    },
    
    /**
     * Feature flags
     */
    features: {
        /**
         * Enable GitHub integration
         */
        githubIntegration: true,

        /**
         * Enable Google Sheets integration
         */
        googleSheetsIntegration: true,

        /**
         * Enable Firebase authentication
         */
        firebaseAuth: false,

        /**
         * Enable drag and drop
         */
        dragAndDrop: true,

        /**
         * Enable comments
         */
        comments: true,

        /**
         * Enable attachments
         */
        attachments: true,

        /**
         * Enable user management
         */
        userManagement: true,

        /**
         * Enable notifications
         */
        notifications: true,

        /**
         * Enable milestones integration
         */
        milestones: true,

        /**
         * Enable GitHub labels integration
         */
        labels: true
    },
    
    /**
     * UI settings
     */
    ui: {
        /**
         * Theme: 'dark', 'light', or 'auto'
         */
        theme: 'dark',
        
        /**
         * Date format: 'uk' (DD/MM/YYYY) or 'us' (MM/DD/YYYY)
         */
        dateFormat: 'uk',
        
        /**
         * Show task counts in column headers
         */
        showTaskCounts: true,
        
        /**
         * Compact mode for small screens
         */
        compactMode: false
    }
};

/* ============================================================================
 * CONFIGURATION UTILITIES
 * ============================================================================
 * 
 * These functions help manage configuration values
 */

/**
 * Check if GitHub integration is configured
 */
function isGitHubConfigured() {
    return !!githubConfig.accessToken;
}

/**
 * Check if Google Sheets integration is configured
 */
function isGoogleSheetsConfigured() {
    return !!googleSheetsConfig.clientId;
}

/**
 * Check if Firebase is configured and initialized
 */
function isFirebaseConfigured() {
    // Check if window.firebaseAuth is available and initialized (from firebaseConfig.js)
    return typeof window !== 'undefined' && typeof window.firebaseAuth !== 'undefined' && window.firebaseAuth !== null;
}

/**
 * Get the effective GitHub config (merges with defaults)
 */
function getGitHubConfig() {
    return {
        ...githubConfig,
        isConfigured: isGitHubConfigured()
    };
}

/**
 * Get the effective Google Sheets config (merges with defaults)
 */
function getGoogleSheetsConfig() {
    return {
        ...googleSheetsConfig,
        isConfigured: isGoogleSheetsConfigured()
    };
}

/**
 * Get the effective app config (merges with defaults)
 */
function getAppConfig() {
    return {
        ...appConfig,
        firebaseConfigured: isFirebaseConfigured(),
        githubConfigured: isGitHubConfigured(),
        googleSheetsConfigured: isGoogleSheetsConfigured()
    };
}

/**
 * Export configuration summary (without sensitive values)
 * Useful for debugging
 */
function getConfigSummary() {
    return {
        app: {
            name: appConfig.appName,
            version: appConfig.version
        },
        features: appConfig.features,
        storage: appConfig.storage,
        github: {
            configured: isGitHubConfigured(),
            tokenType: isGitHubConfigured() ? githubConfig.tokenType : null,
            defaultOwner: githubConfig.defaultOwner,
            defaultRepo: githubConfig.defaultRepo
        },
        googleSheets: {
            configured: isGoogleSheetsConfigured(),
            hasClientId: !!googleSheetsConfig.clientId,
            hasApiKey: !!googleSheetsConfig.apiKey
        },
        firebase: {
            configured: isFirebaseConfigured(),
            hasApiKey: !!appFirebaseConfig.apiKey,
            projectId: appFirebaseConfig.projectId || null
        }
    };
}

// Log config summary on load (for debugging)
console.log('pixelKanban Config:', getConfigSummary());
