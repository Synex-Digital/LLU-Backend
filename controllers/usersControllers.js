import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';

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
	for (const path of filePaths) {
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
		message: 'Successfully added post',
	});
});

//TODO handle dangerous html
const userCommunity = expressAsyncHandler(async (req, res, next) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const { user_id } = req.user;
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
		console.log('moving to next');
		next();
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`DELETE FROM user_unseen_posts WHERE user_id = ?`,
		[user_id]
	);
	if (affectedRows === 0)
		throw new Error('Failed to delete posts after fetching');
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
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [recommendedPosts] = await pool.query(
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
		[limit, offset]
	);
	const filteredRecommendedPosts = recommendedPosts.map((post) => ({
		...post,
		post_images: post.post_images ? post.post_images.split(',') : [],
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
	const { post_id } = req.params;
	if (!post_id) {
		res.status(400).json({
			message: 'Post id is missing in the url',
		});
		return;
	}
	const [comments] = await pool.query(
		`SELECT
			c.comment_id,
			c.time,
			c.content,
			c.no_of_likes,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img
		FROM
			comments c
		LEFT JOIN
			users u ON u.user_id = c.user_id
		WHERE
			c.post_id = ?
		LIMIT ? OFFSET ?`,
		[post_id, limit, offset]
	);
	req.comments = comments;
	next();
});

const userIndividualPost = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const { post_id } = req.params;
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
			p.post_id = ?
		GROUP BY
			p.post_id,
			u.first_name,
			u.last_name,
			u.img,
			u.profile_picture,
			p.time,
			p.content`,
		[post_id]
	);
	if (!post) throw new Error('There are no post by this id');
	const filteredPost = {
		...post,
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
	const { user_id, first_name, last_name, profile_picture, img } = req.user;
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
		user: {
			user_id,
			first_name,
			last_name,
			profile_picture,
			img,
		},
		follower_no,
		following_no,
	};
	next();
});

const userOwnPosts = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
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

const userUnreadChats = expressAsyncHandler(async (req, res, next) => {
	const { user_id } = req.user;
	const [chats] = await pool.query(
		`SELECT
			c.chat_id,
			c.notification_status,
			c.room_id,
			IF(u.socket_id IS NULL, FALSE, TRUE) AS active,
			COUNT(m.content) AS no_of_messages,
			(
				SELECT m1.content
				FROM messages m1
				WHERE m1.chat_id = c.chat_id
				ORDER BY m1.time DESC
				LIMIT 1
			) AS latest_message_content,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			MAX(m.time) AS last_message_time
		FROM
			chats c
		INNER JOIN
			messages m ON c.chat_id = m.chat_id
		INNER JOIN
			unseen_messages um ON m.message_id = um.message_id
		INNER JOIN
			users u ON c.user_id = u.user_id
		WHERE
			um.user_id = ?
		GROUP BY
			c.chat_id,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img`,
		[user_id]
	);
	req.newMessageChats = chats;
	next();
});

const userNormalChats = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [chats] = await pool.query(
		`SELECT
			c.chat_id,
			c.notification_status,
			c.room_id,
			IF(u.socket_id IS NULL, FALSE, TRUE) AS active,
			(
				SELECT m1.content
				FROM messages m1
				WHERE m1.chat_id = c.chat_id
				ORDER BY m1.time DESC
				LIMIT 1
			) AS latest_message_content,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img,
			MAX(m.time) AS last_message_time
		FROM
			chats c
		LEFT JOIN
			messages m ON c.chat_id = m.chat_id
		INNER JOIN
			users u ON c.friend_user_id = u.user_id
		WHERE
			c.user_id = ?
		AND
			c.new_messages = ?
		GROUP BY
			c.chat_id,
			u.first_name,
			u.last_name,
			u.profile_picture,
			u.img
		ORDER BY
			c.last_accessed DESC
		LIMIT ? OFFSET ?`,
		[user_id, 0, limit, offset]
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

//TODO prevent other user from getting access to room id messages
const userGetMessagesInChat = expressAsyncHandler(async (req, res) => {
	const { room_id } = req.params;
	let { start_time, end_time } = req.query;
	const startTime = new Date(start_time);
	const endTime = new Date(end_time);
	if (startTime > endTime) {
		res.status(400).json({
			messages: 'Invalid date range',
		});
		return;
	}
	start_time += ' 00:00:00';
	end_time += ' 23:59:59';
	console.log(start_time, end_time);
	if (!room_id) {
		res.status(400).json({
			message: 'Chat id is missing the url',
		});
		return;
	}
	const [messages] = await pool.query(
		`SELECT
			m.message_id,
			m.content,
			m.time,
			u.user_id,
			u.first_name,
			u.last_name
		FROM
			messages m
		RIGHT JOIN
			chats c ON c.chat_id = m.chat_id
		INNER JOIN
			users u ON u.user_id = c.user_id
		WHERE
			c.room_id = ?
			AND m.time BETWEEN ? AND ?
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

const userCreateChat = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.params;
	const { user } = req;
	const salt = await bcrypt.genSalt(parseInt(process.env.SALT_ITR));
	const room_id = await bcrypt.hash(user.user_id + '-' + user_id, salt);
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO chats (user_id, room_id, friend_user_id) VALUES (?, ?, ?)`,
		[user.user_id, room_id, user_id]
	);
	if (affectedRows === 0) throw new Error('Failed to create chat');
	const [insertStatus] = await pool.query(
		`INSERT INTO chats (user_id, room_id, friend_user_id) VALUES (?, ?, ?)`,
		[user_id, room_id, user.user_id]
	);
	if (insertStatus.affectedRows === 0)
		throw new Error('Failed to create chat');
	res.status(200).json({
		message: 'Chat created successfully',
	});
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
};
