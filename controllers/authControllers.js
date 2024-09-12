import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';
import { generateToken } from '../utilities/generateToken.js';
import { generateOTP } from '../utilities/generateOTP.js';

const authLogout = expressAsyncHandler((req, res) => {
	req.logout((err) => {
		if (err) throw new Error('Error logging out');
		req.session.destroy((err) => {
			if (err) throw new Error('Error destroying session');
			res.status(205).json({
				message: 'user successfully logged out',
			});
		});
	});
});

const authLoginFailure = expressAsyncHandler((req, res) => {
	res.status(401).json({
		message: 'Login failed',
	});
});

const authLoginSuccess = expressAsyncHandler(async (req, res) => {
	const { id, given_name, family_name, email, email_verified, picture } =
		req.user;
	const [[user]] = await pool.query(
		`SELECT user_id, google_id, first_name, last_name, profile_picture, img, email FROM users WHERE email = ?`,
		[email]
	);
	if (user && email_verified) {
		const { user_id, ...filteredUser } = user;
		res.status(200).json({
			loginStatus: true,
			user: filteredUser,
			token: generateToken(user_id),
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO users(google_id, first_name, last_name, email, profile_picture)
            VALUES (?, ?, ?, ?, ?)`,
		[id, given_name, family_name, email, picture]
	);
	if (affectedRows === 0) throw new Error('Failed to create user');
	res.status(201).json({
		message: 'Insertion successful',
	});
});

const authRequestOTP = expressAsyncHandler(async (req, res, next) => {
	const { email } = req.body;
	const [available] = await pool.query(
		`SELECT * FROM forgot_password WHERE email = ?`,
		[email]
	);
	if (available)
		await pool.query(`DELETE FROM forgot_password WHERE email = ?`, [
			email,
		]);
	const otp = generateOTP();
	const expire_in = Date.now() * 30 * 60 * 1000;
	const [[user]] = await pool.query(`SELECT * FROM users WHERE email = ?`, [
		email,
	]);
	if (!user) {
		res.status(401).json({
			message: 'User does not exist',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO forgot_password (email, otp, expires_in) VALUES (?, ?, ?)`,
		[email, otp, expire_in]
	);
	if (affectedRows === 0) throw new Error('Failed to invoke forgot password');
	try {
		await req.mailer.sendMail({
			from: 'shihab.cse.20210104156@aust.edu',
			to: email,
			subject: 'Your OTP for password reset',
			text: `Your OTP is ${otp}. It expires in 30 minutes`,
		});
		req.user_id = user.user_id; //* check if it works
		res.status(200).json({
			message: 'OTP sent successfully',
		});
	} catch (error) {
		next(error);
	}
});

const authOTPVerify = expressAsyncHandler(async (req, res, next) => {
	const { email, user_otp } = req.body;
	const [requestedOTP] = await pool.query(
		`SELECT otp, expires_in FROM forgot_password WHERE email = ?`,
		[email]
	);
	if (requestedOTP.length === 0) {
		res.status(403).json({
			message: 'Requested OTP does not exist',
		});
		return;
	}

	const [{ otp, expires_in }] = requestedOTP;
	if (Date.now() >= expires_in) {
		await pool.query(`DELETE FROM forgot_password WHERE email = ?`, [
			email,
		]);
		res.status(403).json({
			message: 'OTP expired',
		});
		return;
	}
	if (user_otp !== otp) {
		res.status(403).json({
			message: 'Wrong OTP',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM forgot_password WHERE email = ?`,
		[email]
	);
	if (affectedRows === 0) throw new Error('Failed to delete OTP');
	next();
});

const authOTPSuccess = expressAsyncHandler((req, res) => {
	res.status(200).json({
		message: 'Email verified',
	});
});

const authResetPassword = expressAsyncHandler(async (req, res) => {
	const { email } = req.body;
	const [{ affectedRows }] = await pool.query(
		`UPDATE users SET password = ? WHERE email = ?`,
		[req.hash, email]
	);
	if (affectedRows === 0) throw new Error('Failed to reset password');
	res.status(200).json({
		message: 'Password successfully changed',
	});
});

//TODO: have to convert full_name to first_name and last_name
const authRegister = expressAsyncHandler(async (req, res) => {
	const { full_name, email } = req.body;
	let message = '';
	const nameRegex = /^[a-zA-Z]+([ ][a-zA-Z]+)*$/;
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	if (typeof full_name !== 'string' || typeof email !== 'string') {
		res.status(400).json({
			message: 'Bad input',
		});
		return;
	}
	if (!nameRegex.test(full_name)) {
		message += 'Name is not appropriate\n';
	}
	if (!emailRegex.test(email)) {
		message += 'Email is not appropriate\n';
	}
	if (typeof message === 'string' && message) {
		res.status(400).json({
			message,
		});
		return;
	}
	const [first_name, last_name] = full_name.split(' ');
	const [{ affectedRows, insertId }] = await pool.query(
		`INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)`,
		[first_name, last_name, email, req.hash]
	);
	if (affectedRows === 0) throw new Error('Could not create user');
	res.status(201).json({
		message: 'User created successfully',
		user_id: insertId,
	});
});

const athleteRegister = async (req, res, user_id) => {
	const [[athlete]] = await pool.query(
		`SELECT * FROM athletes WHERE user_id = ?`,
		[user_id]
	);
	if (athlete)
		await pool.query(`DELETE FROM athletes WHERE user_id = ?`, [user_id]);
	const { age, weight, height, sport_interest, sport_level, gender } =
		req.body;
	if (
		!age ||
		!weight ||
		!height ||
		!sport_interest ||
		!sport_level ||
		!gender
	) {
		res.status(400).json({
			message: 'Missing attributes',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO athletes (user_id, age, weight, height, sport_interest, sport_level, gender) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[user_id, age, weight, height, sport_interest, sport_level, gender]
	);
	if (affectedRows === 0) throw new Error('Specialized user creation failed');
	res.status(201).json({
		message: 'Specialized user created successfully',
	});
};

const trainerRegister = async (req, res, user_id) => {
	const [updateStatus] = await pool.query(
		`UPDATE users SET type = ? WHERE user_id = ?`,
		['trainer', user_id]
	);
	if (updateStatus.affectedRows === 0) throw new Error('User update failed');
	const [[trainer]] = await pool.query(
		`SELECT * FROM trainers WHERE user_id = ?`,
		[user_id]
	);
	if (trainer)
		await pool.query(`DELETE FROM trainers WHERE user_id = ?`, [user_id]);
	const { hourly_rate, specialization, specialization_level } = req.body;
	if (!hourly_rate || !specialization || !specialization_level) {
		res.status(400).json({
			message: 'Missing attributes',
		});
		return;
	}
	const [insertStatus] = await pool.query(
		`INSERT INTO trainers (user_id, hourly_rate, specialization, specialization_level) VALUES (?, ?)`,
		[user_id, hourly_rate, specialization, specialization_level]
	);
	if (insertStatus.affectedRows === 0)
		throw new Error('Specialized user creation failed');
	res.status(201).json({
		message: 'Specialized user created successfully',
	});
};

const facilitatorRegister = async (req, res, user_id) => {
	const [updateStatus] = await pool.query(
		`UPDATE users SET type = ? WHERE user_id = ?`,
		['facilitator', user_id]
	);
	if (updateStatus.affectedRows === 0) throw new Error('User update failed');
	const [[facilitator]] = await pool.query(
		`SELECT * FROM facilitators WHERE user_id = ?`,
		[user_id]
	);
	if (facilitator)
		await pool.query(`DELETE FROM facilitators WHERE user_id = ?`, [
			user_id,
		]);
	const { no_of_professionals } = req.body;
	if (!no_of_professionals) {
		res.status(400).json({
			message: 'Missing attributes',
		});
		return;
	}
	const [insertStatus] = await pool.query(
		`INSERT INTO facilitators (user_id, no_of_professionals) VALUES (?, ?)`,
		[user_id, no_of_professionals]
	);
	if (insertStatus.affectedRows === 0)
		throw new Error('Specialized user creation failed');
	res.status(201).json({
		message: 'Specialized user created successfully',
	});
};

const parentRegister = async (req, res, user_id) => {
	const [updateStatus] = await pool.query(
		`UPDATE users SET type = ? WHERE user_id = ?`,
		['parent', user_id]
	);
	if (updateStatus.affectedRows === 0) throw new Error('User update failed');
	const { children } = req.body;
	if (!Array.isArray(children)) {
		res.status(422).json({
			message: 'Wrong data type of children',
		});
		return;
	}
	const [[parent]] = await pool.query(
		`SELECT * FROM parents WHERE user_id = ?`,
		[user_id]
	);
	if (parent)
		await pool.query(`DELETE FROM parents WHERE user_id = ?`, [user_id]);
	const [insertStatus] = await pool.query(
		`INSERT INTO parents (user_id) VALUES (?)`,
		[user_id]
	);
	if (insertStatus.affectedRows === 0)
		throw new Error('Specialized user creation failed');
	if (children.length === 0) {
		res.status(400).json({
			message: 'No children sent',
		});
		return;
	}
	children.forEach(async (child, index) => {
		const { name, age, gender, sport_interest, sport_level } = child;
		if (!name || !age || !gender || !sport_interest || sport_level) {
			res.status(400).json({
				message: `Missing attributes in ${index + 1}th child`,
			});
			return;
		}
		const [childInsertStatus] = await pool.query(
			`INSERT INTO children (parent_id, name, age, gender, sport_interest, sport_level) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				insertStatus.insertId,
				name,
				age,
				gender,
				sport_interest,
				sport_level,
			]
		);
	});
	res.status(201).json({
		message: 'Specialized user with children created successfully',
	});
};

//TODO: handle request if user tries to change user_type
const specifiedRegister = expressAsyncHandler(async (req, res) => {
	const { type } = req?.query;
	const { user_id } = req?.params;
	if (!type || !user_id) {
		res.status(400).json({
			message: 'Missing type or user_id',
		});
		return;
	}
	const [[user]] = await pool.query(`SELECT * FROM users WHERE user_id = ?`, [
		user_id,
	]);
	if (!user) {
		res.status(403).json({
			message: 'User does not exist',
		});
		return;
	}
	switch (type) {
		case 'athlete':
			await athleteRegister(req, res, user_id);
			return;
		case 'trainer':
			await trainerRegister(req, res, user_id);
			return;
		case 'facilitator':
			await facilitatorRegister(req, res, user_id);
			return;
		case 'parent':
			await parentRegister(req, res, user_id);
			return;
		default:
			res.status(400).json({
				message: 'Wrong type',
			});
	}
});

const authValidates = expressAsyncHandler(async (req, res, next) => {
	const { email } = req.body;
	const [[user]] = await pool.query(
		`SELECT user_id, first_name, last_name, profile_picture, img, email, password FROM users WHERE email = ?`,
		[email]
	);
	if (!user) {
		res.status(403).json({
			message: 'User does not exist',
		});
		return;
	}
	req.user = user;
	next();
});

const authLogin = expressAsyncHandler(async (req, res) => {
	const { verified, user } = req;
	const { user_id, password, ...filteredUser } = user;
	res.status(verified ? 200 : 403).json({
		loginStatus: verified,
		user: verified ? filteredUser : null,
		token: verified ? generateToken(user_id) : null,
	});
});

export {
	authLogout,
	authLoginFailure,
	authLoginSuccess,
	authRequestOTP,
	authOTPVerify,
	authResetPassword,
	authOTPSuccess,
	authRegister,
	specifiedRegister,
	authValidates,
	authLogin,
};
