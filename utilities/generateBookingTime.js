const generateBookingTime = (commonTime, offset) => {
	const { week_day, common_start_time, common_end_time } = commonTime;
	const startTime = new Date(`1970-01-01T${common_start_time}`);
	const endTime = new Date(`1970-01-01T${common_end_time}`);
	startTime.setHours(startTime.getHours() + offset);
	endTime.setHours(startTime.getHours() + 1);
	console.log(startTime, endTime);
	return {
		week_day,
		start_time: startTime.toTimeString().slice(0, 8),
		end_time: endTime.toTimeString().slice(0, 8),
	};
};

export default generateBookingTime;
