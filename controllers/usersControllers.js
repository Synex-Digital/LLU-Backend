import expressAsyncHandler from 'express-async-handler';
import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import { generateRandomString } from '../utilities/generateRandomString.js';

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
	const { post_id } = req.body;
	if (!post_id && typeof post_id !== 'number') {
		res.status(400).json({
			message: 'Post id is missing in the url or of wrong datatype',
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
	console.log(comments);
	req.comments = comments;
	next();
});

const userIndividualPost = expressAsyncHandler(async (req, res) => {
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const { post_id } = req.body;
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
	const { user_id } = req.body;
	if (!user_id || typeof user_id !== 'number') {
		res.status(400).json({
			message: 'user_id is missing or of wrong type',
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
		followed,
		follower_no,
		following_no,
	};
	next();
});

const userOwnPosts = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.body;
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
			c.room_id,
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
			MAX(m.time) AS last_message_time
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
			c.last_accessed DESC
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

const userGetMessagesInChat = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	const { room_id } = req.body;
	if (!room_id || typeof room_id !== 'string') {
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
			u.last_name
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

const userCreateChat = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.body;
	if (!user_id || typeof user_id !== 'number') {
		res.status(400).json({
			message: 'user_id is missing or of wrong data type',
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
	const roomId = generateRandomString(16);
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO chats (user_id, room_id, friend_user_id) VALUES (?, ?, ?)`,
		[user.user_id, roomId, user_id]
	);
	if (affectedRows === 0) throw new Error('Failed to create chat');
	const [insertStatus] = await pool.query(
		`INSERT INTO chats (user_id, room_id, friend_user_id) VALUES (?, ?, ?)`,
		[user_id, roomId, user.user_id]
	);
	if (insertStatus.affectedRows === 0)
		throw new Error('Failed to create chat');
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
	const [{ affectedRows }] = await pool.query(
		`INSERT INTO follows (follower_user_id, followed_user_id, notification_status) VALUES (?, ?, ?)`,
		[user.user_id, user_id, 'all']
	);
	if (affectedRows === 0) throw new Error('Failed to follow user');
	res.status(200).json({
		message: 'Successfully followed user',
	});
});

const userAddComment = expressAsyncHandler(async (req, res) => {
	const { post_id } = req.body;
	const { user_id } = req.user;
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
	res.status(200).json({
		message: 'Successfully added comment',
	});
});

//TODO have to handle self like feature
const userLikeComment = expressAsyncHandler(async (req, res) => {
	const { comment_id } = req.body;
	if (!comment_id || typeof comment_id !== 'number') {
		res.status(400).json({
			message: 'comment_id is missing or of wrong datatype',
		});
		return;
	}
	const [{ affectedRows }] = await pool.query(
		`UPDATE comments SET no_of_likes = no_of_likes + 1 WHERE comment_id = ?`,
		[comment_id]
	);
	if (affectedRows === 0) throw new Error('Failed to like comment');
	res.status(200).json({
		message: 'Successfully liked comment',
	});
});

const userGetNotifications = expressAsyncHandler(async (req, res) => {
	const { user_id } = req.user;
	let { page, limit } = req.query;
	page = parseInt(page) || 1;
	limit = parseInt(limit) || 10;
	const offset = (page - 1) * limit;
	const [notifications] = await pool.query(
		`SELECT * FROM notifications WHERE user_id = ? LIMIT ? OFFSET ?`,
		[user_id, limit, offset]
	);
	res.status(200).json({
		page,
		limit,
		data: notifications,
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
	userDeleteAccount,
	userLikePost,
	userRemoveLikePost,
	userFollow,
	userAddComment,
	userLikeComment,
	userGetNotifications,
};
