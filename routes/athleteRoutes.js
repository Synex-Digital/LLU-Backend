import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
	athleteAddFavoriteTrainer,
	athleteCheck,
	athleteFavoriteTrainer,
	athleteFeaturedTrainer,
	athleteFilterTrainer,
	athleteHome,
	athleteNearbyFacilities,
	athleteProfile,
	athleteRemoveFavoriteTrainer,
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

//TODO have to include facility filter

athleteRouter
	.route('/favorites')
	.get(protect, athleteCheck, athleteFavoriteTrainer);

athleteRouter
	.route('/add_favorite/:trainer_id')
	.get(protect, athleteAddFavoriteTrainer);

//TODO have to include facility favorite
athleteRouter
	.route('/remove_favorite_trainer/:trainer_id')
	.delete(protect, athleteCheck, athleteRemoveFavoriteTrainer);

athleteRouter
	.route('/profile')
	.get(protect, athleteCheck, athleteProfile, athleteUpcomingSessions);

athleteRouter
	.route('/trainer/:trainer_id')
	.get(
		protect,
		athleteCheck,
		trainerProfile,
		trainerStatistics,
		trainerAvailability,
		trainerReviews
	);

athleteRouter
	.route('/:trainer_id/add_review')
	.post(protect, athleteCheck, userAddReview);

athleteRouter
	.route('/:review_id/add_img')
	.post(protect, athleteCheck, uploadFile, uploadToS3, userAddReviewImg);

athleteRouter
	.route('/suggested_facilities')
	.post(protect, athleteCheck, facilitySuggestions);

athleteRouter
	.route('/facility_details')
	.post(
		protect,
		athleteCheck,
		athleteFacilityDetails,
		athleteFacilityEmployees,
		athleteFacilityImages,
		athleteFacilityReviews
	);

export { athleteRouter };
