import {
	connectUser,
	disconnectUser,
	joinChat,
	leaveChat,
	sendMessage,
	startTyping,
	stopTyping,
	uploadImage,
} from './socketControllers.js';

//TODO have to handle token in every socket
//TODO have to force steps unless unexpected behaviors
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

	socket.on('typing', (data) => startTyping(data, socket));
	socket.on('stop_typing', (data) => stopTyping(data, socket));

	socket.on('send_message', async (data) => {
		await sendMessage(data, socket);
	});

	socket.on('send_img', async (img, data) => {
		console.log(img);
		console.log(data);
		await uploadImage(img, data, socket);
	});
};

export { socketInitialize };
