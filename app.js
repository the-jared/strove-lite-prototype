// Strove Lite WhatsApp Prototype - State Machine & Conversation Flow

// ==========================================
// OPENAI CONFIGURATION
// ==========================================

// API key priority: 1. GitHub secret (injected at build) 2. URL param 3. localStorage
let OPENAI_API_KEY = '';

// First, check if config was injected by GitHub Actions
if (typeof window.STROVE_CONFIG !== 'undefined' && window.STROVE_CONFIG.OPENAI_API_KEY) {
    OPENAI_API_KEY = window.STROVE_CONFIG.OPENAI_API_KEY;
}

// Check URL params for API key (for easy demo sharing / override)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('apikey')) {
    OPENAI_API_KEY = urlParams.get('apikey');
    localStorage.setItem('strove_openai_key', OPENAI_API_KEY);
}

// Fallback to localStorage if nothing else set
if (!OPENAI_API_KEY) {
    OPENAI_API_KEY = localStorage.getItem('strove_openai_key') || '';
}

// ==========================================
// STATE MANAGEMENT
// ==========================================

const AppState = {
    // User data
    user: {
        registered: false,
        firstName: '',
        surname: '',
        email: '',
        language: 'English',
        gender: null,
        height: null,
        weight: null,
        pavsdays: null,
        pavsMins: null,
        goals: [],
        connectedApps: [],
        profileComplete: false
    },

    // Game state
    coins: 0,
    streak: 0,
    lastCheckIn: null,
    checkInToday: false,

    // Challenge state
    challengeJoined: false,
    challengeProgress: 0,
    challengeTarget: 150, // minutes

    // Activity data (simulated - expanded)
    weeklyActivity: {
        activeMinutes: 85,
        steps: 32450,
        distance: 24.5,
        avgSleep: '6h 45m',
        sleepQuality: 72,
        calories: 1850,
        workouts: [
            { day: 'Mon', type: 'Walk', duration: 25, intensity: 'Light' },
            { day: 'Wed', type: 'Run', duration: 30, intensity: 'Moderate' },
            { day: 'Fri', type: 'Strength', duration: 30, intensity: 'Hard' }
        ],
        dailySteps: [4200, 6800, 5100, 8200, 4500, 2100, 1550],
        heartRateAvg: 68,
        restingHR: 62
    },

    // Meal tracking data
    mealHistory: [
        { date: 'Today', meal: 'Breakfast', score: 7, notes: 'Oatmeal with berries', calories: 350 },
        { date: 'Today', meal: 'Lunch', score: 6, notes: 'Chicken salad', calories: 520 },
        { date: 'Yesterday', meal: 'Dinner', score: 5, notes: 'Pizza', calories: 850 },
        { date: 'Yesterday', meal: 'Lunch', score: 8, notes: 'Grilled fish with vegetables', calories: 480 }
    ],

    // Check-in history
    checkInHistory: [
        { date: 'Today', sleep: 3, stress: 2, active: 'yes', diet: 2 },
        { date: 'Yesterday', sleep: 4, stress: 3, active: 'yes', diet: 3 },
        { date: '2 days ago', sleep: 2, stress: 4, active: 'no', diet: 2 }
    ],

    // Conversation state
    currentFlow: 'initial',
    flowStep: 0,
    tempData: {},
    conversationHistory: [],

    // Settings
    reminderFrequency: 'daily',
    challengeReminders: 'weekly',

    // Face scan data
    lastFaceScan: null,
    faceScanResults: null
};

// Flow definitions
const FLOWS = {
    INITIAL: 'initial',
    ONBOARDING: 'onboarding',
    MAIN_MENU: 'mainMenu',
    CHECK_IN: 'checkIn',
    HEALTH_SUMMARY: 'healthSummary',
    CHALLENGES: 'challenges',
    MY_SCORE: 'myScore',
    LOG_ACTIVITY: 'logActivity',
    CONNECT_APP: 'connectApp',
    COINS: 'coins',
    MEAL_SCAN: 'mealScan',
    SETTINGS: 'settings',
    HELP: 'help',
    EXTENDED_PROFILE: 'extendedProfile',
    FACE_SCAN: 'faceScan',
    AI_CHAT: 'aiChat',
    CONTENT_LIBRARY: 'contentLibrary'
};

// ==========================================
// WHATSAPP COMPATIBILITY SETTINGS
// ==========================================

const WHATSAPP_LIMITS = {
    MAX_BUTTONS: 3,           // WhatsApp allows max 3 reply buttons
    MAX_LIST_ITEMS: 10,       // List messages can have up to 10 items
    MAX_BUTTON_TEXT: 20,      // Button text max 20 characters
    MAX_LIST_TITLE: 24,       // List item title max 24 characters
    MAX_LIST_DESC: 72,        // List item description max 72 characters
    MAX_MESSAGE_LENGTH: 1600, // Text message max length
    MAX_CAROUSEL_CARDS: 10,   // Carousel templates max 10 cards
    MAX_CAROUSEL_BODY: 160    // Carousel card body max 160 characters
};

// Web App URLs for features that need browser fallback
const WEB_APP_URLS = {
    FACE_SCAN: 'https://app.strove.ai/face-scan',
    CONNECT_APP: 'https://app.strove.ai/connect',
    DASHBOARD: 'https://app.strove.ai/dashboard',
    REWARDS: 'https://app.strove.ai/rewards'
};

// WhatsApp text formatting helpers (WhatsApp markdown)
function bold(text) {
    return `*${text}*`;
}

function italic(text) {
    return `_${text}_`;
}

function strike(text) {
    return `~${text}~`;
}

function mono(text) {
    return `\`\`\`${text}\`\`\``;
}

