/**
 * 管理配置目录。
 * 顶栏「管理配置」是一级；这里的分组是二级，分组下的页面是三级。
 * 分组没有 path；页面有 path。「视频标注复核」等已实现页面在 index.jsx 注册。
 */

export const ADMIN_NAV = [
  {
    key: 'runtime',
    path: '/admin',
    zh: '运行环境',
    en: 'Runtime',
  },
  {
    key: 'data',
    zh: '数据中心',
    en: 'Data center',
    children: [
      {
        key: 'collection',
        path: '/admin/data/collection',
        zh: '数据采集',
        en: 'Data collection',
      },
      {
        key: 'processing',
        path: '/admin/data/processing',
        zh: '数据处理',
        en: 'Data processing',
        summaryZh: '查看明细数据进入加工与应用层的处理情况。',
        pointsZh: ['数据加工与聚合', '应用数据发布状态'],
      },
    ],
  },
  {
    key: 'content',
    zh: '内容',
    en: 'Content',
    children: [
      {
        key: 'video-review',
        path: '/admin/content/video-review',
        zh: 'bulk.title',
        en: 'UniSeek content labeling',
      },
      {
        key: 'vocals',
        path: '/admin/content/vocals',
        zh: '虚拟歌手',
        en: 'Vocals',
        summaryZh: '维护虚拟歌手的名称和展示信息。',
        summaryEn: 'Edit vocal names and how they are displayed.',
        pointsZh: ['名称、别名与展示名', '公开的虚拟歌手页读取这里的结果'],
        pointsEn: ['Name, aliases, and display name', 'The public vocal pages read this result'],
      },
      {
        key: 'producers',
        path: '/admin/content/producers',
        zh: '创作者',
        en: 'Producers',
        summaryZh: '维护创作者的名称和展示信息。',
        summaryEn: 'Edit producer names and how they are displayed.',
        pointsZh: ['名称与展示名', '公开的创作者页读取这里的结果'],
        pointsEn: ['Name and display name', 'The public producer pages read this result'],
      },
      {
        key: 'links',
        path: '/admin/content/links',
        zh: '友情链接',
        en: 'Links',
        summaryZh: '维护顶部菜单「友情链接」的条目。',
        summaryEn: 'Edit the entries in the top Links menu.',
        pointsZh: ['名称、地址与排序', '保存后反映到顶部菜单'],
        pointsEn: ['Name, URL, and order', 'Saved entries appear in the top menu'],
      },
      {
        key: 'about',
        path: '/admin/content/about',
        zh: '关于',
        en: 'About',
        summaryZh: '维护公开「关于」页的文案和对外链接。',
        summaryEn: 'Edit the copy and outbound links on the public About page.',
        pointsZh: ['介绍段落', '对外链接与排序'],
        pointsEn: ['Introduction paragraphs', 'Outbound links and their order'],
      },
    ],
  },
  {
    key: 'observe',
    zh: '观测',
    en: 'Observe',
    children: [
      {
        key: 'paths',
        path: '/admin/observe/paths',
        zh: '访问路径',
        en: 'Paths',
        summaryZh: '查看访客如何在页面之间移动。',
        summaryEn: 'See how visits move between pages.',
        pointsZh: ['页面跳转路径', '进入站点的来源', '不记录可识别个人的内容'],
        pointsEn: ['Paths between pages', 'Where visits enter the site', 'No personally identifiable content'],
      },
      {
        key: 'features',
        path: '/admin/observe/features',
        zh: '功能使用',
        en: 'Features',
        summaryZh: '查看搜索、筛选等功能是否被使用。',
        summaryEn: 'See whether search, filters, and similar features are used.',
        pointsZh: ['功能与次数', '不记录可识别个人的内容'],
        pointsEn: ['Feature and count', 'No personally identifiable content'],
      },
    ],
  },
  {
    key: 'design',
    zh: '设计',
    en: 'Design',
    children: [
      {
        key: 'components',
        path: '/admin/design/components',
        zh: '组件预览',
        en: 'Components',
        summaryZh: '展示与操作 RelativeTime、ProducerInfo、VideoInfo 等自定义组件。',
        summaryEn: 'Explore custom components including RelativeTime, ProducerInfo, and VideoInfo.',
      },
      {
        key: 'spec',
        path: '/admin/design/spec',
        zh: '视觉规范',
        en: 'Visual spec',
        summaryZh: '集中查看颜色、圆角、阴影和字号。',
        summaryEn: 'Review color, radius, shadow, and type size in one place.',
        pointsZh: ['主题变量与色板', '新页面沿用同一套规范'],
        pointsEn: ['Theme variables and swatches', 'New pages follow the same spec'],
      },
    ],
  },
];

const GROUP_KEYS = [];
const LEAVES = [];

function indexNodes(nodes, ancestors) {
  nodes.forEach((node) => {
    if (node.children?.length) {
      GROUP_KEYS.push(node.key);
      indexNodes(node.children, [...ancestors, node]);
      return;
    }
    LEAVES.push({ ...node, ancestors });
  });
}

indexNodes(ADMIN_NAV, []);

const LEAF_BY_KEY = new Map(LEAVES.map((leaf) => [leaf.key, leaf]));

export function adminGroupKeys() {
  return [...GROUP_KEYS];
}

/** 左侧二级分组。默认展开，其下就是三级页面。 */
export function adminRootGroupKeys() {
  return ADMIN_NAV.filter((node) => node.children?.length).map((node) => node.key);
}

export function findAdminLeaf(pathname) {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return LEAVES.find((leaf) => leaf.path === path) ?? null;
}

export function findAdminLeafByKey(key) {
  return LEAF_BY_KEY.get(key) ?? null;
}

export function buildAdminMenuItems(nodes, t, icons) {
  return nodes.map((node) => {
    const item = {
      key: node.key,
      label: t(node.zh),
    };
    if (icons?.[node.key]) item.icon = icons[node.key];
    if (node.children?.length) {
      item.children = buildAdminMenuItems(node.children, t);
    }
    return item;
  });
}
