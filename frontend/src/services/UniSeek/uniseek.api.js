import { isMockEnv } from '../../config/runtimeEnv.js';
import { postJson } from '../http/client.js';

/**
 * SeekItem 元素统一契约（草案）
 *
 * 所有类型都必须有同样的公共字段：
 * - type: 'video' | 'vocal' | 'producer'
 * - id: string | number
 * - title: string
 * - subTitle: string
 * - score?: number
 * - coverUrl?: string
 * - jumpUrl?: string
 * - payload: object        // 类型差异化字段统一放在 payload 内
 *
 * payload 示例：
 * - video: { bvid, play, favorite, like, coin, publishDate, durationSec, producerId, vocalIdList }
 * - vocal: { alias, songCount, representativeWorks }
 * - producer: { uid, fanCount, totalView, videoCount, recentWork }
 */

const MOCK_VIDEO_ROWS = [
  ['2129461', '洛天依，言和原创《普通DISCO》', 23846425],
  ['43426592', '洛天依，原创《勾指起誓》', 21424491],
  ['3905462', '【2016拜年祭单品】九九八十一【乐正绫 feat.洛天依】', 17223617],
  ['9372087', '洛天依，言和原创《达拉崩吧》', 15596882],
  ['285205499', '【洛天依原创】我的悲伤是水做的', 10746151],
  ['39718511', '【洛天依|薛之谦】江苏卫视2019跨年演唱会《达拉崩吧》', 7419684],
  ['2251501', '【首发】《东京不太热》 - 洛天依', 7101648],
  ['1971745', '洛天依，言和原创《阴阳先生》', 7049164],
  ['21551703', '【洛天依原创曲】绝体绝命【PV付】', 6555660],
  ['938641073', '洛天依 原创《白鸟过河滩》', 6531786],
  ['7400996', '洛天依，言和原创《深夜诗人》', 6336409],
  ['678659054', '【洛天依】《Time to Shine》——北京冬奥会文化节开幕式', 6333166],
  ['24929108', '【首发】黑凤梨 - 洛天依【Z新豪】', 6254554],
  ['3060153', '【洛天依/乐正绫原创】霜雪千年【PV付/COP】', 6200610],
  ['625038011', '【洛天依】饭圈小姐', 6166269],
  ['113139018439424', '【洛天依】除了青龙白虎，上古六大神兽还有哪些？', 5750048],
  ['114550502396425', '【官方投稿】Chinozo「武装乙女」feat.洛天依', 5712042],
  ['928296531', '洛天依《夜航星》走进震撼又感动的英雄史诗', 5581761],
  ['1844227', '洛天依，言和《神经病之歌》', 5317959],
  ['1105478567', '【洛天依】唱歌科普，大豆居然是五谷！', 5296446],
  ['2609801', '洛天依，言和原创《葬歌》', 5170055],
  ['957890888', '【洛天依游学记原创曲】歌行四方', 5033108],
  ['114589861682758', '【洛天依】下等马', 4975607],
  ['1305196045', '【洛天依/乐正绫原创】《霜雪千年》2024官方重置版【PV付】', 4946033],
  ['14911611', '【洛天依原创曲】大小姐和大少爷的反派生涯', 4805019],
  ['234884693', '【洛天依/言和原创】人间应又雪', 4573076],
  ['55888297', '【洛天依原创曲】不老不死【异托邦LOVETOPIA】', 4469187],
  ['80155822', '洛天依 原创《上山岗》', 4371115],
  ['3444039', '洛天依原创《写给我第一个喜欢的女孩的歌》', 4218283],
  ['26659364', '【2018洛天依庆生会】一花依世界', 4145601],
];

/**
 * @param {string} keyword
 * @returns {SeekVideoItem[]}
 */