// Progress bar using text characters (WhatsApp compatible)
function textProgressBar(current, total, length = 10) {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${percentage}%`;
}

// Truncate text to WhatsApp limits
function truncateForButton(text, maxLen = WHATSAPP_LIMITS.MAX_BUTTON_TEXT) {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + '...';
}

function truncateForListTitle(text) {
    return truncateForButton(text, WHATSAPP_LIMITS.MAX_LIST_TITLE);
}

function truncateForListDesc(text) {
    return truncateForButton(text, WHATSAPP_LIMITS.MAX_LIST_DESC);
}

// ==========================================
// TRANSLATIONS
// ==========================================

const translations = {
    English: {
        // Menu items
        menu_checkin: '✅ Check-in',
        menu_ai: '🤖 AI Insights',
        menu_content: '📚 Content Library',
        menu_health: '📊 Health summary',
        menu_facescan: '🫀 Face scan',
        menu_challenges: '🏆 Challenges',
        menu_score: '⭐ My Score',
        menu_activity: '🏃 Log activity',
        menu_coins: '🪙 Coins & rewards',
        menu_meal: '🍽 Meal scan',
        menu_settings: '⚙️ Settings',
        menu_help: '❓ Help',
        menu_back: 'Menu',

        // Common actions
        btn_continue: 'Continue',
        btn_skip: 'Skip',
        btn_done: 'Done',
        btn_cancel: 'Cancel',
        btn_yes: 'Yes',
        btn_no: 'No',
        btn_back: '← Back',

        // Greetings
        welcome_back: 'Welcome back, {name}! 👋',
        what_to_do: 'What would you like to do today?',
        hey_name: 'Hey {name}! What would you like to do?',

        // Check-in
        checkin_start: "Let's do your daily check-in! This helps us track your wellness journey.",
        checkin_sleep: 'How did you sleep last night?',
        checkin_stress: 'How are your stress levels today?',
        checkin_active: 'Have you been active today?',
        checkin_mood: 'How are you feeling right now?',
        checkin_complete: '🎉 Check-in complete!',
        checkin_coins: "You've earned {coins} coins for checking in today!",
        checkin_streak: '🔥 {days}-day streak! Keep it up!',

        // Sleep options
        sleep_great: '😴 Great (7-9 hrs)',
        sleep_ok: '😐 OK (5-7 hrs)',
        sleep_poor: '😫 Poor (<5 hrs)',

        // Stress options
        stress_low: '😌 Low',
        stress_moderate: '😐 Moderate',
        stress_high: '😰 High',

        // Activity options
        activity_yes: '✅ Yes',
        activity_no: '❌ Not yet',

        // Mood options
        mood_great: '😊 Great',
        mood_good: '🙂 Good',
        mood_okay: '😐 Okay',
        mood_low: '😔 Low',

        // Health summary
        health_title: '📊 Your Health Summary',
        health_activity: 'Activity This Week',
        health_steps: 'steps',
        health_active_mins: 'active minutes',
        health_sleep: 'Avg Sleep',
        health_heart: 'Heart Health Score',

        // Challenges
        challenges_title: '🏆 Challenges',
        challenges_join: 'Join Challenge',
        challenges_progress: 'Your Progress',

        // Settings
        settings_title: '⚙️ Settings',
        settings_language: 'Language',
        settings_notifications: 'Notifications',
        settings_privacy: 'Privacy',
        settings_account: 'Account',
        language_updated: '✅ Done. Language updated.',

        // Content Library
        content_title: '📚 Content Library',
        content_loading: 'Loading content...',
        content_explore: 'Explore workouts, recipes, and wellness content.',
        content_watch: '▶️ Watch Video',
        content_listen: '🎧 Listen Now',
        content_complete: '✅ Mark Complete',
        content_like: '❤️ Like',
        content_more: '📚 More Content',

        // Onboarding
        onboard_link_account: "Let's link you to your Strove account.\n\nPlease enter your email or member ID.",
        onboard_code_sent: "Thanks — we're securing your account.\n\nWe've sent a 6-digit code to your email.\nPlease enter it here.",
        onboard_verified: "✅ Verified.\n\nWhat's your first name?",
        onboard_surname: "Thanks, {name}. What's your surname?",
        onboard_account_created: "✅ Account created!\n\nLet's get started, {name}.",
        onboard_first_action: "Do your first check-in or connect a fitness app to pull your steps and workouts automatically.",
        onboard_first_checkin: '✅ Do first check-in',
        onboard_connect_app: '🔗 Connect fitness app',
        onboard_skip: 'Skip for now',
        onboard_code_resent: "Done — we've sent a new code. Please enter it here.",
        onboard_code_error: "Hmm, that code didn't match. Double-check your email and try again, or type RESEND.",

        // Misc
        coins_label: '🪙 {count} coins',
        loading: 'Loading...',
        error_generic: 'Something went wrong. Please try again.',
    },

    isiZulu: {
        // Menu items
        menu_checkin: '✅ Bhalisela',
        menu_ai: '🤖 AI Ukuhlaziya',
        menu_content: '📚 Umtapo Wokuqukethwe',
        menu_health: '📊 Isifinyezo Sempilo',
        menu_facescan: '🫀 Skena Ubuso',
        menu_challenges: '🏆 Izinselelo',
        menu_score: '⭐ Iphuzu Lami',
        menu_activity: '🏃 Bhala Umsebenzi',
        menu_coins: '🪙 Izinhlamvu & Imivuzo',
        menu_meal: '🍽 Skena Ukudla',
        menu_settings: '⚙️ Izilungiselelo',
        menu_help: '❓ Usizo',
        menu_back: 'Imenyu',

        // Common actions
        btn_continue: 'Qhubeka',
        btn_skip: 'Yeqa',
        btn_done: 'Kwenziwe',
        btn_cancel: 'Khansela',
        btn_yes: 'Yebo',
        btn_no: 'Cha',
        btn_back: '← Emuva',

        // Greetings
        welcome_back: 'Wamkelekile futhi, {name}! 👋',
        what_to_do: 'Ufuna ukwenzani namuhla?',
        hey_name: 'Sawubona {name}! Ufuna ukwenzani?',

        // Check-in
        checkin_start: 'Ake senze ukubhalisela kwakho kwansuku zonke! Lokhu kusisiza ukulandelela uhambo lwakho lwempilo.',
        checkin_sleep: 'Ulele kanjani izolo ebusuku?',
        checkin_stress: 'Zinjani izinga lakho lokucindezeleka namuhla?',
        checkin_active: 'Ubusebenza namuhla?',
        checkin_mood: 'Uzizwa kanjani manje?',
        checkin_complete: '🎉 Ukubhalisela kuphelile!',
        checkin_coins: 'Uzuze izinhlamvu ezingu-{coins} ngokubhalisela namuhla!',
        checkin_streak: '🔥 Usuku lwama-{days} olulandelayo! Qhubeka!',

        // Sleep options
        sleep_great: '😴 Kuhle (7-9 amahora)',
        sleep_ok: '😐 Kulungile (5-7 amahora)',
        sleep_poor: '😫 Kubi (<5 amahora)',

        // Stress options
        stress_low: '😌 Phansi',
        stress_moderate: '😐 Maphakathi',
        stress_high: '😰 Phezulu',

        // Activity options
        activity_yes: '✅ Yebo',
        activity_no: '❌ Cha okwamanje',

        // Mood options
        mood_great: '😊 Kuhle kakhulu',
        mood_good: '🙂 Kuhle',
        mood_okay: '😐 Kulungile',
        mood_low: '😔 Phansi',

        // Health summary
        health_title: '📊 Isifinyezo Sempilo Yakho',
        health_activity: 'Umsebenzi Waleviki',
        health_steps: 'izinyathelo',
        health_active_mins: 'imizuzu esebenzayo',
        health_sleep: 'Ubuthongo Obujwayelekile',
        health_heart: 'Iphuzu Lempilo Yenhliziyo',

        // Challenges
        challenges_title: '🏆 Izinselelo',
        challenges_join: 'Joyina Inselelo',
        challenges_progress: 'Inqubekelaphambili Yakho',

        // Settings
        settings_title: '⚙️ Izilungiselelo',
        settings_language: 'Ulimi',
        settings_notifications: 'Izaziso',
        settings_privacy: 'Ubumfihlo',
        settings_account: 'I-Akhawunti',
        language_updated: '✅ Kwenziwe. Ulimi lubuyekeziwe.',

        // Content Library
        content_title: '📚 Umtapo Wokuqukethwe',
        content_loading: 'Iyalayisha...',
        content_explore: 'Hlola ukuzivocavoca, izindlela zokudla, nokuqukethwe kwempilo.',
        content_watch: '▶️ Bukela Ividiyo',
        content_listen: '🎧 Lalela Manje',
        content_complete: '✅ Phothula',
        content_like: '❤️ Thanda',
        content_more: '📚 Okuningi',

        // Onboarding
        onboard_link_account: "Ake sixhume i-akhawunti yakho ye-Strove.\n\nSicela ufake i-imeyili yakho noma i-ID yobulunga.",
        onboard_code_sent: "Siyabonga — siqinisekisa i-akhawunti yakho.\n\nSithumele ikhodi yezinombolo ezingu-6 ku-imeyili yakho.\nSicela ufake lapha.",
        onboard_verified: "✅ Kuqinisekisiwe.\n\nUbani igama lakho?",
        onboard_surname: "Siyabonga, {name}. Isibongo sakho sithini?",
        onboard_account_created: "✅ I-akhawunti idalwe!\n\nAke siqale, {name}.",
        onboard_first_action: "Yenza ukubhalisela kwakho kokuqala noma uxhume uhlelo lokuzivocavoca ukuze uthole izinyathelo zakho nemisebenzi ngokuzenzakalelayo.",
        onboard_first_checkin: '✅ Yenza ukubhalisela kokuqala',
        onboard_connect_app: '🔗 Xhuma uhlelo',
        onboard_skip: 'Yeqa okwamanje',
        onboard_code_resent: "Kwenziwe — sithumele ikhodi entsha. Sicela ufake lapha.",
        onboard_code_error: "Hmm, leyo khodi ayihambisani. Hlola i-imeyili yakho futhi uzame futhi, noma thayipha RESEND.",

        // Misc
        coins_label: '🪙 izinhlamvu ezingu-{count}',
        loading: 'Iyalayisha...',
        error_generic: 'Kukhona okungahambanga kahle. Sicela uzame futhi.',
    },

    Afrikaans: {
        // Menu items
        menu_checkin: '✅ Inklok',
        menu_ai: '🤖 KI Insigte',
        menu_content: '📚 Inhoud Biblioteek',
        menu_health: '📊 Gesondheid Opsomming',
        menu_facescan: '🫀 Gesig Skandering',
        menu_challenges: '🏆 Uitdagings',
        menu_score: '⭐ My Telling',
        menu_activity: '🏃 Teken Aktiwiteit',
        menu_coins: '🪙 Munte & Belonings',
        menu_meal: '🍽 Maaltyd Skandering',
        menu_settings: '⚙️ Instellings',
        menu_help: '❓ Hulp',
        menu_back: 'Kieslys',

        // Common actions
        btn_continue: 'Gaan voort',
        btn_skip: 'Slaan oor',
        btn_done: 'Klaar',
        btn_cancel: 'Kanselleer',
        btn_yes: 'Ja',
        btn_no: 'Nee',
        btn_back: '← Terug',

        // Greetings
        welcome_back: 'Welkom terug, {name}! 👋',
        what_to_do: 'Wat wil jy vandag doen?',
        hey_name: 'Haai {name}! Wat wil jy doen?',

        // Check-in
        checkin_start: 'Kom ons doen jou daaglikse inklok! Dit help ons om jou welstand reis te volg.',
        checkin_sleep: 'Hoe het jy gisteraand geslaap?',
        checkin_stress: 'Hoe is jou stresvlakke vandag?',
        checkin_active: 'Was jy vandag aktief?',
        checkin_mood: 'Hoe voel jy nou?',
        checkin_complete: '🎉 Inklok voltooi!',
        checkin_coins: 'Jy het {coins} munte verdien vir vandag se inklok!',
        checkin_streak: '🔥 {days}-dag reeks! Hou so aan!',

        // Sleep options
        sleep_great: '😴 Goed (7-9 ure)',
        sleep_ok: '😐 OK (5-7 ure)',
        sleep_poor: '😫 Sleg (<5 ure)',

        // Stress options
        stress_low: '😌 Laag',
        stress_moderate: '😐 Matig',
        stress_high: '😰 Hoog',

        // Activity options
        activity_yes: '✅ Ja',
        activity_no: '❌ Nog nie',

        // Mood options
        mood_great: '😊 Fantasties',
        mood_good: '🙂 Goed',
        mood_okay: '😐 OK',
        mood_low: '😔 Af',

        // Health summary
        health_title: '📊 Jou Gesondheid Opsomming',
        health_activity: 'Aktiwiteit Hierdie Week',
        health_steps: 'stappe',
        health_active_mins: 'aktiewe minute',
        health_sleep: 'Gem. Slaap',
        health_heart: 'Hart Gesondheid Telling',

        // Challenges
        challenges_title: '🏆 Uitdagings',
        challenges_join: 'Sluit Aan by Uitdaging',
        challenges_progress: 'Jou Vordering',

        // Settings
        settings_title: '⚙️ Instellings',
        settings_language: 'Taal',
        settings_notifications: 'Kennisgewings',
        settings_privacy: 'Privaatheid',
        settings_account: 'Rekening',
        language_updated: '✅ Klaar. Taal opgedateer.',

        // Content Library
        content_title: '📚 Inhoud Biblioteek',
        content_loading: 'Laai tans...',
        content_explore: 'Verken oefeninge, resepte, en welstand inhoud.',
        content_watch: '▶️ Kyk Video',
        content_listen: '🎧 Luister Nou',
        content_complete: '✅ Merk Voltooi',
        content_like: '❤️ Hou van',
        content_more: '📚 Meer Inhoud',

        // Onboarding
        onboard_link_account: "Kom ons koppel jou aan jou Strove-rekening.\n\nVoer asseblief jou e-pos of lid-ID in.",
        onboard_code_sent: "Dankie — ons beveilig jou rekening.\n\nOns het 'n 6-syfer kode na jou e-pos gestuur.\nVoer dit asseblief hier in.",
        onboard_verified: "✅ Geverifieer.\n\nWat is jou voornaam?",
        onboard_surname: "Dankie, {name}. Wat is jou van?",
        onboard_account_created: "✅ Rekening geskep!\n\nKom ons begin, {name}.",
        onboard_first_action: "Doen jou eerste inklok of koppel 'n fiksheid-app om jou stappe en oefeninge outomaties te trek.",
        onboard_first_checkin: '✅ Doen eerste inklok',
        onboard_connect_app: '🔗 Koppel fiksheid-app',
        onboard_skip: 'Slaan vir eers oor',
        onboard_code_resent: "Klaar — ons het 'n nuwe kode gestuur. Voer dit asseblief hier in.",
        onboard_code_error: "Hmm, daardie kode pas nie. Kyk weer na jou e-pos en probeer weer, of tik RESEND.",

        // Misc
        coins_label: '🪙 {count} munte',
        loading: 'Laai tans...',
        error_generic: 'Iets het verkeerd geloop. Probeer asseblief weer.',
    }
};

// Translation helper function
function t(key, params = {}) {
    const lang = AppState.user?.language || 'English';
    const langStrings = translations[lang] || translations.English;
    let text = langStrings[key] || translations.English[key] || key;

    // Replace placeholders like {name}, {coins}, etc.
    Object.keys(params).forEach(param => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });

    return text;
}

// Content Library API
const CONTENT_API_URL = 'https://cms.strove.ai/api/library-contents';
const CONTENT_API_BASE = 'https://lively-crystal-f13b3a6e8c.strapiapp.com/api/library-contents';
const CONTENT_WHITELABEL_ID = '0ba3f986-b35d-47ac-9bd4-0fcdca675461';

// Get Content API token from config (injected by GitHub Actions) or fallback
function getContentApiToken() {
    if (typeof window.STROVE_CONFIG !== 'undefined' && window.STROVE_CONFIG.CONTENT_API_TOKEN) {
        return window.STROVE_CONFIG.CONTENT_API_TOKEN;
    }
    return '';
}

function getContentApiHeaders() {
    const token = getContentApiToken();
    return {
        'whitelabel-id': CONTENT_WHITELABEL_ID,
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// ==========================================
// DOM ELEMENTS
// ==========================================

const chatMessages = document.getElementById('chatMessages');
const quickButtons = document.getElementById('quickButtons');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const debugState = document.getElementById('debugState');
const debugUser = document.getElementById('debugUser');
const debugCoins = document.getElementById('debugCoins');
const debugStreak = document.getElementById('debugStreak');
const resetBtn = document.getElementById('resetBtn');
const toggleDebug = document.getElementById('toggleDebug');
const debugPanel = document.getElementById('debugPanel');

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function getTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateDebugPanel() {
    debugState.textContent = AppState.currentFlow;
    debugUser.textContent = AppState.user.registered ? AppState.user.firstName : 'Not registered';
    debugCoins.textContent = AppState.coins;
    debugStreak.textContent = AppState.streak;
}

function saveState() {
    localStorage.setItem('stroveState', JSON.stringify(AppState));
}

function loadState() {
    const saved = localStorage.getItem('stroveState');
    if (saved) {
        Object.assign(AppState, JSON.parse(saved));
    }
}

// Check for coin milestones
function checkCoinMilestone(oldCoins, newCoins) {
    const milestones = [
        { threshold: 50, message: "You've hit 50 coins! 🪙" },
        { threshold: 100, message: "100 coins — you can redeem your first reward! 🎁" },
        { threshold: 250, message: "250 coins! You're on fire! 🔥" },
        { threshold: 500, message: "500 coins — halfway to the big rewards! 💪" },
        { threshold: 1000, message: "1,000 coins! You're a Strove legend! 🏆" }
    ];

    for (const milestone of milestones) {
        if (oldCoins < milestone.threshold && newCoins >= milestone.threshold) {
            return milestone.message;
        }
    }
    return null;
}

// ==========================================
// MESSAGE RENDERING
// ==========================================

function addMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.innerHTML = text;

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getTimeString();

    messageDiv.appendChild(textDiv);
    messageDiv.appendChild(timeDiv);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message bot typing';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatMessages.appendChild(indicator);
    scrollToBottom();
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

async function botMessage(text, delayMs = 800) {
    showTypingIndicator();
    await delay(delayMs);
    hideTypingIndicator();
    addMessage(text, false);
}

function setButtons(buttons) {
    quickButtons.innerHTML = '';
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `quick-btn ${btn.type || ''}`;
        button.textContent = btn.label;
        button.onclick = () => handleButtonClick(btn.action, btn.value);
        quickButtons.appendChild(button);
    });
}

function clearButtons() {
    quickButtons.innerHTML = '';
}

// ==========================================
// GLOBAL INPUT HANDLING
// ==========================================

function handleGlobalCommands(input) {
    const normalized = input.toUpperCase().trim();

    switch (normalized) {
        case 'MENU':
        case 'CANCEL':
            showMainMenu();
            return true;
        case 'HELP':
            startHelpFlow();
            return true;
        case 'STOP':
            handleStop();
            return true;
        case 'START':
            if (!AppState.user.registered) {
                startOnboarding();
            } else {
                showMainMenu();
            }
            return true;
        case 'CONNECT':
            startConnectApp();
            return true;
        default:
            return false;
    }
}

function handleStop() {
    AppState.currentFlow = FLOWS.INITIAL;
    botMessage("You've been unsubscribed.\n\nTo restart anytime, type START.");
    clearButtons();
    updateDebugPanel();
}

// ==========================================
// ONBOARDING FLOW
// ==========================================

async function startOnboarding() {
    AppState.currentFlow = FLOWS.ONBOARDING;
    AppState.flowStep = 0;
    updateDebugPanel();

    await botMessage(`<div class="welcome-header">
<img src="https://cdn.prod.website-files.com/67f77c104bf4ada12b7429ad/67f781e4a8c1bd2a97ae8fbe_strove-logo.svg" alt="Strove" class="strove-logo">
</div>

<strong>Your health, all in one place</strong> 👋

✅ Track health & activity in one view
✅ Join challenges that build healthy habits
✅ Earn rewards for positive choices
✅ Get AI-powered insights & guidance

<a href="https://www.strove.ai/" target="_blank">Learn more at strove.ai →</a>

We only message you if you opt in. Type STOP anytime to unsubscribe.`);

    setButtons([
        { label: '✅ I agree – continue', action: 'onboard_agree', type: 'primary' },
        { label: '❌ Not now', action: 'onboard_decline', type: 'secondary' }
    ]);
}

async function handleOnboardingStep(action, value) {
    switch (AppState.flowStep) {
        case 0: // Agreement
            if (action === 'onboard_agree') {
                AppState.flowStep = 1;
                await botMessage("Choose your language:\nKhetha ulimi lwakho:\nKies jou taal:");
                setButtons([
                    { label: 'English', action: 'set_language', value: 'English', type: 'primary' },
                    { label: 'IsiZulu', action: 'set_language', value: 'isiZulu' },
                    { label: 'Afrikaans', action: 'set_language', value: 'Afrikaans' }
                ]);
            } else {
                await botMessage("No problem. If you change your mind, just message Hi again.");
                clearButtons();
                AppState.currentFlow = FLOWS.INITIAL;
            }
            break;

        case 1: // Language
            if (action === 'set_language') {
                addMessage(value, true);
                AppState.user.language = value;
                AppState.flowStep = 2;
                await botMessage(t('onboard_link_account'));
                clearButtons();
            }
            break;

        case 2: // Email/ID input
            AppState.user.email = value;
            AppState.flowStep = 3;
            await botMessage(t('onboard_code_sent'));
            clearButtons();
            break;

        case 3: // Verification code
            if (/^\d{6}$/.test(value)) {
                AppState.flowStep = 4;
                await botMessage(t('onboard_verified'));
            } else if (value.toUpperCase() === 'RESEND') {
                await botMessage(t('onboard_code_resent'));
            } else {
                await botMessage(t('onboard_code_error'));
            }
            break;

        case 4: // First name
            AppState.user.firstName = value;
            AppState.flowStep = 5;
            await botMessage(t('onboard_surname', { name: value }));
            break;

        case 5: // Surname - End of lean onboarding
            AppState.user.surname = value;
            AppState.user.registered = true;
            AppState.flowStep = 6;

            await botMessage(t('onboard_account_created', { name: AppState.user.firstName }));
            await delay(500);
            await botMessage(t('onboard_first_action'));

            setButtons([
                { label: t('onboard_first_checkin'), action: 'first_checkin', type: 'primary' },
                { label: t('onboard_connect_app'), action: 'first_connect' },
                { label: t('onboard_skip'), action: 'skip_first', type: 'secondary' }
            ]);
            saveState();
            break;

        case 6: // First value choice
            if (action === 'first_checkin') {
                startCheckIn();
            } else if (action === 'first_connect') {
                startConnectApp();
            } else {
                showMainMenu();
            }
            break;
    }
    updateDebugPanel();
}

// ==========================================
// EXTENDED PROFILE FLOW (Lazy Load)
// ==========================================

async function startExtendedProfile(returnFlow) {
    AppState.currentFlow = FLOWS.EXTENDED_PROFILE;
    AppState.flowStep = 0;
    AppState.tempData.returnFlow = returnFlow;
    updateDebugPanel();

    await botMessage("To calculate your scores and summaries, we need a few more details.\n\nWhat's your gender? (Optional)");

    setButtons([
        { label: 'Female', action: 'set_gender', value: 'Female' },
        { label: 'Male', action: 'set_gender', value: 'Male' },
        { label: 'Prefer not to say', action: 'set_gender', value: null }
    ]);
}

async function handleExtendedProfileStep(action, value) {
    switch (AppState.flowStep) {
        case 0: // Gender
            addMessage(value || 'Prefer not to say', true);
            AppState.user.gender = value;
            AppState.flowStep = 1;
            await botMessage("What's your height in cm?\n\nExample: 175 (or type SKIP)");
            clearButtons();
            break;

        case 1: // Height
            if (value.toUpperCase() === 'SKIP') {
                AppState.flowStep = 2;
                await botMessage("What's your weight in kg?\n\nExample: 82 (or type SKIP)");
            } else {
                const height = parseInt(value);
                if (isNaN(height) || height < 50 || height > 300) {
                    await botMessage("Please enter a number in cm (example: 175) or type SKIP.");
                } else {
                    AppState.user.height = height;
                    AppState.flowStep = 2;
                    await botMessage("What's your weight in kg?\n\nExample: 82 (or type SKIP)");
                }
            }
            break;

        case 2: // Weight
            if (value.toUpperCase() === 'SKIP') {
                AppState.flowStep = 3;
                showPAVSQuestion();
            } else {
                const weight = parseInt(value);
                if (isNaN(weight) || weight < 20 || weight > 500) {
                    await botMessage("Please enter a number in kg (example: 82) or type SKIP.");
                } else {
                    AppState.user.weight = weight;
                    AppState.flowStep = 3;
                    showPAVSQuestion();
                }
            }
            break;

        case 3: // PAVS days
            addMessage(value, true);
            AppState.user.pavsdays = parseInt(value);
            AppState.flowStep = 4;
            await botMessage("What are your main goals right now?\n\nChoose up to 2. (You can change this later.)");
            setButtons([
                { label: 'Weight loss', action: 'add_goal', value: 'Weight loss' },
                { label: 'Improve fitness', action: 'add_goal', value: 'Improve fitness' },
                { label: 'Build strength', action: 'add_goal', value: 'Build strength' },
                { label: 'Reduce stress', action: 'add_goal', value: 'Reduce stress' }
            ]);
            break;

        case 4: // First goal
            addMessage(value, true);
            AppState.user.goals = [value];
            AppState.flowStep = 5;
            await botMessage(`Got it: ${value}.\n\nWould you like to add a second goal?`);
            setButtons([
                { label: 'Add another goal', action: 'add_second_goal', type: 'primary' },
                { label: 'No, continue', action: 'finish_goals', type: 'secondary' }
            ]);
            break;

        case 5: // Second goal choice
            if (action === 'add_second_goal') {
                AppState.flowStep = 6;
                await botMessage("Choose your second goal.");
                const remainingGoals = ['Weight loss', 'Improve fitness', 'Build strength', 'Reduce stress', 'Better sleep', 'More energy', 'Improve nutrition']
                    .filter(g => !AppState.user.goals.includes(g));
                setButtons(remainingGoals.slice(0, 4).map(g => ({ label: g, action: 'add_goal', value: g })));
            } else {
                finishExtendedProfile();
            }
            break;

        case 6: // Second goal
            addMessage(value, true);
            AppState.user.goals.push(value);
            finishExtendedProfile();
            break;
    }
    updateDebugPanel();
}

async function showPAVSQuestion() {
    await botMessage("Physical activity check ✅\n\nIn a typical week, on how many days do you do moderate or hard physical activity?\n\n(A brisk walk counts.)");
    setButtons([
        { label: '0', action: 'set_pavs', value: '0' },
        { label: '1-2', action: 'set_pavs', value: '1' },
        { label: '3-4', action: 'set_pavs', value: '3' },
        { label: '5-7', action: 'set_pavs', value: '5' }
    ]);
}

async function finishExtendedProfile() {
    AppState.user.profileComplete = true;

    const goalsText = AppState.user.goals.length > 1
        ? `${AppState.user.goals[0]} and ${AppState.user.goals[1]}`
        : AppState.user.goals[0];

    await botMessage(`✅ Profile updated!\n\nWe'll tailor your experience around ${goalsText}.`);
    saveState();

    // Return to the flow that triggered extended profile
    const returnFlow = AppState.tempData.returnFlow;
    AppState.tempData = {};

    await delay(500);

    if (returnFlow === FLOWS.HEALTH_SUMMARY) {
        showHealthSummary();
    } else if (returnFlow === FLOWS.MY_SCORE) {
        showMyScore();
    } else {
        showMainMenu();
    }
}

