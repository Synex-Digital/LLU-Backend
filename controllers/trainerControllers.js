import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';

//TODO divide the sections of trainer details
const trainerProfile = expressAsyncHandler(async (req, res, next) => {
	const { trainer_id } = req.body;
	if (!trainer_id || typeof trainer_id !== 'number') {
		res.status(400).json({
			message: 'trainer id is missing in the url or of wrong datatype',
		});
		return;
	}
	const [[trainer]] = await pool.query(
		`SELECT
			u.user_id,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			u.type,
			u.latitude,
			u.longitude,
			u.short_description
		FROM
			users u
		INNER JOIN
			trainers t ON u.user_id = t.user_id
		WHERE
			t.trainer_id = ?
		`,
		[trainer_id]
	);
	if (!trainer) {
		res.status(404).json({
			message: 'There is no trainer by this trainer_id',
		});
		return;
	}
	req.trainerProfile = trainer;
	next();
});

const trainerStatistics = expressAsyncHandler(async (req, res, next) => {
	const { trainer_id } = req.body;
	const [[trainerDetails]] = await pool.query(
		`SELECT
			t.no_of_students,
			TIMESTAMPDIFF(YEAR, ex.start_date, ex.end_date) AS years_of_experience,
			AVG(tr.rating) AS avg_rating,
			COUNT(DISTINCT tr.review_trainer_id) as no_of_reviews
		FROM
			trainers t
		RIGHT JOIN
			review_trainer tr ON t.trainer_id = tr.trainer_id
		LEFT JOIN
			experiences ex ON tr.trainer_id = ex.trainer_id
		WHERE
			tr.trainer_id = ?`,
		[trainer_id]
	);
	req.trainerStatistics = trainerDetails;
	next();
});

const trainerAvailability = expressAsyncHandler(async (req, res, next) => {
	const { trainer_id } = req.body;
	const [trainerAvailable] = await pool.query(
		`SELECT
			tah.week_day,
			tah.start_time,
			tah.end_time,
			tah.available
		FROM
			trainer_availability_hours tah
		WHERE
			trainer_id = ?`,
		[trainer_id]
	);
	req.trainerAvailability = trainerAvailable;
	next();
});

const trainerAddAvailabilityHours = expressAsyncHandler(async (req, res) => {
	let trainer_id = req.trainer_id ? req.trainer_id : req.body.trainer_id;
	const connection = req.transactionConnection
		? req.transactionConnection
		: pool;
	if (!trainer_id || typeof trainer_id !== 'number') {
		if (req.transactionConnection) {
			await connection.rollback();
			connection.release();
		}
		res.status(400).json({
			message: 'Trainer Id is missing or of wrong type',
		});
		return;
	}
	const weekDays = [
		'saturday',
		'sunday',
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
	];
	const { availability_hours } = req.body;
	if (!availability_hours || !Array.isArray(availability_hours)) {
		if (req.transactionConnection) {
			await connection.rollback();
			connection.release();
		}
		res.status(400).json({
			message: 'Invalid availability hours',
		});
		return;
	}
	let message = '';
	availability_hours.forEach((availability, index) => {
		const { week_day, start_time, end_time, available } = availability;
		if (
			!week_day ||
			!start_time ||
			!end_time ||
			typeof available !== 'number'
		) {
			message += `Missing attribute in ${index + 1}\n`;
		}
		if (!weekDays.includes(week_day)) {
			message += `Invalid week day in ${index + 1}\n`;
		}
	});
	if (message) {
		if (req.transactionConnection) {
			await connection.rollback();
			connection.release();
		}
		res.status(400).json({
			message,
		});
		return;
	}
	availability_hours.forEach(async (availability, index) => {
		const { week_day, start_time, end_time, available } = availability;
		const [{ affectedRows }] = await connection.query(
			`INSERT INTO trainer_availability_hours (week_day, start_time, end_time, available, trainer_id) VALUES (?, ?, ?, ?, ?)`,
			[week_day, start_time, end_time, available, trainer_id]
		);
		if (affectedRows === 0) {
			if (req.transactionConnection) {
				await connection.rollback();
				connection.release();
			}
			throw new Error('Failed to add available hours');
		}
	});
	if (req.transactionConnection) {
		await connection.commit();
		connection.release();
	}
	res.status(201).json({
		message: req.msg ? req.msg : 'Successfully added available hours',
	});
});

