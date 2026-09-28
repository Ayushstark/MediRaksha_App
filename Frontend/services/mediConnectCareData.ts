export type MediConnectDoctor = {
  id: number;
  name: string;
  qualification: string;
  specialization: string;
  experience: number;
  languages: string[];
  hospital: string;
  rating: number;
  consultationFee: number;
  available: boolean;
};

export type MediConnectLab = {
  id: number;
  name: string;
  address: string;
  distance: number;
  timings: string;
  phone: string;
  homeCollection: boolean;
  tests: string[];
  rating: number;
  isOpen: boolean;
  startingPrice: number;
  lat: number;
  lon: number;
};

export type MediConnectPharmacy = {
  id: number;
  name: string;
  address: string;
  distance: number;
  isOpen: boolean;
  delivery: boolean;
  phone: string;
  rating: number;
  is24x7: boolean;
  lat: number;
  lon: number;
};

export type MediConnectPackage = {
  id: number;
  name: string;
  provider: string;
  price: number;
  originalPrice: number;
  tests: string[];
  category: string;
  description: string;
  testsCount: number;
  homeCollection: boolean;
};

const labNames = ['Thyrocare', 'SRL Diagnostics', 'Dr. Lal PathLabs', 'Metropolis', 'Apollo Diagnostics', 'Healthians', 'Orange Health Labs', 'NABL Diagnostics', 'Vijaya Diagnostics', 'Strand Life Sciences', 'Medall Diagnostics', 'Neuberg Diagnostics', 'Suburban Diagnostics', 'Agilus Diagnostics', 'MedGenome Labs'];
const labTests = [
  ['CBC', 'LFT', 'KFT', 'Lipid Profile', 'HbA1c'],
  ['MRI Brain', 'CT Chest', 'X-Ray', 'Ultrasound', 'DEXA Scan'],
  ['Blood Sugar', 'Thyroid Panel', 'Vitamin D', 'B12', 'Iron Studies'],
  ['Full Body Checkup', 'Fever Panel', 'Dengue', 'COVID RT-PCR', 'Malaria'],
  ['ECG', '2D Echo', 'Holter Monitor', 'Treadmill Test'],
  ['Pap Smear', 'Mammography', 'Bone Density', 'Hormonal Panel'],
  ['Allergy Panel', 'ANA Profile', 'RA Factor', 'CRP', 'ESR'],
  ['Culture & Sensitivity', 'HIV', 'Hepatitis B', 'VDRL', 'HCV'],
];
const labAddresses = ['Vidyanagar, Hubli', 'Keshwapur, Hubli', 'Deshpande Nagar, Hubli', 'Koppikar Road, Hubli', 'CBT Circle, Hubli', 'Gokul Road, Hubli', 'Akashwani Circle, Hubli', 'Station Road, Hubli', 'Club Road, Hubli', 'Ashok Nagar, Hubli'];
const labTimings = ['6:00 AM - 8:00 PM', '7:00 AM - 9:00 PM', '24 Hours', '6:30 AM - 7:30 PM', '8:00 AM - 6:00 PM'];

export const MEDICONNECT_LABS: MediConnectLab[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `${labNames[i % labNames.length]}${i >= labNames.length ? ` - Branch ${Math.floor(i / labNames.length) + 1}` : ''}`,
  address: labAddresses[i % labAddresses.length],
  distance: Number((0.3 + (i % 12) * 0.5).toFixed(1)),
  timings: labTimings[i % labTimings.length],
  phone: `+91 97${String(8000000 + i).padStart(8, '0')}`,
  homeCollection: i % 3 !== 2,
  tests: labTests[i % labTests.length],
  rating: Number((3.8 + (i % 10) * 0.1).toFixed(1)),
  isOpen: i % 7 !== 5,
  startingPrice: [199, 299, 399, 499, 149, 249, 349][i % 7],
  lat: 15.3647 + Math.sin(i * 0.8) * 0.07,
  lon: 75.124 + Math.cos(i * 0.8) * 0.07,
}));

