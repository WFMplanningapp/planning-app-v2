export const MODEL_DEFS = [
  { key: "naive", name: "Naive (Last Value)", desc: "Uses last observed value for all future periods." },
  { key: "ma", name: "Simple Moving Average", desc: "Averages last 7 days." },
  { key: "wma", name: "Weighted Moving Average", desc: "Recent days weighted higher (7-day window)." },
  { key: "ema", name: "Exponential Smoothing (SES)", desc: "Exponentially decays older values. Alpha optimized." },
  { key: "holt", name: "Holt Linear Trend", desc: "Exponential smoothing with trend." },
  { key: "hw", name: "Holt-Winters Seasonal", desc: "Triple smoothing with weekly seasonality." },
  { key: "lr", name: "Linear Regression", desc: "Fits y = a + bx." },
  { key: "drift", name: "Drift Method", desc: "Extends first-to-last line." },
];

export const MODEL_COLORS = {
  naive: "#ff8d96",
  ma: "#f9ef77",
  wma: "#bfa1ff",
  ema: "#8bf0bb",
  holt: "#4bf9b0",
  hw: "#f97bf9",
  lr: "#77c8f9",
  drift: "#f9a84b",
};

function sdiv(num, den) {
  return den !== 0 && isFinite(den) ? num / den : 0;
}

function runModelNaive(trainVols, testVols, vols, n, holdout, horizon) {
  const last = trainVols[trainVols.length - 1];
  return { testPred: testVols.map(() => last), futurePred: Array(horizon).fill(vols[n - 1]) };
}

function runModelMA(trainVols, testVols, vols, n, holdout, horizon) {
  const w = Math.min(7, trainVols.length);
  let testPred = [], buf = trainVols.slice();
  for (let i = 0; i < holdout; i++) { testPred.push(buf.slice(-w).reduce((a, b) => a + b, 0) / w); buf.push(testVols[i]); }
  let futurePred = [], fbuf = vols.slice();
  for (let j = 0; j < horizon; j++) { const avg = fbuf.slice(-w).reduce((a, b) => a + b, 0) / w; futurePred.push(avg); fbuf.push(avg); }
  return { testPred, futurePred };
}

function runModelWMA(trainVols, testVols, vols, n, holdout, horizon) {
  const w = Math.min(7, trainVols.length);
  let weights = [], wSum = 0;
  for (let k = 0; k < w; k++) { weights.push(k + 1); wSum += k + 1; }
  function wma(arr) { const sl = arr.slice(-w); let s = 0; for (let i = 0; i < sl.length; i++) s += sl[i] * weights[i]; return s / wSum; }
  let testPred = [], buf = trainVols.slice();
  for (let i = 0; i < holdout; i++) { testPred.push(wma(buf)); buf.push(testVols[i]); }
  let futurePred = [], fbuf = vols.slice();
  for (let j = 0; j < horizon; j++) { const v = wma(fbuf); futurePred.push(v); fbuf.push(v); }
  return { testPred, futurePred };
}

function runModelEMA(trainVols, testVols, vols, n, holdout, horizon) {
  const trainN = trainVols.length;
  let bestAlpha = 0.3, bestSSE = Infinity;
  for (let a = 0.05; a <= 0.95; a += 0.05) {
    let s = trainVols[0], sse = 0;
    for (let i = 1; i < trainN; i++) { s = a * trainVols[i - 1] + (1 - a) * s; sse += Math.pow(trainVols[i] - s, 2); }
    if (sse < bestSSE) { bestSSE = sse; bestAlpha = a; }
  }
  let level = trainVols[0];
  for (let i = 1; i < trainN; i++) level = bestAlpha * trainVols[i] + (1 - bestAlpha) * level;
  let testPred = [], lev = level;
  for (let j = 0; j < holdout; j++) { testPred.push(lev); lev = bestAlpha * testVols[j] + (1 - bestAlpha) * lev; }
  level = vols[0];
  for (let i = 1; i < n; i++) level = bestAlpha * vols[i] + (1 - bestAlpha) * level;
  return { testPred, futurePred: Array(horizon).fill(level), params: { alpha: bestAlpha.toFixed(2) } };
}

