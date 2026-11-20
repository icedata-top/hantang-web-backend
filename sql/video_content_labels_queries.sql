-- 只读查询示例；三个范围都建立在当前已发布UniSeek候选集之上，完整不等于全站所有processed_videos。
-- 完整（all）：保留未打标和不确定投稿；没有标签时l.*为NULL。
SELECT v.aid, v.bvid, v.title, v.pic, v.pubdate, v.user_id, v.view, v.favorite,
       l.is_song, l.is_virtual_singer, l.languages
FROM hantang_dynamic.adm_uniseek_videos AS v
LEFT JOIN hantang_dynamic.video_content_labels AS l ON l.aid = v.aid
ORDER BY v.view DESC NULLS LAST, v.aid DESC
LIMIT 50;
-- 虚拟歌手歌曲（virtual_song）：含混合演唱，包含所有演唱语言。
SELECT v.aid, v.bvid, v.title, v.pic, v.pubdate, v.user_id, v.view, v.favorite,
       l.is_song, l.is_virtual_singer, l.languages
FROM hantang_dynamic.adm_uniseek_videos AS v
INNER JOIN hantang_dynamic.video_content_labels AS l ON l.aid = v.aid
WHERE l.is_virtual_singer_song
ORDER BY v.view DESC NULLS LAST, v.aid DESC
LIMIT 50;
-- 虚拟歌手汉语歌曲（chinese_virtual_song）：默认范围；多语演唱包含汉语也纳入。
SELECT v.aid, v.bvid, v.title, v.pic, v.pubdate, v.user_id, v.view, v.favorite,
       l.is_song, l.is_virtual_singer, l.languages
FROM hantang_dynamic.adm_uniseek_videos AS v
INNER JOIN hantang_dynamic.video_content_labels AS l ON l.aid = v.aid
WHERE l.is_chinese_virtual_singer_song
ORDER BY v.view DESC NULLS LAST, v.aid DESC
LIMIT 50;
-- 上传账号统计基础：分母来自打标前候选集，不从已经筛成歌曲的查询结果统计。
-- 不使用含义未核实的discovered_users.videos_filtered/filter_pass_rate，也不宣称是账号全站历史投稿率。
WITH counts AS (
    SELECT v.user_id, v.record_date, v.batch_id,
           count(*) AS candidate_count,
           count(l.aid) AS labeled_count,
           count(*) FILTER (
               WHERE l.is_song = '否'
                  OR (l.is_song = '是' AND l.is_virtual_singer IN ('是', '否', '混合'))
           ) AS decided_count,
           count(*) FILTER (WHERE l.is_virtual_singer_song) AS virtual_song_count,
           count(*) FILTER (WHERE l.is_chinese_virtual_singer_song) AS chinese_virtual_song_count
    FROM hantang_dynamic.adm_uniseek_videos AS v
    LEFT JOIN hantang_dynamic.video_content_labels AS l ON l.aid = v.aid
    WHERE v.user_id > 0
    GROUP BY v.user_id, v.record_date, v.batch_id
)
SELECT counts.*,
       labeled_count::numeric / NULLIF(candidate_count, 0) AS labeling_coverage,
       decided_count::numeric / NULLIF(candidate_count, 0) AS decision_coverage,
       virtual_song_count::numeric / NULLIF(decided_count, 0) AS virtual_share_decided,
       virtual_song_count::numeric / NULLIF(candidate_count, 0) AS virtual_share_lower_bound
FROM counts
ORDER BY virtual_song_count DESC, user_id ASC;
