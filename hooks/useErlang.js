import { useState } from "react"

const useErlang = () => {
	const [interval, setInterval] = useState(900)

	const updateInterval = (newInterval) => {
		setInterval(newInterval)
	}
	/**
   *
   * @param {Float} vol (Number of received contacts in inteval)
   * @param {Integer} n (Number of agents/lines)
   * @param {Integer} aht (Average Handling Time in seconds)
   * @param {Object} targets ({sl, tt, occ, asa}) (optional)
   * @returns {Object} {
      volumes: vol,
      agents: n,
      aht: aht,
      sl: sl,
      asa: asa,
      occupancy: occ,
      acceptable,
      message,
    }
   */
	const calculateErlang = (vol, n, aht, targets, shrink) => {
		const powOverFact = (pow, exp, fact) => {
			if (fact === 1) {
				console.log("RETURNED A", vol, n, aht)
				return a
			}
			let prod = 1
			let nExp = exp
			let nFact = fact
			while (nExp > 0 || nFact > 1) {
				//Calc Stage Prod
				if (nExp === 0) {
					prod *= 1 / nFact
				} else if (nExp >= 1) {
					prod *= pow / nFact
				}

				//Decrement NFACT & NEXP
				nExp--
				nFact--

				//Adjust NFACT & NEXP
				if (nExp < 0) {
					nExp = 0
				}
				if (nFact < 1) {
					nFact = 1
				}
			}

			return prod
		}

		if (vol === 0) {
			return {
				volumes: vol,
				agents: n,
				surplus: n,
				aht: aht,
				sl: 1,
				asa: 0,
				occupancy: 0,
				acceptable: true,
				message: "No Volumes",
			}
		}

		let a = (vol * aht) / interval

		console.log("A", a)

		let x = powOverFact(a, n, n) * (n / (n - a))

		//console.log("X", x)

		let y = 0

		for (let i = 0; i < n; i++) {
			y += powOverFact(a, i, i)
		}

		//console.log("Y", y)

		let pw = x / (y + x)

		//console.log("PW", pw)

		let sl = 1 - pw * Math.exp((-(n - a) * targets.tt) / aht)

		if (sl < 0) {
			sl = 0
		}

		console.log("SL", sl)

		let occ = (a / n) * (targets.conc || 1)

		//console.log("Occ", occ)

		let asa = (pw * aht) / (n - a)

		if (asa < 0) {
			asa = null
		}

		//console.log("ASA", asa)

		let acceptable = true
		let message = "Acceptable"

		if (targets.sl && sl < targets.sl) {
			acceptable = false
			message = "SL Target not Met"
		} else if (targets.occ && occ > targets.occ) {
			acceptable = false
			message = "Occupancy Target not Met"
		} else if (targets.asa && asa > targets.asa) {
			acceptable = false
			message = "ASA Target not Met"
		}

		console.log(message)

		console.log(
			"VOL",
			vol,
			"AHT",
			aht,
			"N",
			n,
			"SHRINK",
			shrink,
			"TARGETS",
			targets
		)

		let agents = shrink ? n / (1 - shrink) : n

		agents = agents / (targets.conc || 1)

		return {
			volumes: vol,
			agents: agents,
			surplus: agents * (occ < 1 ? 1 - occ : 0),
			aht: aht,
			sl: sl,
			asa: asa,
			occupancy: occ,
			acceptable,
			message,
		}
	}
	/**
   *
   * @param {Float} vol (Number of received contacts in inteval)
   * @param {Integer} aht (Average Handling Time in seconds)
   * @param {Float} shrink (0 >= shrink > 1 , Shrinkage applied to requirement)
   * @param {Object} targets ({sl, tt, occ, asa})
   * @returns {Object} {
      volumes: vol,
      agents: n,
      aht: aht,
      sl: sl,
      asa: asa,
      occupancy: occ,
      acceptable,
      message,
    }
   */
	const getLiveRequired = (vol, aht, shrink, targets, min) => {
		let firstEstimate = Math.max(
			Math.round((vol * aht) / interval) + 1,
			min || 0
		)

		let required = {}

		if (vol || min) {
			for (let n = firstEstimate; n < 500; n++) {
				required = calculateErlang(vol, n, aht, targets, shrink, min) || {}

				if (required.acceptable) {
					break
				} else {
					console.log("For ", n, " -> ", required.message)
				}
			}
		}

		return required
	}

	const getBORequired = (vol, aht, shrink, occ) => {
		if (vol) {
			let hours = (vol * aht) / 3600

			if (occ) {
				hours /= occ
			}

			if (shrink) {
				hours /= 1 - shrink
			}

			return { hours: hours, volumes: vol, aht: aht, occ: occ }
		} else {
			console.log("No Volumes")
			return {}
		}
	}

	const generateResults = ({
		distros,
		staffing,
		vol,
		aht,
		targets,
		abs,
		off,
		aux,
		absFromTotal,
	}) => {}

	const generateLiveRequirements = ({
		distros,
		vol,
		aht,
		targets,
		abs,
		off,
		aux,
		absFromTotal,
	}) => {
		let output = distros.map((entry) => {
			let usedAux = entry.auxDist ? entry.auxDist : aux
			let usedAbs = absFromTotal ? abs : 1 - abs * (1 - off)

			let scheduledShrink =
				1 - ((1 - usedAux) * (1 - usedAbs - off)) / (1 - off)

			let totalShrink = 1 - (1 - usedAux) * (1 - usedAbs - off)

			return {
				...entry,
				scheduled: getLiveRequired(
					entry.vDist * vol,
					entry.ahtDist * aht,
					scheduledShrink,
					targets,
					entry.minAgents
				),
				total: getLiveRequired(
					entry.vDist * vol,
					entry.ahtDist * aht,
					totalShrink,
					targets,
					entry.minAgents
				),

				net: getLiveRequired(
					entry.vDist * vol,
					entry.ahtDist * aht,
					0,
					targets,
					entry.minAgents
				),
			}
		})

		return output
	}

	const generateBORequirements = ({
		vol,
		aht,
		abs,
		off,
		aux,
		absFromTotal,
	}) => {
		let usedAux = aux
		let usedAbs = absFromTotal ? abs : 1 - abs * (1 - off)

		let scheduledShrink = 1 - ((1 - usedAux) * (1 - usedAbs - off)) / (1 - off)

		let totalShrink = 1 - (1 - usedAux) * (1 - usedAbs - off)

		return {
			scheduled: getBORequired(vol, aht, scheduledShrink),
			total: getBORequired(vol, aht, totalShrink),
			net: getBORequired(vol, aht, 0),
		}
	}

	const boltOnRequirements = (requirementsArr) => {
		if (requirementsArr[0] && requirementsArr[0].length) {
			let boltOn = requirementsArr[0].map((item) => {
				return {
					interval: item.interval,
					weekday: item.weekday,
					net: {
						volumes: item.net.volumes || 0,
						ht: item.net.volumes * item.net.aht || 0,
						aht: item.net.aht || 0,
						agents: item.net.agents || 0,
						surplus: item.net.surplus || 0,
					},
					scheduled: {
						agents: item.scheduled.agents || 0,
						surplus: item.scheduled.surplus,
					},
					total: {
						agents: item.total.agents || 0,
						surplus: item.total.surplus,
					},
				}
			})

			if (requirementsArr.length > 1) {
				for (let i = 1; i < requirementsArr.length; i++) {
					requirementsArr[i].forEach((item, index) => {
						boltOn[index].scheduled.agents += item.scheduled.agents || 0
						boltOn[index].scheduled.surplus += item.scheduled.surplus || 0
						boltOn[index].total.agents += item.total.agents || 0
						boltOn[index].total.surplus += item.total.surplus || 0
						boltOn[index].net.agents += item.net.agents || 0
						boltOn[index].net.surplus += item.net.surplus || 0
						boltOn[index].net.volumes += item.net.volumes || 0
						boltOn[index].net.ht += item.net.volumes * item.net.aht || 0
						boltOn[index].net.aht =
							boltOn[index].net.ht / boltOn[index].net.volumes
					})
				}
			}
			return boltOn
		} else {
			console.log("Invalid Requirements Array")
			return -1
		}
	}

	const getWeeklyValues = (requirements, fteHours, blendOcc) => {
		if (
			requirements.length &&
			requirements.length === (3600 / interval) * 7 * 24
		) {
			let totalAccumulator = 0
			let peak = null
			let surplusAccumulator = 0
			let realSurplusAccumulator = 0
			requirements.forEach((slot) => {
				if (slot.total && slot.total.agents) {
					totalAccumulator += slot.total.agents || 0
					surplusAccumulator += slot.total.surplus || 0

					if (blendOcc > slot.net.occupancy) {
						realSurplusAccumulator +=
							slot.total.agents * (blendOcc - slot.total.occupancy)
					}

					if (peak === null && slot.total.agents) {
						peak = slot
					} else if (peak.total && peak.total.agents < slot.total.agents) {
						peak = slot
					}
				}
			})

			return {
				totalReq: (totalAccumulator / fteHours) * (interval / 3600),
				totalSurplus: (surplusAccumulator / fteHours) * (interval / 3600),
				totalRealSurplus:
					(realSurplusAccumulator / fteHours) * (interval / 3600),
				peakReq: peak,
			}
		} else if (requirements.total) {
			console.log(requirements.total)

			return {
				totalReq: requirements.total.hours / fteHours,
				totalHours: requirements.total.hours,
				netHours: requirements.net.hours,
			}
		} else {
			console.log("Invalid Requirements", requirements)
			return null
		}
	}

	return {
		updateInterval,
		generateLiveRequirements,
		generateBORequirements,
		boltOnRequirements,
		getWeeklyValues,
	}
}

export default useErlang
