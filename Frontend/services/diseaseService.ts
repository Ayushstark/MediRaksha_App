import API from '../apiClient';

export interface Disease {
  id: number | string;
  code?: number;
  name: string;
  common_name?: string;
  category: 'Infectious' | 'Chronic' | 'Genetic' | 'Lifestyle' | 'Oncology' | 'Neurology' | string;
  risk_level: 'Low' | 'Medium' | 'High' | string;
  transmission?: string;
  symtom?: string;
  solution?: string;
  description?: string;
  created_at?: string;
}

export const FALLBACK_DISEASES: Disease[] = [
  {
    id: 101,
    code: 101,
    name: "Type 2 Diabetes Mellitus",
    common_name: "Type 2 Diabetes",
    category: "Chronic",
    risk_level: "Medium",
    transmission: "Non-communicable (Genetic & Lifestyle factors)",
    symtom: "Increased thirst, frequent urination, fatigue, blurred vision, slow-healing sores",
    solution: "Healthy low-glycemic diet, regular physical exercise, blood glucose monitoring, Metformin or prescribed medications.",
    description: "A chronic metabolic condition characterized by insulin resistance and elevated blood glucose levels. Early detection and lifestyle changes can prevent severe vascular and renal complications."
  },
  {
    id: 102,
    code: 102,
    name: "Hypertension",
    common_name: "High Blood Pressure",
    category: "Chronic",
    risk_level: "High",
    transmission: "Non-communicable (Lifestyle & Arterial stiffness)",
    symtom: "Often asymptomatic ('silent killer'), severe headaches, chest discomfort, shortness of breath, dizziness",
    solution: "DASH diet, low sodium intake, stress management, regular aerobic exercise, ACE inhibitors or beta-blockers as prescribed.",
    description: "Persistent elevation of systemic arterial blood pressure (≥140/90 mmHg) that increases the risk of stroke, myocardial infarction, and chronic kidney disease."
  },
  {
    id: 103,
    code: 103,
    name: "Dengue Fever",
    common_name: "Breakbone Fever",
    category: "Infectious",
    risk_level: "High",
    transmission: "Vector-borne via infected Aedes aegypti mosquitoes",
    symtom: "Sudden high fever, intense retro-orbital headache, joint and muscle aches, rash, platelet count drop",
    solution: "Bed rest, rigorous oral rehydration therapy, paracetamol for pain (avoid NSAIDs/Aspirin due to bleeding risk), platelet monitoring.",
    description: "An acute arboviral infection endemic to tropical climates. Warning signs like persistent vomiting or mucosal bleeding require emergency hospitalization."
  },
  {
    id: 104,
    code: 104,
    name: "Acute Bronchitis",
    common_name: "Chest Cold",
    category: "Infectious",
    risk_level: "Low",
    transmission: "Airborne respiratory droplets (primarily viral)",
    symtom: "Hacking cough with or without clear/yellow sputum, sore throat, low-grade fever, mild chest soreness",
    solution: "Humidified air, steam inhalation, throat lozenges, adequate hydration, rest; antibiotics usually not indicated unless secondary bacterial infection.",
    description: "Short-term inflammation of the bronchial mucous membranes, commonly resolving within 10 to 14 days."
  },
  {
    id: 105,
    code: 105,
    name: "Gastroesophageal Reflux Disease (GERD)",
    common_name: "Acid Reflux / Heartburn",
    category: "Lifestyle",
    risk_level: "Low",
    transmission: "Non-communicable (Lower esophageal sphincter dysfunction)",
    symtom: "Burning retrosternal chest pain after eating, sour taste/acid regurgitation, chronic throat clearing, dysphagia",
    solution: "Avoid lying down within 3 hours after meals, elevate head of bed, avoid trigger foods (acidic, fried, caffeine), antacids or PPIs.",
    description: "A common digestive disease where stomach acid persistently flows back into the food pipe (esophagus), irritating the esophageal lining."
  },
  {
    id: 106,
    code: 106,
    name: "Breast Cancer",
    common_name: "Breast Neoplasm / Carcinoma",
    category: "Oncology",
    risk_level: "High",
    transmission: "Non-communicable (Genetic mutations, BRCA1/2, hormonal factors)",
    symtom: "Painless breast lump or thickening, skin dimpling, nipple inversion, nipple discharge, localized swelling or redness",
    solution: "Early screening via mammography, surgical resection, chemotherapy, radiation therapy, hormone receptor targeted therapies.",
    description: "Malignant cellular proliferation originating in breast tissue, most commonly inside milk ducts (ductal carcinoma) or lobules. Early detection significantly improves 5-year survival rates."
  },
  {
    id: 107,
    code: 107,
    name: "Bronchial Asthma",
    common_name: "Asthma",
    category: "Chronic",
    risk_level: "Medium",
    transmission: "Non-communicable (Airway hyper-reactivity, environmental allergens)",
    symtom: "Wheezing, episodic shortness of breath, chest tightness, nocturnal dry cough",
    solution: "Inhaled corticosteroids (budesonide/fluticasone), short-acting bronchodilators (salbutamol) for rescue, avoiding dust/smoke triggers.",
    description: "A chronic inflammatory disorder of the airways causing reversible bronchospasm, mucus hypersecretion, and airflow obstruction."
  },
  {
    id: 108,
    code: 108,
    name: "COVID-19 (SARS-CoV-2)",
    common_name: "Coronavirus Disease",
    category: "Infectious",
    risk_level: "Medium",
    transmission: "Airborne aerosols and respiratory droplets",
    symtom: "Fever, dry cough, fatigue, loss of taste or smell, sore throat, oxygen desaturation in severe cases",
    solution: "Isolation, pulse oximetry monitoring, oral hydration, antipyretics, Paxlovid or monoclonal antibodies if high-risk, vaccination.",
    description: "An acute contagious viral respiratory disease caused by the SARS-CoV-2 coronavirus with multisystemic inflammatory potential."
  },
  {
    id: 109,
    code: 109,
    name: "Pulmonary Tuberculosis",
    common_name: "TB",
    category: "Infectious",
    risk_level: "High",
    transmission: "Airborne inhalation of Mycobacterium tuberculosis bacteria",
    symtom: "Chronic cough lasting >3 weeks, hemoptysis (blood in sputum), night sweats, unexplained weight loss, low-grade fever",
    solution: "Directly Observed Therapy (DOTS) multi-drug regimen: Isoniazid, Rifampicin, Pyrazinamide, Ethambutol for 6 months.",
    description: "A bacterial infection primarily targeting lungs with granuloma formation. Completing the entire antibiotic course is critical to avoid multi-drug resistant strains."
  },
  {
    id: 110,
    code: 110,
    name: "Malaria",
    common_name: "Plasmodium Infection",
    category: "Infectious",
    risk_level: "High",
    transmission: "Bite of infected female Anopheles mosquitoes",
    symtom: "High cyclical fever with rigor and chills, profuse sweating, headache, nausea, anemia, jaundice",
    solution: "Artemisinin-based combination therapies (ACT), chloroquine, insect repellent, bed nets, prompt blood smear confirmation.",
    description: "A protozoan parasitic disease that infects and ruptures red blood cells, potentially causing cerebral malaria if left untreated."
  },
  {
    id: 111,
    code: 111,
    name: "Migraine",
    common_name: "Severe Throbbing Headache",
    category: "Neurology",
    risk_level: "Low",
    transmission: "Non-communicable (Neurovascular trigeminal activation)",
    symtom: "Unilateral pulsating headache, photophobia, phonophobia, nausea, visual aura",
    solution: "Triptans, NSAIDs, dark quiet room rest, hydration, preventive CGRP antagonists or beta-blockers.",
    description: "A complex neurovascular disorder characterized by recurrent moderate to severe throbbing headaches lasting 4 to 72 hours."
  },
  {
    id: 112,
    code: 112,
    name: "Rheumatoid Arthritis",
    common_name: "Inflammatory Joint Disease",
    category: "Chronic",
    risk_level: "Medium",
    transmission: "Autoimmune disorder (Genetic predisposition)",
    symtom: "Symmetrical joint pain, morning stiffness >30 minutes, joint swelling in hands/wrists, fatigue",
    solution: "DMARDs (Methotrexate), biologic response modifiers, low-impact exercise, joint protection strategies.",
    description: "A chronic systemic autoimmune disease causing progressive synovial inflammation, joint erosion, and functional impairment."
  },
  {
    id: 113,
    code: 113,
    name: "Hypothyroidism",
    common_name: "Underactive Thyroid",
    category: "Chronic",
    risk_level: "Low",
    transmission: "Non-communicable (Autoimmune Hashimoto's / Iodine deficiency)",
    symtom: "Weight gain, cold intolerance, fatigue, dry skin, constipation, bradycardia, hair thinning",
    solution: "Daily synthetic Levothyroxine (T4) replacement on an empty stomach, periodic TSH level testing.",
    description: "A hormonal deficiency resulting from underproduction of thyroid hormones by the thyroid gland, slowing basal metabolism."
  },
  {
    id: 114,
    code: 114,
    name: "Renal Calculi (Nephrolithiasis)",
    common_name: "Kidney Stones",
    category: "Lifestyle",
    risk_level: "Medium",
    transmission: "Non-communicable (Dehydration, high oxalate / uric acid precipitation)",
    symtom: "Severe flank pain radiating to groin (renal colic), hematuria (blood in urine), dysuria, nausea",
    solution: "High water intake (>3L/day), pain management (NSAIDs), alpha-blockers for stone passage, lithotripsy for large stones.",
    description: "Solid mineral crystalline deposits that form inside the renal pelvis and ureters causing acute obstruction and spasms."
  },
  {
    id: 115,
    code: 115,
    name: "Pneumonia",
    common_name: "Lung Infection",
    category: "Infectious",
    risk_level: "High",
    transmission: "Inhalation of Streptococcus pneumoniae bacteria or viruses",
    symtom: "Productive cough with rust or green sputum, high spiking fever, sharp pleuritic chest pain, dyspnea",
    solution: "Targeted antibiotics (e.g., Amoxicillin-clavulanate / Azithromycin), oxygen therapy, respiratory physiotherapy.",
    description: "Infection that inflames air sacs in one or both lungs, which may fill with fluid or purulent material."
  },
  {
    id: 116,
    code: 116,
    name: "Major Depressive Disorder",
    common_name: "Depression",
    category: "Neurology",
    risk_level: "Medium",
    transmission: "Non-communicable (Neurotransmitter dysregulation, psychosocial stress)",
    symtom: "Persistent low mood, anhedonia (loss of interest), sleep disturbances, psychomotor agitation, fatigue",
    solution: "Cognitive behavioral therapy (CBT), SSRIs/SNRIs as prescribed, structured daily routine, supportive psychotherapy.",
    description: "A persistent mood disorder causing severe distress and functional impairment in social, work, and personal activities."
  }
];

export async function fetchAllDiseases(query?: string, category?: string): Promise<Disease[]> {
  try {
    const params: any = {};
    if (query) params.q = query;
    if (category && category !== 'All') params.category = category;

    const response = await API.get('/disease/all', { params });
    const data = response.data?.data ?? response.data;
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return FALLBACK_DISEASES;
  } catch (error) {
    console.warn('Failed to load diseases, using built-in directory:', error);
    return FALLBACK_DISEASES;
  }
}

export async function fetchDiseaseById(id: number | string): Promise<Disease | null> {
  try {
    const response = await API.get(`/disease/${id}`);
    const data = response.data?.data ?? response.data;
    if (data) return data;
  } catch (error) {
    console.warn('Failed to load disease details:', error);
  }
  const fallback = FALLBACK_DISEASES.find(d => String(d.id) === String(id) || String(d.code) === String(id));
  return fallback || null;
}
