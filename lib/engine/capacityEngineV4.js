// ============================================
// CAPACITY PLANNING ENGINE v4.3
// Foundever PlanningApp Integration
// ============================================
// Models:
//   - Erlang C
//   - Erlang A abandonment constraint
//   - Workload
//
// Erlang calculation order:
//   1. Service-level requirement
//   2. Abandonment requirement
//   3. Occupancy cap
//   4. Network scaling
//   5. Minimum staffing
//   6. Shrinkage
//
// Precision:
//   - Full precision is preserved during calculations.
//   - Rounding is reserved for UI and export formatting.
//   - Erlang fractional staffing remains in 0.1 increments.
// ============================================

export const CAPACITY_ENGINE_VERSION =
  "4.3.0-workload-answer-rate";

// ============================================
// NUMERIC AND CONFIGURATION HELPERS
// ============================================

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toPositiveNumber(value, fallback) {
  const number = Number(value);

  if (Number.isFinite(number) && number > 0) {
    return number;
  }

  return fallback;
}

function normalizeModel(model) {
  return String(model || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function isErlangCModel(model) {
  return normalizeModel(model) === "erlangc";
}

function getChannelAHT(channelConfig) {
  return toPositiveNumber(
    channelConfig?.aht,
    toPositiveNumber(channelConfig?.baseAHT, 300)
  );
}

function getNetworkConfiguration(channelConfig) {
  const rawNetworkPct = toPositiveNumber(
    channelConfig?.networkPct,
    100
  );

  const rawSubServices = toPositiveNumber(
    channelConfig?.subServices,
    1
  );

  const networkPct = Math.min(rawNetworkPct, 100) / 100;
  const subServices = rawSubServices;
  const networkScale = subServices * networkPct;

  if (!Number.isFinite(networkPct) || networkPct <= 0) {
    throw new Error(
      `Invalid networkPct for channel "${channelConfig?.name || "Unknown"}"`
    );
  }

  if (!Number.isFinite(subServices) || subServices <= 0) {
    throw new Error(
      `Invalid subServices for channel "${channelConfig?.name || "Unknown"}"`
    );
  }

  return {
    networkPct,
    subServices,
    networkScale,
  };
}

// ============================================
// MATHEMATICAL HELPERS
// ============================================

const factCache = [1, 1];

function factorial(n) {
  if (n < 0) return 1;

  if (n < factCache.length) {
    return factCache[n];
  }

  for (let i = factCache.length; i <= n; i++) {
    factCache[i] = factCache[i - 1] * i;
  }

  return factCache[n];
}

function lnGamma(x) {
  if (x <= 0) return 0;

  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];

  let y = x;
  let tmp = x + 5.5;

  tmp -= (x + 0.5) * Math.log(tmp);

  let ser = 1.000000000190015;

  for (let j = 0; j < 6; j++) {
    ser += cof[j] / ++y;
  }

  return (
    -tmp +
    Math.log((2.5066282746310005 * ser) / x)
  );
}

function gammaFunction(x) {
  if (x <= 0 && x === Math.floor(x)) {
    return Infinity;
  }

  return Math.exp(lnGamma(x));
}

function gammaIncomplete(a, x) {
  if (x < 0 || x === 0 || a <= 0) {
    return 0;
  }

  const ITMAX = 200;
  const EPS = 3.0e-12;

  if (x < a + 1) {
    let ap = a;
    let sum = 1.0 / a;
    let del = sum;

    for (let n = 1; n <= ITMAX; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;

      if (Math.abs(del) < Math.abs(sum) * EPS) {
        return (
          sum *
          Math.exp(
            -x +
              a * Math.log(x) -
              lnGamma(a)
          )
        );
      }
    }

    return (
      sum *
      Math.exp(
        -x +
          a * Math.log(x) -
          lnGamma(a)
      )
    );
  }

  let b = x + 1 - a;
  let c = 1e30;
  let d = 1 / b;
  let h = d;

  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a);

    b += 2;
    d = an * d + b;

    if (Math.abs(d) < 1e-30) {
      d = 1e-30;
    }

    c = b + an / c;

    if (Math.abs(c) < 1e-30) {
      c = 1e-30;
    }

    d = 1 / d;

    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < EPS) {
      break;
    }
  }

  return (
    gammaFunction(a) -
    h *
      Math.exp(
        -x +
          a * Math.log(x) -
          lnGamma(a)
      )
  );
}

function regularizedGammaP(a, x) {
  if (a <= 0) return 0;

  const fullGamma = gammaFunction(a);

  if (
    !Number.isFinite(fullGamma) ||
    fullGamma === 0
  ) {
    return 0;
  }

  return gammaIncomplete(a, x) / fullGamma;
}

// ============================================
// ERLANG C CORE
// ============================================

function erlangCPw(agents, intensity) {
  const N = Math.floor(agents);
  const A = intensity;

  if (N <= 0 || A <= 0) return 1;
  if (N <= A) return 1;

  let sum = 0;

  for (let k = 0; k < N; k++) {
    sum += Math.pow(A, k) / factorial(k);
  }

  const numerator =
    Math.pow(A, N) / factorial(N);

  const denominator =
    numerator +
    (1 - A / N) * sum;

  if (
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 1;
  }

  return numerator / denominator;
}

function erlangCSL(
  agents,
  intensity,
  targetSeconds,
  ahtSeconds
) {
  const N = Math.floor(agents);
  const A = intensity;

  if (A <= 0) return 1;
  if (N <= A || N <= 0) return 0;

  const probabilityWait = erlangCPw(N, A);

  return (
    1 -
    probabilityWait *
      Math.exp(
        -(
          (N - A) *
          targetSeconds
        ) / ahtSeconds
      )
  );
}

// ============================================
// ERLANG A ABANDONMENT
// ============================================