// ==========================================
// MAIN MENU
// ==========================================

async function showMainMenu() {
    AppState.currentFlow = FLOWS.MAIN_MENU;
    updateDebugPanel();

    // Show personalized menu header with stats (WhatsApp compatible - plain text)
    const greeting = AppState.user.firstName
        ? t('hey_name', { name: AppState.user.firstName })
        : t('what_to_do');
    const streakBadge = AppState.streak > 0 ? `🔥 ${AppState.streak} day streak` : '';
    const coinsBadge = `🪙 ${AppState.coins} coins`;
    const statsLine = [streakBadge, coinsBadge].filter(Boolean).join(' • ');

    // WhatsApp-compatible menu message
    await botMessage(`${greeting}\n${statsLine}\n\n*What would you like to do?*\nTap a button below or type the number.`);

    // WhatsApp List Message format: max 10 items
    // Grouped logically for easy scanning
    setButtons([
        { label: '1. ✅ Check-in', action: 'menu_checkin', type: 'primary' },
        { label: '2. 📊 Health Summary', action: 'menu_summary' },
        { label: '3. 🏆 Challenges', action: 'menu_challenges' },
        { label: '4. 🏃 Log Activity', action: 'menu_log' },
        { label: '5. 🍽 Meal Scan', action: 'menu_meal' },
        { label: '6. 🪙 Coins', action: 'menu_coins' },
        { label: '7. 📚 Content', action: 'menu_content' },
        { label: '8. 🤖 AI Chat', action: 'menu_ai' },
        { label: '9. ⚙️ Settings', action: 'menu_settings' },
        { label: '0. ❓ Help', action: 'menu_help' }
    ]);
}

// ==========================================
// CHECK-IN FLOW
// ==========================================

async function startCheckIn() {
    AppState.currentFlow = FLOWS.CHECK_IN;
    AppState.flowStep = 0;
    updateDebugPanel();

    // Check if already done today
    const today = new Date().toDateString();
    if (AppState.lastCheckIn === today) {
        await botMessage("You've already checked in today ✅\n\nWould you like to update it?");
        setButtons([
            { label: 'Update check-in', action: 'update_checkin', type: 'primary' },
            { label: 'Done', action: 'checkin_done', type: 'secondary' }
        ]);
        return;
    }

    // Check for missed day (streak saver)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (AppState.lastCheckIn && AppState.lastCheckIn !== yesterday.toDateString() && AppState.streak > 0) {
        await botMessage("Missed yesterday? No stress, let's get back on track! 💪");
        await delay(500);
    }

    await botMessage(t('checkin_start'));
    AppState.flowStep = 1;
    await showCheckInQ1();
}

async function showCheckInQ1() {
    // WhatsApp: Max 3 buttons - combine skip into message
    await botMessage(t('checkin_sleep') + '\n_(Type "skip" to skip)_');
    setButtons([
        { label: '😫 Poor', action: 'sleep', value: 1 },
        { label: '😐 OK', action: 'sleep', value: 3 },
        { label: '😴 Great', action: 'sleep', value: 5 }
    ]);
}

async function handleCheckInStep(action, value) {
    switch (AppState.flowStep) {
        case 0: // Already done check
            if (action === 'update_checkin') {
                AppState.flowStep = 1;
                await showCheckInQ1();
            } else {
                showMainMenu();
            }
            break;

        case 1: // Sleep
            addMessage(value ? ['😫 Poor', '', '😐 OK', '', '😴 Great'][value - 1] : 'Skipped', true);
            AppState.tempData.sleep = value;
            AppState.flowStep = 2;
            // WhatsApp: Max 3 buttons
            await botMessage(t('checkin_stress') + '\n_(Type "skip" to skip)_');
            setButtons([
                { label: '😌 Low', action: 'stress', value: 1 },
                { label: '😐 Moderate', action: 'stress', value: 3 },
                { label: '😰 High', action: 'stress', value: 5 }
            ]);
            break;

        case 2: // Stress
            addMessage(value ? ['😌 Low', '', '😐 Moderate', '', '😰 High'][value - 1] : 'Skipped', true);
            AppState.tempData.stress = value;
            AppState.flowStep = 3;
            // WhatsApp: 2 buttons is fine
            await botMessage(t('checkin_active'));
            setButtons([
                { label: '✅ Yes', action: 'active', value: 'yes' },
                { label: '❌ Not yet', action: 'active', value: 'no' }
            ]);
            break;

        case 3: // Activity plan
            addMessage(value === 'yes' ? '✅ Yes' : '❌ Not yet', true);
            AppState.tempData.activePlan = value;
            AppState.flowStep = 5; // Skip diet, go to mood
            // WhatsApp: Max 3 buttons - show top options
            await botMessage(t('checkin_mood') + '\n_(Type "skip" to skip)_');
            setButtons([
                { label: '😊 Great', action: 'mood', value: 5 },
                { label: '😐 Okay', action: 'mood', value: 3 },
                { label: '😔 Low', action: 'mood', value: 1 }
            ]);
            break;

        case 4: // Diet (skipped for now)
            addMessage(value ? ['Poor', 'Okay', 'Good'][value - 1] : 'Skipped', true);
            AppState.tempData.diet = value;
            AppState.flowStep = 5;
            // WhatsApp: Max 3 buttons
            await botMessage(t('checkin_mood') + '\n_(Type "skip" to skip)_');
            setButtons([
                { label: '😊 Great', action: 'mood', value: 5 },
                { label: '😐 Okay', action: 'mood', value: 3 },
                { label: '😔 Low', action: 'mood', value: 1 }
            ]);
            break;

        case 5: // Mood
            if (value) {
                const moodLabels = ['😔 Low', '', '', '😐 Okay', '', '😊 Great'];
                addMessage(moodLabels[value] || `Mood: ${value}`, true);
            } else {
                addMessage('Skipped', true);
            }
            AppState.tempData.mood = value;
            completeCheckIn();
            break;
    }
    updateDebugPanel();
}

