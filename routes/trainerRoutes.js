import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
	trainerAddAvailabilityHours,
	trainerAddCertificate,
	trainerAddEducation,
	trainerAddExperience,
	trainerAvailability,
	trainerCheck,
	trainerEditCertificate,
	trainerEditEducation,
	trainerEditExperience,
	trainerEnsure,
	trainerGetCertificates,
	trainerGetEducation,
	trainerGetExperience,
	trainerHomeStats,
	trainerProfile,
	trainerReviews,
	trainerStatistics,
	trainerUpcomingSessions,
} from '../controllers/trainerControllers.js';

const trainerRouter = Router();

trainerRouter
	.route('/availability_hours')
	.post(protect, trainerAddAvailabilityHours);

trainerRouter
	.route('/home')
	.post(protect, trainerCheck, trainerUpcomingSessions, trainerHomeStats);

trainerRouter
	.route('/experience')
	.post(trainerAddExperience)
	.patch(protect, trainerCheck, trainerEditExperience)
	.get(protect, trainerCheck, trainerGetExperience);

trainerRouter
	.route('/certificate')
	.post(trainerAddCertificate)
	.patch(protect, trainerCheck, trainerEditCertificate)
	.get(protect, trainerCheck, trainerGetCertificates);

trainerRouter
	.route('/education')
	.post(trainerAddEducation)
	.patch(protect, trainerCheck, trainerEditEducation)
	.get(protect, trainerCheck, trainerGetEducation);

trainerRouter
	.route('/profile')
	.post(
		protect,
		trainerCheck,
		trainerEnsure,
		trainerProfile,
		trainerStatistics,
		trainerAvailability,
		trainerReviews
	);

export { trainerRouter };
