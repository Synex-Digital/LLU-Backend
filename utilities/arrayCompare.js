const arrayCompare = (arr1, arr2) => {
	const set2 = new Set(arr2);
	return arr1.every((value) => set2.has(value));
};

export { arrayCompare };
