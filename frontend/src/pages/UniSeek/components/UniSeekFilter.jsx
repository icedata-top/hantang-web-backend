import { Input } from 'antd';

const { Search } = Input;

/**
 * @param {object} props
 * @param {string} props.keyword
 * @param {boolean} [props.loading]
 * @param {(keyword: string) => void} props.onKeywordChange
 * @param {(keyword: string) => void} props.onSearch
 */
export default function UniSeekFilter({ keyword, loading = false, onKeywordChange, onSearch }) {
  return (
    <div className="uniseek-filter">
      <Search
        value={keyword}
        placeholder="搜索一首歌，一位虚拟歌手，或一位创作者"
        enterButton
        size="large"
        loading={loading}
        className="uniseek-search-input"
        onChange={(e) => onKeywordChange(e.target.value)}
        onSearch={(value) => onSearch(value)}
      />
    </div>
  );
}
