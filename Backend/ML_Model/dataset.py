import torch

class SymptomDataset(torch.utils.data.Dataset):
    """
    PyTorch Dataset class to return tokenized inputs and numeric labels.
    """
    # NEW
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels  # Already transformed (numeric)
  # Convert labels to numeric IDs

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx])
        return item