function erlangA_J(lambda, mu, theta, k) {
  if (
    k <= 0 ||
    lambda <= 0 ||
    mu <= 0 ||
    theta <= 0
  ) {
    return 0;
  }

  const rho = lambda / mu;
  const r = lambda / theta;
  const a = k;
  const x = r;

  try {
    const incompleteGamma =
      gammaIncomplete(a, x);

    const term =
      Math.pow(rho, k) / factorial(k);

    const expR = Math.exp(r);
    const fullGamma = gammaFunction(a);

    if (
      fullGamma === 0 ||
      !Number.isFinite(fullGamma)
    ) {
      return 0;
    }

    const result =
      term *
      expR *
      (incompleteGamma / fullGamma);

    return Number.isFinite(result)
      ? result
      : 0;
  } catch (error) {
    return 0;
  }
}

function erlangAPAbandon(
  callsPerHour,
  ahtSeconds,
  agents,
  abandonTimeSeconds
) {
  const lambda = callsPerHour;
  const mu = 3600 / ahtSeconds;
  const theta =
    3600 / abandonTimeSeconds;
  const k = Math.floor(agents);

  if (
    lambda <= 0 ||
    mu <= 0 ||
    theta <= 0 ||
    k <= 0
  ) {
    return 0;
  }

  let denominatorSum = 0;

  for (let i = 0; i < k; i++) {
    denominatorSum +=
      Math.pow(lambda / mu, i) /
      factorial(i);
  }

  const jTerm = erlangA_J(
    lambda,
    mu,
    theta,
    k
  );

  const denominator =
    denominatorSum + jTerm;

  if (
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0;
  }

  const probabilityWait =
    jTerm / denominator;

  const abandonmentGivenWait =
    1 -
    regularizedGammaP(
      k,
      lambda / theta
    );

  const abandonmentProbability =
    probabilityWait *
    abandonmentGivenWait;

  return Math.max(
    0,
    Math.min(
      1,
      abandonmentProbability
    )
  );
}

// ============================================
// FRACTIONAL AGENT STEPPING
// ============================================

function findAgentsForSL(
  intensity,
  slTarget,
  astSeconds,
  ahtSeconds
) {
  const A = intensity;

  if (A <= 0) return 0;

  let integerAgents = Math.max(
    1,
    Math.ceil(A)
  );

  const maximumAgents =
    Math.ceil(A) + 1000;

  while (
    integerAgents < maximumAgents
  ) {
    const serviceLevel = erlangCSL(
      integerAgents,
      A,
      astSeconds,
      ahtSeconds
    );

    if (
      serviceLevel >= slTarget / 100
    ) {
      break;
    }

    integerAgents += 1;
  }

  let fractionalAgents =
    integerAgents - 0.9;

  while (
    fractionalAgents <
    integerAgents + 0.1
  ) {
    const lower =
      Math.floor(fractionalAgents);

    const upper =
      Math.ceil(fractionalAgents);

    const interpolationWeight =
      fractionalAgents - lower;

    const lowerServiceLevel =
      erlangCSL(
        lower,
        A,
        astSeconds,
        ahtSeconds
      );

    const upperServiceLevel =
      erlangCSL(
        upper,
        A,
        astSeconds,
        ahtSeconds
      );

    const interpolatedServiceLevel =
      lowerServiceLevel +
      interpolationWeight *
        (
          upperServiceLevel -
          lowerServiceLevel
        );

    if (
      interpolatedServiceLevel >=
      slTarget / 100
    ) {
      // Intentional model precision:
      // fractional agents are returned in 0.1 increments.
      return (
        Math.round(
          fractionalAgents * 10
        ) / 10
      );
    }

    fractionalAgents += 0.1;
  }

  return integerAgents;
}

function findAgentsForAbandon(
  intensity,
  maxAbandonPct,
  aptSeconds,
  ahtSeconds,
  intervalVolume,
  intervalSeconds
) {
  const A = intensity;

  if (A <= 0) return 0;

  const callsPerHour =
    (intervalVolume / intervalSeconds) *
    3600;

  let integerAgents = Math.max(
    1,
    Math.ceil(A)
  );

  const maximumAgents =
    Math.ceil(A) + 1000;

  while (
    integerAgents < maximumAgents
  ) {
    const abandonment =
      erlangAPAbandon(
        callsPerHour,
        ahtSeconds,
        integerAgents,
        aptSeconds
      );

    if (
      abandonment <=
      maxAbandonPct / 100
    ) {
      break;
    }

    integerAgents += 1;
  }

  let fractionalAgents =
    integerAgents - 0.9;

  while (
    fractionalAgents <
    integerAgents + 0.1
  ) {
    const lower =
      Math.floor(fractionalAgents);

    const upper =
      Math.ceil(fractionalAgents);

    const interpolationWeight =
      fractionalAgents - lower;

    const lowerAbandonment =
      erlangAPAbandon(
        callsPerHour,
        ahtSeconds,
        lower,
        aptSeconds
      );

    const upperAbandonment =
      erlangAPAbandon(
        callsPerHour,
        ahtSeconds,
        upper,
        aptSeconds
      );

    const interpolatedAbandonment =
      lowerAbandonment +
      interpolationWeight *
        (
          upperAbandonment -
          lowerAbandonment
        );

    if (
      interpolatedAbandonment <=
      maxAbandonPct / 100
    ) {
      // Intentional model precision:
      // fractional agents are returned in 0.1 increments.
      return (
        Math.round(
          fractionalAgents * 10
        ) / 10
      );
    }

    fractionalAgents += 0.1;
  }

  return integerAgents;
}

// ============================================
// TRAFFIC AND OCCUPANC
// ============================================

function trafficIntensity(
  volume,
  ahtSeconds,
  intervalSeconds,
  concurrency = 1
) {
  const effectiveConcurrency =
    toPositiveNumber(concurrency, 1);

  return (
    (volume * ahtSeconds) /
    intervalSeconds /
    effectiveConcurrency
  );
}

function calculateOccupancy(
  intensity,
  productiveAgents
) {
  if (
    productiveAgents <= 0 ||
    intensity <= 0
  ) {
    return 0;
  }

  return (
    intensity /
    productiveAgents
  ) * 100;
}

function findAgentsForOccupancy(
  intensity,
  maxOccupancyPct
) {
  if (intensity <= 0) return 0;

  const occupancyFraction =
    maxOccupancyPct / 100;

  if (occupancyFraction <= 0) {
    throw new Error(
      `Invalid occupancy cap: ${maxOccupancyPct}`
    );
  }

  return intensity / occupancyFraction;
}

