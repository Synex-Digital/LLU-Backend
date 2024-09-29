import { pool } from '../config/db.js';
import { uploadDir } from '../middleware/uploadMiddleware.js';
import { verifyToken } from '../utilities/verifyToken.js';
import { promises as fs } from 'fs';
import path from 'path';

const connectUser = async (data, socket) => {
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
	console.log('connected');
};

const disconnectUser = async (data, socket) => {
	const { token } = data;
	if (!token) {
		socket.emit('validation', {
			message: 'Token is missing',
		});
		return;
	}
	const user = await verifyToken(token);
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
	console.log('disconnected');
};

const joinChat = async (data, socket) => {
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
};

const leaveChat = async (data, socket) => {
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
	socket.leave(room_id);
	console.log('Left room: ' + room_id);
	socket.emit('status', {
		room_id,
		message: 'Successfully left chat',
	});
};

const startTyping = (data, socket) => {
	const { room_id, user_id } = data;
	if (!room_id) {
		socket.emit('validation', {
			message: 'Room id is missing',
		});
		return;
	}
	if (!user_id) {
		socket.emit('validation', {
			message: 'User id is missing',
		});
		return;
	}
	console.log(user_id, 'started typing in', room_id);
	socket.in(room_id).emit('typing', {
		user_id,
		message: 'User started typing',
	});
};

const stopTyping = (data, socket) => {
	const { room_id, user_id } = data;
	if (!room_id) {
		socket.emit('validation', {
			message: 'Room id is missing',
		});
		return;
	}
	if (!user_id) {
		socket.emit('validation', {
			message: 'User id is missing',
		});
		return;
	}
	console.log(user_id, 'stopped typing in', room_id);
	socket.in(room_id).emit('stop_typing', {
		user_id,
		message: 'User stopped typing',
	});
};

const sendMessage = async (data, socket) => {
	const { token, room_id, chat_id, content, time, user_id } = data;
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
	if (!chat_id || !content || !time) {
		socket.emit('validation', {
			message: 'Missing attributes in sent data',
		});
		return;
	}
	const [{ insertId, affectedRows }] = await pool.query(
		`INSERT INTO messages (chat_id, content, time) VALUES (?, ?, ?)`,
		[chat_id, content, time]
	);
	if (affectedRows === 0) {
		socket.emit('validation', {
			message: 'Failed to send message',
		});
		return;
	}
	if (user.socket_id) {
		socket.in(room_id).emit('receive_message', {
			time,
			user_id,
			room_id,
			chat_id,
			message_content: content,
		});
		return;
	}
	const [insertStatus] = await pool.query(
		`INSERT INTO unseen_messages (message_id, user_id) VALUES (?, ?)`,
		[insertId, user_id]
	);
	if (insertStatus.affectedRows === 0) {
		socket.emit('validation', {
			message: 'Failed to send message and user is offline',
		});
		return;
	}
};

const uploadImage = async (img, data, socket) => {
	console.log('Entered uploadImage()');
	try {
		console.log(data);
		console.log(img);
		const { imageName, chat_id, time } = data;
		const imagePath = path.join(uploadDir, `${Date.now()}-${imageName}`);
		console.log(imagePath);
		await fs.writeFile(imagePath, img);

		console.log('Image uploaded successfully');
		const [{ affectedRows }] = await pool.query(
			`INSERT INTO messages (chat_id, content, time) VALUES (?, ?, ?)`,
			[chat_id, imagePath, time]
		);
		if (affectedRows === 0) {
			socket.emit('validation', { message: 'Failed to add message' });
			return;
		}
		socket.emit('validation', { message: 'Image uploaded successfully' });
	} catch (err) {
		console.error('Error during image upload or DB operation:', err);
		socket.emit('validation', { message: 'Image upload failed' });
	}
};

export {
	connectUser,
	disconnectUser,
	joinChat,
	leaveChat,
	startTyping,
	stopTyping,
	sendMessage,
	uploadImage,
};