const trainerReviews = expressAsyncHandler(async (req, res) => {
	const { trainer_id } = req.body;
	if (!trainer_id) {
		res.status(400).json({
			message: 'trainer id is missing in the url',
		});
		return;
	}
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 5;
	const offset = (page - 1) * limit;
	const [reviews] = await pool.query(
		`SELECT 
			u.user_id,
			u.img AS user_img,
			u.profile_picture,
			u.first_name,
			u.last_name,
			rt.review_trainer_id,
			rt.rating,
			rt.time,
			rt.content,
			GROUP_CONCAT(DISTINCT rti.img ORDER BY rti.img SEPARATOR ',') AS review_images
		FROM 
			users u
		JOIN 
			review_trainer rt ON u.user_id = rt.user_id
		LEFT JOIN 
			review_trainer_img rti ON rt.review_trainer_id = rti.review_trainer_id 
		WHERE
			rt.trainer_id = ?
		GROUP BY 
			u.user_id, u.img, u.profile_picture, u.first_name, u.last_name, u.email, u.phone, rt.review_trainer_id, rt.rating, rt.time, rt.content
		LIMIT ? OFFSET ?
		`,
		[trainer_id, limit, offset]
	);
	const filteredReviews = reviews.map((review) => ({
		...review,
		review_images: review.review_images
			? review.review_images.split(',')
			: [],
	}));
	res.status(200).json({
		page,
		limit,
		data: {
			profile: req.trainerProfile,
			statistics: req.trainerStatistics,
			availability: req.trainerAvailability,
			suggested_facility: req.suggestedFacility,
			reviews: filteredReviews,
		},
	});
});

const trainerCheck = expressAsyncHandler(async (req, res, next) => {
	const { type } = req.user;
	if (type !== 'trainer') {
		res.status(403).json({
			message: 'User is of wrong type',
		});
		return;
	}
	next();
});

const trainerUpcomingSessions = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const { trainer_id } = req.body;
	if (!trainer_id || typeof trainer_id !== 'number') {
		res.status(400).json({
			message: 'Trainer id is missing or of wrong datatype',
		});
		return;
	}
	const [upcomingSessions] = await pool.query(
		`SELECT
			fs.name,
			f.latitude,
			f.longitude,
			fs.start_time,
			fs.end_time
		FROM
			facility_sessions fs
		LEFT JOIN
			trainer_sessions ts ON fs.facility_sessions_id = ts.facility_sessions_id
		LEFT JOIN
			facilities f ON fs.facility_id = f.facility_id
		WHERE
			ts.trainer_id = ?
		AND
			fs.end_time > NOW()
		AND
			fs.start_time > NOW()
		LIMIT ? OFFSET ?`,
		[trainer_id, limit, offset]
	);
	req.upcomingSessions = upcomingSessions;
	next();
});

const trainerHomeStats = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const { trainer_id } = req.body;
	const [statistics] = await pool.query(
		`SELECT
			DATE_FORMAT(fs.start_time, '%Y-%m') AS month,
			COUNT(DISTINCT ts.trainer_session_id) AS total_sessions
		FROM
			facility_sessions fs
		LEFT JOIN
			trainer_sessions ts ON fs.facility_sessions_id = ts.facility_sessions_id
		WHERE
			ts.trainer_id = ?
		GROUP BY 
			DATE_FORMAT(fs.start_time, '%Y-%m')
		ORDER BY 
			month;`,
		[trainer_id]
	);
	res.status(200).json({
		page,
		limit,
		data: {
			upcomingSessions: req.upcomingSessions,
			statistics,
		},
	});
});

