from transformers import BertForSequenceClassification

def load_model(num_labels):
    """
    Load pre-trained BERT model with a classification head for 'num_labels' classes.
    """
    model = BertForSequenceClassification.from_pretrained('bert-base-uncased', num_labels=num_labels)
    return model
