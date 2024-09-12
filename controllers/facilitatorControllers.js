import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';

const facilitatorCheck = expressAsyncHandler((req, res, next) => {
	const { type } = req.user;
	if (type !== 'facilitator') {
		res.status(403).json({
			message: 'Not a valid user of facilitator type',
		});
		return;
	}
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

const facilitatorAddFacility = expressAsyncHandler(async (req, res) => {
	const {
		hourly_rate,
		name,
		latitude,
		longitude,
		capacity,
		established_in,
		available_hours,
	} = req.body;
	const { facilitator_id } = req.params;
	const [{ insertId, affectedRows }] = await pool.query(
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
	if (affectedRows === 0) throw new Error('Failed to create facility');
	for (const [weekday, hours] of Object.entries(available_hours)) {
		const [insertStatus] = await pool.query(
			`INSERT INTO facility_availability_hours (facility_id, week_day, available_hours) VALUES (?, ?, ?)`,
			[insertId, weekday, hours]
		);
		if (insertStatus.affectedRows === 0)
			throw new Error('Failed to insert available hours');
	}
	res.status(201).json({
		message: 'Facility added successfully',
	});
});

const facilitatorFacilityImage = expressAsyncHandler(async (req, res) => {
	const { facility_id } = req.params;
	if (!facility_id) {
		res.status(400).json({
			message: 'facility id is missing in the url',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO facility_img (facility_id, img) VALUES (?, ?)`,
		[facility_id, req.filePath]
	);
	if (affectedRows === 0)
		throw new Error('Failed to upload image into facility');
	res.status(201).json({
		message: 'Successfully uploaded facility image',
	});
});

//TODO have to add facility image table
const facilityReview = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { facility_id } = req.params;
	if (!facility_id) {
		res.status(400).json({
			message: 'facility id is missing in url',
		});
		return;
	}
	const { rating, content } = req.body;
	const [[available]] = await pool.query(
		`SELECT * FROM review_facility WHERE user_id = ? AND facility_id = ?`,
		[user_id, facility_id]
	);
	if (available)
		throw new Error('User already added review of mentioned facility');
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

const facilitySuggestions = expressAsyncHandler(async (req, res) => {
	const { latitude, longitude } = req.body;
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
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate,
			AVG(rf.rating) AS avg_rating,
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
		LIMIT ? OFFSET ?`,
		[longitude, latitude, limit, offset]
	);
	res.status(200).json({
		page,
		limit,
		data: suggestedFacility,
	});
});

const facilitatorOngoingSessions = expressAsyncHandler(
	async (req, res, next) => {
		const { user_id } = req.user;
		let { page, limit } = req.query;
		page = parseInt(page) || 1;
		limit = parseInt(limit) || 10;
		const offset = (page - 1) * limit;
		const [updateStatus] = await pool.query(
			`UPDATE
				facility_sessions
			SET
				status = ?
			WHERE
				status = 'upcoming'
			AND
				start_time <= NOW()
			AND
				end_time > NOW()`,
			['ongoing']
		);
		const [ongoingSessions] = await pool.query(
			`SELECT
				fs.facility_sessions_id,
				fa.name,
				fa.description,
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
				fs.status = ?
			AND
				f.user_id = ?
			LIMIT ? OFFSET ?`,
			['ongoing', user_id, limit, offset]
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
				fa.description,
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
				fs.status = ?
			AND
				f.user_id = ?
			LIMIT ? OFFSET ?`,
		['upcoming', user_id, limit, offset]
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

const facilitatorCompletedSessions = expressAsyncHandler(
	async (req, res, next) => {
		const { user_id } = req.user;
		let { page, limit } = req.query;
		page = parseInt(page) || 1;
		limit = parseInt(limit) || 10;
		const offset = (page - 1) * limit;
		const [updateStatus] = await pool.query(
			`UPDATE
			facility_sessions
		SET
			status = ?
		WHERE
			status = 'ongoing'
		AND
			end_time <= NOW()`,
			['completed']
		);
		const [completedSessions] = await pool.query(
			`SELECT
			fs.facility_sessions_id,
			fa.name,
			fa.description,
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
			fs.status = ?
		AND
			f.user_id = ?
		LIMIT ? OFFSET ?`,
			['completed', user_id, limit, offset]
		);
		req.completedSessions = completedSessions;
		next();
	}
);

const facilitySessionDetails = expressAsyncHandler(async (req, res, next) => {
	const { session_id } = req.params;
	const [[sessionDetails]] = await pool.query(
		`SELECT
			fs.facility_sessions_id,
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
			message: 'There is not session by this ID',
		});
		return;
	}
	req.sessionDetails = sessionDetails;
	next();
});

const facilitySessionTrainer = expressAsyncHandler(async (req, res) => {
	const { session_id } = req.params;
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

const facilityList = expressAsyncHandler(async (req, res, next) => {
	const { facilitator_id } = req.basicInfo.details;
	const [facilityNameList] = await pool.query(
		`SELECT
			f.facility_id,
			f.name
		FROM
			facilities f
		WHERE
			f.facilitator_id = ?`,
		[facilitator_id]
	);
	req.facilityNameList = facilityNameList;
	next();
});

const facilitatorAllReview = expressAsyncHandler(async (req, res) => {
	const { facilitator_id } = req.basicInfo.details;
	const [facilitatorReviews] = await pool.query(
		`SELECT
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			rfa.rating,
			rfa.content,
			rfa.time
		FROM
			review_facilitators rfa
		LEFT JOIN
			facilitators f ON rfa.facilitator_id = f.facilitator_id
		LEFT JOIN
			users u ON rfa.user_id = u.user_id
		WHERE
			rfa.facilitator_id = ?`,
		[facilitator_id]
	);
	res.status(200).json({
		data: {
			basicInfo: req.basicInfo,
			facilityList: req.facilityNameList,
			trainers: req.featuredTrainer,
			reviews: facilitatorReviews,
		},
	});
});

const facilityAvailableHours = expressAsyncHandler(async (req, res) => {});

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
};
