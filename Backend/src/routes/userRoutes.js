import express from 'express';
import multer from 'multer';

// Controllers
import {
  uploadReport,
  getAllReports,
  getReportById,
  deleteReport
} from '../controllers/uploadController.js';

import {
  getAllRecords, getRecordById, createRecord, updateRecord, deleteRecord,
  toggleArchive, toggleImportant, togglePin, duplicateRecord,
  getActivity, searchRecords,
  getConnections, addConnection, removeConnection,
  getPatientSummary, upsertPatientSummary,
} from '../controllers/recordsController.js';

import {
  getUserTags, createTag, deleteTag, addTagToRecord, removeTagFromRecord,
} from '../controllers/tagsController.js';

import {
  getCollections, createCollection, updateCollection, deleteCollection,
  getCollectionDetail, addRecordToCollection, removeRecordFromCollection, getRecordCollections,
} from '../controllers/collectionsController.js';

import {
  getUserDetails,
  updateUserProfile,
  deleteUserAccount
} from '../controllers/userController.js';

import { 
  getAllMeetings, 
  getMeetingById, 
  deleteMeeting, 
  bookMeeting, 
  getAvailableSlots 
} from '../controllers/appointmentController.js';

import {
  getUserAppointmentReportById,
  getUserAppointmentReports,
  uploadAppointmentReports
} from '../controllers/appointmentReportController.js';

import { 
  getMyDoctor, 
  getDoctorByName, 
  getDoctorById, 
  removeRegisteredDoctor 
} from '../controllers/userDoctorController.js';

const router = express.Router();

// Multer configuration for handling file uploads safely via RAM memory buffers
const storage = multer.memoryStorage();
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
]);

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Optional safety fix: Limit file size upload to 5MB
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only PDF and image files are allowed.'));
  }
});

const uploadReportFile = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Maximum size is 5MB.'
      : error.message || 'Invalid file upload.';

    res.status(400).json({ success: false, message });
  });
};

const appointmentReportUpload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Only PDF, JPG, and PNG files are allowed.'));
  }
});

const uploadAppointmentReportFiles = (req, res, next) => {
  appointmentReportUpload.array('files', 10)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Maximum size is 5MB.'
      : error.message || 'Invalid file upload.';

    res.status(400).json({ success: false, message });
  });
};

// All routes here are automatically prefixed with /api/user and protected by authVerify

/* ==========================================
   LEGACY REPORT ROUTES (kept for compatibility)
   ========================================== */
router.post('/report/upload', uploadReportFile, uploadReport);
router.get('/report/all', getAllReports);
router.get('/report/:id', getReportById);
router.delete('/report/:id', deleteReport);

/* ==========================================
   MEDICAL RECORDS MODULE ROUTES
   ========================================== */
router.get('/records/all', getAllRecords);
router.get('/records/search', searchRecords);
router.get('/records/summary', getPatientSummary);
router.post('/records/summary', upsertPatientSummary);
router.post('/records/create', uploadReportFile, createRecord);
router.get('/records/:id', getRecordById);
router.patch('/records/:id', updateRecord);
router.delete('/records/:id', deleteRecord);
router.patch('/records/:id/archive', toggleArchive);
router.patch('/records/:id/important', toggleImportant);
router.patch('/records/:id/pin', togglePin);
router.post('/records/:id/duplicate', duplicateRecord);
router.get('/records/:id/activity', getActivity);
router.get('/records/:id/connections', getConnections);
router.post('/records/:id/connect/:targetId', addConnection);
router.delete('/records/:id/connect/:targetId', removeConnection);
router.post('/records/:id/tags/:tagId', addTagToRecord);
router.delete('/records/:id/tags/:tagId', removeTagFromRecord);
router.get('/records/:id/collections', getRecordCollections);

/* ==========================================
   TAGS ROUTES
   ========================================== */
router.get('/tags', getUserTags);
router.post('/tags', createTag);
router.delete('/tags/:tagId', deleteTag);

/* ==========================================
   COLLECTIONS ROUTES
   ========================================== */
router.get('/collections', getCollections);
router.post('/collections', createCollection);
router.patch('/collections/:id', updateCollection);
router.delete('/collections/:id', deleteCollection);
router.get('/collections/:id', getCollectionDetail);
router.post('/collections/:id/records/:recordId', addRecordToCollection);
router.delete('/collections/:id/records/:recordId', removeRecordFromCollection);

/* ==========================================
   USER PROFILE OPERATION ROUTES
   ========================================== */
router.get('/info/detail', getUserDetails);
router.patch('/info/update', updateUserProfile);
router.delete('/info/delete', deleteUserAccount);

/* ==========================================
    APPOINTMENT/MEETING MANAGEMENT ROUTES
   ========================================== */
router.get('/meetings/all', getAllMeetings);
router.post('/meetings/:id/reports', uploadAppointmentReportFiles, uploadAppointmentReports);
router.get('/meetings/:id/reports', getUserAppointmentReports);
router.get('/meetings/:id/reports/:reportId', getUserAppointmentReportById);
router.get('/meetings/:id', getMeetingById);
router.delete('/meetings/:id', deleteMeeting);
router.post('/meetings/book', bookMeeting);
router.get('/meetings/slot/:doctorId', getAvailableSlots);

/* ==========================================
    DOCTOR-USER ASSOCIATION ROUTES
   ========================================== */
router.get('/doctor/my', getMyDoctor);
router.get('/doctor/search/:name', getDoctorByName); 
router.get('/doctor/:doctorId', getDoctorById);
router.delete('/doctor/:doctorId', removeRegisteredDoctor);

export default router;
