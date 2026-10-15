/**
 * 公共数字格式化
 *
 * @typedef {'zh' | 'en' | 'comma'} NumberFormatStyle
 *
 * - comma：千分位逗号（三位一组）
 * - zh：中文量级（万 / 亿 / 万亿），近似四舍五入
 * - en：英文量级（K / M / B / T），近似四舍五入，最多三个有效数字
 *
 * 中文有效数字：整数部分恰好为 4 位或 8 位时用 4 个有效数字，其余用 3 个。
 * 舍入：基于 Number#toPrecision（IEEE 754 近似四舍五入）。
 */

/** @type {Readonly<{ ZH: 'zh', EN: 'en', COMMA: 'comma' }>} */
export const NUMBER_FORMAT = Object.freeze({
  ZH: 'zh',
  EN: 'en',
  COMMA: 'comma',
});

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toFiniteNumber(value) {
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 绝对值整数部分的十进制位数（0 → 1）
 * @param {number} value
 */
function countIntegerDigits(value) {
  const absInt = Math.floor(Math.abs(value));
  if (absInt === 0) return 1;
  return String(absInt).length;
}

/**
 * 将数值格式化为指定有效数字个数（不使用科学计数法字符串）
 * @param {number} value 非负
 * @param {number} sigFigs
 */
function formatSignificant(value, sigFigs) {
  if (value === 0) return '0';

  const rounded = Number(value.toPrecision(sigFigs));
  if (rounded === 0) return '0';

  const order = Math.floor(Math.log10(rounded));
  const decimals = Math.max(0, sigFigs - order - 1);
  let text = rounded.toFixed(decimals);

  if (text.includes('.')) {
    text = text.replace(/\.?0+$/, '');
  }
  return text;
}

/**
 * @param {number} value
 * @param {number} sigFigs
 * @param {string} unit
 */
function formatScaled(value, sigFigs, unit) {
  const sign = value < 0 ? '-' : '';
  return `${sign}${formatSignificant(Math.abs(value), sigFigs)}${unit}`;
}

/**
 * 中文：万 / 亿 / 万亿
 * @param {number} value
 */
function formatZh(value) {
  const abs = Math.abs(value);
  const sigFigs = countIntegerDigits(value) === 4 || countIntegerDigits(value) === 8 ? 4 : 3;

  if (abs < 1e4) {
    return formatScaled(value, sigFigs, '');
  }
  if (abs < 1e8) {
    return formatScaled(value / 1e4, sigFigs, '万');
  }
  if (abs < 1e12) {
    return formatScaled(value / 1e8, sigFigs, '亿');
  }
  return formatScaled(value / 1e12, sigFigs, '万亿');
}

/**
 * 英文：K / M / B / T，始终最多 3 个有效数字
 * @param {number} value
 */
function formatEn(value) {
  const abs = Math.abs(value);
  const sigFigs = 3;

  if (abs < 1e3) {
    return formatScaled(value, sigFigs, '');
  }
  if (abs < 1e6) {
    return formatScaled(value / 1e3, sigFigs, 'K');
  }
  if (abs < 1e9) {
    return formatScaled(value / 1e6, sigFigs, 'M');
  }
  if (abs < 1e12) {
    return formatScaled(value / 1e9, sigFigs, 'B');
  }
  return formatScaled(value / 1e12, sigFigs, 'T');
}

/**
 * 千分位逗号
 * @param {number} value
 */
function formatComma(value) {
  return value.toLocaleString('en-US');
}

/**
 * 数字格式化
 *
 * @param {unknown} value 数字本体
 * @param {NumberFormatStyle} format `'zh' | 'en' | 'comma'`
 * @returns {string}
 *
 * @example
 * formatNumber(123, 'zh')      // '123'
 * formatNumber(12345, 'zh')    // '1.23万'
 * formatNumber(123456, 'zh')   // '12.3万'
 * formatNumber(1234, 'zh')     // '1234'（四位数 → 4 个有效数字）
 * formatNumber(12345678, 'zh') // '1235万'（八位数 → 4 个有效数字）
 * formatNumber(1230, 'en')     // '1.23K'
 * formatNumber(1234567, 'comma') // '1,234,567'
 */
export function formatNumber(value, format = NUMBER_FORMAT.COMMA) {
  const n = toFiniteNumber(value);
  if (n === null) {
    return value == null || value === '' ? '' : String(value);
  }

  switch (format) {
    case NUMBER_FORMAT.ZH:
    case 'zh':
      return formatZh(n);
    case NUMBER_FORMAT.EN:
    case 'en':
      return formatEn(n);
    case NUMBER_FORMAT.COMMA:
    case 'comma':
      return formatComma(n);
    default:
      return formatComma(n);
  }
}

export default formatNumber;
