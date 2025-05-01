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
	userHandleNotificationStatus,
	userRemoveLikeComment,
	userUnfollow,
	userBookFacility,
	userBooksFacilityWithTrainer,
	ensureBookPersonalities,
	userGetReviewSummary,
	userRemoveBooking,
	userDeleteMessage,
	userDeleteChat,
} from '../controllers/usersControllers.js';
import {
	uploadMultiple,
	uploadMultipleToS3,
} from '../middleware/uploadMiddleware.js';
import { sanitizeInput } from '../middleware/dangerousHTMLMiddleware.js';
import { createPaymentIntent } from '../controllers/paymentControllers.js';

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
	.route('/individual_post')
	.post(protect, userGetComments, userIndividualPost);

userRouter.route('/profile').post(protect, userProfile, userOwnPosts);

userRouter.route('/create_chat').post(protect, userCreateChat);

userRouter.route('/chats').get(protect, userNormalChats);

userRouter
	.route('/chat_notification')
	.post(protect, userHandleNotificationStatus);

userRouter.route('/messages').post(protect, userGetMessagesInChat);

userRouter.route('/delete_message').delete(protect, userDeleteMessage);

userRouter.route('/delete_account').get(protect, userDeleteAccount);

userRouter.route('/delete_chat').delete(protect, userDeleteChat);

userRouter.route('/like').post(protect, userLikePost);

userRouter.route('/remove_like').delete(protect, userRemoveLikePost);

userRouter.route('/follow').post(protect, userFollow);

userRouter.route('/unfollow').delete(protect, userUnfollow);

userRouter.route('/comment').post(protect, userAddComment);

userRouter.route('/like_comment').post(protect, userLikeComment);

userRouter.route('/remove_like_comment').delete(protect, userRemoveLikeComment);

userRouter.route('/notifications').get(protect, userGetNotifications);

userRouter
	.route('/book')
	.post(
		protect,
		ensureBookPersonalities,
		userBookFacility,
		userBooksFacilityWithTrainer
	)
	.delete(protect, ensureBookPersonalities, userRemoveBooking);

userRouter
	.route('/book_summary')
	.get(protect, ensureBookPersonalities, userGetReviewSummary);

userRouter
	.route('/payment')
	.post(protect, ensureBookPersonalities, createPaymentIntent);

export { userRouter };
