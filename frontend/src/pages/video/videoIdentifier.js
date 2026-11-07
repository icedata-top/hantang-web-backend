// 与后端 BilibiliUtils 的 51 位 BV/AV 转换保持一致。
// JavaScript 的普通位运算只有 32 位，整个转换使用 BigInt，并以字符串传递 aid。
const BV_ALPHABET = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';
const BV_DIGITS = new Map([...BV_ALPHABET].map((character, index) => [character, BigInt(index)]));
const BV_PATTERN = /^BV1[1-9A-HJ-NP-Za-km-z]{9}$/;
const AID_PATTERN = /^[1-9]\d*$/;
const MASK = (1n << 51n) - 1n;
const XOR = 23442827791579n;
const MAX_API_AID = '9223372036854775807';

function bvToAid(bvid) {
  const characters = [...bvid];
  [characters[3], characters[9]] = [characters[9], characters[3]];
  [characters[4], characters[7]] = [characters[7], characters[4]];

  let value = 0n;
  for (const character of characters.slice(3)) {
    value = value * 58n + BV_DIGITS.get(character);
  }
  return ((value & MASK) ^ XOR).toString();
}

/**
 * 仅解析格式与 aid，不判断视频是否存在或是否收录。
 * @returns {{ status: 'invalid' | 'unavailable' } | { status: 'valid', aid: string }}
 */
export function parseVideoIdentifier(identifier) {
  if (typeof identifier !== 'string') return { status: 'invalid' };

  let aid;
  if (AID_PATTERN.test(identifier)) {
    aid = identifier;
  } else if (BV_PATTERN.test(identifier)) {
    aid = bvToAid(identifier);
  } else {
    return { status: 'invalid' };
  }

  // 格式合法但不能对应 API 可收录的正 64 位 aid，仍归入“未找到”，不误报格式错误。
  if (aid === '0' || aid.length > MAX_API_AID.length
    || (aid.length === MAX_API_AID.length && aid > MAX_API_AID)) {
    return { status: 'unavailable' };
  }
  return { status: 'valid', aid };
}
