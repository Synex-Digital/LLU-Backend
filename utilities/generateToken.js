import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const generateAccessToken = (id) => {
	return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, {
		expiresIn: '30m',
	});
};

const generateRefreshToken = async (id) => {
	const refreshToken = jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
		expiresIn: '7d',
	});
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO token_management (user_id, token) VALUES (?, ?)`,
		[id, refreshToken]
	);
	if (affectedRows === 0) throw new Error('Failed to add token');
	return refreshToken;
};

export { generateAccessToken, generateRefreshToken };
