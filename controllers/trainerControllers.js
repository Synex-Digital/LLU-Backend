import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';
import { validateTimeStamp } from '../utilities/DateValidation.js';

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
	const { user_id } = req.user;
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
	const [[available]] = await pool.query(
		`SELECT * FROM trainers WHERE user_id = ? AND trainer_id = ?`,
		[user_id, trainer_id]
	);
	if (!available) {
		res.status(403).json({
			message: 'Do not have permission to access',
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
	req.statistics = statistics;
	next();
});

const trainerProfileCompletion = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const { trainer_id } = req.body;
	let totalCount = 6,
		mandatory = 9;
	const [certificate] = await pool.query(
		`SELECT * FROM certificates WHERE trainer_id = ?`,
		[trainer_id]
	);
	if (certificate.length !== 0) totalCount++;
	const [education] = await pool.query(
		`SELECT * FROM educations WHERE trainer_id = ?`,
		[trainer_id]
	);
	if (education.length !== 0) totalCount++;
	const [experience] = await pool.query(
		`SELECT * FROM experiences WHERE trainer_id = ?`,
		[trainer_id]
	);
	if (experience.length !== 0) totalCount++;
	res.status(200).json({
		page,
		limit,
		data: {
			upcomingSessions: req.upcomingSessions,
			statistics: req.statistics,
			profileCompletion: (totalCount / mandatory) * 100,
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

const trainerIndividualExperience = expressAsyncHandler(async (req, res) => {
	const { experience_id } = req.body;
	const { user_id } = req.user;
	if (!experience_id || typeof experience_id !== 'number') {
		res.status(400).json({
			message: 'Experience id is missing or of wrong type',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [[experience]] = await pool.query(
		`SELECT 
			designation,
			company_name,
			job_type,
			start_date,
			end_date
		FROM
			experiences
		WHERE
			experience_id = ?
		AND
			trainer_id = ?`,
		[experience_id, trainer_id]
	);
	if (!experience) {
		res.status(400).json({
			message: 'Invalid experience id',
		});
		return;
	}
	res.status(200).json({
		data: {
			experience,
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

const trainerIndividualCertificate = expressAsyncHandler(async (req, res) => {
	const { certificate_id } = req.body;
	const { user_id } = req.user;
	if (!certificate_id || typeof certificate_id !== 'number') {
		res.status(400).json({
			message: 'Experience id is missing or of wrong type',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [[certificate]] = await pool.query(
		`SELECT 
			title,
			organization,
			start_date,
			end_date
		FROM
			certificates
		WHERE
			certificate_id = ?
		AND
			trainer_id = ?`,
		[certificate_id, trainer_id]
	);
	if (!certificate) {
		res.status(400).json({
			message: 'Invalid certificate id',
		});
		return;
	}
	res.status(200).json({
		data: {
			certificate,
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

const trainerIndividualEducation = expressAsyncHandler(async (req, res) => {
	const { education_id } = req.body;
	const { user_id } = req.user;
	if (!education_id || typeof education_id !== 'number') {
		res.status(400).json({
			message: 'Experience id is missing or of wrong type',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [[education]] = await pool.query(
		`SELECT 
			course_name,
			institute_name,
			study_status,
			start_date,
			end_date
		FROM
			educations
		WHERE
			education_id = ?
		AND
			trainer_id = ?`,
		[education_id, trainer_id]
	);
	if (!education) {
		res.status(400).json({
			message: 'Invalid education id',
		});
		return;
	}
	res.status(200).json({
		data: {
			education,
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

const trainerEditProfile = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const {
		first_name,
		last_name,
		hourly_rate,
		availability,
		short_description,
		latitude,
		longitude,
	} = req.body;
	if (
		(!first_name && typeof first_name !== 'string') ||
		(!last_name && typeof last_name !== 'string') ||
		(!short_description && typeof short_description !== 'string') ||
		(!hourly_rate && typeof hourly_rate !== 'number') ||
		(!availability &&
			!Array.isArray(availability) &&
			availability.length !== 0 &&
			availability.length < 7) ||
		(!latitude && typeof latitude !== 'number') ||
		(!longitude && typeof longitude !== 'number')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	const allowedWeeks = [
		'saturday',
		'sunday',
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
	];

	for (const [index, day] of availability.entries()) {
		const { week_day, start_time, end_time, available } = day;

		if (!allowedWeeks.includes(week_day)) {
			res.status(400).json({
				message: `Invalid weekday: ${week_day}`,
			});
			return;
		}

		if (!validateTimeStamp(start_time) || !validateTimeStamp(end_time)) {
			res.status(400).json({
				message: `Invalid start_time or end_time format at ${week_day}`,
			});
			return;
		}

		const startTime = start_time
			? new Date(`1970-01-01T${start_time}`)
			: null;
		const endTime = end_time ? new Date(`1970-01-01T${end_time}`) : null;

		if (startTime && endTime && startTime >= endTime) {
			res.status(400).json({
				message: `start_time cannot be later than or equal to end_time at ${week_day}`,
			});
			return;
		}

		if (available !== 1 && available !== 0) {
			res.status(400).json({
				message: `Invalid available at ${week_day}`,
			});
			return;
		}
		if (
			(!startTime && !endTime && available === 1) ||
			(startTime && endTime && available === 0)
		) {
			res.status(400).json({
				message: `Invalid structure at ${week_day}`,
			});
			return;
		}
	}

	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const connection = await pool.getConnection();
	await connection.beginTransaction();
	const [{ affectedRows }] = await connection.query(
		`DELETE FROM trainer_availability_hours WHERE trainer_id = ?`,
		[trainer_id]
	);
	if (affectedRows === 0) {
		await connection.rollback();
		connection.release();
		throw new Error('Failed to delete trainer availability');
	}
	for (const [index, day] of availability.entries()) {
		const { week_day, start_time, end_time, available } = day;
		const [{ affectedRows }] = await connection.query(
			`INSERT INTO trainer_availability_hours (week_day, start_time, end_time, available, trainer_id) VALUES (?, ?, ?, ?, ?)`,
			[week_day, start_time, end_time, available, trainer_id]
		);
		if (affectedRows === 0) {
			await connection.rollback();
			connection.release();
			throw new Error('Failed to delete trainer availability');
		}
	}
	const [updateStatus] = await connection.query(
		`UPDATE
			users
		SET
			first_name = ?,
			last_name = ?,
			short_description = ?,
			latitude = ?,
			longitude = ?
		WHERE
			user_id = ?`,
		[first_name, last_name, short_description, latitude, longitude, user_id]
	);
	if (updateStatus.affectedRows === 0) {
		await connection.rollback();
		connection.release();
		throw new Error('Failed to update user info');
	}
	const [rateUpdateStatus] = await connection.query(
		`UPDATE
			trainers
		SET
			hourly_rate = ?
		WHERE
			trainer_id = ?`,
		[hourly_rate, trainer_id]
	);
	if (rateUpdateStatus.affectedRows === 0) {
		await connection.rollback();
		connection.release();
		throw new Error('Failed to update trainer info');
	}
	await connection.commit();
	connection.release();
	res.status(200).json({
		message: 'Successfully updated trainer profile',
	});
});

const trainerEditProfileImage = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	if (!req.filePath) {
		res.status(400).json({
			message: 'Failed to upload image',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`UPDATE
			users
		SET
			img = ?
		WHERE
			user_id = ?`,
		[req.filePath, user_id]
	);
	if (affectedRows === 0) throw new Error('Failed to upload profile image');
	res.status(200).json({
		message: 'Successfully added profile image',
	});
});

const trainerOngoingSessions = expressAsyncHandler(async (req, res, next) => {
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
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
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
				trainer_sessions ts
			INNER JOIN
				facility_sessions fs ON ts.facility_sessions_id = fs.facility_sessions_id
			LEFT JOIN
				facilities fa ON fs.facility_id = fa.facility_id
			WHERE
				fs.status = ?
			AND
				ts.trainer_id = ?
			GROUP BY
				fs.facility_sessions_id,
				fa.name,
				fs.description,
				fa.latitude,
				fa.longitude,
				fs.start_time,
				fs.end_time
			LIMIT ? OFFSET ?`,
		['ongoing', trainer_id, limit, offset]
	);
	req.ongoingSessions = ongoingSessions;
	next();
});

const trainerCompletedSessions = expressAsyncHandler(async (req, res, next) => {
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
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [completedSessions] = await pool.query(
		`SELECT
				fs.facility_sessions_id,
				f.name,
				fs.description,
				f.latitude,
				f.longitude,
				fs.start_time,
				fs.end_time
			FROM
				trainer_sessions ts
			INNER JOIN
				facility_sessions fs ON ts.facility_sessions_id = fs.facility_sessions_id
			LEFT JOIN
				facilities f ON fs.facility_id = f.facility_id
			WHERE
				fs.status = ?
			AND
				ts.trainer_id = ?
			GROUP BY
				fs.facility_sessions_id,
				f.name,
				fs.description,
				f.latitude,
				f.longitude,
				fs.start_time,
				fs.end_time
			LIMIT ? OFFSET ?`,
		['completed', trainer_id, limit, offset]
	);
	req.completedSessions = completedSessions;
	next();
});

const trainerSessionsServe = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	res.status(200).json({
		page,
		limit,
		ongoingSessions: req.ongoingSessions,
		upcomingSessions: req.upcomingSessions,
		completedSessions: req.completedSessions,
	});
});

const trainerSessionCheck = expressAsyncHandler(async (req, res, next) => {
	const { session_id } = req.body;
	const { user_id } = req.user;
	if (!session_id || typeof session_id !== 'number') {
		res.status(400).json({
			message: 'Session id is missing or of wrong datatype',
		});
		return;
	}
	const [[{ trainer_id }]] = await pool.query(
		`SELECT	trainer_id FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	const [[available]] = await pool.query(
		`SELECT
			*
		FROM
			facility_sessions fs
		INNER JOIN
			trainer_sessions ts ON fs.facility_sessions_id = ts.facility_sessions_id
		WHERE
			trainer_id = ?`,
		[trainer_id]
	);
	if (!available) {
		res.status(403).json({
			message: 'Do not have permission to access',
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
	trainerEditProfile,
	trainerEditProfileImage,
	trainerProfileCompletion,
	trainerOngoingSessions,
	trainerCompletedSessions,
	trainerSessionsServe,
	trainerSessionCheck,
	trainerIndividualExperience,
	trainerIndividualCertificate,
	trainerIndividualEducation,
};
