import { pool } from '../config/db.js';
import jwt from 'jsonwebtoken';

const verifyToken = async (token) => {
	const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
	const [[user]] = await pool.query(`SELECT * FROM users WHERE user_id = ?`, [
		decoded.id,
	]);
	if (!user) {
		res.status(400).json({
			message: 'There is no user with this token credentials',
		});
		return;
	}
	return user;
};

export { verifyToken };
