/**
 * Canonical Medical Doctor Specializations for MediRaksha
 * Only verified medical disciplines are allowed.
 */
export const DOCTOR_SPECIALIZATIONS = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Endocrinologist',
  'ENT Specialist',
  'Gastroenterologist',
  'General Surgeon',
  'Gynecologist & Obstetrician',
  'Hematologist',
  'Nephrologist',
  'Neurologist',
  'Neurosurgeon',
  'Oncologist',
  'Ophthalmologist',
  'Orthopedic Surgeon',
  'Pathologist',
  'Pediatrician',
  'Plastic Surgeon',
  'Psychiatrist',
  'Pulmonologist',
  'Radiologist',
  'Rheumatologist',
  'Urologist',
  'Emergency Medicine Specialist',
  'Anesthesiologist',
  'Dentist',
  'Ayurvedic Practitioner',
  'Homeopathic Practitioner'
];

/**
 * Checks if a given string matches an approved medical doctor specialization.
 * Performs case-insensitive matching and handles common synonyms.
 * @param {string} value
 * @returns {{ isValid: boolean, canonicalName?: string }}
 */
export const validateDoctorSpecialization = (value) => {
  if (!value || typeof value !== 'string') {
    return { isValid: false };
  }

  const clean = value.trim();
  const lower = clean.toLowerCase();

  // Synonym mappings for flexibility
  const synonyms = {
    'cardiology': 'Cardiologist',
    'cardiologist': 'Cardiologist',
    'general medicine': 'General Physician',
    'general physician': 'General Physician',
    'general doctor': 'General Physician',
    'general': 'General Physician',
    'internal medicine': 'General Physician',
    'physician': 'General Physician',
    'dermatology': 'Dermatologist',
    'dermatologist': 'Dermatologist',
    'skin specialist': 'Dermatologist',
    'endocrinology': 'Endocrinologist',
    'endocrinologist': 'Endocrinologist',
    'ent': 'ENT Specialist',
    'ent specialist': 'ENT Specialist',
    'otolaryngology': 'ENT Specialist',
    'gastroenterology': 'Gastroenterologist',
    'gastroenterologist': 'Gastroenterologist',
    'general surgery': 'General Surgeon',
    'general surgeon': 'General Surgeon',
    'surgeon': 'General Surgeon',
    'gynecology': 'Gynecologist & Obstetrician',
    'gynecologist': 'Gynecologist & Obstetrician',
    'gynecologist & obstetrician': 'Gynecologist & Obstetrician',
    'obstetrics': 'Gynecologist & Obstetrician',
    'gynaecology': 'Gynecologist & Obstetrician',
    'hematology': 'Hematologist',
    'hematologist': 'Hematologist',
    'nephrology': 'Nephrologist',
    'nephrologist': 'Nephrologist',
    'neurology': 'Neurologist',
    'neurologist': 'Neurologist',
    'neurosurgery': 'Neurosurgeon',
    'neurosurgeon': 'Neurosurgeon',
    'oncology': 'Oncologist',
    'oncologist': 'Oncologist',
    'cancer specialist': 'Oncologist',
    'ophthalmology': 'Ophthalmologist',
    'ophthalmologist': 'Ophthalmologist',
    'eye specialist': 'Ophthalmologist',
    'ortho': 'Orthopedic Surgeon',
    'orthopedics': 'Orthopedic Surgeon',
    'orthopedic': 'Orthopedic Surgeon',
    'orthopedic surgeon': 'Orthopedic Surgeon',
    'orthopaedics': 'Orthopedic Surgeon',
    'cardio': 'Cardiologist',
    'neuro': 'Neurologist',
    'gyno': 'Gynecologist & Obstetrician',
    'pediatric': 'Pediatrician',
    'pathology': 'Pathologist',
    'pathologist': 'Pathologist',
    'pediatrics': 'Pediatrician',
    'pediatrician': 'Pediatrician',
    'child specialist': 'Pediatrician',
    'plastic surgery': 'Plastic Surgeon',
    'plastic surgeon': 'Plastic Surgeon',
    'psychiatry': 'Psychiatrist',
    'psychiatrist': 'Psychiatrist',
    'pulmonology': 'Pulmonologist',
    'pulmonologist': 'Pulmonologist',
    'chest physician': 'Pulmonologist',
    'radiology': 'Radiologist',
    'radiologist': 'Radiologist',
    'rheumatology': 'Rheumatologist',
    'rheumatologist': 'Rheumatologist',
    'urology': 'Urologist',
    'urologist': 'Urologist',
    'emergency medicine': 'Emergency Medicine Specialist',
    'emergency': 'Emergency Medicine Specialist',
    'emergency medicine specialist': 'Emergency Medicine Specialist',
    'anesthesiology': 'Anesthesiologist',
    'anesthesiologist': 'Anesthesiologist',
    'dentistry': 'Dentist',
    'dentist': 'Dentist',
    'dental surgeon': 'Dentist',
    'ayurveda': 'Ayurvedic Practitioner',
    'ayurvedic practitioner': 'Ayurvedic Practitioner',
    'homeopathy': 'Homeopathic Practitioner',
    'homeopathic practitioner': 'Homeopathic Practitioner'
  };

  if (synonyms[lower]) {
    return { isValid: true, canonicalName: synonyms[lower] };
  }

  // Exact match against canonical list
  const found = DOCTOR_SPECIALIZATIONS.find(
    (item) => item.toLowerCase() === lower
  );

  if (found) {
    return { isValid: true, canonicalName: found };
  }

  return { isValid: false };
};
