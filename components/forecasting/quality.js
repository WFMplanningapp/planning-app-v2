import { formatDateMMDDYYYY } from "./dateUtils";

export function analyzeQuality(rawData) {
  const n = rawData.length;
  const volumes = rawData.map((r) => r.volume);
  const dates = rawData.map((r) => r.date);
  const mean = volumes.reduce((a, b) => a + b, 0) / n;
  const sorted = volumes.slice().sort((a, b) => a - b);
  const std = Math.sqrt(volumes.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n);
  const cv = (std / mean) * 100;
  const spanDays = Math.round((dates[n - 1] - dates[0]) / 86400000) + 1;
  const weeks = (spanDays / 7).toFixed(1);
  let gaps = [], missingDays = 0;
  for (let i = 1; i < n; i++) {
    const diff = Math.round((dates[i] - dates[i - 1]) / 86400000);
    if (diff > 1) { gaps.push({ after: dates[i - 1], days: diff }); missingDays += diff - 1; }
  }
  const dateSet = new Set(dates.map((d) => formatDateMMDDYYYY(d)));
  const duplicates = n - dateSet.size;
  const zeros = volumes.filter((v) => v === 0).length;
  const negatives = volumes.filter((v) => v < 0).length;
  const q1 = sorted[Math.floor(n * 0.25)], q3 = sorted[Math.floor(n * 0.75)], iqr = q3 - q1;
  const outlierLow = q1 - 1.5 * iqr, outlierHigh = q3 + 1.5 * iqr;
  const outliers = volumes.filter((v) => v < outlierLow || v > outlierHigh).length;
  let hasWeeklyPattern = false;
  if (n >= 14) {
    const dowMeans = {};
    rawData.forEach((r) => { const dow = r.date.getDay(); if (!dowMeans[dow]) dowMeans[dow] = []; dowMeans[dow].push(r.volume); });
    const dowAvgs = Object.values(dowMeans).map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
    hasWeeklyPattern = Math.max(...dowAvgs) - Math.min(...dowAvgs) > mean * 0.1;
  }
  let xMean = (n - 1) / 2, num = 0, den = 0;
  volumes.forEach((v, i) => { num += (i - xMean) * (v - mean); den += Math.pow(i - xMean, 2); });
  const trendSlope = den !== 0 ? num / den : 0;
  let rollingStability = "N/A";
  if (n >= 14) {
    const rMeans = [];
    for (let i = 0; i <= n - 7; i++) rMeans.push(volumes.slice(i, i + 7).reduce((a, b) => a + b, 0) / 7);
    const rmMean = rMeans.reduce((a, b) => a + b, 0) / rMeans.length;
    const rmStd = Math.sqrt(rMeans.reduce((s, v) => s + Math.pow(v - rmMean, 2), 0) / rMeans.length);
    rollingStability = (rmStd / rmMean) * 100 < 10 ? "Stable" : (rmStd / rmMean) * 100 < 25 ? "Moderate" : "Volatile";
  }
  let score = 100;
  if (n < 14) score -= 25; else if (n < 28) score -= 10;
  if (missingDays > n * 0.2) score -= 20; else if (missingDays > 0) score -= Math.min(15, missingDays * 2);
  if (duplicates > 0) score -= Math.min(10, duplicates * 3);
  if (zeros > n * 0.1) score -= 10;
  if (negatives > 0) score -= 15;
  if (outliers > n * 0.15) score -= 15; else if (outliers > 0) score -= outliers * 2;
  if (cv > 60) score -= 10;
  score = Math.max(0, Math.min(100, score));
  const quality = score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";
  return { n, mean, std, cv, spanDays, weeks, gaps, missingDays, duplicates, zeros, negatives, outliers, outlierLow, outlierHigh, hasWeeklyPattern, trendSlope, rollingStability, score, quality };
}

export function getQualityIssues(r) {
  const issues = [];
  if (r.n < 14) issues.push({ t: "error", m: `Only ${r.n} data points. Min 14 recommended.` });
  else if (r.n < 28) issues.push({ t: "warning", m: `${r.n} points (${r.weeks} weeks). 4-8+ weeks recommended.` });
  else issues.push({ t: "good", m: `${r.n} data points spanning ${r.weeks} weeks — solid.` });
  if (r.missingDays > 0) issues.push({ t: r.missingDays > r.n * 0.15 ? "error" : "warning", m: `${r.missingDays} missing day(s). Fill gaps for better accuracy.` });
  else issues.push({ t: "good", m: "No gaps — continuous daily data." });
  if (r.duplicates > 0) issues.push({ t: "warning", m: `${r.duplicates} duplicate date(s).` });
  if (r.negatives > 0) issues.push({ t: "error", m: `${r.negatives} negative value(s).` });
  if (r.zeros > 0) issues.push({ t: r.zeros > r.n * 0.1 ? "warning" : "info", m: `${r.zeros} zero-volume day(s).` });
  if (r.outliers > 0) issues.push({ t: "info", m: `${r.outliers} outlier(s) detected.` });
  if (r.cv > 50) issues.push({ t: "warning", m: `High variability (CV: ${r.cv.toFixed(1)}%).` });
  if (r.hasWeeklyPattern) issues.push({ t: "good", m: "Weekly pattern detected — seasonal models should work well." });
  else if (r.n >= 14) issues.push({ t: "info", m: "No weekly seasonality detected." });
  return issues;
}

export function detectZeroDays(rawData) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dowStats = {};
  for (let d = 0; d < 7; d++) dowStats[d] = { total: 0, zeros: 0, values: [] };
  rawData.forEach((r) => { const dow = r.date.getDay(); dowStats[dow].total++; dowStats[dow].values.push(r.volume); if (r.volume === 0) dowStats[dow].zeros++; });
  const zeroDows = new Set(), warnings = [];
  for (let d = 0; d < 7; d++) {
    const st = dowStats[d];
    if (st.total < 2) continue;
    const zr = st.zeros / st.total;
    if (zr === 1.0 && st.total >= 3) zeroDows.add(d);
    else if (zr === 1.0 && st.total < 3) warnings.push(`${dayNames[d]}: always zero but only ${st.total} occurrence(s).`);
    else if (zr >= 0.5 && st.zeros >= 2) {
      const nza = st.values.filter((v) => v > 0);
      const avg = nza.length > 0 ? (nza.reduce((a, b) => a + b, 0) / nza.length).toFixed(0) : 0;
      warnings.push(`${dayNames[d]}: zero ${(zr * 100).toFixed(0)}% (${st.zeros}/${st.total}), avg non-zero: ${avg}. Likely occasional.`);
    }
  }
  return { structural: Array.from(zeroDows).map((d) => dayNames[d]), zeroDows, warnings };
}