import { Router } from 'express';
import {
	facilitatorAddAmenities,
	facilitatorAddEmployee,
	facilitatorAddFacility,
	facilitatorAllReview,
	facilitatorAssignEmployee,
	facilitatorCheck,
	facilitatorCompletedSessions,
	facilitatorDeleteFacilityImage,
	facilitatorDetails,
	facilitatorEdit,
	facilitatorEmployees,
	facilitatorFacilityImage,
	facilitatorFetch,
	facilitatorGetNearbyTrainer,
	facilitatorOngoingSessions,
	facilitatorProfileCompletion,
	facilitatorUpcomingSessions,
	facilityAvailableHours,
	facilityBasicDetails,
	facilityDetails,
	facilityEdit,
	facilityGallery,
	facilityList,
	facilityReview,
	facilityReviewerCheck,
	facilityReviews,
	facilitySessionDetails,
	facilitySessionTrainer,
} from '../controllers/facilitatorControllers.js';
import { protect } from '../middleware/authMiddleware.js';
import {
	deleteFile,
	uploadMultiple,
	uploadMultipleToS3,
} from '../middleware/uploadMiddleware.js';
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
	.route('/session_details')
	.post(
		protect,
		facilitatorCheck,
		facilitySessionDetails,
		facilitySessionTrainer
	);

facilitatorRouter
	.route('/profile')
	.post(
		protect,
		facilitatorCheck,
		facilityDetails,
		facilitatorProfileCompletion,
		athleteFeaturedTrainer,
		facilityList,
		facilitatorAllReview
	);

facilitatorRouter
	.route('/facility')
	.post(
		protect,
		facilitatorCheck,
		facilityBasicDetails,
		facilityAvailableHours,
		facilityGallery,
		facilityReviews
	)
	.patch(protect, facilitatorCheck, facilityEdit);

facilitatorRouter
	.route('/edit_details')
	.get(
		protect,
		facilitatorCheck,
		facilitatorFetch,
		facilityList,
		facilitatorDetails
	)
	.patch(protect, facilitatorCheck, facilitatorFetch, facilitatorEdit);

facilitatorRouter
	.route('/add_facility')
	.post(
		protect,
		facilitatorCheck,
		facilitatorAddFacility,
		facilitatorAssignEmployee,
		facilitatorAddAmenities
	);

facilitatorRouter
	.route('/employees')
	.get(protect, facilitatorCheck, facilitatorEmployees);

facilitatorRouter
	.route('/add_employee')
	.post(protect, facilitatorCheck, facilitatorAddEmployee);

facilitatorRouter
	.route('/nearby_trainers')
	.post(protect, facilitatorCheck, facilitatorGetNearbyTrainer);

facilitatorRouter
	.route('/add_img')
	.post(
		protect,
		facilitatorCheck,
		uploadMultiple,
		uploadMultipleToS3,
		facilitatorFacilityImage
	);

facilitatorRouter
	.route('/add_review')
	.post(protect, facilityReviewerCheck, facilityReview);

facilitatorRouter
	.route('/delete_img')
	.delete(
		protect,
		facilitatorCheck,
		facilitatorDeleteFacilityImage,
		deleteFile
	);

export { facilitatorRouter };
