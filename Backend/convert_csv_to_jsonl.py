import csv
import json
import jsonlines
import ast
import os

def load_symptom_map(symptom_json_path):
    with open(symptom_json_path, 'r', encoding='utf-8') as f:
        evidences_data = json.load(f)
    symptom_map = {}
    for code, details in evidences_data.items():
        if 'question_en' in details and details['question_en']:
            symptom_map[code] = details['question_en']
        if 'value_meaning' in details and details['value_meaning']:
            for val_code, val_details in details['value_meaning'].items():
                if 'en' in val_details and val_details['en']:
                    combined_code = f"{code}_@_{val_code}"
                    symptom_map[combined_code] = f"{details.get('question_en', '')} ({val_details['en']})".strip()
    return symptom_map

def map_symptom_codes_to_names(codes, symptom_map):
    symptom_names = []
    for code in codes:
        code = code.strip()
        name = symptom_map.get(code)
        if name:
            symptom_names.append(name)
        else:
            # Try fallback: use base code's question_en if available
            base_code = code.split('_@_')[0]
            fallback_name = symptom_map.get(base_code)
            if fallback_name:
                symptom_names.append(fallback_name)
            else:
                # As a last resort, just include the code itself
                symptom_names.append(code)
                print(f"Warning: Symptom code '{code}' not found in symptom map. Using code as fallback.")
    return symptom_names


def convert_csv_to_jsonl(csv_path, symptom_json_path, output_jsonl_path):
    symptom_map = load_symptom_map(symptom_json_path)
    with open(csv_path, 'r', encoding='utf-8') as csvfile, \
         jsonlines.open(output_jsonl_path, mode='w') as writer:

        reader = csv.DictReader(csvfile)
        for row in reader:
            try:
                evidence_codes = ast.literal_eval(row['EVIDENCES'])
            except Exception as e:
                print(f"Skipping row due to parsing error: {e}")
                continue

            symptom_names = map_symptom_codes_to_names(evidence_codes, symptom_map)
            diagnosis = row['PATHOLOGY'].strip()

            if not symptom_names or not diagnosis:
                continue

            writer.write({
                "symptoms": symptom_names,
                "diagnosis": diagnosis
            })

    print(f"Conversion complete. Saved to {output_jsonl_path}")

if __name__ == "__main__":
    # Paths for all splits
    splits = {
        'train': {
            'input': 'Data/Raw/DDXPlus_English/release_train_patients/release_train_patients.csv',
            'output': 'Data/Raw/DDXPlus_English/release_train_patients/converted_train_patients.jsonl'
        },
        'val': {
            'input': 'Data/Raw/DDXPlus_English/release_validate_patients/release_validate_patients.csv',
            'output': 'Data/Raw/DDXPlus_English/release_validate_patients/converted_validate_patients.jsonl'
        },
        'test': {
            'input': 'Data/Raw/DDXPlus_English/release_test_patients/release_test_patients.csv',
            'output': 'Data/Raw/DDXPlus_English/release_test_patients/converted_test_patients.jsonl'
        }
    }

    symptom_json_path = 'Data/Raw/DDXPlus_English/release_evidences.json'

    # Check symptom map file exists
    if not os.path.exists(symptom_json_path):
        raise FileNotFoundError(f"Symptom JSON file not found: {symptom_json_path}")

    for split_name, paths in splits.items():
        input_path = paths['input']
        output_path = paths['output']

        if not os.path.exists(input_path):
            print(f"Warning: Input file for {split_name} not found: {input_path}, skipping...")
            continue

        # Create output directory if missing
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        print(f"Converting {split_name} split...")
        convert_csv_to_jsonl(input_path, symptom_json_path, output_path)
