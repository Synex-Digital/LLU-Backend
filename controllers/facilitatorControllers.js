import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';
import { validateTimeStamp } from '../utilities/DateValidation.js';
import { start } from 'repl';

const facilitatorCheck = expressAsyncHandler(async (req, res, next) => {
	const { type, user_id } = req.user;
	if (type !== 'facilitator') {
		res.status(403).json({
			message: 'Not a valid user of facilitator type',
		});
		return;
	}
	const [[facilitator]] = await pool.query(
		`SELECT * FROM facilitators WHERE user_id = ?`,
		[user_id]
	);
	if (!facilitator) {
		res.status(403).json({
			message: 'Not a valid user of facilitator type',
		});
		return;
	}
	req.facilitator = facilitator;
	next();
});

const facilityReviewerCheck = expressAsyncHandler((req, res, next) => {
	const { type } = req.user;
	if (type !== 'facilitator') {
		next();
		return;
	}
	res.status(403).json({
		message: 'Not a valid user of athlete, trainer or parent type',
	});
});

const facilitatorAddFacility = expressAsyncHandler(async (req, res, next) => {
	const connection = await pool.getConnection();
	const {
		hourly_rate,
		name,
		latitude,
		longitude,
		capacity,
		established_in,
		available_hours,
	} = req.body;
	const { facilitator_id } = req.facilitator;
	await connection.beginTransaction();
	const [{ insertId, affectedRows }] = await connection.query(
		`INSERT INTO facilities (facilitator_id, hourly_rate, name, latitude, longitude, capacity, established_in) VALUES (?, ?, ?, ?, ?, ?, ?);`,
		[
			facilitator_id,
			hourly_rate,
			name,
			latitude,
			longitude,
			capacity,
			established_in,
		]
	);
	if (affectedRows === 0) {
		await connection.rollback();
		throw new Error('Failed to create facility');
	}
	const allowedWeeks = [
		'saturday',
		'sunday',
		'monday',
		'tuesday',
		'thursday',
		'friday',
		'wednesday',
	];
	for (const [index, day] of available_hours.entries()) {
		const { week_day, start_time, end_time, available } = day;
		if (!allowedWeeks.includes(week_day)) {
			await connection.rollback();
			connection.release();
			res.status(400).json({
				message: `Invalid weekday: ${week_day}`,
			});
			return;
		}
		if (!validateTimeStamp(start_time) || !validateTimeStamp(end_time)) {
			await connection.rollback();
			connection.release();
			res.status(400).json({
				message: `Invalid start_time or end_time format at ${week_day}`,
			});
			return;
		}
		const startTime = new Date(start_time);
		const endTime = new Date(end_time);
		if (startTime > endTime) {
			await connection.rollback();
			connection.release();
			res.status(400).json({
				message: `start_time can not be smaller than end_time at ${week_day}`,
			});
			return;
		}
		if (available !== 0 && available !== 1) {
			await connection.rollback();
			connection.release();
			res.status(400).json({
				message: `Invalid available format at ${index + 1}`,
			});
			return;
		}
		const [insertStatus] = await connection.query(
			`INSERT INTO facility_availability_hours (facility_id, week_day, start_time, end_time, available) VALUES (?, ?, ?, ?, ?)`,
			[insertId, week_day, start_time, end_time, available]
		);
		if (insertStatus.affectedRows === 0) {
			await connection.rollback();
			connection.release();
			throw new Error('Failed to insert available hours');
		}
	}
	await connection.commit();
	connection.release();
	req.facility_id = insertId;
	next();
});

const facilitatorFacilityImage = expressAsyncHandler(async (req, res) => {
	if (req.files.length === 0) {
		res.status(400).json({
			message: 'No file uploaded. Please attach a file.',
		});
		return;
	}
	const { facility_id } = req.body;
	const { filePaths } = req;
	if (!facility_id) {
		res.status(400).json({
			message: 'facility id is missing in the url',
		});
		return;
	}
	for (const path of filePaths) {
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO facility_img (facility_id, img) VALUES (?, ?)`,
			[facility_id, path]
		);
		if (affectedRows === 0)
			throw new Error('Failed to upload facility image');
	}
	res.status(201).json({
		message: 'Successfully uploaded facility image',
	});
});

// TODO: have to handle for duplicate inputs
const facilitatorAddAmenities = expressAsyncHandler(async (req, res) => {
	const { amenities } = req.body;
	if (!Array.isArray(amenities)) {
		res.status(400).json({
			message: 'Amenities is of wrong type',
		});
		return;
	}
	const { facility_id } = req;
	if (!facility_id) {
		res.status(400).json({
			message: 'facility id is missing in the url',
		});
		return;
	}
	for (let amenity of amenities) {
		amenity = amenity
			.split(' ')
			.map(
				(word) =>
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
			)
			.join(' ');
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO amenities (name, facility_id) VALUES (? ,?)`,
			[amenity, facility_id]
		);
		if (affectedRows === 0) throw new Error('Failed to insert amenity');
	}
	res.status(200).json({
		facility_id,
		message: 'Successfully added facility',
	});
});

