export interface Doctor {
    id: string;
    name: string;
    degree: string;
    specialty: string;
}

export const getDoctorsForHospital = (hospitalName: string, hospitalSpecialty: string): Doctor[] => {
    // Mock data for demonstration - in a real app, this would fetch from a database or API
    const doctors: Doctor[] = [
        {
            id: '1',
            name: 'Dr. Rajesh Kumar',
            degree: 'MD, Cardiology',
            specialty: 'Cardiology'
        },
        {
            id: '2',
            name: 'Dr. Sneha Sharma',
            degree: 'MBBS, General Medicine',
            specialty: 'General'
        },
        {
            id: '3',
            name: 'Dr. Amit Patel',
            degree: 'MS, Orthopedics',
            specialty: 'Orthopedics'
        },
        {
            id: '4',
            name: 'Dr. Priya Singh',
            degree: 'MD, Pediatrics',
            specialty: 'Pediatrics'
        },
        {
            id: '5',
            name: 'Dr. Vikram Seth',
            degree: 'MD, Neurology',
            specialty: 'Neurology'
        }
    ];

    // Filter doctors based on the hospital's specialty if applicable
    // For simplicity, we return a subset of doctors
    return doctors.filter(dr =>
        dr.specialty.toLowerCase() === hospitalSpecialty.toLowerCase() ||
        dr.specialty === 'General'
    ).slice(0, 3);
};
