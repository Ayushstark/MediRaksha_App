import router from 'express';
import authVerify from '../middlewares/authVerify.js';
import {
  cancelBedBooking,
  createBedBooking,
  getGeoapifyHospitalByPlaceId,
  getHospitals,
  getHospitalById,
  getMyBedBookings,
  searchGeoapifyHospitals
} from '../controllers/hospitalController.js';

const hospitalRoutes = router();

hospitalRoutes.get('/all', getHospitals);
hospitalRoutes.get('/geoapify/search', searchGeoapifyHospitals);
hospitalRoutes.get('/geoapify/place/:placeId', getGeoapifyHospitalByPlaceId);
hospitalRoutes.get('/bed-bookings/my', authVerify, getMyBedBookings);
hospitalRoutes.post('/:id/bed-bookings', authVerify, createBedBooking);
hospitalRoutes.delete('/bed-bookings/:bookingId', authVerify, cancelBedBooking);
hospitalRoutes.get('/:id', getHospitalById);

export default hospitalRoutes;
