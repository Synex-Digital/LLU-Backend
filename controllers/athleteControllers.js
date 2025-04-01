import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';
import { arrayCompare } from '../utilities/arrayCompare.js';

const athleteFeaturedTrainer = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	const { user_id, type } = req.user;
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
	let [featuredTrainer] = await pool.query(
		`SELECT
			t.trainer_id,
			u.profile_picture,
			u.img,
			u.first_name,
			u.last_name,
			t.specialization,
			t.specialization_level,
			t.hourly_rate,
			COALESCE(AVG(r.rating), 0) AS avg_rating,
			CASE 
				WHEN ft.trainer_id IS NOT NULL THEN 1
				ELSE 0
			END AS is_favorite
		FROM
			users u
		INNER JOIN
			trainers t ON u.user_id = t.user_id
		LEFT JOIN
			review_trainer r ON t.trainer_id = r.trainer_id
		LEFT JOIN
			favorite_trainer ft ON t.trainer_id = ft.trainer_id
								AND ft.user_id = ?
		WHERE 
			ST_Distance_Sphere(
				POINT(u.longitude, u.latitude),
				POINT(?, ?)
			) <= 16093.4
		GROUP BY
			t.trainer_id
		ORDER BY
			no_of_students DESC
		LIMIT ? OFFSET ?`,
		[user_id, longitude, latitude, limit, offset]
	);
	if (type === 'facilitator') {
		featuredTrainer = featuredTrainer.map(
			({ is_favorite, ...rest }) => rest
		);
	}
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
			COALESCE(AVG(rt.rating), 0) AS avg_rating
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
	//TODO have to include query in production
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
			COALESCE(AVG(rf.rating), 0) AS avg_rating
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
	const { user_id } = req.user;
	const [[availableChat]] = await pool.query(
		`SELECT
			*
		FROM
			chats
		WHERE
			user_id = ?`,
		[user_id]
	);
	if (!availableChat) {
		res.status(200).json({
			page,
			limit,
			data: {
				newMessages: 0,
				topTrainer: req.topTrainer,
				nearbyFacilities: req.nearbyFacilities,
			},
		});
		return;
	}
	const [[{ new_messages }]] = await pool.query(
		`SELECT
			new_messages
		FROM
			chats
		WHERE
			user_id = ?`,
		[user_id]
	);
	console.log(new_messages);
	res.status(200).json({
		page,
		limit,
		data: {
			newMessages: new_messages,
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
	let {
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
	if (!specialization || !gender || !available || !latitude || !longitude) {
		res.status(400).json({
			message: 'Missing values in request body',
		});
		return;
	}
	if (!starting_hourly_rate) starting_hourly_rate = 1;
	if (!starting_ratings) starting_ratings = 0;
	if (!ending_ratings) ending_ratings = 5;
	if (!ending_hourly_rate) {
		const [[{ highest_hourly_rate }]] = await pool.query(
			`SELECT
				MAX(hourly_rate) AS highest_hourly_rate
			FROM
				trainers`
		);
		ending_hourly_rate = highest_hourly_rate + 1;
	}
	const offset = (page - 1) * limit;
	const [filteredTrainer] = await pool.query(
		`SELECT
			t.trainer_id,
			u.img,
			u.first_name,
			u.last_name,
			u.latitude,
			u.longitude,
			COALESCE(r.avg_rating, 0) AS avg_rating,
			COALESCE(r.no_of_ratings, 0) AS no_of_ratings
		FROM
			users u
		INNER JOIN
			trainers t ON u.user_id = t.user_id
		LEFT JOIN
			trainer_availability_hours tah ON t.trainer_id = tah.trainer_id
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
			) r ON t.trainer_id = r.trainer_id
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
			tah.available = 1
		GROUP BY
			u.user_id
		ORDER BY
			avg_rating DESC
		LIMIT ? OFFSET ?;`,
		[
			longitude,
			latitude,
			specialization,
			starting_hourly_rate,
			ending_hourly_rate,
			starting_ratings,
			ending_ratings,
			gender,
			available,
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

const athleteFilterFacilities = expressAsyncHandler(async (req, res) => {
	const { amenities, availability } = req.body;
	if (!Array.isArray(amenities) || !Array.isArray(availability)) {
		return res.status(400).json({
			message: 'amenities or availability is of the wrong datatype',
		});
	}
	if (amenities.length === 0 && availability.length === 0) {
		return res.status(400).json({
			message: 'amenities and availability both cannot be empty',
		});
	}
	const [facilities] = await pool.query(`
		SELECT
			f.facility_id,
			f.name,
			f.latitude,
			f.longitude,
			COUNT(DISTINCT rf.review_facility_id) as no_of_reviews,
			COALESCE(AVG(rf.rating), 0) as avg_rating,
			GROUP_CONCAT(DISTINCT a.name SEPARATOR ',') AS amenities,
			GROUP_CONCAT(DISTINCT fah.week_day SEPARATOR ',') AS week_days,
			GROUP_CONCAT(DISTINCT fi.img SEPARATOR ',') AS images
		FROM
			facilities f
		LEFT JOIN
			review_facility rf ON f.facility_id = rf.facility_id
		LEFT JOIN
			facility_img fi ON f.facility_id = fi.facility_id
		LEFT JOIN
			amenities a ON f.facility_id = a.facility_id
		LEFT JOIN
			facility_availability_hours fah ON f.facility_id = fah.facility_id
		WHERE
			fah.available = 1
		GROUP BY
			f.facility_id, f.name, f.latitude, f.longitude
	`);
	const filteredFacilities = facilities
		.filter((facility) => {
			const facilityAmenities = facility.amenities
				? facility.amenities.split(',')
				: [];
			const facilityWeekDays = facility.week_days
				? facility.week_days.split(',')
				: [];
			return (
				arrayCompare(amenities, facilityAmenities) &&
				arrayCompare(availability, facilityWeekDays)
			);
		})
		.map(({ amenities, week_days, ...facility }) => ({
			...facility,
			images: facility.images ? facility.images.split(',') : [],
		}));
	res.status(200).json(filteredFacilities);
});

const athleteSearchFacilityByName = expressAsyncHandler(async (req, res) => {
	const { name } = req.body;
	const [facilities] = await pool.query(
		`SELECT
			f.facility_id,
			f.name,
			f.latitude,
			f.longitude,
			COUNT(DISTINCT rf.review_facility_id) as no_of_reviews,
			COALESCE(AVG(rf.rating), 0) as avg_rating,
			GROUP_CONCAT(DISTINCT a.name SEPARATOR ',') AS amenities,
			GROUP_CONCAT(DISTINCT fah.week_day SEPARATOR ',') AS week_days,
			GROUP_CONCAT(DISTINCT fi.img SEPARATOR ',') AS images
		FROM
			facilities f
		LEFT JOIN
			review_facility rf ON f.facility_id = rf.facility_id
		LEFT JOIN
			facility_img fi ON f.facility_id = fi.facility_id
		LEFT JOIN
			amenities a ON f.facility_id = a.facility_id
		LEFT JOIN
			facility_availability_hours fah ON f.facility_id = fah.facility_id
		WHERE
			f.name LIKE ?
		GROUP BY
			f.facility_id, f.name, f.latitude, f.longitude`,
		[`%${name}%`]
	);
	res.status(200).json({
		data: {
			facilities,
		},
	});
});

const athleteEditProfile = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { latitude, longitude, short_description, first_name, last_name } =
		req.body;
	if (
		!latitude ||
		!longitude ||
		!short_description ||
		!first_name ||
		!last_name
	) {
		res.status(400).json({
			message: 'Missing attributes',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`UPDATE
			users
		SET
			latitude = ?,
			longitude = ?,
			short_description = ?,
			first_name = ?,
			last_name = ?
		WHERE
			user_id = ?`,
		[latitude, longitude, short_description, first_name, last_name, user_id]
	);
	if (affectedRows === 0) throw new Error('Failed to update profile');
	if (req.file) {
		const [{ affectedRows }] = await pool.query(
			`UPDATE
				users
			SET
				img = ?
			WHERE
				user_id = ?`,
			[req.filePath, user_id]
		);
		if (affectedRows === 0)
			throw new Error('Failed to update profile image');
	}
	res.status(200).json({
		message: 'Successfully updated athlete profile',
	});
});

const athleteFavoriteTrainer = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const { user_id } = req.user;
	const [favoriteTrainers] = await pool.query(
		`SELECT
			t.trainer_id,
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
	res.status(200).json({
		page,
		limit,
		data: {
			favoriteTrainers,
			favoriteFacility: req.favoriteFacility,
		},
	});
});

const athleteAddFavoriteTrainer = expressAsyncHandler(async (req, res) => {
	const { trainer_id } = req.body;
	const { user_id } = req.user;
	if (!trainer_id || typeof trainer_id !== 'number') {
		res.status(400).json({
			message: 'Trainer id is missing',
		});
		return;
	}
	const [[trainerAvailable]] = await pool.query(
		`SELECT * FROM trainers WHERE trainer_id = ?`,
		[trainer_id]
	);
	if (!trainerAvailable) {
		res.status(400).json({
			message: 'There is no trainer by trainer_id',
		});
		return;
	}
	const [[favoriteTrainerAvailable]] = await pool.query(
		`SELECT * FROM favorite_trainer WHERE trainer_id = ? AND user_id = ?`,
		[trainer_id, user_id]
	);
	if (favoriteTrainerAvailable) {
		res.status(403).json({
			message: 'Already added',
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
	const { trainer_id } = req.body;
	if (!trainer_id || typeof trainer_id !== 'number') {
		res.status(400).json({
			message: 'Trainer id is missing or of wrong datatype',
		});
		return;
	}
	const [[trainerAvailable]] = await pool.query(
		`SELECT * FROM trainers WHERE trainer_id = ?`,
		[trainer_id]
	);
	if (!trainerAvailable) {
		res.status(400).json({
			message: 'There is no trainer by this trainer_id',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM favorite_trainer WHERE user_id = ? AND trainer_id = ?;`,
		[user_id, trainer_id]
	);
	if (affectedRows === 0) {
		res.status(403).json({
			message: 'Already deleted',
		});
		return;
	}
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
			fs.user_id = ?
		AND
			fs.end_time > NOW()
		AND
			fs.start_time > NOW()`,
		[user_id]
	);
	req.upcomingSessions = upcomingSessions;
	res.status(200).json({
		data: {
			profile: req.profile,
			children: req?.children?.length ? null : req.children,
			upcomingSessions: req.upcomingSessions,
		},
	});
});

const athleteAppointments = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const [appointments] = await pool.query(
		`SELECT
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate,
			COALESCE(AVG(rf.rating), 0) AS avg_rating,
			CASE 
				WHEN fs.start_time > NOW() THEN 'upcoming'
				WHEN fs.start_time <= NOW() AND fs.end_time >= NOW() THEN 'ongoing'
				ELSE 'completed'
			END AS session_status,
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture
		FROM
			facility_sessions fs
		LEFT JOIN
			facilities f ON fs.facility_id = f.facility_id
		LEFT JOIN
			review_facility rf ON f.facility_id = rf.facility_id
		LEFT JOIN
			trainer_sessions ts ON fs.facility_sessions_id = ts.facility_sessions_id
		LEFT JOIN
			trainers t ON ts.trainer_id = t.trainer_id
		LEFT JOIN
			users u ON t.user_id = u.user_id
		WHERE
			fs.user_id = ?
		GROUP BY
			fs.facility_sessions_id,
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate
		ORDER BY
			fs.start_time`,
		[user_id]
	);
	res.status(200).json({
		data: {
			appointments,
		},
	});
});

const athleteGetFavoriteFacility = expressAsyncHandler(
	async (req, res, next) => {
		let { page, limit } = req.query;
		page = parseInt(page) || 1;
		limit = parseInt(limit) || 10;
		const offset = (page - 1) * limit;
		const { user_id } = req.user;
		const [favoriteFacility] = await pool.query(
			`SELECT
				f.facility_id,
				f.hourly_rate,
				f.name,
				f.latitude,
				f.longitude,
				fi.img,
				COALESCE(AVG(rf.rating), 0) AS avg_rating
			FROM
				favorite_facility ff
			LEFT JOIN
				facilities f ON ff.facility_id = f.facility_id
			LEFT JOIN
				facility_img fi ON f.facility_id = fi.facility_id
			LEFT JOIN
				review_facility rf ON f.facility_id = rf.facility_id
			WHERE
				ff.user_id = ?
			GROUP BY
				f.facility_id,
				f.hourly_rate,
				f.name,
				f.latitude,
				f.longitude,
				fi.img
			LIMIT ? OFFSET ?`,
			[user_id, limit, offset]
		);
		req.favoriteFacility = favoriteFacility;
		console.log(favoriteFacility);
		next();
	}
);

const athleteAddFavoriteFacility = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { facility_id } = req.body;
	if (!facility_id || typeof facility_id !== 'number') {
		res.status(400).json({
			message: 'Facility id is missing or of wrong datatype',
		});
		return;
	}
	const [[facilityAvailable]] = await pool.query(
		`SELECT * FROM facilities WHERE facility_id = ?`,
		[facility_id]
	);
	if (!facilityAvailable) {
		res.status(400).json({
			message: 'There is no facility by facility id',
		});
		return;
	}
	const [[favoriteFacilityAvailable]] = await pool.query(
		`SELECT * FROM favorite_facility WHERE facility_id = ? AND user_id = ?`,
		[facility_id, user_id]
	);
	if (favoriteFacilityAvailable) {
		res.status(403).json({
			message: 'Already added',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO favorite_facility (user_id, facility_id) VALUES (?, ?)`,
		[user_id, facility_id]
	);
	if (affectedRows === 0) throw new Error('Failed to add favorite facility');
	res.status(200).json({
		message: 'Successfully added favorite facility',
	});
});

const athleteRemoveFavoriteFacility = expressAsyncHandler(async (req, res) => {
	const { facility_id } = req.body;
	if (!facility_id || typeof facility_id !== 'number') {
		res.status(400).json({
			message: 'facility id is missing or of wrong datatype',
		});
		return;
	}
	const [[facilityAvailable]] = await pool.query(
		`SELECT * FROM facilities WHERE facility_id = ?`,
		[facility_id]
	);
	if (!facilityAvailable) {
		res.status(400).json({
			message: 'There is no facility by facility id',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM favorite_facility WHERE facility_id = ?`,
		[facility_id]
	);
	if (affectedRows === 0) {
		res.status(403).json({
			message: 'Already deleted',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully removed favorite facility',
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
	athleteEditProfile,
	athleteFilterFacilities,
	athleteAppointments,
	athleteAddFavoriteFacility,
	athleteGetFavoriteFacility,
	athleteRemoveFavoriteFacility,
	athleteSearchFacilityByName,
};
