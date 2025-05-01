import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';

const parentCheck = expressAsyncHandler(async (req, res, next) => {
	const { type } = req.user;
	if (type !== 'parent') {
		res.status(403).json({
			message: 'Not a valid user of parent type',
		});
		return;
	}
	next();
});

const parentHome = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const { user_id } = req.user;
	const [[availableChat]] = await pool.query(
		`SELECT
            *
        FROM
            chats
        WHERE
            user_id = ?`,
		[user_id]
	);
	if (!availableChat) {
		res.status(200).json({
			page,
			limit,
			data: {
				newMessages: 0,
				topTrainer: req.topTrainer,
				nearbyFacilities: req.nearbyFacilities,
			},
		});
		return;
	}
	const [[{ new_messages }]] = await pool.query(
		`SELECT
            new_messages
        FROM
            chats
        WHERE
            user_id = ?`,
		[user_id]
	);
	res.status(200).json({
		page,
		limit,
		data: {
			newMessages: new_messages,
			topTrainer: req.topTrainer,
			nearbyFacilities: req.nearbyFacilities,
		},
	});
});

const parentChildrenInfo = expressAsyncHandler(async (req, res, next) => {
	const { user_id } = req.user;
	const { parent_id } = req.body;
	if (!parent_id || typeof parent_id !== 'number') {
		res.status(400).json({
			message: 'Parent id is missing or of wrong datatype',
		});
		return;
	}
	const [[availableUser]] = await pool.query(
		`SELECT
            *
        FROM
            parents
        WHERE
            user_id = ?
        AND
            parent_id = ?`,
		[user_id, parent_id]
	);
	if (!availableUser) {
		res.status(403).json({
			message: 'Do not have permission to access',
		});
		return;
	}
	const [children] = await pool.query(
		`SELECT
            child_id,
            name,
            age,
            gender,
            sport_interest,
            sport_level
        FROM
        	children
        WHERE
            parent_id = ?`,
		[parent_id]
	);
	req.children = children;
	next();
});

const parentGetIndividualChildren = expressAsyncHandler(async (req, res) => {
	const { child_id } = req.body;
	const { user_id } = req.user;
	if (!child_id || typeof child_id !== 'number') {
		res.status(400).json({
			message: 'Child id is missing or of wrong datatype',
		});
		return;
	}
	const [[child]] = await pool.query(
		`SELECT
            c.child_id,
            c.name,
            c.age,
            c.gender,
            c.sport_interest,
            c.sport_level
        FROM
            children c
        LEFT JOIN
            parents p ON c.parent_id = p.parent_id
        LEFT JOIN
            users u ON p.user_id = u.user_id
        WHERE
            u.user_id = ?
        AND
            c.child_id = ?`,
		[user_id, child_id]
	);
	if (!child) {
		res.status(403).json({
			message: 'Do not have permission to access',
		});
		return;
	}
	res.status(200).json({
		data: {
			child,
		},
	});
});

const parentAddChildren = expressAsyncHandler(async (req, res) => {
	const { name, age, gender, sport_interest, sport_level } = req.body;
	const { parent_id } = req.body;
	if (
		(!name && typeof name !== 'string') ||
		(!age && typeof age !== 'number') ||
		(!gender && typeof gender !== 'string') ||
		(!sport_interest && typeof sport_interest !== 'string') ||
		(!sport_level && typeof sport_level !== 'string') ||
		(!parent_id && typeof parent_id !== 'number')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	if (
		sport_level !== 'beginner' &&
		sport_level !== 'intermediate' &&
		sport_level !== 'advanced'
	) {
		res.status(400).json({
			message: 'Invalid sport level',
		});
		return;
	}
	const { user_id } = req.user;
	const [[availableUser]] = await pool.query(
		`SELECT
            *
        FROM
            parents
        WHERE
            user_id = ?
        AND
            parent_id = ?`,
		[user_id, parent_id]
	);
	if (!availableUser) {
		res.status(403).json({
			message: 'Do not have permission to access',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO children (parent_id, name, age, gender, sport_interest, sport_level) VALUES (?, ?, ?, ?, ?, ?)`,
		[parent_id, name, age, gender, sport_interest, sport_level]
	);
	if (affectedRows === 0) throw new Error('Failed to add children');
	res.status(200).json({
		message: 'Successfully added children',
	});
});

const parentEditChildren = expressAsyncHandler(async (req, res) => {
	const { child_id, name, age, gender, sport_interest, sport_level } =
		req.body;
	const { parent_id } = req.body;
	if (
		(!child_id && typeof child_id !== 'number') ||
		(!name && typeof name !== 'string') ||
		(!age && typeof age !== 'number') ||
		(!gender && typeof gender !== 'string') ||
		(!sport_interest && typeof sport_interest !== 'string') ||
		(!sport_level && typeof sport_level !== 'string') ||
		(!parent_id && typeof parent_id !== 'number')
	) {
		res.status(400).json({
			message: 'Missing attributes or of wrong datatype',
		});
		return;
	}
	if (
		sport_level !== 'beginner' &&
		sport_level !== 'intermediate' &&
		sport_level !== 'advanced'
	) {
		res.status(400).json({
			message: 'Invalid sport level',
		});
		return;
	}
	const { user_id } = req.user;
	const [[availableUser]] = await pool.query(
		`SELECT
            *
        FROM
            parents
        WHERE
            user_id = ?
        AND
            parent_id = ?`,
		[user_id, parent_id]
	);
	if (!availableUser) {
		res.status(403).json({
			message: 'Do not have permission to access',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`UPDATE
            children
        SET
            name = ?,
            age = ?,
            gender = ?,
            sport_interest = ?,
            sport_level = ?
        WHERE
            parent_id = ?
        AND
            child_id = ?`,
		[name, age, gender, sport_interest, sport_level, parent_id, child_id]
	);
	if (affectedRows === 0) throw new Error('Failed to update children');
	res.status(200).json({
		message: 'Successfully updated children',
	});
});

export {
	parentCheck,
	parentHome,
	parentChildrenInfo,
	parentGetIndividualChildren,
	parentAddChildren,
	parentEditChildren,
};