const pharmacyNames = ['MedPlus', 'Apollo Pharmacy', 'Wellness Forever', 'Netmeds Store', 'Jan Aushadhi Kendra', 'Green Cross Pharmacy', 'CareFirst Pharmacy', 'HealthMart', 'PharmEasy Store', 'Dava India', 'True Care Pharmacy', 'Medkart', 'Rx Health Pharmacy', 'Noble Chemist', 'Life Care Medical'];
const pharmacyAddresses = ['Koppikar Road, Hubli', 'Lamington Road, Hubli', 'Vidyanagar, Hubli', 'PB Road, Hubli', 'Gokul Road, Hubli', 'CBT Road, Hubli', 'Deshpande Nagar, Hubli', 'Ashok Nagar, Hubli', 'Club Road, Hubli', 'Station Road, Hubli'];

export const MEDICONNECT_PHARMACIES: MediConnectPharmacy[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `${pharmacyNames[i % pharmacyNames.length]}${i >= pharmacyNames.length ? ` - ${pharmacyAddresses[Math.floor(i / pharmacyNames.length) % pharmacyAddresses.length].split(',')[0]}` : ''}`,
  address: pharmacyAddresses[i % pharmacyAddresses.length],
  distance: Number((0.2 + (i % 10) * 0.4).toFixed(1)),
  isOpen: i % 6 !== 4,
  delivery: i % 4 !== 3,
  phone: `+91 96${String(7000000 + i).padStart(8, '0')}`,
  rating: Number((3.7 + (i % 12) * 0.1).toFixed(1)),
  is24x7: i % 5 === 0,
  lat: 15.3647 + Math.sin(i * 0.9 + 2) * 0.06,
  lon: 75.124 + Math.cos(i * 0.9 + 2) * 0.06,
}));