async function completeCheckIn() {
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if first check-in ever
    const isFirstCheckIn = AppState.streak === 0 && !AppState.lastCheckIn;

    // Update streak
    if (AppState.lastCheckIn === yesterday.toDateString()) {
        AppState.streak++;
    } else if (AppState.lastCheckIn !== today) {
        AppState.streak = 1;
    }

    AppState.lastCheckIn = today;
    AppState.checkInToday = true;

    // Award coins and check for milestones
    const coinsEarned = 10 + (AppState.streak > 7 ? 5 : 0);
    const oldCoins = AppState.coins;
    AppState.coins += coinsEarned;
    const coinMilestone = checkCoinMilestone(oldCoins, AppState.coins);

    // Generate focus action based on responses with empathetic tone
    let focusAction = "Take a 10-minute walk after lunch — fresh air does wonders.";
    let empathyNote = "";

    if (AppState.tempData.sleep && AppState.tempData.sleep < 3) {
        focusAction = "Try to get to bed 30 minutes earlier tonight.";
        empathyNote = "Rough night? That's okay — today's a fresh start. ";
    } else if (AppState.tempData.stress && AppState.tempData.stress > 3) {
        focusAction = "Take 5 minutes for deep breathing between tasks.";
        empathyNote = "Sounds like a lot on your plate. You're doing great just by checking in. ";
    } else if (AppState.tempData.diet && AppState.tempData.diet < 2) {
        focusAction = "Drink a glass of water and grab a healthy snack.";
    }

    // Build celebration message based on context
    let celebration = t('checkin_complete');
    let streakMessage = t('checkin_streak', { days: AppState.streak });

    if (isFirstCheckIn) {
        celebration = t('checkin_complete');
    } else if (AppState.streak === 7) {
        streakMessage = t('checkin_streak', { days: 7 });
    } else if (AppState.streak === 30) {
        streakMessage = t('checkin_streak', { days: 30 });
    } else if (AppState.streak > 7) {
        streakMessage = t('checkin_streak', { days: AppState.streak });
    }

    // WhatsApp compatible - plain text, no HTML
    let milestoneMessage = coinMilestone ? `\n\n🎉 *Milestone:* ${coinMilestone}` : '';
    await botMessage(`${celebration}\n\n${empathyNote}*Today's focus:*\n${focusAction}\n\nYou earned 🪙 *${coinsEarned} coins*\n${streakMessage}${milestoneMessage}`);

    AppState.tempData = {};
    saveState();

    // Prompt to connect app if not connected
    if (AppState.user.connectedApps.length === 0) {
        await delay(1000);
        await botMessage("Want more accurate summaries and challenge tracking?\n\nConnect a fitness app in 2 minutes.");
        setButtons([
            { label: '🔗 Connect', action: 'goto_connect', type: 'primary' },
            { label: 'Not now', action: 'goto_menu', type: 'secondary' }
        ]);
    } else {
        setButtons([
            { label: 'Health summary', action: 'menu_summary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
    }

    updateDebugPanel();
}

// ==========================================
// HEALTH SUMMARY
// ==========================================

async function showHealthSummary() {
    AppState.currentFlow = FLOWS.HEALTH_SUMMARY;
    AppState.flowStep = 0;
    updateDebugPanel();

    // Check if profile is complete for calculations
    if (!AppState.user.profileComplete && AppState.user.registered) {
        await botMessage("To show your personalized health summary, we need a few more details.");
        await delay(500);
        startExtendedProfile(FLOWS.HEALTH_SUMMARY);
        return;
    }

    // Check data availability
    if (AppState.user.connectedApps.length === 0 && !AppState.checkInToday) {
        await botMessage("📊 Health summary\n\nWe don't have enough recent activity data to build a summary yet.\n\nTo fix that, you can either:\n• connect a fitness app, or\n• log activity manually.");
        setButtons([
            { label: '🔗 Connect', action: 'goto_connect', type: 'primary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    const data = AppState.weeklyActivity;
    const meals = AppState.mealHistory;
    const avgMealScore = meals.length > 0
        ? (meals.reduce((sum, m) => sum + m.score, 0) / meals.length).toFixed(1)
        : 'N/A';

    // Calculate step trend - WhatsApp compatible (plain text)
    const recentSteps = data.dailySteps.slice(-3);
    const earlierSteps = data.dailySteps.slice(0, 3);
    const recentAvg = recentSteps.reduce((a, b) => a + b, 0) / recentSteps.length;
    const earlierAvg = earlierSteps.reduce((a, b) => a + b, 0) / earlierSteps.length;
    const stepChange = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100);
    const stepTrend = stepChange > 5 ? `↑ ${stepChange}%` :
                      stepChange < -5 ? `↓ ${Math.abs(stepChange)}%` : '→ stable';

    // Simulated last week comparisons
    const lastWeekMinutes = Math.round(data.activeMinutes * 0.85);
    const minutesChange = Math.round(((data.activeMinutes - lastWeekMinutes) / lastWeekMinutes) * 100);
    const minutesTrend = minutesChange > 0 ? `↑ ${minutesChange}%` : minutesChange < 0 ? `↓ ${Math.abs(minutesChange)}%` : '';

    // WhatsApp compatible - plain text with WhatsApp markdown (*bold*, _italic_)
    await botMessage(`📊 *Your Weekly Health Summary*

*🏃 Activity*
• Active minutes: *${data.activeMinutes} min* ${minutesTrend}
• Total steps: *${data.steps.toLocaleString()}* ${stepTrend}
• Distance: *${data.distance} km*
• Workouts: *${data.workouts.length}* sessions

*❤️ Vitals*
• Avg heart rate: *${data.heartRateAvg}* bpm
• Resting HR: *${data.restingHR}* bpm
• Calories: ~*${data.calories}/day*

*😴 Sleep*
• Average: *${data.avgSleep}*
• Quality: *${data.sleepQuality}/100*

*🍽 Nutrition*
• Meals logged: *${meals.length}*
• Avg score: *${avgMealScore}/10*

🔥 *Streak:* ${AppState.streak} days`);

    await delay(500);

    // Show workout breakdown
    if (data.workouts.length > 0) {
        const workoutList = data.workouts.map(w => `• ${w.day}: ${w.type} (${w.duration}min)`).join('\n');
        await botMessage(`💪 *This Week's Workouts*\n\n${workoutList}`);
    }

    // WhatsApp: Max 3 buttons
    setButtons([
        { label: '🤖 AI Insights', action: 'menu_ai', type: 'primary' },
        { label: '📅 Monthly', action: 'monthly_summary' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showMonthlySummary() {
    const data = AppState.weeklyActivity;

    // WhatsApp compatible - plain text
    await botMessage(`📊 *Your Monthly Health Summary*

*🏃 Activity (30 days)*
• Active minutes: *${data.activeMinutes * 4} min*
• Total steps: *${(data.steps * 4).toLocaleString()}*
• Distance: *${(data.distance * 4).toFixed(1)} km*
• Avg daily: *${Math.round(data.steps * 4 / 30).toLocaleString()} steps*

*😴 Sleep*
• Average: *${data.avgSleep}*
• Trend: *Stable*

*🎯 Progress*
• Streak: *${AppState.streak} days* 🔥
• Coins: *${AppState.coins}* 🪙

💡 *Tip:* Consistency matters more than intensity!`);

    // WhatsApp: Max 3 buttons
    setButtons([
        { label: '🤖 AI Insights', action: 'menu_ai', type: 'primary' },
        { label: '📊 Weekly', action: 'menu_summary' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

// ==========================================
// CHALLENGES
// ==========================================

async function showChallenges() {
    AppState.currentFlow = FLOWS.CHALLENGES;
    AppState.flowStep = 0;
    updateDebugPanel();

    if (AppState.challengeJoined) {
        showChallengeProgress();
        return;
    }

    // WhatsApp compatible
    await botMessage(`🏆 *This Month's Challenge*

*Move More February*
Move 150 minutes this month.

Want to join?`);

    // WhatsApp: Max 3 buttons
    setButtons([
        { label: '✅ Join', action: 'join_challenge', type: 'primary' },
        { label: '📊 Progress', action: 'challenge_progress' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function joinChallenge() {
    AppState.challengeJoined = true;
    AppState.challengeProgress = AppState.weeklyActivity.activeMinutes; // Retroactive
    saveState();

    if (AppState.user.connectedApps.length > 0 || AppState.checkInToday) {
        await botMessage("✅ You're in!\n\nWe've included your past activity from this month.\n\nTrack progress any time by tapping My progress.");
        setButtons([
            { label: 'My progress', action: 'challenge_progress', type: 'primary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
    } else {
        await botMessage("✅ You're in!\n\nTo track progress automatically, connect a fitness app.\nOr log activity manually when you exercise.");
        setButtons([
            { label: '🔗 Connect', action: 'goto_connect', type: 'primary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: 'My progress', action: 'challenge_progress' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
    }
    updateDebugPanel();
}

async function showChallengeProgress() {
    const progress = AppState.challengeProgress;
    const target = AppState.challengeTarget;
    const percentage = Math.min(100, Math.round((progress / target) * 100));

    let status = "📈 On track";
    if (percentage < 30) status = "📉 A little behind";
    if (percentage > 70) status = "🔥 Great pace!";

    // WhatsApp compatible: text-based progress bar instead of CSS
    const progressBar = textProgressBar(progress, target, 10);

    await botMessage(`🏃 ${bold('Your Challenge Progress')}\n\n${progressBar}\n${progress} of ${target} active minutes\n\nDays active: ${Math.floor(progress / 20)}\n\n${status}`);

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '🏃 Log activity', action: 'menu_log', type: 'primary' },
        { label: '📊 Health summary', action: 'menu_summary' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

// ==========================================
// MY SCORE
// ==========================================

async function showMyScore() {
    AppState.currentFlow = FLOWS.MY_SCORE;
    updateDebugPanel();

    // Check if profile is complete
    if (!AppState.user.profileComplete && AppState.user.registered) {
        await botMessage("To calculate your Strove Score, we need a few more details.");
        await delay(500);
        startExtendedProfile(FLOWS.MY_SCORE);
        return;
    }

    // Check data availability
    if (AppState.user.connectedApps.length === 0 && !AppState.checkInToday) {
        await botMessage(`⭐ ${bold('Your Strove Score')}\n\nWe need a bit more data to calculate your score reliably.\n\nConnect a fitness app or log activity manually for a few days.`);
        // WhatsApp: max 3 buttons
        setButtons([
            { label: '🔗 Connect app', action: 'goto_connect', type: 'primary' },
            { label: '🏃 Log activity', action: 'menu_log' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    // Calculate simulated score
    const baseScore = 65;
    const streakBonus = Math.min(AppState.streak * 2, 20);
    const activityBonus = AppState.checkInToday ? 10 : 0;
    const score = baseScore + streakBonus + activityBonus;
    const changeValue = AppState.streak > 3 ? 5 : -2;
    const changeIcon = changeValue > 0 ? '⬆️' : '⬇️';
    const changeText = changeValue > 0 ? `+${changeValue}` : `${changeValue}`;

    // WhatsApp compatible: text-based score display instead of CSS circle
    const scoreBar = textProgressBar(score, 100, 10);

    await botMessage(`⭐ ${bold('Your Strove Score')}\n\n${bold(String(score))} / 100\n${scoreBar}\n\n${changeIcon} ${changeText} this week\n\n${bold('Top drivers:')}\n• Check-in consistency\n• Activity levels\n\n${italic('Next: Complete tomorrow\'s check-in to maintain your streak.')}`);

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '📈 Improve score', action: 'improve_score', type: 'primary' },
        { label: '📊 Health summary', action: 'menu_summary' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showImproveScore() {
    await botMessage("To improve your score fastest this week, we suggest:\n\n<strong>Do your daily check-in tomorrow morning</strong>\n\nConsistency is the #1 score driver.\n\nWant to do something now?");

    setButtons([
        { label: 'Check-in', action: 'menu_checkin', type: 'primary' },
        { label: 'Log activity', action: 'menu_log' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

// ==========================================
// LOG ACTIVITY
// ==========================================

async function showLogActivity() {
    AppState.currentFlow = FLOWS.LOG_ACTIVITY;
    AppState.flowStep = 0;
    updateDebugPanel();

    await botMessage("How would you like to log activity?");

    setButtons([
        { label: 'Log manually', action: 'log_manual', type: 'primary' },
        { label: 'Connect fitness app', action: 'goto_connect' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleLogActivityStep(action, value) {
    switch (AppState.flowStep) {
        case 0: // Choice
            if (action === 'log_manual') {
                AppState.flowStep = 1;
                // WhatsApp: max 3 buttons - most common activities
                await botMessage(`What type of activity?\n\n${italic('Choose below or type your own (e.g., "Yoga", "Swimming")')}`);
                setButtons([
                    { label: '🚶 Walk/Run', action: 'activity_type', value: 'Walk/Run' },
                    { label: '💪 Strength', action: 'activity_type', value: 'Strength' },
                    { label: '🚴 Other', action: 'activity_type', value: 'Other' }
                ]);
            }
            break;

        case 1: // Activity type
            addMessage(value, true);
            AppState.tempData.activityType = value;
            AppState.flowStep = 2;
            // WhatsApp: max 3 buttons - group durations
            await botMessage("How long?\n\n${italic('Or type a custom duration like \"45m\" or \"1h\"')}");
            setButtons([
                { label: '15-30 min', action: 'activity_duration', value: 25 },
                { label: '30-60 min', action: 'activity_duration', value: 45 },
                { label: '60+ min', action: 'activity_duration', value: 75 }
            ]);
            break;

        case 2: // Duration
            if (action === 'activity_custom') {
                AppState.flowStep = 3;
                await botMessage("Type duration (e.g. 45m, 1h, 1h30m)");
                clearButtons();
            } else {
                addMessage(`${value} min`, true);
                AppState.tempData.duration = value;
                AppState.flowStep = 4;
                showIntensityQuestion();
            }
            break;

        case 3: // Custom duration input
            const parsed = parseDuration(value);
            if (parsed) {
                AppState.tempData.duration = parsed;
                AppState.flowStep = 4;
                showIntensityQuestion();
            } else {
                await botMessage("Please enter a valid duration (e.g. 45m, 1h, 1h30m)");
            }
            break;

        case 4: // Intensity
            addMessage(value || 'Skip', true);
            AppState.tempData.intensity = value;
            completeActivityLog();
            break;
    }
    updateDebugPanel();
}

function parseDuration(input) {
    const text = input.toLowerCase().trim();
    let minutes = 0;

    const hourMatch = text.match(/(\d+)\s*h/);
    const minMatch = text.match(/(\d+)\s*m/);

    if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
    if (minMatch) minutes += parseInt(minMatch[1]);

    if (minutes === 0 && /^\d+$/.test(text)) {
        minutes = parseInt(text);
    }

    return minutes > 0 && minutes <= 480 ? minutes : null;
}

async function showIntensityQuestion() {
    // WhatsApp: max 3 buttons
    await botMessage(`How hard did it feel?\n\n${italic('Reply "skip" to skip this question')}`);
    setButtons([
        { label: '😌 Easy', action: 'activity_intensity', value: 'Easy' },
        { label: '💪 Moderate', action: 'activity_intensity', value: 'Moderate' },
        { label: '🔥 Hard', action: 'activity_intensity', value: 'Hard' }
    ]);
}

async function completeActivityLog() {
    const type = AppState.tempData.activityType;
    const duration = AppState.tempData.duration;

    // Award coins based on duration
    const coinsEarned = Math.min(Math.floor(duration / 10) * 5, 30);
    AppState.coins += coinsEarned;

    // Update challenge progress
    if (AppState.challengeJoined) {
        AppState.challengeProgress += duration;
    }

    // Update weekly activity
    AppState.weeklyActivity.activeMinutes += duration;

    await botMessage(`✅ Logged: ${type} — ${duration} min.\n\nYou earned <span class="coin-earned">🪙 ${coinsEarned}</span> coins.`);

    AppState.tempData = {};
    saveState();

    setButtons([
        { label: 'Health summary', action: 'menu_summary' },
        { label: 'Challenges', action: 'menu_challenges' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);

    updateDebugPanel();
}

// ==========================================
// CONNECT APP
// ==========================================

async function startConnectApp() {
    AppState.currentFlow = FLOWS.CONNECT_APP;
    AppState.flowStep = 0;
    updateDebugPanel();

    // WhatsApp: OAuth requires web browser - show link to PWA
    await botMessage(`🔗 ${bold('Connect Fitness App')}\n\nConnect your favorite fitness tracker to sync your activity automatically.\n\n${bold('Supported apps:')}\n• Garmin\n• Fitbit\n• Strava\n• Polar\n\nTap below to securely connect in your browser:\n\n<a href="${WEB_APP_URLS.CONNECT_APP}" target="_blank">🔗 Open Connection Portal</a>\n\n${italic('You\'ll return here once connected.')}`);

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '🔗 Open portal', action: 'open_connect_portal', type: 'primary' },
        { label: '📝 Log manually', action: 'menu_log' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleConnectStep(action, value) {
    if (action === 'open_connect_portal') {
        // Open the web portal for OAuth connection
        window.open(WEB_APP_URLS.CONNECT_APP, '_blank');

        await botMessage(`🔗 Connection portal opened!\n\nComplete the connection in your browser, then return here.\n\n${italic('Once connected, your activity will sync automatically.')}`);

        setButtons([
            { label: '✅ I\'m connected', action: 'confirm_connected', type: 'primary' },
            { label: '📝 Log manually', action: 'menu_log' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
    } else if (action === 'confirm_connected') {
        // Simulate successful connection
        AppState.user.connectedApps.push('Fitness App');
        saveState();

        await botMessage(`✅ ${bold('Connected!')}\n\nWe'll start syncing your activity data automatically.\n\nWhat would you like to do next?`);

        setButtons([
            { label: '✅ Do check-in', action: 'menu_checkin', type: 'primary' },
            { label: '📊 Health summary', action: 'menu_summary' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
    }
}

// Global function for simulated connection
window.simulateConnection = async function(service) {
    AppState.user.connectedApps.push(service);
    saveState();

    await botMessage(`✅ ${service} connected!\n\nWe'll start pulling your activity data automatically.`);

    await delay(500);
    await botMessage("Next, let's do your first check-in or explore the menu.");

    setButtons([
        { label: '✅ Do check-in', action: 'menu_checkin', type: 'primary' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);

    updateDebugPanel();
};

// ==========================================
// COINS & REWARDS
// ==========================================

async function showCoins() {
    AppState.currentFlow = FLOWS.COINS;
    updateDebugPanel();

    await botMessage(`🪙 ${bold('Your Strove Coins')}\n\nBalance: ${bold(String(AppState.coins))} coins\n\nWhat would you like to do?`);

    // WhatsApp: max 3 buttons - combine options
    setButtons([
        { label: '🎁 Redeem rewards', action: 'redeem_rewards', type: 'primary' },
        { label: '📈 Earn more', action: 'earn_more' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showRecentEarnings() {
    await botMessage(`🧾 Recent earnings\n\n• Check-ins: ${Math.min(AppState.streak, 7) * 10} coins\n• Activity: ${Math.floor(AppState.weeklyActivity.activeMinutes / 10) * 5} coins\n• Challenges: ${AppState.challengeJoined ? 25 : 0} coins`);

    setButtons([
        { label: 'Redeem rewards', action: 'redeem_rewards', type: 'primary' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showEarnMore() {
    await botMessage(`📈 ${bold('How to Earn Coins')}\n\n• ✅ Daily check-ins: 10-15 coins\n• 🏃 Log activity: up to 30 coins\n• 🏆 Challenges: bonus coins\n• 🫀 Face scan: 50 coins\n\nWant to earn some now?`);

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '✅ Check-in', action: 'menu_checkin', type: 'primary' },
        { label: '🫀 Face scan', action: 'menu_facescan' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showRedeemRewards() {
    if (AppState.coins < 100) {
        await botMessage(`🎁 ${bold('Redeem Rewards')}\n\nYour balance: ${bold(String(AppState.coins))} coins\n\nYou need at least 100 coins to redeem.\n\nWant a quick way to earn more?`);

        // WhatsApp: max 3 buttons
        setButtons([
            { label: '✅ Check-in', action: 'menu_checkin', type: 'primary' },
            { label: '🏃 Log activity', action: 'menu_log' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
    } else {
        // WhatsApp: Secure redemption requires web - link to PWA
        await botMessage(`🎁 ${bold('Redeem Rewards')}\n\nYour balance: ${bold(String(AppState.coins))} coins\n\n${bold('Popular rewards:')}\n• ☕ Coffee voucher (100 coins)\n• 💆 Wellness item (200 coins)\n• 🏋️ Fitness gear (500 coins)\n\nTap below to browse and redeem:\n\n<a href="${WEB_APP_URLS.REWARDS}" target="_blank">🎁 Open Rewards Store</a>`);

        // WhatsApp: max 3 buttons
        setButtons([
            { label: '🎁 Open store', action: 'open_rewards_store', type: 'primary' },
            { label: '📈 Earn more', action: 'earn_more' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
    }
}

// ==========================================
// MEAL SCAN
// ==========================================

async function showMealScan() {
    AppState.currentFlow = FLOWS.MEAL_SCAN;
    AppState.flowStep = 0;
    updateDebugPanel();

    await botMessage("🍽 Send a photo of your meal and we'll give you simple feedback.\n\nJust upload or describe your meal to get started.");
    clearButtons();
}

async function handleMealScan(input) {
    // Accept any input as a meal description or photo upload
    if (input.trim().length > 0) {
        // Simulate processing
        await botMessage("Analyzing your meal...");
        await delay(1500);

        // Random feedback
        const scores = [6, 7, 8, 9];
        const score = scores[Math.floor(Math.random() * scores.length)];

        const positives = [
            "Good protein content",
            "Nice variety of vegetables",
            "Good portion size",
            "Balanced macros"
        ];

        const improvements = [
            "Add more leafy greens",
            "Consider a smaller portion of carbs",
            "Add a source of healthy fats",
            "Include more fiber"
        ];

        const positive = positives[Math.floor(Math.random() * positives.length)];
        const improvement = improvements[Math.floor(Math.random() * improvements.length)];

        await botMessage(`🍽 Meal feedback\n\nScore: ${score}/10\n\n👍 ${positive}\n➕ ${improvement}\n\nWant to scan another?`);

        setButtons([
            { label: 'Scan another', action: 'menu_meal', type: 'primary' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
    }
}

// ==========================================
// FACE SCAN HEALTH CHECK
// ==========================================

async function startFaceScan() {
    AppState.currentFlow = FLOWS.FACE_SCAN;
    AppState.flowStep = 0;
    AppState.tempData.faceScan = {};
    updateDebugPanel();

    // WhatsApp: Face scan requires camera access - must use web app
    await botMessage(`🫀 ${bold('Health Check - Face Scan')}\n\nGet a personalized health report with estimated vitals using your camera.\n\nThis takes about 2 minutes and earns you ${bold('50 coins')}.\n\n⚠️ ${bold('Disclaimer')}\nFace scan outputs are non-diagnostic estimates. Do not use for medical decisions. Seek professional advice for health concerns.`);

    await delay(500);
    await botMessage(`📱 ${bold('How it works:')}\n\n1. Tap the link below to open the scan\n2. Allow camera access when prompted\n3. Follow the on-screen instructions\n4. Results will appear here when complete\n\n<a href="${WEB_APP_URLS.FACE_SCAN}" target="_blank">🫀 Start Face Scan</a>`);

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '🫀 Open scan', action: 'open_facescan', type: 'primary' },
        { label: '❓ How it works', action: 'facescan_info' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleFaceScanStep(action, value) {
    switch (AppState.flowStep) {
        case 0: // Initial - open web scan or show info
            if (action === 'open_facescan') {
                window.open(WEB_APP_URLS.FACE_SCAN, '_blank');
                AppState.flowStep = 1;

                await botMessage(`🫀 Face scan opened in browser!\n\nComplete the scan there, then return here.\n\n${italic('Tip: Keep this chat open - your results will appear here.')}`);

                // WhatsApp: max 3 buttons
                setButtons([
                    { label: '✅ Scan complete', action: 'facescan_complete', type: 'primary' },
                    { label: '🔄 Try again', action: 'open_facescan' },
                    { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
                ]);
            } else if (action === 'facescan_info') {
                await botMessage(`📱 ${bold('About Face Scan')}\n\nUsing advanced photoplethysmography (PPG), we analyze subtle color changes in your face to estimate:\n\n• ❤️ Heart rate\n• 🩺 Blood pressure\n• 🫁 Blood oxygen (SpO2)\n• 💨 Breathing rate\n\n${italic('The scan takes about 30 seconds and requires good lighting.')}`);

                setButtons([
                    { label: '🫀 Start scan', action: 'open_facescan', type: 'primary' },
                    { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
                ]);
            }
            break;

        case 1: // Waiting for scan completion
            if (action === 'facescan_complete') {
                // Simulate receiving results from PWA webhook
                await botMessage("📊 Processing your scan results...");
                await delay(1500);

                // Generate simulated results
                const results = generateFaceScanResults();
                AppState.faceScanResults = results;
                AppState.lastFaceScan = new Date().toISOString();

                // Award coins
                const coinsEarned = 50;
                AppState.coins += coinsEarned;
                saveState();

                // Show results
                showFaceScanResults(results, coinsEarned);
            } else if (action === 'open_facescan') {
                window.open(WEB_APP_URLS.FACE_SCAN, '_blank');
                await botMessage(`🔄 Reopened face scan in browser.`);
            }
            break;
    }
    updateDebugPanel();
}

async function showFaceScanCamera() {
    await botMessage("✅ Questions complete!\n\nNow for the face scan.\n\n<strong>Instructions:</strong>\n• Find good lighting (natural light is best)\n• Face the camera directly\n• Keep still for 30 seconds\n• Remove glasses if possible");

    await delay(500);
    await botMessage("📷 <strong>Ready to scan?</strong>\n\nWe'll use your camera to measure:\n• Heart rate\n• Blood pressure (estimate)\n• Blood oxygen levels\n• Breathing rate");

    setButtons([
        { label: '📷 Start Scan', action: 'fs_start_scan', type: 'primary' },
        { label: 'Cancel', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function performFaceScan() {
    await botMessage("📷 <strong>Scanning...</strong>\n\nPlease hold still and look at the camera.");
    clearButtons();

    // Simulate scanning progress
    await delay(1500);
    await botMessage("Detecting face... ✅");
    await delay(1500);
    await botMessage("Measuring heart rate... ✅");
    await delay(1500);
    await botMessage("Analyzing blood flow... ✅");
    await delay(1500);
    await botMessage("Calculating vitals... ✅");
    await delay(1000);

    // Generate simulated results based on inputs
    const results = generateFaceScanResults();
    AppState.faceScanResults = results;
    AppState.lastFaceScan = new Date().toISOString();

    // Award coins
    const coinsEarned = 50;
    AppState.coins += coinsEarned;

    saveState();

    // Show results
    showFaceScanResults(results, coinsEarned);
}

function generateFaceScanResults() {
    const data = AppState.tempData.faceScan || {};
    // Use default values if height/weight not set (since we skip questionnaire in WhatsApp flow)
    const height = (AppState.user.height || 170) / 100; // convert to meters
    const weight = AppState.user.weight || 75;
    const bmi = weight / (height * height);

    // Base values with some randomization
    let heartRate = 72 + Math.floor(Math.random() * 20) - 10;
    let systolic = 118 + Math.floor(Math.random() * 15) - 5;
    let diastolic = 78 + Math.floor(Math.random() * 10) - 3;
    let spo2 = 97 + Math.floor(Math.random() * 3);
    let respRate = 14 + Math.floor(Math.random() * 4) - 2;

    // Adjust based on lifestyle factors
    if (data.smoker === 'daily') {
        heartRate += 8;
        systolic += 10;
    } else if (data.smoker === 'occasional') {
        heartRate += 4;
        systolic += 5;
    }

    if (data.activityLevel === 'sedentary') {
        heartRate += 10;
        systolic += 8;
    } else if (data.activityLevel === 'active') {
        heartRate -= 8;
        systolic -= 5;
    }

    if (data.alcohol === 'heavy') {
        systolic += 8;
        diastolic += 5;
    }

    if (data.conditions === 'hypertension') {
        systolic += 15;
        diastolic += 10;
    }

    // Calculate CMS score (simplified)
    let cmsScore = 85;
    if (bmi > 25) cmsScore -= 10;
    if (bmi > 30) cmsScore -= 10;
    if (data.smoker === 'daily') cmsScore -= 15;
    if (data.activityLevel === 'sedentary') cmsScore -= 10;
    if (data.activityLevel === 'active') cmsScore += 5;
    if (systolic > 130) cmsScore -= 10;
    cmsScore = Math.max(40, Math.min(95, cmsScore));

    // Calculate 10-year CVD risk (simplified Framingham-like)
    let cvdRisk = 1.0;
    if (data.smoker === 'daily') cvdRisk += 2.5;
    if (bmi > 30) cvdRisk += 1.5;
    if (systolic > 140) cvdRisk += 2.0;
    if (data.conditions === 'hypertension') cvdRisk += 1.5;
    cvdRisk = Math.max(0.5, Math.min(15, cvdRisk));

    // Determine BP status
    let bpStatus = 'Normal';
    let bpWarning = false;
    if (systolic >= 140 || diastolic >= 90) {
        bpStatus = 'Stage 2 hypertension';
        bpWarning = true;
    } else if (systolic >= 130 || diastolic >= 80) {
        bpStatus = 'Stage 1 hypertension';
        bpWarning = true;
    } else if (systolic >= 120) {
        bpStatus = 'Elevated';
    }

    // Determine BMI status
    let bmiStatus = 'Normal weight';
    let bmiWarning = false;
    if (bmi >= 30) {
        bmiStatus = 'Obese';
        bmiWarning = true;
    } else if (bmi >= 25) {
        bmiStatus = 'Overweight';
        bmiWarning = true;
    } else if (bmi < 18.5) {
        bmiStatus = 'Underweight';
        bmiWarning = true;
    }

    // Overall status
    let overallStatus = 'Good';
    if (cmsScore < 50) overallStatus = 'Needs Attention';
    else if (cmsScore < 70) overallStatus = 'Fair';
    else if (cmsScore >= 80) overallStatus = 'Excellent';

    return {
        heartRate,
        systolic,
        diastolic,
        spo2,
        respRate,
        bmi: bmi.toFixed(1),
        bmiStatus,
        bmiWarning,
        bpStatus,
        bpWarning,
        cmsScore,
        cvdRisk: cvdRisk.toFixed(1),
        overallStatus,
        timestamp: new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
    };
}

async function showFaceScanResults(results, coinsEarned) {
    // WhatsApp compatible: plain text health report (no HTML/CSS)
    const statusEmoji = results.overallStatus === 'Excellent' ? '🌟' :
                        results.overallStatus === 'Good' ? '✅' :
                        results.overallStatus === 'Fair' ? '⚠️' : '❗';

    const healthBar = textProgressBar(results.cmsScore, 100, 10);

    // Health Snapshot
    await botMessage(`🫀 ${bold('Personalised Health Report')}\n\n${bold('Health Snapshot')}\nOverall: ${statusEmoji} ${results.overallStatus}\n\n${bold('Heart Health Score')}\n${healthBar}\n${results.cmsScore} / 100\n\n${results.bpWarning || results.bmiWarning ?
'Good overall heart health with a couple of areas to monitor.' :
'Great heart health! Keep up the healthy habits!'}\n\n📅 ${results.timestamp} (SAST)`);

    await delay(800);

    // WhatsApp compatible: plain text detailed results
    const hrStatus = results.heartRate <= 100 ? '✅ Normal' : '⚠️ Elevated';
    const bpStatus = results.bpWarning ? `⚠️ ${results.bpStatus}` : `✅ ${results.bpStatus}`;
    const bmiDisplayStatus = results.bmiWarning ? `⚠️ ${results.bmiStatus}` : `✅ ${results.bmiStatus}`;
    const cmsStatus = results.cmsScore >= 70 ? '✅ Good' : '⚠️ Room to improve';
    const riskStatus = parseFloat(results.cvdRisk) < 5 ? '✅ Low' : '⚠️ Moderate';

    await botMessage(`📊 ${bold('Your Results')}\n\n❤️ ${bold('Heart Health Score')}\n   ${results.cmsScore} — ${cmsStatus}\n\n📈 ${bold('10-Year Heart Risk')}\n   ${results.cvdRisk}% — ${riskStatus}\n\n💓 ${bold('Resting Heart Rate')}\n   ${results.heartRate} bpm — ${hrStatus}\n\n🩺 ${bold('Blood Pressure')}\n   ${results.systolic}/${results.diastolic} mmHg — ${bpStatus}\n\n⚖️ ${bold('BMI')}\n   ${results.bmi} kg/m² — ${bmiDisplayStatus}\n\n💨 ${bold('Breathing Rate')}\n   ${results.respRate} breaths/min — ✅ Normal\n\n🫁 ${bold('Blood Oxygen')}\n   ${results.spo2}% — ✅ Normal`);

    await delay(800);

    // What this means
    let meaningPoints = [];
    meaningPoints.push(`Your heart health score is ${results.cmsScore >= 70 ? 'good' : 'fair'}${results.bpWarning || results.bmiWarning ? ', but some areas need attention' : ''}.`);

    if (results.bpWarning) {
        meaningPoints.push(`${results.bpStatus} detected. Confirm with a validated arm cuff and discuss with your clinician if elevated.`);
    }
    if (results.bmiWarning) {
        meaningPoints.push(`BMI is in the ${results.bmiStatus.toLowerCase()} range. Modest lifestyle changes can help.`);
    }
    meaningPoints.push(`Heart rate and oxygen levels are within normal ranges.`);

    // WhatsApp compatible: plain text
    await botMessage(`💡 ${bold('What This Means')}\n\n${meaningPoints.map(p => '• ' + p).join('\n')}`);

    await delay(800);

    // Recommendations
    let recommendations = [];

    if (results.bpWarning) {
        recommendations.push('🩺 Repeat blood pressure with a validated arm cuff and see your GP if elevated readings persist.');
    }
    if (results.bmiWarning && results.bmi >= 25) {
        recommendations.push('🥗 Use the AI meal scanner to track meals and choose lower-salt, higher-fibre options.');
    }
    // Check activity level if available
    const activityLevel = AppState.tempData.faceScan?.activityLevel;
    if (activityLevel === 'sedentary' || activityLevel === 'light') {
        recommendations.push('🏃 Aim to earn 200 Strove points this week to meet the WHO 150-minute guideline.');
    }
    recommendations.push('😴 Track sleep and aim for at least 7 hours per night.');
    recommendations.push('🔄 Repeat the face scan in 2 weeks to track trends.');

    // WhatsApp compatible: plain text
    await botMessage(`✅ ${bold('Recommendations')}\n\n${bold('Lifestyle Actions:')}\n${recommendations.slice(0, -1).map(r => '• ' + r).join('\n')}\n\n${bold('Next Steps:')}\n• ${recommendations[recommendations.length - 1]}`);

    // Coins earned
    await delay(500);
    await botMessage(`🎉 ${bold('Health check complete!')}\n\nYou earned 🪙 ${bold(String(coinsEarned))} coins.\n\nTrack your progress by doing another scan in 2 weeks.`);

    AppState.tempData = {};

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '📊 Health Summary', action: 'menu_summary', type: 'primary' },
        { label: '🏃 Log Activity', action: 'menu_log' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);

    updateDebugPanel();
}

// ==========================================
// AI INSIGHTS & CHAT
// ==========================================

async function startAIChat() {
    AppState.currentFlow = FLOWS.AI_CHAT;
    AppState.conversationHistory = [];
    updateDebugPanel();

    const greeting = getPersonalizedGreeting();
    // WhatsApp compatible: plain text
    await botMessage(`🤖 ${bold('Strove AI Assistant')}\n\n${greeting}\n\nI can help you with:\n• Understanding your health data\n• Personalized wellness tips\n• Answering questions about your progress\n• Motivation and goal setting\n\n${italic('Just type your question or pick a topic below.')}`);

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '📊 Analyze my week', action: 'ai_analyze_week', type: 'primary' },
        { label: '💪 Tips & motivation', action: 'ai_motivation' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

function getPersonalizedGreeting() {
    const hour = new Date().getHours();
    const name = AppState.user.firstName || 'there';

    if (hour < 12) {
        return `Good morning, ${name}! ☀️`;
    } else if (hour < 17) {
        return `Good afternoon, ${name}! 👋`;
    } else {
        return `Good evening, ${name}! 🌙`;
    }
}

function buildHealthContext() {
    const activity = AppState.weeklyActivity;
    const meals = AppState.mealHistory;
    const checkIns = AppState.checkInHistory;
    const faceScan = AppState.faceScanResults;

    let context = `
USER PROFILE:
- Name: ${AppState.user.firstName} ${AppState.user.surname}
- Goals: ${AppState.user.goals.join(', ') || 'Not set'}
- Height: ${AppState.user.height || 'Unknown'} cm
- Weight: ${AppState.user.weight || 'Unknown'} kg
- Activity level: ${AppState.user.pavsdays || 'Unknown'} days/week

WEEKLY ACTIVITY DATA:
- Active minutes: ${activity.activeMinutes} min
- Steps this week: ${activity.steps.toLocaleString()}
- Distance: ${activity.distance} km
- Average sleep: ${activity.avgSleep}
- Sleep quality score: ${activity.sleepQuality}/100
- Daily calories burned: ~${activity.calories}
- Workouts: ${activity.workouts.map(w => `${w.day}: ${w.type} (${w.duration}min, ${w.intensity})`).join(', ')}
- Daily steps pattern: ${activity.dailySteps.join(', ')} (Mon-Sun)
- Average heart rate: ${activity.heartRateAvg} bpm
- Resting heart rate: ${activity.restingHR} bpm
- Current streak: ${AppState.streak} days
- Challenge progress: ${AppState.challengeProgress}/${AppState.challengeTarget} minutes

RECENT MEALS:
${meals.map(m => `- ${m.date} ${m.meal}: ${m.notes} (Score: ${m.score}/10, ~${m.calories} cal)`).join('\n')}

RECENT CHECK-INS:
${checkIns.map(c => `- ${c.date}: Sleep ${c.sleep}/5, Stress ${c.stress}/5, Active: ${c.active}, Diet: ${c.diet}/3`).join('\n')}
`;

    if (faceScan) {
        context += `
LATEST FACE SCAN RESULTS:
- Heart Health Score: ${faceScan.cmsScore}/100
- Blood Pressure: ${faceScan.systolic}/${faceScan.diastolic} mmHg (${faceScan.bpStatus})
- Heart Rate: ${faceScan.heartRate} bpm
- BMI: ${faceScan.bmi} (${faceScan.bmiStatus})
- SpO2: ${faceScan.spo2}%
- 10-Year Heart Risk: ${faceScan.cvdRisk}%
`;
    }

    return context;
}

async function getAIResponse(userMessage, systemPrompt = null) {
    // Check if API key is configured
    if (!OPENAI_API_KEY) {
        return generateFallbackResponse(userMessage);
    }

    const healthContext = buildHealthContext();

    const defaultSystemPrompt = `You are Strove's friendly AI health assistant. You help users understand their health data, provide personalized wellness tips, and motivate them to build healthy habits.

IMPORTANT GUIDELINES:
- Be warm, supportive, and encouraging
- Keep responses concise (2-4 short paragraphs max)
- Use emojis sparingly but naturally
- Reference the user's actual data when relevant
- Give specific, actionable advice
- Never diagnose medical conditions - suggest seeing a healthcare provider for concerns
- Focus on positive progress and small wins
- Be conversational, not clinical

USER'S HEALTH DATA:
${healthContext}`;

    const messages = [
        { role: 'system', content: systemPrompt || defaultSystemPrompt },
        ...AppState.conversationHistory.slice(-6), // Keep last 6 messages for context
        { role: 'user', content: userMessage }
    ];

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        const aiMessage = data.choices[0].message.content;

        // Store conversation history
        AppState.conversationHistory.push({ role: 'user', content: userMessage });
        AppState.conversationHistory.push({ role: 'assistant', content: aiMessage });

        return aiMessage;
    } catch (error) {
        console.error('AI API Error:', error);
        return generateFallbackResponse(userMessage);
    }
}

// Smart fallback responses when API is unavailable
function generateFallbackResponse(userMessage) {
    const lower = userMessage.toLowerCase();
    const data = AppState.weeklyActivity;
    const name = AppState.user.firstName || 'there';

    // Analyze week request
    if (lower.includes('analyze') || lower.includes('week') || lower.includes('summary')) {
        return `Hey ${name}! 📊 Looking at your week:\n\n` +
            `You've logged ${data.activeMinutes} active minutes and ${data.steps.toLocaleString()} steps. ` +
            `Your sleep has been averaging ${data.avgSleep} with a quality score of ${data.sleepQuality}/100.\n\n` +
            `${data.activeMinutes >= 100 ? '🎉 Great job staying active!' : '💪 Try to add a bit more movement this week.'} ` +
            `${data.sleepQuality >= 70 ? 'Your sleep quality is good!' : 'Consider improving your sleep routine.'}\n\n` +
            `Keep going - consistency is key! 🔥`;
    }

    // Nutrition request
    if (lower.includes('nutrition') || lower.includes('meal') || lower.includes('food') || lower.includes('eat')) {
        const meals = AppState.mealHistory;
        const avgScore = meals.length > 0 ? (meals.reduce((s, m) => s + m.score, 0) / meals.length).toFixed(1) : 'N/A';
        return `🥗 Based on your recent meals (avg score: ${avgScore}/10):\n\n` +
            `• Try to include more vegetables with each meal\n` +
            `• Stay hydrated - aim for 8 glasses of water daily\n` +
            `• Balance your plate: 1/2 veggies, 1/4 protein, 1/4 carbs\n\n` +
            `Small changes add up! Keep logging your meals to track progress. 🍎`;
    }

    // Sleep request
    if (lower.includes('sleep') || lower.includes('tired') || lower.includes('rest')) {
        return `😴 Your sleep insights:\n\n` +
            `You're averaging ${data.avgSleep} with a quality score of ${data.sleepQuality}/100.\n\n` +
            `Tips for better sleep:\n` +
            `• Aim for 7-9 hours each night\n` +
            `• Keep a consistent sleep schedule\n` +
            `• Avoid screens 1 hour before bed\n` +
            `• Keep your room cool and dark\n\n` +
            `Good sleep is the foundation of good health! 🌙`;
    }

    // Motivation request
    if (lower.includes('motivat') || lower.includes('encourage') || lower.includes('help')) {
        return `💪 Hey ${name}, you've got this!\n\n` +
            `Look at what you've already achieved:\n` +
            `• ${AppState.streak} day check-in streak 🔥\n` +
            `• ${data.steps.toLocaleString()} steps this week\n` +
            `• ${AppState.coins} coins earned 🪙\n\n` +
            `Every small step counts. You're building habits that will serve you for life. ` +
            `Don't compare your journey to others - focus on being better than yesterday!\n\n` +
            `Keep showing up. You've got this! 🌟`;
    }

    // Default response
    return `Thanks for your question, ${name}! 💬\n\n` +
        `Here's a quick health tip: ${getRandomHealthTip()}\n\n` +
        `Try the quick action buttons below or type MENU for more options!`;
}

function getRandomHealthTip() {
    const tips = [
        "Small consistent actions beat big sporadic efforts. Try adding just 5 more minutes of movement today!",
        "Hydration is key - try drinking a glass of water right now! 💧",
        "Take a 2-minute stretch break. Your body will thank you!",
        "Deep breathing for 60 seconds can reduce stress significantly.",
        "A 10-minute walk after meals can help with digestion and blood sugar.",
        "Try to get some natural light within 30 minutes of waking up.",
        "Eating slowly and mindfully can help you feel more satisfied with less food."
    ];
    return tips[Math.floor(Math.random() * tips.length)];
}

async function handleAIChatAction(action) {
    let prompt;

    switch (action) {
        case 'ai_analyze_week':
            prompt = "Please analyze my week's health data. What patterns do you see? What am I doing well and what could I improve? Be specific about the data.";
            break;
        case 'ai_nutrition':
            prompt = "Based on my recent meals and health goals, give me some personalized nutrition tips. What should I focus on?";
            break;
        case 'ai_sleep':
            prompt = "Look at my sleep data and check-ins. How is my sleep quality? What can I do to improve it?";
            break;
        case 'ai_motivation':
            prompt = "I need some motivation! Look at my progress and give me an encouraging message. Remind me of my wins this week.";
            break;
        default:
            return;
    }

    await processAIChat(prompt);
}

async function processAIChat(userMessage) {
    showTypingIndicator();

    const response = await getAIResponse(userMessage);

    hideTypingIndicator();
    await botMessage(response);

    setButtons([
        { label: '💬 Ask more', action: 'ai_continue', type: 'primary' },
        { label: '📊 Analyze my week', action: 'ai_analyze_week' },
        { label: '💪 Motivation', action: 'ai_motivation' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

// ==========================================
// CONTENT LIBRARY
// ==========================================

let contentCache = null;
let contentCategories = [];
let contentDetailCache = new Map();

async function fetchContentLibrary() {
    if (contentCache) return contentCache;

    try {
        const response = await fetch(CONTENT_API_URL);
        if (!response.ok) throw new Error('Failed to fetch content');
        const data = await response.json();
        contentCache = data.data || [];

        // Extract unique categories
        const catMap = new Map();
        contentCache.forEach(item => {
            if (item.category && !catMap.has(item.category.slug)) {
                catMap.set(item.category.slug, item.category);
            }
        });
        contentCategories = Array.from(catMap.values());

        return contentCache;
    } catch (error) {
        console.error('Content Library Error:', error);
        return [];
    }
}

// Fetch individual content item with full details using authenticated API
async function fetchContentDetail(documentId) {
    // Check cache first
    if (contentDetailCache.has(documentId)) {
        return contentDetailCache.get(documentId);
    }

    try {
        // Use public API endpoint (cms.strove.ai) which returns full content including body/actions
        const response = await fetch(`${CONTENT_API_URL}/${documentId}`);

        if (!response.ok) {
            console.error('Content detail fetch failed:', response.status);
            return null;
        }

        const data = await response.json();
        const item = data.data || data;

        // Cache the result
        contentDetailCache.set(documentId, item);

        return item;
    } catch (error) {
        console.error('Content Detail Error:', error);
        return null;
    }
}

async function showContentLibrary() {
    AppState.currentFlow = FLOWS.CONTENT_LIBRARY;
    AppState.flowStep = 0;
    updateDebugPanel();

    // WhatsApp compatible: plain text
    await botMessage(`📚 ${bold('Content Library')}\n\nExplore workouts, recipes, and wellness content.\n\n${italic('Loading content...')}`);
    clearButtons();

    const content = await fetchContentLibrary();

    if (content.length === 0) {
        await botMessage("Unable to load content right now. Please try again later.");
        setButtons([
            { label: '🔄 Try again', action: 'menu_content', type: 'primary' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    // WhatsApp: max 10 list items, max 3 buttons - show categories in message
    const categoryList = contentCategories.slice(0, 6).map(cat =>
        `${getCategoryEmoji(cat.slug)} ${cat.name}`
    ).join('\n');

    await botMessage(`Found ${bold(String(content.length))} items\n\n${bold('Categories:')}\n${categoryList}\n\n${italic('Choose below or type a category name:')}`);

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '⭐ Featured', action: 'content_featured', type: 'primary' },
        { label: '📂 Browse all', action: 'content_browse' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

function getCategoryEmoji(slug) {
    const emojis = {
        'workout': '💪',
        'recipes': '🍳',
        'mindfulness': '🧘',
        'nutrition': '🥗',
        'sleep': '😴',
        'fitness': '🏃',
        'wellness': '✨',
        'health': '❤️'
    };
    return emojis[slug] || '📄';
}

async function showFeaturedContent() {
    const content = await fetchContentLibrary();

    // Get items with highest engagement (views + likes)
    const featured = content
        .sort((a, b) => (parseInt(b.viewCount) + parseInt(b.likeCount)) - (parseInt(a.viewCount) + parseInt(a.likeCount)))
        .slice(0, 5);

    await showContentList(featured, '⭐ Featured Content');
}

async function showContentByCategory(categorySlug) {
    const content = await fetchContentLibrary();
    const filtered = content.filter(item => item.category?.slug === categorySlug);
    const category = contentCategories.find(c => c.slug === categorySlug);
    const categoryName = category?.name || categorySlug;

    await showContentList(filtered.slice(0, 6), `${getCategoryEmoji(categorySlug)} ${categoryName}`);
}

async function showContentList(items, title) {
    if (items.length === 0) {
        await botMessage(`${title}\n\nNo content found in this category.`);
        setButtons([
            { label: '← Back', action: 'menu_content' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    // Store items for quick selection by number
    AppState.tempData.contentItems = items;

    // WhatsApp carousel style: Show items as a numbered list (max 10 for WhatsApp List Messages)
    const maxItems = Math.min(items.length, WHATSAPP_LIMITS.MAX_LIST_ITEMS);

    let contentText = `${bold(title)}\n\n`;

    items.slice(0, maxItems).forEach((item, index) => {
        const typeIcon = getContentTypeIcon(item.type);
        const duration = item.duration?.label ? ` (${item.duration.label})` : '';
        const points = item.points?.value ? ` 🪙${item.points.value}` : '';

        contentText += `${bold(String(index + 1))}. ${typeIcon} ${item.title}${duration}${points}\n`;
    });

    contentText += `\n${italic('Reply with a number (1-' + maxItems + ') to open')}`;

    await botMessage(contentText);

    // WhatsApp: max 3 buttons - show navigation only
    setButtons([
        { label: '🔄 More content', action: 'content_more' },
        { label: '📂 Categories', action: 'menu_content' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);

    // Enable number selection mode
    AppState.flowStep = 2;
}

function getContentTypeIcon(type) {
    switch(type) {
        case 'video': return '🎬';
        case 'audio': return '🎧';
        case 'podcast': return '🎙️';
        default: return '📖';
    }
}

async function showContentDetail(documentId) {
    const content = await fetchContentLibrary();
    const item = content.find(c => c.documentId === documentId);

    if (!item) {
        await botMessage("Content not found.");
        setButtons([
            { label: '← Back', action: 'menu_content' },
            { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    // Directly open content based on type
    await openContent(item);
}

async function openContent(item) {
    // Fetch full content details from authenticated API
    await botMessage("Loading content...");

    const fullItem = await fetchContentDetail(item.documentId);

    // Use full item if available, otherwise fall back to list item
    const contentItem = fullItem || item;

    // Debug: log available fields for video/audio content
    if (contentItem.type === 'video' || contentItem.type === 'audio' || contentItem.type === 'podcast') {
        console.log('Content item fields:', {
            type: contentItem.type,
            body: contentItem.body,
            actions: contentItem.actions,
            url: contentItem.url,
            videoUrl: contentItem.videoUrl,
            audioUrl: contentItem.audioUrl,
            externalUrl: contentItem.externalUrl
        });
    }

    const typeIcon = getContentTypeIcon(contentItem.type);
    const coverUrl = contentItem.cover?.formats?.medium?.url || contentItem.cover?.url || '';
    const duration = contentItem.duration?.label ? `⏱ ${contentItem.duration.label}` : '';
    const points = contentItem.points?.value ? `🪙 ${contentItem.points.value} points` : '';
    const category = contentItem.category?.name || '';

    // Handle based on content type
    if (contentItem.type === 'video') {
        // Show video with link
        await showVideoContent(contentItem, coverUrl, duration, points, category);
    } else if (contentItem.type === 'audio' || contentItem.type === 'podcast') {
        // Show audio with link
        await showAudioContent(contentItem, coverUrl, duration, points, category);
    } else {
        // Article - show the full text
        await showArticleContent(contentItem, coverUrl, category);
    }
}

async function showVideoContent(item, coverUrl, duration, points, category) {
    // Build video URL - check body array for action_url (primary source from CMS)
    let videoUrl = null;

    // Check body array for action_url (this is where Strapi stores video URLs)
    if (item.body && Array.isArray(item.body)) {
        const videoAction = item.body.find(b => b.action_url || b.action_type === 'play-video');
        if (videoAction) {
            videoUrl = videoAction.action_url;
        }
    }

    // Also check actions array as backup
    if (!videoUrl && item.actions && Array.isArray(item.actions)) {
        const videoAction = item.actions.find(a => a.url || a.link || a.action_url);
        if (videoAction) {
            videoUrl = videoAction.action_url || videoAction.url || videoAction.link;
        }
    }

    // Fallback to other URL fields
    if (!videoUrl) {
        videoUrl = item.videoUrl || item.video?.url || item.media?.url || item.url || item.externalUrl;
    }

    // Final fallback (should rarely be needed)
    if (!videoUrl) {
        videoUrl = `https://cms.strove.ai/content/${item.slug}`;
    }

    let videoHtml = `🎬 <strong>${item.title}</strong>\n\n`;

    if (coverUrl) {
        videoHtml += `<div class="video-preview">
<img src="${coverUrl}" alt="${item.title}" class="content-cover">
</div>\n\n`;
    }

    videoHtml += `<div class="content-meta-line">${[category, duration, points].filter(Boolean).join(' • ')}</div>\n\n`;

    if (item.descriptionShort) {
        videoHtml += `${item.descriptionShort}\n\n`;
    }

    videoHtml += `<a href="${videoUrl}" target="_blank" class="content-link video-link">▶️ Watch Video</a>`;

    await botMessage(videoHtml);

    const buttons = [
        { label: '✅ Mark Complete', action: 'content_complete', value: item.documentId, type: 'primary' }
    ];

    if (item.points?.earnable) {
        buttons[0].label = `✅ Complete & Earn ${item.points.value} pts`;
    }

    buttons.push(
        { label: '❤️ Like', action: 'content_like', value: item.documentId },
        { label: '📚 More Content', action: 'menu_content' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    );

    setButtons(buttons);
}

async function showAudioContent(item, coverUrl, duration, points, category) {
    // Build audio URL - check body array for action_url (primary source from CMS)
    let audioUrl = null;

    // Check body array for action_url (this is where Strapi stores audio URLs)
    if (item.body && Array.isArray(item.body)) {
        const audioAction = item.body.find(b => b.action_url || b.action_type === 'play-audio' || b.action_type === 'play-podcast');
        if (audioAction) {
            audioUrl = audioAction.action_url;
        }
    }

    // Also check actions array as backup
    if (!audioUrl && item.actions && Array.isArray(item.actions)) {
        const audioAction = item.actions.find(a => a.url || a.link || a.action_url);
        if (audioAction) {
            audioUrl = audioAction.action_url || audioAction.url || audioAction.link;
        }
    }

    // Fallback to other URL fields
    if (!audioUrl) {
        audioUrl = item.audioUrl || item.audio?.url || item.media?.url || item.url || item.externalUrl;
    }

    // Final fallback (should rarely be needed)
    if (!audioUrl) {
        audioUrl = `https://cms.strove.ai/content/${item.slug}`;
    }

    let audioHtml = `🎧 <strong>${item.title}</strong>\n\n`;

    if (coverUrl) {
        audioHtml += `<div class="audio-preview">
<img src="${coverUrl}" alt="${item.title}" class="content-cover audio-cover">
</div>\n\n`;
    }

    audioHtml += `<div class="content-meta-line">${[category, duration, points].filter(Boolean).join(' • ')}</div>\n\n`;

    if (item.descriptionShort) {
        audioHtml += `${item.descriptionShort}\n\n`;
    }

    audioHtml += `<a href="${audioUrl}" target="_blank" class="content-link audio-link">🎧 Listen Now</a>`;

    await botMessage(audioHtml);

    const buttons = [
        { label: '✅ Mark Complete', action: 'content_complete', value: item.documentId, type: 'primary' }
    ];

    if (item.points?.earnable) {
        buttons[0].label = `✅ Complete & Earn ${item.points.value} pts`;
    }

    buttons.push(
        { label: '❤️ Like', action: 'content_like', value: item.documentId },
        { label: '📚 More Content', action: 'menu_content' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    );

    setButtons(buttons);
}

async function showArticleContent(item, coverUrl, category) {
    // Get full article content
    const articleText = item.richText || item.descriptionLong || item.descriptionShort || '';

    let articleHtml = `📖 <strong>${item.title}</strong>\n\n`;

    if (category) {
        articleHtml += `<div class="content-category-tag">${category}</div>\n\n`;
    }

    if (coverUrl) {
        articleHtml += `<img src="${coverUrl}" alt="${item.title}" class="article-image">\n\n`;
    }

    // Show the full article content
    if (articleText) {
        articleHtml += `<div class="article-body">${articleText}</div>`;
    } else {
        articleHtml += `<p><em>No content available for this article.</em></p>`;
    }

    await botMessage(articleHtml);

    // Show tags if available
    if (item.tags && item.tags.length > 0) {
        const tagsList = item.tags.map(t => t.name).join(' • ');
        await botMessage(`<div class="article-tags">🏷️ ${tagsList}</div>`);
    }

    setButtons([
        { label: '❤️ Like', action: 'content_like', value: item.documentId },
        { label: '📚 More Content', action: 'menu_content', type: 'primary' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

// Content is now opened directly via openContent() function

async function completeContent(documentId) {
    const content = await fetchContentLibrary();
    const item = content.find(c => c.documentId === documentId);

    if (!item) return;

    const pointsEarned = item.points?.value || 10;
    const oldCoins = AppState.coins;
    AppState.coins += pointsEarned;
    const milestone = checkCoinMilestone(oldCoins, AppState.coins);
    saveState();

    let message = `🎉 <strong>Nice work!</strong>\n\nYou completed "${item.title}" and earned <span class="coin-earned">🪙 ${pointsEarned}</span> points!`;

    if (milestone) {
        message += `\n\n🏆 <strong>Milestone:</strong> ${milestone}`;
    }

    await botMessage(message);

    setButtons([
        { label: '📚 More Content', action: 'menu_content', type: 'primary' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);

    updateDebugPanel();
}

async function likeContent(documentId) {
    await botMessage("❤️ Liked! Thanks for the feedback.");

    setButtons([
        { label: '📚 More Content', action: 'menu_content', type: 'primary' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleContentSearch() {
    AppState.flowStep = 1; // Search mode
    await botMessage("🔍 What would you like to find?\n\nType a keyword (e.g., 'yoga', 'breakfast', 'strength')");
    clearButtons();
}

async function searchContent(query) {
    const content = await fetchContentLibrary();
    const lowerQuery = query.toLowerCase();

    const results = content.filter(item =>
        item.title?.toLowerCase().includes(lowerQuery) ||
        item.descriptionShort?.toLowerCase().includes(lowerQuery) ||
        item.tags?.some(t => t.name.toLowerCase().includes(lowerQuery)) ||
        item.category?.name?.toLowerCase().includes(lowerQuery)
    );

    await showContentList(results.slice(0, 6), `🔍 Results for "${query}"`);
}

function handleContentAction(action, value) {
    switch (action) {
        case 'content_featured':
            showFeaturedContent();
            break;
        case 'content_category':
            showContentByCategory(value);
            break;
        case 'content_view':
        case 'content_open':
            showContentDetail(value);
            break;
        case 'content_complete':
            completeContent(value);
            break;
        case 'content_like':
            likeContent(value);
            break;
        case 'content_search':
            handleContentSearch();
            break;
        case 'content_browse':
            showAllCategories();
            break;
        case 'content_more':
            showMoreContent();
            break;
        default:
            showContentLibrary();
    }
}

// WhatsApp compatible: show all categories in list format
async function showAllCategories() {
    const categoryList = contentCategories.map((cat, index) =>
        `${bold(String(index + 1))}. ${getCategoryEmoji(cat.slug)} ${cat.name}`
    ).join('\n');

    await botMessage(`📂 ${bold('Browse Categories')}\n\n${categoryList}\n\n${italic('Reply with a number to browse that category')}`);

    // Store categories for number selection
    AppState.tempData.browseCategories = contentCategories;
    AppState.flowStep = 3; // Category selection mode

    setButtons([
        { label: '⭐ Featured', action: 'content_featured', type: 'primary' },
        { label: '🔍 Search', action: 'content_search' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

// Show more content from the current category
async function showMoreContent() {
    const content = await fetchContentLibrary();
    // Get random selection
    const shuffled = content.sort(() => 0.5 - Math.random());
    await showContentList(shuffled.slice(0, 10), '📚 More Content');
}

// ==========================================
// SETTINGS
// ==========================================

async function showSettings() {
    AppState.currentFlow = FLOWS.SETTINGS;
    AppState.flowStep = 0;
    updateDebugPanel();

    // WhatsApp: Show settings as list, use max 3 buttons
    await botMessage(`⚙️ ${bold('Settings')}\n\nWhat would you like to change?\n\n1. 🔔 Reminder preferences\n2. 🎯 Goals\n3. 👤 Profile\n4. 🔗 Connected apps\n5. 🌐 Language\n6. 🛑 Stop messages\n\n${italic('Reply with a number or choose below:')}`);

    // WhatsApp: max 3 buttons - most common options
    setButtons([
        { label: '🌐 Language', action: 'settings_language', type: 'primary' },
        { label: '🔔 Reminders', action: 'settings_reminders' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleSettingsStep(action, value) {
    switch (action) {
        case 'settings_reminders':
            await botMessage("How often would you like a check-in reminder?");
            setButtons([
                { label: 'Daily', action: 'set_reminder', value: 'daily', type: 'primary' },
                { label: 'Few times a week', action: 'set_reminder', value: 'few' },
                { label: 'Never', action: 'set_reminder', value: 'never', type: 'secondary' }
            ]);
            break;

        case 'set_reminder':
            addMessage(value.charAt(0).toUpperCase() + value.slice(1), true);
            AppState.reminderFrequency = value;
            saveState();
            await botMessage("✅ Done. Reminder preferences updated.");
            setButtons([
                { label: 'Settings', action: 'menu_settings' },
                { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
            ]);
            break;

        case 'settings_goals':
            AppState.flowStep = 4; // Jump to goals in extended profile
            startExtendedProfile(FLOWS.SETTINGS);
            break;

        case 'settings_profile':
            startExtendedProfile(FLOWS.SETTINGS);
            break;

        case 'settings_apps':
            if (AppState.user.connectedApps.length === 0) {
                await botMessage("You don't have any connected apps yet.");
                setButtons([
                    { label: '🔗 Connect', action: 'goto_connect', type: 'primary' },
                    { label: 'Back', action: 'menu_settings', type: 'secondary' }
                ]);
            } else {
                await botMessage(`✅ Connected: ${AppState.user.connectedApps.join(', ')}\n\nWhat would you like to do?`);
                setButtons([
                    { label: 'Reconnect', action: 'goto_connect' },
                    { label: 'Disconnect', action: 'disconnect_confirm' },
                    { label: 'Back', action: 'menu_settings', type: 'secondary' }
                ]);
            }
            break;

        case 'disconnect_confirm':
            await botMessage(`Are you sure you want to disconnect ${AppState.user.connectedApps[0]}?\n\nWe won't pull activity data from it anymore.`);
            setButtons([
                { label: 'Yes, disconnect', action: 'disconnect_app', type: 'secondary' },
                { label: 'Cancel', action: 'menu_settings' }
            ]);
            break;

        case 'disconnect_app':
            const disconnected = AppState.user.connectedApps.pop();
            saveState();
            await botMessage(`✅ ${disconnected} disconnected.`);
            setButtons([
                { label: 'Settings', action: 'menu_settings' },
                { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
            ]);
            break;

        case 'settings_language':
            await botMessage("Choose your language:\nKhetha ulimi lwakho:\nKies jou taal:");
            setButtons([
                { label: 'English', action: 'set_language', value: 'English', type: 'primary' },
                { label: 'IsiZulu', action: 'set_language', value: 'isiZulu' },
                { label: 'Afrikaans', action: 'set_language', value: 'Afrikaans' }
            ]);
            break;

        case 'set_language':
            addMessage(value, true);
            AppState.user.language = value;
            saveState();
            await botMessage(t('language_updated'));
            setButtons([
                { label: t('menu_settings'), action: 'menu_settings' },
                { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
            ]);
            break;

        case 'settings_stop':
            await botMessage("If you stop messages, we won't contact you again unless you restart.");
            setButtons([
                { label: 'Stop messages', action: 'confirm_stop', type: 'secondary' },
                { label: 'Cancel', action: 'menu_settings' }
            ]);
            break;

        case 'confirm_stop':
            handleStop();
            break;
    }
    updateDebugPanel();
}

// ==========================================
// HELP
// ==========================================

async function startHelpFlow() {
    AppState.currentFlow = FLOWS.HELP;
    updateDebugPanel();

    // WhatsApp compatible: plain text
    await botMessage(`❓ ${bold('How can we help?')}\n\nChoose a topic below:`);

    // WhatsApp: max 3 buttons
    setButtons([
        { label: '📖 How to use', action: 'help_usage', type: 'primary' },
        { label: '💬 Contact support', action: 'help_support' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleHelpStep(action, value) {
    switch (action) {
        case 'help_usage':
            await botMessage("Here are the main commands:\n\n• Check-in (daily)\n• Health summary (weekly/monthly)\n• Log activity\n• Coins / Redeem\n• Challenges\n\nType MENU any time to see options.\nType HELP for assistance.\nType STOP to unsubscribe.");
            setButtons([
                { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
            ]);
            break;

        case 'help_support':
            // WhatsApp: max 3 buttons
            await botMessage(`💬 ${bold('Contact Support')}\n\nIf something isn't working, we can help.\n\nChoose the type of issue:`);
            setButtons([
                { label: '🔧 Technical', action: 'support_type', value: 'Technical' },
                { label: '🎁 Rewards/Account', action: 'support_type', value: 'Rewards/Account' },
                { label: '← Back', action: 'menu_help', type: 'secondary' }
            ]);
            break;

        case 'support_type':
            addMessage(value, true);
            AppState.tempData.supportType = value;
            await botMessage(`Thanks — we've logged this as a ${value} issue.\n\nPlease describe the issue in one sentence.`);
            AppState.currentFlow = 'support_describe';
            clearButtons();
            break;

        case 'help_privacy':
            await botMessage("We only use your data to provide Strove services in line with our privacy policy.\n\nYou can:\n• opt out any time (type STOP)\n• request data access or deletion via a secure form\n\n<a href='#'>Request data access/deletion</a>");
            setButtons([
                { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
            ]);
            break;
    }
}

async function handleSupportDescription(input) {
    await botMessage("✅ Got it. Our team will get back to you as soon as possible.\n\nIs there anything else we can help with?");
    AppState.tempData = {};
    setButtons([
        { label: 'Help menu', action: 'menu_help' },
        { label: t('menu_back'), action: 'goto_menu', type: 'secondary' }
    ]);
    AppState.currentFlow = FLOWS.HELP;
}

// ==========================================
// MAIN INPUT HANDLER
// ==========================================

function handleButtonClick(action, value) {
    // Navigation actions
    if (action === 'goto_menu') {
        showMainMenu();
        return;
    }
    if (action === 'goto_connect') {
        startConnectApp();
        return;
    }

    // Menu actions
    if (action.startsWith('menu_')) {
        const menuAction = action.replace('menu_', '');
        handleMenuAction(menuAction);
        return;
    }

    // Content Library actions
    if (action.startsWith('content_')) {
        handleContentAction(action, value);
        return;
    }

    // Flow-specific actions
    switch (AppState.currentFlow) {
        case FLOWS.ONBOARDING:
            handleOnboardingStep(action, value);
            break;
        case FLOWS.EXTENDED_PROFILE:
            handleExtendedProfileStep(action, value);
            break;
        case FLOWS.CHECK_IN:
            handleCheckInStep(action, value);
            break;
        case FLOWS.LOG_ACTIVITY:
            handleLogActivityStep(action, value);
            break;
        case FLOWS.CONNECT_APP:
            handleConnectStep(action, value);
            break;
        case FLOWS.FACE_SCAN:
            handleFaceScanStep(action, value);
            break;
        case FLOWS.AI_CHAT:
            if (action.startsWith('ai_')) {
                handleAIChatAction(action);
            }
            break;
        case FLOWS.CHALLENGES:
            if (action === 'join_challenge') joinChallenge();
            else if (action === 'challenge_progress') showChallengeProgress();
            break;
        case FLOWS.MY_SCORE:
            if (action === 'improve_score') showImproveScore();
            break;
        case FLOWS.COINS:
            if (action === 'redeem_rewards') showRedeemRewards();
            else if (action === 'earn_more') showEarnMore();
            else if (action === 'recent_earnings') showRecentEarnings();
            else if (action === 'open_rewards_store') {
                window.open(WEB_APP_URLS.REWARDS, '_blank');
                botMessage(`🎁 Rewards store opened!\n\n${italic('Browse and redeem in your browser.')}`);
            }
            break;
        case FLOWS.SETTINGS:
            handleSettingsStep(action, value);
            break;
        case FLOWS.HELP:
            handleHelpStep(action, value);
            break;
        case FLOWS.HEALTH_SUMMARY:
            if (action === 'monthly_summary') showMonthlySummary();
            break;
    }
}

function handleMenuAction(action) {
    switch (action) {
        case 'checkin':
            startCheckIn();
            break;
        case 'ai':
            startAIChat();
            break;
        case 'content':
            showContentLibrary();
            break;
        case 'summary':
            showHealthSummary();
            break;
        case 'facescan':
            startFaceScan();
            break;
        case 'challenges':
            showChallenges();
            break;
        case 'score':
            showMyScore();
            break;
        case 'log':
            showLogActivity();
            break;
        case 'coins':
            showCoins();
            break;
        case 'meal':
            showMealScan();
            break;
        case 'settings':
            showSettings();
            break;
        case 'help':
            startHelpFlow();
            break;
    }
}

function handleTextInput(input) {
    const trimmed = input.trim();
    if (!trimmed) return;

    addMessage(trimmed, true);

    // Check global commands first
    if (handleGlobalCommands(trimmed)) {
        return;
    }

    // Handle based on current flow
    switch (AppState.currentFlow) {
        case FLOWS.INITIAL:
            if (trimmed.toLowerCase() === 'hi' || trimmed.toLowerCase() === 'hello' || trimmed.toLowerCase() === 'start') {
                startOnboarding();
            } else {
                botMessage("Sorry — I didn't understand that.\n\nType MENU to see options, or type HELP for support.");
                setButtons([
                    { label: 'Menu', action: 'goto_menu' },
                    { label: 'HELP', action: 'menu_help' }
                ]);
            }
            break;

        case FLOWS.ONBOARDING:
            handleOnboardingStep(null, trimmed);
            break;

        case FLOWS.EXTENDED_PROFILE:
            handleExtendedProfileStep(null, trimmed);
            break;

        case FLOWS.LOG_ACTIVITY:
            if (AppState.flowStep === 3) {
                handleLogActivityStep(null, trimmed);
            }
            break;

        case FLOWS.FACE_SCAN:
            if (AppState.flowStep === 5 || AppState.flowStep === 6) {
                handleFaceScanStep(null, trimmed);
            }
            break;

        case FLOWS.AI_CHAT:
            // Freeform conversation with AI
            processAIChat(trimmed);
            break;

        case FLOWS.MEAL_SCAN:
            handleMealScan(trimmed);
            break;

        case 'support_describe':
            handleSupportDescription(trimmed);
            break;

        case FLOWS.CONTENT_LIBRARY:
            // Search mode - user typed a search query
            if (AppState.flowStep === 1) {
                searchContent(trimmed);
            }
            // Number selection mode - user typed a number to select content
            else if (AppState.flowStep === 2) {
                const num = parseInt(trimmed);
                if (num >= 1 && num <= 8 && AppState.tempData.contentItems) {
                    const items = AppState.tempData.contentItems;
                    if (num <= items.length) {
                        const selectedItem = items[num - 1];
                        openContent(selectedItem);
                    }
                } else {
                    // Try as search
                    searchContent(trimmed);
                }
            }
            break;

        case FLOWS.MAIN_MENU:
            // Try to match menu items or start AI chat for questions
            const lower = trimmed.toLowerCase();
            if (lower.includes('check') || lower === 'checkin') {
                startCheckIn();
            } else if (lower.includes('summary') || lower.includes('health')) {
                showHealthSummary();
            } else if (lower.includes('challenge')) {
                showChallenges();
            } else if (lower.includes('score')) {
                showMyScore();
            } else if (lower.includes('log') || lower.includes('activity')) {
                showLogActivity();
            } else if (lower.includes('coin') || lower.includes('reward')) {
                showCoins();
            } else if (lower.includes('meal') || lower.includes('scan')) {
                showMealScan();
            } else if (lower.includes('setting')) {
                showSettings();
            } else if (lower.includes('ai') || lower.includes('insight') || lower.includes('chat')) {
                startAIChat();
            } else {
                // Route to AI for natural conversation
                AppState.currentFlow = FLOWS.AI_CHAT;
                processAIChat(trimmed);
            }
            break;

        default:
            // Route unknown input to AI for natural conversation
            AppState.currentFlow = FLOWS.AI_CHAT;
            processAIChat(trimmed);
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

sendBtn.addEventListener('click', () => {
    const input = messageInput.value;
    if (input.trim()) {
        handleTextInput(input);
        messageInput.value = '';
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const input = messageInput.value;
        if (input.trim()) {
            handleTextInput(input);
            messageInput.value = '';
        }
    }
});

resetBtn.addEventListener('click', () => {
    localStorage.removeItem('stroveState');
    location.reload();
});

toggleDebug.addEventListener('click', () => {
    debugPanel.classList.toggle('hidden');
    toggleDebug.textContent = debugPanel.classList.contains('hidden') ? 'Show Panel' : 'Hide Panel';
});

// ==========================================
// INITIALIZATION
// ==========================================

function init() {
    loadState();
    updateDebugPanel();

    if (AppState.user.registered) {
        // Welcome back
        botMessage(`Welcome back, ${AppState.user.firstName}! 👋\n\nWhat would you like to do today?`);
        setTimeout(() => showMainMenu(), 100);
    } else {
        // Start fresh
        startOnboarding();
    }
}

// Start the app
init();
