# train_model.py

from ML_Model.data_loader import load_and_prepare_jsonl
from ML_Model.tokenization import tokenize_texts
from ML_Model.dataset import SymptomDataset
from ML_Model.model import load_model
from ML_Model.train import train_model
from ML_Model.evaluate import evaluate_and_save, test_model
from sklearn.preprocessing import LabelEncoder
from collections import Counter
import random


def main():
    # === 1. Paths to dataset files ===
    train_path = 'Data/Raw/DDXPlus_English/release_train_patients/converted_train_patients.jsonl'
    val_path = 'Data/Raw/DDXPlus_English/release_validate_patients/converted_validate_patients.jsonl'
    test_path = 'Data/Raw/DDXPlus_English/release_test_patients/converted_test_patients.jsonl'

    # === 2. Load JSONL Data ===
    (train_texts, train_labels), (val_texts, val_labels), (test_texts, test_labels) = load_and_prepare_jsonl(
        train_path, val_path, test_path
    )

    print("\n Dataset Summary:")
    print(f"Loaded {len(train_texts)} training samples")
    print(f"Loaded {len(val_texts)} validation samples")
    print(f"Loaded {len(test_texts)} test samples")
    print(f"Type of train_texts: {type(train_texts)}")
    print(f"Sample train_texts[0]: {train_texts[0] if len(train_texts) > 0 else 'empty'}")

    # === 3. Shuffle dataset before subsampling ===
    combined = list(zip(train_texts, train_labels))
    random.shuffle(combined)
    train_texts, train_labels = zip(*combined)
    train_texts, train_labels = list(train_texts), list(train_labels)

    # === 4. (Optional) Subsample large dataset ===
    SAMPLE_SIZE = 50000  # Change this as needed or make it an argument
    if len(train_texts) > SAMPLE_SIZE:
        train_texts, train_labels = train_texts[10000:SAMPLE_SIZE], train_labels[10000:SAMPLE_SIZE]
        print(f"🔍 Using only first {SAMPLE_SIZE} samples for training")

    # === 5. Join text tokens if input is list of strings ===
    train_texts = [" ".join(t) if isinstance(t, list) else t for t in train_texts]
    val_texts = [" ".join(t) if isinstance(t, list) else t for t in val_texts]
    test_texts = [" ".join(t) if isinstance(t, list) else t for t in test_texts]

    # === 6. Print class distribution ===
    print(f"\n Label Distribution (train set, subsampled):")
    label_counts = Counter(train_labels)
    for label, count in label_counts.items():
        print(f"  - {label}: {count}")

    # === 7. Tokenize text inputs ===
    train_encodings, tokenizer = tokenize_texts(train_texts)
    val_encodings, _ = tokenize_texts(val_texts)
    test_encodings, _ = tokenize_texts(test_texts)

    # === 8. Encode labels using LabelEncoder ===
    label_encoder = LabelEncoder()
    label_encoder.fit(train_labels + val_labels + test_labels)  # all for consistency

    train_numeric_labels = label_encoder.transform(train_labels)
    val_numeric_labels = label_encoder.transform(val_labels)
    test_numeric_labels = label_encoder.transform(test_labels)

    # === 9. Wrap in PyTorch-compatible datasets ===
    train_dataset = SymptomDataset(train_encodings, train_numeric_labels)
    val_dataset = SymptomDataset(val_encodings, val_numeric_labels,)
    test_dataset = SymptomDataset(test_encodings, test_numeric_labels,)

    # === 10. Load model dynamically ===
    model = load_model(num_labels=len(label_encoder.classes_))

    # === 11. Call trainer (with training_args, compute_metrics happens in train.py) ===
    trainer = train_model(model, train_dataset, val_dataset, tokenizer, label_encoder)

    # === 12. Save model + tokenizer and run evaluation ===
    evaluate_and_save(trainer, model, tokenizer)
    print("Training complete and model saved!")

    # === 13. Test on held-out test set ===
    test_model(trainer, test_dataset, label_encoder)
    print("Testing complete and evaluation report printed!")


if __name__ == "__main__":
    main()