function runModelHolt(trainVols, testVols, vols, n, holdout, horizon) {
  const trainN = trainVols.length;
  let bestA = 0.3, bestB = 0.1, bestSSE = Infinity;
  for (let a = 0.1; a <= 0.9; a += 0.1) {
    for (let b = 0.01; b <= 0.5; b += 0.05) {
      let l = trainVols[0], t = trainVols[1] - trainVols[0], sse = 0;
      for (let i = 1; i < trainN; i++) { sse += Math.pow(trainVols[i] - (l + t), 2); const nl = a * trainVols[i] + (1 - a) * (l + t); t = b * (nl - l) + (1 - b) * t; l = nl; }
      if (sse < bestSSE) { bestSSE = sse; bestA = a; bestB = b; }
    }
  }
  let l = trainVols[0], t = trainVols[1] - trainVols[0];
  for (let i = 1; i < trainN; i++) { const nl = bestA * trainVols[i] + (1 - bestA) * (l + t); t = bestB * (nl - l) + (1 - bestB) * t; l = nl; }
  let testPred = [], l2 = l, t2 = t;
  for (let j = 0; j < holdout; j++) { testPred.push(l2 + t2); const nl = bestA * testVols[j] + (1 - bestA) * (l2 + t2); t2 = bestB * (nl - l2) + (1 - bestB) * t2; l2 = nl; }
  l = vols[0]; t = vols[1] - vols[0];
  for (let i = 1; i < n; i++) { const nl = bestA * vols[i] + (1 - bestA) * (l + t); t = bestB * (nl - l) + (1 - bestB) * t; l = nl; }
  let futurePred = [];
  for (let k = 1; k <= horizon; k++) futurePred.push(l + t * k);
  return { testPred, futurePred, params: { alpha: bestA.toFixed(2), beta: bestB.toFixed(2) } };
}