function buildVideoMockList(keyword) {
  const q = (keyword ?? '').trim();
  if (!q) return [];

  return MOCK_VIDEO_ROWS.map(([aid, title, view]) => ({
    type: 'video',
    id: aid,
    title,
    subTitle: `播放 ${view.toLocaleString()}`,
    payload: {
      bvid: aid,
      play: view,
      favorite: Math.round(view * 0.06),
      like: Math.round(view * 0.11),
      coin: Math.round(view * 0.03),
    },
    // 兼容字段（页面当前仍在读取）
    bvid: aid,
    play: view,
    favorite: Math.round(view * 0.06),
    like: Math.round(view * 0.11),
    coin: Math.round(view * 0.03),
  })).filter((item) => item.title.includes(q) || String(item.id).includes(q) || q.includes('洛天依'));
}

/** @type {SeekVocalItem} */
const MOCK_VOCAL_LUO_TIANYI = {
  type: 'vocal',
  id: 'vocal-luo-tianyi',
  title: '洛天依',
  subTitle: 'Vsinger旗下虚拟歌手，世界首位中文V家虚拟歌手',
  payload: {
    alias: ['Luo Tianyi'],
    songCount: 4600,
    representativeWorks: [
      { id: '2129461', title: '普通DISCO' },
      { id: '43426592', title: '勾指起誓' },
    ],
  },
  // 兼容字段（页面当前仍在读取）
  alias: ['Luo Tianyi'],
  songCount: 4600,
  representativeWorks: [
    { id: '2129461', title: '普通DISCO' },
    { id: '43426592', title: '勾指起誓' },
  ],
};

/** @type {SeekProducerItem[]} */
const MOCK_PRODUCERS = [
  {
    type: 'producer',
    id: 36081646,
    title: '洛天依',
    subTitle:
      'Vsinger旗下虚拟歌手，世界首位中文V家虚拟歌手，主唱，15岁，2012年7月12日出道。合作联系：shhn@vsinger.com。',
    payload: {
      uid: 36081646,
      fanCount: 5578032,
      videoCount: 460,
    },
    // 兼容字段（页面当前仍在读取）
    uid: 36081646,
    fanCount: 5578032,
    videoCount: 460,
    coverUrl: 'https://i0.hdslb.com/bfs/garb/065c24eb9b1dc2702eb805507d0808c9614e49ae.png',
  },
  {
    type: 'producer',
    id: 34727551,
    title: '洛天依相关收集站',
    subTitle:
      '微博@洛天依相关收集站，非官方性质的天依良曲分类收集号ww（对稿件有一点定的筛选）听歌请看收藏夹~',
    payload: {
      uid: 34727551,
      fanCount: 39019,
      videoCount: 62,
    },
    // 兼容字段（页面当前仍在读取）
    uid: 34727551,
    fanCount: 39019,
    videoCount: 62,
    coverUrl: 'https://i2.hdslb.com/bfs/face/66519f66fa9aab2617988963c7b830efa27a1fbf.jpg',
  },
];

/**
 * @param {SeekItem} item
 * @param {string} keyword
 */
function matchAndRankItem(item, keyword) {
  const q = (keyword ?? '').trim();
  if (!q) return { matched: false, rank: 99 };

  const exactTitle = item.title === q;
  const fuzzyMatched =
    item.title.includes(q) || item.subTitle.includes(q) || String(item.id).includes(q);

  if (!fuzzyMatched) return { matched: false, rank: 99 };

  if ((item.type === 'vocal' || item.type === 'producer') && exactTitle) return { matched: true, rank: 0 };
  if (item.type === 'vocal' || item.type === 'producer') return { matched: true, rank: 1 };
  if (item.type === 'video' && exactTitle) return { matched: true, rank: 2 };
  return { matched: true, rank: 3 };
}

/**
 * UniSeek（大搜）契约草案
 *
 * 请求体建议：
 * {
 *   keyword: string,                     // 必填
 *   types?: ('video'|'vocal'|'producer')[], // 可选，不传则全搜
 *   page?: number,                       // 可选，默认 1
 *   pageSize?: number                    // 可选，默认 20
 * }
 *
 * 响应体建议（仅 data）：
 * {
 *   keyword: string,
 *   total: number,
 *   page: number,
 *   pageSize: number,
 *   list: SeekItem[]
 * }
 */

/**
 * @typedef {'video'|'vocal'|'producer'} SeekItemType
 */

