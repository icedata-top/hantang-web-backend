export const RELATIVE_TIME_MODES = Object.freeze({
  ABSOLUTE: 'absolute',
  RELATIVE: 'relative',
  ABSOLUTE_DIFF: 'absolute-diff',
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const BEIJING_OFFSET = 8 * HOUR;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(Z|[+-]\d{2}:?\d{2})?$/i;

/** Seconds since Unix epoch, or a date string. Unzoned strings use UTC+8. */
export function parseTime(value) {
  if (typeof value === 'number') {
    const milliseconds = value * SECOND;
    return Number.isFinite(milliseconds) && Number.isFinite(new Date(milliseconds).getTime()) ? milliseconds : null;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return parseTime(Number(text));
  const match = text.match(DATE_PATTERN);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, zone] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText ?? 0, minuteText ?? 0, secondText ?? 0].map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59 || (zone && hourText == null)) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, Number((fractionText ?? '').padEnd(3, '0')));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  let offset = BEIJING_OFFSET;
  if (zone?.toUpperCase() === 'Z') offset = 0;
  else if (zone) {
    const digits = zone.slice(1).replace(':', '');
    const zoneHour = Number(digits.slice(0, 2));
    const zoneMinute = Number(digits.slice(2));
    if (zoneHour > 23 || zoneMinute > 59) return null;
    offset = (zoneHour * HOUR + zoneMinute * MINUTE) * (zone[0] === '+' ? 1 : -1);
  }
  return date.getTime() - offset;
}

function parts(milliseconds) {
  const date = new Date(milliseconds + BEIJING_OFFSET);
  if (!Number.isFinite(date.getTime())) return null;
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getUTCFullYear();
  const monthDay = `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const clock = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  return { year, monthDay, clock, date: `${String(year).padStart(4, '0')}-${monthDay}` };
}

function relativeLabel(timestamp, now, isZh, target, current) {
  const future = timestamp > now;
  const difference = Math.abs(timestamp - now);
  if (difference <= 120 * SECOND) return future ? (isZh ? '马上' : 'In a moment') : (isZh ? '刚才' : 'Just now');
  if (difference < HOUR) {
    const minutes = Math.floor(difference / MINUTE);
    return isZh ? `${minutes}分钟${future ? '后' : '前'}` : future
      ? `In ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
      : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  const dayDifference = Math.floor((timestamp + BEIJING_OFFSET) / DAY) - Math.floor((now + BEIJING_OFFSET) / DAY);
  const dayNames = isZh
    ? { '-2': '前天', '-1': '昨天', 0: '今天', 1: '明天', 2: '后天' }
    : { '-1': 'Yesterday', 0: 'Today', 1: 'Tomorrow' };
  if (dayNames[dayDifference]) return `${dayNames[dayDifference]} ${target.clock}`;
  return target.year === current.year ? target.monthDay : target.date;
}

/** Pure formatter; now is milliseconds and is supplied once by the React component. */
export function getRelativeTimeDetails(value, now, language = 'zh') {
  const timestamp = parseTime(value);
  if (timestamp == null || !Number.isFinite(now)) return null;
  const target = parts(timestamp);
  const current = parts(now);
  if (!target || !current) return null;
  const isZh = String(language).toLowerCase().startsWith('zh');
  const future = timestamp > now;
  const totalHours = Math.floor(Math.abs(timestamp - now) / HOUR);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dayDifference = isZh ? `${days}天${future ? '后' : '前'}`
    : future ? `in ${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'day' : 'days'} ago`;
  const absolute = `${target.date} ${target.clock}`;
  return {
    absolute,
    relative: relativeLabel(timestamp, now, isZh, target, current),
    absoluteDiff: isZh ? `${absolute} （${dayDifference}）` : `${absolute} (${dayDifference})`,
    distance: isZh ? `${days}天${hours}小时` : `${days} ${days === 1 ? 'day' : 'days'} ${hours} ${hours === 1 ? 'hour' : 'hours'}`,
    unix: Math.floor(timestamp / SECOND),
    iso: new Date(timestamp).toISOString(),
  };
}

export function getRelativeTimeText(details, mode = RELATIVE_TIME_MODES.RELATIVE) {
  if (!details) return '—';
  if (mode === RELATIVE_TIME_MODES.ABSOLUTE) return details.absolute;
  if (mode === RELATIVE_TIME_MODES.ABSOLUTE_DIFF) return details.absoluteDiff;
  return details.relative;
}
