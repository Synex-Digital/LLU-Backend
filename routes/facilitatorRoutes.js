import { Router } from 'express';
import {
	facilitatorAddAmenities,
	facilitatorAddEmployee,
	facilitatorAddFacility,
	facilitatorAllReview,
	facilitatorAssignEmployee,
	facilitatorCheck,
	facilitatorCompletedSessions,
	facilitatorDetails,
	facilitatorEdit,
	facilitatorEmployees,
	facilitatorFacilityImage,
	facilitatorFetch,
	facilitatorGetNearbyTrainer,
	facilitatorOngoingSessions,
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
	.post(
		protect,
		facilitatorCheck,
		facilityDetails,
		athleteFeaturedTrainer,
		facilityList,
		facilitatorAllReview
	);

facilitatorRouter
	.route('/facility/:facility_id')
	.get(
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

//TODO have to fix facilitator_id
facilitatorRouter
	.route('/:facilitator_id/add_facility')
	.post(protect, facilitatorCheck, facilitatorAddFacility);

facilitatorRouter
	.route('/:facility_id/add_employee')
	.post(protect, facilitatorCheck, facilitatorAssignEmployee);

//TODO have to shift to post when posting data
facilitatorRouter
	.route('/:facility_id/add_amenities')
	.post(protect, facilitatorCheck, facilitatorAddAmenities);

facilitatorRouter
	.route('/:facilitator_id/employees')
	.get(protect, facilitatorCheck, facilitatorEmployees);

facilitatorRouter
	.route('/:facilitator_id/add_employee/:trainer_id')
	.post(protect, facilitatorCheck, facilitatorAddEmployee);

facilitatorRouter
	.route('/nearby_trainers')
	.post(protect, facilitatorCheck, facilitatorGetNearbyTrainer);

facilitatorRouter
	.route('/:facility_id/add_img')
	.post(protect, facilitatorCheck, uploadFile, facilitatorFacilityImage);

facilitatorRouter
	.route('/:facility_id/add_review')
	.post(protect, facilityReviewerCheck, facilityReview);

export { facilitatorRouter };
