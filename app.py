from flask import Flask, render_template, request, send_file, jsonify
import os
from docx_generator import create_practice_document, create_answer_key_document, parse_question, clean_special_characters, format_cleaned_question, create_snowpro_core_with_answers
import pandas as pd
from datetime import datetime

app = Flask(__name__)

# Configure folders
INPUT_FOLDER = 'inputs'
OUT_RAWTXT = 'out_rawtxt'
OUT_DOCS = 'out_docs'

# Create all necessary folders
os.makedirs(INPUT_FOLDER, exist_ok=True)
os.makedirs(OUT_RAWTXT, exist_ok=True)
os.makedirs(OUT_DOCS, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scrape', methods=['POST'])
def scrape():
    url = request.form.get('url')
    try:
        output_file = os.path.join(OUT_RAWTXT, 'scraped_content.txt')
        # scraping logic will be implemented later
        return jsonify({'status': 'success', 'message': 'Scraping feature coming soon!'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/clean', methods=['POST'])
def clean():
    try:
        # Get list of files in inputs folder
        input_files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith('.txt')]
        
        if not input_files:
            return jsonify({'status': 'error', 'message': 'No text files found in inputs folder'})
        
        for input_file in input_files:
            file_base_name = os.path.splitext(input_file)[0]
            input_path = os.path.join(INPUT_FOLDER, input_file)
            
            # Generate output paths
            practice_doc = os.path.join(OUT_DOCS, f'{file_base_name}_practice.docx')
            answer_key_doc = os.path.join(OUT_DOCS, f'{file_base_name}_with_answers.docx')

            # Generate documents
            create_practice_document(input_path, practice_doc)
            create_answer_key_document(input_path, answer_key_doc)
        
        return jsonify({'status': 'success', 'message': 'Files processed successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/generate_doc', methods=['POST'])
def generate_doc():
    try:
        doc_type = request.json.get('type')
        
        # Get all text files from inputs folder
        input_files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith('.txt')]
        
        if not input_files:
            return jsonify({
                'status': 'error',
                'message': 'No .txt files found in inputs folder'
            }), 404
        
        # Use the first file found
        input_file = os.path.join(INPUT_FOLDER, input_files[0])
        print(f"Using input file: {input_file}")  # Debug log
        
        # Generate timestamp for unique filenames
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        try:
            if doc_type == 'practice':
                output_file = os.path.join(OUT_DOCS, f'practice_questions_{timestamp}.docx')
                create_practice_document(input_file, output_file)
                app.config['LATEST_PRACTICE_DOC'] = output_file
                print(f"Practice document generated: {output_file}")  # Debug log
                
            elif doc_type == 'answers':
                output_file = os.path.join(OUT_DOCS, f'questions_with_answers_{timestamp}.docx')
                create_answer_key_document(input_file, output_file)
                app.config['LATEST_ANSWERS_DOC'] = output_file
                print(f"Answer key document generated: {output_file}")  # Debug log
                
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid document type requested'
                }), 400
                
        except Exception as doc_error:
            print(f"Error generating document: {str(doc_error)}")  # Debug log
            return jsonify({
                'status': 'error',
                'message': f'Error generating document: {str(doc_error)}'
            }), 500
            
        return jsonify({
            'status': 'success',
            'message': 'Document generated successfully',
            'file': output_file
        })
        
    except Exception as e:
        print(f"Unexpected error: {str(e)}")  # Debug log
        return jsonify({
            'status': 'error',
            'message': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/download_doc/<doc_type>')
def download_doc(doc_type):
    try:
        if doc_type == 'practice':
            filepath = app.config.get('LATEST_PRACTICE_DOC')
            filename = 'practice_questions.docx'
        elif doc_type == 'answers':
            filepath = app.config.get('LATEST_ANSWERS_DOC')
            filename = 'questions_with_answers.docx'
        else:
            return jsonify({
                'status': 'error',
                'message': 'Invalid document type'
            }), 400
            
        if not filepath or not os.path.exists(filepath):
            return jsonify({
                'status': 'error',
                'message': 'Document not found. Please generate it first.'
            }), 404
            
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/get_questions')
def get_questions():
    try:
        # Get the most recent file from inputs folder
        input_files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith('.txt')]
        
        if not input_files:
            return jsonify({'error': 'No .txt files found in inputs folder'}), 404
            
        # Use the first file found
        input_file = os.path.join(INPUT_FOLDER, input_files[0])
        
        with open(input_file, 'r', encoding='utf-8', errors='replace') as file:
            content = file.read()
        
        # Split into questions
        questions = []
        raw_questions = content.split('###################################################################')
        
        for raw_question in raw_questions:
            if not raw_question.strip():
                continue
                
            question_data = parse_question(raw_question)
            if not question_data:
                continue
                
            # Format question for quiz
            quiz_question = {
                'number': question_data['number'],
                'content': question_data['content'],
                'options': [clean_special_characters(opt) for opt in question_data['options']],
                'correctAnswers': [ord(ans) - ord('A') for ans in question_data['correct']],  # List of correct indices
                'isMultiAnswer': len(question_data['correct']) > 1  # Flag for multi-answer questions
            }
            
            # Only add questions that have valid data
            if quiz_question['correctAnswers'] and quiz_question['options']:
                questions.append(quiz_question)
        
        if not questions:
            return jsonify({'error': 'No valid questions found in the input file'}), 404
            
        return jsonify(questions)
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error loading questions: {str(e)}\n{error_details}")
        return jsonify({'error': f'Error loading questions: {str(e)}'}), 500

@app.route('/export_results', methods=['POST'])
def export_results():
    try:
        data = request.json
        results = data.get('results', [])
        
        if not results:
            return jsonify({'error': 'No results to export'}), 400
            
        # Create DataFrame
        df = pd.DataFrame(results)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'wrong_answers_{timestamp}.xlsx'
        filepath = os.path.join(OUT_DOCS, filename)
        
        # Create Excel writer
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            # Write results
            df.to_excel(writer, sheet_name='Wrong Answers', index=False)
            
            # Auto-adjust columns width
            worksheet = writer.sheets['Wrong Answers']
            for idx, col in enumerate(df.columns):
                max_length = max(
                    df[col].astype(str).apply(len).max(),
                    len(col)
                ) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = max_length
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/process_files', methods=['POST'])
def process_files():
    try:
        # Get all files from input folder
        input_files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith('.txt')]
        
        if not input_files:
            return jsonify({
                'status': 'error',
                'message': 'No .txt files found in inputs folder'
            }), 404
            
        processed_count = 0
        for input_file in input_files:
            input_path = os.path.join(INPUT_FOLDER, input_file)
            output_path = os.path.join(OUT_RAWTXT, f'processed_{input_file}')
            
            with open(input_path, 'r', encoding='utf-8', errors='replace') as file:
                content = file.read()
                
            # Split into questions
            questions = content.split('###################################################################')
            
            processed_content = []
            for question_text in questions:
                if not question_text.strip():
                    continue
                    
                # Parse and clean the question
                question_data = parse_question(question_text)
                if not question_data:
                    continue
                    
                # Format the cleaned question
                cleaned_question = format_cleaned_question(question_data)
                processed_content.append(cleaned_question)
            
            # Write processed content
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write('\n###################################################################\n'.join(processed_content))
                
            processed_count += 1
            
        # Generate the Snowpro Core document with answers
        create_snowpro_core_with_answers(input_path, os.path.join(OUT_DOCS, 'snowpro-core_with_answers.docx'))
        
        return jsonify({
            'status': 'success',
            'message': f'Successfully processed {processed_count} files and generated answers document.'
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/generate_questions_with_answers', methods=['POST'])
def generate_questions_with_answers():
    # Check if the snowpro-core_with_answers.docx already exists
    existing_file = os.path.join(OUT_DOCS, 'snowpro-core_with_answers.docx')
    
    if os.path.exists(existing_file):
        return send_file(existing_file, as_attachment=True)
    
    # If it doesn't exist, generate it
    # Call the function that generates the document
    input_file = os.path.join(INPUT_FOLDER, 'your_input_file.txt')  # Adjust as necessary
    create_snowpro_core_with_answers(input_file, existing_file)
    
    return send_file(existing_file, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