// ============================================
// ERLANG C INTERVAL CALCULATION
// ============================================

function calculateIntervalErlangC(
  config,
  intervalVolume,
  intervalAHT,
  intervalSeconds
) {
  const concurrency =
    toPositiveNumber(
      config?.concurrency,
      1
    );

  const kpi = config?.kpi || {};

  const slPct =
    toFiniteNumber(kpi.slPct, 80);

  const ast =
    toPositiveNumber(kpi.ast, 30);

  const maxAbandon =
    toFiniteNumber(
      kpi.maxAbandon,
      5
    );

  const apt =
    toPositiveNumber(kpi.apt, 120);

  // Missing maxOcc no longer silently adds staffing at 85%.
  // A missing value means no additional occupancy restriction.
  const maxOcc =
    toPositiveNumber(kpi.maxOcc, 100);

  if (
    maxOcc <= 0 ||
    maxOcc > 100
  ) {
    throw new Error(
      `Invalid maxOcc for channel "${config?.name || "Unknown"}": ${String(
        kpi.maxOcc
      )}`
    );
  }

  if (intervalVolume <= 0) {
    return {
      productive: 0,
      occupancy: 0,
      occupancyBeforeCap: 0,
      serviceLevel: 100,
      abandonRate: 0,
      intensity: 0,
      agentsSL: 0,
      agentsAbandon: 0,
      agentsOcc: 0,
      erlangRequired: 0,
      limitingConstraint: "none",
      occupancyCapApplied: false,
    };
  }

  const intensity = trafficIntensity(
    intervalVolume,
    intervalAHT,
    intervalSeconds,
    concurrency
  );

  // ------------------------------------------
  // Step 1: Service-level staffing requirement
  // ------------------------------------------

  const agentsSL = findAgentsForSL(
    intensity,
    slPct,
    ast,
    intervalAHT
  );

  // ------------------------------------------
  // Step 2: Abandonment staffing requirement
  // ------------------------------------------

  const agentsAbandon =
    findAgentsForAbandon(
      intensity,
      maxAbandon,
      apt,
      intervalAHT,
      intervalVolume,
      intervalSeconds
    );

  let erlangRequired = agentsSL;
  let limitingConstraint =
    "serviceLevel";

  if (agentsAbandon > agentsSL) {
    erlangRequired = agentsAbandon;
    limitingConstraint =
      "abandonment";
  }

  // ------------------------------------------
  // Step 3: Occupancy cap
  // Applied after Erlang requirements.
  // ------------------------------------------

  const occupancyBeforeCap =
    calculateOccupancy(
      intensity,
      erlangRequired
    );

  const agentsOcc =
    findAgentsForOccupancy(
      intensity,
      maxOcc
    );

  let productive = erlangRequired;
  let occupancyCapApplied = false;

  if (
    occupancyBeforeCap >
    maxOcc
  ) {
    productive = agentsOcc;
    limitingConstraint =
      "occupancyCap";
    occupancyCapApplied = true;
  }

  const occupancy =
    calculateOccupancy(
      intensity,
      productive
    );

  // Service level is evaluated using the
  // integer staffing level covering the final
  // fractional requirement.
  const serviceLevelAgents =
    Math.ceil(productive);

  const serviceLevel =
    erlangCSL(
      serviceLevelAgents,
      intensity,
      ast,
      intervalAHT
    ) * 100;

  const callsPerHour =
    (intervalVolume / intervalSeconds) *
    3600;

  const abandonRate =
    erlangAPAbandon(
      callsPerHour,
      intervalAHT,
      serviceLevelAgents,
      apt
    ) * 100;

  const validationValues = {
    intensity,
    agentsSL,
    agentsAbandon,
    agentsOcc,
    erlangRequired,
    productive,
    occupancy,
    serviceLevel,
    abandonRate,
  };

  Object.entries(
    validationValues
  ).forEach(([field, value]) => {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Invalid Erlang value "${field}" for channel "${config?.name || "Unknown"}": ${String(
          value
        )}`
      );
    }
  });

  return {
    productive,
    occupancy,
    occupancyBeforeCap,
    serviceLevel,
    abandonRate,
    intensity,
    agentsSL,
    agentsAbandon,
    agentsOcc,
    erlangRequired,
    limitingConstraint,
    occupancyCapApplied,
  };
}

// ============================================
// WORKLOAD INTERVAL CALCULATION
// ============================================

function calculateIntervalWorkload(
  config,
  intervalVolume,
  intervalAHT,
  intervalSeconds
) {
  const kpi = config?.kpi || {};

  const rawAnswerRate =
    toFiniteNumber(
      kpi.answerRate,
      100
    );

  const maxOcc =
    toPositiveNumber(
      kpi.maxOcc,
      85
    );

  if (
    rawAnswerRate < 0 ||
    rawAnswerRate > 100
  ) {
    throw new Error(
      `Invalid answerRate for workload channel "${config?.name || "Unknown"}": ${String(
        kpi.answerRate
      )}`
    );
  }

  if (
    maxOcc <= 0 ||
    maxOcc > 100
  ) {
    throw new Error(
      `Invalid maxOcc for workload channel "${config?.name || "Unknown"}": ${String(
        kpi.maxOcc
      )}`
    );
  }

  const answerRate =
    rawAnswerRate / 100;

  const offeredVolume =
    Math.max(
      0,
      toFiniteNumber(
        intervalVolume,
        0
      )
    );

  const targetAnsweredVolume =
    offeredVolume * answerRate;

  if (
    offeredVolume <= 0 ||
    targetAnsweredVolume <= 0
  ) {
    return {
      productive: 0,
      occupancy: 0,
      productiveHours: 0,

      offeredVolume,
      answerRate,
      answerRatePct:
        rawAnswerRate,

      targetAnsweredVolume: 0,
      workloadSeconds: 0,

      rawWorkloadAgents: 0,
      workloadAgents: 0,

      maxOcc,
      occupancyCapApplied: false,

      limitingConstraint:
        'workload',
    };
  }

  const workloadSeconds =
    targetAnsweredVolume *
    intervalAHT;

  /*
   * Direct workload demand before the
   * occupancy productivity guardrail.
   */

  const rawWorkloadAgents =
    workloadSeconds /
    intervalSeconds;

  /*
   * Maximum occupancy defines the productive
   * utilization expected from staffed capacity.
   *
   * Example:
   * 0.85 raw agents ÷ 85% occupancy
   * = 1 staffed productive agent.
   */
  const productive =
    rawWorkloadAgents /
    (maxOcc / 100);

  const intervalHours =
    intervalSeconds / 3600;

  const productiveHours =
    productive * intervalHours;

  const occupancy =
    calculateOccupancy(
      rawWorkloadAgents,
      productive
    );

  return {
    productive,
    occupancy,
    productiveHours,

    offeredVolume,
    answerRate,
    answerRatePct:
      rawAnswerRate,

    targetAnsweredVolume,
    workloadSeconds,

    rawWorkloadAgents,

    // Kept for compatibility with existing
    // result and diagnostic structures.
    workloadAgents:
      rawWorkloadAgents,

    maxOcc,

    occupancyCapApplied:
      maxOcc < 100,

    limitingConstraint:
      'workload',
  };
}

// ============================================
// SHRINKAGE
// ============================================

function applyShrinkage(
  productiveAgents,
  internalShrinkPct,
  externalShrinkPct
) {
  const safeInternalShrinkPct =
    Math.max(
      0,
      toFiniteNumber(
        internalShrinkPct,
        0
      )
    );

  const safeExternalShrinkPct =
    Math.max(
      0,
      toFiniteNumber(
        externalShrinkPct,
        0
      )
    );

  const internalShrinkFraction =
    Math.min(
      safeInternalShrinkPct / 100,
      0.95
    );

  const externalShrinkFraction =
    Math.min(
      safeExternalShrinkPct / 100,
      0.95
    );

  const inCenter =
    productiveAgents /
    (1 - internalShrinkFraction);

  const gross =
    inCenter /
    (1 - externalShrinkFraction);

  return {
    productive: productiveAgents,
    inCenter,
    gross,
    internalShrinkPct:
      safeInternalShrinkPct,
    externalShrinkPct:
      safeExternalShrinkPct,
  };
}

function resolveInternalShrinkage(
  patternIntervals,
  shrinkagePlanInternal,
  intervalTime
) {
  const planInternal =
    toFiniteNumber(
      shrinkagePlanInternal,
      0
    );

  if (
    !patternIntervals ||
    patternIntervals.length === 0
  ) {
    return planInternal;
  }

  const dayShrinkageSum =
    patternIntervals.reduce(
      (sum, interval) =>
        sum +
        toFiniteNumber(
          interval.shrinkagePct,
          0
        ),
      0
    );

  if (dayShrinkageSum > 0) {
    const matchingInterval =
      patternIntervals.find(
        (interval) =>
          interval.time === intervalTime
      );

    return matchingInterval
      ? toFiniteNumber(
          matchingInterval.shrinkagePct,
          0
        )
      : 0;
  }

  return planInternal;
}

// ============================================
// TIME HELPERS
// ============================================

function generateIntervals(
  startTime,
  endTime,
  intervalMinutes
) {
  const intervals = [];

  const [startHour, startMinute] =
    startTime.split(":").map(Number);

  const [endHour, endMinute] =
    endTime.split(":").map(Number);

  const startTotalMinutes =
    startHour * 60 + startMinute;

  const endTotalMinutes =
    endHour * 60 + endMinute;

  for (
    let minute = startTotalMinutes;
    minute < endTotalMinutes;
    minute += intervalMinutes
  ) {
    const hour =
      Math.floor(minute / 60);

    const minutePart =
      minute % 60;

    intervals.push(
      `${String(hour).padStart(
        2,
        "0"
      )}:${String(
        minutePart
      ).padStart(2, "0")}`
    );
  }

  return intervals;
}

function getDayName(dateString) {
  const days = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ];

  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  return days[date.getUTCDay()];
}

// ============================================
// CHANNEL-DAY CALCULATION
// ============================================

export function calculateChannelDay({
  channelConfig,
  date,
  dailyVolume,
  patternIntervals,
  shrinkagePlanSummary,
  intervalMinutes,
}) {
  const dayName = getDayName(date);
  const hoop =
    channelConfig?.hoop?.[dayName];

  const emptyTotals = {
    productive: 0,
    inCenter: 0,
    gross: 0,
    hours_productive: 0,
    hours_inCenter: 0,
    hours_gross: 0,
  };

  if (!hoop || !hoop.open) {
    return {
      date,
      dayName,
      intervals: [],
      totals: emptyTotals,
    };
  }

  const effectiveIntervalMinutes =
    toPositiveNumber(
      intervalMinutes,
      30
    );

  const intervalSeconds =
    effectiveIntervalMinutes * 60;

  const intervalHours =
    intervalSeconds / 3600;

  const startTime = hoop.fullDay
    ? "00:00"
    : hoop.start || "08:00";

  const endTime = hoop.fullDay
    ? "24:00"
    : hoop.end || "18:00";

  const timeSlots = generateIntervals(
    startTime,
    endTime,
    effectiveIntervalMinutes
  );

  const modelIsErlangC =
  isErlangCModel(
    channelConfig?.model
  );

  const networkConfiguration =
    modelIsErlangC
      ? getNetworkConfiguration(
          channelConfig
        )
      : {
          networkPct: 1,
          subServices: 1,
          networkScale: 1,
        };

  const {
    networkPct,
    subServices,
    networkScale,
  } = networkConfiguration;

    const safeDailyVolume =
      Math.max(
        0,
        toFiniteNumber(dailyVolume, 0)
      );

  let arrivalSum = 0;

  if (
    patternIntervals &&
    patternIntervals.length > 0
  ) {
    arrivalSum =
      patternIntervals.reduce(
        (sum, interval) =>
          sum +
          toFiniteNumber(
            interval.arrivalPct,
            0
          ),
        0
      );
  }

  const arrivalIsPercent =
    arrivalSum > 2;

  const defaultArrivalPct =
    timeSlots.length > 0
      ? arrivalIsPercent
        ? 100 / timeSlots.length
        : 1 / timeSlots.length
      : 0;

  const externalShrinkPct =
    toFiniteNumber(
      shrinkagePlanSummary?.external,
      0
    );

  const baseAHT =
    getChannelAHT(channelConfig);

  const minRequired =
   modelIsErlangC
    ? Math.max(
        0,
        toFiniteNumber(
          channelConfig?.minRequired,
          0
        )
      )
    : 0;

  const patternHasShrinkage =
    Array.isArray(patternIntervals) &&
    patternIntervals.reduce(
      (sum, interval) =>
        sum +
        toFiniteNumber(
          interval.shrinkagePct,
          0
        ),
      0
    ) > 0;

  const intervals = timeSlots.map(
    (time) => {
      const pattern =
        patternIntervals?.find(
          (item) =>
            item.time === time
        );

      const arrivalPct =
        pattern?.arrivalPct ??
        defaultArrivalPct;

      const ahtMultiplier =
        toPositiveNumber(
          pattern?.ahtMultiplier,
          1
        );

      const arrivalFraction =
        arrivalIsPercent
          ? toFiniteNumber(
              arrivalPct,
              0
            ) / 100
          : toFiniteNumber(
              arrivalPct,
              0
            );

      const forecastIntervalVolume =
        safeDailyVolume *
        arrivalFraction;

      // Erlang C uses a full-network-equivalent
      // interval volume before nonlinear staffing,
      // then scales the requirement back afterward.
      //
      // Workload is linear and uses occupancy as an
      // input, so it uses forecast volume directly.
      const intervalVolume =
        modelIsErlangC
          ? forecastIntervalVolume /
            subServices /
            networkPct
          : forecastIntervalVolume;

      const intervalAHT =
        baseAHT * ahtMultiplier;

      const internalShrinkPct =
        resolveInternalShrinkage(
          patternIntervals,
          shrinkagePlanSummary?.internal,
          time
        );

      let modelResult;

      if (modelIsErlangC) {
        modelResult =
          calculateIntervalErlangC(
            channelConfig,
            intervalVolume,
            intervalAHT,
            intervalSeconds
          );
      } else {
        modelResult =
          calculateIntervalWorkload(
            channelConfig,
            intervalVolume,
            intervalAHT,
            intervalSeconds
          );
      }

      // --------------------------------------
      // Step 4: Network scaling
      // --------------------------------------

      let productiveAfterNetwork =
        modelResult.productive;

      let scaledIntensity =
        modelResult.intensity ?? null;

      if (modelIsErlangC) {
        productiveAfterNetwork =
          modelResult.productive *
          networkScale;

        scaledIntensity =
          modelResult.intensity *
          networkScale;
      }

      // --------------------------------------
      // Step 5: Minimum staffing
      // Applied only once, after network scale.
      // --------------------------------------

      let adjustedProductive =
        productiveAfterNetwork;

      let finalConstraint =
        modelResult.limitingConstraint;

      if (
        modelIsErlangC &&
        adjustedProductive < minRequired
      ) {
        adjustedProductive =
          minRequired;

        finalConstraint =
          'minimum';
      }

      // Occupancy after network scaling and
      // minimum staffing.
      let finalOccupancy =
        modelResult.occupancy;

      if (
        modelIsErlangC &&
        scaledIntensity !== null
      ) {
        finalOccupancy =
          calculateOccupancy(
            scaledIntensity,
            adjustedProductive
          );
      } else if (
        !modelIsErlangC &&
        adjustedProductive > 0
      ) {
        finalOccupancy =
          calculateOccupancy(
            modelResult.workloadAgents,
            adjustedProductive
          );
      }

      // --------------------------------------
      // Step 6: Shrinkage
      // --------------------------------------

      const shrinkageResult =
        applyShrinkage(
          adjustedProductive,
          internalShrinkPct,
          externalShrinkPct
        );

      return {
        time,
        volume: intervalVolume,
        aht: intervalAHT,

        ...shrinkageResult,

        occupancy: finalOccupancy,
        occupancyBeforeCap:
          modelResult.occupancyBeforeCap ??
          modelResult.occupancy,



        serviceLevel:
          modelResult.serviceLevel ??
          null,

        abandonRate:
          modelResult.abandonRate ??
          null,

        // Capacity provided to another channel.
        blendHours: 0,

        // Capacity received from another channel.
        blendHoursReceived: 0,

        blendedFrom: [],

        hours_productive:
          shrinkageResult.productive *
          intervalHours,

        hours_inCenter:
          shrinkageResult.inCenter *
          intervalHours,

        hours_gross:
          shrinkageResult.gross *
          intervalHours,

        internalShrinkPct,
        externalShrinkPct,

        shrinkSource:
          patternHasShrinkage
            ? "pattern"
            : "plan",

        // Diagnostic fields
        modelConstraint:
          modelResult.limitingConstraint,

        finalConstraint,

        occupancyCapApplied:
          modelResult.occupancyCapApplied ??
          false,
        
        forecastIntervalVolume,

          answerRatePct:
            modelIsErlangC
              ? null
              : modelResult.answerRatePct,

          answerRate:
            modelIsErlangC
              ? null
              : modelResult.answerRate,

          targetAnsweredVolume:
            modelIsErlangC
              ? null
              : modelResult.targetAnsweredVolume,

          workloadSeconds:
            modelIsErlangC
              ? null
              : modelResult.workloadSeconds,
          
          workloadMaxOcc:
            modelIsErlangC
              ? null
              : modelResult.maxOcc,

          concurrency:
            modelIsErlangC
              ? toPositiveNumber(
                  channelConfig?.concurrency,
                  1
                )
              : null,

        rawWorkloadAgents:
          modelResult.rawWorkloadAgents ??
          null,

        workloadAgents:
          modelResult.workloadAgents ??
          null,

        intensity:
          modelResult.intensity ??
          modelResult.workloadAgents ??
          null,

        scaledIntensity,

        agentsSL:
          modelResult.agentsSL ??
          null,

        agentsAbandon:
          modelResult.agentsAbandon ??
          null,

        agentsOcc:
          modelResult.agentsOcc ??
          null,

        erlangRequired:
          modelResult.erlangRequired ??
          null,

        productiveBeforeNetworkScaling:
          modelResult.productive,

        productiveAfterNetworkScaling:
          productiveAfterNetwork,

        networkScale:
          modelIsErlangC
            ? networkScale
            : null,

        networkPct:
          modelIsErlangC
            ? networkPct * 100
            : null,

        subServices:
          modelIsErlangC
            ? subServices
            : null,

        minRequired:
          modelIsErlangC
            ? minRequired
            : null,
      };
    }
  );

  const totals = intervals.reduce(
    (accumulator, interval) => {
      accumulator.productive +=
        interval.productive;

      accumulator.inCenter +=
        interval.inCenter;

      accumulator.gross +=
        interval.gross;

      accumulator.hours_productive +=
        interval.hours_productive;

      accumulator.hours_inCenter +=
        interval.hours_inCenter;

      accumulator.hours_gross +=
        interval.hours_gross;

      return accumulator;
    },
    {
      productive: 0,
      inCenter: 0,
      gross: 0,
      hours_productive: 0,
      hours_inCenter: 0,
      hours_gross: 0,
    }
  );

  return {
    date,
    dayName,
    intervals,
    totals,
  };
}

// ============================================
// WEEKLY AGGREGATION
// ============================================

export function aggregateWeekly(
  dailyResults,
  fteHours
) {
  const weekHours =
    Number(fteHours);

  if (
    !Number.isFinite(weekHours) ||
    weekHours <= 0
  ) {
    throw new Error(
      `Invalid weekly FTE hours: ${String(
        fteHours
      )}`
    );
  }

  const totals = dailyResults.reduce(
    (accumulator, day) => {
      accumulator.hours_productive +=
        day.totals.hours_productive;

      accumulator.hours_inCenter +=
        day.totals.hours_inCenter;

      accumulator.hours_gross +=
        day.totals.hours_gross;

      return accumulator;
    },
    {
      hours_productive: 0,
      hours_inCenter: 0,
      hours_gross: 0,
    }
  );

  return {
    productiveFTE:
      totals.hours_productive /
      weekHours,

    inCenterFTE:
      totals.hours_inCenter /
      weekHours,

    grossFTE:
      totals.hours_gross /
      weekHours,

    hours_productive:
      totals.hours_productive,

    hours_inCenter:
      totals.hours_inCenter,

    hours_gross:
      totals.hours_gross,
  };
}

// ============================================
// BLENDING
// ============================================

export function calculateBlendAvailability(
  channelConfig,
  intervalResult,
  blendOccTarget = 90
) {
  if (
    !isErlangCModel(
      channelConfig?.model
    )
  ) {
    return 0;
  }

  if (
    !intervalResult ||
    intervalResult.productive <= 0
  ) {
    return 0;
  }

  const actualOccupancy =
    toFiniteNumber(
      intervalResult.occupancy,
      0
    );

  const targetOccupancy =
    toPositiveNumber(
      blendOccTarget,
      90
    );

  if (
    actualOccupancy >=
    targetOccupancy
  ) {
    return 0;
  }

  const intervalHours =
    intervalResult.hours_productive /
    intervalResult.productive;

  // Available staffed hours before reaching
  // the target occupancy.
  const blendHours =
    intervalResult.productive *
    intervalHours *
    (
      (
        targetOccupancy -
        actualOccupancy
      ) /
      targetOccupancy
    );

  return Math.max(
    0,
    blendHours
  );
}

function recalculateDayTotals(dayResult) {
  const totals = (dayResult.intervals || []).reduce(
    (accumulator, interval) => {
      accumulator.productive +=
        toFiniteNumber(interval.productive, 0);

      accumulator.inCenter +=
        toFiniteNumber(interval.inCenter, 0);

      accumulator.gross +=
        toFiniteNumber(interval.gross, 0);

      accumulator.hours_productive +=
        toFiniteNumber(
          interval.hours_productive,
          0
        );

      accumulator.hours_inCenter +=
        toFiniteNumber(
          interval.hours_inCenter,
          0
        );

      accumulator.hours_gross +=
        toFiniteNumber(
          interval.hours_gross,
          0
        );

      accumulator.blendHours +=
        toFiniteNumber(
          interval.blendHours,
          0
        );

      accumulator.blendHoursReceived +=
        toFiniteNumber(
          interval.blendHoursReceived,
          0
        );

      return accumulator;
    },
    {
      productive: 0,
      inCenter: 0,
      gross: 0,
      hours_productive: 0,
      hours_inCenter: 0,
      hours_gross: 0,
      blendHours: 0,
      blendHoursReceived: 0,
    }
  );

  return {
    ...dayResult,
    totals,
  };
}

function parseBlendAllocationKey(allocationKey) {
    const parts = String(allocationKey)
      .split(/\u2192|->|\u00e2\u2020\u2019/)
      .map((part) => part.trim());

    if (parts.length !== 2) {
      return [null, null];
    }

    return parts;
  }

function normalizeBlendAllocations(allocations) {
  if (
    !allocations ||
    typeof allocations !== "object" ||
    Array.isArray(allocations)
  ) {
    return [];
  }

  

  return Object.entries(allocations)
    .map(([allocationKey, requestedHours]) => {
      const [sourceKey, destinationKey] =
        parseBlendAllocationKey(allocationKey);

      return {
        allocationKey,
        sourceKey,
        destinationKey,
        requestedHours: Math.max(
          0,
          toFiniteNumber(requestedHours, 0)
        ),
      };
    })
    .filter(
      (allocation) =>
        allocation.sourceKey &&
        allocation.destinationKey &&
        allocation.sourceKey !==
          allocation.destinationKey &&
        allocation.requestedHours > 0
    );
}

export function applyBlendingPlan({
  channelResults,
  channelsConfig,
  blendingPlan,
}) {
  const occupancyTarget =
    toPositiveNumber(
      blendingPlan?.occupancyTarget,
      90
    );

  const requestedAllocations =
    normalizeBlendAllocations(
      blendingPlan?.allocations
    );

  // Clone the baseline result before adjusting it.
  const adjustedChannelResults =
    Object.fromEntries(
      Object.entries(
        channelResults || {}
      ).map(([channelKey, days]) => [
        channelKey,
        (days || []).map((day) => ({
          ...day,
          totals: {
            ...(day.totals || {}),
          },
          intervals: (
            day.intervals || []
          ).map((interval) => ({
            ...interval,
            blendHours: 0,
            blendHoursReceived: 0,
          })),
        })),
      ])
    );

  const summary = {
    occupancyTarget,
    requestedHours: requestedAllocations.reduce(
      (total, allocation) =>
        total + allocation.requestedHours,
      0
    ),
    allocatedHours: 0,
    unallocatedHours: 0,
    allocations: {},
  };

  if (
    requestedAllocations.length === 0
  ) {
    return {
      channelResults:
        adjustedChannelResults,
      blendingSummary: summary,
    };
  }

  // Tracks source capacity already consumed at
  // each date/time combination.
  const sourceUsage = new Map();

  requestedAllocations.forEach(
    ({
      allocationKey,
      sourceKey,
      destinationKey,
      requestedHours,
    }) => {
      const sourceConfig =
        channelsConfig?.[sourceKey];

      const destinationConfig =
        channelsConfig?.[
          destinationKey
        ];

      if (
        !sourceConfig ||
        !destinationConfig ||
        !isErlangCModel(
          sourceConfig.model
        )
      ) {
        summary.unallocatedHours +=
          requestedHours;

        summary.allocations[
          allocationKey
        ] = {
          requestedHours,
          allocatedHours: 0,
          unallocatedHours:
            requestedHours,
        };

        return;
      }

      const sourceDays =
        adjustedChannelResults[
          sourceKey
        ] || [];

      const destinationDays =
        adjustedChannelResults[
          destinationKey
        ] || [];

      let remainingRequest =
        requestedHours;

      let allocatedHours = 0;

      // Allocate chronologically only where the
      // source and destination have matching
      // operating intervals.
      destinationDays.forEach(
        (destinationDay) => {
          if (remainingRequest <= 0) {
            return;
          }

          const sourceDay =
            sourceDays.find(
              (day) =>
                day.date ===
                destinationDay.date
            );

          if (!sourceDay) return;

          (
            destinationDay.intervals || []
          ).forEach(
            (destinationInterval) => {
              if (
                remainingRequest <= 0
              ) {
                return;
              }

              const sourceInterval =
                (
                  sourceDay.intervals ||
                  []
                ).find(
                  (interval) =>
                    interval.time ===
                    destinationInterval.time
                );

              if (!sourceInterval) {
                return;
              }

              const usageKey =
                `${sourceKey}|` +
                `${sourceDay.date}|` +
                `${sourceInterval.time}`;

              const alreadyUsed =
                sourceUsage.get(
                  usageKey
                ) || 0;

              const originalAvailability =
                calculateBlendAvailability(
                  sourceConfig,
                  sourceInterval,
                  occupancyTarget
                );

              const availableFromSource =
                Math.max(
                  0,
                  originalAvailability -
                    alreadyUsed
                );

              const destinationGrossHours =
                Math.max(
                  0,
                  toFiniteNumber(
                    destinationInterval
                      .hours_gross,
                    0
                  )
                );

              const intervalAllocation =
                Math.min(
                  remainingRequest,
                  availableFromSource,
                  destinationGrossHours
                );

              if (
                intervalAllocation <= 0
              ) {
                return;
              }

              sourceUsage.set(
                usageKey,
                alreadyUsed +
                  intervalAllocation
              );

              // Track capacity provided by the
              // Erlang source channel.
              sourceInterval.blendHours =
                toFiniteNumber(
                  sourceInterval.blendHours,
                  0
                ) +
                intervalAllocation;

              // Raise source occupancy toward the
              // configured blending target.
              const sourceProductiveHours =
                toFiniteNumber(
                  sourceInterval
                    .hours_productive,
                  0
                );

              if (
                sourceProductiveHours > 0
              ) {
                const occupancyIncrease =
                  (
                    intervalAllocation /
                    sourceProductiveHours
                  ) *
                  occupancyTarget;

                sourceInterval.occupancy =
                  Math.min(
                    occupancyTarget,
                    toFiniteNumber(
                      sourceInterval.occupancy,
                      0
                    ) +
                      occupancyIncrease
                  );
              }

              // Remove the allocated share from
              // all destination staffing layers,
              // preserving their shrinkage ratios.
              const remainingRatio =
                destinationGrossHours > 0
                  ? Math.max(
                      0,
                      (
                        destinationGrossHours -
                        intervalAllocation
                      ) /
                        destinationGrossHours
                    )
                  : 0;

              destinationInterval
                .productive *=
                remainingRatio;

              destinationInterval
                .inCenter *=
                remainingRatio;

              destinationInterval.gross *=
                remainingRatio;

              destinationInterval
                .hours_productive *=
                remainingRatio;

              destinationInterval
                .hours_inCenter *=
                remainingRatio;

              destinationInterval
                .hours_gross *=
                remainingRatio;

              destinationInterval
                .blendHoursReceived =
                toFiniteNumber(
                  destinationInterval
                    .blendHoursReceived,
                  0
                ) +
                intervalAllocation;

              destinationInterval
                .blendedFrom =
                Array.from(
                  new Set([
                    ...(
                      destinationInterval
                        .blendedFrom || []
                    ),
                    sourceKey,
                  ])
                );

              remainingRequest -=
                intervalAllocation;

              allocatedHours +=
                intervalAllocation;
            }
          );
        }
      );

      const unallocatedHours =
        Math.max(
          0,
          requestedHours -
            allocatedHours
        );

      summary.allocatedHours +=
        allocatedHours;

      summary.unallocatedHours +=
        unallocatedHours;

      summary.allocations[
        allocationKey
      ] = {
        sourceKey,
        destinationKey,
        requestedHours,
        allocatedHours,
        unallocatedHours,
      };
    }
  );

  // Rebuild daily totals after all interval
  // adjustments have been applied.
  Object.entries(
    adjustedChannelResults
  ).forEach(([channelKey, days]) => {
    adjustedChannelResults[
      channelKey
    ] = days.map(
      recalculateDayTotals
    );
  });

  return {
    channelResults:
      adjustedChannelResults,

    blendingSummary: summary,
  };
}

// ============================================
// FULL WEEK CALCULATION
// ============================================

export function calculateCapPlanWeek({
  channelsConfig,
  weekDates,
  forecasts,
  patterns,
  shrinkagePlan,
  intervalMinutes,
  fteHours,
  blendingPlan = null,
}) {
  const channelResults = {};
  const channelWeeklyFTE = {};

  const effectiveFteHours =
    Number(fteHours);

  if (
    !Number.isFinite(
      effectiveFteHours
    ) ||
    effectiveFteHours <= 0
  ) {
    throw new Error(
      `calculateCapPlanWeek received invalid fteHours: ${String(
        fteHours
      )}`
    );
  }

  Object.entries(
    channelsConfig || {}
  ).forEach(
    ([
      channelKey,
      channelConfig,
    ]) => {
      const channelName =
        channelConfig.name ||
        channelKey;

      const dailyResults = [];

      weekDates.forEach((date) => {
        const forecast =
          forecasts.find(
            (item) =>
              String(
                item.channel || ""
              ).toLowerCase() ===
                String(
                  channelName
                ).toLowerCase() &&
              item.date === date
          );

        const dailyVolume =
          toFiniteNumber(
            forecast?.volume,
            0
          );

        const patternIntervals =
          patterns?.[channelName]?.[
            date
          ] || null;

        const shrinkageSummary =
          shrinkagePlan?.[date] || {
            internal: 0,
            external: 0,
          };

        const dayResult =
          calculateChannelDay({
            channelConfig,
            date,
            dailyVolume,
            patternIntervals,
            shrinkagePlanSummary:
              shrinkageSummary,
            intervalMinutes,
          });

        dailyResults.push(dayResult);
      });

      channelResults[channelKey] =
        dailyResults;

    }
  );

  // Apply persisted blending after all baseline
  // channels have been calculated.
  const {
    channelResults:
      blendedChannelResults,
    blendingSummary,
  } = applyBlendingPlan({
    channelResults,
    channelsConfig,
    blendingPlan,
  });

  // Rebuild weekly values from adjusted daily and
  // interval results.
  Object.entries(
    blendedChannelResults
  ).forEach(
    ([channelKey, dailyResults]) => {
      channelWeeklyFTE[
        channelKey
      ] = aggregateWeekly(
        dailyResults,
        effectiveFteHours
      );
    }
  );

  const combinedWeeklyFTE =
    Object.values(
      channelWeeklyFTE
    ).reduce(
      (accumulator, channel) => {
        accumulator.productiveFTE +=
          channel.productiveFTE;

        accumulator.inCenterFTE +=
          channel.inCenterFTE;

        accumulator.grossFTE +=
          channel.grossFTE;

        accumulator.hours_productive +=
          channel.hours_productive;

        accumulator.hours_inCenter +=
          channel.hours_inCenter;

        accumulator.hours_gross +=
          channel.hours_gross;

        return accumulator;
      },
      {
        productiveFTE: 0,
        inCenterFTE: 0,
        grossFTE: 0,
        hours_productive: 0,
        hours_inCenter: 0,
        hours_gross: 0,
      }
    );

  return {
  engineVersion:
    CAPACITY_ENGINE_VERSION,

  channelResults:
    blendedChannelResults,

  channelWeeklyFTE,
  combinedWeeklyFTE,

  blendingPlan: {
    occupancyTarget:
      toPositiveNumber(
        blendingPlan?.occupancyTarget,
        90
      ),

    allocations: {
      ...(
        blendingPlan?.allocations ||
        {}
      ),
    },
  },

  blendingSummary,
};
}

// ============================================
// CSV EXPORT
// ============================================

export function flattenForExport(
  channelsConfig,
  channelResults
) {
  const rows = [];

  Object.entries(
    channelResults || {}
  ).forEach(
    ([
      channelKey,
      dailyResults,
    ]) => {
      const config =
        channelsConfig[channelKey];

      dailyResults.forEach((day) => {
        day.intervals.forEach(
          (interval) => {
            rows.push({
              Channel:
                config?.name ||
                channelKey,

              Model:
                config?.model ||
                "",

              Date: day.date,
              Day: day.dayName,
              Interval:
                interval.time,

              Volume:
                interval.volume,

              AHT:
                interval.aht,

              Forecast_Volume:
                interval.forecastIntervalVolume ??
                interval.volume,

              Answer_Rate_Pct:
                interval.answerRatePct,

              Target_Answered_Volume:
                interval.targetAnsweredVolume,

              Workload_Seconds:
                interval.workloadSeconds,

              Productive_Agents:
                interval.productive,

              InCenter_Agents:
                interval.inCenter,

              Gross_Agents:
                interval.gross,

              Productive_Hours:
                interval.hours_productive,

              InCenter_Hours:
                interval.hours_inCenter,

              Gross_Hours:
                interval.hours_gross,

              Occupancy_Pct:
                interval.occupancy,

              Occupancy_Before_Cap_Pct:
                interval.occupancyBeforeCap,

              Service_Level_Pct:
                interval.serviceLevel,

              Abandon_Rate_Pct:
                interval.abandonRate,

              Blend_Hours:
                interval.blendHours,

              Internal_Shrink_Pct:
                interval.internalShrinkPct,

              External_Shrink_Pct:
                interval.externalShrinkPct,

              Shrink_Source:
                interval.shrinkSource,

              Model_Constraint:
                interval.modelConstraint,

              Final_Constraint:
                interval.finalConstraint,

              Occupancy_Cap_Applied:
                interval.occupancyCapApplied,

              Agents_SL:
                interval.agentsSL,

              Agents_Abandon:
                interval.agentsAbandon,

              Agents_Occupancy:
                interval.agentsOcc,

              Erlang_Required:
                interval.erlangRequired,

              Productive_Before_Network:
                interval.productiveBeforeNetworkScaling,

              Productive_After_Network:
                interval.productiveAfterNetworkScaling,

              Network_Pct:
                interval.networkPct,

              SubServices:
                interval.subServices,

              Minimum_Required:
                interval.minRequired,
            });
          }
        );
      });
    }
  );

  return rows;
}