const trainerAddExperience = expressAsyncHandler(async (req, res) => {
	const {
		user_id,
		designation,
		company_name,
		start_date,
		end_date,
		job_type,
	} = req.body;
	if (!user_id || typeof user_id !== 'number') {
		res.status(400).json({
			message: 'User id is missing or of wrong datatype',
		});
		return;
	}
	if (
		(!designation && typeof designation !== 'string') ||
		(!company_name && typeof company_name !== 'string') ||
		(!job_type && typeof job_type !== 'string')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	if (job_type !== 'fulltime' && job_type !== 'hourly') {
		res.status(400).json({
			message: 'Type can only be fulltime and hourly',
		});
		return;
	}
	if (!start_date || !!isNaN(Date.parse(start_date))) {
		res.status(400).json({ message: 'Invalid or missing start_date' });
		return;
	}
	if (end_date && !!isNaN(Date.parse(end_date))) {
		res.status(400).json({ message: 'Invalid end_date' });
		return;
	}
	if (end_date && new Date(start_date) >= new Date(end_date)) {
		res.status(400).json({
			message: 'start_date must be earlier than end_date',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO experiences (designation, company_name, start_date, end_date, job_type, trainer_id) VALUES (?, ?, ?, ?, ?, ?)`,
		[designation, company_name, start_date, end_date, job_type, trainer_id]
	);
	if (affectedRows === 0) throw new Error('Failed to add experience');
	res.status(201).json({
		message: 'Successfully added experience',
	});
});

const trainerEditExperience = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const {
		experience_id,
		designation,
		company_name,
		job_type,
		start_date,
		end_date,
	} = req.body;
	if (
		(!designation && typeof designation !== 'string') ||
		(!company_name && typeof company_name !== 'string') ||
		(!job_type && typeof job_type !== 'string') ||
		(!experience_id && typeof experience_id !== 'number')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	if (job_type !== 'fulltime' && job_type !== 'hourly') {
		res.status(400).json({
			message: 'Type can only be fulltime and hourly',
		});
		return;
	}
	if (!start_date || !!isNaN(Date.parse(start_date))) {
		res.status(400).json({ message: 'Invalid or missing start_date' });
		return;
	}
	if (end_date && !!isNaN(Date.parse(end_date))) {
		res.status(400).json({ message: 'Invalid end_date' });
		return;
	}
	if (end_date && new Date(start_date) >= new Date(end_date)) {
		res.status(400).json({
			message: 'start_date must be earlier than end_date',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	if (!trainer_id) {
		res.status(400).json({
			message: 'Invalid user id',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`UPDATE
			experiences
		SET
			designation = ?,
			company_name = ?,
			job_type = ?,
			start_date = ?,
			end_date = ?
		WHERE
			experience_id = ?
		AND
			trainer_id = ?`,
		[
			designation,
			company_name,
			job_type,
			start_date,
			end_date,
			experience_id,
			trainer_id,
		]
	);
	if (affectedRows === 0) {
		res.status(400).json({
			message: 'Invalid experience',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully updated experience',
	});
});

const trainerGetExperience = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [experiences] = await pool.query(
		`SELECT
			experience_id,
			designation,
			company_name,
			job_type,
			start_date,
			end_date
		FROM
			experiences
		WHERE
			trainer_id = ?`,
		[trainer_id]
	);
	res.status(200).json({
		data: {
			experiences,
		},
	});
});

const trainerAddCertificate = expressAsyncHandler(async (req, res) => {
	const { user_id, title, organization, start_date, end_date } = req.body;
	if (
		(!user_id && typeof user_id !== 'number') ||
		(!title && typeof title !== 'string') ||
		(!organization && typeof organization !== 'string')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	if (!start_date || !!isNaN(Date.parse(start_date))) {
		res.status(400).json({ message: 'Invalid or missing start_date' });
		return;
	}
	if (end_date && !!isNaN(Date.parse(end_date))) {
		res.status(400).json({ message: 'Invalid end_date' });
		return;
	}
	if (end_date && new Date(start_date) >= new Date(end_date)) {
		res.status(400).json({
			message: 'start_date must be earlier than end_date',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	if (!trainer_id) {
		res.status(400).json({
			message: 'Invalid user id',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO certificates (title, organization, start_date, end_date, trainer_id) VALUES (?, ?, ?, ?, ?)`,
		[title, organization, start_date, end_date, trainer_id]
	);
	if (affectedRows === 0) throw new Error('Failed to add certificate');
	res.status(201).json({
		message: 'Successfully added certificate',
	});
});

const trainerEditCertificate = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { certificate_id, title, organization, start_date, end_date } =
		req.body;
	if (
		(!certificate_id && typeof certificate_id !== 'number') ||
		(!user_id && typeof user_id !== 'number') ||
		(!title && typeof title !== 'string') ||
		(!organization && typeof organization !== 'string')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	if (!start_date || !!isNaN(Date.parse(start_date))) {
		res.status(400).json({ message: 'Invalid or missing start_date' });
		return;
	}
	if (end_date && !!isNaN(Date.parse(end_date))) {
		res.status(400).json({ message: 'Invalid end_date' });
		return;
	}
	if (end_date && new Date(start_date) >= new Date(end_date)) {
		res.status(400).json({
			message: 'start_date must be earlier than end_date',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [{ affectedRows }] = await pool.query(
		`UPDATE 
			certificates
		SET
			title = ?,
			organization = ?,
			start_date = ?,
			end_date = ?
		WHERE
			certificate_id = ?
		AND
			trainer_id = ?`,
		[title, organization, start_date, end_date, certificate_id, trainer_id]
	);
	if (affectedRows === 0) {
		res.status(400).json({
			message: 'Invalid certificate',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully updated certificate',
	});
});

const trainerGetCertificates = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [certificates] = await pool.query(
		`SELECT
			title,
			organization,
			start_date,
			end_date
		FROM
			certificates
		WHERE
			trainer_id = ?`,
		[trainer_id]
	);
	res.status(200).json({
		data: {
			certificates,
		},
	});
});

const trainerAddEducation = expressAsyncHandler(async (req, res) => {
	const {
		user_id,
		course_name,
		institute_name,
		study_status,
		start_date,
		end_date,
	} = req.body;
	if (
		(!user_id && typeof user_id !== 'number') ||
		(!course_name && typeof course_name !== 'string') ||
		(!institute_name && typeof institute_name !== 'string') ||
		(!study_status && typeof study_status !== 'string')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	if (!start_date || !!isNaN(Date.parse(start_date))) {
		res.status(400).json({ message: 'Invalid or missing start_date' });
		return;
	}
	if (end_date && !!isNaN(Date.parse(end_date))) {
		res.status(400).json({ message: 'Invalid end_date' });
		return;
	}
	if (end_date && new Date(start_date) >= new Date(end_date)) {
		res.status(400).json({
			message: 'start_date must be earlier than end_date',
		});
		return;
	}
	if (study_status !== 'completed' && study_status !== 'studying') {
		res.status(400).json({
			message: 'Wrong study status',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	if (!trainer_id) {
		res.status(400).json({
			message: 'Invalid user id',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO educations (course_name, institute_name, study_status, start_date, end_date, trainer_id) VALUES (?, ?, ?, ?, ?, ?)`,
		[
			course_name,
			institute_name,
			study_status,
			start_date,
			end_date,
			trainer_id,
		]
	);
	if (affectedRows === 0) throw new Error('Failed to add education');
	res.status(201).json({
		message: 'Successfully added education',
	});
});

const trainerEditEducation = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const {
		education_id,
		course_name,
		institute_name,
		study_status,
		start_date,
		end_date,
	} = req.body;
	if (
		(!education_id && typeof education_id !== 'number') ||
		(!course_name && typeof course_name !== 'string') ||
		(!institute_name && typeof institute_name !== 'string') ||
		(!study_status && typeof study_status !== 'string')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	if (study_status !== 'completed' && study_status !== 'studying') {
		res.status(400).json({
			message: 'Wrong study status',
		});
		return;
	}
	if (!start_date || !!isNaN(Date.parse(start_date))) {
		res.status(400).json({ message: 'Invalid or missing start_date' });
		return;
	}
	if (end_date && !!isNaN(Date.parse(end_date))) {
		res.status(400).json({ message: 'Invalid end_date' });
		return;
	}
	if (end_date && new Date(start_date) >= new Date(end_date)) {
		res.status(400).json({
			message: 'start_date must be earlier than end_date',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [{ affectedRows }] = await pool.query(
		`UPDATE 
			educations
		SET
 			course_name = ?,
 			institute_name = ?,
 			study_status = ?,
 			start_date = ?,
 			end_date = ?
		WHERE
			education_id = ?
		AND
			trainer_id = ?`,
		[
			course_name,
			institute_name,
			study_status,
			start_date,
			end_date,
			education_id,
			trainer_id,
		]
	);
	if (affectedRows === 0) {
		res.status(400).json({
			message: 'Invalid education',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully updated education',
	});
});

const trainerGetEducation = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [educations] = await pool.query(
		`SELECT
			course_name,
			institute_name,
			study_status,
			start_date,
			end_date
		FROM
			educations
		WHERE
			trainer_id = ?`,
		[trainer_id]
	);
	res.status(200).json({
		data: {
			educations,
		},
	});
});

const trainerEnsure = expressAsyncHandler(async (req, res, next) => {
	const { trainer_id } = req.body;
	const { user_id } = req.user;
	const [[available]] = await pool.query(
		`SELECT * FROM trainers WHERE trainer_id = ? AND user_id = ?`,
		[trainer_id, user_id]
	);
	if (!available) {
		res.status(403).json({
			message: 'Do not have permission to view',
		});
		return;
	}
	next();
});

export {
	trainerProfile,
	trainerStatistics,
	trainerAvailability,
	trainerReviews,
	trainerAddAvailabilityHours,
	trainerCheck,
	trainerUpcomingSessions,
	trainerHomeStats,
	trainerAddExperience,
	trainerEditExperience,
	trainerGetExperience,
	trainerAddCertificate,
	trainerEditCertificate,
	trainerGetCertificates,
	trainerAddEducation,
	trainerEditEducation,
	trainerGetEducation,
	trainerEnsure,
};
