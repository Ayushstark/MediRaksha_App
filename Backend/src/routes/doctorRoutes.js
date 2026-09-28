import express from 'express';
const router = express.Router();

// ── CONTROLLER IMPORTS ──
import { 
  getDoctorDetail, 
  updateDoctorDetail, 
  deleteDoctorAccount 
} from '../controllers/doctorController.js';

import { 
  completeMeeting,
  confirmMeeting,
  getAllMeetings, 
  getMeetingById, 
  deleteMeeting 
} from '../controllers/doctorMeetingController.js';

import {
  getDoctorAppointmentReportById,
  getDoctorAppointmentReports
} from '../controllers/appointmentReportController.js';

import { 
  getAllPatients, 
  getPatientById, 
  removePatient 
} from '../controllers/doctorUserController.js';

import {
  getAllSlots,
  addSlot,
  deleteSlot,
  deleteSlotsByRange
} from '../controllers/doctorSlotController.js';

import { getUserReport } from '../controllers/doctorReportController.js';

// ── DOCTOR PROFILE CHANNELS ──
// Resolves to: /doctor/info/detail, /doctor/info/update, etc.
router.get('/info/detail', getDoctorDetail);
router.patch('/info/update', updateDoctorDetail);
router.delete('/info/delete', deleteDoctorAccount);


// ── DOCTOR SLOT ──
// Resolves to: /doctor/slot/all, /doctor/slot/:id, etc.
router.get('/slot/all', getAllSlots);
router.post('/slot/publish', addSlot);
router.delete('/slot', deleteSlotsByRange);
router.delete('/slot/:id', deleteSlot);


// ── APPOINTMENTS / MEETINGS MANAGEMENT ──
// Resolves to: /doctor/meetings/all, /doctor/meetings/:id
// Note: Hardcoded collection endpoints stay grouped safely above parameter routes
router.get('/meetings/all', getAllMeetings);
router.get('/meetings/:id/reports', getDoctorAppointmentReports);
router.get('/meetings/:id/reports/:reportId', getDoctorAppointmentReportById);
router.patch('/meetings/:id/confirm', confirmMeeting);
router.patch('/meetings/:id/complete', completeMeeting);
router.get('/meetings/:id', getMeetingById);
router.delete('/meetings/:id', deleteMeeting);


// ── REGISTERED PATIENTS DIRECTORY ──
// Resolves to: /doctor/user/my, /doctor/user/:id
// Matches your frontend: api.get('/doctor/user/my') & api.delete('/doctor/user/:id')
router.get('/user/my', getAllPatients);
router.get('/user/:id', getPatientById);
router.delete('/user/:id', removePatient);

// report
router.get('/userreport', getUserReport)


export default router;
