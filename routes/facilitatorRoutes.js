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
import { uploadMultiple } from '../middleware/uploadMiddleware.js';
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

facilitatorRouter
	.route('/:facilitator_id/add_facility')
	.post(
		protect,
		facilitatorCheck,
		facilitatorAddFacility,
		facilitatorAssignEmployee,
		facilitatorAddAmenities
	);

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
	.post(protect, facilitatorCheck, uploadMultiple, facilitatorFacilityImage);

facilitatorRouter
	.route('/:facility_id/add_review')
	.post(protect, facilityReviewerCheck, facilityReview);

facilitatorRouter
	.route('/delete_img/:facility_img_id')
	.delete(protect, facilitatorCheck, facilitatorDeleteFacilityImage);

//TODO search inside add trainer
//TODO populate all database
//TODO have to make sure if something is not created nothing is created in facility add
//TODO create facility edit image route
//TODO have to create route for ongoing, upcoming and history see all
//TODO have to count no of pages in pagination
//TODO have to create notification route
//TODO single facility image delete and fetch previous
//TODO change email
//TODO like and unlike
//TODO can comment
//TODO community profile other individual
//TODO user follow other
//TODO search
//TODO remove facility description

export { facilitatorRouter };
