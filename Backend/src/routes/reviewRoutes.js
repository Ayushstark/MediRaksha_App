import express from 'express';
import { createReview, getReviews } from '../controllers/reviewController.js';
import authVerify from '../middlewares/authVerify.js';

const router = express.Router();

router.get('/', getReviews);
router.post('/', authVerify, createReview);

export default router;
