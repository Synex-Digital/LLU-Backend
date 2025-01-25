const validateTimeStamp = (time) => {
	if (time === null) return true;
	const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
	if (timeRegex.test(time)) return true;
	const isoString = time.replace(' ', 'T');
	const date = new Date(isoString);
	return date.toString() !== 'Invalid Date';
};

export { validateTimeStamp };
