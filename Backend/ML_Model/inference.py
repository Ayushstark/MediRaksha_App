from transformers import BertTokenizer, BertForSequenceClassification
import torch

def load_model_and_tokenizer(model_path):
    """
    Load the saved model and tokenizer from disk.
    """
    tokenizer = BertTokenizer.from_pretrained(model_path)
    model = BertForSequenceClassification.from_pretrained(model_path)
    model.eval()
    return model, tokenizer

def predict_disease(symptom_text, model, tokenizer, label_encoder):
    """
    Predict disease from symptom text using the trained model.
    """
    inputs = tokenizer(symptom_text, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    logits = outputs.logits
    predicted_class_id = torch.argmax(logits, dim=1).item()
    return label_encoder.inverse_transform([predicted_class_id])[0]
