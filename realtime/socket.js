import {
	connectUser,
	disconnectUser,
	disconnectUserBackup,
	joinChat,
	leaveChat,
	sendMessage,
	startTyping,
	stopTyping,
	uploadImage,
} from './socketControllers.js';

const socketInitialize = (socket) => {
	console.log('Connected to socket.io', socket.id);

	socket.on('connect_user', async (data) => {
		await connectUser(data, socket);
	});
	socket.on('disconnect_user', async (data) => {
		await disconnectUser(data, socket);
	});

	socket.on('join_chat', async (data) => {
		await joinChat(data, socket);
	});
	socket.on('leave_chat', async (data) => {
		await leaveChat(data, socket);
	});

	socket.on('typing', async (data) => await startTyping(data, socket));
	socket.on('stop_typing', async (data) => await stopTyping(data, socket));

	socket.on('send_message', async (data) => {
		await sendMessage(data, socket);
	});

	socket.on('send_img', async (data) => {
		await uploadImage(data, socket);
	});

	socket.on('disconnect', async (reason) => {
		await disconnectUserBackup(socket);
		console.log(`User disconnected ${socket.id} due to ${reason}`);
	});
};

export { socketInitialize };
