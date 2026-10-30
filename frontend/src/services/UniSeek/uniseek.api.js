import { isMockEnv } from '../../config/runtimeEnv.js';
import { getJson } from '../http/client.js';
import catalog from '../../constants/vocal/vocal-search-info.json';
import { matchVocals } from './uniseekLocal.js';

/**
 * @typedef {{ type: 'video'|'vocal'|'producer', id: string, title: string,
 * subTitle?: string, coverUrl?: string, jumpUrl?: string, payload: Record<string, unknown> }} SeekItem
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

export function searchVocals(keyword) { return matchVocals(keyword, catalog); }

/** Each request can resolve independently. Only videos have subsequent pages. */
export async function searchVideos({ keyword, page = 1, pageSize = 30 }, options) {
  if (!isMockEnv()) {
    const query = new URLSearchParams({ keyword, page, pageSize });
    return getJson(`/uniseek/videos?${query}`, options);
  }
  const q = keyword.trim().toLowerCase();
  const matches = MOCK_VIDEO_ROWS.filter(([, title]) => title.toLowerCase().includes(q));
  const start = (page - 1) * pageSize;
  const hasMore = start + pageSize < matches.length;
  return { keyword, page, pageSize, hasMore, nextPage: hasMore ? page + 1 : null, videoLimit: 1000,
    list: matches.slice(start, start + pageSize).map(([id, title, play]) => ({
      type: 'video', id, title, jumpUrl: `/videos/${id}`, payload: { play },
    })) };
}
export async function searchProducers(keyword, options) {
  if (!isMockEnv()) return getJson(`/uniseek/producers?${new URLSearchParams({ keyword })}`, options);
  const q = keyword.trim().toLowerCase();
  return { keyword, list: MOCK_PRODUCERS.filter(item => item.payload.videoCount > 0 && Boolean(item.coverUrl?.trim()) && item.title.toLowerCase().includes(q))
    .sort((a, b) => Number(b.title === keyword.trim()) - Number(a.title === keyword.trim())
      || (b.payload.fanCount ?? -1) - (a.payload.fanCount ?? -1))
    .slice(0, 20).map(item => ({ ...item, id: String(item.id), jumpUrl: `/producers/${item.id}` })) };
}

export function searchVideoById(aid, options) {
  if (!isMockEnv()) return getJson(`/uniseek/videos/${encodeURIComponent(aid)}`, options);
  const mock = isMockEnv() ? MOCK_VIDEO_ROWS.find(([id]) => id === aid) : null;
  if (mock) return Promise.resolve({ list: [{ type: 'video', id: aid, title: mock[1],
    jumpUrl: `/videos/${aid}`, payload: { play: mock[2] } }] });
  return Promise.resolve({ list: [] });
}
export function searchProducerById(userId, options) {
  if (!isMockEnv()) return getJson(`/uniseek/producers/${encodeURIComponent(userId)}`, options);
  const mock = isMockEnv() ? MOCK_PRODUCERS.find(item => item.payload.videoCount > 0 && Boolean(item.coverUrl?.trim()) && String(item.id) === userId) : null;
  if (mock) return Promise.resolve({ list: [{ ...mock, id: userId, jumpUrl: `/producers/${userId}` }] });
  return Promise.resolve({ list: [] });
}
