export function calcMetrics(actual, predicted) {
  const m = Math.min(actual.length, predicted.length);
  let ae = 0, se = 0, ape = 0, apeCount = 0, dirOk = 0, aeNZ = 0, seNZ = 0, nzCount = 0;
  for (let i = 0; i < m; i++) {
    const a = actual[i], p = predicted[i], e = a - p;
    ae += Math.abs(e);
    se += e * e;
    if (a !== 0 && !isNaN(a) && !isNaN(p)) {
      ape += Math.abs(e / a);
      apeCount++;
      aeNZ += Math.abs(e);
      seNZ += e * e;
      nzCount++;
    }
    if (i > 0 && (actual[i] - actual[i - 1] >= 0) === (predicted[i] - predicted[i - 1] >= 0)) dirOk++;
  }
  const sumActual = actual.slice(0, m).reduce((s, v) => s + Math.abs(v), 0);
  return {
    mae: nzCount > 0 ? aeNZ / nzCount : m > 0 ? ae / m : 0,
    rmse: nzCount > 0 ? Math.sqrt(seNZ / nzCount) : m > 0 ? Math.sqrt(se / m) : 0,
    mape: apeCount > 0 ? (ape / apeCount) * 100 : 0,
    wmape: sumActual > 0 ? (ae / sumActual) * 100 : 0,
    dirAcc: m > 1 ? (dirOk / (m - 1)) * 100 : 0,
    residuals: actual.map((a, i) => (i < predicted.length ? a - predicted[i] : 0)),
  };
}

export function getCI(residuals, zLevel) {
  const z = zLevel >= 0.95 ? 1.96 : zLevel >= 0.9 ? 1.645 : 1.28;
  const resStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
  return (idx) => z * resStd * Math.sqrt(1 + idx * 0.05);
}