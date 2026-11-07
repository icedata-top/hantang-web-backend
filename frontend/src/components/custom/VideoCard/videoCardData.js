/** Adapt the search contract; explicit payload nulls take priority over legacy flat fields. */
export function videoCardFromSearchItem(item) {
  const payload = item.payload ?? {};
  const field = (name) => Object.hasOwn(payload, name) ? payload[name] : item[name];
  const video = {
    aid: item.id, title: item.title, pic: item.coverUrl,
    view: field('play'), recordDate: field('recordDate'), pubdate: field('publishDate'), userId: field('producerId'),
  };
  for (const key of ['favorite', 'like']) {
    if (Object.hasOwn(payload, key) || Object.hasOwn(item, key)) video[key] = field(key);
  }
  return video;
}
