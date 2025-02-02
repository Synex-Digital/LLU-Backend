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
	athleteFavoriteTrainer,
	athleteFilterFacilities,
	athleteFilterTrainer,
	athleteGetFavoriteFacility,
	athleteNearbyFacilities,
	athleteProfile,
	athleteRemoveFavoriteFacility,
	athleteRemoveFavoriteTrainer,
	athleteSearchFacilityByName,
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
	facilitySuggestions,
} from '../controllers/facilitatorControllers.js';

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
	.route('/search')
	.post(protect, parentCheck, athleteSearchFacilityByName);

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
	.route('/facility_details')
	.post(
		protect,
		parentCheck,
		athleteFacilityDetails,
		athleteFacilityEmployees,
		athleteFacilityImages,
		athleteFacilityReviews
	);

export { parentRouter };
