import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';

const userAddReview = expressAsyncHandler(async (req, res) => {
	const { trainer_id } = req.params;
	const { rating, content } = req.body;
	const { user_id } = req.user;
	if (!trainer_id) {
		res.status(400).json({
			message: 'Trainer id is missing',
		});
		return;
	}
	const [[availableReview]] = await pool.query(
		`SELECT * FROM review_trainer WHERE user_id = ? AND trainer_id = ?`,
		[user_id, trainer_id]
	);
	if (availableReview)
		throw new Error('User already reviewed mentioned trainer');
	const [{ affectedRows, insertId }] = await pool.query(
		`INSERT INTO review_trainer (user_id, rating, trainer_id, content) VALUES (?, ?, ?, ?)`,
		[user_id, rating, trainer_id, content]
	);
	if (affectedRows === 0) throw new Error('Failed to add review');
	res.status(200).json({
		review_id: insertId,
	});
});

const userAddReviewImg = expressAsyncHandler(async (req, res) => {
	const { review_id } = req.params;
	if (!review_id) {
		res.status(400).json({
			message: 'review id is missing in the url',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO review_trainer_img (review_trainer_id, img) VALUES (?, ?)`,
		[review_id, req.filePath]
	);
	if (affectedRows === 0)
		throw new Error('Failed to upload image into review');
	res.status(200).json({
		message: 'Successfully uploaded review image',
	});
});

export { userAddReview, userAddReviewImg };
