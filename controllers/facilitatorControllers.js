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
	if (!facilitator_id) {
		res.status(400).json({
			message: 'facilitator id is missing in the url',
		});
		return;
	}
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
		facility_id: insertId,
		message: 'Facility added successfully',
	});
});

const facilitatorFacilityImage = expressAsyncHandler(async (req, res) => {
	const { facility_id } = req.params;
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
	if (affectedRows === 0)
		throw new Error('Failed to upload image into facility');
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
	const { facility_id } = req.params;
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
		message: 'Successfully inserted amenities',
	});
});

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
			end_time <= NOW()`,
			['completed']
		);
		//TODO completed is undefined
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
			rfa.time
		FROM
			review_facilitators rfa
		LEFT JOIN
			facilitators f ON rfa.facilitator_id = f.facilitator_id
		LEFT JOIN
			users u ON rfa.user_id = u.user_id
		WHERE
			rfa.facilitator_id = ?
		LIMIT ? OFFSET ?`,
		[facilitator_id, limit, offset]
	);
	res.status(200).json({
		page,
		limit,
		data: {
			basicInfo: req.basicInfo,
			facilityList: req.facilityNameList,
			trainers: req.featuredTrainer,
			reviews: facilitatorReviews,
		},
	});
});

const facilityAvailableHours = expressAsyncHandler(async (req, res, next) => {
	const { facility_id } = req.params;
	const [availableHours] = await pool.query(
		`SELECT
			fah.week_day,
			fah.available_hours
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
	const { facility_id } = req.params;
	if (!facility_id) {
		res.status(400).json({
			message: 'facility id is missing in the url',
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
	if (!facilityDetails) throw new Error('There is no facility by this id');
	req.facilityDetails = facilityDetails;
	next();
});

const facilityGallery = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 5;
	const offset = (page - 1) * limit;
	const { facility_id } = req.params;
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
	const { facility_id } = req.params;
	const [reviews] = await pool.query(
		`SELECT
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			rf.review_facility_id,
			rf.rating,
			rf.time,
			rf.content
		FROM
			review_facility rf
		LEFT JOIN
			users u ON rf.user_id = u.user_id
		WHERE
			facility_id = ?
		`,
		[facility_id, limit, offset]
	);
	res.status(200).json({
		page,
		limit,
		data: {
			facilityInfo: req.facilityDetails,
			availableHours: req.availableHours,
			gallery: req.gallery,
			reviews,
		},
	});
});

//TODO have to increment the static field such as no_of_professionals, sessions in DB
const facilitatorDetails = expressAsyncHandler(async (req, res) => {
	const { page, limit } = req.query;
	const facilitator_id = req.facilitator_id;
	const [facilitatorInfo] = await pool.query(
		`SELECT
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
			f.facilitator_id = ?`,
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
	const { facility_id } = req.params;
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
	const [updateFacility] = await pool.query(
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
	if (updateFacility.affectedRows === 0)
		throw new Error('Failed to update facility');
	//TODO have to include array of allowed weeks to prevent SQL injection
	for (const [weekday, hours] of Object.entries(available_hours)) {
		const [{ affectedRows }] = await pool.query(
			`UPDATE
				facility_availability_hours
			SET
				available_hours = ?
			WHERE
				week_day = ?
			AND
				facility_id = ?`,
			[hours, weekday, facility_id]
		);
		if (affectedRows === 0)
			throw new Error('Failed to update facility dates');
	}
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
	const { facilitator_id, trainer_id } = req.params;
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
	const { facilitator_id } = req.params;
	if (!facilitator_id) {
		res.status(400).json({
			message: 'Facilitator id is missing in the url',
		});
		return;
	}
	const [employees] = await pool.query(
		`SELECT
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

//TODO reduce request by middleware get insertId and use it to insert others
//TODO have to ensure that every params has respective data in table
const facilitatorAssignEmployee = expressAsyncHandler(async (req, res) => {
	const { facility_id } = req.params;
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
	//TODO have to ensure that the sent employees are present in facilitator_employees
	for (const employee_id of employees) {
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO facility_employees (facility_id, trainer_id) VALUES (?, ?)`,
			[facility_id, employee_id]
		);
		if (affectedRows === 0) throw new Error('Failed to add employees');
	}
	res.status(200).json({
		message: 'Successfully added employees',
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
};
