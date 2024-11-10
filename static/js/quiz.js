let quizData = [];
let currentQuestion = 0;
let userAnswers = [];

// Override the default alert behavior
window.alert = function(message) {
    showFeedback(false, message);
};

// Handle fetch responses without popups
async function loadQuizData() {
    try {
        const response = await fetch('/get_quiz_data');
        if (!response.ok) {
            showFeedback(false, 'Error loading quiz data');
            return;
        }
        quizData = await response.json();
        showQuestion();
        updateProgress();
    } catch (error) {
        showFeedback(false, 'Error loading quiz data');
    }
}

function showQuestion() {
    const question = quizData[currentQuestion];
    document.getElementById('question').innerHTML = `
        <h2>Question ${currentQuestion + 1}</h2>
        <p>${question.content}</p>
    `;
    
    const optionsHtml = question.options.map((option, index) => `
        <div class="option">
            <input type="radio" name="answer" value="${index}" 
                   ${userAnswers[currentQuestion] === index ? 'checked' : ''}>
            <label>${option}</label>
        </div>
    `).join('');
    
    document.getElementById('options').innerHTML = optionsHtml;
}

function checkAnswer(selectedOption) {
    // ... existing code ...
    
    if (selectedOption === correctAnswer) {
        showFeedback(true, "Correct!");
    } else {
        // Modified feedback message to be simpler
        showFeedback(false, `Incorrect. The correct answer is: ${correctAnswer}`);
    }
    
    // Remove any existing "Most Voted" text from the options
    updateOptionsDisplay();
}

function showFeedback(isCorrect, message) {
    const feedbackDiv = document.getElementById('answer-feedback');
    const feedbackText = document.getElementById('feedback-text');
    
    feedbackDiv.style.display = 'block';
    feedbackDiv.className = 'answer-feedback ' + (isCorrect ? 'correct' : 'incorrect');
    feedbackText.textContent = message;
    
    // Optional: Hide feedback after a few seconds
    setTimeout(() => {
        feedbackDiv.style.display = 'none';
    }, 3000);
}

function updateOptionsDisplay() {
    // Remove "Most Voted" text from all options
    const options = document.querySelectorAll('.quiz-options div');
    options.forEach(option => {
        option.textContent = option.textContent.replace(/\s*\*\*\*Most Voted\*\*\*/, '');
    });
}

// Call this when loading questions to ensure "Most Voted" is removed
function displayQuestion(question) {
    // ... existing code ...
    
    // Remove "Most Voted" from options when displaying
    updateOptionsDisplay();
}

// Add more quiz functionality (navigation, scoring, etc.)

function submitAnswer() {
    const selectedOption = document.querySelector('input[name="answer"]:checked');
    if (!selectedOption) {
        // Instead of alert, show inline message
        showFeedback(false, "Please select an answer");
        return;
    }

    const answer = parseInt(selectedOption.value);
    userAnswers[currentQuestion] = answer;

    // Get correct answer from quizData
    const correctAnswer = quizData[currentQuestion].correct_answer;

    if (answer === correctAnswer) {
        showFeedback(true, "Correct!");
    } else {
        const correctOptionText = quizData[currentQuestion].options[correctAnswer];
        showFeedback(false, `Incorrect. The correct answer is: ${correctOptionText}`);
    }

    // Disable the options after answering
    document.querySelectorAll('input[name="answer"]').forEach(input => {
        input.disabled = true;
    });

    // Update progress
    updateProgress();
}

// Add event listener for the submit button
document.addEventListener('DOMContentLoaded', function() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitAnswer);
    }
});

// Prevent default form submission if it exists
document.addEventListener('submit', function(e) {
    e.preventDefault();
    return false;
});
