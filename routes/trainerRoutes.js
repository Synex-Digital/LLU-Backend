import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { trainerAddAvailabilityHours } from '../controllers/trainerControllers.js';

const trainerRouter = Router();

trainerRouter
	.route('/:trainer_id/availability_hours')
	.post(protect, trainerAddAvailabilityHours);

export { trainerRouter };