const facilityReview = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { facility_id } = req.body;
	if (!facility_id) {
		res.status(400).json({
			message: 'facility id is missing in url',
		});
		return;
	}
	const [[availableFacility]] = await pool.query(
		`SELECT * FROM facilities WHERE facility_id = ?`,
		[facility_id]
	);
	if (!availableFacility) {
		res.status(404).json({
			message: 'There is no facility by this facility_id',
		});
		return;
	}
	const { rating, content } = req.body;
	const [[available]] = await pool.query(
		`SELECT * FROM review_facility WHERE user_id = ? AND facility_id = ?`,
		[user_id, facility_id]
	);
	if (available) {
		res.status(403).json({
			message: 'User already added review of mentioned facility',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO review_facility (user_id, rating, facility_id, content) VALUES (?, ?, ?, ?);`,
		[user_id, rating, facility_id, content]
	);
	if (affectedRows === 0)
		throw new Error('Failed to insert review for facility');
	res.status(201).json({
		message: 'Successfully inserted review for facility',
	});
});

const facilitySuggestions = expressAsyncHandler(async (req, res, next) => {
	const { latitude, longitude, trainer_id } = req.body;
	if (!latitude || !longitude) {
		res.status(400).json({
			message: 'Location is missing',
		});
		return;
	}
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [suggestedFacility] = await pool.query(
		`SELECT
			f.facility_id,
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate,
			COALESCE(AVG(rf.rating), 0) AS avg_rating,
			fi.img
		FROM
			facilities f
		LEFT JOIN
			review_facility rf ON f.facility_id = rf.facility_id
		LEFT JOIN
			facility_img fi ON f.facility_id = fi.facility_id
		WHERE 
			ST_Distance_Sphere(
				POINT(f.longitude, f.latitude),
				POINT(?, ?)
			) <= 16093.4
		GROUP BY
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate
		LIMIT ? OFFSET ?;`,
		[longitude, latitude, limit, offset]
	);
	//TODO have to finish the filtering
	const filteredSuggestedFacilities = suggestedFacility.filter(
		async (facility) => {
			const [facilityAvailable] = await pool.query(
				`SELECT
					fah.week_day,
					fah.start_time,
					fah.end_time,
					fah.available
				FROM
					facility_availability_hours fah
				WHERE
					facility_id = ?`,
				[facility.facility_id]
			);
			const { trainerAvailability } = req;
			for (const {
				week_day,
				start_time,
				end_time,
			} of facilityAvailable) {
				const availableTime = trainerAvailability.find(
					({ week_day: w }) => w === week_day
				);
				if (start_time === null || end_time === null) continue;
				const facilityStartTime = new Date(start_time);
				const facilityEndTime = new Date(end_time);
				const trainerStartTime = new Date(availableTime.start_time);
				const trainerEndTime = new Date(availableTime.end_time);
				if (!availableTime) return false;
				if (trainerEndTime < facilityStartTime) return false;
				if (trainerStartTime > facilityEndTime) return false;
			}
			return true;
		}
	);
	req.suggestedFacility = filteredSuggestedFacilities;
	next();
});

const facilitatorOngoingSessions = expressAsyncHandler(
	async (req, res, next) => {
		const { user_id } = req.user;
		let { page, limit } = req.query;
		page = parseInt(page) || 1;
		limit = parseInt(limit) || 10;
		const offset = (page - 1) * limit;
		const [ongoingSessions] = await pool.query(
			`SELECT
				fs.facility_sessions_id,
				fa.name,
				fs.description,
				fa.latitude,
				fa.longitude,
				fs.start_time,
				fs.end_time
			FROM
				facilities fa
			INNER JOIN
				facility_sessions fs ON fa.facility_id = fs.facility_id
			INNER JOIN
				facilitators f ON fa.facilitator_id = f.facilitator_id
			WHERE
				fs.start_time <= NOW()
			AND
				fs.end_time > NOW()
			AND
				f.user_id = ?
			GROUP BY
				fs.facility_sessions_id,
				fa.name,
				fs.description,
				fa.latitude,
				fa.longitude,
				fs.start_time,
				fs.end_time
			LIMIT ? OFFSET ?`,
			[user_id, limit, offset]
		);
		req.ongoingSessions = ongoingSessions;
		next();
	}
);

const facilitatorUpcomingSessions = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [upcomingSessions] = await pool.query(
		`SELECT
				fs.facility_sessions_id,
				fa.name,
				fs.description,
				fa.latitude,
				fa.longitude,
				fs.start_time,
				fs.end_time
			FROM
				facilities fa
			INNER JOIN
				facility_sessions fs ON fa.facility_id = fs.facility_id
			INNER JOIN
				facilitators f ON fa.facilitator_id = f.facilitator_id
			WHERE
				fs.start_time > NOW()
			AND
				fs.end_time > NOW()
			AND
				f.user_id = ?
			LIMIT ? OFFSET ?`,
		[user_id, limit, offset]
	);
	res.status(200).json({
		page,
		limit,
		data: {
			ongoingSessions: req.ongoingSessions,
			upcomingSessions: upcomingSessions,
			completedSessions: req.completedSessions,
		},
	});
});

//TODO have to fix sessions group by
const facilitatorCompletedSessions = expressAsyncHandler(
	async (req, res, next) => {
		const { user_id } = req.user;
		let { page, limit } = req.query;
		page = parseInt(page) || 1;
		limit = parseInt(limit) || 10;
		const offset = (page - 1) * limit;
		const [completedSessions] = await pool.query(
			`SELECT
				fs.facility_sessions_id,
				fa.name,
				fs.description,
				fa.latitude,
				fa.longitude,
				fs.start_time,
				fs.end_time
			FROM
				facilities fa
			INNER JOIN
				facility_sessions fs ON fa.facility_id = fs.facility_id
			INNER JOIN
				facilitators f ON fa.facilitator_id = f.facilitator_id
			WHERE
				fs.start_time < NOW()
			AND
				fs.end_time <= NOW()
			AND
				f.user_id = ?
			GROUP BY
				fs.facility_sessions_id,
				fa.name,
				fs.description,
				fa.latitude,
				fa.longitude,
				fs.start_time,
				fs.end_time
			LIMIT ? OFFSET ?`,
			[user_id, limit, offset]
		);
		req.completedSessions = completedSessions;
		next();
	}
);

const facilitySessionDetails = expressAsyncHandler(async (req, res, next) => {
	const { session_id } = req.body;
	//TODO prevent user from accessing if not part of session
	const [[sessionDetails]] = await pool.query(
		`SELECT
			fs.facility_sessions_id,
			fs.name,
			fs.description,
			fs.start_time,
			fs.end_time,
			fa.latitude,
			fa.longitude,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			u.type,
			u.phone
		FROM
			facility_sessions fs
		LEFT JOIN
			users u ON fs.user_id = u.user_id
		LEFT JOIN
			facilities fa ON fs.facility_id = fa.facility_id
		WHERE
			fs.facility_sessions_id = ?`,
		[session_id]
	);
	if (!sessionDetails) {
		res.status(400).json({
			message: 'There is no session by this ID',
		});
		return;
	}
	req.sessionDetails = sessionDetails;
	next();
});

const facilitySessionTrainer = expressAsyncHandler(async (req, res) => {
	const { session_id } = req.body;
	const [[sessionTrainer]] = await pool.query(
		`SELECT
			u.first_name,
			u.last_name,
			u.type,
			u.phone
		FROM
			trainer_sessions ts
		LEFT JOIN
			trainers t ON t.trainer_id = ts.trainer_id
		INNER JOIN
			users u ON t.user_id = u.user_id
		WHERE ts.facility_sessions_id  = ?`,
		[session_id]
	);
	res.status(200).json({
		data: {
			sessionDetails: req.sessionDetails,
			trainedBy: sessionTrainer,
		},
	});
});

const facilityDetails = expressAsyncHandler(async (req, res, next) => {
	const {
		level,
		socket_id,
		google_id,
		latitude,
		longitude,
		type,
		email,
		password,
		no_of_sessions,
		phone,
		short_description,
		...filteredUser
	} = req.user;
	const [[basicInfo]] = await pool.query(
		`SELECT
			f.facilitator_id,
			MIN(fa.established_in) as established_in,
			f.no_of_professionals,
			f.iso_certified
		FROM
			facilitators f
		RIGHT JOIN
			facilities fa ON fa.facilitator_id = f.facilitator_id
		WHERE
			f.user_id = ?`,
		[filteredUser.user_id]
	);
	req.basicInfo = {
		user: filteredUser,
		details: basicInfo,
	};
	next();
});

const facilitatorProfileCompletion = expressAsyncHandler(
	async (req, res, next) => {
		const {
			user_id,
			socket_id,
			google_id,
			level,
			type,
			email,
			password,
			phone,
			no_of_sessions,
			short_description,
			...filteredUser
		} = req.user;
		console.log(filteredUser);
		let totalEmpty = 0;
		const [[{ no_of_professionals }]] = await pool.query(
			`SELECT no_of_professionals FROM facilitators`
		);
		for (const [key, value] of Object.entries(filteredUser)) {
			if (!value) totalEmpty++;
		}
		if (!no_of_professionals) totalEmpty++;
		totalEmpty = 100 - (totalEmpty / 6) * 100;
		req.profileCompletion = parseFloat(totalEmpty.toFixed(2));
		next();
	}
);

const facilityList = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 5;
	const offset = (page - 1) * limit;
	let facilitator_id = req?.basicInfo?.details?.facilitator_id;
	if (!facilitator_id) {
		facilitator_id = req.facilitator_id;
	}
	const [facilityNameList] = await pool.query(
		`SELECT
			f.facility_id,
			f.name
		FROM
			facilities f
		WHERE
			f.facilitator_id = ?
		LIMIT ? OFFSET ?`,
		[facilitator_id, limit, offset]
	);
	req.facilityNameList = facilityNameList;
	next();
});

const facilitatorAllReview = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 5;
	const offset = (page - 1) * limit;
	const { facilitator_id } = req.basicInfo.details;
	const [facilitatorReviews] = await pool.query(
		`SELECT
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			rfa.rating,
			rfa.content,
			rfa.time,
			GROUP_CONCAT(DISTINCT rfi.img SEPARATOR ',') AS images
		FROM
			review_facilitators rfa
		LEFT JOIN
			facilitators f ON rfa.facilitator_id = f.facilitator_id
		LEFT JOIN
			users u ON rfa.user_id = u.user_id
		LEFT JOIN
			review_facilitator_img rfi ON rfa.review_facilitator_id = rfi.review_facilitator_id
		WHERE
			rfa.facilitator_id = ?
		LIMIT ? OFFSET ?`,
		[facilitator_id, limit, offset]
	);
	const filteredFacilitatorReview = facilitatorReviews.map((review) => ({
		...review,
		images: review.images ? review.images.split(',') : [],
	}));
	res.status(200).json({
		page,
		limit,
		data: {
			basicInfo: req.basicInfo,
			profileCompletion: req.profileCompletion,
			facilityList: req.facilityNameList,
			trainers: req.featuredTrainer,
			reviews: filteredFacilitatorReview,
		},
	});
});

const facilityAvailableHours = expressAsyncHandler(async (req, res, next) => {
	const { facility_id } = req.body;
	const [availableHours] = await pool.query(
		`SELECT
			fah.week_day,
			fah.start_time,
			fah.end_time,
			fah.available
		FROM
			facility_availability_hours fah
		WHERE
			facility_id = ?`,
		[facility_id]
	);
	req.availableHours = availableHours;
	next();
});

//TODO have to verify all the params for SQL injection
const facilityBasicDetails = expressAsyncHandler(async (req, res, next) => {
	const { facility_id } = req.body;
	if (!facility_id) {
		res.status(400).json({
			message: 'facility id is missing in the url',
		});
		return;
	}
	const { facilitator_id } = req.facilitator;
	const [[availableFacility]] = await pool.query(
		`SELECT * FROM facilities WHERE facility_id = ? AND facilitator_id = ?`,
		[facility_id, facilitator_id]
	);
	if (!availableFacility) {
		res.status(403).json({
			message: 'The facility_id for this user does not exist',
		});
		return;
	}
	const [[facilityDetails]] = await pool.query(
		`SELECT
			fa.facility_id,
			fa.name,
			fa.hourly_rate,
			fa.description,
			fa.latitude,
			fa.longitude,
			fa.capacity
		FROM
			facilities fa
		WHERE
			facility_id = ?`,
		[facility_id]
	);
	if (!facilityDetails) {
		res.status(404).json({
			message: 'Invalid facility id',
		});
		return;
	}
	req.facilityDetails = facilityDetails;
	next();
});

//TODO fix gallery
const facilityGallery = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 5;
	const offset = (page - 1) * limit;
	const { facility_id } = req.body;
	const [gallery] = await pool.query(
		`SELECT
			fi.facility_img_id,
			fi.img
		FROM
			facility_img fi
		WHERE
			facility_id = ?
		LIMIT ? OFFSET ?`,
		[facility_id, limit, offset]
	);
	req.gallery = gallery;
	next();
});

const facilityReviews = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const { facility_id } = req.body;
	const [reviews] = await pool.query(
		`SELECT
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			rf.review_facility_id,
			rf.rating,
			rf.time,
			rf.content,
			GROUP_CONCAT(DISTINCT rfi.img SEPARATOR ',') AS images
		FROM
			review_facility rf
		LEFT JOIN
			users u ON rf.user_id = u.user_id
		LEFT JOIN
			review_facility_img rfi ON rf.review_facility_id = rfi.review_facility_id
		WHERE
			facility_id = ?
		`,
		[facility_id, limit, offset]
	);
	const filteredReview = reviews.map((review) => ({
		...review,
		images: review.images ? review.images.split(',') : [],
	}));
	res.status(200).json({
		page,
		limit,
		data: {
			facilityInfo: req.facilityDetails,
			availableHours: req.availableHours,
			gallery: req.gallery,
			reviews: filteredReview,
		},
	});
});

//TODO have to increment the static field such as no_of_professionals, sessions in DB
const facilitatorDetails = expressAsyncHandler(async (req, res) => {
	const { page, limit } = req.query;
	const facilitator_id = req.facilitator_id;
	const [facilitatorInfo] = await pool.query(
		`SELECT
			f.facilitator_id,
			u.first_name,
			u.last_name,
			f.no_of_professionals,
			u.latitude,
			u.longitude
		FROM
			facilitators f
		LEFT JOIN
			users u ON u.user_id = f.user_id
		LEFT JOIN
			facilities fa ON fa.facilitator_id = f.facilitator_id
		WHERE
			f.facilitator_id = ?
		GROUP BY
			u.user_id,
			f.facilitator_id`,
		[facilitator_id]
	);
	res.status(200).json({
		page,
		limit,
		data: {
			facilitatorInfo,
			facilities: req.facilityNameList,
		},
	});
});

const facilitatorFetch = expressAsyncHandler(async (req, res, next) => {
	const { user_id } = req.user;
	const [[{ facilitator_id }]] = await pool.query(
		`SELECT
			facilitator_id
		FROM
			facilitators
		WHERE
			user_id = ?`,
		[user_id]
	);
	req.facilitator_id = facilitator_id;
	next();
});

const facilitatorEdit = expressAsyncHandler(async (req, res) => {
	const { full_name, no_of_professionals, latitude, longitude } = req.body;
	if (!full_name || !no_of_professionals || !latitude || !longitude) {
		res.status(400).json({
			message: 'Missing fields in request body',
		});
		return;
	}
	const { user_id } = req.user;
	const [first_name, last_name] = full_name.split(' ');
	const [{ affectedRows }] = await pool.query(
		`UPDATE
			users
		SET
			first_name = ?,
			last_name = ?,
			latitude = ?,
			longitude = ?
		WHERE
			user_id = ?`,
		[first_name, last_name, latitude, longitude, user_id]
	);
	if (affectedRows === 0) throw new Error('Failed to update user');
	const [facilitatorUpdateStatus] = await pool.query(
		`UPDATE
			facilitators
		SET
			no_of_professionals = ?
		WHERE
			facilitator_id = ?`,
		[no_of_professionals, req.facilitator_id]
	);
	if (facilitatorUpdateStatus.affectedRows === 0)
		throw new Error('Failed to update facilitator');
	res.status(200).json({
		message: 'Successfully updated',
		data: {
			full_name,
			no_of_professionals,
			latitude,
			longitude,
		},
	});
});

const facilityEdit = expressAsyncHandler(async (req, res) => {
	const { facility_id } = req.body;
	const connection = await pool.getConnection();
	const {
		name,
		hourly_rate,
		description,
		latitude,
		longitude,
		capacity,
		available_hours,
	} = req.body;
	if (
		!name ||
		!hourly_rate ||
		!description ||
		!latitude ||
		!longitude ||
		!capacity
	) {
		res.status(400).json({
			message: 'Missing values in the request body',
		});
		return;
	}
	connection.beginTransaction();
	const [availableFacilities] = await connection.query(
		`SELECT * from facilities WHERE facility_id = ?`,
		[facility_id]
	);
	if (!availableFacilities) {
		await connection.rollback();
		connection.release();
		res.status(404).json({
			message: 'Invalid facility_id',
		});
		return;
	}
	const [updateFacility] = await connection.query(
		`UPDATE
			facilities
		SET
			name = ?,
			hourly_rate = ?,
			description = ?,
			latitude = ?,
			longitude = ?,
			capacity = ?
		WHERE
			facility_id = ?`,
		[
			name,
			hourly_rate,
			description,
			latitude,
			longitude,
			capacity,
			facility_id,
		]
	);
	if (updateFacility.affectedRows === 0) {
		await connection.rollback();
		connection.release();
		throw new Error('Failed to update facility');
	}
	const allowedWeeks = [
		'saturday',
		'sunday',
		'monday',
		'tuesday',
		'thursday',
		'friday',
		'wednesday',
	];
	//TODO have to remove available from database
	for (const [index, day] of available_hours.entries()) {
		const { week_day, start_time, end_time, available } = day;
		if (!allowedWeeks.includes(week_day)) {
			await connection.rollback();
			connection.release();
			res.status(400).json({
				message: `Invalid weekday: ${week_day}`,
			});
			return;
		}
		if (!validateTimeStamp(start_time) || !validateTimeStamp(end_time)) {
			await connection.rollback();
			connection.release();
			res.status(400).json({
				message: `Invalid start_time or end_time format at ${week_day}`,
			});
			return;
		}
		const startTime = new Date(start_time);
		const endTime = new Date(end_time);
		if (startTime > endTime) {
			await connection.rollback();
			connection.release();
			res.status(400).json({
				message: `start_time can not be smaller than end_time at ${week_day}`,
			});
			return;
		}
		if (available !== 0 && available !== 1) {
			await connection.rollback();
			connection.release();
			res.status(400).json({
				message: `Invalid available format at ${index + 1}`,
			});
			return;
		}
		const [{ affectedRows }] = await connection.query(
			`UPDATE
				facility_availability_hours
			SET
				start_time = ?,
				end_time = ?,
				available = ?
			WHERE
				week_day = ?
			AND
				facility_id = ?`,
			[start_time, end_time, available, week_day, facility_id]
		);
		if (affectedRows === 0) {
			await connection.rollback();
			connection.release();
			throw new Error('Failed to update facility dates');
		}
	}
	await connection.commit();
	connection.release();
	res.status(200).json({
		message: 'Successfully updated facility',
	});
});

const facilitatorGetNearbyTrainer = expressAsyncHandler(async (req, res) => {
	const { latitude, longitude } = req.body;
	if (!latitude || !longitude) {
		res.status(400).json({
			message: 'Latitude or longitude is missing',
		});
		return;
	}
	const [nearbyTrainers] = await pool.query(
		`SELECT
			t.trainer_id,
			u.first_name,
			u.last_name,
			u.type,
			u.profile_picture,
			u.img,
			u.latitude,
			u.longitude,
			AVG(rt.rating) AS avg_review,
			COUNT(DISTINCT rt.review_trainer_id) AS no_of_reviews
		FROM
			users u
		RIGHT JOIN
			trainers t ON t.user_id = u.user_id
		LEFT JOIN
			review_trainer rt ON rt.trainer_id = t.trainer_id
		WHERE
			ST_Distance_Sphere(
				POINT(u.longitude, u.latitude),
				POINT(?, ?)
			) <= 16093.4
		GROUP BY
			u.first_name,
			u.last_name,
			u.type,
			u.profile_picture,
			u.img`,
		[longitude, latitude]
	);
	res.status(200).json({
		data: {
			trainers: nearbyTrainers,
		},
	});
});

//TODO have to inspect if trainer has the option to reject
const facilitatorAddEmployee = expressAsyncHandler(async (req, res) => {
	const { trainer_id } = req.body;
	const { facilitator_id } = req.facilitator;
	if (!facilitator_id || !trainer_id) {
		res.status(400).json({
			message: 'facilitator or trainer id is missing in the url',
		});
		return;
	}
	const [[available]] = await pool.query(
		`SELECT * FROM trainers WHERE trainer_id = ?`,
		[trainer_id]
	);
	if (!available) {
		res.status(400).json({
			message: 'There is no trainer by this id',
		});
		return;
	}
	const [[previouslyInserted]] = await pool.query(
		`SELECT * FROM facilitator_employees WHERE facilitator_id = ? AND trainer_id = ?`,
		[facilitator_id, trainer_id]
	);
	if (previouslyInserted) {
		res.status(400).json({
			message: 'Already added',
		});
		return;
	}
	const [{ insertId, affectedRows }] = await pool.query(
		`INSERT INTO facilitator_employees (facilitator_id, trainer_id) VALUES (?, ?)`,
		[facilitator_id, trainer_id]
	);
	if (affectedRows === 0) throw new Error('Failed to add employee');
	res.status(200).json({
		employee_add_id: insertId,
		message: 'Successfully added employee',
	});
});

const facilitatorEmployees = expressAsyncHandler(async (req, res) => {
	const { facilitator_id } = req.facilitator;
	if (!facilitator_id) {
		res.status(400).json({
			message: 'Facilitator id is missing in the url',
		});
		return;
	}
	const [employees] = await pool.query(
		`SELECT
			t.trainer_id,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img
		FROM
			facilitator_employees fe
		LEFT JOIN
			trainers t ON fe.trainer_id = t.trainer_id
		LEFT JOIN
			users u ON t.user_id = u.user_id
		WHERE
			facilitator_id = ?`,
		[facilitator_id]
	);
	res.status(200).json({
		data: {
			employees,
		},
	});
});

//TODO have to ensure that every params has respective data in table
const facilitatorAssignEmployee = expressAsyncHandler(
	async (req, res, next) => {
		const { facility_id } = req;
		if (!facility_id) {
			res.status(400).json({
				message: 'Facility id is missing in the url',
			});
			return;
		}
		const { employees } = req.body;
		if (!Array.isArray(employees)) {
			res.status(400).json({
				message: 'Employee is of wrong type',
			});
			return;
		}
		for (const employee_id of employees) {
			const [[employee]] = await pool.query(
				`SELECT * FROM facilitator_employees WHERE trainer_id = ?`,
				[employee_id]
			);
			if (!employee) {
				res.status(400).json({
					message: `${employee_id} is not an employee of this user`,
				});
				return;
			}
		}
		//TODO have to ensure that the sent employees are present in facilitator_employees
		for (const employee_id of employees) {
			const [{ affectedRows }] = await pool.query(
				`INSERT INTO facility_employees (facility_id, trainer_id) VALUES (?, ?)`,
				[facility_id, employee_id]
			);
			if (affectedRows === 0) throw new Error('Failed to add employees');
		}
		next();
	}
);

const facilitatorDeleteFacilityImage = expressAsyncHandler(
	async (req, res, next) => {
		const { facility_img_id } = req.body;
		if (!facility_img_id) {
			res.status(400).json({
				message: 'Facility img id is missing in the url',
			});
			return;
		}
		const [[{ img }]] = await pool.query(
			`SELECT img FROM facility_img WHERE facility_img_id = ?`,
			[facility_img_id]
		);
		if (!img) {
			res.status(400).json({
				message: 'There is no facility by this facility_id',
			});
			return;
		}
		req.fileName = img;
		const [{ affectedRows }] = await pool.query(
			`DELETE FROM facility_img WHERE facility_img_id = ?`,
			[facility_img_id]
		);
		if (affectedRows === 0)
			throw new Error('Failed to delete facility image');
		next();
	}
);

const athleteFacilityDetails = expressAsyncHandler(async (req, res, next) => {
	const { facility_id } = req.body;
	if (!facility_id || typeof facility_id !== 'number') {
		res.status(400).json({
			message: 'facility_id is missing or of wrong data type',
		});
		return;
	}
	const [[facilityInfo]] = await pool.query(
		`SELECT
			f.name,
			f.description,
			f.hourly_rate,
			f.latitude,
			f.longitude,
			u.user_id,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			u.phone,
			COUNT(r.review_facility_id) AS no_of_reviews,
			COALESCE(AVG(r.rating), 0) AS avg_rating,
			GROUP_CONCAT(DISTINCT a.name SEPARATOR ',') AS amenities
		FROM
			facilities f
		LEFT JOIN
			facilitators fa ON f.facilitator_id = fa.facilitator_id
		LEFT JOIN
			users u ON fa.user_id = u.user_id
		LEFT JOIN
			review_facility r ON f.facility_id = r.facility_id
		LEFT JOIN
			amenities a ON f.facility_id = a.facility_id
		WHERE
			f.facility_id = ?
		GROUP BY
			f.name,
			f.description,
			f.hourly_rate,
			f.latitude,
			f.longitude,
			u.user_id,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			u.phone`,
		[facility_id]
	);
	if (!facilityInfo) {
		res.status(400).json({
			message: 'There is no facility by this facility_id',
		});
		return;
	}
	const filteredFacilityInfo = {
		...facilityInfo,
		amenities: facilityInfo.amenities
			? facilityInfo.amenities.split(',')
			: [],
	};
	req.facilityInfo = filteredFacilityInfo;
	next();
});

const athleteFacilityEmployees = expressAsyncHandler(async (req, res, next) => {
	const { facility_id } = req.body;
	const [employees] = await pool.query(
		`SELECT
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			t.trainer_id,
			COUNT(rt.review_trainer_id) AS no_of_reviews,
			COALESCE(AVG(rt.rating), 0) AS avg_rating
		FROM
			facility_employees fe
		LEFT JOIN
			trainers t ON fe.trainer_id = t.trainer_id
		LEFT JOIN
			users u ON t.user_id = u.user_id
		LEFT JOIN
			review_trainer rt ON t.trainer_id = rt.trainer_id
		WHERE
			fe.facility_id = ?
		GROUP BY
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			t.trainer_id;`,
		[facility_id]
	);
	req.facilityEmployees = employees;
	next();
});

const athleteFacilityImages = expressAsyncHandler(async (req, res, next) => {
	const { facility_id } = req.body;
	const [facilityImages] = await pool.query(
		`SELECT
			fi.img
		FROM
			facility_img fi
		WHERE
			fi.facility_id = ?`,
		[facility_id]
	);
	req.filteredFacilityImages = facilityImages.map((images) => images.img);
	next();
});

const athleteFacilityReviews = expressAsyncHandler(async (req, res) => {
	const { facility_id } = req.body;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [[{ no_of_reviews }]] = await pool.query(
		`SELECT
			COUNT(rf.review_facility_id) AS no_of_reviews
		FROM
			review_facility rf
		WHERE
			rf.facility_id = ?`,
		[facility_id]
	);
	const [facilityReviews] = await pool.query(
		`SELECT
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			rf.time,
			rf.rating,
			rf.content,
			GROUP_CONCAT(DISTINCT rfi.img SEPARATOR ',') AS review_images
		FROM
			review_facility rf
		LEFT JOIN
			users u ON rf.user_id = u.user_id
		LEFT JOIN
			review_facility_img rfi ON rf.review_facility_id = rfi.review_facility_id
		WHERE
			rf.facility_id = ?
		GROUP BY
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			rf.time,
			rf.rating,
			rf.content
		LIMIT ? OFFSET ?`,
		[facility_id, limit, offset]
	);
	const filteredFacilityReviews = facilityReviews.map((review) => ({
		...review,
		review_images: review.review_images
			? review.review_images.split(',')
			: [],
	}));
	res.status(200).json({
		page,
		limit,
		data: {
			facilityInfo: req.facilityInfo,
			employees: req.facilityEmployees,
			images: req.filteredFacilityImages,
			no_of_reviews: no_of_reviews,
			reviews: filteredFacilityReviews,
		},
	});
});

export {
	facilitatorAddFacility,
	facilitatorFacilityImage,
	facilitatorCheck,
	facilityReviewerCheck,
	facilityReview,
	facilitySuggestions,
	facilitatorOngoingSessions,
	facilitatorUpcomingSessions,
	facilitatorCompletedSessions,
	facilitySessionDetails,
	facilitySessionTrainer,
	facilityDetails,
	facilityList,
	facilitatorAllReview,
	facilityAvailableHours,
	facilityBasicDetails,
	facilityReviews,
	facilityGallery,
	facilitatorDetails,
	facilitatorEdit,
	facilitatorFetch,
	facilityEdit,
	facilitatorAddAmenities,
	facilitatorGetNearbyTrainer,
	facilitatorAddEmployee,
	facilitatorEmployees,
	facilitatorAssignEmployee,
	facilitatorDeleteFacilityImage,
	facilitatorProfileCompletion,
	athleteFacilityDetails,
	athleteFacilityEmployees,
	athleteFacilityImages,
	athleteFacilityReviews,
};
