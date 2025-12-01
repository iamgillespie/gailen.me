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
const fileInput = document.getElementById('json-file');
const loadFileBtn = document.getElementById('load-file');
const fileStatus = document.getElementById('file-status');
const multipleChoiceBtn = document.getElementById('multiple-choice-btn');
const typingGameBtn = document.getElementById('typing-game-btn');
const backToMenuBtn = document.getElementById('back-to-menu');
const restartQuizBtn = document.getElementById('restart-quiz');
const viewSetupBtn = document.getElementById('view-setup');

// Event listeners
multipleChoiceBtn.addEventListener('click', () => selectGameMode('multiple-choice'));
typingGameBtn.addEventListener('click', () => selectGameMode('typing'));
loadFileBtn.addEventListener('click', loadJsonFile);
backToMenuBtn.addEventListener('click', showMainMenu);
restartQuizBtn.addEventListener('click', restartQuiz);
viewSetupBtn.addEventListener('click', viewSetup);

function selectGameMode(mode) {
    currentGameMode = mode;
    gameSelectionScreen.classList.add('hidden');
    uploadScreen.classList.remove('hidden');
}

function loadJsonFile() {
    const file = fileInput.files[0];
    
    if (!file) {
        showError('Please select a JSON file to upload.');
        return;
    }
    
    if (file.type !== 'application/json') {
        showError('Please select a valid JSON file.');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            
            // Validate the JSON structure
            if (!jsonData.verbs || !Array.isArray(jsonData.verbs)) {
                showError('Invalid JSON structure. The file should contain a "verbs" array.');
                return;
            }
            
            verbsData = jsonData;
            fileStatus.textContent = `Successfully loaded ${jsonData.verbs.length} verbs!`;
            fileStatus.className = 'mt-4 text-sm text-green-600';
            fileStatus.classList.remove('hidden');
            
            // Move to appropriate setup screen
            uploadScreen.classList.add('hidden');
            if (currentGameMode === 'multiple-choice') {
                multipleChoiceSetup.classList.remove('hidden');
            } else if (currentGameMode === 'typing') {
                typingSetup.classList.remove('hidden');
            }
            
        } catch (error) {
            showError('Error parsing JSON file: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        showError('Error reading the file.');
    };
    
    reader.readAsText(file);
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

// Export shared functions and data
window.appData = {
    verbsData: () => verbsData,
    showError,
    showMainMenu,
    
    // NEW: Shared question limit
    minQuestions: 5,
    
    // NEW: Flexible validation for question count
    validateQuestionCount: function(questionCount) {
        if (questionCount < this.minQuestions) {
            this.showError(`Please select at least ${this.minQuestions} questions.`);
            return false;
        }
        return true;
    }
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
};