from transformers import BertTokenizer

def tokenize_texts(texts, max_length=128):
    """
    Tokenize symptom texts using BERT tokenizer with padding and truncation.
    """
    tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
    encodings = tokenizer(texts, truncation=True, padding=True, max_length=max_length, return_tensors=None)
    return encodings, tokenizer
 