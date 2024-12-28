const validateTimeStamp = (time) => {
	if (time === null) return true;
	const isoString = time.replace(' ', 'T');
	const date = new Date(isoString);
	if (date.toString() === 'Invalid Date') return false;
	return true;
};

export { validateTimeStamp };
