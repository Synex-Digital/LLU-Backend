CREATE TABLE IF NOT EXISTS `amenities` (
  `amenity_id` bigint(20) NOT NULL,
  `name` varchar(70) NOT NULL,
  `facility_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `athletes` (
  `athlete_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `age` int(11) NOT NULL,
  `weight` float NOT NULL,
  `height` int(11) NOT NULL,
  `sport_interest` enum('soccer','rugby','basketball','badminton','tennis','volleyball','cricket') NOT NULL,
  `sport_level` enum('beginner','intermediate','advanced') NOT NULL,
  `gender` enum('male','female') NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `books` (
  `book_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `facility_id` bigint(20) NOT NULL,
  `trainer_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `book_facilities` (
  `book_facility_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `facility_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `certificates` (
  `certificate_id` bigint(20) NOT NULL,
  `title` varchar(100) NOT NULL,
  `organization` varchar(50) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `trainer_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `chats` (
  `chat_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `room_id` varchar(100) DEFAULT NULL,
  `friend_user_id` bigint(20) NOT NULL,
  `last_accessed` timestamp NULL DEFAULT current_timestamp(),
  `notification_status` enum('all','muted') NOT NULL DEFAULT 'all',
  `new_messages` tinyint(1) NOT NULL DEFAULT 0
) ;

CREATE TABLE IF NOT EXISTS `children` (
  `child_id` bigint(20) NOT NULL,
  `parent_id` bigint(20) NOT NULL,
  `name` varchar(70) NOT NULL,
  `age` int(11) NOT NULL,
  `gender` enum('male','female') NOT NULL,
  `sport_interest` varchar(30) NOT NULL,
  `sport_level` enum('beginner','intermediate','advanced') NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `comments` (
  `comment_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `post_id` bigint(20) NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp(),
  `content` text NOT NULL,
  `no_of_likes` int(11) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `educations` (
  `education_id` bigint(20) NOT NULL,
  `course_name` varchar(70) NOT NULL,
  `institute_name` varchar(50) NOT NULL,
  `study_status` enum('studying','completed') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `trainer_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `experiences` (
  `experience_id` bigint(20) NOT NULL,
  `trainer_id` bigint(20) NOT NULL,
  `designation` varchar(50) NOT NULL,
  `company_name` varchar(50) NOT NULL,
  `work_status` enum('left','current') NOT NULL,
  `job_type` enum('hourly','fulltime') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `facilitators` (
  `facilitator_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `no_of_professionals` int(11) NOT NULL,
  `iso_certified` tinyint(1) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `facilitator_employees` (
  `facilitator_employee_id` bigint(20) NOT NULL,
  `facilitator_id` bigint(20) NOT NULL,
  `trainer_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `facilities` (
  `facility_id` bigint(20) NOT NULL,
  `facilitator_id` bigint(20) NOT NULL,
  `hourly_rate` float NOT NULL,
  `name` varchar(70) NOT NULL,
  `description` text NOT NULL,
  `latitude` float DEFAULT NULL,
  `longitude` float DEFAULT NULL,
  `capacity` int(11) NOT NULL,
  `established_in` year(4) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `facility_availability_hours` (
  `facility_availability_hour_id` bigint(20) NOT NULL,
  `facility_id` bigint(20) NOT NULL,
  `week_day` enum('saturday','sunday','monday','tuesday','wednesday','thursday','friday') NOT NULL,
  `available_hours` varchar(70) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `facility_employees` (
  `facility_employe_id` bigint(20) NOT NULL,
  `facility_id` bigint(20) NOT NULL,
  `trainer_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `facility_img` (
  `facility_img_id` bigint(20) NOT NULL,
  `facility_id` bigint(20) NOT NULL,
  `img` text NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `facility_sessions` (
  `facility_sessions_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `facility_id` bigint(20) NOT NULL,
  `no_of_athletes` int(11) NOT NULL,
  `name` varchar(100) NOT NULL DEFAULT 'Session',
  `start_time` timestamp NULL DEFAULT NULL,
  `end_time` timestamp NULL DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` enum('upcoming','completed','ongoing') NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `favorite_facilitator` (
  `favorite_facilitator_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `facilitator_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `favorite_trainer` (
  `favorite_trainer_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `trainer_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `follows` (
  `follow_id` bigint(20) NOT NULL,
  `follower_user_id` bigint(20) NOT NULL,
  `followed_user_id` bigint(20) NOT NULL,
  `notification_status` enum('all','mute') NOT NULL DEFAULT 'all'
) ;

CREATE TABLE IF NOT EXISTS `forgot_password` (
  `forgot_password_id` bigint(20) NOT NULL,
  `email` varchar(70) NOT NULL,
  `otp` int(11) NOT NULL,
  `expires_in` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `likes` (
  `like_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `post_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `messages` (
  `message_id` bigint(20) NOT NULL,
  `chat_id` bigint(20) NOT NULL,
  `content` text NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp()
) ;

CREATE TABLE IF NOT EXISTS `notifications` (
  `notification_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `title` varchar(70) NOT NULL,
  `content` text NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp(),
  `read_status` enum('yes','no') NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `not_notified_users` (
  `not_notified_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `notification_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `parents` (
  `parent_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `payments` (
  `payment_id` varchar(70) NOT NULL,
  `facility_amount` float NOT NULL,
  `trainer_amount` float NOT NULL,
  `athlete_id` bigint(20) NOT NULL,
  `currency` varchar(20) NOT NULL,
  `method` varchar(20) NOT NULL,
  `trainer_id` bigint(20) NOT NULL,
  `facility_id` bigint(20) NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp()
) ;

CREATE TABLE IF NOT EXISTS `payments_facility` (
  `payment_facility_id` bigint(20) NOT NULL,
  `method` varchar(20) NOT NULL,
  `currency` varchar(20) NOT NULL,
  `facility_amount` float NOT NULL,
  `athlete_id` bigint(20) NOT NULL,
  `facility_id` bigint(20) NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp()
) ;

CREATE TABLE IF NOT EXISTS `posts` (
  `post_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp(),
  `content` text NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `post_img` (
  `post_img_id` bigint(20) NOT NULL,
  `post_id` bigint(20) NOT NULL,
  `img` varchar(100) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `review_facilitators` (
  `review_facilitator_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `rating` float NOT NULL,
  `content` text NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp(),
  `facilitator_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `review_facility` (
  `review_facility_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `rating` float NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp(),
  `facility_id` bigint(20) NOT NULL,
  `content` text NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `review_trainer` (
  `review_trainer_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `rating` float NOT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp(),
  `trainer_id` bigint(20) NOT NULL,
  `content` text NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `review_trainer_img` (
  `review_trainer_img_id` bigint(20) NOT NULL,
  `review_trainer_id` bigint(20) NOT NULL,
  `img` text NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `token_management` (
  `token_management_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `token` varchar(200) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `trainers` (
  `trainer_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `hourly_rate` float NOT NULL,
  `no_of_facility` int(11) NOT NULL DEFAULT 0,
  `no_of_students` int(11) NOT NULL DEFAULT 0,
  `specialization` enum('soccer','rugby','basketball','badminton','tennis','volleyball','cricket') NOT NULL,
  `specialization_level` enum('beginner','intermediate','advanced') NOT NULL,
  `gender` enum('male','female') DEFAULT NULL
) ;

CREATE TABLE IF NOT EXISTS `trainer_availability_hours` (
  `trainer_availability_hours_id` bigint(20) NOT NULL,
  `week_day` enum('saturday','sunday','monday','tuesday','wednesday','thursday','friday') NOT NULL,
  `available_hours` varchar(50) NOT NULL,
  `trainer_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `trainer_sessions` (
  `trainer_session_id` bigint(20) NOT NULL,
  `trainer_id` bigint(20) NOT NULL,
  `facility_sessions_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `unseen_messages` (
  `unseen_message_id` bigint(20) NOT NULL,
  `message_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS `users` (
  `user_id` bigint(20) NOT NULL,
  `socket_id` varchar(32) DEFAULT NULL,
  `google_id` varchar(30) DEFAULT NULL,
  `first_name` varchar(60) NOT NULL,
  `last_name` varchar(60) NOT NULL,
  `profile_picture` text DEFAULT NULL,
  `img` text NOT NULL DEFAULT 'https://cdn-icons-png.flaticon.com/256/20/20079.png',
  `latitude` float DEFAULT NULL,
  `longitude` float DEFAULT NULL,
  `level` int(11) NOT NULL DEFAULT 0,
  `type` enum('athlete','trainer','facilitator','parent') NOT NULL DEFAULT 'athlete',
  `email` varchar(70) NOT NULL,
  `password` varchar(70) DEFAULT NULL,
  `no_of_sessions` int(11) NOT NULL DEFAULT 0,
  `phone` varchar(30) DEFAULT NULL,
  `short_description` text DEFAULT NULL
) ;

CREATE TABLE IF NOT EXISTS `user_unseen_posts` (
  `user_unseen_post_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  `post_id` bigint(20) NOT NULL
) ;

ALTER TABLE `amenities`
  ADD PRIMARY KEY (`amenity_id`),
  ADD KEY `fk_amenity_facility_id` (`facility_id`);

ALTER TABLE `athletes`
  ADD PRIMARY KEY (`athlete_id`),
  ADD KEY `user_id` (`user_id`);

ALTER TABLE `books`
  ADD PRIMARY KEY (`book_id`),
  ADD KEY `fk_book_trainer_id` (`trainer_id`),
  ADD KEY `fk_book_facility_id` (`facility_id`),
  ADD KEY `fk_book_user_id` (`user_id`);

ALTER TABLE `book_facilities`
  ADD PRIMARY KEY (`book_facility_id`),
  ADD KEY `fk_book_facility_facility_id` (`facility_id`),
  ADD KEY `fk_book_facility_user_id` (`user_id`);

ALTER TABLE `certificates`
  ADD PRIMARY KEY (`certificate_id`),
  ADD KEY `fk_certificates_trainer_id` (`trainer_id`);

ALTER TABLE `chats`
  ADD PRIMARY KEY (`chat_id`),
  ADD KEY `fk_chat_user_id` (`user_id`),
  ADD KEY `fk_chat_friend_user_id` (`friend_user_id`);

ALTER TABLE `children`
  ADD PRIMARY KEY (`child_id`),
  ADD KEY `parent_id` (`parent_id`);

ALTER TABLE `comments`
  ADD PRIMARY KEY (`comment_id`),
  ADD KEY `fk_comment_user_id` (`user_id`),
  ADD KEY `fk_comment_post_id` (`post_id`);

ALTER TABLE `educations`
  ADD PRIMARY KEY (`education_id`),
  ADD KEY `fk_education_trainer_id` (`trainer_id`);

ALTER TABLE `experiences`
  ADD PRIMARY KEY (`experience_id`),
  ADD KEY `fk_experiece_trainer_id` (`trainer_id`);

ALTER TABLE `facilitators`
  ADD PRIMARY KEY (`facilitator_id`),
  ADD KEY `user_id` (`user_id`);

ALTER TABLE `facilitator_employees`
  ADD PRIMARY KEY (`facilitator_employee_id`),
  ADD KEY `fk_facilitator_employees_facilitator_id` (`facilitator_id`),
  ADD KEY `fk_facilitator_employees_trainer_id` (`trainer_id`);

ALTER TABLE `facilities`
  ADD PRIMARY KEY (`facility_id`),
  ADD KEY `fk_facility_facilitator_id` (`facilitator_id`);

ALTER TABLE `facility_availability_hours`
  ADD PRIMARY KEY (`facility_availability_hour_id`),
  ADD KEY `fk_facility_availability_hour_facility_id` (`facility_id`);

ALTER TABLE `facility_employees`
  ADD PRIMARY KEY (`facility_employe_id`),
  ADD KEY `fk_facility_employees_facility_id` (`facility_id`),
  ADD KEY `fk_facility_employees_trainer_id` (`trainer_id`);

ALTER TABLE `facility_img`
  ADD PRIMARY KEY (`facility_img_id`),
  ADD KEY `fk_facility_img_facility_id` (`facility_id`);

ALTER TABLE `facility_sessions`
  ADD PRIMARY KEY (`facility_sessions_id`),
  ADD KEY `fk_athletes_facilitators_sessions_user_id` (`user_id`),
  ADD KEY `fk_athletes_facilitators_sessions_facility_id` (`facility_id`);

ALTER TABLE `favorite_facilitator`
  ADD PRIMARY KEY (`favorite_facilitator_id`),
  ADD KEY `fk_athlete_favorite_facilitator_facilitator_id` (`facilitator_id`),
  ADD KEY `fk_athlete_favorite_facilitator_user_id` (`user_id`);

ALTER TABLE `favorite_trainer`
  ADD PRIMARY KEY (`favorite_trainer_id`),
  ADD KEY `fk_athlete_favorite_trainer_trainer_id` (`trainer_id`),
  ADD KEY `fk_athlete_favorite_trainer_user_id` (`user_id`);

ALTER TABLE `follows`
  ADD PRIMARY KEY (`follow_id`),
  ADD KEY `fk_follow_follower_user_id` (`follower_user_id`),
  ADD KEY `fk_follow_followed_user_id` (`followed_user_id`);

ALTER TABLE `forgot_password`
  ADD PRIMARY KEY (`forgot_password_id`);

ALTER TABLE `likes`
  ADD PRIMARY KEY (`like_id`),
  ADD KEY `fk_likes_user_id` (`user_id`),
  ADD KEY `fk_like_post_id` (`post_id`);

ALTER TABLE `messages`
  ADD PRIMARY KEY (`message_id`),
  ADD KEY `fk_message_chat_id` (`chat_id`);

ALTER TABLE `notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `fk_notification_user_id` (`user_id`);

ALTER TABLE `not_notified_users`
  ADD PRIMARY KEY (`not_notified_id`),
  ADD KEY `fk_not_notified_user_user_id` (`user_id`),
  ADD KEY `fk_not_notified_user_notification_id` (`notification_id`);

ALTER TABLE `parents`
  ADD PRIMARY KEY (`parent_id`),
  ADD KEY `user_id` (`user_id`);

ALTER TABLE `payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `fk_payment_athlete_id` (`athlete_id`),
  ADD KEY `fk_payment_trainer_id` (`trainer_id`),
  ADD KEY `fk_payment_facility_id` (`facility_id`);

ALTER TABLE `payments_facility`
  ADD PRIMARY KEY (`payment_facility_id`),
  ADD KEY `fk_payment_facility_athlete_id` (`athlete_id`),
  ADD KEY `fk_payment_facility_facility_id` (`facility_id`);

ALTER TABLE `posts`
  ADD PRIMARY KEY (`post_id`),
  ADD KEY `fk_post_user_id` (`user_id`);

ALTER TABLE `post_img`
  ADD PRIMARY KEY (`post_img_id`);

ALTER TABLE `review_facilitators`
  ADD PRIMARY KEY (`review_facilitator_id`),
  ADD KEY `fk_review_facilitator_user_id` (`user_id`),
  ADD KEY `fk_review_facilitator_facilitator_id` (`facilitator_id`);

ALTER TABLE `review_facility`
  ADD PRIMARY KEY (`review_facility_id`),
  ADD KEY `fk_review_facility_facility_id` (`facility_id`),
  ADD KEY `fk_review_facilitaty_user_id` (`user_id`);

ALTER TABLE `review_trainer`
  ADD PRIMARY KEY (`review_trainer_id`),
  ADD KEY `fk_athletes_review_trainer_user_id` (`user_id`),
  ADD KEY `fk_athletes_review_trainer_trainer_id` (`trainer_id`);

ALTER TABLE `review_trainer_img`
  ADD PRIMARY KEY (`review_trainer_img_id`),
  ADD KEY `fk_review_trainer_img_review_trainer_id` (`review_trainer_id`);

ALTER TABLE `token_management`
  ADD PRIMARY KEY (`token_management`),
  ADD KEY `fk_token_management_user_id` (`user_id`);

ALTER TABLE `trainers`
  ADD PRIMARY KEY (`trainer_id`),
  ADD KEY `user_id` (`user_id`);

ALTER TABLE `trainer_availability_hours`
  ADD PRIMARY KEY (`trainer_availability_hours_id`),
  ADD KEY `fk_trainer_availability_hours_trainer_id` (`trainer_id`);

ALTER TABLE `trainer_sessions`
  ADD PRIMARY KEY (`trainer_session_id`),
  ADD KEY `fk_athletes_trainer_session_trainer_id` (`trainer_id`),
  ADD KEY `fk_athletes_trainer_session_facilitator_session_id` (`facility_sessions_id`);

ALTER TABLE `unseen_messages`
  ADD PRIMARY KEY (`unseen_message_id`),
  ADD KEY `fk_unseen_message_message_id` (`message_id`),
  ADD KEY `fk_unseen_message_user_id` (`user_id`);

ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `socket_id` (`socket_id`),
  ADD UNIQUE KEY `google_id` (`google_id`),
  ADD KEY `email_2` (`email`);

ALTER TABLE `user_unseen_posts`
  ADD PRIMARY KEY (`user_unseen_post_id`),
  ADD KEY `fk_user_unseen_posts_user_id` (`user_id`),
  ADD KEY `fk_user_unseen_posts_post_id` (`post_id`);

ALTER TABLE `amenities`
  MODIFY `amenity_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

ALTER TABLE `athletes`
  MODIFY `athlete_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `books`
  MODIFY `book_id` bigint(20) NOT NULL AUTO_INCREMENT;

ALTER TABLE `book_facilities`
  MODIFY `book_facility_id` bigint(20) NOT NULL AUTO_INCREMENT;

ALTER TABLE `certificates`
  MODIFY `certificate_id` bigint(20) NOT NULL AUTO_INCREMENT;

ALTER TABLE `chats`
  MODIFY `chat_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

ALTER TABLE `children`
  MODIFY `child_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

ALTER TABLE `comments`
  MODIFY `comment_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `educations`
  MODIFY `education_id` bigint(20) NOT NULL AUTO_INCREMENT;

ALTER TABLE `experiences`
  MODIFY `experience_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `facilitators`
  MODIFY `facilitator_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `facilitator_employees`
  MODIFY `facilitator_employee_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `facilities`
  MODIFY `facility_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `facility_availability_hours`
  MODIFY `facility_availability_hour_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

ALTER TABLE `facility_employees`
  MODIFY `facility_employe_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `facility_img`
  MODIFY `facility_img_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `facility_sessions`
  MODIFY `facility_sessions_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `favorite_facilitator`
  MODIFY `favorite_facilitator_id` bigint(20) NOT NULL AUTO_INCREMENT;

ALTER TABLE `favorite_trainer`
  MODIFY `favorite_trainer_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `follows`
  MODIFY `follow_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `forgot_password`
  MODIFY `forgot_password_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

ALTER TABLE `likes`
  MODIFY `like_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

ALTER TABLE `messages`
  MODIFY `message_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

ALTER TABLE `notifications`
  MODIFY `notification_id` bigint(20) NOT NULL AUTO_INCREMENT;

ALTER TABLE `not_notified_users`
  MODIFY `not_notified_id` bigint(20) NOT NULL AUTO_INCREMENT;

ALTER TABLE `parents`
  MODIFY `parent_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `payments_facility`
  MODIFY `payment_facility_id` bigint(20) NOT NULL AUTO_INCREMENT;

ALTER TABLE `posts`
  MODIFY `post_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

ALTER TABLE `post_img`
  MODIFY `post_img_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

ALTER TABLE `review_facilitators`
  MODIFY `review_facilitator_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `review_facility`
  MODIFY `review_facility_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

ALTER TABLE `review_trainer`
  MODIFY `review_trainer_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

ALTER TABLE `review_trainer_img`
  MODIFY `review_trainer_img_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `token_management`
  MODIFY `token_management` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

ALTER TABLE `trainers`
  MODIFY `trainer_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `trainer_availability_hours`
  MODIFY `trainer_availability_hours_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

ALTER TABLE `trainer_sessions`
  MODIFY `trainer_session_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

ALTER TABLE `unseen_messages`
  MODIFY `unseen_message_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `users`
  MODIFY `user_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

ALTER TABLE `user_unseen_posts`
  MODIFY `user_unseen_post_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

ALTER TABLE `amenities`
  ADD CONSTRAINT `fk_amenity_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `athletes`
  ADD CONSTRAINT `fk_athlete_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `books`
  ADD CONSTRAINT `fk_book_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_book_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_book_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `book_facilities`
  ADD CONSTRAINT `fk_book_facility_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_book_facility_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `certificates`
  ADD CONSTRAINT `fk_certificates_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `chats`
  ADD CONSTRAINT `fk_chat_friend_user_id` FOREIGN KEY (`friend_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_chat_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `children`
  ADD CONSTRAINT `fk_child_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `parents` (`parent_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `comments`
  ADD CONSTRAINT `fk_comment_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_comment_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `educations`
  ADD CONSTRAINT `fk_education_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `experiences`
  ADD CONSTRAINT `fk_experiece_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `facilitators`
  ADD CONSTRAINT `fk_facilitator_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `facilitator_employees`
  ADD CONSTRAINT `fk_facilitator_employees_facilitator_id` FOREIGN KEY (`facilitator_id`) REFERENCES `facilitators` (`facilitator_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_facilitator_employees_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `facilities`
  ADD CONSTRAINT `fk_facility_facilitator_id` FOREIGN KEY (`facilitator_id`) REFERENCES `facilitators` (`facilitator_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `facility_availability_hours`
  ADD CONSTRAINT `fk_facility_availability_hour_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `facility_employees`
  ADD CONSTRAINT `fk_facility_employees_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_facility_employees_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `facility_img`
  ADD CONSTRAINT `fk_facility_img_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `facility_sessions`
  ADD CONSTRAINT `fk_athletes_facilitators_sessions_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_athletes_facilitators_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `favorite_facilitator`
  ADD CONSTRAINT `fk_athlete_favorite_facilitator_facilitator_id` FOREIGN KEY (`facilitator_id`) REFERENCES `facilitators` (`facilitator_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_athlete_favorite_facilitator_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `favorite_trainer`
  ADD CONSTRAINT `fk_athlete_favorite_trainer_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_athlete_favorite_trainer_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `follows`
  ADD CONSTRAINT `fk_follow_followed_user_id` FOREIGN KEY (`followed_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_follow_follower_user_id` FOREIGN KEY (`follower_user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `likes`
  ADD CONSTRAINT `fk_like_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_likes_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `messages`
  ADD CONSTRAINT `fk_message_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notification_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `not_notified_users`
  ADD CONSTRAINT `fk_not_notified_user_notification_id` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`notification_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_not_notified_user_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `parents`
  ADD CONSTRAINT `fk_parent_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payments`
  ADD CONSTRAINT `fk_payment_athlete_id` FOREIGN KEY (`athlete_id`) REFERENCES `athletes` (`athlete_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE `payments_facility`
  ADD CONSTRAINT `fk_payment_facility_athlete_id` FOREIGN KEY (`athlete_id`) REFERENCES `athletes` (`athlete_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_payment_facility_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `posts`
  ADD CONSTRAINT `fk_post_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `review_facilitators`
  ADD CONSTRAINT `fk_review_facilitator_facilitator_id` FOREIGN KEY (`facilitator_id`) REFERENCES `facilitators` (`facilitator_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_review_facilitator_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `review_facility`
  ADD CONSTRAINT `fk_review_facilitaty_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_review_facility_facility_id` FOREIGN KEY (`facility_id`) REFERENCES `facilities` (`facility_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `review_trainer`
  ADD CONSTRAINT `fk_athletes_review_trainer_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_athletes_review_trainer_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `review_trainer_img`
  ADD CONSTRAINT `fk_review_trainer_img_review_trainer_id` FOREIGN KEY (`review_trainer_id`) REFERENCES `review_trainer` (`review_trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `token_management`
  ADD CONSTRAINT `fk_token_management_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `trainers`
  ADD CONSTRAINT `fk_trainer_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `trainer_availability_hours`
  ADD CONSTRAINT `fk_trainer_availability_hours_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `trainer_sessions`
  ADD CONSTRAINT `fk_athletes_trainer_session_facilitator_session_id` FOREIGN KEY (`facility_sessions_id`) REFERENCES `facility_sessions` (`facility_sessions_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_athletes_trainer_session_trainer_id` FOREIGN KEY (`trainer_id`) REFERENCES `trainers` (`trainer_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `unseen_messages`
  ADD CONSTRAINT `fk_unseen_message_message_id` FOREIGN KEY (`message_id`) REFERENCES `messages` (`message_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_unseen_message_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_unseen_posts`
  ADD CONSTRAINT `fk_user_unseen_posts_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`post_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_user_unseen_posts_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
