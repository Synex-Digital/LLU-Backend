import expressAsyncHandler from 'express-async-handler';
import PDFDocument from 'pdfkit';
import { pool } from '../config/db.js';
import { generateRandomString } from '../utilities/generateRandomString.js';
import { validateDate } from '../utilities/DateValidation.js';
import generateBookingTime from '../utilities/generateBookingTime.js';
import { io } from '../index.js';
import QRCode from 'qrcode';

const userAddReview = expressAsyncHandler(async (req, res) => {
	const { trainer_id } = req.body;
	const { rating, content } = req.body;
	const { user_id } = req.user;
	if (!trainer_id || typeof trainer_id !== 'number') {
		res.status(400).json({
			message: 'Trainer id is missing or of wrong datatype',
		});
		return;
	}
	if (!rating || !content) {
		res.status(400).json({
			message: 'Missing attributes',
		});
		return;
	}
	const [[availableReview]] = await pool.query(
		`SELECT * FROM review_trainer WHERE user_id = ? AND trainer_id = ?`,
		[user_id, trainer_id]
	);
	if (availableReview) {
		res.status(403).json({
			message: 'user already posted review',
		});
		return;
	}
	const [{ affectedRows, insertId }] = await pool.query(
		`INSERT INTO review_trainer (user_id, rating, trainer_id, content) VALUES (?, ?, ?, ?)`,
		[user_id, rating, trainer_id, content]
	);
	if (affectedRows === 0) throw new Error('Failed to add review');
	res.status(200).json({
		review_id: insertId,
	});
});

const ensureBookPersonalities = expressAsyncHandler(async (req, res, next) => {
	const { type } = req.user;
	if (type === 'athlete' || type === 'parent') {
		next();
		return;
	}
	res.status(403).json({
		message: 'Only athletes and parents can book facilities',
	});
});

const userAddReviewFacility = expressAsyncHandler(async (req, res) => {
	const { facility_id } = req.body;
	const { rating, content } = req.body;
	const { user_id } = req.user;
	if (!facility_id || typeof facility_id !== 'number') {
		res.status(400).json({
			message: 'facility_id is missing or of wrong datatype',
		});
		return;
	}
	if (!rating || !content) {
		res.status(400).json({
			message: 'Missing attributes',
		});
		return;
	}
	const [[availableReview]] = await pool.query(
		`SELECT * FROM review_facility WHERE user_id = ? AND facility_id = ?`,
		[user_id, facility_id]
	);
	if (availableReview) {
		res.status(403).json({
			message: 'user already posted review',
		});
		return;
	}
	const [{ affectedRows, insertId }] = await pool.query(
		`INSERT INTO review_facility (user_id, rating, facility_id, content) VALUES (?, ?, ?, ?)`,
		[user_id, rating, facility_id, content]
	);
	if (affectedRows === 0) throw new Error('Failed to add review');
	res.status(200).json({
		review_id: insertId,
	});
});

