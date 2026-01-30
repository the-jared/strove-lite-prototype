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
                await botMessage("First, choose your language.");
                setButtons([
                    { label: 'English', action: 'set_language', value: 'English', type: 'primary' },
                    { label: 'isiZulu', action: 'set_language', value: 'isiZulu' },
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
                await botMessage("Let's link you to your Strove account.\n\nPlease enter your email or member ID.");
                clearButtons();
            }
            break;

        case 2: // Email/ID input
            AppState.user.email = value;
            AppState.flowStep = 3;
            await botMessage("Thanks — we're securing your account.\n\nWe've sent a 6-digit code to your email.\nPlease enter it here.");
            clearButtons();
            break;

        case 3: // Verification code
            if (/^\d{6}$/.test(value)) {
                AppState.flowStep = 4;
                await botMessage("✅ Verified.\n\nWhat's your first name?");
            } else if (value.toUpperCase() === 'RESEND') {
                await botMessage("Done — we've sent a new code. Please enter it here.");
            } else {
                await botMessage("Hmm, that code didn't match. Double-check your email and try again, or type RESEND.");
            }
            break;

        case 4: // First name
            AppState.user.firstName = value;
            AppState.flowStep = 5;
            await botMessage(`Thanks, ${value}. What's your surname?`);
            break;

        case 5: // Surname - End of lean onboarding
            AppState.user.surname = value;
            AppState.user.registered = true;
            AppState.flowStep = 6;

            await botMessage(`✅ Account created!\n\nLet's get started, ${AppState.user.firstName}.`);
            await delay(500);
            await botMessage("Do your first check-in or connect a fitness app to pull your steps and workouts automatically.");

            setButtons([
                { label: '✅ Do first check-in', action: 'first_checkin', type: 'primary' },
                { label: '🔗 Connect fitness app', action: 'first_connect' },
                { label: 'Skip for now', action: 'skip_first', type: 'secondary' }
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

    // Show personalized menu header with stats
    const greeting = AppState.user.firstName ? `Hey ${AppState.user.firstName}!` : 'Hey there!';
    const streakBadge = AppState.streak > 0 ? `🔥 ${AppState.streak} day streak` : '';
    const coinsBadge = `🪙 ${AppState.coins} coins`;
    const statsLine = [streakBadge, coinsBadge].filter(Boolean).join(' • ');

    await botMessage(`${greeting} ${statsLine ? `<div class="menu-stats">${statsLine}</div>` : ''}\n\nWhat would you like to do?`);

    setButtons([
        { label: '✅ Check-in', action: 'menu_checkin', type: 'primary' },
        { label: '🤖 AI Insights', action: 'menu_ai' },
        { label: '📚 Content Library', action: 'menu_content' },
        { label: '📊 Health summary', action: 'menu_summary' },
        { label: '🫀 Face scan', action: 'menu_facescan' },
        { label: '🏆 Challenges', action: 'menu_challenges' },
        { label: '⭐ My Score', action: 'menu_score' },
        { label: '🏃 Log activity', action: 'menu_log' },
        { label: '🪙 Coins & rewards', action: 'menu_coins' },
        { label: '🍽 Meal scan', action: 'menu_meal' },
        { label: '⚙️ Settings', action: 'menu_settings' },
        { label: '❓ Help', action: 'menu_help' }
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

    await botMessage("Let's do your check-in. This takes about 30 seconds.");
    AppState.flowStep = 1;
    await showCheckInQ1();
}

async function showCheckInQ1() {
    await botMessage("How did you sleep last night?");
    setButtons([
        { label: 'Very poor', action: 'sleep', value: 1 },
        { label: 'Poor', action: 'sleep', value: 2 },
        { label: 'Okay', action: 'sleep', value: 3 },
        { label: 'Good', action: 'sleep', value: 4 },
        { label: 'Very good', action: 'sleep', value: 5 },
        { label: 'Skip', action: 'sleep', value: null, type: 'secondary' }
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
            addMessage(value ? ['Very poor', 'Poor', 'Okay', 'Good', 'Very good'][value - 1] : 'Skip', true);
            AppState.tempData.sleep = value;
            AppState.flowStep = 2;
            await botMessage("How stressed do you feel today?");
            setButtons([
                { label: 'Very low', action: 'stress', value: 1 },
                { label: 'Low', action: 'stress', value: 2 },
                { label: 'Moderate', action: 'stress', value: 3 },
                { label: 'High', action: 'stress', value: 4 },
                { label: 'Very high', action: 'stress', value: 5 },
                { label: 'Skip', action: 'stress', value: null, type: 'secondary' }
            ]);
            break;

        case 2: // Stress
            addMessage(value ? ['Very low', 'Low', 'Moderate', 'High', 'Very high'][value - 1] : 'Skip', true);
            AppState.tempData.stress = value;
            AppState.flowStep = 3;
            await botMessage("Do you plan to be active today?");
            setButtons([
                { label: 'Yes', action: 'active', value: 'yes' },
                { label: 'Not sure', action: 'active', value: 'maybe' },
                { label: 'No', action: 'active', value: 'no' }
            ]);
            break;

        case 3: // Activity plan
            addMessage(value.charAt(0).toUpperCase() + value.slice(1), true);
            AppState.tempData.activePlan = value;
            AppState.flowStep = 4;
            await botMessage("How's your diet and hydration so far today?");
            setButtons([
                { label: 'Poor', action: 'diet', value: 1 },
                { label: 'Okay', action: 'diet', value: 2 },
                { label: 'Good', action: 'diet', value: 3 },
                { label: 'Skip', action: 'diet', value: null, type: 'secondary' }
            ]);
            break;

        case 4: // Diet
            addMessage(value ? ['Poor', 'Okay', 'Good'][value - 1] : 'Skip', true);
            AppState.tempData.diet = value;
            AppState.flowStep = 5;
            await botMessage("How's your mood right now?");
            setButtons([
                { label: '😊 Great', action: 'mood', value: 5 },
                { label: '🙂 Good', action: 'mood', value: 4 },
                { label: '😐 Okay', action: 'mood', value: 3 },
                { label: '😔 Low', action: 'mood', value: 2 },
                { label: 'Skip', action: 'mood', value: null, type: 'secondary' }
            ]);
            break;

        case 5: // Mood
            if (value) {
                const moodLabels = ['', '', '😔 Low', '😐 Okay', '🙂 Good', '😊 Great'];
                addMessage(moodLabels[value], true);
            } else {
                addMessage('Skip', true);
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
    let celebration = "✅ Check-in complete!";
    let streakMessage = `🔥 ${AppState.streak} day streak`;

    if (isFirstCheckIn) {
        celebration = "🎉 First check-in complete! You've taken the first step — this is where it all begins.";
    } else if (AppState.streak === 7) {
        streakMessage = "🔥 One week strong! You're building a real habit here.";
    } else if (AppState.streak === 30) {
        streakMessage = "🏆 30 days! Incredible consistency — you're crushing it!";
    } else if (AppState.streak > 7) {
        streakMessage = `🔥 ${AppState.streak} days strong — amazing consistency!`;
    }

    let milestoneMessage = coinMilestone ? `\n\n🎉 <strong>Milestone:</strong> ${coinMilestone}` : '';
    await botMessage(`${celebration}\n\n${empathyNote}Today's focus:\n${focusAction}\n\nYou earned <span class="coin-earned">🪙 ${coinsEarned}</span> coins.\n${streakMessage}${milestoneMessage}`);

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
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    const data = AppState.weeklyActivity;
    const meals = AppState.mealHistory;
    const avgMealScore = meals.length > 0
        ? (meals.reduce((sum, m) => sum + m.score, 0) / meals.length).toFixed(1)
        : 'N/A';

    // Calculate step trend and week-over-week comparisons
    const recentSteps = data.dailySteps.slice(-3);
    const earlierSteps = data.dailySteps.slice(0, 3);
    const recentAvg = recentSteps.reduce((a, b) => a + b, 0) / recentSteps.length;
    const earlierAvg = earlierSteps.reduce((a, b) => a + b, 0) / earlierSteps.length;
    const stepChange = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100);
    const stepTrend = stepChange > 5 ? `<span class="trend-up">↑ ${stepChange}%</span>` :
                      stepChange < -5 ? `<span class="trend-down">↓ ${Math.abs(stepChange)}%</span>` :
                      '<span class="trend-stable">→ stable</span>';

    // Simulated last week comparisons
    const lastWeekMinutes = Math.round(data.activeMinutes * 0.85);
    const minutesChange = Math.round(((data.activeMinutes - lastWeekMinutes) / lastWeekMinutes) * 100);
    const minutesTrend = minutesChange > 0 ? `<span class="trend-up">↑ ${minutesChange}% vs last week</span>` :
                         minutesChange < 0 ? `<span class="trend-down">↓ ${Math.abs(minutesChange)}%</span>` : '';

    await botMessage(`📊 <strong>Your Weekly Health Summary</strong>

<div class="summary-card">
<div class="summary-section">
<strong>🏃 Activity</strong>
• Active minutes: <strong>${data.activeMinutes} min</strong> ${minutesTrend}
• Total steps: <strong>${data.steps.toLocaleString()}</strong> ${stepTrend}
• Distance: <strong>${data.distance} km</strong>
• Workouts: <strong>${data.workouts.length}</strong> sessions
</div>

<div class="summary-section">
<strong>❤️ Vitals</strong>
• Avg heart rate: <strong>${data.heartRateAvg}</strong> beats per minute
• Resting HR: <strong>${data.restingHR}</strong> bpm
• Calories burned: ~<strong>${data.calories}/day</strong>
</div>

<div class="summary-section">
<strong>😴 Sleep</strong>
• Average: <strong>${data.avgSleep}</strong>
• Quality score: <strong>${data.sleepQuality}/100</strong>
</div>

<div class="summary-section">
<strong>🍽 Nutrition</strong>
• Meals logged: <strong>${meals.length}</strong>
• Average score: <strong>${avgMealScore}/10</strong>
</div>
</div>

🔥 <strong>Streak:</strong> ${AppState.streak} days`);

    await delay(500);

    // Show workout breakdown
    if (data.workouts.length > 0) {
        const workoutList = data.workouts.map(w => `• ${w.day}: ${w.type} (${w.duration}min)`).join('\n');
        await botMessage(`💪 <strong>This Week's Workouts</strong>\n\n${workoutList}`);
    }

    setButtons([
        { label: '🤖 Get AI insights', action: 'menu_ai', type: 'primary' },
        { label: 'Monthly summary', action: 'monthly_summary' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showMonthlySummary() {
    const data = AppState.weeklyActivity;

    await botMessage(`📊 <strong>Your Monthly Health Summary</strong>

<div class="summary-card">
<div class="summary-section">
<strong>🏃 Activity (30 days)</strong>
• Active minutes: <strong>${data.activeMinutes * 4} min</strong>
• Total steps: <strong>${(data.steps * 4).toLocaleString()}</strong>
• Distance: <strong>${(data.distance * 4).toFixed(1)} km</strong>
• Avg daily steps: <strong>${Math.round(data.steps * 4 / 30).toLocaleString()}</strong>
</div>

<div class="summary-section">
<strong>😴 Sleep</strong>
• Average: <strong>${data.avgSleep}</strong>
• Quality trend: <strong>Stable</strong>
</div>

<div class="summary-section">
<strong>🎯 Progress</strong>
• Check-in streak: <strong>${AppState.streak} days</strong>
• Coins earned: <strong>${AppState.coins} 🪙</strong>
</div>
</div>

💡 <strong>Tip:</strong> Consistency matters more than intensity. Keep showing up!`);

    setButtons([
        { label: '🤖 Get AI insights', action: 'menu_ai', type: 'primary' },
        { label: 'Weekly summary', action: 'menu_summary' },
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

    await botMessage("🏆 This month's challenge\n\n<strong>Move More February</strong>\n\nMove 150 minutes this month.\n\nWant to join?");

    setButtons([
        { label: 'Join challenge', action: 'join_challenge', type: 'primary' },
        { label: 'My progress', action: 'challenge_progress' },
        { label: 'Reminder settings', action: 'challenge_reminders' },
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
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
        ]);
    } else {
        await botMessage("✅ You're in!\n\nTo track progress automatically, connect a fitness app.\nOr log activity manually when you exercise.");
        setButtons([
            { label: '🔗 Connect', action: 'goto_connect', type: 'primary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: 'My progress', action: 'challenge_progress' },
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
        ]);
    }
    updateDebugPanel();
}

async function showChallengeProgress() {
    const progress = AppState.challengeProgress;
    const target = AppState.challengeTarget;
    const percentage = Math.min(100, Math.round((progress / target) * 100));

    let status = "On track";
    if (percentage < 30) status = "A little behind";
    if (percentage > 70) status = "Great pace! 🔥";

    await botMessage(`🏃 Your progress\n\n• Active minutes: ${progress} / ${target}\n• Days active: ${Math.floor(progress / 20)}\n\n<div class="progress-bar"><div class="progress-fill" style="width: ${percentage}%"></div></div>\n\n${status}`);

    setButtons([
        { label: 'Log activity', action: 'menu_log', type: 'primary' },
        { label: 'Health summary', action: 'menu_summary' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        await botMessage("⭐ Your Strove Score\n\nWe need a bit more data to calculate your score reliably.\n\nConnect a fitness app or log activity manually for a few days.");
        setButtons([
            { label: '🔗 Connect', action: 'goto_connect', type: 'primary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    // Calculate simulated score
    const baseScore = 65;
    const streakBonus = Math.min(AppState.streak * 2, 20);
    const activityBonus = AppState.checkInToday ? 10 : 0;
    const score = baseScore + streakBonus + activityBonus;
    const change = AppState.streak > 3 ? '+5' : '-2';
    const progress = score;

    await botMessage(`⭐ Your Strove Score\n\n<div class="score-circle" style="--progress: ${progress}%"><div class="score-inner">${score}</div></div>\n\nChange: ${change} this week\n\nTop drivers (this week):\n• Check-in consistency\n• Activity levels\n\nNext best action: Complete tomorrow's check-in to maintain your streak.`);

    setButtons([
        { label: 'Improve my score', action: 'improve_score', type: 'primary' },
        { label: 'Health summary', action: 'menu_summary' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showImproveScore() {
    await botMessage("To improve your score fastest this week, we suggest:\n\n<strong>Do your daily check-in tomorrow morning</strong>\n\nConsistency is the #1 score driver.\n\nWant to do something now?");

    setButtons([
        { label: 'Check-in', action: 'menu_checkin', type: 'primary' },
        { label: 'Log activity', action: 'menu_log' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleLogActivityStep(action, value) {
    switch (AppState.flowStep) {
        case 0: // Choice
            if (action === 'log_manual') {
                AppState.flowStep = 1;
                await botMessage("What did you do?");
                setButtons([
                    { label: '🚶 Walk', action: 'activity_type', value: 'Walk' },
                    { label: '🏃 Run', action: 'activity_type', value: 'Run' },
                    { label: '🚴 Cycle', action: 'activity_type', value: 'Cycle' },
                    { label: '💪 Strength', action: 'activity_type', value: 'Strength' },
                    { label: 'Other', action: 'activity_type', value: 'Other' }
                ]);
            }
            break;

        case 1: // Activity type
            addMessage(value, true);
            AppState.tempData.activityType = value;
            AppState.flowStep = 2;
            await botMessage("How long?");
            setButtons([
                { label: '10 min', action: 'activity_duration', value: 10 },
                { label: '20 min', action: 'activity_duration', value: 20 },
                { label: '30 min', action: 'activity_duration', value: 30 },
                { label: '45 min', action: 'activity_duration', value: 45 },
                { label: '60+ min', action: 'activity_duration', value: 60 },
                { label: 'Custom', action: 'activity_custom', type: 'secondary' }
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
    await botMessage("How hard did it feel?");
    setButtons([
        { label: 'Easy', action: 'activity_intensity', value: 'Easy' },
        { label: 'Moderate', action: 'activity_intensity', value: 'Moderate' },
        { label: 'Hard', action: 'activity_intensity', value: 'Hard' },
        { label: 'Skip', action: 'activity_intensity', value: null, type: 'secondary' }
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
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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

    await botMessage("Which service would you like to connect?");

    setButtons([
        { label: 'Apple Health', action: 'connect_service', value: 'Apple Health' },
        { label: 'Google Fit', action: 'connect_service', value: 'Google Fit' },
        { label: 'Garmin', action: 'connect_service', value: 'Garmin' },
        { label: 'Fitbit', action: 'connect_service', value: 'Fitbit' },
        { label: 'Samsung Health', action: 'connect_service', value: 'Samsung Health' },
        { label: 'Other / Not sure', action: 'connect_other', type: 'secondary' }
    ]);
}

async function handleConnectStep(action, value) {
    if (action === 'connect_service') {
        addMessage(value, true);
        AppState.tempData.connectingService = value;

        await botMessage(`Perfect. We'll open a secure link to connect your account.\n\n<a href="#" onclick="simulateConnection('${value}'); return false;">🔗 Connect ${value}</a>`);

        setButtons([
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
        ]);
    } else if (action === 'connect_other') {
        await botMessage("No problem. You can also log activity manually for now.\n\nWe'll add more services soon!");
        setButtons([
            { label: 'Log manually', action: 'menu_log', type: 'primary' },
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);

    updateDebugPanel();
};

// ==========================================
// COINS & REWARDS
// ==========================================

async function showCoins() {
    AppState.currentFlow = FLOWS.COINS;
    updateDebugPanel();

    await botMessage(`🪙 Your Strove Coins\n\nBalance: <strong>${AppState.coins}</strong> coins\n\nWhat would you like to do?`);

    setButtons([
        { label: 'Redeem rewards', action: 'redeem_rewards', type: 'primary' },
        { label: 'How to earn more', action: 'earn_more' },
        { label: 'Recent earnings', action: 'recent_earnings' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showRecentEarnings() {
    await botMessage(`🧾 Recent earnings\n\n• Check-ins: ${Math.min(AppState.streak, 7) * 10} coins\n• Activity: ${Math.floor(AppState.weeklyActivity.activeMinutes / 10) * 5} coins\n• Challenges: ${AppState.challengeJoined ? 25 : 0} coins`);

    setButtons([
        { label: 'Redeem rewards', action: 'redeem_rewards', type: 'primary' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showEarnMore() {
    await botMessage("You can earn coins by:\n\n• completing daily check-ins (10-15 coins)\n• logging activity (up to 30 coins)\n• completing challenges (bonus coins)\n• 🫀 Face scan health check (50 coins)\n\nWant to do one now?");

    setButtons([
        { label: 'Check-in', action: 'menu_checkin', type: 'primary' },
        { label: '🫀 Face scan', action: 'menu_facescan' },
        { label: 'Log activity', action: 'menu_log' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showRedeemRewards() {
    if (AppState.coins < 100) {
        await botMessage(`You don't have enough coins to redeem yet.\n\nYour balance is ${AppState.coins} coins.\nMost rewards start at 100 coins.\n\nWant a quick way to earn more?`);

        setButtons([
            { label: 'Check-in', action: 'menu_checkin', type: 'primary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
        ]);
    } else {
        await botMessage(`🎁 Popular rewards\n\n• Coffee voucher (100 coins)\n• Wellness item (200 coins)\n• Fitness gear (500 coins)\n\nRedeem securely here:\n<a href="#">🔗 Redeem rewards</a>`);

        setButtons([
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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

    await botMessage("🫀 <strong>Health Check - Face Scan</strong>\n\nGet a personalized health report with estimated vitals using your camera.\n\nThis takes about 2 minutes and earns you <strong>50 coins</strong>.");

    await delay(500);
    await botMessage("⚠️ <strong>Disclaimer</strong>\n\nFace scan outputs are non-diagnostic estimates, and the product is not a medical device.\n\nDo not use for screening, diagnosis, treatment, or emergency decision-making.\n\nSeek professional advice; for emergencies, call your local emergency number.");

    setButtons([
        { label: '✅ I understand, continue', action: 'facescan_start', type: 'primary' },
        { label: 'Cancel', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleFaceScanStep(action, value) {
    switch (AppState.flowStep) {
        case 0: // Disclaimer accepted
            if (action === 'facescan_start') {
                AppState.flowStep = 1;
                await botMessage("First, a few quick health questions.\n\n<strong>Do you smoke?</strong>");
                setButtons([
                    { label: 'No, never', action: 'fs_smoker', value: 'never' },
                    { label: 'Ex-smoker', action: 'fs_smoker', value: 'ex' },
                    { label: 'Yes, occasionally', action: 'fs_smoker', value: 'occasional' },
                    { label: 'Yes, daily', action: 'fs_smoker', value: 'daily' }
                ]);
            }
            break;

        case 1: // Smoking status
            addMessage(value === 'never' ? 'No, never' : value === 'ex' ? 'Ex-smoker' : value === 'occasional' ? 'Yes, occasionally' : 'Yes, daily', true);
            AppState.tempData.faceScan.smoker = value;
            AppState.flowStep = 2;
            await botMessage("<strong>How would you describe your physical activity level?</strong>");
            setButtons([
                { label: 'Sedentary', action: 'fs_activity', value: 'sedentary' },
                { label: 'Light (1-2 days/week)', action: 'fs_activity', value: 'light' },
                { label: 'Moderate (3-4 days/week)', action: 'fs_activity', value: 'moderate' },
                { label: 'Active (5+ days/week)', action: 'fs_activity', value: 'active' }
            ]);
            break;

        case 2: // Activity level
            addMessage(value === 'sedentary' ? 'Sedentary' : value === 'light' ? 'Light' : value === 'moderate' ? 'Moderate' : 'Active', true);
            AppState.tempData.faceScan.activityLevel = value;
            AppState.flowStep = 3;
            await botMessage("<strong>Do you have any of the following conditions?</strong>\n\n(Select the most relevant)");
            setButtons([
                { label: 'None', action: 'fs_conditions', value: 'none' },
                { label: 'High blood pressure', action: 'fs_conditions', value: 'hypertension' },
                { label: 'Diabetes', action: 'fs_conditions', value: 'diabetes' },
                { label: 'Heart condition', action: 'fs_conditions', value: 'heart' }
            ]);
            break;

        case 3: // Health conditions
            addMessage(value === 'none' ? 'None' : value === 'hypertension' ? 'High blood pressure' : value === 'diabetes' ? 'Diabetes' : 'Heart condition', true);
            AppState.tempData.faceScan.conditions = value;
            AppState.flowStep = 4;
            await botMessage("<strong>How much alcohol do you consume?</strong>");
            setButtons([
                { label: 'None', action: 'fs_alcohol', value: 'none' },
                { label: 'Occasionally', action: 'fs_alcohol', value: 'occasional' },
                { label: 'Moderate (few/week)', action: 'fs_alcohol', value: 'moderate' },
                { label: 'Heavy (daily)', action: 'fs_alcohol', value: 'heavy' }
            ]);
            break;

        case 4: // Alcohol consumption
            addMessage(value === 'none' ? 'None' : value === 'occasional' ? 'Occasionally' : value === 'moderate' ? 'Moderate' : 'Heavy', true);
            AppState.tempData.faceScan.alcohol = value;
            AppState.flowStep = 5;

            // Check if we have height/weight, if not ask
            if (!AppState.user.height || !AppState.user.weight) {
                await botMessage("We need your height and weight for accurate BMI calculation.\n\n<strong>What's your height in cm?</strong>\n\nExample: 175");
                clearButtons();
            } else {
                AppState.flowStep = 7;
                showFaceScanCamera();
            }
            break;

        case 5: // Height input
            const height = parseInt(value);
            if (isNaN(height) || height < 100 || height > 250) {
                await botMessage("Please enter a valid height in cm (e.g., 175)");
            } else {
                AppState.user.height = height;
                AppState.flowStep = 6;
                await botMessage("<strong>What's your weight in kg?</strong>\n\nExample: 82");
            }
            break;

        case 6: // Weight input
            const weight = parseInt(value);
            if (isNaN(weight) || weight < 30 || weight > 300) {
                await botMessage("Please enter a valid weight in kg (e.g., 82)");
            } else {
                AppState.user.weight = weight;
                AppState.flowStep = 7;
                showFaceScanCamera();
            }
            break;

        case 7: // Camera permission / scan
            if (action === 'fs_start_scan') {
                performFaceScan();
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
    const data = AppState.tempData.faceScan;
    const height = AppState.user.height / 100; // convert to meters
    const weight = AppState.user.weight;
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
    // Health Snapshot
    await botMessage(`🫀 <strong>Personalised Health Report</strong>\n\n<div class="health-report-card">
<div class="health-snapshot">
<strong>Health Snapshot</strong> — Overall: <span class="${results.overallStatus === 'Good' || results.overallStatus === 'Excellent' ? 'status-good' : 'status-warning'}">${results.overallStatus}</span>

<div class="cms-score-display">
<div class="cms-circle" style="--cms-progress: ${results.cmsScore}%">
<div class="cms-inner">${results.cmsScore}</div>
</div>
<span class="cms-label">${results.cmsScore} / 100</span>
</div>

${results.bpWarning || results.bmiWarning ?
'Good overall heart health with a couple of areas to monitor.' :
'Great heart health! Keep up the healthy habits!'}
</div>
</div>

📅 Assessment: ${results.timestamp} (SAST)`);

    await delay(800);

    // Detailed Results
    await botMessage(`📊 <strong>Your Results</strong>

<div class="results-table">
<div class="result-row">
<span class="metric">Heart Health Score</span>
<span class="value">${results.cmsScore}</span>
<span class="interpretation ${results.cmsScore >= 70 ? 'good' : 'warning'}">${results.cmsScore >= 70 ? 'Good' : 'Room to improve'}</span>
</div>

<div class="result-row">
<span class="metric">10-Year Heart Risk</span>
<span class="value">${results.cvdRisk}%</span>
<span class="interpretation ${parseFloat(results.cvdRisk) < 5 ? 'good' : 'warning'}">${parseFloat(results.cvdRisk) < 5 ? 'Low' : 'Moderate'}</span>
</div>

<div class="result-row">
<span class="metric">Resting Heart Rate</span>
<span class="value">${results.heartRate} bpm</span>
<span class="interpretation ${results.heartRate <= 100 ? 'good' : 'warning'}">${results.heartRate <= 100 ? 'Normal' : 'Elevated'}</span>
</div>

<div class="result-row ${results.bpWarning ? 'warning-row' : ''}">
<span class="metric">Blood Pressure</span>
<span class="value">${results.systolic}/${results.diastolic} mmHg</span>
<span class="interpretation ${results.bpWarning ? 'warning' : 'good'}">${results.bpWarning ? '⚠️ ' : ''}${results.bpStatus}</span>
</div>

<div class="result-row ${results.bmiWarning ? 'warning-row' : ''}">
<span class="metric">BMI</span>
<span class="value">${results.bmi} kg/m²</span>
<span class="interpretation ${results.bmiWarning ? 'warning' : 'good'}">${results.bmiWarning ? '⚠️ ' : ''}${results.bmiStatus}</span>
</div>

<div class="result-row">
<span class="metric">Breathing Rate</span>
<span class="value">${results.respRate} breaths/min</span>
<span class="interpretation good">Normal</span>
</div>

<div class="result-row">
<span class="metric">Blood Oxygen</span>
<span class="value">${results.spo2}%</span>
<span class="interpretation good">Normal</span>
</div>
</div>`);

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

    await botMessage(`💡 <strong>What This Means</strong>\n\n${meaningPoints.map(p => '• ' + p).join('\n')}`);

    await delay(800);

    // Recommendations
    let recommendations = [];

    if (results.bpWarning) {
        recommendations.push('🩺 Repeat blood pressure with a validated arm cuff and see your GP if elevated readings persist.');
    }
    if (results.bmiWarning && results.bmi >= 25) {
        recommendations.push('🥗 Use the AI meal scanner to track meals and choose lower-salt, higher-fibre options.');
    }
    if (AppState.tempData.faceScan.activityLevel === 'sedentary' || AppState.tempData.faceScan.activityLevel === 'light') {
        recommendations.push('🏃 Aim to earn 200 Strove points this week to meet the WHO 150-minute guideline.');
    }
    recommendations.push('😴 Track sleep and aim for at least 7 hours per night.');
    recommendations.push('🔄 Repeat the face scan in 2 weeks to track trends.');

    await botMessage(`✅ <strong>Recommendations</strong>\n\n<strong>Lifestyle Actions:</strong>\n${recommendations.slice(0, -1).map(r => '• ' + r).join('\n')}\n\n<strong>Next Steps:</strong>\n• ${recommendations[recommendations.length - 1]}`);

    // Coins earned
    await delay(500);
    await botMessage(`🎉 <strong>Health check complete!</strong>\n\nYou earned <span class="coin-earned">🪙 ${coinsEarned}</span> coins.\n\nTrack your progress by doing another scan in 2 weeks.`);

    AppState.tempData = {};

    setButtons([
        { label: 'View Health Summary', action: 'menu_summary', type: 'primary' },
        { label: 'Log Activity', action: 'menu_log' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
    await botMessage(`🤖 <strong>Strove AI Assistant</strong>\n\n${greeting}\n\nI can help you with:\n• Understanding your health data\n• Personalized wellness tips\n• Answering questions about your progress\n• Motivation and goal setting\n\nJust type your question or pick a topic below.`);

    setButtons([
        { label: '📊 Analyze my week', action: 'ai_analyze_week', type: 'primary' },
        { label: '🍽 Nutrition tips', action: 'ai_nutrition' },
        { label: '😴 Sleep insights', action: 'ai_sleep' },
        { label: '💪 Motivation', action: 'ai_motivation' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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

    const token = getContentApiToken();
    if (!token) {
        console.log('No Content API token configured, using list data');
        return null;
    }

    try {
        const response = await fetch(`${CONTENT_API_BASE}/${documentId}`, {
            method: 'GET',
            headers: getContentApiHeaders()
        });

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

    await botMessage("📚 <strong>Content Library</strong>\n\nExplore workouts, recipes, and wellness content.\n\nLoading content...");
    clearButtons();

    const content = await fetchContentLibrary();

    if (content.length === 0) {
        await botMessage("Unable to load content right now. Please try again later.");
        setButtons([
            { label: 'Try again', action: 'menu_content', type: 'primary' },
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    // Show categories
    await botMessage(`Found <strong>${content.length}</strong> items across ${contentCategories.length} categories.\n\nBrowse by category or see featured content:`);

    const categoryButtons = contentCategories.slice(0, 4).map(cat => ({
        label: getCategoryEmoji(cat.slug) + ' ' + cat.name,
        action: 'content_category',
        value: cat.slug
    }));

    setButtons([
        { label: '⭐ Featured', action: 'content_featured', type: 'primary' },
        ...categoryButtons,
        { label: '🔍 Search', action: 'content_search' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    // Store items for quick selection by number
    AppState.tempData.contentItems = items;

    let contentHtml = `<strong>${title}</strong>\n\nTap a number to open:\n\n`;

    items.slice(0, 8).forEach((item, index) => {
        const typeIcon = getContentTypeIcon(item.type);
        const duration = item.duration?.label ? `(${item.duration.label})` : '';
        const points = item.points?.value ? `🪙 ${item.points.value}` : '';

        contentHtml += `<div class="content-list-item">
<strong>${index + 1}.</strong> ${typeIcon} ${item.title} ${duration} ${points}
</div>`;
    });

    contentHtml += `\n<em>Type a number (1-${Math.min(items.length, 8)}) to open</em>`;

    await botMessage(contentHtml);

    // Create numbered buttons for quick selection
    const itemButtons = items.slice(0, 6).map((item, index) => ({
        label: `${index + 1}. ${getContentTypeIcon(item.type)} ${item.title.substring(0, 15)}${item.title.length > 15 ? '...' : ''}`,
        action: 'content_open',
        value: item.documentId
    }));

    setButtons([
        ...itemButtons,
        { label: '← Back', action: 'menu_content' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
            { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);

    updateDebugPanel();
}

async function likeContent(documentId) {
    await botMessage("❤️ Liked! Thanks for the feedback.");

    setButtons([
        { label: '📚 More Content', action: 'menu_content', type: 'primary' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
        default:
            showContentLibrary();
    }
}

// ==========================================
// SETTINGS
// ==========================================

async function showSettings() {
    AppState.currentFlow = FLOWS.SETTINGS;
    AppState.flowStep = 0;
    updateDebugPanel();

    await botMessage("⚙️ Settings\n\nWhat would you like to change?");

    setButtons([
        { label: 'Reminder preferences', action: 'settings_reminders' },
        { label: 'Goals', action: 'settings_goals' },
        { label: 'Profile', action: 'settings_profile' },
        { label: 'Connected apps', action: 'settings_apps' },
        { label: 'Language', action: 'settings_language' },
        { label: 'Stop messages', action: 'settings_stop', type: 'secondary' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
                { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
                { label: 'Menu', action: 'goto_menu', type: 'secondary' }
            ]);
            break;

        case 'settings_language':
            await botMessage("Choose your language.");
            setButtons([
                { label: 'English', action: 'set_language', value: 'English', type: 'primary' },
                { label: 'isiZulu', action: 'set_language', value: 'isiZulu' },
                { label: 'Afrikaans', action: 'set_language', value: 'Afrikaans' }
            ]);
            break;

        case 'set_language':
            addMessage(value, true);
            AppState.user.language = value;
            saveState();
            await botMessage("✅ Done. Language updated.");
            setButtons([
                { label: 'Settings', action: 'menu_settings' },
                { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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

    await botMessage("❓ How can we help?");

    setButtons([
        { label: 'How to use Strove Lite', action: 'help_usage' },
        { label: 'Contact support', action: 'help_support' },
        { label: 'Privacy & data', action: 'help_privacy' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleHelpStep(action, value) {
    switch (action) {
        case 'help_usage':
            await botMessage("Here are the main commands:\n\n• Check-in (daily)\n• Health summary (weekly/monthly)\n• Log activity\n• Coins / Redeem\n• Challenges\n\nType MENU any time to see options.\nType HELP for assistance.\nType STOP to unsubscribe.");
            setButtons([
                { label: 'Menu', action: 'goto_menu', type: 'secondary' }
            ]);
            break;

        case 'help_support':
            await botMessage("If something isn't working, we can help.\n\nChoose an option:");
            setButtons([
                { label: 'Technical issue', action: 'support_type', value: 'Technical' },
                { label: 'Rewards issue', action: 'support_type', value: 'Rewards' },
                { label: 'Account issue', action: 'support_type', value: 'Account' },
                { label: 'Back', action: 'menu_help', type: 'secondary' }
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
                { label: 'Menu', action: 'goto_menu', type: 'secondary' }
            ]);
            break;
    }
}

async function handleSupportDescription(input) {
    await botMessage("✅ Got it. Our team will get back to you as soon as possible.\n\nIs there anything else we can help with?");
    AppState.tempData = {};
    setButtons([
        { label: 'Help menu', action: 'menu_help' },
        { label: 'Menu', action: 'goto_menu', type: 'secondary' }
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
