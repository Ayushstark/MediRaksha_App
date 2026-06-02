import jsonlines

def load_jsonl(file_path):
    """
    Load a JSON Lines (.jsonl) file and return a list of JSON objects.
    """
    data = []
    with jsonlines.open(file_path) as reader:
        for obj in reader:
            data.append(obj)
    return data

def extract_symptoms_and_diagnoses(data):
    """
    Extract symptom texts and diagnosis labels from loaded data.
    Symptoms are joined into a single string.
    """
    texts = []
    labels = []
    for record in data:
        # 'symptoms' is expected to be a list of strings
        symptom_list = record.get("symptoms", [])
        symptom_text = " ".join(symptom_list) if isinstance(symptom_list, list) else ""
        diagnosis = record.get("diagnosis", "")
        if symptom_text and diagnosis:
            texts.append(symptom_text)
            labels.append(diagnosis)
    return texts, labels

def load_and_prepare_jsonl(train_path, val_path, test_path):
    """
    Load train, validation, and test JSONL files and extract symptom texts and diagnoses.
    Returns tuples: (texts, labels) for each split.
    """
    train_data = load_jsonl(train_path)
    val_data = load_jsonl(val_path)
    test_data = load_jsonl(test_path)

    train_texts, train_labels = extract_symptoms_and_diagnoses(train_data)
    val_texts, val_labels = extract_symptoms_and_diagnoses(val_data)
    test_texts, test_labels = extract_symptoms_and_diagnoses(test_data)
    

    return (train_texts, train_labels), (val_texts, val_labels), (test_texts, test_labels)