/**
 * 各类型通用字段
 * @typedef {Object} SeekItemBase
 * @property {SeekItemType} type
 * @property {string|number} id
 * @property {string} title
 * @property {string} subTitle
 * @property {number} [score] 相关性分，方便前端排序（可选）
 * @property {string} [coverUrl] 封面/头像
 * @property {string} [jumpUrl] 前端跳转链接（可选）
 * @property {Record<string, unknown>} payload 差异化字段容器
 */

/**
 * 视频结果（歌曲）
 * @typedef {SeekItemBase & {
 *   type: 'video',
 *   payload: {
 *     bvid?: string,
 *     play?: number,
 *     favorite?: number,
 *     like?: number,
 *     coin?: number,
 *     publishDate?: string,
 *     durationSec?: number,
 *     producerId?: string|number,
 *     vocalIdList?: Array<string|number>,
 *   },
 *   // 兼容字段（后续前端迁移完成后可移除）
 *   bvid?: string,
 *   play?: number,
 *   favorite?: number,
 *   like?: number,
 *   coin?: number,
 *   publishDate?: string, // YYYY-MM-DD
 *   durationSec?: number,
 *   producerId?: string|number,
 *   vocalIdList?: Array<string|number>,
 * }} SeekVideoItem
 */

/**
 * 虚拟歌手结果
 * @typedef {SeekItemBase & {
 *   type: 'vocal',
 *   payload: {
 *     alias?: string[],
 *     songCount?: number,
 *     representativeWorks?: Array<{ id: string|number, title: string }>,
 *   },
 *   // 兼容字段（后续前端迁移完成后可移除）
 *   alias?: string[],
 *   songCount?: number,
 *   representativeWorks?: Array<{ id: string|number, title: string }>,
 * }} SeekVocalItem
 */

/**
 * 创作者结果
 * @typedef {SeekItemBase & {
 *   type: 'producer',
 *   payload: {
 *     uid?: string|number,
 *     fanCount?: number,
 *     totalView?: number,
 *     videoCount?: number,
 *     recentWork?: { id: string|number, title: string, publishDate?: string },
 *   },
 *   // 兼容字段（后续前端迁移完成后可移除）
 *   uid?: string|number,
 *   fanCount?: number,
 *   totalView?: number,
 *   videoCount?: number,
 *   recentWork?: { id: string|number, title: string, publishDate?: string },
 * }} SeekProducerItem
 */

/**
 * 联合搜索结果项
 * @typedef {SeekVideoItem | SeekVocalItem | SeekProducerItem} SeekItem
 */

/**
 * @typedef {Object} UniSeekRequest
 * @property {string} keyword
 * @property {SeekItemType[]} [types]
 * @property {number} [page]
 * @property {number} [pageSize]
 */

/**
 * @typedef {Object} UniSeekResponseData
 * @property {string} keyword
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 * @property {SeekItem[]} list
 */

/**
 * @param {UniSeekRequest} request
 * @returns {Promise<UniSeekResponseData>}
 */
export function seek(request) {
  const req = {
    keyword: request?.keyword ?? '',
    types: request?.types,
    page: request?.page ?? 1,
    pageSize: request?.pageSize ?? 20,
  };

  if (!isMockEnv()) {
    return postJson('/uniseek/search', req);
  }

  /** @type {SeekItem[]} */
  const mixedMockList = [
    ...buildVideoMockList(req.keyword),
    MOCK_VOCAL_LUO_TIANYI,
    ...MOCK_PRODUCERS,
  ];
  const filteredByType = mixedMockList.filter((item) => !req.types?.length || req.types.includes(item.type));
  const matchedAndSorted = filteredByType
    .map((item) => {
      const { matched, rank } = matchAndRankItem(item, req.keyword);
      return { item, matched, rank };
    })
    .filter((row) => row.matched)
    .sort((a, b) => a.rank - b.rank)
    .map((row) => row.item);

  const startIdx = Math.max(0, (req.page - 1) * req.pageSize);
  const list = matchedAndSorted.slice(startIdx, startIdx + req.pageSize);

  return Promise.resolve({
    keyword: req.keyword,
    total: matchedAndSorted.length,
    page: req.page,
    pageSize: req.pageSize,
    list,
  });
}