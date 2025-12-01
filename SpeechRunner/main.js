// Main application controller
let verbsData = null;
let currentGameMode = null;
let lastGameType = null;

// DOM elements
const gameSelectionScreen = document.getElementById('game-selection-screen');
const uploadScreen = document.getElementById('upload-screen');
const multipleChoiceSetup = document.getElementById('multiple-choice-setup');
const typingSetup = document.getElementById('typing-setup');
const multipleChoiceScreen = document.getElementById('multiple-choice-screen');
const typingScreen = document.getElementById('typing-screen');
const nameScreen = document.getElementById('name-screen');
const resultsScreen = document.getElementById('results-screen');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const multipleChoiceBtn = document.getElementById('multiple-choice-btn');
const typingGameBtn = document.getElementById('typing-game-btn');
const backToMenuBtn = document.getElementById('back-to-menu');
const restartQuizBtn = document.getElementById('restart-quiz');
const viewSetupBtn = document.getElementById('view-setup');

// Event listeners
multipleChoiceBtn.addEventListener('click', () => selectGameMode('multiple-choice'));
typingGameBtn.addEventListener('click', () => selectGameMode('typing'));
backToMenuBtn.addEventListener('click', showMainMenu);
restartQuizBtn.addEventListener('click', restartQuiz);
viewSetupBtn.addEventListener('click', viewSetup);

// Load verbs data when the page loads
document.addEventListener('DOMContentLoaded', function() {
    loadVerbsData();
});

// Function to load verbs.json from /vocab/italian/
async function loadVerbsData() {
    try {
        const response = await fetch('/vocab/italian/verbs.json');
        
        if (!response.ok) {
            throw new Error(`Failed to load verbs data: HTTP ${response.status}`);
        }
        
        const jsonData = await response.json();
        
        // Validate the JSON structure
        if (!jsonData.verbs || !Array.isArray(jsonData.verbs)) {
            throw new Error('Invalid JSON structure. Expected a "verbs" array.');
        }
        
        verbsData = jsonData;
        console.log(`Successfully loaded ${jsonData.verbs.length} verbs`);
        
    } catch (error) {
        console.error('Error loading verbs data:', error);
        showError(`Failed to load verbs data: ${error.message}. Please check the file path.`);
    }
}

function selectGameMode(mode) {
    currentGameMode = mode;
    lastGameType = mode;
    
    // Check if verbs data is loaded
    if (!verbsData) {
        showError('Verbs data is still loading. Please wait a moment and try again.');
        return;
    }
    
    // Go directly to setup screen
    gameSelectionScreen.classList.add('hidden');
    if (mode === 'multiple-choice') {
        multipleChoiceSetup.classList.remove('hidden');
    } else if (mode === 'typing') {
        typingSetup.classList.remove('hidden');
    }
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}

function showMainMenu() {
    // Hide all screens
    const screens = [
        uploadScreen, multipleChoiceSetup, typingSetup, 
        multipleChoiceScreen, typingScreen, nameScreen, resultsScreen
    ];
    screens.forEach(screen => screen.classList.add('hidden'));
    
    // Show main menu
    gameSelectionScreen.classList.remove('hidden');
}

function restartQuiz() {
    console.log('Restarting quiz...');
    
    // Hide results screen
    resultsScreen.classList.add('hidden');
    
    // Show the appropriate setup screen based on the last game type
    if (lastGameType === 'multiple-choice') {
        multipleChoiceSetup.classList.remove('hidden');
    } else if (lastGameType === 'typing') {
        typingSetup.classList.remove('hidden');
    } else {
        // Fallback - show game selection
        showMainMenu();
    }
}

function viewSetup() {
    // Hide results screen
    resultsScreen.classList.add('hidden');
    
    // Show the setup screen for the last game type
    if (lastGameType === 'multiple-choice') {
        multipleChoiceSetup.classList.remove('hidden');
    } else if (lastGameType === 'typing') {
        typingSetup.classList.remove('hidden');
    } else {
        // Fallback - show game selection
        showMainMenu();
    }
}

// Export shared functions and data
window.appData = {
    verbsData: () => verbsData,
    showError,
    showMainMenu,
    
    // Track last game type
    setLastGameType: (type) => { lastGameType = type; },
    getLastGameType: () => lastGameType,
    
    // Shared question limit
    minQuestions: 5,
    
    // Flexible validation for question count
    validateQuestionCount: function(questionCount) {
        if (questionCount < this.minQuestions) {
            this.showError(`Please select at least ${this.minQuestions} questions.`);
            return false;
        }
        return true;
    }
};