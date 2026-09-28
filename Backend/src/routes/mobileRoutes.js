import express from 'express';
import multer from 'multer';
import authVerify from '../middlewares/authVerify.js';
import {
  chatWithAssistant,
  classifySymptom,
  analyzeReport,
} from '../controllers/assistantController.js';
import {
  getMessages,
  sendMessage,
  uploadChatFile,
  createActivity,
  getActivities,
  deleteActivity,
  createDiagnosis,
  getDiagnoses,
} from '../controllers/mobileActivityController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Assistant endpoints
router.post('/assistant/chat', chatWithAssistant);
router.post('/assistant/classify', authVerify, classifySymptom);
router.post('/analyze-report', authVerify, analyzeReport);

// Direct Chat & File upload
router.get('/messages', authVerify, getMessages);
router.post('/messages', authVerify, sendMessage);
router.post('/chat/upload', authVerify, upload.single('file'), uploadChatFile);

// Activities & Diagnoses
router.get('/activities', authVerify, getActivities);
router.post('/activities', authVerify, createActivity);
router.delete('/activities/:id', authVerify, deleteActivity);

router.get('/diagnoses', authVerify, getDiagnoses);
router.post('/diagnoses', authVerify, createDiagnosis);

export default router;
