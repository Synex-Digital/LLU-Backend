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
	userDeleteAccount,
	userLikePost,
	userRemoveLikePost,
	userFollow,
	userAddComment,
	userLikeComment,
	userGetNotifications,
} from '../controllers/usersControllers.js';
import {
	uploadMultiple,
	uploadMultipleToS3,
} from '../middleware/uploadMiddleware.js';
import { sanitizeInput } from '../middleware/dangerousHTMLMiddleware.js';

const userRouter = Router();

userRouter
	.route('/add_post')
	.post(
		protect,
		uploadMultiple,
		uploadMultipleToS3,
		sanitizeInput,
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

userRouter.route('/delete_account/:user_id').get(protect, userDeleteAccount);

userRouter.route('/like/:post_id').get(protect, userLikePost);

userRouter.route('/remove_like/:post_id').get(protect, userRemoveLikePost);

userRouter.route('/follow/:user_id').get(protect, userFollow);

userRouter.route('/comment/:post_id').post(protect, userAddComment);

userRouter.route('/like_comment/:comment_id').get(protect, userLikeComment);

userRouter.route('/notifications').get(protect, userGetNotifications);

export { userRouter };
