var idx = 0;

export const generateCapacity = (capPlan, entries, weeks, fromWeek) => {
  let getCurrentWeek = () => {
    let today = new Date();
    if (weeks[0] && weeks[0].firstDate instanceof Date) {
      return weeks.find(
        (week) => week.firstDate.toISOString() > today.toISOString()
      );
    } else {
      return weeks.find((week) => week.firstDate > today.toISOString());
    }
  };
  let thisWeek = getCurrentWeek();

  let channels = (capPlan.staffing && capPlan.staffing.channels) || [];

  // Initialize carry-forward FTE/HC values
  let current = {
    totalHC: parseFloat(capPlan.startingHC) || 0,
    actualFTE: parseFloat(capPlan.startingHC) || 0,
    totalFTE: parseFloat(capPlan.startingHC) || 0,
    expectedFTE: parseFloat(capPlan.startingHC) || 0,
    PlanProdFTE: parseFloat(capPlan.startingHC) || 0,
    ActProdFTE: parseFloat(capPlan.startingHC) || 0,
    grossRequirement: parseFloat(capPlan.grossRequirement) || 0,
    inCenterRequirement: parseFloat(capPlan.inCenterRequirement) || 0,
    productiveRequirement: parseFloat(capPlan.productiveRequirement) || 0,

    entry: entries.find((entry) => entry.week === capPlan.firstWeek),
    inTraining: [],
    isFuture: false,
    inLOA: 0,
  };

  let recent = [];

  if (!current.entry) {
    current.entry = {};
  }

  let channelFields = {};

  const volumesField = (channel, isActual) =>
    isActual ? `${channel.name}.actVolumes` : `${channel.name}.pVolumes`;
  const ahtField = (channel, isActual) =>
    isActual ? `${channel.name}.actAHT` : `${channel.name}.pAHT`;

  channels.forEach((channel) => {
    channelFields[volumesField(channel)] =
      (current.entry.planned && current.entry.planned.volumes) || null;
    channelFields[ahtField(channel)] =
      (current.entry.planned && current.entry.planned.aht) || null;
    channelFields[volumesField(channel, true)] =
      (current.entry.actual && current.entry.actual.volumes) || null;
    channelFields[ahtField(channel, true)] =
      (current.entry.actual && current.entry.actual.aht) || null;
  });

	current.trWeeks = parseInt(current.entry.trWeeks) || 0;
	current.ocpWeeks = parseInt(current.entry.ocpWeeks) || 0;
	current.productiveRequirement = parseFloat(current.entry.productiveRequirement) || 0;
	current.budgetFTE = parseFloat(current.entry.budget) || 0;
	current.fcTrAttrition = parseFloat(current.entry.fcTrAttrition) || 0;
	current.inCenterRequirement = parseFloat(current.entry.inCenterRequirement) || 0;
	current.grossRequirement = parseFloat(current.entry.grossRequirement) || 0;

  current.pShrinkage = current.entry.pShrinkage;
  current.planned = current.entry.planned;
  current.actual = current.entry.actual;

  current = { ...current, ...channelFields };

  let lastInCenterRequirement = parseFloat(capPlan.inCenterRequirement) || 0;
  let lastProductiveRequirement = parseFloat(capPlan.productiveRequirement) || 0;

  let newPlan = weeks.map((week) => {
    let entry = entries.find((entry) => entry.week === week.code);

    // --- 1. Carry-forward values (post-attrition, pre-shrinkage/OT) ---
    let baseTotalHC = current.totalHC;
    let baseActualFTE = current.actualFTE;
    let baseTotalFTE = current.totalFTE;
    let baseExpectedFTE = current.expectedFTE;
    let basePlanProdFTE = current.PlanProdFTE;
    let baseActProdFTE = current.ActProdFTE;
    let baseInLOA = current.inLOA;

    // --- 2. Apply permanent attrition (manual) ---
    let appliedActualAttrition = false;
    if (entry && entry.attrition !== undefined && entry.attrition !== null) {
      const attr = parseFloat(entry.attrition);
      if (!isNaN(attr)) {
      baseTotalHC -= attr;
      baseActualFTE -= attr;
      baseActProdFTE -= attr;
      baseTotalFTE -= attr;
      baseExpectedFTE -= attr;
      basePlanProdFTE -= attr;
      appliedActualAttrition = true; // <- mark that we used actual attrition
    }
  }

    // --- 3. Apply permanent forecast attrition (percentage, for future only) ---
    let fcAttritionVal = 0;
if (!appliedActualAttrition && current.isFuture && entry && entry.fcAttrition !== undefined && entry.fcAttrition !== null) {
  fcAttritionVal = parseFloat(entry.fcAttrition);
  //console.log('Applying fcAttrition:', fcAttritionVal, 'to', baseTotalHC);
  if (!isNaN(fcAttritionVal)) {
    baseTotalHC *= (1 - fcAttritionVal / 100);
    baseActualFTE *= (1 - fcAttritionVal / 100);
    baseActProdFTE *= (1 - fcAttritionVal / 100);
    baseTotalFTE *= (1 - fcAttritionVal / 100);
    baseExpectedFTE *= (1 - fcAttritionVal / 100);
    basePlanProdFTE *= (1 - fcAttritionVal / 100);
  }
}

    // --- 4. All carry-forward values, now post-attrition, are the base for next week ---
    // (these will be assigned to current at the END of this loop)

    // --- 5. Prepare newPlanWeek for this week, starting from base values ---
    let newPlanWeek = {
      firstDate: week.firstDate instanceof Date
        ? week.firstDate.toISOString().split('T')[0]
        : week.firstDate.split('T')[0],
      totalHC: baseTotalHC,
      actualFTE: baseActualFTE,
      ActProdFTE: baseActProdFTE,
      totalFTE: baseTotalFTE,
      expectedFTE: baseExpectedFTE,
      PlanProdFTE: basePlanProdFTE,
      budgetFTE: current.budgetFTE,
      inCenterRequirement: current.inCenterRequirement,
      grossRequirement: current.grossRequirement,
      productiveRequirement: current.productiveRequirement,
      trainees: 0,
      nesting: 0,
      inLOA: baseInLOA,
    };

    channels &&
      channels.forEach((channel) => {
        newPlanWeek[volumesField(channel)] =
          current[volumesField(channel)] || null;
        newPlanWeek[ahtField(channel)] = current[ahtField(channel)] || null;
        newPlanWeek[volumesField(channel, true)] =
          current[volumesField(channel, true)] || null;
        newPlanWeek[ahtField(channel, true)] =
          current[ahtField(channel, true)] || null;
      });

    newPlanWeek.hasShrinkage = false;
    newPlanWeek.hasPlanned = false;
    newPlanWeek.hasActual = false;

    // Set up additional fields if present
    if (entry && entry.attrition) {
      newPlanWeek.attrPercent = Math.round((entry.attrition / baseActualFTE) * 10000) / 100;
    }
    if (entry && entry.fcAttrition) {
      newPlanWeek.fcAttrition = Math.round(fcAttritionVal * 1000) / 10;
    }

    // --- 6. Apply one-off effects for this week only (do NOT update carry-forward variables) ---
    // Overtime
    if (entry?.overtimeFTE) {
      const ot = parseFloat(entry.overtimeFTE);
      newPlanWeek.totalHC += ot;
      newPlanWeek.actualFTE += ot;
      newPlanWeek.ActProdFTE += ot;
      newPlanWeek.totalFTE += ot;
      newPlanWeek.expectedFTE += ot;
      newPlanWeek.PlanProdFTE += ot;
    }

    // Shrinkage/absences/aux for reporting
    const applyShrinkage = (fte, percent) =>
      fte - (fte * (Number(percent) / 100));

    // Actuals (for actualFTE, ActProdFTE)
    if (entry && entry.actVac) {
      newPlanWeek.actualFTE = applyShrinkage(newPlanWeek.actualFTE, entry.actVac);
      newPlanWeek.ActProdFTE = applyShrinkage(newPlanWeek.ActProdFTE, entry.actVac);
    }
    if (entry && entry.actAbs) {
      newPlanWeek.actualFTE = applyShrinkage(newPlanWeek.actualFTE, entry.actAbs);
      newPlanWeek.ActProdFTE = applyShrinkage(newPlanWeek.ActProdFTE, entry.actAbs);
    }
    if (entry && entry.actAux) {
      newPlanWeek.ActProdFTE = applyShrinkage(newPlanWeek.ActProdFTE, entry.actAux);
    }

    // Planned (for expectedFTE, PlanProdFTE)
    if (entry && entry.plannedVac) {
      newPlanWeek.expectedFTE = applyShrinkage(newPlanWeek.expectedFTE, entry.plannedVac);
      newPlanWeek.PlanProdFTE = applyShrinkage(newPlanWeek.PlanProdFTE, entry.plannedVac);
    }
    if (entry && entry.plannedAbs) {
      newPlanWeek.expectedFTE = applyShrinkage(newPlanWeek.expectedFTE, entry.plannedAbs);
      newPlanWeek.PlanProdFTE = applyShrinkage(newPlanWeek.PlanProdFTE, entry.plannedAbs);
    }
    if (entry && entry.plannedAux) {
      newPlanWeek.PlanProdFTE = applyShrinkage(newPlanWeek.PlanProdFTE, entry.plannedAux);
    }

    // --- 7. Handle moveIN/moveOUT/LOA/rws (permanent changes, so update both newPlanWeek and carry-forward variables) ---
    const permanentFields = [
      { key: "moveOUT", op: -1 },
      { key: "moveIN", op: 1 },
      { key: "loaOUT", op: -1 },
      { key: "loaIN", op: 1 },
      { key: "rwsOUT", op: -1, onlyFTE: true },
      { key: "rwsIN", op: 1, onlyFTE: true },
    ];
    permanentFields.forEach(field => {
      if (entry && entry[field.key]) {
        const val = parseFloat(entry[field.key]) * field.op;
        // All except rws modify HC
        if (!field.onlyFTE) {
          newPlanWeek.totalHC += val;
          baseTotalHC += val;
        }
        newPlanWeek.actualFTE += val;
        newPlanWeek.ActProdFTE += val;
        newPlanWeek.totalFTE += val;
        newPlanWeek.expectedFTE += val;
        newPlanWeek.PlanProdFTE += val;
        baseActualFTE += val;
        baseActProdFTE += val;
        baseTotalFTE += val;
        baseExpectedFTE += val;
        basePlanProdFTE += val;

        // Special for LOA (inLOA sign handling)
        if (field.key === "loaOUT") {
          newPlanWeek.inLOA -= -val || 0;
          baseInLOA -= -val || 0;
        }
        if (field.key === "loaIN") {
          newPlanWeek.inLOA += -val;
          baseInLOA += -val;
        }
      }
    });
	
	// 8. Update requirements (gross/inCenter/productive) with carry-forward
    if (entry && entry.grossRequirement != null && !isNaN(entry.grossRequirement)) {
      newPlanWeek.grossRequirement = parseFloat(entry.grossRequirement);
      current.grossRequirement = newPlanWeek.grossRequirement;
    } else {
      newPlanWeek.grossRequirement = current.grossRequirement;
    }

    if (entry && entry.inCenterRequirement != null && !isNaN(entry.inCenterRequirement)) {
      newPlanWeek.inCenterRequirement = parseFloat(entry.inCenterRequirement);
      lastInCenterRequirement = newPlanWeek.inCenterRequirement;
      current.inCenterRequirement = newPlanWeek.inCenterRequirement;
    } else {
      newPlanWeek.inCenterRequirement = lastInCenterRequirement;
    }

    if (entry && entry.productiveRequirement != null && !isNaN(entry.productiveRequirement)) {
      newPlanWeek.productiveRequirement = parseFloat(entry.productiveRequirement);
      lastProductiveRequirement = newPlanWeek.productiveRequirement;
      current.productiveRequirement = newPlanWeek.productiveRequirement;
    } else {
      newPlanWeek.productiveRequirement = lastProductiveRequirement;
    }

    // 9. Planned/Actual Channel data
    if (entry && entry.planned) {
      entry.planned.forEach(channel => {
        if (channel.volumes) newPlanWeek[volumesField(channel)] = channel.volumes;
        if (channel.aht) newPlanWeek[ahtField(channel)] = channel.aht;
      });
      newPlanWeek.hasPlanned = true;
    }
    if (entry && entry.actual) {
      entry.actual.forEach(channel => {
        if (channel.volumes) newPlanWeek[volumesField(channel, true)] = channel.volumes;
        if (channel.aht) newPlanWeek[ahtField(channel, true)] = channel.aht;
      });
      newPlanWeek.hasActual = true;
    }

    // 10. Training pipeline (performs only for inTraining batches)
    if (entry && entry.trCommit) {
      current.inTraining.push({
        trCommit: parseFloat(entry.trCommit),
        trGap: entry.trGap ? parseFloat(entry.trGap) : 0,
        trAttrition: entry.trAttrition ? parseFloat(entry.trAttrition) : 0,
        ocpAttrition: entry.ocpAttrition ? parseFloat(entry.ocpAttrition) : 0,
        weeksToLive: Number.isFinite(current.trWeeks) ? current.trWeeks + 1 : 1,
		weeksToProd: Number.isFinite(current.ocpWeeks) ? current.ocpWeeks + 1 : 1,
      });
    }

    if (entry && entry.fcTrAttrition) {
      current.fcTrAttrition = parseFloat(entry.fcTrAttrition);
    }

    // Process inTraining pipeline (trainees and nesting)
    current.inTraining.forEach(batch => {
      // Base training count
      const baseTraining = batch.trCommit + batch.trGap;

      // Attrition for training
      const effectiveAttrition = batch.trAttrition
        ? batch.trAttrition
        : (current.fcTrAttrition && current.isFuture ? baseTraining * current.fcTrAttrition : 0);

      let trainingTotal = baseTraining - effectiveAttrition;

      if (batch.weeksToLive > 1) {
        newPlanWeek.trainees += trainingTotal;
        batch.weeksToLive--;
      } else if (batch.weeksToLive === 1) {
        // Last week of training: apply ocpAttrition as well
        const finalTotal = trainingTotal - batch.ocpAttrition;
        newPlanWeek.totalHC += finalTotal;
        newPlanWeek.actualFTE += finalTotal;
        newPlanWeek.ActProdFTE += finalTotal;
        newPlanWeek.totalFTE += finalTotal;
        newPlanWeek.expectedFTE += finalTotal;
        newPlanWeek.PlanProdFTE += finalTotal;

        baseTotalHC += finalTotal;
        baseActualFTE += finalTotal;
        baseActProdFTE += finalTotal;
        baseTotalFTE += finalTotal;
        baseExpectedFTE += finalTotal;
        basePlanProdFTE += finalTotal;

        batch.weeksToLive--;
      }
      // After live weeks, if batch still has weeksToProd (nesting)
      if (batch.weeksToLive < 1 && batch.weeksToProd > 1) {
        newPlanWeek.nesting += trainingTotal - batch.ocpAttrition;
        batch.weeksToProd--;
      }
    });

    // 11. Mark future weeks as 'isFuture'
    const today = new Date();
    const weekStart = week.firstDate instanceof Date
      ? week.firstDate
      : new Date(week.firstDate);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    current.isFuture = weekStart >= today;
    

    // 12. Composite FTE logic for reporting
    newPlanWeek.compositeInCenterFTE = current.isFuture
      ? newPlanWeek.expectedFTE
      : newPlanWeek.actualFTE ?? newPlanWeek.expectedFTE;

    newPlanWeek.compositeProductiveFTE = current.isFuture
      ? newPlanWeek.PlanProdFTE
      : newPlanWeek.ActProdFTE ?? newPlanWeek.PlanProdFTE;

    // --- For zeroing actuals in the future:
      if (current.isFuture) {
        newPlanWeek.actualFTE = 0;
        newPlanWeek.ActProdFTE = 0;
      }  

    // 13. Shrinkage reporting for current week only
    if (current.pShrinkage) {
      let shrink = { aux: 0, abs: 0, off: 0 };
      if (Array.isArray(current.pShrinkage)) {
			current.pShrinkage.forEach(s => {
			if (['aux', 'abs', 'off'].includes(s.mapping)) {
			shrink[s.mapping] += parseFloat(s.percentage) || 0;
		}
	});
	}
      newPlanWeek.pAbs = shrink.abs;
      newPlanWeek.pAux = shrink.aux;
      newPlanWeek.pOff = shrink.off;
    }

    // 14. Variance Calculations
    if (newPlanWeek.productiveRequirement != null) {
      newPlanWeek.billVar =
        (current.isFuture ? newPlanWeek.PlanProdFTE : newPlanWeek.ActProdFTE)
        - newPlanWeek.productiveRequirement;
    }
    if (newPlanWeek.inCenterRequirement != null) {
      newPlanWeek.reqVar =
        (current.isFuture ? newPlanWeek.expectedFTE : newPlanWeek.actualFTE)
        - newPlanWeek.inCenterRequirement;
    }
    if (newPlanWeek.budgetFTE != null) {
      newPlanWeek.fcVar = newPlanWeek.totalFTE - newPlanWeek.budgetFTE;
    }

    // 15. Comment and other custom entry fields
    if (entry && entry.comment) {
      newPlanWeek.comment = entry.comment;
    }
    if (entry && entry.forecasted) {
      newPlanWeek.fcFTE = parseFloat(entry.forecasted);
    }
    if (entry && entry.pShrinkage && entry.pShrinkage.length) {
      current.pShrinkage = entry.pShrinkage;
      newPlanWeek.hasShrinkage = true;
    }
    if (entry && entry.trWeeks) {
      current.trWeeks = parseInt(entry.trWeeks) || 0;
    }
    if (entry && entry.ocpWeeks) {
      current.ocpWeeks = parseInt(entry.ocpWeeks) || 0;
    }

    // 16. Carry-forward: update current (for next loop, pre-shrinkage/overtime)
    current = {
      ...current,
      totalHC: baseTotalHC,
      actualFTE: baseActualFTE,
      totalFTE: baseTotalFTE,
      expectedFTE: baseExpectedFTE,
      PlanProdFTE: basePlanProdFTE,
      ActProdFTE: baseActProdFTE,
      inLOA: baseInLOA,
    };

    // 17. Return week result
    return { ...newPlanWeek, ...entry,  week };
  });

  // 18. Filter fromWeek if provided
  if (fromWeek) {
    return newPlan.filter(weekly =>
	  new Date(weekly.week.firstDate) >= new Date(fromWeek.firstDate)
  );
  } else {
    return newPlan;
  }
};