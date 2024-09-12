import { Router } from 'express';
import {
	facilitatorAddFacility,
	facilitatorAllReview,
	facilitatorCheck,
	facilitatorCompletedSessions,
	facilitatorFacilityImage,
	facilitatorOngoingSessions,
	facilitatorUpcomingSessions,
	facilityDetails,
	facilityList,
	facilityReview,
	facilityReviewerCheck,
	facilitySessionDetails,
	facilitySessionTrainer,
} from '../controllers/facilitatorControllers.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadFile } from '../middleware/uploadMiddleware.js';
import { athleteFeaturedTrainer } from '../controllers/athleteControllers.js';

const facilitatorRouter = Router();

facilitatorRouter
	.route('/home')
	.get(
		protect,
		facilitatorCheck,
		facilitatorOngoingSessions,
		facilitatorCompletedSessions,
		facilitatorUpcomingSessions
	);

facilitatorRouter
	.route('/sessions')
	.get(
		protect,
		facilitatorCheck,
		facilitatorOngoingSessions,
		facilitatorUpcomingSessions
	);

facilitatorRouter
	.route('/sessions/:session_id')
	.get(
		protect,
		facilitatorCheck,
		facilitySessionDetails,
		facilitySessionTrainer
	);

facilitatorRouter
	.route('/profile')
	.get(
		protect,
		facilitatorCheck,
		facilityDetails,
		athleteFeaturedTrainer,
		facilityList,
		facilitatorAllReview
	);

facilitatorRouter
	.route('/facility/:facility_id')
	.get(protect, facilitatorCheck);

facilitatorRouter
	.route('/:facilitator_id/add_facility')
	.post(protect, facilitatorCheck, facilitatorAddFacility);

facilitatorRouter
	.route('/:facility_id/add_img')
	.post(protect, facilitatorCheck, uploadFile, facilitatorFacilityImage);

facilitatorRouter
	.route('/:facility_id/add_review')
	.post(protect, facilityReviewerCheck, facilityReview);

export { facilitatorRouter };
