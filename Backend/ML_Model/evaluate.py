from sklearn.metrics import classification_report

def evaluate_and_save(trainer, model, tokenizer, save_path='./ddxplus-bert-model'):
    """
    Evaluate the model on the validation set and save the model and tokenizer.
    """
    metrics = trainer.evaluate()
    print(f"Evaluation metrics: {metrics}")

    model.save_pretrained(save_path)
    tokenizer.save_pretrained(save_path)
    print(f"Model and tokenizer saved to {save_path}")


def test_model(trainer, test_dataset, label_encoder):
    print("Running predictions on test dataset...")
    preds_output = trainer.predict(test_dataset)
    preds = preds_output.predictions.argmax(-1)
    labels = preds_output.label_ids

    report = classification_report(labels, preds, target_names=label_encoder.classes_, zero_division=0)
    print(report)
