import { videoInfo } from '../Video/video.mock.js';

// 仅使用已提供的 COPY / 世末歌者公开样本，不编造播放量、协作者或作品。
export const producerInfo = {
  userId: '396194', name: videoInfo.uploader.name, face: videoInfo.uploader.face,
  sign: videoInfo.uploader.sign, fans: 265636, level: 6, officialRole: 0,
  officialTitle: videoInfo.uploader.officialTitle, lastUpdated: '2026-09-25T22:00:00Z',
};

export const producerVideos = [{
  aid: String(videoInfo.aid), bvid: videoInfo.bvid, title: videoInfo.title,
  pubdate: videoInfo.pubdate, pic: videoInfo.pic, userId: '396194', view: null, recordDate: null,
}];
