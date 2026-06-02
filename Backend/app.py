# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import spacy

# app = Flask(__name__)
# CORS(app)  # Enable CORS

# nlp = spacy.load('en_core_web_sm')  # Load spaCy English model

# @app.route('/extract_entities', methods=['POST'])
# def extract_entities():
#     data = request.get_json()
#     text = data.get('text', '')
#     doc = nlp(text)
#     entities = [
#         {
#             'text': ent.text,
#             'start': ent.start_char,
#             'end': ent.end_char,
#             'label': ent.label_
#         }
#         for ent in doc.ents
#     ]
#     return jsonify({'entities': entities})

# @app.route('/symptom_intake', methods=['POST'])
# def symptom_intake():
#     data = request.get_json()
#     text = data.get('text', '')
#     if not text:
#         return jsonify({"error": "No text provided"}), 400

#     doc = nlp(text)
#     entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]

#     # Placeholder triage advice logic
#     triage_advice = "Please consult a doctor if symptoms persist."

#     return jsonify({
#         "input_text": text,
#         "entities": entities,
#         "triage_advice": triage_advice
#     })

# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=5000, debug=True)
    
