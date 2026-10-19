/**
 * Canonical Medical Doctor Specializations for MediRaksha
 */
export interface SpecializationOption {
  value: string;
  label: string;
  category: string;
  icon?: string;
  description: string;
}

export const DOCTOR_SPECIALIZATIONS: SpecializationOption[] = [
  {
    value: 'General Physician',
    label: 'General Physician',
    category: 'Primary Care',
    icon: 'user-md',
    description: 'Preventive care, routine checkups, infections & chronic conditions',
  },
  {
    value: 'Cardiologist',
    label: 'Cardiologist',
    category: 'Heart & Vascular',
    icon: 'heartbeat',
    description: 'Heart conditions, blood pressure, ECG & cardiovascular health',
  },
  {
    value: 'Dermatologist',
    label: 'Dermatologist',
    category: 'Skin & Hair',
    icon: 'hand-sparkles',
    description: 'Skin infections, acne, eczema, allergies & hair conditions',
  },
  {
    value: 'Pediatrician',
    label: 'Pediatrician',
    category: 'Child Care',
    icon: 'baby',
    description: 'Infant, child & adolescent health, growth & vaccinations',
  },
  {
    value: 'Gynecologist & Obstetrician',
    label: 'Gynecologist & Obstetrician',
    category: 'Women Health',
    icon: 'female',
    description: 'Pregnancy, maternal care, fertility & reproductive health',
  },
  {
    value: 'Orthopedic Surgeon',
    label: 'Orthopedic Surgeon',
    category: 'Bones & Joints',
    icon: 'bone',
    description: 'Fractures, joint pain, spine disorders, arthritis & sports injuries',
  },
  {
    value: 'Neurologist',
    label: 'Neurologist',
    category: 'Brain & Nerves',
    icon: 'brain',
    description: 'Headaches, migraines, seizures, strokes & nerve disorders',
  },
  {
    value: 'Neurosurgeon',
    label: 'Neurosurgeon',
    category: 'Surgery',
    icon: 'procedures',
    description: 'Brain & spinal surgery, trauma, tumors & nervous system repair',
  },
  {
    value: 'ENT Specialist',
    label: 'ENT Specialist',
    category: 'Ear, Nose & Throat',
    icon: 'head-side-cough',
    description: 'Sinusitis, hearing disorders, throat infections & tonsillitis',
  },
  {
    value: 'Gastroenterologist',
    label: 'Gastroenterologist',
    category: 'Digestive',
    icon: 'notes-medical',
    description: 'Stomach, liver, acidity, digestion & bowel disorders',
  },
  {
    value: 'Pulmonologist',
    label: 'Pulmonologist',
    category: 'Respiratory',
    icon: 'lungs',
    description: 'Asthma, chronic cough, COPD, bronchitis & lung infections',
  },
  {
    value: 'Endocrinologist',
    label: 'Endocrinologist',
    category: 'Metabolic',
    icon: 'dna',
    description: 'Diabetes, thyroid disorders, metabolism & hormonal imbalances',
  },
  {
    value: 'Nephrologist',
    label: 'Nephrologist',
    category: 'Kidney',
    icon: 'tint',
    description: 'Kidney disease, dialysis, stones & renal failure',
  },
  {
    value: 'Urologist',
    label: 'Urologist',
    category: 'Urinary & Men Health',
    icon: 'medkit',
    description: 'Urinary tract infections, bladder issues & prostate health',
  },
  {
    value: 'Oncologist',
    label: 'Oncologist',
    category: 'Cancer Care',
    icon: 'ribbon',
    description: 'Cancer diagnosis, chemotherapy, immunotherapy & tumor treatment',
  },
  {
    value: 'Ophthalmologist',
    label: 'Ophthalmologist',
    category: 'Eye Care',
    icon: 'eye',
    description: 'Vision testing, cataracts, glaucoma & eye surgeries',
  },
  {
    value: 'Psychiatrist',
    label: 'Psychiatrist',
    category: 'Mental Health',
    icon: 'smile',
    description: 'Anxiety, depression, stress disorders & mental wellness',
  },
  {
    value: 'General Surgeon',
    label: 'General Surgeon',
    category: 'Surgery',
    icon: 'cut',
    description: 'Appendectomy, hernia, abdominal surgery & trauma surgery',
  },
  {
    value: 'Plastic Surgeon',
    label: 'Plastic Surgeon',
    category: 'Surgery',
    icon: 'magic',
    description: 'Cosmetic reconstruction, burn care, scar & aesthetic surgery',
  },
  {
    value: 'Hematologist',
    label: 'Hematologist',
    category: 'Blood',
    icon: 'vial',
    description: 'Anemia, clotting disorders, leukemia & blood cell diseases',
  },
  {
    value: 'Rheumatologist',
    label: 'Rheumatologist',
    category: 'Autoimmune',
    icon: 'shield-alt',
    description: 'Rheumatoid arthritis, lupus, gout & autoimmune conditions',
  },
  {
    value: 'Pathologist',
    label: 'Pathologist',
    category: 'Diagnostics',
    icon: 'microscope',
    description: 'Biopsies, blood analyses, tissue tests & lab diagnostics',
  },
  {
    value: 'Radiologist',
    label: 'Radiologist',
    category: 'Diagnostics',
    icon: 'x-ray',
    description: 'X-Ray, MRI, CT scans, ultrasounds & diagnostic imaging',
  },
  {
    value: 'Emergency Medicine Specialist',
    label: 'Emergency Medicine Specialist',
    category: 'Critical Care',
    icon: 'ambulance',
    description: 'Acute trauma, cardiac arrest, poisonings & ICU emergency',
  },
  {
    value: 'Anesthesiologist',
    label: 'Anesthesiologist',
    category: 'Critical Care',
    icon: 'syringe',
    description: 'Pre-surgery anesthesia, pain management & intensive monitoring',
  },
  {
    value: 'Dentist',
    label: 'Dentist',
    category: 'Dental Care',
    icon: 'tooth',
    description: 'Dental cleanings, fillings, root canals & oral surgery',
  },
  {
    value: 'Ayurvedic Practitioner',
    label: 'Ayurvedic Practitioner',
    category: 'Alternative Medicine',
    icon: 'leaf',
    description: 'Traditional Ayurvedic therapies, herbal care & holistic health',
  },
  {
    value: 'Homeopathic Practitioner',
    label: 'Homeopathic Practitioner',
    category: 'Alternative Medicine',
    icon: 'seedling',
    description: 'Classical homeopathy, holistic remedies & constitutional care',
  },
];

export const VALID_SPECIALIZATION_VALUES = new Set(
  DOCTOR_SPECIALIZATIONS.map((s) => s.value.toLowerCase())
);

export const isValidDoctorSpecialization = (value: string): boolean => {
  if (!value || typeof value !== 'string') return false;
  return VALID_SPECIALIZATION_VALUES.has(value.trim().toLowerCase());
};

export const findCanonicalSpecialization = (value: string): string | null => {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  const match = DOCTOR_SPECIALIZATIONS.find(
    (s) => s.value.toLowerCase() === lower
  );
  return match ? match.value : null;
};
