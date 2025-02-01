import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
	trainerAddAvailabilityHours,
	trainerAddCertificate,
	trainerAddEducation,
	trainerAddExperience,
	trainerAvailability,
	trainerCheck,
	trainerCompletedSessions,
	trainerEditCertificate,
	trainerEditEducation,
	trainerEditExperience,
	trainerEditProfile,
	trainerEditProfileImage,
	trainerEnsure,
	trainerGetCertificates,
	trainerGetEducation,
	trainerGetEducationExperienceCertificate,
	trainerGetExperience,
	trainerHomeStats,
	trainerIndividualCertificate,
	trainerIndividualEducation,
	trainerIndividualExperience,
	trainerInfo,
	trainerOngoingSessions,
	trainerProfile,
	trainerProfileCompletion,
	trainerReviews,
	trainerSessionCheck,
	trainerSessionsServe,
	trainerStatistics,
	trainerUpcomingSessions,
} from '../controllers/trainerControllers.js';
import { uploadFile, uploadToS3 } from '../middleware/uploadMiddleware.js';
import {
	facilitySessionDetails,
	facilitySessionTrainer,
} from '../controllers/facilitatorControllers.js';

const trainerRouter = Router();

trainerRouter
	.route('/home')
	.post(
		protect,
		trainerCheck,
		trainerUpcomingSessions,
		trainerHomeStats,
		trainerProfileCompletion
	);

trainerRouter
	.route('/experience')
	.post(trainerAddExperience)
	.patch(protect, trainerCheck, trainerEditExperience)
	.get(protect, trainerCheck, trainerGetExperience);

trainerRouter
	.route('/individual_experience')
	.post(protect, trainerCheck, trainerIndividualExperience);

trainerRouter
	.route('/certificate')
	.post(trainerAddCertificate)
	.patch(protect, trainerCheck, trainerEditCertificate)
	.get(protect, trainerCheck, trainerGetCertificates);

trainerRouter
	.route('/individual_certificate')
	.post(protect, trainerCheck, trainerIndividualCertificate);

trainerRouter
	.route('/education')
	.post(trainerAddEducation)
	.patch(protect, trainerCheck, trainerEditEducation)
	.get(protect, trainerCheck, trainerGetEducation);

trainerRouter
	.route('/individual_education')
	.post(protect, trainerCheck, trainerIndividualEducation);

trainerRouter
	.route('/profile')
	.post(
		protect,
		trainerCheck,
		trainerEnsure,
		trainerProfile,
		trainerStatistics,
		trainerAvailability,
		trainerGetEducationExperienceCertificate,
		trainerReviews
	)
	.patch(protect, trainerCheck, trainerEditProfile);

trainerRouter
	.route('/profile_img')
	.patch(
		protect,
		trainerCheck,
		uploadFile,
		uploadToS3,
		trainerEditProfileImage
	);

trainerRouter
	.route('/sessions')
	.post(
		protect,
		trainerCheck,
		trainerOngoingSessions,
		trainerCompletedSessions,
		trainerUpcomingSessions,
		trainerSessionsServe
	);

trainerRouter
	.route('/individual_session')
	.post(
		protect,
		trainerCheck,
		trainerSessionCheck,
		facilitySessionDetails,
		facilitySessionTrainer
	);

export { trainerRouter };
