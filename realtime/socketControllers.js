import { pool } from '../config/db.js';
import { verifyToken } from '../utilities/verifyToken.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { generateRandomString } from '../utilities/generateRandomString.js';
import { io } from '../index.js';

dotenv.config();
const s3Client = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
});

const connectUser = async (data, socket) => {
	try {
		const { token } = data;
		if (!token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		const [{ affectedRows }] = await pool.query(
			`UPDATE users SET socket_id = ? WHERE user_id = ?`,
			[socket.id, user.user_id]
		);
		if (affectedRows === 0) {
			socket.emit('validation', {
				message: 'Failed to connect user',
			});
			return;
		}
		let [sockets] = await pool.query(
			`SELECT
				u.user_id,
				u.socket_id
			FROM 
				chats c
			LEFT JOIN 
				users u ON c.friend_user_id = u.user_id
			WHERE 
				c.user_id = ?;`,
			[user.user_id]
		);
		sockets.forEach((socket) => {
			io.to(socket.socket_id).emit('user_active', {
				user_id: socket.user_id,
				message: 'User is active',
			});
		});
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

const disconnectUser = async (data, socket) => {
	try {
		const { token } = data;
		if (!token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		const [{ affectedRows }] = await pool.query(
			`UPDATE users SET socket_id = ? WHERE user_id = ?`,
			[null, user.user_id]
		);
		if (affectedRows === 0) {
			socket.emit('validation', {
				message: 'Failed to connect user',
			});
			return;
		}
		let [sockets] = await pool.query(
			`SELECT
				u.user_id,
				u.socket_id
			FROM 
				chats c
			LEFT JOIN 
				users u ON c.friend_user_id = u.user_id
			WHERE 
				c.user_id = ?;`,
			[user.user_id]
		);
		sockets.forEach((socket) => {
			io.to(socket.socket_id).emit('user_inactive', {
				user_id: socket.user_id,
				message: 'User is inactive',
			});
		});
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

const disconnectUserBackup = async (socket) => {
	try {
		console.log(socket.id);
		const [[user]] = await pool.query(
			`SELECT * FROM users WHERE socket_id = ?`,
			[socket.id]
		);
		if (!user) return;
		const [{ affectedRows }] = await pool.query(
			`UPDATE users SET socket_id = ? WHERE user_id = ?`,
			[null, user.user_id]
		);
		if (affectedRows === 0) {
			socket.emit('validation', {
				message: 'Failed to connect user',
			});
			return;
		}
		let [sockets] = await pool.query(
			`SELECT
				u.user_id,
				u.socket_id
			FROM 
				chats c
			LEFT JOIN 
				users u ON c.friend_user_id = u.user_id
			WHERE 
				c.user_id = ?;`,
			[user.user_id]
		);
		sockets.forEach((socket) => {
			io.to(socket.socket_id).emit('user_inactive', {
				user_id: socket.user_id,
				message: 'User is inactive',
			});
		});
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

const joinChat = async (data, socket) => {
	try {
		const { token, friend_user_id } = data;
		if (!token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		if (!friend_user_id) {
			socket.emit('validation', {
				message: 'Friend user id is missing',
			});
			return;
		}
		const user = await verifyToken(token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		console.log(user);
		if (!user.socket_id) {
			socket.emit('validation', {
				message: 'Connect user first',
			});
			return;
		}
		const [[{ room_id }]] = await pool.query(
			`SELECT
				room_id
			FROM
				chats
			WHERE
				user_id = ?
			AND
				friend_user_id = ?`,
			[user.user_id, friend_user_id]
		);
		if (!room_id) {
			socket.emit('validation', {
				message: 'Need to create chat first with this friend user',
			});
			return;
		}
		socket.join(room_id);
		console.log('Joined room: ' + room_id);
		socket.emit('status', {
			room_id,
			message: 'Successfully joined chat',
		});
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

const leaveChat = async (data, socket) => {
	try {
		const { token, room_id } = data;
		if (!token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		if (!user.socket_id) {
			socket.emit('validation', {
				message: 'Connect user first',
			});
			return;
		}
		socket.leave(room_id);
		console.log('Left room: ' + room_id);
		socket.emit('status', {
			room_id,
			message: 'Successfully left chat',
		});
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

const startTyping = async (data, socket) => {
	try {
		const { token, room_id } = data;
		if (!token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		if (!user.socket_id) {
			socket.emit('validation', {
				message: 'Connect user first',
			});
			return;
		}
		if (!room_id) {
			socket.emit('validation', {
				message: 'Room id is missing',
			});
			return;
		}
		console.log(user.user_id, 'started typing in', room_id);
		socket.in(room_id).emit('typing', {
			user_id: user.user_id,
			message: 'User started typing',
		});
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

const stopTyping = async (data, socket) => {
	try {
		const { token, room_id } = data;
		if (!token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		if (!user.socket_id) {
			socket.emit('validation', {
				message: 'Connect user first',
			});
			return;
		}
		if (!room_id) {
			socket.emit('validation', {
				message: 'Room id is missing',
			});
			return;
		}
		console.log(user.user_id, 'stopped typing in', room_id);
		socket.in(room_id).emit('stop_typing', {
			user_id: user.user_id,
			message: 'User stopped typing',
		});
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

const sendMessage = async (data, socket) => {
	try {
		const { token, room_id, chat_id, content } = data;
		if (!room_id) {
			socket.emit('validation', {
				message: 'Room id is missing',
			});
			return;
		}
		if (!token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		if (!user.socket_id) {
			socket.emit('validation', {
				message: 'Connect user first',
			});
			return;
		}
		if (!chat_id || !content) {
			socket.emit('validation', {
				message: 'Missing attributes in sent data',
			});
			return;
		}
		const [{ insertId, affectedRows }] = await pool.query(
			`INSERT INTO messages (chat_id, content) VALUES (?, ?)`,
			[chat_id, content]
		);
		if (affectedRows === 0) {
			socket.emit('validation', {
				message: 'Failed to send message',
			});
			return;
		}
		const [[{ time }]] = await pool.query(
			`SELECT time FROM messages WHERE message_id = ?`,
			[insertId]
		);
		console.log('Sending user: ', user.user_id);

		const [[{ user_id, socket_id }]] = await pool.query(
			`SELECT
				u.user_id,
				u.socket_id
			FROM
				chats c
			LEFT JOIN
				users u ON c.friend_user_id = u.user_id
			WHERE
				chat_id = ?`,
			[chat_id]
		);
		console.log('Receiving user: ', user_id);
		console.log(`FRIEND USER ${!!socket_id}`);
		if (socket_id) {
			socket.in(room_id).emit('receive_message', {
				time,
				user_id: user.user_id,
				room_id,
				chat_id,
				message_content: content,
			});
			return;
		}
		//TODO have to add friend_user_id because it is updating every user_id
		const [insertStatus] = await pool.query(
			`UPDATE 
				chats
			SET
				new_messages = new_messages + 1
			WHERE
				friend_user_id = ?
			AND
				room_id = ?`,
			[user_id, room_id]
		);
		if (insertStatus.affectedRows === 0) {
			socket.emit('validation', {
				message: 'Failed to send message',
			});
			return;
		}
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

const uploadImageToS3 = async (image) => {
	const matches = image.match(/^data:(.+?);base64,(.+)$/);
	if (!matches) throw new Error('Invalid base64 string format');
	console.log(matches);
	const mimeType = matches[1];
	const imageBuffer = Buffer.from(matches[2], 'base64');
	const imageName = generateRandomString();
	const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageName}`;
	await s3Client.send(
		new PutObjectCommand({
			Bucket: process.env.AWS_S3_BUCKET_NAME,
			Body: imageBuffer,
			Key: imageName,
			ContentType: mimeType,
		})
	);
	return imageUrl;
};

//TODO have to cut down user_id for every controller
const uploadImage = async (data, socket) => {
	try {
		const { room_id, chat_id, token, image } = data;
		if (!chat_id) {
			socket.emit('validation', {
				message: 'Chat id is missing',
			});
			return;
		}
		if (!room_id) {
			socket.emit('validation', {
				message: 'Room id is missing',
			});
			return;
		}
		if (!token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		if (!user.socket_id) {
			socket.emit('validation', {
				message: 'Connect user first',
			});
			return;
		}
		const imageUrl = await uploadImageToS3(image, socket);
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO messages (chat_id, content) VALUES (?, ?)`,
			[chat_id, imageUrl]
		);
		if (affectedRows === 0) throw new Error('Failed to send message');
		socket.to(room_id).emit('receive_img', {
			image: imageUrl,
		});
	} catch (error) {
		socket.emit('validation', {
			message: error.message,
		});
	}
};

export {
	connectUser,
	disconnectUser,
	disconnectUserBackup,
	joinChat,
	leaveChat,
	startTyping,
	stopTyping,
	sendMessage,
	uploadImage,
};
