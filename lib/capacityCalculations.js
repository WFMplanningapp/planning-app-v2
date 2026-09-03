// ============================================
// CAPACITY CALCULATIONS — Updated with Engine Integration
// Changes marked with: // ── ENGINE INTEGRATION ──
// ============================================

import {
  classifyCapacityWeek,
} from "./capacity/weekClassification"

export const generateCapacity = (capPlan, entries, weeks, fromWeek) => {

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
  let lastOcpProductivityPercent = 100;

  // ── ENGINE INTEGRATION ──
  // Track last known engine values for carry-forward
  let lastEngineGrossReq = null;
  let lastEngineInCenterReq = null;
  let lastEngineProductiveReq = null;
  // ── END ENGINE INTEGRATION ──

  let newPlan = weeks.map((week) => {

    const weekClassification =
      classifyCapacityWeek(
        week,
        new Date()
      )

    current.isFuture =
      weekClassification
        .usesPlannedAvailability

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
        appliedActualAttrition = true;
      }
    }

    // --- 3. Apply permanent forecast attrition (percentage, for future only) ---
    let fcAttritionVal = 0;
    if (!appliedActualAttrition && current.isFuture && entry && entry.fcAttrition !== undefined && entry.fcAttrition !== null) {
      fcAttritionVal = parseFloat(entry.fcAttrition);
      if (!isNaN(fcAttritionVal)) {
        baseTotalHC *= (1 - fcAttritionVal / 100);
        baseActualFTE *= (1 - fcAttritionVal / 100);
        baseActProdFTE *= (1 - fcAttritionVal / 100);
        baseTotalFTE *= (1 - fcAttritionVal / 100);
        baseExpectedFTE *= (1 - fcAttritionVal / 100);
        basePlanProdFTE *= (1 - fcAttritionVal / 100);
      }
    }

    // --- 5. Prepare newPlanWeek for this week ---
    let newPlanWeek = {
      periodType:
        weekClassification.periodType,

      availabilitySource:
        weekClassification
          .availabilitySource,

      isFuture:
        weekClassification
          .usesPlannedAvailability,

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

    if (entry && entry.trWeeks !== undefined && entry.trWeeks !== null && entry.trWeeks !== "") {
      lastTrWeeks = parseInt(entry.trWeeks) || 0;
    }
    if (entry && entry.ocpWeeks !== undefined && entry.ocpWeeks !== null && entry.ocpWeeks !== "") {
      lastOcpWeeks = parseInt(entry.ocpWeeks) || 0;
    }

    // --- 6. Apply one-off effects for this week only ---
    if (entry?.overtimeFTE) {
      const ot = parseFloat(entry.overtimeFTE);
      newPlanWeek.totalHC += ot;
      newPlanWeek.actualFTE += ot;
      newPlanWeek.ActProdFTE += ot;
      newPlanWeek.totalFTE += ot;
      newPlanWeek.expectedFTE += ot;
      newPlanWeek.PlanProdFTE += ot;
    }

    // --- 7. Handle moveIN/moveOUT/LOA/rws ---
    const permanentFields = [
      { key: "moveOUT", op: -1 },
      { key: "moveIN", op: 1 },
      { key: "loaOUT", op: -1 },
      { key: "loaIN", op: 1 },
      { key: "rampDown", op: -1 },
      { key: "rwsOUT", op: -1, onlyFTE: true },
      { key: "rwsIN", op: 1, onlyFTE: true },
    ];
    permanentFields.forEach(field => {
      if (entry && entry[field.key]) {
        const val = parseFloat(entry[field.key]) * field.op;
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

    // ============================================
    // 8. REQUIREMENTS — ENGINE INTEGRATION
    // Priority: Manual override > Engine value > Carry-forward
    // ============================================

    const requirementSources = {
      gross: null,
      inCenter: null,
      productive: null,
    };

    // ── ENGINE INTEGRATION: Resolve Gross Requirement ──
    const hasManualGross = entry && entry.grossRequirement != null && !isNaN(entry.grossRequirement);
    const hasEngineGross = entry && entry.engineGrossReq != null && !isNaN(entry.engineGrossReq);
    const isOverridden = entry && entry.engineOverride === true;

    if (isOverridden && hasManualGross) {
      // Manual override takes precedence.
      newPlanWeek.grossRequirement =
        parseFloat(
          entry.grossRequirement
        );

      newPlanWeek.reqSource =
        "manual";

      requirementSources.gross =
        "manual-override";
    } else if (hasEngineGross) {
      // Engine value available.
      newPlanWeek.grossRequirement =
        parseFloat(
          entry.engineGrossReq
        );

      lastEngineGrossReq =
        newPlanWeek.grossRequirement;

      newPlanWeek.reqSource =
        "engine";

      requirementSources.gross =
        "engine";
    } else if (hasManualGross) {
      // No Engine value; use the legacy manual value.
      newPlanWeek.grossRequirement =
        parseFloat(
          entry.grossRequirement
        );

      newPlanWeek.reqSource =
        "manual";

      requirementSources.gross =
        "manual";
    } else if (
      lastEngineGrossReq !== null
    ) {
      newPlanWeek.grossRequirement =
        lastEngineGrossReq;

      newPlanWeek.reqSource =
        "engine-carried";

      requirementSources.gross =
        "engine-carried";
    } else {
      newPlanWeek.grossRequirement =
        current.grossRequirement;

      newPlanWeek.reqSource =
        "carried";

      requirementSources.gross =
        "manual-carried";
    }

    current.grossRequirement =
      newPlanWeek.grossRequirement;

    // ── ENGINE INTEGRATION: Resolve InCenter Requirement ──
    const hasManualInCenter = entry && entry.inCenterRequirement != null && !isNaN(entry.inCenterRequirement);
    const hasEngineInCenter = entry && entry.engineInCenterReq != null && !isNaN(entry.engineInCenterReq);

    if (
      isOverridden &&
      hasManualInCenter
    ) {
      newPlanWeek.inCenterRequirement =
        parseFloat(
          entry.inCenterRequirement
        );

      requirementSources.inCenter =
        "manual-override";
    } else if (hasEngineInCenter) {
      newPlanWeek.inCenterRequirement =
        parseFloat(
          entry.engineInCenterReq
        );

      lastEngineInCenterReq =
        newPlanWeek.inCenterRequirement;

      lastInCenterRequirement =
        newPlanWeek.inCenterRequirement;

      requirementSources.inCenter =
        "engine";
    } else if (hasManualInCenter) {
      newPlanWeek.inCenterRequirement =
        parseFloat(
          entry.inCenterRequirement
        );

      lastInCenterRequirement =
        newPlanWeek.inCenterRequirement;

      requirementSources.inCenter =
        "manual";
    } else if (
      lastEngineInCenterReq !== null
    ) {
      newPlanWeek.inCenterRequirement =
        lastEngineInCenterReq;

      requirementSources.inCenter =
        "engine-carried";
    } else {
      newPlanWeek.inCenterRequirement =
        lastInCenterRequirement;

      requirementSources.inCenter =
        "manual-carried";
    }

    current.inCenterRequirement =
      newPlanWeek.inCenterRequirement;

    // ── ENGINE INTEGRATION: Resolve Productive Requirement ──
    const hasManualProductive = entry && entry.productiveRequirement != null && !isNaN(entry.productiveRequirement);
    const hasEngineProductive = entry && entry.engineProductiveReq != null && !isNaN(entry.engineProductiveReq);

    if (
      isOverridden &&
      hasManualProductive
    ) {
      newPlanWeek.productiveRequirement =
        parseFloat(
          entry.productiveRequirement
        );

      requirementSources.productive =
        "manual-override";
    } else if (hasEngineProductive) {
      newPlanWeek.productiveRequirement =
        parseFloat(
          entry.engineProductiveReq
        );

      lastEngineProductiveReq =
        newPlanWeek.productiveRequirement;

      lastProductiveRequirement =
        newPlanWeek.productiveRequirement;

      requirementSources.productive =
        "engine";
    } else if (hasManualProductive) {
      newPlanWeek.productiveRequirement =
        parseFloat(
          entry.productiveRequirement
        );

      lastProductiveRequirement =
        newPlanWeek.productiveRequirement;

      requirementSources.productive =
        "manual";
    } else if (
      lastEngineProductiveReq !== null
    ) {
      newPlanWeek.productiveRequirement =
        lastEngineProductiveReq;

      requirementSources.productive =
        "engine-carried";
    } else {
      newPlanWeek.productiveRequirement =
        lastProductiveRequirement;

      requirementSources.productive =
        "manual-carried";
    }

    current.productiveRequirement =
      newPlanWeek.productiveRequirement;

    newPlanWeek.requirementSources =
      requirementSources;

    // ── ENGINE INTEGRATION: Store engine hours for reporting ──
    if (entry && entry.engineHoursGross != null) {
      newPlanWeek.engineHoursGross = parseFloat(entry.engineHoursGross);
      newPlanWeek.engineHoursInCenter = parseFloat(entry.engineHoursInCenter) || 0;
      newPlanWeek.engineHoursProductive = parseFloat(entry.engineHoursProductive) || 0;
    }

    // ── ENGINE INTEGRATION: Store engine metadata ──
    if (entry && entry.engineSource) {
      newPlanWeek.engineSource = entry.engineSource;
      newPlanWeek.engineCalculatedAt = entry.engineCalculatedAt;
    }

    // ── ENGINE INTEGRATION: Override flag for UI ──
    newPlanWeek.engineOverride = isOverridden || false;

    // ── ENGINE INTEGRATION: Store both values for comparison in viewer ──
    if (hasEngineGross) {
      newPlanWeek.engineGrossReq = parseFloat(entry.engineGrossReq);
    }
    if (hasEngineInCenter) {
      newPlanWeek.engineInCenterReq = parseFloat(entry.engineInCenterReq);
    }
    if (hasEngineProductive) {
      newPlanWeek.engineProductiveReq = parseFloat(entry.engineProductiveReq);
    }
    if (hasManualGross) {
      newPlanWeek.manualGrossReq = parseFloat(entry.grossRequirement);
    }
    if (hasManualInCenter) {
      newPlanWeek.manualInCenterReq = parseFloat(entry.inCenterRequirement);
    }
    if (hasManualProductive) {
      newPlanWeek.manualProductiveReq = parseFloat(entry.productiveRequirement);
    }
    // ── END ENGINE INTEGRATION ──

    // 10. Training pipeline
    if (entry && entry.trWeeks !== undefined && entry.trWeeks !== null && entry.trWeeks !== "") {
      lastTrWeeks = parseInt(entry.trWeeks) || 0;
    }
    if (entry && entry.ocpWeeks !== undefined && entry.ocpWeeks !== null && entry.ocpWeeks !== "") {
      lastOcpWeeks = parseInt(entry.ocpWeeks) || 0;
    }
    if (entry && entry.ocpProductivityPercent !== undefined && entry.ocpProductivityPercent !== null && entry.ocpProductivityPercent !== "") {
      lastOcpProductivityPercent = parseFloat(entry.ocpProductivityPercent) || 100;
    }

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

    // Process inTraining pipeline
    current.inTraining.forEach(batch => {
      if (batch._trainingTotal === undefined) {
        const baseTraining = batch.trCommit + batch.trGap;
        const effectiveAttrition = batch.trAttrition
          ? batch.trAttrition
          : (current.fcTrAttrition && current.isFuture ? baseTraining * current.fcTrAttrition : 0);
        batch._trainingTotal = baseTraining - effectiveAttrition;
      }

      if (batch.weeksToLive > 0) {
        newPlanWeek.trainees += batch._trainingTotal;
        batch.weeksToLive--;
        return;
      }

      if (batch.weeksToLive === 0 && !batch.graduated && batch.createdWeek !== week.code) {
        let gradTotal = batch._trainingTotal;

        if (batch.weeksToProd > 0) {
          let ocpLoss = batch.ocpAttrition ? batch.ocpAttrition : 0;
          gradTotal = gradTotal - ocpLoss;
          batch._trainingTotal = gradTotal;
        }

        batch.graduated = true;

        if (batch.weeksToProd > 0) {
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

          batch._pendingProductiveFTE = gradTotal - productiveFTE;
          batch.weeksToProd--;
          return;
        } else {
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

      if (batch.graduated && batch.weeksToProd > 0) {
        newPlanWeek.nesting += batch._trainingTotal;
        batch.weeksToProd--;
        return;
      }

      if (batch.graduated && batch.weeksToProd === 0 && !batch.ocpDone) {
        const ocpLoss = batch.ocpAttrition ? batch.ocpAttrition : 0;
        let addFinalFTE = batch._pendingProductiveFTE || 0;
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

    // Future actual values are not applicable.
    // Keep the legacy zero values for compatibility.
    if (current.isFuture) {
      newPlanWeek.actualFTE = 0;
      newPlanWeek.ActProdFTE = 0;
    }

    // 13. Shrinkage reporting
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

    const applyShrinkage = (fte, percent) =>
      fte - (fte * (Number(percent) / 100));

    if (entry && (entry.actVac || entry.actAbs)) {
      const actTotalShrinkage = Number(entry.actVac || 0) + Number(entry.actAbs || 0);
      newPlanWeek.actualFTE = applyShrinkage(newPlanWeek.actualFTE, actTotalShrinkage);
      newPlanWeek.ActProdFTE = applyShrinkage(newPlanWeek.ActProdFTE, actTotalShrinkage);
    }

    if (entry && entry.actAux) {
      newPlanWeek.ActProdFTE = applyShrinkage(newPlanWeek.ActProdFTE, entry.actAux);
    }

    if (entry && (entry.plannedVac || entry.plannedAbs)) {
      const externalshrinkage = Number(entry.plannedVac || 0) + Number(entry.plannedAbs || 0);
      newPlanWeek.expectedFTE = applyShrinkage(newPlanWeek.expectedFTE, externalshrinkage);
      newPlanWeek.PlanProdFTE = applyShrinkage(newPlanWeek.PlanProdFTE, externalshrinkage);
    }

    if (entry && entry.plannedAux) {
      newPlanWeek.PlanProdFTE = applyShrinkage(newPlanWeek.PlanProdFTE, entry.plannedAux);
    }

    // Composite availability must be calculated
    // after actual and planned shrinkage is applied.
    newPlanWeek.compositeGrossFTE =
      newPlanWeek.totalFTE;

    newPlanWeek.compositeInCenterFTE =
      current.isFuture
        ? newPlanWeek.expectedFTE
        : newPlanWeek.actualFTE;

    newPlanWeek.compositeProductiveFTE =
      current.isFuture
        ? newPlanWeek.PlanProdFTE
        : newPlanWeek.ActProdFTE;

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

    // ── ENGINE INTEGRATION: Additional variance against engine values ──
    if (newPlanWeek.engineProductiveReq != null) {
      newPlanWeek.engineBillVar =
        (current.isFuture ? newPlanWeek.PlanProdFTE : newPlanWeek.ActProdFTE)
        - newPlanWeek.engineProductiveReq;
    }
    if (newPlanWeek.engineInCenterReq != null) {
      newPlanWeek.engineReqVar =
        (current.isFuture ? newPlanWeek.expectedFTE : newPlanWeek.actualFTE)
        - newPlanWeek.engineInCenterReq;
    }
    // ── END ENGINE INTEGRATION ──

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

    // 16. Carry-forward
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
        // Preserve legacy entry fields, but calculated
        // outputs remain authoritative when names overlap.
        return {
          ...(entry || {}),
          ...newPlanWeek,
          week,
        };
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