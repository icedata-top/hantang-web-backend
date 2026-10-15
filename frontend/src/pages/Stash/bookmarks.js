/**
 * 景育的收藏夹（纯前端静态数据）
 *
 * 分组字段：id / titleZh / titleEn 必填
 * - links：一级列表
 * - sections：二级分类，每项含 id、titleZh、titleEn、links
 *
 * 链接字段：name / url 必填；descZh、descEn、noteZh、noteEn 可选
 */

export const STASH_META = {
  titleZh: '景育的收藏夹',
  titleEn: "Jingyu's Bookmarks",
};

/** 由 URL 推导 favicon（Google 公共服务） */
export function getFaviconUrl(url) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
  } catch {
    return null;
  }
}

export const BOOKMARK_GROUPS = [
  {
    id: 'icedata',
    titleZh: '冰数据',
    titleEn: 'icedata',
    links: [
      {
        name: 'icedata 官网',
        url: 'https://www.icedata.top/',
        descZh: '项目主页与公开入口',
        descEn: 'Project homepage',
      },
      {
        name: 'GitHub · icedata-top',
        url: 'https://github.com/icedata-top',
        descZh: '代码仓库与协作',
        descEn: 'Source repos',
      },
    ],
  },
  {
    id: 'cs',
    titleZh: '计科',
    titleEn: 'Computer Science',
    sections: [
      {
        id: 'frontend',
        titleZh: '前端',
        titleEn: 'Frontend',
        links: [
          {
            name: 'Vite',
            url: 'https://vite.dev/',
            descZh: '前端构建工具',
            descEn: 'Frontend build tool',
          },
          {
            name: 'React Router',
            url: 'https://reactrouter.com/',
            descZh: 'React 路由',
            descEn: 'React routing',
          },
          {
            name: 'Vue 3',
            url: 'https://cn.vuejs.org/',
            descZh: 'Vue 3 中文文档',
            descEn: 'Vue 3 docs (Chinese)',
          },
          {
            name: 'Ant Design',
            url: 'https://ant.design/',
            descZh: 'React 组件库',
            descEn: 'React component library',
          },
          {
            name: 'VChart',
            url: 'https://www.visactor.io/vchart',
            descZh: '可视化图表',
            descEn: 'Chart library',
          },
          {
            name: 'G6',
            url: 'https://g6.antv.vision/',
            descZh: 'AntV 图可视化引擎',
            descEn: 'Graph visualization engine',
          },
          {
            name: 'Iconify',
            url: 'https://icones.js.org/',
            descZh: 'Iconify 图标预览与检索',
            descEn: 'Iconify icon browser',
          },
          {
            name: 'Material Theme Builder',
            url: 'https://material-foundation.github.io/material-theme-builder/',
            descZh: 'Google Material 配色生成',
            descEn: 'Material Design theme builder',
          },
          {
            name: 'unDraw',
            url: 'https://undraw.co/illustrations/2',
            descZh: '开源插图素材',
            descEn: 'Open-source illustrations',
          },
        ],
      },
      {
        id: 'backend',
        titleZh: '后端',
        titleEn: 'Backend',
        links: [
          {
            name: 'Kotlin',
            url: 'https://book.kotlincn.net/text/home.html',
            descZh: 'Kotlin 中文教程',
            descEn: 'Kotlin guide (Chinese)',
          },
          {
            name: 'Ktor',
            url: 'https://ktor.kotlincn.net/quickstart/index.html',
            descZh: 'Kotlin 异步 Web 框架',
            descEn: 'Kotlin async web framework',
          },
          {
            name: 'Spring',
            url: 'https://springdoc.cn/docs/',
            descZh: 'Spring 中文文档',
            descEn: 'Spring docs (Chinese)',
          },
          {
            name: 'Javalin',
            url: 'https://javalin.io/',
            descZh: '轻量 Java / Kotlin Web 框架',
            descEn: 'Lightweight Java/Kotlin web framework',
          },
          {
            name: 'JavaGuide',
            url: 'https://javaguide.cn/home.html',
            descZh: 'Java 学习与面试指南',
            descEn: 'Java learning and interview guide',
          },
          {
            name: '小林 coding',
            url: 'https://xiaolincoding.com/',
            descZh: '图解计网、操作系统、计组、数据库',
            descEn: 'Illustrated CS fundamentals',
          },
          {
            name: '编程指北',
            url: 'https://csguide.cn/',
            descZh: '编程自学路线与 CS 学习指北',
            descEn: 'Self-taught CS roadmap',
          },
          {
            name: 'Linux 命令搜索引擎',
            url: 'https://jaywcjlove.gitee.io/linux-command/',
            descZh: '580+ Linux 命令速查',
            descEn: 'Linux command reference',
          },
          {
            name: 'OI Wiki',
            url: 'https://oi-wiki.org/',
            descZh: '编程竞赛与算法知识',
            descEn: 'Competitive programming wiki',
          },
          {
            name: 'LeetCode',
            url: 'https://leetcode.cn/problemset/all/',
            descZh: '算法题练习与面试准备',
            descEn: 'Algorithm practice',
          },
        ],
      },
      {
        id: 'data',
        titleZh: '数据',
        titleEn: 'Data',
        links: [
          {
            name: '设计数据密集型应用',
            url: 'https://vonng.gitbook.io/vonng/',
            descZh: '数据系统架构与设计',
            descEn: 'Designing data-intensive systems',
          },
          {
            name: 'StarRocks',
            url: 'https://docs.starrocks.io/zh/docs/introduction/what_is_starrocks/',
            descZh: '实时分析型数据库',
            descEn: 'Real-time OLAP database',
          },
          {
            name: 'ClickHouse',
            url: 'https://clickhouse.com/docs/zh',
            descZh: '列式 OLAP 数据库',
            descEn: 'Columnar OLAP database',
          },
        ],
      },
    ],
  },
  {
    id: 'geo',
    titleZh: '地理',
    titleEn: 'Geography',
    links: [
      {
        name: '地图窝',
        url: 'http://www.onegreen.net/maps/Index.html',
        descZh: '历史地图、行政区划图、地形图',
        descEn: 'Historical and regional maps',
      },
      {
        name: 'OpenRailwayMap',
        url: 'https://www.openrailwaymap.org/',
        descZh: '国内外铁路、地铁开放地图',
        descEn: 'Open railway and metro maps',
      },
      {
        name: 'DataV · GeoAtlas',
        url: 'https://datav.aliyun.com/portal/school/atlas/area_selector',
        descZh: '行政区划边界与地理小工具',
        descEn: 'Geo atlas and boundary tools',
      },
    ],
  },
  {
    id: 'lang',
    titleZh: '外语',
    titleEn: 'Languages',
    links: [
      {
        name: '多邻国 Duolingo',
        url: 'https://www.duolingo.cn/learn',
        descZh: '多语种学习，内容免费',
        descEn: 'Free language learning',
      },
      {
        name: '日本語の例文',
        url: 'https://j-nihongo.com/',
        descZh: '用日语学日语，语法例文与阅读',
        descEn: 'Japanese grammar and examples',
        noteZh: '按 N5–N1 分级，更适合应试',
        noteEn: 'JLPT N5–N1; exam-oriented',
      },
      {
        name: 'Tofugu',
        url: 'https://www.tofugu.com/japanese/',
        descZh: '用英语学日语',
        descEn: 'Learn Japanese in English',
      },
      {
        name: 'Wasabi',
        url: 'https://my.wasabi-jpn.com/',
        descZh: '用英语学日语的在线课程',
        descEn: 'Online Japanese lessons',
      },
      {
        name: 'weblio 辞書',
        url: 'https://weblio.jp/',
        descZh: '日语解释日语的电子辞典',
        descEn: 'Japanese monolingual dictionary',
      },
      {
        name: 'Cambridge Dictionary',
        url: 'https://dictionary.cambridge.org/',
        descZh: '英语解释英语的剑桥辞典',
        descEn: 'English monolingual dictionary',
      },
      {
        name: '原神中英日辞典',
        url: 'https://genshin-dictionary.com/zh-CN',
        descZh: '原神固有名词日英中对照',
        descEn: 'Genshin terminology',
      },
    ],
  },
  {
    id: 'academic',
    titleZh: '学术',
    titleEn: 'Academic',
    sections: [
      {
        id: 'papers',
        titleZh: '论文',
        titleEn: 'Papers',
        links: [
          {
            name: '中国知网',
            url: 'https://www.cnki.net/',
            descZh: '中文学术文献检索',
            descEn: 'Chinese literature search',
          },
          {
            name: 'Web of Science',
            url: 'https://www.webofscience.com/wos/alldb/basic-search',
            descZh: '国际核心期刊论文检索',
            descEn: 'International journal search',
          },
          {
            name: '百度学术',
            url: 'https://xueshu.baidu.com/',
            descZh: '中文学术搜索与文献传递',
            descEn: 'Chinese academic portal',
          },
          {
            name: 'X-MOL 学术平台',
            url: 'https://www.x-mol.com/',
            descZh: '中文检索英文论文，DOI 直达',
            descEn: 'English papers via Chinese UI',
          },
          {
            name: 'X-MOL 论文导读',
            url: 'https://www.x-mol.com/paper/chem',
            descZh: '化学 / 材料类热门期刊导读',
            descEn: 'Chemistry journal digest',
          },
          {
            name: 'Semantic Scholar',
            url: 'https://www.semanticscholar.org/',
            descZh: 'AI 驱动的学术检索',
            descEn: 'AI-powered paper search',
          },
          {
            name: 'ScienceDirect',
            url: 'https://www.sciencedirect.com/browse/journals-and-books',
            descZh: 'Elsevier 期刊与电子书',
            descEn: 'Elsevier journals and e-books',
            noteZh: '除论文外可检索部分理工教材',
            noteEn: 'Also indexes STEM textbooks',
          },
          {
            name: 'American Chemical Society',
            url: 'https://www.acs.org/content/acs/en.html',
            descZh: '美国化学会期刊入口',
            descEn: 'ACS publications',
          },
        ],
      },
      {
        id: 'books',
        titleZh: '书籍',
        titleEn: 'Books',
        links: [
          {
            name: '超星汇雅电子书',
            url: 'https://pds.sslibrary.com/',
            descZh: '高校常用电子书库',
            descEn: 'University e-book library',
          },
          {
            name: 'Z-Library',
            url: 'https://zh.singlelogin.re/',
            descZh: '电子书检索与下载',
            descEn: 'E-book search',
          },
          {
            name: 'LibreTexts',
            url: 'https://phys.libretexts.org/',
            descZh: '开放理工科教材',
            descEn: 'Open STEM textbooks',
          },
          {
            name: '电子科技大学图书馆',
            url: 'https://www.lib.uestc.edu.cn/',
            descZh: '校内图书馆门户',
            descEn: 'UESTC library portal',
          },
        ],
      },
      {
        id: 'lab',
        titleZh: '实验',
        titleEn: 'Lab',
        links: [
          {
            name: '化学试剂管理系统',
            url: 'https://labsafe.uestc.edu.cn/lab/fe/orders/home',
            descZh: '药剂购买与实验室订单',
            descEn: 'Lab reagent ordering',
          },
          {
            name: '探索平台',
            url: 'https://www.tansoole.com/',
            descZh: '化学实验器具购买',
            descEn: 'Lab equipment purchasing',
          },
          {
            name: '科学指南针',
            url: 'https://www.shiyanjia.com/firstabout.html',
            descZh: '实验检测与仪器测试服务',
            descEn: 'Lab testing services',
          },
        ],
      },
      {
        id: 'reference',
        titleZh: '参考资料',
        titleEn: 'Reference',
        links: [
          {
            name: 'e-Anatomy · IMAIOS',
            url: 'https://www.imaios.com/cn/e-anatomy/anatomical-structures/corpus-humanum-1536921092',
            descZh: '人体影像学解剖图谱',
            descEn: 'Human anatomy imaging atlas',
          },
          {
            name: 'Britannica',
            url: 'https://www.britannica.com/',
            descZh: '综合百科（含化学等）',
            descEn: 'General encyclopedia',
          },
          {
            name: '化工百科',
            url: 'https://www.chembk.com/cn',
            descZh: '物质物理、化学属性查询',
            descEn: 'Chemical properties lookup',
          },
          {
            name: '元素周期表 PRO',
            url: 'https://periodic-table-pro.netlify.app/pages/index/index',
            descZh: '在线元素周期表',
            descEn: 'Interactive periodic table',
          },
          {
            name: '中文数学 Wiki',
            url: 'https://math.fandom.com/zh/wiki/%E4%B8%AD%E6%96%87%E6%95%B0%E5%AD%A6_Wiki:%E4%B8%BB%E9%A1%B5',
            descZh: '数学资料参考社区',
            descEn: 'Math reference wiki',
          },
          {
            name: '国学大师',
            url: 'https://www.guoxuedashi.net/',
            descZh: '古籍检索、部件查字、书法诗词',
            descEn: 'Classics and calligraphy search',
          },
        ],
      },
    ],
  },
  {
    id: 'misc',
    titleZh: '其它',
    titleEn: 'Miscellaneous',
    links: [
      {
        name: 'Google',
        url: 'https://www.google.com.hk/?hl=zh-CN',
        descZh: '搜索引擎',
        descEn: 'Search engine',
      },
      {
        name: 'DeepSeek',
        url: 'https://chat.deepseek.com/',
        descZh: 'AI 对话助手',
        descEn: 'AI chat assistant',
      },
      {
        name: '文心一言',
        url: 'https://yiyan.baidu.com/',
        descZh: '百度 AI 对话',
        descEn: 'Baidu AI assistant',
      },
      {
        name: '雨云',
        url: 'https://www.rainyun.com/bt',
        descZh: '云服务器与托管',
        descEn: 'Cloud hosting',
      },
      {
        name: '魔咒百科词典',
        url: 'https://aitag.top/',
        descZh: 'AI 绘画 tag 生成器',
        descEn: 'AI art prompt tags',
      },
      {
        name: '1001 Fonts',
        url: 'https://www.1001fonts.com/',
        descZh: '英文字体与艺术字检索',
        descEn: 'English fonts',
      },
      {
        name: '词典网',
        url: 'https://www.cidianwang.com/',
        descZh: '书法检索，可用于集字',
        descEn: 'Calligraphy search',
      },
      {
        name: '青柠起始页',
        url: 'https://limestart.cn/',
        descZh: '浏览器起始页',
        descEn: 'Browser start page',
      },
      {
        name: '致美化 · 桌面主题',
        url: 'https://zhutix.com/pc/',
        descZh: 'Windows 桌面主题与美化',
        descEn: 'Windows desktop themes',
      },
      {
        name: 'Files',
        url: 'https://files.community/',
        descZh: 'Windows 文件管理器增强',
        descEn: 'Modern file manager',
      },
      {
        name: 'QSpace',
        url: 'https://qspace.awehunt.com/en-us/index.html',
        descZh: 'macOS 文件管理器',
        descEn: 'Better Finder for macOS',
      },
      {
        name: 'Terraining',
        url: 'https://terraining.ateliernonta.com/',
        descZh: 'Cities: Skylines 高度图生成',
        descEn: 'CS heightmap generator',
      },
    ],
  },
];
