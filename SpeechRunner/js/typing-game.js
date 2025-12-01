// Typing Game Module
class TypingGame {
    constructor() {
        this.currentQuestionIndex = 0;
        this.questions = [];
        this.responseTimes = [];
        this.missedQuestions = [];
        this.userTimes = JSON.parse(localStorage.getItem('typingHighScores')) || [];
        this.spaceKeyHandler = null; // Changed from enterKeyHandler

        // DOM elements
        this.setupScreen = document.getElementById('typing-setup');
        this.quizScreen = document.getElementById('typing-screen');
        this.startBtn = document.getElementById('start-typing');
        this.questionText = document.getElementById('typing-question-text');
        this.answerInput = document.getElementById('typing-answer-input');
        this.timerDisplay = document.getElementById('typing-timer');
        this.progressDisplay = document.getElementById('typing-progress');
        this.totalQuestionsSpan = document.getElementById('typing-total-questions');
        this.setupScreen = document.getElementById('typing-setup');

        // Event listeners
        this.startBtn.addEventListener('click', () => this.startQuiz());
        this.answerInput.addEventListener('keypress', (e) => this.handleEnterKey(e));
        this.initializeSpaceKeyHandler();

        // Special character buttons
        document.querySelectorAll('.special-char-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.answerInput.value += btn.dataset.char;
                this.answerInput.focus();
            });
        });
    }

    startQuiz() {
        const questionCount = parseInt(document.getElementById('typing-question-count').value);
        const selectedTenses = Array.from(document.querySelectorAll('.typing-tense-checkbox:checked'))
            .map(checkbox => checkbox.value);

        if (selectedTenses.length === 0) {
            window.appData.showError('Please select at least one tense to include in the quiz.');
            return;
        }

        // Use shared question count validation
        if (!window.appData.validateQuestionCount(questionCount)) {
            return;
        }

        this.questions = this.generateQuestions(questionCount, selectedTenses);
        this.responseTimes = [];
        this.missedQuestions = [];
        this.currentQuestionIndex = 0;

        this.setupScreen.classList.add('hidden');
        this.quizScreen.classList.remove('hidden');
        this.totalQuestionsSpan.textContent = this.questions.length;

        this.initializeSpaceKeyHandler();
        this.displayQuestion();
    }

    generateQuestions(count, tenses) {
        const allPossibleQuestions = [];
        const verbsData = window.appData.verbsData();

        verbsData.verbs.forEach(verb => {
            tenses.forEach(tense => {
                if (tense === 'infinitive') {
                    allPossibleQuestions.push({
                        type: 'infinitive',
                        english: verb.infinitive_english,
                        correctAnswer: verb.infinitive,
                        tense: 'infinitive'
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
                                verb: verb.infinitive
                            });
                        });
                    }
                }
            });
        });

        const shuffled = [...allPossibleQuestions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    displayQuestion() {
        const question = this.questions[this.currentQuestionIndex];
        this.progressDisplay.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}`;

        this.questionText.textContent = `"${question.english}"`;
        this.answerInput.value = '';
        this.answerInput.focus();

        this.questionStartTime = new Date();
    }

    handleEnterKey(event) {
        if (event.key === 'Enter') {
            this.checkAnswer();
        }
    }

    checkAnswer() {
        const userAnswer = this.answerInput.value.trim(); // Trim to remove any accidental spaces
        const question = this.questions[this.currentQuestionIndex];
        const isCorrect = userAnswer.toLowerCase() === question.correctAnswer.toLowerCase();

        const responseTime = (new Date() - this.questionStartTime) / 1000;
        this.responseTimes.push(responseTime);

        const averageTime = (this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length).toFixed(1);
        this.timerDisplay.textContent = `Avg: ${averageTime}s`;

        if (!isCorrect) {
            // Show immediate feedback for wrong answer
            this.showWrongAnswerFeedback(question.english, question.correctAnswer, userAnswer);

            // Add to missed questions for end of quiz
            this.missedQuestions.push({
                question: question.english,
                correctAnswer: question.correctAnswer,
                userAnswer: userAnswer
            });

            // Add question to retry queue to be asked again
            this.questions.push({ ...question });

            // Disable input until user acknowledges
            this.answerInput.disabled = true;

            // Set up SPACE key listener for proceeding (not Enter to avoid conflict)
            this.spaceKeyHandler = (e) => {
                if (e.code === 'Space') {
                    e.preventDefault(); // Prevent space from being inserted
                    this.hideWrongAnswerFeedback();
                    this.answerInput.disabled = false;
                    document.removeEventListener('keydown', this.spaceKeyHandler);

                    if (this.currentQuestionIndex < this.questions.length - 1) {
                        this.currentQuestionIndex++;
                        this.displayQuestion();
                    } else {
                        this.finishQuiz();
                    }
                }
            };

            document.addEventListener('keydown', this.spaceKeyHandler);
        } else {
            // Correct answer - speak and automatically proceed
            this.speakAnswer(question.correctAnswer);

            // Auto-proceed immediately for correct answers (no space key required)
            setTimeout(() => {
                if (this.currentQuestionIndex < this.questions.length - 1) {
                    this.currentQuestionIndex++;
                    this.displayQuestion();
                } else {
                    this.finishQuiz();
                }
            }, 100); // Brief delay to allow speech to start
        }
    }

    // Add these helper methods to the class:
    showWrongAnswerFeedback(question, correctAnswer, userAnswer) {
        // Create or show feedback element
        let feedbackEl = document.getElementById('wrong-answer-feedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.id = 'wrong-answer-feedback';
            feedbackEl.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
            feedbackEl.innerHTML = `
        <div class="bg-white rounded-xl p-8 mx-4 max-w-2xl w-full shadow-2xl">
            <div class="text-center">
                <div class="text-red-600 font-bold text-3xl mb-4">✗ Incorrect</div>
                <div class="text-xl mb-6 font-medium text-gray-800">"${question}"</div>
                <div class="space-y-3 text-lg">
                    <div class="text-gray-700">Your answer: <span class="text-red-600 font-semibold">${userAnswer}</span></div>
                    <div class="text-gray-700">Correct answer: <span class="text-green-600 font-semibold text-xl">${correctAnswer}</span></div>
                </div>
                <div class="mt-8 pt-4 border-t border-gray-200">
                    <button id="continue-btn" class="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition duration-200 mb-2">
                        Continue
                    </button>
                    <div class="text-sm text-gray-500">Or press <kbd class="px-2 py-1 bg-gray-200 rounded text-gray-700 font-mono">Space</kbd> to continue</div>
                </div>
            </div>
        </div>
    `;
            document.body.appendChild(feedbackEl);

            // Add event listener for the continue button
            document.getElementById('continue-btn').addEventListener('click', () => {
                this.proceedAfterWrongAnswer();
            });
        } else {
            feedbackEl.innerHTML = `
        <div class="bg-white rounded-xl p-8 mx-4 max-w-2xl w-full shadow-2xl">
            <div class="text-center">
                <div class="text-red-600 font-bold text-3xl mb-4">✗ Incorrect</div>
                <div class="text-xl mb-6 font-medium text-gray-800">"${question}"</div>
                <div class="space-y-3 text-lg">
                    <div class="text-gray-700">Your answer: <span class="text-red-600 font-semibold">${userAnswer}</span></div>
                    <div class="text-gray-700">Correct answer: <span class="text-green-600 font-semibold text-xl">${correctAnswer}</span></div>
                </div>
                <div class="mt-8 pt-4 border-t border-gray-200">
                    <button id="continue-btn" class="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition duration-200 mb-2">
                        Continue
                    </button>
                    <div class="text-sm text-gray-500">Or press <kbd class="px-2 py-1 bg-gray-200 rounded text-gray-700 font-mono">Space</kbd> to continue</div>
                </div>
            </div>
        </div>
    `;
            feedbackEl.classList.remove('hidden');

            // Re-add event listener for the continue button
            document.getElementById('continue-btn').addEventListener('click', () => {
                this.proceedAfterWrongAnswer();
            });
        }
    }

    hideWrongAnswerFeedback() {
        const feedbackEl = document.getElementById('wrong-answer-feedback');
        if (feedbackEl) {
            feedbackEl.classList.add('hidden');
        }
    }

    proceedAfterWrongAnswer() {
        this.hideWrongAnswerFeedback();
        this.answerInput.disabled = false;

        // Remove the space key listener
        if (this.spaceKeyHandler) {
            document.removeEventListener('keydown', this.spaceKeyHandler);
        }

        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
        } else {
            this.finishQuiz();
        }
    }

    // clean up event listeners
    cleanupEnterKeyListener() {
        if (this.enterKeyHandler) {
            document.removeEventListener('keydown', this.enterKeyHandler);
            this.enterKeyHandler = null;
        }
    }

    speakAnswer(text) {
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'it-IT';
            utterance.rate = 0.9;
            speechSynthesis.speak(utterance);
        }
    }

    finishQuiz() {
        const averageTime = (this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length).toFixed(1);

        // Update name screen
        document.getElementById('final-time').textContent = `${averageTime}s`;
        document.getElementById('total-questions-completed').textContent = this.questions.length;
        document.getElementById('name-screen-title').textContent = 'Typing Challenge Complete!';

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
            gameMode: 'typing'
        });

        this.userTimes.sort((a, b) => a.averageTime - b.averageTime);
        this.userTimes = this.userTimes.slice(0, 10);

        localStorage.setItem('typingHighScores', JSON.stringify(this.userTimes));

        document.getElementById('name-screen').classList.add('hidden');
        this.displayLeaderboard();
    }

    displayLeaderboard() {
        const topTimesList = document.getElementById('top-times');
        const leaderboardTitle = document.getElementById('leaderboard-title');
        const resultsTitle = document.getElementById('results-screen-title');

        leaderboardTitle.textContent = 'Typing Challenge - Top Scores (Average Response Time)';
        resultsTitle.textContent = 'Typing Challenge Leaderboard';

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

    initializeSpaceKeyHandler() {
        // Remove any existing handler first
        if (this.spaceKeyHandler) {
            document.removeEventListener('keydown', this.spaceKeyHandler);
        }

        this.spaceKeyHandler = (e) => {
            // Only handle space key if wrong answer feedback is visible
            const wrongAnswerFeedback = document.getElementById('wrong-answer-feedback');
            if (e.code === 'Space' &&
                wrongAnswerFeedback &&
                !wrongAnswerFeedback.classList.contains('hidden')) {
                e.preventDefault();
                this.proceedAfterWrongAnswer();
            }
        };

        document.addEventListener('keydown', this.spaceKeyHandler);
    }
}

// Initialize typing game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TypingGame();
});