// Strove Lite WhatsApp Prototype - State Machine & Conversation Flow

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

    // Activity data (simulated)
    weeklyActivity: {
        activeMinutes: 85,
        steps: 32450,
        distance: 24.5,
        avgSleep: '6h 45m'
    },

    // Conversation state
    currentFlow: 'initial',
    flowStep: 0,
    tempData: {},

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
    FACE_SCAN: 'faceScan'
};

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
<img src="https://cdn.prod.website-files.com/6459501ed3b56130e86c5068/6459501ed3b56130e86c511c_strove-logo-dark.svg" alt="Strove" class="strove-logo">
</div>

<strong>Welcome to Strove</strong> 👋

We help you build healthy habits at work through daily check-ins, activity tracking, challenges, and AI-powered health insights.

<div class="welcome-links">
🌐 <a href="https://www.strove.ai/" target="_blank">www.strove.ai</a>
</div>

We'll only message you if you opt in, and you can stop anytime by typing STOP.

To continue, choose an option below.`);

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
                await botMessage("Let's link you to your Strove account.\n\nPlease enter your work email or employee ID.");
                clearButtons();
            }
            break;

        case 2: // Email/ID input
            AppState.user.email = value;
            AppState.flowStep = 3;
            await botMessage("Thanks — we're securing your account.\n\nWe've sent a 6-digit code to your email.\nPlease enter it here.\n\n<em>(For demo: enter any 6 digits)</em>");
            clearButtons();
            break;

        case 3: // Verification code
            if (/^\d{6}$/.test(value)) {
                AppState.flowStep = 4;
                await botMessage("✅ Verified.\n\nWhat's your first name?");
            } else if (value.toUpperCase() === 'RESEND') {
                await botMessage("Done — we've sent a new code. Please enter it here.");
            } else {
                await botMessage("That code doesn't look right. Please try again, or type RESEND.\n\n<em>(For demo: enter any 6 digits)</em>");
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
            await botMessage("What's your height in cm?\n\nExample: 175\n\n<em>(Type SKIP to skip)</em>");
            clearButtons();
            break;

        case 1: // Height
            if (value.toUpperCase() === 'SKIP') {
                AppState.flowStep = 2;
                await botMessage("What's your weight in kg?\n\nExample: 82\n\n<em>(Type SKIP to skip)</em>");
            } else {
                const height = parseInt(value);
                if (isNaN(height) || height < 50 || height > 300) {
                    await botMessage("Please enter a number in cm (example: 175) or type SKIP.");
                } else {
                    AppState.user.height = height;
                    AppState.flowStep = 2;
                    await botMessage("What's your weight in kg?\n\nExample: 82\n\n<em>(Type SKIP to skip)</em>");
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

    await botMessage("What would you like to do?");

    setButtons([
        { label: '✅ Check-in', action: 'menu_checkin', type: 'primary' },
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
            completeCheckIn();
            break;
    }
    updateDebugPanel();
}

async function completeCheckIn() {
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Update streak
    if (AppState.lastCheckIn === yesterday.toDateString()) {
        AppState.streak++;
    } else if (AppState.lastCheckIn !== today) {
        AppState.streak = 1;
    }

    AppState.lastCheckIn = today;
    AppState.checkInToday = true;

    // Award coins
    const coinsEarned = 10 + (AppState.streak > 7 ? 5 : 0);
    AppState.coins += coinsEarned;

    // Generate focus action based on responses
    let focusAction = "Take a 10-minute walk after lunch.";
    if (AppState.tempData.sleep && AppState.tempData.sleep < 3) {
        focusAction = "Try to get to bed 30 minutes earlier tonight.";
    } else if (AppState.tempData.stress && AppState.tempData.stress > 3) {
        focusAction = "Take 5 minutes for deep breathing between meetings.";
    } else if (AppState.tempData.diet && AppState.tempData.diet < 2) {
        focusAction = "Drink a glass of water and grab a healthy snack.";
    }

    await botMessage(`✅ Check-in complete.\n\nToday's focus:\n${focusAction}\n\nYou earned <span class="coin-earned">🪙 ${coinsEarned}</span> coins.\nStreak: ${AppState.streak} days 🔥`);

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
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
        ]);
        return;
    }

    const data = AppState.weeklyActivity;
    const change = Math.random() > 0.5 ? '↑' : '↓';
    const changePhrase = change === '↑' ? 'Great progress!' : 'Keep pushing!';

    await botMessage(`📊 Your health summary — this week\n\n• Active minutes: ${data.activeMinutes} min\n• Steps: ${data.steps.toLocaleString()}\n• Distance: ${data.distance} km\n• Average sleep: ${data.avgSleep}\n\nCompared to last week: ${change} ${changePhrase}\n\nNext focus: Aim for 100 active minutes this week.`);

    setButtons([
        { label: 'Monthly summary', action: 'monthly_summary' },
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showMonthlySummary() {
    const data = AppState.weeklyActivity;

    await botMessage(`📊 Your health summary — last 30 days\n\n• Active minutes: ${data.activeMinutes * 4} min\n• Steps: ${(data.steps * 4).toLocaleString()}\n• Distance: ${(data.distance * 4).toFixed(1)} km\n• Average sleep: ${data.avgSleep}\n\nKeep going: consistency matters more than intensity.`);

    setButtons([
        { label: 'Weekly summary', action: 'menu_summary' },
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
        ]);
    } else {
        await botMessage("✅ You're in!\n\nTo track progress automatically, connect a fitness app.\nOr log activity manually when you exercise.");
        setButtons([
            { label: '🔗 Connect', action: 'goto_connect', type: 'primary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: 'My progress', action: 'challenge_progress' },
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showImproveScore() {
    await botMessage("To improve your score fastest this week, we suggest:\n\n<strong>Do your daily check-in tomorrow morning</strong>\n\nConsistency is the #1 score driver.\n\nWant to do something now?");

    setButtons([
        { label: 'Check-in', action: 'menu_checkin', type: 'primary' },
        { label: 'Log activity', action: 'menu_log' },
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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

        await botMessage(`Perfect. We'll open a secure link to connect your account.\n\n<a href="#" onclick="simulateConnection('${value}'); return false;">🔗 Connect ${value}</a>\n\n<em>(Click the link to simulate connection)</em>`);

        setButtons([
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
        ]);
    } else if (action === 'connect_other') {
        await botMessage("No problem. You can also log activity manually for now.\n\nWe'll add more services soon!");
        setButtons([
            { label: 'Log manually', action: 'menu_log', type: 'primary' },
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showRecentEarnings() {
    await botMessage(`🧾 Recent earnings\n\n• Check-ins: ${Math.min(AppState.streak, 7) * 10} coins\n• Activity: ${Math.floor(AppState.weeklyActivity.activeMinutes / 10) * 5} coins\n• Challenges: ${AppState.challengeJoined ? 25 : 0} coins`);

    setButtons([
        { label: 'Redeem rewards', action: 'redeem_rewards', type: 'primary' },
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showEarnMore() {
    await botMessage("You can earn coins by:\n\n• completing daily check-ins (10-15 coins)\n• logging activity (up to 30 coins)\n• completing challenges (bonus coins)\n• 🫀 Face scan health check (50 coins)\n\nWant to do one now?");

    setButtons([
        { label: 'Check-in', action: 'menu_checkin', type: 'primary' },
        { label: '🫀 Face scan', action: 'menu_facescan' },
        { label: 'Log activity', action: 'menu_log' },
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function showRedeemRewards() {
    if (AppState.coins < 100) {
        await botMessage(`You don't have enough coins to redeem yet.\n\nYour balance is ${AppState.coins} coins.\nMost rewards start at 100 coins.\n\nWant a quick way to earn more?`);

        setButtons([
            { label: 'Check-in', action: 'menu_checkin', type: 'primary' },
            { label: 'Log activity', action: 'menu_log' },
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
        ]);
    } else {
        await botMessage(`🎁 Popular rewards\n\n• Coffee voucher (100 coins)\n• Wellness item (200 coins)\n• Fitness gear (500 coins)\n\nRedeem securely here:\n<a href="#">🔗 Redeem rewards</a>\n\n<em>(Demo only - link simulated)</em>`);

        setButtons([
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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

    await botMessage("🍽 Send a photo of your meal.\n\nWe'll reply with simple feedback.\n\n<em>(For demo: type 'photo' to simulate upload)</em>");
    clearButtons();
}

async function handleMealScan(input) {
    if (input.toLowerCase().includes('photo') || input.toLowerCase().includes('image')) {
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
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
        ]);
    } else {
        await botMessage("Sorry — we couldn't process that.\n\nPlease try again with a clearer photo in good light.\n\n<em>(For demo: type 'photo' to simulate)</em>");

        setButtons([
            { label: 'Try again', action: 'menu_meal' },
            { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
    await botMessage("📷 <strong>Ready to scan?</strong>\n\nWe'll use your camera to measure:\n• Heart rate\n• Blood pressure (estimate)\n• Oxygen saturation\n• Respiratory rate\n\n<em>For demo: Click 'Start Scan' to simulate</em>");

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
'Overall cardiometabolic score with a couple of areas to monitor.' :
'Good overall cardiometabolic health. Keep up the healthy habits!'}
</div>
</div>

📅 Assessment: ${results.timestamp} (SAST)`);

    await delay(800);

    // Detailed Results
    await botMessage(`📊 <strong>Your Results</strong>

<div class="results-table">
<div class="result-row">
<span class="metric">Cardiometabolic Score</span>
<span class="value">${results.cmsScore}</span>
<span class="interpretation ${results.cmsScore >= 70 ? 'good' : 'warning'}">${results.cmsScore >= 70 ? 'Good' : 'Room to improve'}</span>
</div>

<div class="result-row">
<span class="metric">10-Year CVD Risk</span>
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
<span class="metric">Respiratory Rate</span>
<span class="value">${results.respRate} breaths/min</span>
<span class="interpretation good">Normal</span>
</div>

<div class="result-row">
<span class="metric">SpO₂</span>
<span class="value">${results.spo2}%</span>
<span class="interpretation good">Normal</span>
</div>
</div>`);

    await delay(800);

    // What this means
    let meaningPoints = [];
    meaningPoints.push(`Your cardiometabolic score is ${results.cmsScore >= 70 ? 'good' : 'fair'}${results.bpWarning || results.bmiWarning ? ', but some areas need attention' : ''}.`);

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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
    ]);

    updateDebugPanel();
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
                { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
                { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
                { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
    ]);
}

async function handleHelpStep(action, value) {
    switch (action) {
        case 'help_usage':
            await botMessage("Here are the main commands:\n\n• Check-in (daily)\n• Health summary (weekly/monthly)\n• Log activity\n• Coins / Redeem\n• Challenges\n\nType MENU any time to see options.\nType HELP for assistance.\nType STOP to unsubscribe.");
            setButtons([
                { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
            await botMessage("We only use your data to provide Strove services and reporting to your employer in line with our agreements.\n\nYou can:\n• opt out any time (type STOP)\n• request data access or deletion via a secure form\n\n<a href='#'>Request data access/deletion</a>\n\n<em>(Demo only - link simulated)</em>");
            setButtons([
                { label: 'MENU', action: 'goto_menu', type: 'secondary' }
            ]);
            break;
    }
}

async function handleSupportDescription(input) {
    await botMessage("✅ Got it. Our team will get back to you as soon as possible.\n\nIs there anything else we can help with?");
    AppState.tempData = {};
    setButtons([
        { label: 'Help menu', action: 'menu_help' },
        { label: 'MENU', action: 'goto_menu', type: 'secondary' }
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
                    { label: 'MENU', action: 'goto_menu' },
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

        case FLOWS.MEAL_SCAN:
            handleMealScan(trimmed);
            break;

        case 'support_describe':
            handleSupportDescription(trimmed);
            break;

        case FLOWS.MAIN_MENU:
            // Try to match menu items
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
            } else {
                botMessage("Sorry — I didn't understand that.\n\nType MENU to see options, or type HELP for support.");
                setButtons([
                    { label: 'MENU', action: 'goto_menu' },
                    { label: 'HELP', action: 'menu_help' }
                ]);
            }
            break;

        default:
            botMessage("Sorry — I didn't understand that.\n\nType MENU to see options, or type HELP for support.");
            setButtons([
                { label: 'MENU', action: 'goto_menu' },
                { label: 'HELP', action: 'menu_help' }
            ]);
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
