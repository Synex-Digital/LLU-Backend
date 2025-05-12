import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
	parentAddChildren,
	parentCheck,
	parentChildrenInfo,
	parentEditChildren,
	parentGetIndividualChildren,
	parentHome,
} from '../controllers/parentController.js';
import {
	athleteAddFavoriteFacility,
	athleteAddFavoriteTrainer,
	athleteAppointments,
	athleteCheckSession,
	athleteFavoriteTrainer,
	athleteFilterFacilities,
	athleteFilterTrainer,
	athleteGetFavoriteFacility,
	athleteNearbyFacilities,
	athleteProfile,
	athleteRemoveFavoriteFacility,
	athleteRemoveFavoriteTrainer,
	athleteSearchFacilityByName,
	athleteSearchTrainerByName,
	athleteTopTrainer,
	athleteUpcomingSessions,
} from '../controllers/athleteControllers.js';
import {
	trainerAvailability,
	trainerProfile,
	trainerReviews,
	trainerStatistics,
} from '../controllers/trainerControllers.js';
import {
	athleteFacilityDetails,
	athleteFacilityEmployees,
	athleteFacilityImages,
	athleteFacilityReviews,
	facilitySessionDetails,
	facilitySessionTrainer,
	facilitySuggestions,
} from '../controllers/facilitatorControllers.js';
import {
	userAddReview,
	userAddReviewImg,
} from '../controllers/usersControllers.js';
import { uploadFile, uploadToS3 } from '../middleware/uploadMiddleware.js';

const parentRouter = Router();

parentRouter
	.route('/home')
	.post(
		protect,
		parentCheck,
		athleteTopTrainer,
		athleteNearbyFacilities,
		parentHome
	);

parentRouter
	.route('/search_trainer')
	.post(protect, parentCheck, athleteFilterTrainer);

parentRouter
	.route('/search_facility')
	.post(protect, parentCheck, athleteFilterFacilities);

parentRouter
	.route('/search_by_facility_name')
	.post(protect, parentCheck, athleteSearchFacilityByName);

parentRouter
	.route('/search_by_trainer_name')
	.post(protect, parentCheck, athleteSearchTrainerByName);

parentRouter
	.route('/favorites')
	.get(
		protect,
		parentCheck,
		athleteGetFavoriteFacility,
		athleteFavoriteTrainer
	);

parentRouter
	.route('/add_favorite_trainer')
	.post(protect, parentCheck, athleteAddFavoriteTrainer);

parentRouter
	.route('/remove_favorite_trainer')
	.delete(protect, parentCheck, athleteRemoveFavoriteTrainer);

parentRouter
	.route('/remove_favorite_facility')
	.delete(protect, parentCheck, athleteRemoveFavoriteFacility);

parentRouter
	.route('/add_favorite_facility')
	.post(protect, parentCheck, athleteAddFavoriteFacility);

parentRouter
	.route('/appointments')
	.get(protect, parentCheck, athleteAppointments);

parentRouter
	.route('/session/:session_id')
	.get(
		protect,
		parentCheck,
		athleteCheckSession,
		facilitySessionDetails,
		facilitySessionTrainer
	);

parentRouter
	.route('/profile')
	.post(
		protect,
		parentCheck,
		parentChildrenInfo,
		athleteProfile,
		athleteUpcomingSessions
	);

parentRouter
	.route('/children')
	.post(protect, parentCheck, parentAddChildren)
	.patch(protect, parentCheck, parentEditChildren);

parentRouter
	.route('/individual_children')
	.post(protect, parentCheck, parentGetIndividualChildren);

parentRouter
	.route('/trainer_profile')
	.post(
		protect,
		parentCheck,
		trainerProfile,
		trainerStatistics,
		trainerAvailability,
		facilitySuggestions,
		trainerReviews
	);

parentRouter
	.route('/facility/:facility_id')
	.get(
		protect,
		parentCheck,
		athleteFacilityDetails,
		athleteFacilityEmployees,
		athleteFacilityImages,
		athleteFacilityReviews
	);

parentRouter
	.route('/add_review_trainer')
	.post(protect, parentCheck, userAddReview);

parentRouter
	.route('/review_trainer_add_img')
	.post(protect, parentCheck, uploadFile, uploadToS3, userAddReviewImg);

export { parentRouter };