function runModelHW(trainVols, testVols, vols, n, holdout, horizon) {
  const trainN = trainVols.length, sp = 7;
  if (trainN < sp * 2) return { testPred: Array(holdout).fill(trainVols[trainN - 1]), futurePred: Array(horizon).fill(vols[n - 1]), params: { note: "Need 14+ days" } };
  const fs = trainVols.slice(0, sp), ss = trainVols.slice(sp, sp * 2);
  const l0 = fs.reduce((a, b) => a + b, 0) / sp;
  const t0 = l0 !== 0 ? (ss.reduce((a, b) => a + b, 0) / sp - l0) / sp : 0;
  const s0 = fs.map((v) => (l0 !== 0 ? v / l0 : 0));
  let bestA = 0.3, bestB = 0.05, bestG = 0.3, bestSSE = Infinity;
  for (let a = 0.1; a <= 0.8; a += 0.15) for (let b = 0.01; b <= 0.3; b += 0.07) for (let g = 0.05; g <= 0.5; g += 0.1) {
    let l = l0, t = t0, si = s0.slice(), sse = 0, valid = true;
    for (let i = sp; i < trainN; i++) { const sIdx = i % sp; sse += Math.pow(trainVols[i] - (l + t) * si[sIdx], 2); if (!isFinite(sse)) { valid = false; break; } const nl = a * sdiv(trainVols[i], si[sIdx]) + (1 - a) * (l + t); const nt = b * (nl - l) + (1 - b) * t; si[sIdx] = g * sdiv(trainVols[i], nl) + (1 - g) * si[sIdx]; l = nl; t = nt; }
    if (valid && sse < bestSSE) { bestSSE = sse; bestA = a; bestB = b; bestG = g; }
  }
  let l = l0, t = t0, si = s0.slice();
  for (let i = sp; i < trainN; i++) { const sIdx = i % sp; const nl = bestA * sdiv(trainVols[i], si[sIdx]) + (1 - bestA) * (l + t); const nt = bestB * (nl - l) + (1 - bestB) * t; si[sIdx] = bestG * sdiv(trainVols[i], nl) + (1 - bestG) * si[sIdx]; l = nl; t = nt; }
  let testPred = [], l3 = l, t3 = t, si3 = si.slice();
  for (let j = 0; j < holdout; j++) { const sIdx = (trainN + j) % sp; const pred = (l3 + t3) * si3[sIdx]; testPred.push(isFinite(pred) ? pred : 0); const nl = bestA * sdiv(testVols[j], si3[sIdx]) + (1 - bestA) * (l3 + t3); const nt = bestB * (nl - l3) + (1 - bestB) * t3; si3[sIdx] = bestG * sdiv(testVols[j], nl) + (1 - bestG) * si3[sIdx]; l3 = nl; t3 = nt; }
  l = l0; t = t0; let siFull = s0.slice();
  for (let i = sp; i < n; i++) { const sIdx = i % sp; const nl = bestA * sdiv(vols[i], siFull[sIdx]) + (1 - bestA) * (l + t); const nt = bestB * (nl - l) + (1 - bestB) * t; siFull[sIdx] = bestG * sdiv(vols[i], nl) + (1 - bestG) * siFull[sIdx]; l = nl; t = nt; }
  let futurePred = [];
  for (let k = 1; k <= horizon; k++) { const sIdx = (n + k - 1) % sp; const p = (l + t * k) * siFull[sIdx]; futurePred.push(isFinite(p) ? p : 0); }
  return { testPred, futurePred, params: { alpha: bestA.toFixed(2), beta: bestB.toFixed(2), gamma: bestG.toFixed(2) } };
}

function runModelLR(trainVols, testVols, vols, n, holdout, horizon) {
  const trainN = trainVols.length;
  const xM = (trainN - 1) / 2, yM = trainVols.reduce((a, b) => a + b, 0) / trainN;
  let num = 0, den = 0;
  trainVols.forEach((v, i) => { num += (i - xM) * (v - yM); den += Math.pow(i - xM, 2); });
  const slope = den ? num / den : 0, intercept = yM - slope * xM;
  const testPred = testVols.map((_, i) => intercept + slope * (trainN + i));
  const fxM = (n - 1) / 2, fyM = vols.reduce((a, b) => a + b, 0) / n;
  let fn = 0, fd = 0;
  vols.forEach((v, i) => { fn += (i - fxM) * (v - fyM); fd += Math.pow(i - fxM, 2); });
  const fSlope = fd ? fn / fd : 0, fInt = fyM - fSlope * fxM;
  let futurePred = [];
  for (let i = 0; i < horizon; i++) futurePred.push(fInt + fSlope * (n + i));
  return { testPred, futurePred, params: { slope: fSlope.toFixed(2), intercept: fInt.toFixed(0) } };
}

function runModelDrift(trainVols, testVols, vols, n, holdout, horizon) {
  const trainN = trainVols.length;
  const drift = (trainVols[trainN - 1] - trainVols[0]) / (trainN - 1);
  const testPred = testVols.map((_, i) => trainVols[trainN - 1] + drift * (i + 1));
  const fDrift = (vols[n - 1] - vols[0]) / (n - 1);
  let futurePred = [];
  for (let i = 1; i <= horizon; i++) futurePred.push(vols[n - 1] + fDrift * i);
  return { testPred, futurePred, params: { daily_drift: fDrift.toFixed(2) } };
}

export const MODEL_RUNNERS = {
  naive: runModelNaive,
  ma: runModelMA,
  wma: runModelWMA,
  ema: runModelEMA,
  holt: runModelHolt,
  hw: runModelHW,
  lr: runModelLR,
  drift: runModelDrift,
};