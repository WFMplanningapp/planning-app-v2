import { act } from "react";

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
    inLOA: parseFloat(capPlan.inLOA) || 0,
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
  let lastTrWeeks = 0;
  let lastOcpWeeks = 0;
  let lastOcpProductivityPercent = 100; // default 100%

  let newPlan = weeks.map((week) => {

    // Place this here, before any batch/pipeline logic:
    const today = new Date();
    const weekStart = week.firstDate instanceof Date
    ? week.firstDate
    : new Date(week.firstDate);
    current.isFuture = weekStart >= today;

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

/*     channels &&
      channels.forEach((channel) => {
        newPlanWeek[volumesField(channel)] =
          current[volumesField(channel)] || null;
        newPlanWeek[ahtField(channel)] = current[ahtField(channel)] || null;
        newPlanWeek[volumesField(channel, true)] =
          current[volumesField(channel, true)] || null;
        newPlanWeek[ahtField(channel, true)] =
          current[ahtField(channel, true)] || null;
      }); */

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
    // Update last-used values if available in entry
if (entry && entry.trWeeks !== undefined && entry.trWeeks !== null && entry.trWeeks !== "") {
  lastTrWeeks = parseInt(entry.trWeeks) || 0;
}
if (entry && entry.ocpWeeks !== undefined && entry.ocpWeeks !== null && entry.ocpWeeks !== "") {
  lastOcpWeeks = parseInt(entry.ocpWeeks) || 0;
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

    // --- 7. Handle moveIN/moveOUT/LOA/rws (permanent changes, so update both newPlanWeek and carry-forward variables) ---
    const permanentFields = [
      { key: "moveOUT", op: -1 },
      { key: "moveIN", op: 1 },
      { key: "loaOUT", op: -1 },
      { key: "loaIN", op: 1 },
      { key: "rampDown", op: -1},
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
          newPlanWeek.inLOA -= +val || 0;
          baseInLOA -= +val || 0;
        }
        if (field.key === "loaIN") {
          newPlanWeek.inLOA -= val;
          baseInLOA -= val;
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

 /*    // 9. Planned/Actual Channel data
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
    } */

    // 10. Training pipeline (performs only for inTraining batches)
// Update inherited values if present
if (entry && entry.trWeeks !== undefined && entry.trWeeks !== null && entry.trWeeks !== "") {
  lastTrWeeks = parseInt(entry.trWeeks) || 0;
}
if (entry && entry.ocpWeeks !== undefined && entry.ocpWeeks !== null && entry.ocpWeeks !== "") {
  lastOcpWeeks = parseInt(entry.ocpWeeks) || 0;
}
if (entry && entry.ocpProductivityPercent !== undefined && entry.ocpProductivityPercent !== null && entry.ocpProductivityPercent !== "") {
  lastOcpProductivityPercent = parseFloat(entry.ocpProductivityPercent) || 100;
}

// Resolve values (inherit if missing)
const trWeeks = (entry && entry.trWeeks !== undefined && entry.trWeeks !== null && entry.trWeeks !== "")
  ? parseInt(entry.trWeeks)
  : lastTrWeeks;

let ocpWeeks;
if (entry && entry.ocpWeeks !== undefined && entry.ocpWeeks !== null && entry.ocpWeeks !== "") {
  ocpWeeks = parseInt(entry.ocpWeeks) || 0;
} else if (lastOcpWeeks > 0) {
  ocpWeeks = lastOcpWeeks;
} else {
  ocpWeeks = 0;
}

const ocpProductivityPercent = (entry && entry.ocpProductivityPercent !== undefined && entry.ocpProductivityPercent !== null && entry.ocpProductivityPercent !== "")
  ? parseFloat(entry.ocpProductivityPercent)
  : lastOcpProductivityPercent;

// --- Batch creation & update logic ---
if (entry && entry.trCommit) {
  const batchIdx = current.inTraining.findIndex(
    b => b.createdWeek === week.code
  );
  const newBatchParams = {
    trCommit: parseFloat(entry.trCommit),
    trGap: entry.trGap ? parseFloat(entry.trGap) : 0,
    trAttrition: entry.trAttrition ? parseFloat(entry.trAttrition) : 0,
    ocpAttrition: entry.ocpAttrition ? parseFloat(entry.ocpAttrition) : 0,
    weeksToLive: trWeeks,
    weeksToProd: ocpWeeks,
    createdWeek: week.code,
    ocpProductivityPercent: ocpProductivityPercent
  };
  let needsUpdate = false;
  if (batchIdx !== -1) {
    const existingBatch = current.inTraining[batchIdx];
    needsUpdate = (
      existingBatch.trCommit !== newBatchParams.trCommit ||
      existingBatch.trGap !== newBatchParams.trGap ||
      existingBatch.trAttrition !== newBatchParams.trAttrition ||
      existingBatch.ocpAttrition !== newBatchParams.ocpAttrition ||
      existingBatch.weeksToLive !== newBatchParams.weeksToLive ||
      existingBatch.weeksToProd !== newBatchParams.weeksToProd ||
      existingBatch.ocpProductivityPercent !== newBatchParams.ocpProductivityPercent
    );
  }
  if (batchIdx === -1 || needsUpdate) {
    if (batchIdx !== -1) {
      current.inTraining.splice(batchIdx, 1);
    }
    current.inTraining.push({ ...newBatchParams });
  }
} else {
  const batchIdx = current.inTraining.findIndex(b => b.createdWeek === week.code);
  if (batchIdx !== -1) {
    current.inTraining.splice(batchIdx, 1);
  }
}

    if (entry && entry.fcTrAttrition) {
      current.fcTrAttrition = parseFloat(entry.fcTrAttrition);
    }
////////////////////////////////////////////////////////////////
  // Process inTraining pipeline (trainees and nesting)
////////////////////////////////////////////////////////////////  
    
  current.inTraining.forEach(batch => {
  // Calculate batch total at first use
  if (batch._trainingTotal === undefined) {
    const baseTraining = batch.trCommit + batch.trGap;
    const effectiveAttrition = batch.trAttrition
      ? batch.trAttrition
      : (current.fcTrAttrition && current.isFuture ? baseTraining * current.fcTrAttrition : 0);
    batch._trainingTotal = baseTraining - effectiveAttrition;
  }

  // 1. Training phase
  if (batch.weeksToLive > 0) {
    newPlanWeek.trainees += batch._trainingTotal;
    batch.weeksToLive--;
    return;
  }

  // 2. Graduation: training just finished
  if (batch.weeksToLive === 0 && !batch.graduated && batch.createdWeek !== week.code) {
    let gradTotal = batch._trainingTotal;
    
    if (batch.weeksToProd > 0) {
        let ocpLoss = batch.ocpAttrition ? batch.ocpAttrition : 0;
        gradTotal = gradTotal - ocpLoss;
        batch._trainingTotal = gradTotal; // update batch so 'nesting' will use correct value
    }
    
    batch.graduated = true;
    
    // OCP phase
    if (batch.weeksToProd > 0) {
      // Only count a portion as productive during OCP
      
      const productiveFTE = gradTotal * (batch.ocpProductivityPercent ?? 100) / 100;
      
      newPlanWeek.nesting += gradTotal;
      newPlanWeek.totalHC += gradTotal;
      newPlanWeek.actualFTE += productiveFTE;
      newPlanWeek.ActProdFTE += productiveFTE;
      newPlanWeek.totalFTE += productiveFTE;
      newPlanWeek.expectedFTE += productiveFTE;
      newPlanWeek.PlanProdFTE += productiveFTE;

      baseTotalHC += gradTotal;
      baseActualFTE += productiveFTE;
      baseActProdFTE += productiveFTE;
      baseTotalFTE += productiveFTE;
      baseExpectedFTE += productiveFTE;
      basePlanProdFTE += productiveFTE;

      // Save pending FTE to be added after OCP
      batch._pendingProductiveFTE = gradTotal - productiveFTE;
      batch.weeksToProd--;
      return;
    } else {
      

      // No OCP phase—apply OCP attrition immediately (if any)

      let ocpLoss = batch.ocpAttrition ? batch.ocpAttrition : 0;
      gradTotal = ((gradTotal - ocpLoss)) * (batch.ocpProductivityPercent ?? 100) / 100;

      newPlanWeek.totalHC += gradTotal;
      newPlanWeek.actualFTE += gradTotal;
      newPlanWeek.ActProdFTE += gradTotal;
      newPlanWeek.totalFTE += gradTotal;
      newPlanWeek.expectedFTE += gradTotal;
      newPlanWeek.PlanProdFTE += gradTotal;

      baseTotalHC += gradTotal;
      baseActualFTE += gradTotal;
      baseActProdFTE += gradTotal;
      baseTotalFTE += gradTotal;
      baseExpectedFTE += gradTotal;
      basePlanProdFTE += gradTotal;

      batch.ocpDone = true;
      batch.remove = true;
      return;
    }
  }

  // 3. OCP/Nesting phase
  if (batch.graduated && batch.weeksToProd > 0) {
    newPlanWeek.nesting += batch._trainingTotal;
    batch.weeksToProd--;
    return;
  }

  // 4. OCP just finished, apply OCP attrition and add the rest of FTE, then remove batch
  if (batch.graduated && batch.weeksToProd === 0 && !batch.ocpDone) {
    const ocpLoss = batch.ocpAttrition ? batch.ocpAttrition : 0;
    let addFinalFTE = batch._pendingProductiveFTE || 0;
    // Apply attrition first
    if (ocpLoss) {
      newPlanWeek.totalHC -= ocpLoss;
      newPlanWeek.actualFTE -= ocpLoss;
      newPlanWeek.ActProdFTE -= ocpLoss;
      newPlanWeek.totalFTE -= ocpLoss;
      newPlanWeek.expectedFTE -= ocpLoss;
      newPlanWeek.PlanProdFTE -= ocpLoss;

      baseTotalHC -= ocpLoss;
      baseActualFTE -= ocpLoss;
      baseActProdFTE -= ocpLoss;
      baseTotalFTE -= ocpLoss;
      baseExpectedFTE -= ocpLoss;
      basePlanProdFTE -= ocpLoss;
    }
    // Now add the remaining FTE (rest of the productivity)
    if (addFinalFTE) {
      newPlanWeek.actualFTE += addFinalFTE;
      newPlanWeek.ActProdFTE += addFinalFTE;
      newPlanWeek.totalFTE += addFinalFTE;
      newPlanWeek.expectedFTE += addFinalFTE;
      newPlanWeek.PlanProdFTE += addFinalFTE;

      baseActualFTE += addFinalFTE;
      baseActProdFTE += addFinalFTE;
      baseTotalFTE += addFinalFTE;
      baseExpectedFTE += addFinalFTE;
      basePlanProdFTE += addFinalFTE;
      batch._pendingProductiveFTE = 0;
    }
    batch.ocpDone = true;
    batch.remove = true;
    return;
  }
});
current.inTraining = current.inTraining.filter(batch => !batch.remove);

    // 11. Mark future weeks as 'isFuture'
    //const today = new Date();
    //const weekStart = week.firstDate instanceof Date
      //? week.firstDate
      //: new Date(week.firstDate);
    //const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    //current.isFuture = weekStart >= today;
    

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

        // Shrinkage/absences/aux for reporting
    const applyShrinkage = (fte, percent) =>
      fte - (fte * (Number(percent) / 100));

    
    // Actuals (for actualFTE, ActProdFTE)
    if (entry && (entry.actVac || entry.actAbs)) {

      //calculate Actual Total External Shrinkage
      const actTotalShrinkage = Number(entry.actVac || 0) + Number(entry.actAbs || 0);

      newPlanWeek.actualFTE = applyShrinkage(newPlanWeek.actualFTE, actTotalShrinkage);
      newPlanWeek.ActProdFTE = applyShrinkage(newPlanWeek.ActProdFTE, actTotalShrinkage);
    }

    if (entry && entry.actAux) {
      newPlanWeek.ActProdFTE = applyShrinkage(newPlanWeek.ActProdFTE, entry.actAux);
    }

    // Planned (for expectedFTE, PlanProdFTE)
    if (entry && (entry.plannedVac || entry.plannedAbs)) {
      // Calculate total external shrinkage 
          
      const externalshrinkage = Number(entry.plannedVac || 0) + Number(entry.plannedAbs || 0);
    
      newPlanWeek.expectedFTE = applyShrinkage(newPlanWeek.expectedFTE, externalshrinkage);
      newPlanWeek.PlanProdFTE = applyShrinkage(newPlanWeek.PlanProdFTE, externalshrinkage);
    }
    
    if (entry && entry.plannedAux) {
      newPlanWeek.PlanProdFTE = applyShrinkage(newPlanWeek.PlanProdFTE, entry.plannedAux);
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