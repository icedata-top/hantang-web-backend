import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LeftOutlined, RightOutlined, LoadingOutlined } from '@ant-design/icons';

function useCopy() {
  const { i18n } = useTranslation();
  return (zh, en) => (String(i18n.language).toLowerCase().startsWith('zh') ? zh : en);
}

export function DsTabs({ items, value, onChange, label }) {
  const id = useId();
  const refs = useRef({});
  const enabled = items.filter((item) => !item.disabled);
  const selected = enabled.find((item) => item.key === value) || enabled[0];

  function handleKeyDown(event, key) {
    const index = enabled.findIndex((item) => item.key === key);
    const destinations = {
      ArrowRight: (index + 1) % enabled.length,
      ArrowLeft: (index - 1 + enabled.length) % enabled.length,
      Home: 0,
      End: enabled.length - 1,
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    const next = enabled[destinations[event.key]];
    if (next) {
      onChange(next.key);
      refs.current[next.key]?.focus();
    }
  }

  return (
    <div className="ds-tabs">
      <div className="ds-tab-list" role="tablist" aria-label={label}>
        {items.map((item) => (
          <button
            className="ds-tab"
            type="button"
            role="tab"
            key={item.key}
            ref={(element) => { refs.current[item.key] = element; }}
            id={`${id}-tab-${item.key}`}
            aria-controls={`${id}-panel-${item.key}`}
            aria-selected={selected?.key === item.key}
            tabIndex={selected?.key === item.key ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => handleKeyDown(event, item.key)}
          >{item.label}</button>
        ))}
      </div>
      {items.map((item) => (
        <div
          className="ds-tab-panel"
          key={item.key}
          id={`${id}-panel-${item.key}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${item.key}`}
          tabIndex={0}
          hidden={item.key !== selected?.key}
        >{item.children}</div>
      ))}
    </div>
  );
}

function pageItems(page, count) {
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (count <= 7) return range(1, count);
  if (page <= 4) return [...range(1, 5), 'end-gap', count];
  if (page >= count - 3) return [1, 'start-gap', ...range(count - 4, count)];
  return [1, 'start-gap', page - 1, page, page + 1, 'end-gap', count];
}

export function DsPagination({ current, pageSize, total, onChange, disabled = false, pageSizeOptions = [10, 20, 50], onPageSizeChange, label }) {
  const t = useCopy();
  const count = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(current, count));
  const inactive = disabled || total === 0;
  return (
    <div className="ds-pagination">
      <span className="ds-pagination-summary">{t(`共 ${total} 条`, `${total} items`)}</span>
      <nav className="ds-pagination-pages" aria-label={label || t('分页', 'Pagination')}>
        <button className="ds-page-button" type="button" disabled={inactive || page === 1} onClick={() => onChange(page - 1)} aria-label={t('上一页', 'Previous page')}><LeftOutlined aria-hidden="true" /></button>
        {pageItems(page, count).map((item) => typeof item === 'number' ? (
          <button className="ds-page-button" type="button" key={item} disabled={inactive} aria-current={item === page ? 'page' : undefined} aria-label={t(`第 ${item} 页`, `Page ${item}`)} onClick={() => onChange(item)}>{item}</button>
        ) : <span className="ds-pagination-gap" key={item} aria-hidden="true">…</span>)}
        <button className="ds-page-button" type="button" disabled={inactive || page === count} onClick={() => onChange(page + 1)} aria-label={t('下一页', 'Next page')}><RightOutlined aria-hidden="true" /></button>
      </nav>
      {onPageSizeChange && (
        <label className="ds-pagination-size">
          <span className="ds-sr-only">{t('每页条数', 'Items per page')}</span>
          <select className="ds-page-size-select" aria-label={t('每页条数', 'Items per page')} value={pageSize} disabled={inactive} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {pageSizeOptions.map((size) => <option key={size} value={size}>{t(`${size} 条 / 页`, `${size} / page`)}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export function DsTable({ columns, rows, caption, loading = false, sortKey, sortDirection = 'desc', onSort, emptyText }) {
  const t = useCopy();
  return (
    <div className="ds-table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="ds-table" aria-busy={loading}>
        <caption className="ds-sr-only">{caption}</caption>
        <thead><tr>{columns.map((column) => (
          <th key={column.key} scope="col" data-align={column.align} style={{ width: column.width }} aria-sort={column.sortable ? (sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}>
            {column.sortable ? (
              <button className="ds-table-sort" type="button" onClick={() => onSort?.(column.key, sortKey === column.key && sortDirection === 'desc' ? 'asc' : 'desc')} aria-label={t(`按${column.title}排序`, `Sort by ${column.title}`)}>
                {column.title}<span aria-hidden="true">{sortKey === column.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </button>
            ) : column.title}
          </th>
        ))}</tr></thead>
        <tbody>
          {loading || rows.length === 0 ? (
            <tr><td colSpan={columns.length}><div className="ds-table-empty" role="status">
              {loading ? <><LoadingOutlined spin aria-hidden="true" /><span>{t('正在加载数据…', 'Loading data…')}</span></> : <><span className="ds-table-empty-symbol" aria-hidden="true">—</span><span>{emptyText || t('暂无数据', 'No data')}</span><span className="ds-table-empty-hint">{t('可调整筛选条件后再试', 'Try adjusting your filters')}</span></>}
            </div></td></tr>
          ) : rows.map((row) => <tr key={row.id}>{columns.map((column) => (
            <td key={column.key} data-align={column.align}><div className="ds-table-cell">{column.render ? column.render(row[column.key], row) : (row[column.key] ?? '—')}</div></td>
          ))}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
