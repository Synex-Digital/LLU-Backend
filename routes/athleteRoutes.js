import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
	athleteAddFavoriteFacility,
	athleteAddFavoriteTrainer,
	athleteAppointments,
	athleteCheck,
	athleteCheckSession,
	athleteEditProfile,
	athleteFavoriteTrainer,
	athleteFeaturedTrainer,
	athleteFilterFacilities,
	athleteFilterTrainer,
	athleteGetFavoriteFacility,
	athleteHome,
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
	userAddReview,
	userAddReviewImg,
} from '../controllers/usersControllers.js';
import { uploadFile, uploadToS3 } from '../middleware/uploadMiddleware.js';
import {
	athleteFacilityDetails,
	athleteFacilityEmployees,
	athleteFacilityImages,
	athleteFacilityReviews,
	facilitySessionDetails,
	facilitySessionTrainer,
	facilitySuggestions,
} from '../controllers/facilitatorControllers.js';

const athleteRouter = Router();

athleteRouter
	.route('/home')
	.post(
		protect,
		athleteCheck,
		athleteFeaturedTrainer,
		athleteTopTrainer,
		athleteNearbyFacilities,
		athleteHome
	);

athleteRouter
	.route('/search_trainer')
	.post(protect, athleteCheck, athleteFilterTrainer);

athleteRouter
	.route('/search_facility')
	.post(protect, athleteCheck, athleteFilterFacilities);

athleteRouter
	.route('/search_by_facility_name')
	.post(protect, athleteCheck, athleteSearchFacilityByName);

athleteRouter
	.route('/search_by_trainer_name')
	.post(protect, athleteCheck, athleteSearchTrainerByName);

athleteRouter
	.route('/favorites')
	.get(
		protect,
		athleteCheck,
		athleteGetFavoriteFacility,
		athleteFavoriteTrainer
	);

athleteRouter
	.route('/add_favorite_trainer')
	.post(protect, athleteCheck, athleteAddFavoriteTrainer);

athleteRouter
	.route('/remove_favorite_trainer')
	.delete(protect, athleteCheck, athleteRemoveFavoriteTrainer);

athleteRouter
	.route('/add_favorite_facility')
	.post(protect, athleteCheck, athleteAddFavoriteFacility);

athleteRouter
	.route('/remove_favorite_facility')
	.delete(protect, athleteCheck, athleteRemoveFavoriteFacility);

athleteRouter
	.route('/profile')
	.get(protect, athleteCheck, athleteProfile, athleteUpcomingSessions)
	.patch(protect, athleteCheck, uploadFile, uploadToS3, athleteEditProfile);

athleteRouter
	.route('/trainer_profile')
	.post(
		protect,
		athleteCheck,
		trainerProfile,
		trainerStatistics,
		trainerAvailability,
		facilitySuggestions,
		trainerReviews
	);

athleteRouter
	.route('/add_review_trainer')
	.post(protect, athleteCheck, userAddReview);

athleteRouter
	.route('/review_trainer_add_img')
	.post(protect, athleteCheck, uploadFile, uploadToS3, userAddReviewImg);

athleteRouter
	.route('/facility/:facility_id')
	.get(
		protect,
		athleteCheck,
		athleteFacilityDetails,
		athleteFacilityEmployees,
		athleteFacilityImages,
		athleteFacilityReviews
	);

athleteRouter
	.route('/appointments')
	.get(protect, athleteCheck, athleteAppointments);

athleteRouter
	.route('/session/:session_id')
	.get(
		protect,
		athleteCheck,
		athleteCheckSession,
		facilitySessionDetails,
		facilitySessionTrainer
	);

export { athleteRouter };
