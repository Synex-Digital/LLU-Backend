import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';

const athleteFeaturedTrainer = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	const { latitude, longitude } = req.body;
	if (!latitude || !longitude) {
		res.status(400).json({
			message: 'Latitude or longitude is missing',
		});
		return;
	}
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [featuredTrainer] = await pool.query(
		`SELECT
			t.trainer_id,
			t.specialization,
			t.specialization_level,
			t.hourly_rate,
			AVG(r.rating) as avg_rating
		FROM
			users u
		INNER JOIN
			trainers t
		LEFT JOIN
			review_trainer r ON t.trainer_id = r.trainer_id
		WHERE 
			ST_Distance_Sphere(
				POINT(u.longitude, u.latitude),
				POINT(?, ?)
			) <= 16093.4
		GROUP BY
			t.trainer_id
		ORDER BY
			no_of_students DESC
		LIMIT ? OFFSET ?;`,
		[longitude, latitude, limit, offset]
	);
	req.featuredTrainer = featuredTrainer;
	next();
});

const athleteTopTrainer = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	const { latitude, longitude } = req.body;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [topTrainer] = await pool.query(
		`SELECT
			t.trainer_id,
			u.profile_picture,
			u.img, 
			u.first_name, 
			u.last_name, 
			AVG(rt.rating) AS average_rating
		FROM 
			users u
		INNER JOIN 
			trainers t ON u.user_id = t.user_id
		LEFT JOIN 
			review_trainer rt ON t.trainer_id = rt.trainer_id
		WHERE 
			ST_Distance_Sphere(
				POINT(u.longitude, u.latitude),
				POINT(?, ?)
			) <= 16093.4
		GROUP BY 
			u.user_id
		ORDER BY 
			rt.rating DESC
		LIMIT ? OFFSET ?;`,
		[longitude, latitude, limit, offset]
	);
	/**
	 * AND 
		rt.time >= NOW() - INTERVAL 1 WEEK
	 */
	req.topTrainer = topTrainer;
	next();
});

//TODO have to include amenities for each facility
const athleteNearbyFacilities = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	const { latitude, longitude } = req.body;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [nearbyFacilities] = await pool.query(
		`SELECT
			f.facility_id,
			f.hourly_rate,
			f.name,
			f.latitude,
			f.longitude,
			fi.img,
			AVG(COALESCE(rf.rating, 0)) AS avg_rating
		FROM
			facilities f
		LEFT JOIN
			facility_img fi ON f.facility_id = fi.facility_id
		LEFT JOIN
			review_facility rf ON f.facility_id = rf.facility_id
		WHERE 
			ST_Distance_Sphere(
				POINT(f.longitude, f.latitude),
				POINT(?, ?)
			) <= 16093.4
		GROUP BY 
			f.facility_id
		LIMIT ? OFFSET ?;`,
		[longitude, latitude, limit, offset]
	);
	req.nearbyFacilities = nearbyFacilities;
	next();
});

const athleteCheck = expressAsyncHandler((req, res, next) => {
	const { type } = req.user;
	if (type !== 'athlete') {
		res.status(403).json({
			message: 'Not a valid user of athlete type',
		});
		return;
	}
	next();
});

const athleteHome = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	res.status(200).json({
		page,
		limit,
		data: {
			featuredTrainer: req.featuredTrainer,
			topTrainer: req.topTrainer,
			nearbyFacilities: req.nearbyFacilities,
		},
	});
});