const userAddReviewImg = expressAsyncHandler(async (req, res) => {
	if (!req.file) {
		res.status(400).json({
			message: 'No file uploaded. Please attach a file.',
		});
		return;
	}
	const { review_id } = req.body;
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

const userAddFacilityReviewImg = expressAsyncHandler(async (req, res) => {
	if (!req.file) {
		res.status(400).json({
			message: 'No file uploaded. Please attach a file.',
		});
		return;
	}
	const { review_id } = req.body;
	if (
		!review_id ||
		isNaN(review_id) ||
		!Number.isInteger(Number(review_id))
	) {
		res.status(400).json({
			message: 'review id is missing or of wrong datatype',
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

const userAddPost = expressAsyncHandler(async (req, res, next) => {
	const { content } = req.body;
	const { user_id } = req.user;
	if (parseInt(user_id) !== req.user.user_id) {
		res.status(400).json({
			message: 'Wrong credential provided',
		});
		return;
	}
	if (!content) {
		res.status(400).json({
			message: 'Content is missing in request body',
		});
		return;
	}
	if (!user_id) {
		res.status(400).json({
			message: 'user id is missing in the url',
		});
		return;
	}
	const [{ insertId, affectedRows }] = await pool.query(
		`INSERT INTO posts (user_id, content) VALUES (?, ?)`,
		[user_id, content]
	);
	if (affectedRows === 0) throw new Error('Failed to add post');
	req.post_id = insertId;
	next();
});

const userAddPostImage = expressAsyncHandler(async (req, res, next) => {
	const { post_id, filePaths } = req;
	if (!filePaths) {
		next();
		return;
	}
	for (const path of filePaths) {
		console.log(path);
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO post_img (post_id, img) VALUES (?, ?)`,
			[post_id, path]
		);
		if (affectedRows === 0) throw new Error('Failed to add post_img');
	}
	next();
});

//TODO have to resolve same id being in both side
const userReservePostForFollowers = expressAsyncHandler(async (req, res) => {
	const { post_id } = req;
	const { user_id } = req.user;
	const [followers] = await pool.query(
		`SELECT 
			follower_user_id 
		FROM 
			follows 
		WHERE 
			followed_user_id = ? 
		AND 
			notification_status = ?`,
		[user_id, 'all']
	);
	for (const { follower_user_id } of followers) {
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO user_unseen_posts (user_id, post_id) VALUES (?, ?)`,
			[follower_user_id, post_id]
		);
		if (affectedRows === 0) throw new Error('Failed to add unseen posts');
	}
	res.status(200).json({
		post_id: req.post_id,
		message: 'Successfully added post',
	});
});

const userCommunity = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const { user_id } = req.user;
	const [posts] = await pool.query(
		`SELECT
			p.post_id,
			u.user_id,
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			GROUP_CONCAT(DISTINCT pi.img ORDER BY pi.img SEPARATOR ',') AS post_images,
			p.time,
			p.content,
			COUNT(DISTINCT l.like_id) AS no_of_likes,
			COUNT(DISTINCT c.comment_id) AS no_of_comments
		FROM
			user_unseen_posts uup
		LEFT JOIN
			posts p ON uup.post_id = p.post_id
		INNER JOIN
			users u ON p.user_id = u.user_id
		LEFT JOIN
			likes l ON uup.post_id = l.post_id
		LEFT JOIN
			comments c ON uup.post_id = c.post_id
		LEFT JOIN
			post_img pi ON p.post_id = pi.post_id
		WHERE
			uup.user_id = ?
		GROUP BY
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			p.time,
			p.content
		LIMIT ? OFFSET ?`,
		[user_id, limit, offset]
	);
	if (posts.length === 0) {
		next();
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM user_unseen_posts WHERE user_id = ?`,
		[user_id]
	);
	const filteredPosts = posts.map((post) => ({
		...post,
		post_images: post.post_images ? post.post_images.split(',') : [],
	}));
	res.status(200).json({
		page,
		limit,
		data: filteredPosts,
	});
});

//TODO have to count all no of posts along with page and limit
const userRecommendedPost = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [recommendedPosts] = await pool.query(
		`SELECT
			p.post_id,
			u.user_id,
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			GROUP_CONCAT(DISTINCT pi.img ORDER BY pi.img SEPARATOR ' , ') AS post_images,
			p.time,
			p.content,
			COUNT(DISTINCT l.like_id) AS no_of_likes,
			COUNT(DISTINCT c.comment_id) AS no_of_comments,
			CASE 
				WHEN EXISTS (
					SELECT 1 
					FROM likes l2 
					WHERE l2.post_id = p.post_id AND l2.user_id = ?
				) THEN 1
				ELSE 0
			END AS has_liked
		FROM
			posts p
		INNER JOIN
			users u ON p.user_id = u.user_id
		LEFT JOIN
			likes l ON p.post_id = l.post_id
		LEFT JOIN
			comments c ON p.post_id = c.post_id
		LEFT JOIN
			post_img pi ON p.post_id = pi.post_id
		GROUP BY
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			p.time,
			p.content
		ORDER BY
			COUNT(DISTINCT l.like_id) DESC
		LIMIT ? OFFSET ?`,
		[user_id, limit, offset]
	);
	const filteredRecommendedPosts = recommendedPosts.map((post) => ({
		...post,
		post_images: post.post_images ? post.post_images.split(' , ') : [],
	}));
	res.status(200).json({
		page,
		limit,
		data: filteredRecommendedPosts,
	});
});

const userGetComments = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	let { post_id } = req.params;
	const { user_id } = req.user;
	if (!post_id) {
		res.status(400).json({
			message: 'Post id is missing',
		});
		return;
	}
	post_id = parseInt(post_id);
	if (isNaN(post_id)) {
		res.status(400).json({
			message: 'Post id is of wrong datatype',
		});
		return;
	}
	const [comments] = await pool.query(
		`SELECT
			c.comment_id,
			c.time,
			c.content,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			COUNT(DISTINCT cl.comment_like_id) AS no_of_likes,
			MAX(CASE 
				WHEN cl.user_id = ? THEN 1
				ELSE 0
			END) AS has_liked
		FROM
			comments c
		LEFT JOIN
			comment_likes cl ON c.comment_id = cl.comment_id
		LEFT JOIN
			users u ON u.user_id = c.user_id
		WHERE
			c.post_id = ?
		GROUP BY
			c.comment_id,
			c.time,
			c.content,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img
		ORDER BY
			c.time DESC
		LIMIT ? OFFSET ?`,
		[user_id, post_id, limit, offset]
	);
	req.comments = comments;
	next();
});

const userIndividualPost = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	let { post_id } = req.params;
	const [[post]] = await pool.query(
		`SELECT
			p.post_id,
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			GROUP_CONCAT(DISTINCT pi.img ORDER BY pi.img SEPARATOR ',') AS post_images,
			p.time,
			p.content,
			COUNT(DISTINCT l.like_id) AS no_of_likes
		FROM
			posts p
		INNER JOIN
			users u ON p.user_id = u.user_id
		LEFT JOIN
			likes l ON p.post_id = l.post_id
		LEFT JOIN
			comments c ON p.post_id = c.post_id
		LEFT JOIN
			post_img pi ON p.post_id = pi.post_id
		WHERE
			p.post_id = ?
		GROUP BY
			p.post_id,
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			p.time,
			p.content,
			c.comment_id`,
		[post_id]
	);
	if (!post) {
		res.status(400).json({
			message: 'No post by this post_id',
		});
		return;
	}
	const filteredPost = {
		...post,
		no_of_comments: req.comments.length,
		post_images: post.post_images ? post.post_images.split(',') : [],
	};
	res.status(200).json({
		page,
		limit,
		data: {
			post: filteredPost,
			comments: req.comments,
		},
	});
});

const userProfile = expressAsyncHandler(async (req, res, next) => {
	let { user_id } = req.params;
	if (!user_id) {
		res.status(400).json({
			message: 'user_id is missing',
		});
		return;
	}
	user_id = parseInt(user_id);
	if (isNaN(user_id)) {
		res.status(400).json({
			message: 'user_id is of wrong datatype',
		});
		return;
	}
	const [[availableFollow]] = await pool.query(
		`SELECT * FROM follows WHERE follower_user_id = ? AND followed_user_id = ?`,
		[req.user.user_id, user_id]
	);
	const followed = availableFollow ? true : false;
	if (!user_id) {
		res.status(400).json({
			message: 'User id is missing in the url',
		});
		return;
	}
	const [[user]] = await pool.query(
		`SELECT
			user_id,
			first_name, 
			last_name, 
			img, 
			profile_picture, 
			level, 
			type
		FROM 
			users
		WHERE
			user_id = ?`,
		[user_id]
	);
	if (!user) {
		res.status(400).json({
			message: 'There is no user by this user_id',
		});
		return;
	}
	const [[{ follower_no }]] = await pool.query(
		`SELECT
			COUNT(DISTINCT follower_user_id) AS follower_no
		FROM
			follows
		WHERE
			followed_user_id = ?`,
		[user_id]
	);
	const [[{ following_no }]] = await pool.query(
		`SELECT
			COUNT(DISTINCT followed_user_id) AS following_no
		FROM
			follows
		WHERE
			follower_user_id = ?`,
		[user_id]
	);
	req.userProfile = {
		user,
		own_profile: req.user.user_id === user_id,
		followed,
		follower_no,
		following_no,
	};
	next();
});

const userOwnPosts = expressAsyncHandler(async (req, res) => {
	let { user_id } = req.params;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	user_id = parseInt(user_id);
	const offset = (page - 1) * limit;
	const [posts] = await pool.query(
		`SELECT
			p.post_id,
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			GROUP_CONCAT(DISTINCT pi.img ORDER BY pi.img SEPARATOR ',') AS post_images,
			p.time,
			p.content,
			COUNT(DISTINCT l.like_id) AS no_of_likes,
			COUNT(DISTINCT c.comment_id) AS no_of_comments
		FROM
			posts p
		INNER JOIN
			users u ON p.user_id = u.user_id
		LEFT JOIN
			likes l ON p.post_id = l.post_id
		LEFT JOIN
			comments c ON p.post_id = c.post_id
		LEFT JOIN
			post_img pi ON p.post_id = pi.post_id
		WHERE
			p.user_id = ?
		GROUP BY
			p.post_id,
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			p.time,
			p.content
		LIMIT ? OFFSET ?`,
		[user_id, limit, offset]
	);
	const filteredPosts = posts.map((post) => ({
		...post,
		post_images: post.post_images ? post.post_images.split(',') : [],
	}));
	res.status(200).json({
		page,
		limit,
		data: {
			...req.userProfile,
			posts: filteredPosts,
		},
	});
});

//TODO have to fix chat_id mixup for example:
// "unread_chats": [
//             {
//                 "chat_id": 21,
//                 "user_id": 7,
//                 "notification_status": "all",
//                 "room_id": "3a4a43024fe048a7c13de468b4fbf16c",
//                 "active": 1,
//                 "no_of_messages": 1,
//                 "latest_message_content": "HI Shihab from shrabon(unseen)",
//                 "first_name": "Taufiqul",
//                 "last_name": "Shrabon",
//                 "profile_picture": null,
//                 "img": "https://cdn-icons-png.flaticon.com/256/20/20079.png",
//                 "last_message_time": "2025-01-13T18:40:02.000Z"
//             }
//         ],
//         "chats": [
//             {
//                 "chat_id": 20,
//                 "notification_status": "all",
//                 "friend_user_id": 7,
//                 "room_id": "3a4a43024fe048a7c13de468b4fbf16c",
//                 "active": 1,
//                 "latest_message_content": "HI Shihab from shrabon(unseen)",
//                 "first_name": "Taufiqul",
//                 "last_name": "Shrabon",
//                 "profile_picture": null,
//                 "img": "https://cdn-icons-png.flaticon.com/256/20/20079.png",
//                 "last_message_time": "2025-01-13T17:38:32.000Z"
//             }
//         ]
const userUnreadChats = expressAsyncHandler(async (req, res, next) => {
	const { user_id } = req.user;
	console.log(user_id);
	const [chats] = await pool.query(
		`SELECT
			c.chat_id,
			c.user_id,
			c.notification_status,
			c.room_id,
			IF(u.socket_id IS NULL, FALSE, TRUE) AS active,
			COUNT(um.message_id) AS no_of_messages,
			(
				SELECT
					m1.content
				FROM
					messages m1
				LEFT JOIN
					chats c1 ON m1.chat_id = c1.chat_id
				WHERE
					c1.room_id = c.room_id
				ORDER BY
					m1.time DESC
				LIMIT 1
			) AS latest_message_content,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			MAX(m.time) AS last_message_time
		FROM
			unseen_messages um
		LEFT JOIN
			messages m ON m.message_id = um.message_id
		LEFT JOIN
			chats c ON c.chat_id = m.chat_id
		LEFT JOIN
			users u ON u.user_id = c.user_id 
		WHERE
			um.user_id = ?
		GROUP BY
			c.chat_id,
			c.friend_user_id,
			c.notification_status,
			c.room_id,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img
		ORDER BY
			m.time DESC;`,
		[user_id]
	);
	req.newMessageChats = chats;
	next();
});

//TODO have to sort messages using unread
const userNormalChats = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	console.log(user_id);
	const [chats] = await pool.query(
		`SELECT
			c.chat_id,
			c.notification_status,
			c.friend_user_id,
			c.new_messages as no_of_new_messages,
			IF(u.socket_id IS NULL, FALSE, TRUE) AS active,
			m1.content AS latest_message_content,
			CASE
				WHEN c.new_messages > 0 THEN 0
				ELSE 1
			END AS latest_message_seen_status,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			m1.time AS last_message_time
		FROM
			chats c
		LEFT JOIN
			messages m ON c.chat_id = m.chat_id
		LEFT JOIN
			users u ON c.friend_user_id = u.user_id
		LEFT JOIN
			messages m1 ON m1.message_id = (
				SELECT m2.message_id
				FROM messages m2
				JOIN chats c2 ON m2.chat_id = c2.chat_id
				WHERE c2.room_id = c.room_id
				ORDER BY m2.time DESC
				LIMIT 1
			)
		WHERE
			c.user_id = ?
		GROUP BY
			c.chat_id,
			c.notification_status,
			c.friend_user_id,
			c.room_id,
			m1.content,
			c.new_messages,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img
		ORDER BY
			m1.time DESC
		LIMIT ? OFFSET ?;`,
		[user_id, limit, offset]
	);
	res.status(200).json({
		page,
		limit,
		data: {
			unread_chats: req.newMessageChats,
			chats,
		},
	});
});

const userHandleNotificationStatus = expressAsyncHandler(async (req, res) => {
	const { status, chat_id } = req.body;
	const { user_id } = req.user;
	if (!status || !chat_id || typeof chat_id !== 'number') {
		res.status(400).json({
			message: 'status or chat_id is missing or of wrong datatype',
		});
		return;
	}
	const allowedStates = ['all', 'muted'];
	if (!allowedStates.includes(status)) {
		res.status(400).json({
			message: 'Invalid status',
		});
		return;
	}
	const [[availableChat]] = await pool.query(
		`SELECT * FROM chats WHERE chat_id = ? AND user_id = ?`,
		[chat_id, user_id]
	);
	if (!availableChat) {
		res.status(403).json({
			message:
				'Do not have permission to update chat notification status',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`UPDATE
			chats
		SET
			notification_status = ?
		WHERE
			chat_id = ?`,
		[status, chat_id]
	);
	if (affectedRows === 0)
		throw new Error('Failed to update chat notification status');
	res.status(200).json({
		message: 'Successfully updated chat notification status',
	});
});

const userGetMessagesInChat = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { room_id } = req.params;
	console.log(room_id);
	if (!room_id) {
		res.status(400).json({
			messages: 'room_id is missing or of wrong datatype',
		});
		return;
	}
	const [[availableChat]] = await pool.query(
		`SELECT * FROM chats WHERE user_id = ? AND room_id = ?`,
		[user_id, room_id]
	);
	if (!availableChat) {
		res.status(403).json({
			messages: 'you do not have permission to access this chat',
		});
		return;
	}
	let { start_time, end_time } = req.query;
	let startTime, endTime;
	try {
		startTime = new Date(start_time);
		endTime = new Date(end_time);
	} catch (error) {
		res.status(400).json({
			message: 'start_time or end_time is of wrong format',
		});
		return;
	}
	if (startTime > endTime) {
		res.status(400).json({
			messages: 'Invalid date range',
		});
		return;
	}
	start_time += ' 00:00:00';
	end_time += ' 23:59:59';
	if (!room_id) {
		res.status(400).json({
			message: 'Chat id is missing the url',
		});
		return;
	}
	console.log(user_id);
	const [{ affectedRows }] = await pool.query(
		`UPDATE chats SET new_messages = 0 WHERE user_id = ?`,
		[user_id]
	);
	const [updateStatus] = await pool.query(
		`UPDATE chats SET last_accessed = NOW() WHERE chat_id = ?`,
		[availableChat.chat_id]
	);
	if (updateStatus.affectedRows === 0)
		throw new Error('Failed to update last access in chat');
	const [messages] = await pool.query(
		`SELECT
			m.message_id,
			m.content,
			m.time,
			u.user_id,
			u.first_name,
			u.last_name,
			CASE 
				WHEN m.content LIKE 'https://linkandlevelup-bucket.s3.us-east-2.amazonaws.com/%' THEN 1
				ELSE 0
			END AS is_img
		FROM
			messages m
		RIGHT JOIN
			chats c ON c.chat_id = m.chat_id
		INNER JOIN
			users u ON u.user_id = c.user_id
		WHERE
			c.room_id = ?
		AND
			m.time BETWEEN ? AND ?
		ORDER BY
			m.time DESC`,
		[room_id, start_time, end_time]
	);
	res.status(200).json({
		start_time,
		end_time,
		data: messages,
	});
});

const userDeleteMessage = expressAsyncHandler(async (req, res) => {
	const { message_id, chat_id } = req.body;
	const { user_id } = req.user;
	if (
		!message_id ||
		typeof message_id !== 'number' ||
		!chat_id ||
		typeof chat_id !== 'number'
	) {
		res.status(400).json({
			message: 'message_id or chat is missing or of wrong datatype',
		});
		return;
	}
	console.log({
		message_id,
		chat_id,
	});
	const [[ownMessage]] = await pool.query(
		`SELECT * FROM chats WHERE chat_id = ? AND user_id = ?`,
		[chat_id, user_id]
	);
	if (!ownMessage) {
		res.status(403).json({
			message: 'You do not have permission to delete this message',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM messages WHERE message_id = ? AND chat_id = ?`,
		[message_id, chat_id]
	);
	console.log(affectedRows);
	if (affectedRows === 0) {
		res.status(403).json({
			message:
				'You do not have permission to delete this message or message does not exist',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully deleted message',
	});
});

const userDeleteChat = expressAsyncHandler(async (req, res) => {
	const { chat_id } = req.body;
	const { user_id } = req.user;
	if (!chat_id || typeof chat_id !== 'number') {
		res.status(400).json({
			message: 'chat_id is missing or of wrong datatype',
		});
		return;
	}
	const [[{ room_id }]] = await pool.query(
		`SELECT room_id FROM chats WHERE chat_id = ? AND user_id = ?`,
		[chat_id, user_id]
	);
	console.log(room_id);
	if (!room_id) {
		res.status(403).json({
			message: 'You do not have permission to delete this chat',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM chats WHERE room_id = ?`,
		[room_id]
	);
	if (affectedRows === 0) {
		res.status(400).json({
			message: 'Failed to delete chat',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully deleted chat',
	});
});

const userCreateChat = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.body;
	if (!user_id || typeof user_id !== 'number') {
		res.status(400).json({
			message: 'user_id is missing or of wrong data type',
		});
		return;
	}
	const [[availableUser]] = await pool.query(
		`SELECT * FROM users WHERE user_id = ?`,
		[user_id]
	);
	if (!availableUser) {
		res.status(400).json({
			message: 'User does not exist for provided user_id',
		});
		return;
	}
	const { user } = req;
	if (parseInt(user_id) === user.user_id) {
		res.status(403).json({
			message: "You can't create chat with yourself",
		});
		return;
	}
	const [[chats]] = await pool.query(
		`SELECT 
			chat_id 
		FROM 
			chats 
		WHERE 
			user_id = ? AND friend_user_id = ?`,
		[user_id, user.user_id]
	);
	if (chats?.chat_id) {
		res.status(200).json({
			message: 'Already created',
		});
		return;
	}
	const connection = await pool.getConnection();
	await connection.beginTransaction();
	const roomId = generateRandomString(16);
	const [{ affectedRows }] = await connection.query(
		`INSERT INTO chats (user_id, room_id, friend_user_id) VALUES (?, ?, ?)`,
		[user.user_id, roomId, user_id]
	);
	if (affectedRows === 0) {
		await connection.rollback();
		connection.release();
		res.status(400).json({
			message: 'Failed to create chat',
		});
		return;
	}
	const [insertStatus] = await connection.query(
		`INSERT INTO chats (user_id, room_id, friend_user_id) VALUES (?, ?, ?)`,
		[user_id, roomId, user.user_id]
	);
	if (insertStatus.affectedRows === 0) {
		await connection.rollback();
		connection.release();
		res.status(400).json({
			message: 'Failed to create chat',
		});
		return;
	}
	const startDate = new Date();
	const endTimeFormatted = startDate.toISOString().split('T')[0];
	startDate.setDate(startDate.getDate() - 15);
	const startTimeFormatted = startDate.toISOString().split('T')[0];
	const notification = {
		title: 'New message request',
		content: `${user.first_name} ${user.last_name} has sent you a message request`,
		time: new Date().toISOString().slice(0, 19).replace('T', ' '),
		read_status: 'no',
		redirect: `/api/user/messages/${roomId}?start_time=${startTimeFormatted}&end_time=${endTimeFormatted}`,
	};
	const [{ insertId, affectedRows: notificationAffectedRows }] =
		await connection.query(
			`INSERT INTO notifications (user_id, title, content, time, read_status, redirect) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				user_id,
				notification.title,
				notification.content,
				notification.time,
				notification.read_status,
				notification.redirect,
			]
		);
	if (notificationAffectedRows === 0) {
		await connection.rollback();
		connection.release();
		res.status(400).json({
			message: 'Failed to create notification',
		});
		return;
	}
	await connection.commit();
	connection.release();
	io.to(user.socket_id).emit('notification', {
		...notification,
		notification_id: insertId,
	});
	res.status(200).json({
		message: 'Chat created successfully',
	});
});

const userDeleteAccount = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM users WHERE user_id = ?`,
		[user_id]
	);
	if (affectedRows === 0) throw new Error('Failed to delete user');
	res.status(200).json({
		message: 'Successfully deleted user',
	});
});

const userLikePost = expressAsyncHandler(async (req, res) => {
	const { user_id, first_name, last_name } = req.user;
	const { post_id } = req.body;
	if (!post_id || typeof post_id !== 'number') {
		res.status(400).json({
			message: 'Post id is missing or of wrong datatype',
		});
		return;
	}
	if (!user_id) {
		res.status(400).json({
			message: 'User id is missing',
		});
		return;
	}
	const [[availableLike]] = await pool.query(
		`SELECT * FROM likes WHERE user_id = ? AND post_id = ?`,
		[user_id, post_id]
	);
	if (availableLike?.like_id) {
		res.status(200).json({
			message: 'Already liked the post',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`,
		[user_id, post_id]
	);
	if (affectedRows === 0) throw new Error('Failed to add like');
	const [[{ user_id: notify_user_id, socket_id }]] = await pool.query(
		`SELECT
			u.user_id,
			u.socket_id
		FROM
			posts p
		LEFT JOIN
			users u ON p.user_id = u.user_id
		WHERE
			p.post_id = ?`,
		[post_id]
	);
	const notification = {
		title: `New like`,
		content: `${first_name} ${last_name} liked your post`,
		time: new Date().toISOString().slice(0, 19).replace('T', ' '),
		read_status: 'no',
		redirect: `/api/user/post/${post_id}?page=1&limit=10`,
	};
	const [{ insertId, affectedRows: notificationAffectedRows }] =
		await pool.query(
			`INSERT INTO notifications (user_id, title, content, time, read_status, redirect) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				notify_user_id,
				notification.title,
				notification.content,
				notification.time,
				notification.read_status,
				notification.redirect,
			]
		);
	if (notificationAffectedRows === 0) {
		res.status(400).json({
			message: 'Failed to create notification',
		});
		return;
	}
	io.to(socket_id).emit('notification', {
		...notification,
		notification_id: insertId,
	});
	res.status(200).json({
		message: 'Successfully added like',
	});
});

const userRemoveLikePost = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { post_id } = req.body;
	if (!post_id || typeof post_id !== 'number') {
		res.status(400).json({
			message: 'Post id is missing or of wrong datatype',
		});
		return;
	}
	if (!user_id) {
		res.status(400).json({
			message: 'User id is missing',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM likes WHERE user_id = ? AND post_id = ?`,
		[user_id, post_id]
	);
	if (affectedRows === 0) {
		res.status(400).json({
			message: 'Post does not exist',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully removed like',
	});
});

const userFollow = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.body;
	const { user } = req;
	if (!user_id || !user.user_id || typeof user_id !== 'number') {
		res.status(400).json({
			message: 'User id is missing',
		});
		return;
	}
	const [[availableUser]] = await pool.query(
		`SELECT * FROM users WHERE user_id = ?`,
		[user_id]
	);
	if (!availableUser) {
		res.status(400).json({
			message: 'User does not exist for provided user_id',
		});
		return;
	}
	if (parseInt(user_id) === user.user_id) {
		res.status(403).json({
			message: "You can't follow yourself",
		});
		return;
	}
	const [[availableFollow]] = await pool.query(
		`SELECT * FROM follows WHERE follower_user_id = ? AND followed_user_id = ?`,
		[user.user_id, user_id]
	);
	if (availableFollow) {
		res.status(200).json({
			message: 'Already following the user',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO follows (follower_user_id, followed_user_id, notification_status) VALUES (?, ?, ?)`,
		[user.user_id, user_id, 'all']
	);
	if (affectedRows === 0) throw new Error('Failed to follow user');
	const notification = {
		title: `New follower`,
		content: `${user.first_name} ${user.last_name} has followed you`,
		time: new Date().toISOString().slice(0, 19).replace('T', ' '),
		read_status: 'no',
		redirect: `/api/user/profile/${user.user_id}?page=1&limit=5`,
	};
	const [{ insertId, affectedRows: notificationAffectedRows }] =
		await pool.query(
			`INSERT INTO notifications (user_id, title, content, time, read_status, redirect) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				user_id,
				notification.title,
				notification.content,
				notification.time,
				notification.read_status,
				notification.redirect,
			]
		);
	if (notificationAffectedRows === 0) {
		res.status(400).json({
			message: 'Failed to create notification',
		});
		return;
	}
	const [[{ socket_id }]] = await pool.query(
		`SELECT socket_id FROM users WHERE user_id = ?`,
		[user_id]
	);
	console.log(socket_id, user_id);
	io.to(socket_id).emit('notification', {
		...notification,
		notification_id: insertId,
	});
	res.status(200).json({
		message: 'Successfully followed user',
	});
});

const userUnfollow = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.body;
	const { user } = req;
	if (!user_id || !user.user_id || typeof user_id !== 'number') {
		res.status(400).json({
			message: 'User id is missing',
		});
		return;
	}
	const [[followAvailable]] = await pool.query(
		`SELECT * FROM follows WHERE follower_user_id = ? AND followed_user_id = ?`,
		[user.user_id, user_id]
	);
	if (!followAvailable) {
		res.status(400).json({
			message: 'This user does not follow the user with user_id',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE 
		FROM 
			follows 
		WHERE 
			follower_user_id = ?
		AND
			followed_user_id = ?`,
		[user.user_id, user_id]
	);
	if (affectedRows === 0) throw new Error('Failed to unfollow');
	res.status(200).json({
		message: 'Successfully unfollowed user',
	});
});

const userAddComment = expressAsyncHandler(async (req, res) => {
	const { post_id } = req.body;
	const { user_id, first_name, last_name } = req.user;
	const { content } = req.body;
	if (!post_id || typeof post_id !== 'number') {
		res.status(400).json({
			message: 'Post id is missing or of wrong datatype',
		});
		return;
	}
	if (!user_id) {
		res.status(400).json({
			message: 'User id is missing',
		});
		return;
	}
	if (!content) {
		res.status(400).json({
			message: 'content is missing',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)`,
		[user_id, post_id, content]
	);
	if (affectedRows === 0) throw new Error('Failed to add comment');
	const notification = {
		title: `New comment`,
		content: content,
		time: new Date().toISOString().slice(0, 19).replace('T', ' '),
		read_status: 'no',
		redirect: `/api/user/post/${post_id}?page=1&limit=10`,
	};
	const [[{ user_id: notify_user_id, socket_id }]] = await pool.query(
		`SELECT
			u.user_id,
			u.socket_id
		FROM
			posts p
		LEFT JOIN
			users u ON p.user_id = u.user_id
		WHERE
			p.post_id = ?`,
		[post_id]
	);
	const [{ insertId, affectedRows: notificationAffectedRows }] =
		await pool.query(
			`INSERT INTO notifications (user_id, title, content, time, read_status, redirect) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				notify_user_id,
				notification.title,
				notification.content,
				notification.time,
				notification.read_status,
				notification.redirect,
			]
		);
	if (notificationAffectedRows === 0) {
		res.status(400).json({
			message: 'Failed to create notification',
		});
		return;
	}
	io.to(socket_id).emit('notification', {
		...notification,
		notification_id: insertId,
	});

	res.status(200).json({
		message: 'Successfully added comment',
	});
});

const userLikeComment = expressAsyncHandler(async (req, res) => {
	const { comment_id } = req.body;
	const { user_id } = req.user;
	if (!comment_id || typeof comment_id !== 'number') {
		res.status(400).json({
			message: 'comment_id is missing or of wrong datatype',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)`,
		[user_id, comment_id]
	);
	if (affectedRows === 0) throw new Error('Failed to like comment');
	res.status(200).json({
		message: 'Successfully liked comment',
	});
});

const userRemoveLikeComment = expressAsyncHandler(async (req, res) => {
	const { comment_id } = req.body;
	const { user_id } = req.user;
	if (!comment_id || typeof comment_id !== 'number') {
		res.status(400).json({
			message: 'comment_id is missing or of wrong datatype',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?`,
		[comment_id, user_id]
	);
	if (affectedRows === 0) throw new Error('Failed to remove like comment');
	res.status(200).json({
		message: 'Successfully removed like from comment',
	});
});

const userGetNotifications = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [notifications] = await pool.query(
		`SELECT
			notification_id,
			title,
			content,
			time,
			read_status,
			redirect
		FROM
			notifications
		WHERE
			user_id = ?
		ORDER BY
			time DESC
		LIMIT ? OFFSET ?`,
		[user_id, limit, offset]
	);
	const [[{ new_notification }]] = await pool.query(
		`SELECT
			COUNT(*) AS new_notification
		FROM
			notifications
		WHERE
			user_id = ?
		AND
			read_status = 'no'`,
		[user_id]
	);
	res.status(200).json({
		page,
		limit,
		data: {
			new_notification,
			notifications,
		},
	});
});

const userMarkNotificationAsRead = expressAsyncHandler(async (req, res) => {
	const { notification_id } = req.body;
	const { user_id } = req.user;
	if (!notification_id || typeof notification_id !== 'number') {
		res.status(400).json({
			message: 'notification_id is missing or of wrong datatype',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`UPDATE 
			notifications
		SET
			read_status = 'yes'
		WHERE
			notification_id = ?
		AND
			user_id = ?`,
		[notification_id, user_id]
	);
	if (affectedRows === 0) {
		res.status(400).json({
			message: 'Failed to mark notification as read',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully marked notification as read',
	});
});

const userMarkAllNotificationsAsRead = expressAsyncHandler(async (req, res) => {
	const { time } = req.body;
	const { user_id } = req.user;
	let checkTime;
	try {
		checkTime = new Date(time);
	} catch (error) {
		res.status(400).json({
			message: 'time is of wrong format',
		});
		return;
	}
	if (!time) {
		res.status(400).json({
			message: 'time is missing',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`UPDATE 
			notifications
		SET
			read_status = 'yes'
		WHERE
			user_id = ?
		AND
			DATE(time) = ?`,
		[user_id, time]
	);
	if (affectedRows === 0) {
		res.status(400).json({
			message: 'Failed to mark all notifications as read',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully marked all notifications as read',
	});
});

const userBooksFacilityWithTrainer = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { trainer_id, facility_id, date } = req.body;
	if (!trainer_id || typeof trainer_id !== 'number') {
		res.status(400).json({
			message: 'trainer_id is missing or of wrong datatype',
		});
		return;
	}
	const [[availableTrainer]] = await pool.query(
		`SELECT * FROM trainers WHERE trainer_id = ?`,
		[trainer_id]
	);
	if (!availableTrainer) {
		res.status(403).json({
			message: 'Trainer is not available for booking',
		});
		return;
	}
	const [[commonTime]] = await pool.query(
		`SELECT 
			f.week_day,
			GREATEST(f.start_time, t.start_time) AS common_start_time,
			LEAST(f.end_time, t.end_time) AS common_end_time
		FROM 
			facility_availability_hours f
		JOIN
			trainer_availability_hours t
			ON f.week_day = t.week_day
			AND f.available = 1
			AND t.available = 1
			AND GREATEST(f.start_time, t.start_time) < LEAST(f.end_time, t.end_time)
		WHERE
			f.week_day = ?
		AND
			f.facility_id = ?
		AND
			t.trainer_id = ?`,
		[req.weekDay, facility_id, trainer_id]
	);
	if (!commonTime) {
		res.status(403).json({
			message: 'Trainer or Facility is not available at this time',
		});
		return;
	}
	const [[{ booking_count }]] = await pool.query(
		`SELECT 
			COUNT(*) AS booking_count
		FROM
			books
		WHERE
			facility_id = ?
		AND
			trainer_id = ?
		AND
			time = ?`,
		[facility_id, trainer_id, date]
	);
	const bookingTime = generateBookingTime(commonTime, booking_count);
	const offsetEndTime = new Date(`1970-01-01T${bookingTime.end_time}`);
	const commonEndTime = new Date(`1970-01-01T${commonTime.common_end_time}`);
	if (offsetEndTime > commonEndTime) {
		res.status(403).json({
			message: 'Trainer or Facility is not available at this time',
		});
		return;
	}
	const [[availableBooking]] = await pool.query(
		`SELECT 
			*
		FROM
			books b
		WHERE
			b.user_id = ?
		AND
			b.trainer_id = ?
		AND
			b.facility_id = ?
		AND
			b.time = ?`,
		[user_id, trainer_id, facility_id, date]
	);
	if (availableBooking) {
		res.status(403).json({
			message: 'user already booked the trainer with facility',
		});
		return;
	}
	const [{ affectedRows, insertId }] = await pool.query(
		`INSERT INTO books (user_id, facility_id, trainer_id, time, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
		[
			user_id,
			facility_id,
			trainer_id,
			date,
			bookingTime.start_time,
			bookingTime.end_time,
		]
	);
	if (affectedRows === 0)
		throw new Error('Failed to book facility with trainer');
	res.status(200).json({
		bookId: insertId,
		message: 'Successfully booked facility with trainer',
	});
});

const userBookFacility = expressAsyncHandler(async (req, res, next) => {
	const { user_id } = req.user;
	const { facility_id, trainer_id, date } = req.body;
	if (!facility_id || typeof facility_id !== 'number') {
		res.status(400).json({
			message: 'facility_id is missing or of wrong datatype',
		});
		return;
	}
	if (!date || !validateDate(date)) {
		res.status(400).json({
			message: 'Invalid date format or date is missing',
		});
		return;
	}
	const dateObj = new Date(date);
	const dayIndex = dateObj.getDay();
	const weekdays = [
		'sunday',
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday',
	];
	req.weekDay = weekdays[dayIndex];
	const [[availableFacility]] = await pool.query(
		`SELECT * FROM facilities WHERE facility_id = ?`,
		[facility_id]
	);
	if (!availableFacility) {
		res.status(403).json({
			message: 'Facility is not available for booking',
		});
		return;
	}

	if (facility_id && trainer_id) {
		next();
		return;
	}

	const [[commonTime]] = await pool.query(
		`SELECT
			f.week_day,
			f.start_time AS common_start_time,
			f.end_time AS common_end_time
		FROM
			facility_availability_hours f
		WHERE
			f.week_day = ?
		AND
			f.facility_id = ?`,
		[weekdays[dayIndex], facility_id]
	);
	const [[{ booking_count }]] = await pool.query(
		`SELECT 
			COUNT(*) AS booking_count
		FROM
			book_facilities
		WHERE
			facility_id = ?
		AND
			time = ?`,
		[facility_id, date]
	);
	console.log(commonTime);
	const bookingTime = generateBookingTime(commonTime, booking_count);
	const offsetEndTime = new Date(`1970-01-01T${bookingTime.end_time}`);
	const commonEndTime = new Date(`1970-01-01T${commonTime.end_time}`);
	if (offsetEndTime > commonEndTime) {
		res.status(403).json({
			message: 'Facility is not available at this time',
		});
		return;
	}
	const [[availableFacilityBooking]] = await pool.query(
		`SELECT
			*
		FROM
			book_facilities
		WHERE
			user_id = ?
		AND
			facility_id = ?
		AND
			time = ?`,
		[user_id, facility_id, date]
	);
	if (availableFacilityBooking) {
		res.status(403).json({
			message: 'user already booked the facility',
		});
		return;
	}

	const [{ affectedRows, insertId }] = await pool.query(
		`INSERT INTO book_facilities (user_id, facility_id, time, start_time, end_time) VALUES (?, ?, ?, ?, ?)`,
		[
			user_id,
			facility_id,
			date,
			bookingTime.start_time,
			bookingTime.end_time,
		]
	);
	if (affectedRows === 0) throw new Error('Failed to book facility');
	res.status(200).json({
		bookId: insertId,
		message: 'Successfully booked facility',
	});
});

const userGetReviewSummary = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { book_id, book_facility_id } = req.body;
	if (
		(!book_id || typeof book_id !== 'number') &&
		(!book_facility_id || typeof book_facility_id !== 'number')
	) {
		res.status(400).json({
			message:
				'book_id or book_facility_id is missing or of wrong datatype',
		});
		return;
	}
	let book;
	if (book_id) {
		[[book]] = await pool.query(
			`SELECT
				facility_id,
				trainer_id,
				time
			FROM
				books
			WHERE
				user_id = ?
			AND
				book_id = ?`,
			[user_id, book_id]
		);
	} else if (book_facility_id) {
		[[book]] = await pool.query(
			`SELECT
				facility_id,
				time
			FROM
				book_facilities
			WHERE
				user_id = ?
			AND
				book_facility_id = ?`,
			[user_id, book_facility_id]
		);
	}
	if (!book) {
		res.status(400).json({
			message: 'User has not booked any facility',
		});
		return;
	}
	const [[facility]] = await pool.query(
		`SELECT
			f.facility_id,
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate,
			COALESCE(AVG(rf.rating), 0) AS avg_rating,
			fi.img
		FROM
			facilities f
		LEFT JOIN
			review_facility rf ON f.facility_id = rf.facility_id
		LEFT JOIN
			facility_img fi ON f.facility_id = fi.facility_id
		WHERE 
			f.facility_id = ?
		GROUP BY
			f.name,
			f.latitude,
			f.longitude,
			f.hourly_rate`,
		[book.facility_id]
	);
	let trainer;
	let availableTime;
	if (book.trainer_id) {
		[[trainer]] = await pool.query(
			`SELECT
				t.trainer_id,
				u.first_name,
				u.last_name,
				t.hourly_rate
			FROM
				trainers t
			LEFT JOIN
				users u ON u.user_id = t.user_id
			WHERE 
				t.trainer_id = ?`,
			[book.trainer_id]
		);
		[[availableTime]] = await pool.query(
			`SELECT 
				b.time,
				b.start_time,
				b.end_time
			FROM 
				books b
			WHERE 
				user_id = ?
			AND
				book_id = ?`,
			[user_id, book_id]
		);
	} else {
		[[availableTime]] = await pool.query(
			`SELECT 
				b.time,
				b.start_time,
				b.end_time
			FROM 
				book_facilities b
			WHERE 
				user_id = ?
			AND
				book_facility_id = ?`,
			[user_id, book_facility_id]
		);
	}
	let totalPrice = trainer
		? facility.hourly_rate + trainer.hourly_rate
		: facility.hourly_rate;
	totalPrice = parseFloat(totalPrice.toFixed(4));
	res.status(200).json({
		data: {
			time: new Date(book.time).toISOString().split('T')[0],
			facility,
			trainer,
			totalAmount: totalPrice,
		},
	});
});

const userRemoveBooking = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { book_id, facility_id, trainer_id } = req.body;
	let affectedRows;
	if (facility_id && trainer_id) {
		[{ affectedRows }] = await pool.query(
			`DELETE 
			FROM
				books
			WHERE
				book_id = ?
			AND
				user_id = ?
			AND
				facility_id = ?
			AND
				trainer_id = ?`,
			[book_id, user_id, facility_id, trainer_id]
		);
	} else if (facility_id) {
		[{ affectedRows }] = await pool.query(
			`DELETE 
			FROM
				book_facilities
			WHERE
				book_facility_id = ?
			AND
				user_id = ?
			AND
				facility_id = ?`,
			[book_id, user_id, facility_id]
		);
	}
	if (affectedRows === 0) {
		res.status(404).json({
			message: 'No booking found',
		});
		return;
	}
	res.status(200).json({
		message: 'Successfully removed booking',
	});
});

const userGenerateReceipt = expressAsyncHandler(async (req, res) => {
	const doc = new PDFDocument();
	const { user_id } = req.user;
	const qrData = `https://www.google.com/search?q=Shihab+Sarar`;
	const qrCodeBuffer = await QRCode.toBuffer(qrData);
	res.setHeader('Content-Type', 'application/pdf');
	res.setHeader('Content-Disposition', 'attachment; filename="example.pdf"');

	doc.pipe(res);

	doc.fontSize(25).text('Receipt for Your Purchase', 100, 100);
	doc.fontSize(12).text(
		'This is a simple receipt PDF generated on the fly.',
		100,
		150
	);
	doc.text('Your purchase has been successfully processed.', 100, 200);

	doc.image(qrCodeBuffer, 100, 250, { width: 100 });

	doc.end();
});

export {
	userAddReview,
	userAddReviewImg,
	userAddPost,
	userAddPostImage,
	userCommunity,
	userReservePostForFollowers,
	userRecommendedPost,
	userIndividualPost,
	userGetComments,
	userProfile,
	userOwnPosts,
	userUnreadChats,
	userNormalChats,
	userGetMessagesInChat,
	userCreateChat,
	userDeleteAccount,
	userLikePost,
	userRemoveLikePost,
	userFollow,
	userAddComment,
	userLikeComment,
	userGetNotifications,
	userAddReviewFacility,
	userHandleNotificationStatus,
	userRemoveLikeComment,
	userUnfollow,
	userBooksFacilityWithTrainer,
	userBookFacility,
	ensureBookPersonalities,
	userGetReviewSummary,
	userRemoveBooking,
	userAddFacilityReviewImg,
	userDeleteMessage,
	userDeleteChat,
	userGenerateReceipt,
	userMarkNotificationAsRead,
	userMarkAllNotificationsAsRead,
};
