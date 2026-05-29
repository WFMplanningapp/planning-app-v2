export function formatDateMMDDYYYY(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export function parseFlexibleDate(str) {
  if (str instanceof Date && !isNaN(str.getTime())) return str;
  str = String(str).trim();
  if (!str) return null;

  // Excel serial number (e.g., 45658)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str);
    if (serial > 30000 && serial < 60000) {
      const d = new Date(1899, 11, 30);
      d.setDate(d.getDate() + serial);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const monthNames = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5,
    jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };

  // "Jan 6, 2025" or "January 6, 2025"
  let m = str.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = monthNames[m[1].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(parseInt(m[3]), mon, parseInt(m[2]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // "6 Jan 2025" or "06 January 2025"
  m = str.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (m) {
    const mon = monthNames[m[2].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(parseInt(m[3]), mon, parseInt(m[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // "2025-Jan-06"
  m = str.match(/^(\d{4})[-\/]([a-zA-Z]+)[-\/](\d{1,2})$/);
  if (m) {
    const mon = monthNames[m[2].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(parseInt(m[1]), mon, parseInt(m[3]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD
  m = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // MM-DD-YYYY or MM/DD/YYYY
  m = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // DD-MM-YYYY fallback (if day > 12)
  m = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m && parseInt(m[1]) > 12) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Last resort
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}