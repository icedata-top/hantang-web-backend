/** 标题匹配优先于摘要（note 归入摘要） */
import { getTranslator } from '../../i18n.js';
import { getLanguageSettings } from '../../locales/languages.js';

const MATCH_TITLE = 2;
const MATCH_DESC = 1;
const MATCH_NONE = 0;

function normalizeQuery(query) {
  return String(query ?? '')
    .trim()
    .toLowerCase();
}

function linkDescText(link, language) {
  const t = getTranslator(language);
  return [link.descZh, link.noteZh].filter(Boolean).map((text) => t(text))
    .join(' ')
    .toLowerCase();
}

export function getLinkMatchScore(link, query, language) {
  const normalized = normalizeQuery(query);
  if (!normalized) return MATCH_TITLE;

  const name = String(link.name ?? '').toLowerCase();
  if (name.includes(normalized)) return MATCH_TITLE;

  const desc = linkDescText(link, language);
  if (desc.includes(normalized)) return MATCH_DESC;

  return MATCH_NONE;
}

function filterAndSortLinks(links, query, language) {
  const normalized = normalizeQuery(query);
  if (!normalized) return links ?? [];

  return (links ?? [])
    .map((link) => ({ link, score: getLinkMatchScore(link, normalized, language) }))
    .filter(({ score }) => score > MATCH_NONE)
    .sort((a, b) => b.score - a.score || a.link.name.localeCompare(b.link.name, getLanguageSettings(language).lang))
    .map(({ link }) => link);
}

function filterSections(sections, query, language) {
  return (sections ?? [])
    .map((section) => ({
      ...section,
      links: filterAndSortLinks(section.links, query, language),
    }))
    .filter((section) => section.links.length > 0);
}

/** 按关键词过滤分组，保留仍有链接的分组/二级分类 */
export function filterBookmarkGroups(groups, query, language) {
  const normalized = normalizeQuery(query);
  if (!normalized) return groups;

  return groups
    .map((group) => {
      if (group.sections) {
        const sections = filterSections(group.sections, normalized, language);
        return sections.length ? { ...group, sections } : null;
      }

      const links = filterAndSortLinks(group.links, normalized, language);
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
