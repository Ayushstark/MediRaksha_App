import API from '../apiClient';

export interface Doctor {
    id: string;
    name: string;
    degree: string;
    specialty: string;
}

export const getDoctorsForHospital = async (hospitalName: string, hospitalSpecialty: string): Promise<Doctor[]> => {
    const response = await API.get('/doctors/by-hospital', {
        params: { hospital: hospitalName, speciality: hospitalSpecialty },
    });
    const doctors = response.data?.data ?? [];
    return Array.isArray(doctors) ? doctors.map((doctor: any) => ({
        id: String(doctor.id ?? doctor._id),
        name: doctor.name,
        degree: doctor.speciality || doctor.specialization || 'General',
        specialty: doctor.speciality || doctor.specialization || 'General',
    })) : [];
};
