import router from 'express';
import { getDiseases, getDiseaseById } from '../controllers/diseaseController.js';

const diseaseRoutes = router.Router();

diseaseRoutes.get('/all', getDiseases);
diseaseRoutes.get('/:id', getDiseaseById);

export default diseaseRoutes;