const athleteFilterTrainer = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const {
		specialization,
		starting_hourly_rate,
		ending_hourly_rate,
		starting_ratings,
		ending_ratings,
		gender,
		available,
		longitude,
		latitude,
	} = req.body;
	if (
		!specialization ||
		!starting_hourly_rate ||
		!ending_hourly_rate ||
		!starting_ratings ||
		!ending_ratings ||
		!gender ||
		!available
	) {
		res.status(400).json({
			message: 'Missing values in request body',
		});
		return;
	}
	const offset = (page - 1) * limit;
	const [filteredTrainer] = await pool.query(
		`SELECT
			t.trainer_id,
			u.first_name,
			u.last_name,
			u.latitude,
			u.longitude,
			r.avg_rating AS avg_rating,
			r.no_of_ratings AS no_of_ratings,
			ST_Distance_Sphere(
				POINT(u.longitude, u.latitude),
				POINT(?, ?)
			) AS distance
		FROM
			users u
		INNER JOIN
			trainers t ON u.user_id = t.user_id
		LEFT JOIN
			(
				SELECT
					rt.trainer_id,
					AVG(rt.rating) AS avg_rating,
					COUNT(DISTINCT rt.review_trainer_id) AS no_of_ratings
				FROM
					review_trainer rt
				GROUP BY
					rt.trainer_id
				HAVING
					COUNT(DISTINCT rt.review_trainer_id) > 0
			) r ON t.trainer_id = r.trainer_id
		LEFT JOIN
			trainer_availability_hours tah ON t.trainer_id = tah.trainer_id
		WHERE 
			ST_Distance_Sphere(
				POINT(u.longitude, u.latitude),
				POINT(?, ?)
			) <= 16093.4
		AND
			t.specialization = ?
		AND
			t.hourly_rate BETWEEN ? AND ?
		AND
			r.avg_rating BETWEEN ? AND ?
		AND
			t.gender = ?
		AND
			tah.week_day = ?
		AND
			tah.available_hours <> ?
		GROUP BY
			u.user_id
		ORDER BY
			avg_rating DESC
		LIMIT ? OFFSET ?;`,
		[
			longitude,
			latitude,
			longitude,
			latitude,
			specialization,
			starting_hourly_rate,
			ending_hourly_rate,
			starting_ratings,
			ending_ratings,
			gender,
			available,
			'Not available',
			limit,
			offset,
		]
	);
	if (filteredTrainer.length === 0) {
		res.status(404).json({
			message: 'There are no trainers by this filter',
		});
		return;
	}
	res.status(200).json({
		page,
		limit,
		data: filteredTrainer,
	});
});

//TODO have to add facility favorites too
const athleteFavoriteTrainer = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const { user_id } = req.user;
	const [favoriteTrainers] = await pool.query(
		`SELECT
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			t.hourly_rate,
			t.specialization,
			t.specialization_level
		FROM
			favorite_trainer ft
		LEFT JOIN
			trainers t ON ft.trainer_id = t.trainer_id
		LEFT JOIN
			users u ON t.user_id = u.user_id
		WHERE
			ft.user_id = ?
		LIMIT ? OFFSET ?`,
		[user_id, limit, offset]
	);
	if (favoriteTrainers.length === 0) {
		res.status(404).json({
			message: 'There is no favorite trainer for this athlete',
		});
		return;
	}
	res.status(200).json({
		page,
		limit,
		data: favoriteTrainers,
	});
});

const athleteAddFavoriteTrainer = expressAsyncHandler(async (req, res) => {
	const { trainer_id } = req.params;
	const { user_id } = req.user;
	if (!trainer_id) {
		res.status(400).json({
			message: 'Trainer id is missing',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO favorite_trainer (user_id, trainer_id) VALUES (?, ?)`,
		[user_id, trainer_id]
	);
	if (affectedRows === 0) throw new Error('Failed to add favorite trainer');
	res.status(200).json({
		message: 'Successfully added favorite trainer',
	});
});

//TODO have to handle favorite duplication
const athleteRemoveFavoriteTrainer = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { trainer_id } = req.params;
	if (!trainer_id) {
		res.status(400).json({
			message: 'Trainer id is not provided in url',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM favorite_trainer WHERE user_id = ? AND trainer_id = ?;`,
		[user_id, trainer_id]
	);
	if (affectedRows === 0) throw new Error('Failed to remove favorite');
	res.status(200).json({
		message: 'Successfully removed favorite',
	});
});

//TODO have to include trainer session
const athleteProfile = expressAsyncHandler(async (req, res, next) => {
	const {
		user_id,
		socket_id,
		google_id,
		level,
		email,
		password,
		no_of_sessions,
		phone,
		...filteredProfile
	} = req.user;
	req.profile = filteredProfile;
	next();
});

const athleteUpcomingSessions = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const [upcomingSessions] = await pool.query(
		`SELECT
			fs.facility_sessions_id,
			fs.name,
			fs.description,
			fa.latitude,
			fa.longitude,
			fs.start_time,
			fs.end_time
		FROM
			facility_sessions fs
		LEFT JOIN
			facilities fa ON fs.facility_id = fa.facility_id
		WHERE
			fs.user_id = ?`,
		[user_id]
	);
	req.upcomingSessions = upcomingSessions;
	res.status(200).json({
		data: {
			profile: req.profile,
			upcomingSessions: req.upcomingSessions,
		},
	});
});

export {
	athleteHome,
	athleteCheck,
	athleteFilterTrainer,
	athleteFavoriteTrainer,
	athleteRemoveFavoriteTrainer,
	athleteProfile,
	athleteUpcomingSessions,
	athleteFeaturedTrainer,
	athleteTopTrainer,
	athleteNearbyFacilities,
	athleteAddFavoriteTrainer,
};
