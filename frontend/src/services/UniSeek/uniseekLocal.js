import { parseVideoIdentifier } from '../../pages/video/videoIdentifier.js';

const normalized = value => String(value ?? '').normalize('NFKC').toLowerCase().trim();

/** The 18-entry catalog is bundled with the app, so this never waits for a network request. */
export function matchVocals(keyword, catalog) {
  const q = normalized(keyword);
  if (!q) return [];
  return catalog.flatMap(vocal => {
    const name = normalized(vocal.name);
    const aliases = vocal.aliases.map(normalized);
    const rank = name === q ? 0 : aliases.includes(q) ? 1
      : name.includes(q) ? 2 : aliases.some(alias => alias.includes(q)) ? 3 : null;
    return rank == null ? [] : [{ rank, item: {
      type: 'vocal', id: vocal.id, title: vocal.name, subTitle: vocal.description,
      coverUrl: vocal.image, jumpUrl: `/vocals/${vocal.id}`, payload: { alias: vocal.aliases },
    } }];
  }).sort((a, b) => a.rank - b.rank).map(({ item }) => item);
}

/** Bare numbers are both text and possible IDs; explicit AV/BV input needs only the exact video. */
export function searchTargets(keyword) {
  const q = String(keyword ?? '').trim();
  const explicit = /^(?:av[1-9][0-9]*|bv1[1-9A-HJ-NP-Za-km-z]{9})$/i.test(q);
  const candidate = /^av/i.test(q) ? q.slice(2) : /^bv/i.test(q) ? `BV${q.slice(2)}` : q;
  const parsed = parseVideoIdentifier(candidate);
  if (parsed.status !== 'valid') return { aid: null, userId: null, searchVideos: true };
  return { aid: parsed.aid, userId: /^[1-9][0-9]*$/.test(q) ? parsed.aid : null, searchVideos: !explicit };
}
