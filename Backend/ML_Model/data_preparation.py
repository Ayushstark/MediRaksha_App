import pandas as pd
from sklearn.model_selection import train_test_split

def load_and_prepare_data(csv_path):
    """
    Load the dataset CSV, clean missing data, and split into train/test sets.
    """
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=['symptoms_text', 'diagnosis'])  # Remove rows missing key info

    train_texts, test_texts, train_labels, test_labels = train_test_split(
        df['symptoms_text'].tolist(),
        df['diagnosis'].tolist(),
        test_size=0.2,
        random_state=42
    )
    return train_texts, test_texts, train_labels, test_labels