export const MEDICONNECT_PACKAGES: MediConnectPackage[] = [
  { id: 1, name: 'Aarogya Full Body Checkup', provider: 'Apollo Hospital', price: 1499, originalPrice: 2999, tests: ['CBC', 'LFT', 'KFT', 'Lipid Profile', 'Blood Sugar', 'Thyroid', 'Urine R/E', 'Chest X-Ray', 'ECG', 'HbA1c', 'Vitamin D', 'B12', 'Calcium', 'Iron Studies', 'Stool Analysis'], category: 'Full Body', description: 'India\'s most comprehensive health checkup covering 85+ parameters to assess your overall health.', testsCount: 85, homeCollection: true },
  { id: 2, name: 'Diabetes Care Package', provider: 'Dr. Lal PathLabs', price: 899, originalPrice: 1799, tests: ['HbA1c', 'Fasting Blood Sugar', 'PPBS', 'Insulin Fasting', 'Lipid Profile', 'Kidney Function', 'Urine Microalbumin', 'Urine R/E'], category: 'Diabetes', description: 'Comprehensive diabetes monitoring panel to assess glycaemic control and prevent complications.', testsCount: 40, homeCollection: true },
  { id: 3, name: 'Heart Guard Screening', provider: 'Narayana Health', price: 1999, originalPrice: 3999, tests: ['2D Echo', 'ECG', 'TMT', 'Troponin', 'BNP', 'Lipid Profile', 'hs-CRP', 'Homocysteine', 'Chest X-Ray', 'Cardiologist Consultation'], category: 'Cardiac', description: 'Complete cardiac risk assessment with expert cardiologist review and advanced biomarker tests.', testsCount: 50, homeCollection: false },
  { id: 4, name: 'Liver Health Package', provider: 'SRL Diagnostics', price: 799, originalPrice: 1599, tests: ['LFT', 'GGT', 'Hepatitis B Antigen', 'HCV Antibody', 'AFP', 'Ultrasound Abdomen', 'PT/INR'], category: 'Liver', description: 'Comprehensive liver function assessment to detect fatty liver, hepatitis and cirrhosis early.', testsCount: 35, homeCollection: true },
  { id: 5, name: 'Senior Citizen Wellness', provider: 'Metropolis', price: 2499, originalPrice: 4999, tests: ['Full Body Checkup', 'Bone Density', 'Vision Test', 'Hearing Test', 'Prostate/Gynae', 'Memory Screen', 'Cardiology Consult', 'Ophthalmology', 'ECG', 'Dental Checkup'], category: 'Senior', description: 'Specially designed for 60+ with 100+ parameters covering all age-related health concerns.', testsCount: 100, homeCollection: true },
  { id: 6, name: 'Women\'s Wellness Package', provider: 'Cloudnine Hospital', price: 1299, originalPrice: 2499, tests: ['CBC', 'Hormonal Panel', 'Thyroid', 'Pap Smear', 'Mammography', 'Bone Density', 'Iron', 'Vitamin D', 'Pelvic Ultrasound', 'Gynae Consultation'], category: 'Women', description: 'Complete women\'s health screening package from reproductive health to bone and thyroid assessment.', testsCount: 60, homeCollection: false },
  { id: 7, name: 'Thyroid & Hormonal Panel', provider: 'Thyrocare', price: 599, originalPrice: 1199, tests: ['TSH', 'Free T3', 'Free T4', 'Anti-TPO', 'Anti-TG', 'Prolactin', 'FSH', 'LH', 'Cortisol', 'Testosterone'], category: 'Hormonal', description: 'Detailed thyroid and hormonal panel for both men and women to assess glandular health.', testsCount: 25, homeCollection: true },
  { id: 8, name: 'Cancer Screening Package', provider: 'HCG Cancer Centre', price: 3499, originalPrice: 6999, tests: ['PSA (Men)', 'CA-125 (Women)', 'CEA', 'CA 19-9', 'AFP', 'Beta HCG', 'LDHA', 'CBC', 'Tumour Markers Panel', 'Consultation'], category: 'Cancer', description: 'Early cancer detection screening with comprehensive tumour markers and specialist consultation.', testsCount: 30, homeCollection: false },
  { id: 9, name: 'Kidney Care Package', provider: 'Uro-Care Hospital', price: 999, originalPrice: 1999, tests: ['KFT', 'Urine R/E', 'Urine Culture', 'eGFR', 'Creatinine', 'BUN', 'Uric Acid', '24hr Urine Protein', 'Kidney Ultrasound'], category: 'Kidney', description: 'Full renal function assessment to detect kidney disease early and monitor existing conditions.', testsCount: 40, homeCollection: true },
  { id: 10, name: 'Vitamin & Nutrition Panel', provider: 'Healthians', price: 499, originalPrice: 999, tests: ['Vitamin D', 'Vitamin B12', 'Folate', 'Iron', 'Ferritin', 'Zinc', 'Magnesium', 'Calcium', 'Phosphorus'], category: 'Nutrition', description: 'Find nutritional deficiencies that cause fatigue, weakness, and poor immunity with this panel.', testsCount: 20, homeCollection: true },
];

export const MEDICONNECT_DOCTORS: MediConnectDoctor[] = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `Dr. ${['Ramesh', 'Priya', 'Kavitha', 'Amit', 'Sunita'][i % 5]} ${['Kumar', 'Sharma', 'Patel', 'Rao', 'Singh'][i % 5]}`,
  qualification: ['MBBS, MD', 'MBBS, MS', 'MBBS, DNB', 'MD, DM'][i % 4],
  specialization: ['Cardiology', 'Orthopedics', 'Neurology', 'Dermatology', 'Pediatrics', 'General Medicine'][i % 6],
  experience: (i % 28) + 3,
  languages: ['English', 'Hindi', i % 2 ? 'Kannada' : 'Telugu'],
  hospital: `MediRaksha Hospital ${((i % 10) + 1)}`,
  rating: Number((3.6 + (i % 13) * 0.1).toFixed(1)),
  consultationFee: [300, 400, 500, 600, 700, 800, 1000, 1200][i % 8],
  available: i % 5 !== 0,
}));
