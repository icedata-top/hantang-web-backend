/** 标题匹配优先于摘要（note 归入摘要） */
const MATCH_TITLE = 2;
const MATCH_DESC = 1;
const MATCH_NONE = 0;

function normalizeQuery(query) {
  return String(query ?? '')
    .trim()
    .toLowerCase();
}

function linkDescText(link, isZh) {
  return [isZh ? link.descZh : link.descEn, isZh ? link.noteZh : link.noteEn]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getLinkMatchScore(link, query, isZh) {
  const normalized = normalizeQuery(query);
  if (!normalized) return MATCH_TITLE;

  const name = String(link.name ?? '').toLowerCase();
  if (name.includes(normalized)) return MATCH_TITLE;

  const desc = linkDescText(link, isZh);
  if (desc.includes(normalized)) return MATCH_DESC;

  return MATCH_NONE;
}

function filterAndSortLinks(links, query, isZh) {
  const normalized = normalizeQuery(query);
  if (!normalized) return links ?? [];

  return (links ?? [])
    .map((link) => ({ link, score: getLinkMatchScore(link, normalized, isZh) }))
    .filter(({ score }) => score > MATCH_NONE)
    .sort((a, b) => b.score - a.score || a.link.name.localeCompare(b.link.name, 'zh'))
    .map(({ link }) => link);
}

function filterSections(sections, query, isZh) {
  return (sections ?? [])
    .map((section) => ({
      ...section,
      links: filterAndSortLinks(section.links, query, isZh),
    }))
    .filter((section) => section.links.length > 0);
}

/** 按关键词过滤分组，保留仍有链接的分组/二级分类 */
export function filterBookmarkGroups(groups, query, isZh) {
  const normalized = normalizeQuery(query);
  if (!normalized) return groups;

  return groups
    .map((group) => {
      if (group.sections) {
        const sections = filterSections(group.sections, normalized, isZh);
        return sections.length ? { ...group, sections } : null;
      }

      const links = filterAndSortLinks(group.links, normalized, isZh);
      return links.length ? { ...group, links } : null;
    })
    .filter(Boolean);
}

export function countBookmarkLinks(groups) {
  return groups.reduce((total, group) => {
    if (group.sections) {
      return total + group.sections.reduce((sum, section) => sum + section.links.length, 0);
    }
    return total + (group.links?.length ?? 0);
  }, 0);
}

export function buildTocFromGroups(groups) {
  return groups.map((group) => ({
    id: group.id,
    anchorId: `stash-${group.id}`,
    titleZh: group.titleZh,
    titleEn: group.titleEn,
    children: group.sections?.map((section) => ({
      id: section.id,
      anchorId: `stash-${group.id}-${section.id}`,
      titleZh: section.titleZh,
      titleEn: section.titleEn,
    })),
  }));
}
