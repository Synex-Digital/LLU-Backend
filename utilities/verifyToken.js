import { pool } from '../config/db.js';
import jwt from 'jsonwebtoken';

const verifyToken = async (token) => {
	const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
	const [[user]] = await pool.query(`SELECT * FROM users WHERE user_id = ?`, [
		decoded.id,
	]);
	if (!user) return null;
	return user;
};

export { verifyToken };
