import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
	userAddPost,
	userAddPostImage,
	userCommunity,
	userUnreadChats,
	userGetComments,
	userIndividualPost,
	userNormalChats,
	userOwnPosts,
	userProfile,
	userRecommendedPost,
	userReservePostForFollowers,
	userGetMessagesInChat,
	userCreateChat,
} from '../controllers/usersControllers.js';
import { uploadMultiple } from '../middleware/uploadMiddleware.js';

const userRouter = Router();

userRouter
	.route('/add_post')
	.post(
		protect,
		uploadMultiple,
		userAddPost,
		userAddPostImage,
		userReservePostForFollowers
	);

userRouter.route('/posts').get(protect, userCommunity, userRecommendedPost);

userRouter
	.route('/posts/:post_id')
	.get(protect, userGetComments, userIndividualPost);

userRouter.route('/profile/:user_id').get(protect, userProfile, userOwnPosts);

userRouter.route('/create_chat/:user_id').get(protect, userCreateChat);

userRouter.route('/chats').get(protect, userUnreadChats, userNormalChats);

userRouter.route('/chats/:room_id').get(protect, userGetMessagesInChat);

export { userRouter };
