import express from 'express';
import authVerify from '../middlewares/authVerify.js';
import { requireRole, ROLES } from '../middlewares/roleAuth.js';
import {
  createHospitalHandler,
  updateHospitalHandler,
  getHospitalHandler,
  getNearbyHospitalsHandler,
  searchHospitalsHandler,
  getHospitalFacilitiesHandler,
  addFacilityHandler,
  updateFacilityHandler,
  addDepartmentHandler,
  addContactHandler,
  bulkImportHandler,
} from '../controllers/hospitalIntelligenceController.js';

const router = express.Router();

// ── Public / read-only ────────────────────────────────────────────────────────
// IMPORTANT: specific paths (/nearby, /search) must be declared before /:id
// so Express does not match them as the :id parameter.

router.get('/nearby',  getNearbyHospitalsHandler);
router.get('/search',  searchHospitalsHandler);

router.get('/:id',              getHospitalHandler);
router.get('/:id/facilities',   getHospitalFacilitiesHandler);

// ── Admin-only writes ─────────────────────────────────────────────────────────

const adminGuard = [authVerify, requireRole(ROLES.OPERATIONS_TEAM)];

router.post('/',                              ...adminGuard, createHospitalHandler);
router.put('/:id',                            ...adminGuard, updateHospitalHandler);

router.post('/:id/facilities',                ...adminGuard, addFacilityHandler);
router.patch('/:id/facilities/:facilityId',   ...adminGuard, updateFacilityHandler);
router.post('/:id/departments',               ...adminGuard, addDepartmentHandler);
router.post('/:id/contacts',                  ...adminGuard, addContactHandler);

router.post('/import/bulk',                   ...adminGuard, bulkImportHandler);

export default router;
