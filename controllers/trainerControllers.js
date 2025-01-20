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
	const { trainer_id } = req.params;
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
		res.status(400).json({
			message: 'Invalid availability hours',
		});
		return;
	}
	let message = '';
	availability_hours.forEach((availability, index) => {
		const { week_day, available_hours } = availability;
		if (!week_day || !available_hours) {
			message += `Missing attribute in ${index + 1}\n`;
		}
		if (!weekDays.includes(week_day)) {
			message += `Invalid week day in ${index + 1}\n`;
		}
	});
	//TODO have to do logic for update
	availability_hours.forEach(async (availability, index) => {
		const { week_day, available_hours } = availability;
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO trainer_availability_hours (week_day, available_hours, trainer_id) VALUES (?, ?, ?)`,
			[week_day, available_hours, trainer_id]
		);
		if (affectedRows === 0)
			throw new Error('Failed to add available hours');
	});
	res.status(201).json({
		message: 'Successfully added available hours',
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
			reviews: filteredReviews,
		},
	});
});

export {
	trainerProfile,
	trainerStatistics,
	trainerAvailability,
	trainerReviews,
	trainerAddAvailabilityHours,
};
