import { pool } from '../config/db.js';
import { verifyToken } from '../utilities/verifyToken.js';

//TODO have to handle token in every socket
const socketInitialize = (socket) => {
	console.log('Connected to socket.io', socket.id);

	socket.on('connect_user', async (data) => {
		if (!data.token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(data.token);
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
	});
	socket.off('connect_user', async (data) => {
		if (!data.token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(data.token);
		const [{ affectedRows }] = await pool.query(
			`UPDATE users SET socket = ? WHERE user_id = ?`,
			[null, user.user_id]
		);
		if (affectedRows === 0) {
			socket.emit('validation', {
				message: 'Failed to connect user',
			});
			return;
		}
		console.log('disconnected');
	});

	socket.on('join_chat', async (data) => {
		if (!data.token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		if (!data.friend_user_id) {
			socket.emit('validation', {
				message: 'Friend user id is missing',
			});
			return;
		}
		const user = await verifyToken(data.token);
		const [[{ room_id }]] = await pool.query(
			`SELECT
				room_id
			FROM
				chats
			WHERE
				user_id = ?
			AND
				friend_user_id = ?`,
			[user.user_id, data.friend_user_id]
		);
		socket.join(room_id);
		console.log('Joined room: ' + room_id);
	});
	socket.on('leave_chat', async (data) => {
		if (!data.token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(data.token);
		if (!user) {
			socket.emit('validation', {
				message: 'Invalid token',
			});
			return;
		}
		socket.leave(data.room_id);
		console.log('Left room: ' + data.room_id);
	});

	socket.on('typing', (room) => socket.in(room).emit('typing'));
	socket.on('stop_typing', (room) => socket.in(room).emit('stop_typing'));

	socket.on('send_message', async (data) => {
		if (!data.room_id) {
			socket.emit('validation', {
				message: 'Room id is missing',
			});
			return;
		}
		//TODO have to handle if user is not online and DB
		if (!data.token) {
			socket.emit('validation', {
				message: 'Token is missing',
			});
			return;
		}
		const user = await verifyToken(data.token);
		if (user.socket_id) {
			socket.in(data.room_id).emit('receive_message', data.message);
			return;
		}
	});
};

export { socketInitialize };
