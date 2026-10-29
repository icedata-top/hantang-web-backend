# ProducerInfo

显示创作者名字，悬停查看头像、简介、粉丝数、等级和认证头衔。使用现有 `fetchProducerInfo`，请求 `GET /producers/{userId}/info`，沿用 DEV / PROD / MOCK 配置。

```jsx
import ProducerInfo from './components/custom/ProducerInfo/ProducerInfo.jsx';

<ProducerInfo userId={396194} />
<ProducerInfo userId={396194} showAvatar />
```

- `userId`：正整数用户 ID，支持数字或不带前导零的十进制字符串。超过 JavaScript 安全整数范围时必须用字符串，最大为 `9223372036854775807`。无效 ID 不请求后端。
- `showAvatar`：默认 `false`，控制名字旁的 24px 头像。悬停卡片始终展示 64px 头像。
- `className`：可选，作用于行内触发元素，默认继承所在位置的字号与颜色。

组件需放在 React Router 内。卡片包含新标签页打开的 `https://space.bilibili.com/{userId}`，以及站内 `/producers/{userId}` 详情按钮。支持鼠标悬停、键盘聚焦、触屏点击；卡片打开后按 Tab 进入操作，Escape 关闭并返回名字。浮层使用当前主题的 Surface 配色。

挂载时加载账号资料；加载中、资料未收录或请求失败时，名字位置保留 `UID {userId}`。失败提供重试，未收录不等同于账号不存在。缺失粉丝数显示 `—`，真实 0 显示 `0`；缺失或加载失败的头像使用占位图标。切换 ID 或卸载时取消旧请求，避免旧资料覆盖新创作者。

预览入口：`/admin/design/components`（需开启管理入口）。默认示例 ID 为 COPY 的 `396194`；MOCK 环境使用仓库已有样本。
