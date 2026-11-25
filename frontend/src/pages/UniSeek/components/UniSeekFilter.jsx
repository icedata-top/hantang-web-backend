import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AutoComplete, Button, Grid, Input, Segmented, Tooltip } from 'antd';
import { ArrowRightOutlined, DownOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { CONTENT_SCOPES } from '../../../services/UniSeek/uniseekScope.js';
import { videoDetailSuggestion } from '../../../services/UniSeek/uniseekLocal.js';

/**
 * @param {object} props
 * @param {string} props.keyword
 * @param {boolean} [props.loading]
 * @param {string} props.contentScope
 * @param {(scope: string) => void} props.onScopeChange
 * @param {(keyword: string) => void} props.onKeywordChange
 * @param {(keyword: string) => void} props.onSearch
 */
export default function UniSeekFilter({ keyword, loading = false, contentScope, onScopeChange, onKeywordChange, onSearch }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sm } = Grid.useBreakpoint();
  const [expanded, setExpanded] = useState(false);
  const composing = useRef(false);
  const scopeId = useId();
  const toggleLabel = t(expanded ? 'search.scope.collapse' : 'search.scope.expand');
  const suggestion = videoDetailSuggestion(keyword);
  const options = suggestion ? [{
    value: keyword,
    jumpUrl: suggestion.jumpUrl,
    label: <span className="uniseek-id-option">
      <span>{t('search.openVideo')}</span>
      <span className="uniseek-id-identifier">{suggestion.identifier}</span>
      <ArrowRightOutlined aria-hidden />
    </span>,
  }] : [];
  return (
    <div className="uniseek-filter">
      <div className="uniseek-search-row">
        <form className="uniseek-search-form" role="search" onSubmit={event => {
          event.preventDefault();
          if (!loading && !composing.current) onSearch(keyword);
        }}>
          <AutoComplete
            value={keyword}
            options={options}
            className="uniseek-search-input"
            variant="borderless"
            filterOption={false}
            defaultActiveFirstOption={false}
            onChange={onKeywordChange}
            onSelect={(_, option) => navigate(option.jumpUrl)}
          >
            <Input
              maxLength={100}
              placeholder={t('搜索一首歌，一位虚拟歌手，或一位创作者')}
              aria-label={t('搜索')}
              variant="borderless"
              size="large"
              className="ds-filter-control ds-filter-control--transparent uniseek-keyword-input"
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={() => { composing.current = false; }}
            />
          </AutoComplete>
          <Button htmlType="submit" size="large" className="ds-button ds-button--transparent uniseek-search-action uniseek-search-submit" data-variant="normal"
            loading={loading} icon={<SearchOutlined />} aria-label={t('搜索')} />
        </form>
        <Tooltip title={toggleLabel}>
          <Button type="text" className="ds-button ds-button--transparent uniseek-search-action uniseek-scope-toggle" data-variant="normal"
            icon={expanded ? <UpOutlined /> : <DownOutlined />} aria-label={toggleLabel}
            aria-expanded={expanded} aria-controls={scopeId} onClick={() => setExpanded(value => !value)} />
        </Tooltip>
      </div>
      <div id={scopeId} className="uniseek-scope-controls" hidden={!expanded}>
        <Segmented className="ds-segmented ds-segmented--wrap" block vertical={sm === false} aria-label={t('search.scope.label')}
          value={contentScope} onChange={onScopeChange}
          options={CONTENT_SCOPES.map(value => ({ value, label: t(`search.scope.${value}`) }))} />
      </div>
    </div>
  );
}
