const validateTimeStamp = (time) => {
	if (time === null) return true;
	const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
	if (timeRegex.test(time)) return true;
	const isoString = time.replace(' ', 'T');
	const date = new Date(isoString);
	return date.toString() !== 'Invalid Date';
};

const validateDate = (date) => {
	const regex = /^\d{4}-\d{2}-\d{2}$/;
	if (!regex.test(date)) return false;
	const parsedDate = new Date(date);
	if (isNaN(parsedDate.getTime())) return false;
	return true;
};

const getWeekDay = (dateString) => {
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
};

export { validateTimeStamp, validateDate, getWeekDay };
