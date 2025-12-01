// Multiple Choice Game Module
class MultipleChoiceGame {
    constructor() {
        this.currentQuestionIndex = 0;
        this.questions = [];
        this.responseTimes = [];
        this.missedQuestions = [];
        this.userTimes = JSON.parse(localStorage.getItem('multipleChoiceHighScores')) || [];
        this.currentGameMode = 'standard';

        // DOM elements
        this.setupScreen = document.getElementById('multiple-choice-setup');
        this.quizScreen = document.getElementById('multiple-choice-screen');
        this.startBtn = document.getElementById('start-multiple-choice');
        this.questionText = document.getElementById('multiple-choice-question-text');
        this.optionsContainer = document.getElementById('multiple-choice-options-container');
        this.timerDisplay = document.getElementById('multiple-choice-timer');
        this.progressDisplay = document.getElementById('multiple-choice-progress');
        this.totalQuestionsSpan = document.getElementById('multiple-choice-total-questions');
        this.speakBtn = document.getElementById('multiple-choice-speak-question');

        this.startBtn.addEventListener('click', () => this.startQuiz());
        this.speakBtn.addEventListener('click', () => this.speakQuestion());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    startQuiz() {
        const questionCount = parseInt(document.getElementById('question-count').value);
        const selectedTenses = Array.from(document.querySelectorAll('.tense-checkbox:checked'))
            .map(checkbox => checkbox.value);

        // Get the selected game mode
        const gameMode = document.querySelector('input[name="game-mode"]:checked').value;
        this.currentGameMode = gameMode; // Store the game mode

        if (selectedTenses.length === 0) {
            window.appData.showError('Please select at least one tense to include in the quiz.');
            return;
        }

        if (!window.appData.validateQuestionCount(questionCount)) {
            return;
        }

        this.questions = this.generateQuestions(questionCount, selectedTenses, gameMode);
        this.responseTimes = [];
        this.missedQuestions = [];
        this.currentQuestionIndex = 0;
        this.correctAnswers = 0;

        this.setupScreen.classList.add('hidden');
        this.quizScreen.classList.remove('hidden');
        this.totalQuestionsSpan.textContent = this.questions.length;

        this.displayQuestion();
    }

    generateQuestions(count, tenses, gameMode) {
        const allPossibleQuestions = [];
        const verbsData = window.appData.verbsData();
        const questions = [];

        // Generate all possible questions based on selected tenses
        verbsData.verbs.forEach(verb => {
            tenses.forEach(tense => {
                if (tense === 'infinitive') {
                    allPossibleQuestions.push({
                        type: 'infinitive',
                        english: verb.infinitive_english,
                        correctAnswer: verb.infinitive,
                        tense: 'infinitive',
                        verb: verb
                    });
                } else {
                    const tenseData = verb.tenses[tense];
                    if (tenseData && tenseData.forms) {
                        Object.keys(tenseData.forms).forEach(person => {
                            const formData = tenseData.forms[person];
                            allPossibleQuestions.push({
                                type: 'conjugation',
                                english: formData.english,
                                correctAnswer: formData.form,
                                tense: tense,
                                person: person,
                                verb: verb
                            });
                        });
                    }
                }
            });
        });

        const shuffled = [...allPossibleQuestions].sort(() => 0.5 - Math.random());

        for (let i = 0; i < Math.min(count, shuffled.length); i++) {
            const question = shuffled[i];

            if (gameMode === 'verb-forms') {
                // For verb-forms mode, generate answers from the same verb
                question.options = this.generateVerbFormOptions(question, allPossibleQuestions);
            } else {
                // Standard mode - generate options
                question.options = this.generateStandardOptionsForQuestion(question, allPossibleQuestions);
            }

            questions.push(question);
        }

        return questions;
    }

    generateVerbFormOptions(correctQuestion, allQuestions) {
        const options = [];
        const correctVerb = correctQuestion.verb;

        // Start with the correct answer (ENGLISH translation)
        options.push({
            text: correctQuestion.correctAnswer, // Italian form
            english: correctQuestion.english,    // English translation
            isCorrect: true
        });

        // Get all other forms of the same verb (excluding the correct one)
        const sameVerbForms = allQuestions.filter(q =>
            q.verb === correctVerb &&
            q.english !== correctQuestion.english
        );

        // Shuffle and pick 5 random forms from the same verb
        const shuffledForms = [...sameVerbForms].sort(() => 0.5 - Math.random());
        const selectedForms = shuffledForms.slice(0, 5);

        // Add the selected forms as incorrect options (ENGLISH translations)
        selectedForms.forEach(form => {
            options.push({
                text: form.correctAnswer,     // Italian form
                english: form.english,        // English translation  
                isCorrect: false
            });
        });

        // If we don't have enough forms from the same verb, fill with random forms
        if (options.length < 6) {
            const randomForms = allQuestions.filter(q =>
                q.verb !== correctVerb &&
                !options.some(opt => opt.english === q.english)
            ).sort(() => 0.5 - Math.random())
                .slice(0, 6 - options.length);

            randomForms.forEach(form => {
                options.push({
                    text: form.correctAnswer,
                    english: form.english,
                    isCorrect: false
                });
            });
        }

        // Shuffle the options so correct answer isn't always first
        return options.sort(() => 0.5 - Math.random());
    }

    generateStandardOptionsForQuestion(question, allPossibleQuestions) {
        // Standard mode: English options for Italian question
        const options = [{
            text: question.english,
            isCorrect: true,
            english: question.english
        }];

        // Get 5 random incorrect English translations
        const incorrectOptions = allPossibleQuestions
            .filter(q => q.english !== question.english)
            .sort(() => 0.5 - Math.random())
            .slice(0, 5)
            .map(q => ({
                text: q.english,
                isCorrect: false,
                english: q.english
            }));

        options.push(...incorrectOptions);
        return options.sort(() => 0.5 - Math.random());
    }

    displayQuestion() {
        this.removeRetryMessage();
        const question = this.questions[this.currentQuestionIndex];
        this.progressDisplay.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}`;

        // FIX: Ensure we have a valid question
        if (!question) {
            console.error('Invalid question at index:', this.currentQuestionIndex);
            if (this.currentQuestionIndex < this.questions.length - 1) {
                this.currentQuestionIndex++;
                this.displayQuestion();
                return;
            } else {
                this.finishQuiz();
                return;
            }
        }

        // BOTH MODES show Italian question - FIXED
        this.questionText.textContent = `"${question.correctAnswer}"`;

        // Get options - FIXED: Show English options for both modes
        let options;
        if (this.currentGameMode === 'verb-forms' && question.options) {
            // Verb-forms mode: English options (different translations of same verb)
            options = question.options.map(opt => opt.english || opt.text || opt);
        } else if (question.options) {
            // Standard mode: English options (random translations)
            options = question.options.map(opt => opt.english || opt.text || opt);
        } else {
            // Fallback
            options = [question.english];
        }

        this.optionsContainer.innerHTML = '';

        options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'w-full text-left p-4 border border-gray-300 rounded-md hover:bg-gray-100 transition duration-200 flex items-start';
            button.innerHTML = `
            <span class="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center mr-3 flex-shrink-0">${index + 1}</span>
            <span>${option}</span>
        `;
            button.dataset.answer = option;
            button.addEventListener('click', () => this.selectAnswer(button));
            this.optionsContainer.appendChild(button);
        });

        this.questionStartTime = new Date();
        this.speakQuestion();
    }

    getAllEnglishTranslations() {
        const verbsData = window.appData.verbsData();
        const translations = [];

        verbsData.verbs.forEach(verb => {
            // FIX: Handle infinitive_english which might now be an array
            if (Array.isArray(verb.infinitive_english)) {
                translations.push(...verb.infinitive_english);
            } else {
                translations.push(verb.infinitive_english);
            }

            Object.values(verb.tenses).forEach(tense => {
                if (tense.forms) {
                    Object.values(tense.forms).forEach(form => {
                        // FIX: Handle form.english which might now be an array
                        if (Array.isArray(form.english)) {
                            translations.push(...form.english);
                        } else {
                            translations.push(form.english);
                        }
                    });
                }
            });
        });

        return [...new Set(translations)];
    }

    handleKeyPress(event) {
        if (this.quizScreen.classList.contains('hidden')) return;

        const key = event.key;
        if (key >= '1' && key <= '6') {
            const optionIndex = parseInt(key) - 1;
            const options = this.optionsContainer.querySelectorAll('button');

            if (optionIndex < options.length) {
                this.selectAnswer(options[optionIndex]);
            }
        }
    }

    selectAnswer(button) {
        const selectedAnswer = button.dataset.answer;
        const question = this.questions[this.currentQuestionIndex];

        let isCorrect = false;

        // BOTH MODES: Check if selected English answer matches question.english
        // Handle both single and array versions of english translation
        // In selectAnswer - better array handling:
        if (Array.isArray(question.english)) {
            // Check if selected answer matches any of the array elements
            // Also check if it matches the comma-joined version
            const commaJoined = question.english.join(",");
            isCorrect = question.english.some(eng => eng === selectedAnswer) ||
                selectedAnswer === commaJoined;
        } else {
            isCorrect = selectedAnswer === question.english;
        }

        // DEBUG: Log what's happening
        console.log('Selected:', selectedAnswer);
        console.log('Correct English:', question.english);
        console.log('Is correct?', isCorrect);

        const responseTime = (new Date() - this.questionStartTime) / 1000;

        const allButtons = this.optionsContainer.querySelectorAll('button');
        allButtons.forEach(btn => {
            btn.disabled = true;
        });

        if (!isCorrect) {
            // Track wrong answers immediately
            const correctAnswerText = Array.isArray(question.english)
                ? question.english.join(" / ")
                : question.english;

            this.missedQuestions.push({
                question: question.correctAnswer,
                correctAnswer: correctAnswerText,
                userAnswer: selectedAnswer,
                timestamp: new Date().toISOString()
            });

            button.classList.add('bg-red-100', 'border-red-500', 'text-red-800');

            const questionContainer = document.getElementById('multiple-choice-question-container');
            questionContainer.classList.add('shake-animation');

            setTimeout(() => {
                questionContainer.classList.remove('shake-animation');
                allButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('bg-red-100', 'border-red-500', 'text-red-800');
                });
            }, 600);

        } else {
            this.responseTimes.push(responseTime);
            const averageTime = (this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length).toFixed(1);
            this.timerDisplay.textContent = `Avg: ${averageTime}s`;

            button.classList.add('bg-green-100', 'border-green-500', 'text-green-800');

            setTimeout(() => {
                if (this.currentQuestionIndex < this.questions.length - 1) {
                    this.currentQuestionIndex++;
                    this.displayQuestion();
                } else {
                    this.finishQuiz();
                }
            }, 800);
        }
    }

    // ADD this new method to show retry message
    showRetryMessage() {
        // Remove any existing retry message
        const existingMessage = document.getElementById('retry-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create retry message
        const retryMessage = document.createElement('div');
        retryMessage.id = 'retry-message';
        retryMessage.className = 'text-center mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded-md text-yellow-800 font-semibold animate-pulse';
        retryMessage.innerHTML = '✗ Try again! Select the correct answer to continue.';

        this.optionsContainer.parentNode.insertBefore(retryMessage, this.optionsContainer.nextSibling);

        // Remove pulse animations from buttons after a short time
        setTimeout(() => {
            const buttons = this.optionsContainer.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.classList.remove('pulse-animation');
            });
        }, 2000);
    }

    // ADD this method to remove retry message when moving to next question
    removeRetryMessage() {
        const retryMessage = document.getElementById('retry-message');
        if (retryMessage) {
            retryMessage.remove();
        }
    }

    // ADD this new method for wrong answer feedback:
    showWrongAnswerFeedback(question, userAnswer) {
        const questionText = this.currentGameMode === 'verb-forms' ? question.english : question.correctAnswer;
        const correctAnswer = Array.isArray(question.correctAnswer)
            ? question.correctAnswer.join(" / ")
            : question.correctAnswer;

        // Create feedback element
        let feedbackEl = document.getElementById('multiple-choice-wrong-feedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.id = 'multiple-choice-wrong-feedback';
            feedbackEl.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
            document.body.appendChild(feedbackEl);
        }

        feedbackEl.innerHTML = `
        <div class="bg-white rounded-xl p-8 mx-4 max-w-2xl w-full shadow-2xl">
            <div class="text-center">
                <div class="text-red-600 font-bold text-3xl mb-4">✗ Incorrect</div>
                <div class="text-xl mb-6 font-medium text-gray-800">"${questionText}"</div>
                <div class="space-y-3 text-lg">
                    <div class="text-gray-700">Your answer: <span class="text-red-600 font-semibold">${userAnswer}</span></div>
                    <div class="text-gray-700">Correct answer: <span class="text-green-600 font-semibold text-xl">${correctAnswer}</span></div>
                </div>
                <div class="mt-8 pt-4 border-t border-gray-200">
                    <div class="text-sm text-gray-500">Continuing in 1 second...</div>
                </div>
            </div>
        </div>
    `;

        // Auto-hide after 1.5 seconds
        setTimeout(() => {
            feedbackEl.remove();
        }, 1500);
    }

    speakQuestion() {
        const question = this.questions[this.currentQuestionIndex];
        // FIXED: Use correctAnswer instead of question.verb/question.form
        let textToSpeak = question.correctAnswer;

        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.lang = 'it-IT';
            utterance.rate = 0.9;
            speechSynthesis.speak(utterance);
        }
    }

    finishQuiz() {
        const averageTime = (this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length).toFixed(1);

        const uniqueMissedQuestions = [];
        const seenQuestions = new Set();

        this.missedQuestions.forEach(missed => {
            const key = `${missed.question}-${missed.correctAnswer}`;
            if (!seenQuestions.has(key)) {
                seenQuestions.add(key);
                uniqueMissedQuestions.push(missed);
            }
        });

        this.missedQuestions = uniqueMissedQuestions;


        // Update name screen
        document.getElementById('final-time').textContent = `${averageTime}s`;
        document.getElementById('total-questions-completed').textContent = this.questions.length;
        document.getElementById('name-screen-title').textContent = 'Multiple Choice Quiz Complete!';

        // Show missed questions if any
        const missedQuestionsDiv = document.getElementById('missed-questions');
        const missedQuestionsList = document.getElementById('missed-questions-list');

        if (this.missedQuestions.length > 0) {
            missedQuestionsList.innerHTML = '';
            this.missedQuestions.forEach(missed => {
                const item = document.createElement('div');
                item.className = 'p-3 border border-red-200 rounded-md bg-red-50';
                item.innerHTML = `
                    <div class="font-semibold">${missed.question}</div>
                    <div class="text-sm text-gray-600">Your answer: <span class="text-red-600">${missed.userAnswer}</span></div>
                    <div class="text-sm text-gray-600">Correct answer: <span class="text-green-600">${missed.correctAnswer}</span></div>
                `;
                missedQuestionsList.appendChild(item);
            });
            missedQuestionsDiv.classList.remove('hidden');
        } else {
            missedQuestionsDiv.classList.add('hidden');
        }

        // Check if new record
        const isNewRecord = this.userTimes.length < 5 || averageTime < this.userTimes[this.userTimes.length - 1].averageTime;
        if (isNewRecord) {
            document.getElementById('new-record').classList.remove('hidden');
        }

        this.quizScreen.classList.add('hidden');
        document.getElementById('name-screen').classList.remove('hidden');

        // Set up save score handler
        document.getElementById('save-score').onclick = () => this.saveScore(averageTime);
    }

    saveScore(averageTime) {
        const userName = document.getElementById('user-name').value.trim();
        const questionCount = this.questions.length;

        if (!userName) {
            window.appData.showError('Please enter your name.');
            return;
        }

        this.userTimes.push({
            name: userName,
            averageTime: parseFloat(averageTime),
            questionCount: questionCount,
            date: new Date().toISOString().split('T')[0],
            gameMode: 'multiple-choice'
        });

        this.userTimes.sort((a, b) => a.averageTime - b.averageTime);
        this.userTimes = this.userTimes.slice(0, 10);

        localStorage.setItem('multipleChoiceHighScores', JSON.stringify(this.userTimes));

        document.getElementById('name-screen').classList.add('hidden');
        this.displayLeaderboard();
    }

    displayLeaderboard() {
        const topTimesList = document.getElementById('top-times');
        const leaderboardTitle = document.getElementById('leaderboard-title');
        const resultsTitle = document.getElementById('results-screen-title');

        leaderboardTitle.textContent = 'Multiple Choice - Top Scores (Average Response Time)';
        resultsTitle.textContent = 'Multiple Choice Leaderboard';

        topTimesList.innerHTML = '';

        if (this.userTimes.length === 0) {
            topTimesList.innerHTML = '<li class="text-center text-gray-500 py-4">No scores yet. Be the first!</li>';
        } else {
            this.userTimes.forEach((score, index) => {
                const listItem = document.createElement('li');
                listItem.className = 'flex justify-between items-center p-3 border-b border-gray-200';
                listItem.innerHTML = `
                    <div class="flex items-center">
                        <span class="font-bold w-6">${index + 1}.</span>
                        <span class="ml-2">${score.name}</span>
                    </div>
                    <div class="text-right">
                        <div class="font-semibold">${score.averageTime}s</div>
                        <div class="text-sm text-gray-500">${score.questionCount} questions • ${score.date}</div>
                    </div>
                `;
                topTimesList.appendChild(listItem);
            });
        }

        document.getElementById('results-screen').classList.remove('hidden');
    }
}

// Initialize multiple choice game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MultipleChoiceGame();
});