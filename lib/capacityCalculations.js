var idx = 0;
export const generateCapacity = (capPlan, entries, weeks, fromWeek) => {
  let getCurrentWeek = () => {
    let today = new Date();

    //console.log(weeks)
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

  let current = {
    totalHC: parseFloat(capPlan.startingHC),
    actualFTE: parseFloat(capPlan.startingHC),
    totalFTE: parseFloat(capPlan.startingHC),
    expectedFTE: parseFloat(capPlan.startingHC),
    PlanProdFTE: parseFloat(capPlan.startingHC),
    ActProdFTE: parseFloat(capPlan.startingHC),
	  grossRequirement: parseFloat(capPlan.grossRequirement),
	  inCenterRequirement: parseFloat(capPlan.inCenterRequirement),
	  productiveRequirement: parseFloat(capPlan.productiveRequirement),

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

  //FIRST CURRENT

  current.trWeeks = parseInt(current.entry.trWeeks);
  current.ocpWeeks = parseInt(current.entry.ocpWeeks);
  current.billableFTE = parseInt(current.entry.productiveRequirement);
  current.budgetFTE = parseInt(current.entry.budget);
  current.fcTrAttrition = parseFloat(current.entry.fcTrAttrition);
  current.requiredFTE = parseFloat(current.entry.inCenterRequirement);
  current.grossRequirement = parseFloat(current.entry.grossRequirement);
  current.inCenterRequirement = parseFloat(current.entry.inCenterRequirement);
  current.productiveRequirement = parseFloat(current.entry.productiveRequirement);

  current.pShrinkage = current.entry.pShrinkage;
  current.planned = current.entry.planned;
  current.actual = current.entry.actual;

  current = { ...current, ...channelFields };

  let newPlan = weeks.map((week) => {
    let entry = entries.find((entry) => entry.week === week.code);

    let newRecentItem = {
      week: week.code,
      actualFTE: current.actualFTE,
      ActProdFTE: current.ActProdFTE,
      totalFTE: current.totalFTE,
      actAttrition: entry ? parseInt(entry.attrition) || 0 : 0,
      fcAttrition: entry
        ? (parseFloat(entry.fcAttrition) || 0) * parseFloat(current.actualFTE)
        : 0,
    };

    if (newRecentItem.actAttrition > 0 && newRecentItem.fcAttrition === 0) {
      newRecentItem.fcAttrition = newRecentItem.actAttrition;
    }

    let newPlanWeek = {
      firstDate:
        week.firstDate instanceof Date
          ? week.firstDate.toISOString().split('T')[0]
          : week.firstDate.split('T')[0],
      totalHC: current.totalHC,
      actualFTE: current.actualFTE,
      ActProdFTE: current.ActProdFTE,
      totalFTE: current.totalFTE,
      billableFTE: current.billableFTE,
      budgetFTE: current.budgetFTE,
      // fcFTE: current.fcFTE,
      requiredFTE: current.requiredFTE,
	  grossRequirement: current.grossRequirement,
	  inCenterRequirement: current.inCenterRequirement,
	  productiveRequirement: current.productiveRequirement,
      trainees: 0,
      nesting: 0,
      inLOA: current.inLOA,
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

    //Set up Expected FTE

    if (current.expectedFTE !== undefined) {
      newPlanWeek.expectedFTE = current.expectedFTE;
    } else if (thisWeek && thisWeek.code === week.code) {
      newPlanWeek.expectedFTE = current.actualFTE ? current.actualFTE : 0;
    }

    //Set up Planned Production FTE

    if (current.PlanProdFTE !== undefined) {
      newPlanWeek.PlanProdFTE = current.PlanProdFTE;
    } else if (thisWeek && thisWeek.code === week.code) {
      newPlanWeek.PlanProdFTE = current.actualFTE ? current.actualFTE : 0;
    }

    if (entry && entry.attrition) {
      const attritionValue = parseFloat(entry.attrition);
      
      newPlanWeek.totalHC -= attritionValue;
      newPlanWeek.actualFTE -= attritionValue;
      newPlanWeek.ActProdFTE -= attritionValue;
      newPlanWeek.totalFTE -= attritionValue;
      newPlanWeek.expectedFTE -= attritionValue;
      newPlanWeek.attrPercent =
        Math.round((entry.attrition / current.actualFTE) * 10000) / 100;
      newPlanWeek.PlanProdFTE -= attritionValue;
    
      }

    if (entry && entry.rampDown) {
      const rampDownValue = parseFloat(entry.rampDown);
      newPlanWeek.totalHC     = Math.max(0, newPlanWeek.totalHC - rampDownValue);
      newPlanWeek.actualFTE   = Math.max(0, newPlanWeek.actualFTE - rampDownValue);
      newPlanWeek.ActProdFTE  = Math.max(0, newPlanWeek.ActProdFTE - rampDownValue);
      newPlanWeek.totalFTE    = Math.max(0, newPlanWeek.totalFTE - rampDownValue);
      newPlanWeek.expectedFTE = Math.max(0, newPlanWeek.expectedFTE - rampDownValue);
      newPlanWeek.PlanProdFTE = Math.max(0, newPlanWeek.PlanProdFTE - rampDownValue);
    }

    let sumActAttrition = 0;
    let sumFcAttrition = 0;

    recent.forEach((item) => {
      sumActAttrition += item.actAttrition || 0;
      sumFcAttrition += item.fcAttrition || 0;
    });

    // let relativeAttrTrend = 1;

    // if (sumFcAttrition > 0) {
    //   relativeAttrTrend = Math.min(
    //     Math.max(0.5, sumActAttrition / sumFcAttrition),
    //     1.5
    //   );
    // }

    if (entry && entry.fcAttrition) {
      newPlanWeek.fcAttrition =
        Math.round(parseFloat(entry.fcAttrition) * 1000) / 10;
      // newPlanWeek.expectedAttrition =
      //   Math.round(newPlanWeek.fcAttrition * relativeAttrTrend * 100) / 100;

      if (current.isFuture) {
        console.log('expectedFTE', newPlanWeek.expectedFTE);
        console.log('PlanProdFTE', newPlanWeek.PlanProdFTE);
        console.log('expectedAttrition', newPlanWeek.expectedAttrition);

        newPlanWeek.expectedFTE =
          Math.round(
            newPlanWeek.expectedFTE *
              (1 - newPlanWeek.fcAttrition / 100)
            )
              // * 100 ) / 100;

        newPlanWeek.totalFTE =
          Math.round(
            newPlanWeek.totalFTE *
              (1 - newPlanWeek.fcAttrition / 100) *
              100
          ) / 100;

        newPlanWeek.totalHC =
          Math.round(
            newPlanWeek.totalHC *
              (1 - newPlanWeek.fcAttrition / 100)
            ) 
              //* 100 ) / 100;

        newPlanWeek.PlanProdFTE =
           Math.round(
            newPlanWeek.PlanProdFTE *
              (1 - newPlanWeek.fcAttrition / 100)
                )
      }
    }

    if (entry && entry.planned) {
      entry.planned.forEach((channel) => {
        //console.log(channel)
        if (channel.volumes) {
          newPlanWeek[volumesField(channel)] = channel.volumes;
        }
        if (channel.aht) {
          newPlanWeek[ahtField(channel)] = channel.aht;
        }
      });
      //console.log(newPlanWeek)
      newPlanWeek.hasPlanned = true;
    }

    if (entry && entry.actual) {
      entry.actual.forEach((channel) => {
        //console.log(channel)
        if (channel.volumes) {
          newPlanWeek[volumesField(channel, true)] = channel.volumes;
        }
        if (channel.aht) {
          newPlanWeek[ahtField(channel, true)] = channel.aht;
        }
      });
      //console.log(newPlanWeek)
      newPlanWeek.hasActual = true;
    }

    if (entry && entry.moveOUT) {
      const moveOUTValue = parseFloat(entry.moveOUT);
      newPlanWeek.totalHC     = Math.max(0, newPlanWeek.totalHC - moveOutValue);
      newPlanWeek.actualFTE   = Math.max(0, newPlanWeek.actualFTE - moveOutValue);
      newPlanWeek.ActProdFTE  = Math.max(0, newPlanWeek.ActProdFTE - moveOutValue);
      newPlanWeek.totalFTE    = Math.max(0, newPlanWeek.totalFTE - moveOutValue);
      newPlanWeek.expectedFTE = Math.max(0, newPlanWeek.expectedFTE - moveOutValue);
      newPlanWeek.PlanProdFTE = Math.max(0, newPlanWeek.PlanProdFTE - moveOutValue);
    }

    if (entry && entry.loaOUT) {
      const loaOUTValue = parseFloat(entry.loaOUT);

      newPlanWeek.totalHC     = Math.max(0, newPlanWeek.totalHC - loaOUTValue);
      newPlanWeek.actualFTE   = Math.max(0, newPlanWeek.actualFTE - loaOUTValue);
      newPlanWeek.ActProdFTE  = Math.max(0, newPlanWeek.ActProdFTE - loaOUTValue);
      newPlanWeek.totalFTE    = Math.max(0, newPlanWeek.totalFTE - loaOUTValue);
      newPlanWeek.inLOA       = Math.max(0, newPlanWeek.inLOA + loaOUTValue);
      newPlanWeek.expectedFTE = Math.max(0, newPlanWeek.expectedFTE - loaOUTValue);
      newPlanWeek.PlanProdFTE = Math.max(0, newPlanWeek.PlanProdFTE - loaOUTValue);
      
    }

    if (entry && entry.rwsOUT) {
      const rwsOUTValue = parseFloat(entry.rwsOUT);

      newPlanWeek.totalHC     = Math.max(0, newPlanWeek.totalHC - rwsOUTValue);
      newPlanWeek.actualFTE   = Math.max(0, newPlanWeek.actualFTE - rwsOUTValue);
      newPlanWeek.ActProdFTE  = Math.max(0, newPlanWeek.ActProdFTE - rwsOUTValue);
      newPlanWeek.totalFTE    = Math.max(0, newPlanWeek.totalFTE - rwsOUTValue);
      newPlanWeek.expectedFTE = Math.max(0, newPlanWeek.expectedFTE - rwsOUTValue);
      newPlanWeek.PlanProdFTE = Math.max(0, newPlanWeek.PlanProdFTE - rwsOUTValue);
    }
    
    if (entry && entry.overtimeFTE) {
      const overtimeFTEvalue = parseFloat(entry.overtimeFTE);

      newPlanWeek.totalHC     += overtimeFTEvalue;
      newPlanWeek.actualFTE   += overtimeFTEvalue;
      newPlanWeek.ActProdFTE  += overtimeFTEvalue;     
      newPlanWeek.totalFTE    += overtimeFTEvalue;
      newPlanWeek.expectedFTE += overtimeFTEvalue;
      newPlanWeek.PlanProdFTE += overtimeFTEvalue;
    }

    if (entry && entry.moveIN) {
  const moveInValue = parseFloat(entry.moveIN);
  newPlanWeek.totalHC     += moveInValue;
  newPlanWeek.actualFTE   += moveInValue;
  newPlanWeek.ActProdFTE  += moveInValue;
  newPlanWeek.totalFTE    += moveInValue;
  newPlanWeek.expectedFTE += moveInValue;      // <-- No guard!
  newPlanWeek.PlanProdFTE += moveInValue;
}

    if (entry && entry.loaIN) {
      const loaINValue = parseFloat(entry.loaIN);
      newPlanWeek.totalHC     += loaINValue;
      newPlanWeek.actualFTE   += loaINValue;
      newPlanWeek.ActProdFTE  += loaINValue;      
      newPlanWeek.totalFTE    += loaINValue;
      newPlanWeek.inLOA       -= loaINValue;
      newPlanWeek.expectedFTE += loaINValue;
      newPlanWeek.PlanProdFTE += loaINValue;
    }

    if (entry && entry.rwsIN) {
      const rwsINValue = parseFloat(entry.rwsIN);
      newPlanWeek.actualFTE   += rwsINValue;
      newPlanWeek.ActProdFTE  += rwsINValue;     
      newPlanWeek.totalFTE    += rwsINValue;
      newPlanWeek.expectedFTE += rwsINValue;
      newPlanWeek.PlanProdFTE += rwsINValue;
    }

    if (entry && entry.comment) {
      newPlanWeek.comment = entry.comment;
    }

    if (entry && entry.productiveRequirement) {
      newPlanWeek.billableFTE = parseFloat(entry.productiveRequirement);
    }

    if (entry && entry.budget) {
      newPlanWeek.budgetFTE = parseFloat(entry.budget);
    }

    if (entry && entry.inCenterRequirement) {
      newPlanWeek.requiredFTE = parseFloat(entry.inCenterRequirement);
    }

    if (entry && entry.forecasted) {
      newPlanWeek.fcFTE = parseFloat(entry.forecasted);
    }

    if (entry && entry.pShrinkage && entry.pShrinkage.length) {
      current.pShrinkage = entry.pShrinkage;
      newPlanWeek.hasShrinkage = true;
    }

    if (entry && entry.trWeeks) {
      current.trWeeks = parseFloat(entry.trWeeks);
    }

    if (entry && entry.ocpWeeks) {
      current.ocpWeeks = parseFloat(entry.ocpWeeks);
    }
	if (entry && entry.grossRequirement) {
      newPlanWeek.grossRequirement = parseFloat(entry.grossRequirement);
    }

    if (entry && entry.trCommit) {
      current.inTraining.push({
        trCommit: parseFloat(entry.trCommit),
        trGap: entry.trGap ? parseFloat(entry.trGap) : 0,
        trAttrition: entry.trAttrition ? parseFloat(entry.trAttrition) : 0,
        ocpAttrition: entry.ocpAttrition ? parseFloat(entry.ocpAttrition) : 0,
        weeksToLive: parseFloat(current.trWeeks) + 1,
        weeksToProd: parseFloat(current.ocpWeeks) + 1,
      });
    }

    if (entry && entry.fcTrAttrition) {
      current.fcTrAttrition = parseFloat(entry.fcTrAttrition);
    }

    current.inTraining.forEach((batch) => {
      // Calcula o total base sem considerar attrition
      const baseTraining = batch.trCommit + batch.trGap;

      const effectiveAttrition =
      batch.trAttrition ? batch.trAttrition : 
      (current.fcTrAttrition && current.isFuture ? baseTraining * current.fcTrAttrition : 0);

      // Determina o valor de attrition efetivo para essa semana:
      // se houver fcTrAttrition e o cenário for futuro, aplica proporcionalmente;
      // caso contrário, usa o valor específico do batch (trAttrition)
      // const effectiveAttrition =
      //   current.fcTrAttrition && current.isFuture
      //     ? baseTraining * current.fcTrAttrition
      //     : batch.trAttrition;

      // O total de trainees para essa semana, já considerado a attrition aplicada
      let trainingTotal = baseTraining - effectiveAttrition;

      // Se ainda há mais de uma semana de treinamento (live)
      if (batch.weeksToLive > 1) {
        newPlanWeek.trainees += trainingTotal;
        batch.weeksToLive--;
      } else if (batch.weeksToLive === 1) {
        
        // Na última semana de treinamento, subtrai também o ocpAttrition

        const finalTotal = trainingTotal - batch.ocpAttrition;
        newPlanWeek.totalHC += finalTotal;
        newPlanWeek.actualFTE += finalTotal;
        newPlanWeek.ActProdFTE += finalTotal;
        newPlanWeek.totalFTE += finalTotal;

        if (newPlanWeek.expectedFTE !== undefined) {
          newPlanWeek.expectedFTE += finalTotal;
        }
        if (newPlanWeek.PlanProdFTE !== undefined) {
          newPlanWeek.PlanProdFTE += finalTotal;
        }

        batch.weeksToLive--;
      }

      // Após as semanas "live", se o batch ainda tem semanas para produção ("nesting")

      if (batch.weeksToLive < 1 && batch.weeksToProd > 1) {
        newPlanWeek.nesting += trainingTotal - batch.ocpAttrition;
        batch.weeksToProd--;
      }
    });

    if (thisWeek && week.code === thisWeek.code) {
      current.isFuture = true;
    }
    // We store the newPlanWeek actualFTE in order to reset it to this value for the next iteration
    
    const newPlanWeekactualFTENoActuals = newPlanWeek.actualFTE;
    if (entry && entry.actVac) {
      const actOffPercents = Number(entry.actVac);
      newPlanWeek.actualFTE =
        newPlanWeek.actualFTE -
        newPlanWeekactualFTENoActuals * (actOffPercents / 100);
    }
    if (entry && entry.actAbs) {
      const actAbsPercents = Number(entry.actAbs);
      newPlanWeek.actualFTE =
        newPlanWeek.actualFTE -
        newPlanWeekactualFTENoActuals * (actAbsPercents / 100);
    }
    
    // We store the newPlanWeek ActProdFTE in order to reset it to this value for the next iteration
    
    const newPlanWeekActProdFTENoActuals = newPlanWeek.ActProdFTE;
    if (entry && entry.actVac) {
      const actOffPercents = Number(entry.actVac);
      newPlanWeek.ActProdFTE =
        newPlanWeek.ActProdFTE -
        newPlanWeekActProdFTENoActuals * (actOffPercents / 100);
    }
    if (entry && entry.actAbs) {
      const actAbsPercents = Number(entry.actAbs);
      newPlanWeek.ActProdFTE =
        newPlanWeek.ActProdFTE -
        newPlanWeekActProdFTENoActuals * (actAbsPercents / 100);
    }
    if (entry && entry.actAux) {
      const actAuxPercents = Number(entry.actAux);
      newPlanWeek.ActProdFTE =
        newPlanWeek.ActProdFTE -
        newPlanWeek.ActProdFTE * (actAuxPercents / 100);
    }

    // We store the newPlanWeek expectedFTE in order to reset it to this value for the next iteration

    const newPlanWeekExpectedFTENoPlanned = newPlanWeek.expectedFTE;
    if (entry && entry.plannedVac) {
      const plannedVacPercents = Number(entry.plannedVac);
      newPlanWeek.expectedFTE =
        newPlanWeek.expectedFTE -
        newPlanWeekExpectedFTENoPlanned * (plannedVacPercents / 100);
    }
    if (entry && entry.plannedAbs) {
      const plannedAbsPercents = Number(entry.plannedAbs);
      newPlanWeek.expectedFTE =
        newPlanWeek.expectedFTE -
        newPlanWeekExpectedFTENoPlanned * (plannedAbsPercents / 100);
    }
    // We store the newPlanWeek PlannProdFTE in order to reset it to this value for the next iteration

    const newPlanWeekPlannedProdFTENoPlanned = newPlanWeek.PlanProdFTE;

      if (entry && entry.plannedVac) {
        const plannedVacPercents = Number(entry.plannedVac);
        newPlanWeek.PlanProdFTE =
          newPlanWeek.PlanProdFTE -
          newPlanWeekPlannedProdFTENoPlanned * (plannedVacPercents / 100);
     }
     if (entry && entry.plannedAbs) {
       const plannedAbsPercents = Number(entry.plannedAbs);
       newPlanWeek.PlanProdFTE =
         newPlanWeek.PlanProdFTE -
         newPlanWeekPlannedProdFTENoPlanned * (plannedAbsPercents / 100);
    }
     if( entry && entry.plannedAux) {
       const plannedAuxPercents = Number(entry.plannedAux);
       newPlanWeek.PlanProdFTE =
        newPlanWeek.PlanProdFTE -
       newPlanWeek.PlanProdFTE * (plannedAuxPercents / 100);
      }    


    //Set up SHRINKGAGE

    if (current.pShrinkage) {
      let newShrink = {
        aux: 0,
        abs: 0,
        off: 0,
      };

      current.pShrinkage.forEach((shrink) => {
        newShrink[shrink.mapping] += parseFloat(shrink.percentage);
      });

      newPlanWeek.pAbs = newShrink.abs;
      newPlanWeek.pAux = newShrink.aux;
      newPlanWeek.pOff = newShrink.off;
    }

    //Calculations
    current.billableFTE &&
      (newPlanWeek.expectedFTE
        ? (newPlanWeek.billVar =
            newPlanWeek.PlanProdFTE - newPlanWeek.billableFTE)
        : (newPlanWeek.billVar =
            newPlanWeek.ActProdFTE - newPlanWeek.billableFTE));

    current.requiredFTE &&
      (newPlanWeek.expectedFTE
        ? (newPlanWeek.reqVar =
            newPlanWeek.expectedFTE - newPlanWeek.requiredFTE)
        : (newPlanWeek.reqVar =
            newPlanWeek.actualFTE - newPlanWeek.requiredFTE));

    current.fcFTE &&
      (newPlanWeek.expectedFTE
        ? (newPlanWeek.fcVar = newPlanWeek.totalFTE - newPlanWeek.budgetFTE)
        : (newPlanWeek.fcVar = newPlanWeek.totalFTE - newPlanWeek.budgetFTE));

    //current = { ...current, ...newPlanWeek, actualFTE : newPlanWeek.totalHC, expectedFTE : current.isFuture ? newPlanWeek.actualFTE : null}
    current = {
      ...current,
      ...newPlanWeek,
      actualFTE: newPlanWeekactualFTENoActuals,
      ActProdFTE: newPlanWeekActProdFTENoActuals,
      expectedFTE: newPlanWeekExpectedFTENoPlanned,
      PlanProdFTE: newPlanWeekPlannedProdFTENoPlanned,

    };
    // current = { ...current, ...newPlanWeek}
    //Build RECENT

    if (!current.isFuture) {
      recent.push(newRecentItem);

      if (recent.length === 15) {
        newPlanWeek.expectedFTE;
        newPlanWeek.PlanProdFTE;
        recent = recent.slice(1);
      }
    }
    if (current.isFuture) {
      newPlanWeek.actualFTE = 0
      newPlanWeek.ActProdFTE = 0;

    }

// === Carry-forward for requirements ===
if (
  newPlanWeek.grossRequirement == null ||
  isNaN(newPlanWeek.grossRequirement)
) {
  newPlanWeek.grossRequirement = current.grossRequirement;
}
if (
  newPlanWeek.inCenterRequirement == null ||
  isNaN(newPlanWeek.inCenterRequirement)
) {
  newPlanWeek.inCenterRequirement = current.inCenterRequirement;
}
if (
  newPlanWeek.productiveRequirement == null ||
  isNaN(newPlanWeek.productiveRequirement)
) {
  newPlanWeek.productiveRequirement = current.productiveRequirement;
}

    //RETURN

    return { ...entry, ...newPlanWeek, week };
  });

  if (fromWeek) {
    return newPlan.filter(
      (weekly) => weekly.week.firstDate >= fromWeek.firstDate
    );
  } else {
    return newPlan;
  }
};
