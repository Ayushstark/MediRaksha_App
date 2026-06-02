from transformers.trainer import Trainer
from transformers.training_args import TrainingArguments
from sklearn.metrics import accuracy_score, f1_score

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = logits.argmax(axis=-1)
    acc = accuracy_score(labels, predictions)
    f1 = f1_score(labels, predictions, average='weighted')
    return {'accuracy': acc, 'f1': f1}

def train_model(model, train_dataset, val_dataset, tokenizer=None, label_encoder=None):
    training_args = TrainingArguments(
        output_dir='./results',
        num_train_epochs=5,                   # Increased for better convergence
        per_device_train_batch_size=32,      # Adjusted to avoid OOM; tune per your GPU
        per_device_eval_batch_size=32,
        gradient_accumulation_steps=4,       # Simulate larger batch size
        eval_strategy='steps',
        eval_steps=500,                      # Evaluate more frequently for better monitoring
        logging_steps=250,
        save_steps=500,
        save_total_limit=2,
        learning_rate=2e-5,                  # Recommended LR for fine-tuning BERT
        weight_decay=0.01,
        warmup_steps=500,                   # Helps stabilize early training
        fp16=True,                         # Enable mixed precision if GPU supports it
        dataloader_num_workers=4,
        load_best_model_at_end=True,
        metric_for_best_model='f1',
        greater_is_better=True,
        report_to='none',
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics
    )

    trainer.train()
    return trainer
