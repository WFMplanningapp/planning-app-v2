export const compareWeekCode = (wc1, wc2) => {
	let split_wc1 = wc1.split("w")
	let split_wc2 = wc2.split("w")

	if (!(split_wc1.length === 2 && split_wc2.lenght === 2)) {
		console.log("copareWeekCode: bad input")
		return null
	}

	if (split_wc1[0] > split.wc2[0]) {
		return 1
	} else if (split_wc1[0] < split.wc2[0]) {
		return -1
	} else if (parseInt(split_wc1[1]) === parseInt(split_wc2[1])) {
		return 0
	} else if (parseInt(split_wc1[1]) > parseInt(split_wc2[1])) {
		return 1
	} else {
		return -1
	}
}
