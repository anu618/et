document.getElementById('scrapeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('url').value;
    
    try {
        const response = await fetch('/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `url=${encodeURIComponent(url)}`
        });
        const data = await response.json();
        alert(data.message);
    } catch (error) {
        alert('Error scraping content');
    }
});

document.getElementById('cleanBtn').addEventListener('click', async () => {
    try {
        const response = await fetch('/clean', {
            method: 'POST'
        });
        const data = await response.json();
        alert(data.message);
    } catch (error) {
        alert('Error processing files');
    }
});

function downloadDoc(type) {
    window.location.href = `/download/${type}`;
}

function toggleAdmin() {
    const adminSection = document.getElementById('adminSection');
    adminSection.style.display = adminSection.style.display === 'none' ? 'block' : 'none';
}

// Quiz functionality
let currentQuestionIndex = 0;
let questions = [];
let score = 0;
let quizResults = [];
let currentQuestionStartTime;
let wrongAnswers = [];

async function startQuiz() {
    try {
        const response = await fetch('/get_questions');
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load questions');
        }
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('No questions available. Please process some files first.');
        }
        
        questions = data;
        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        document.getElementById('exportBtn').style.display = 'none';
        displayQuestion();
        document.getElementById('quiz-container').style.display = 'block';
        updateProgress();
        currentQuestionStartTime = new Date();
    } catch (error) {
        console.error('Error details:', error);
        alert('Error: ' + error.message);
    }
}

function displayQuestion() {
    const question = questions[currentQuestionIndex];
    document.getElementById('question-number').textContent = `Question ${question.number}`;
    document.getElementById('question-text').textContent = question.content;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option' + (question.isMultiAnswer ? ' multi' : '');
        optionDiv.textContent = option.replace(/\s*\*\*\*Most Voted\*\*\*/, '');
        optionDiv.onclick = () => selectOption(index, question.isMultiAnswer);
        optionsContainer.appendChild(optionDiv);
    });
    
    // Reset feedback
    const feedbackDiv = document.getElementById('feedback-message');
    feedbackDiv.style.display = 'none';
    feedbackDiv.className = 'feedback-message';
    
    updateProgress();
}

function selectOption(index, isMultiAnswer) {
    const options = document.querySelectorAll('.option');
    if (isMultiAnswer) {
        options[index].classList.toggle('selected');
    } else {
        options.forEach(option => option.classList.remove('selected'));
        options[index].classList.add('selected');
    }
    
    const feedbackDiv = document.getElementById('feedback-message');
    feedbackDiv.style.display = 'none';
}

function checkAnswer() {
    const question = questions[currentQuestionIndex];
    const selectedOptions = Array.from(document.querySelectorAll('.option.selected'));
    const feedbackDiv = document.getElementById('feedback-message');
    
    if (selectedOptions.length === 0 || 
        (question.isMultiAnswer && selectedOptions.length < 2)) {
        feedbackDiv.textContent = question.isMultiAnswer ? 
            'Please select two answers' : 'Please select an answer';
        feedbackDiv.className = 'feedback-message feedback-incorrect';
        feedbackDiv.style.display = 'block';
        return;
    }
    
    const selectedIndices = selectedOptions.map(
        option => Array.from(document.querySelectorAll('.option')).indexOf(option)
    );
    
    // Check if answers match exactly
    const isCorrect = question.isMultiAnswer ?
        arraysEqual(selectedIndices.sort(), question.correctAnswers.sort()) :
        selectedIndices[0] === question.correctAnswers[0];
    
    if (!isCorrect) {
        // Record wrong answer with cleaned options
        wrongAnswers.push({
            'Question Number': question.number,
            'Question': question.content,
            'Your Answers': selectedIndices
                .map(index => question.options[index].replace(/\s*\*\*\*Most Voted\*\*\*/, ''))
                .join(', '),
            'Correct Answers': question.correctAnswers
                .map(index => question.options[index].replace(/\s*\*\*\*Most Voted\*\*\*/, ''))
                .join(', ')
        });
        
        // Show export button
        document.getElementById('exportBtn').style.display = 'inline-block';
    }
    
    // Remove any previous feedback styling
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('correct', 'incorrect');
    });
    
    // Mark each selected option as correct or incorrect individually
    selectedOptions.forEach(option => {
        const index = Array.from(document.querySelectorAll('.option')).indexOf(option);
        if (question.correctAnswers.includes(index)) {
            option.classList.add('correct');
        } else {
            option.classList.add('incorrect');
        }
    });
    
    // Also show any unselected correct answers
    question.correctAnswers.forEach(index => {
        const option = document.querySelectorAll('.option')[index];
        if (!option.classList.contains('selected')) {
            option.classList.add('correct');
        }
    });
    
    if (isCorrect) {
        score++;
        feedbackDiv.textContent = 'Correct! ✓';
        feedbackDiv.className = 'feedback-message feedback-correct';
    } else {
        const correctAnswerText = question.correctAnswers
            .map(index => question.options[index].replace(/\s*\*\*\*Most Voted\*\*\*/, ''))
            .join(' and ');
        feedbackDiv.textContent = `Incorrect. The correct answers are: ${correctAnswerText}`;
        feedbackDiv.className = 'feedback-message feedback-incorrect';
    }
    
    feedbackDiv.style.display = 'block';
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        currentQuestionStartTime = new Date();
        displayQuestion();
    } else {
        document.getElementById('exportBtn').style.display = 'block';
    }
}

function updateProgress() {
    document.getElementById('progress-text').textContent = 
        `${currentQuestionIndex + 1}/${questions.length}`;
    document.getElementById('score-text').textContent = 
        `${score}/${questions.length}`;
}

async function exportWrongAnswers() {
    if (wrongAnswers.length === 0) {
        alert('No wrong answers to export!');
        return;
    }
    
    try {
        const response = await fetch('/export_results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ results: wrongAnswers })
        });
        
        if (!response.ok) {
            throw new Error('Failed to export results');
        }
        
        // Get the blob from the response
        const blob = await response.blob();
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().slice(0,19).replace(/[:-]/g, '');
        const filename = `wrong_answers_${timestamp}.xlsx`;
        
        // Create a download link and trigger it
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting results: ' + error.message);
    }
}

// Helper function to compare arrays
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

async function generateAndDownload(docType) {
    try {
        // Generate the document
        const generateResponse = await fetch('/generate_doc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: docType })
        });

        if (!generateResponse.ok) {
            const error = await generateResponse.json();
            throw new Error(error.message || 'Failed to generate document');
        }

        // Download the generated document
        const downloadResponse = await fetch(`/download_doc/${docType}`);
        
        if (!downloadResponse.ok) {
            const error = await downloadResponse.json();
            throw new Error(error.message || 'Failed to download document');
        }

        // Create a blob from the response and trigger download
        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = docType === 'practice' ? 'practice_questions.docx' : 'questions_with_answers.docx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Document error:', error);
        alert('Error: ' + error.message);
    }
}
