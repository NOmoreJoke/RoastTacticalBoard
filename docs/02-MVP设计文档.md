# 《吐槽战术板》MVP 设计文档（V0.1）

> 版本：v0.9　|　日期：2026-09-14　|　上游文档：[01-需求文档-PRD](./01-需求文档-PRD.md)

---

## 1. 技术选型与理由

| 决策 | 选择 | 理由 |
|---|---|---|
| 框架 | 微信原生小程序（WXML/WXSS/JS） | 零构建链、开发者工具直接打开、明日即可走备案上传流程；无跨端诉求 |
| 后端 | **无**（MVP 纯本地存储 `wx.setStorageSync`） | 无需服务器与域名备案，隐私合规最简；云端化在 V0.2（云开发） |
| 画布 | Canvas 2D 新接口（`type="2d"`） | 官方推荐，性能好，DPR 适配简单 |
| 模块化 | CommonJS（`require/module.exports`） | 小程序原生支持，Jest 可直接测试，无需 Babel |
| 测试 | Jest 29（纯逻辑单测） | 见 [04-测试与CI方案](./04-测试与CI方案.md) |
| CI | GitHub Actions | lint + test + （可选）miniprogram-ci 预览 |

## 2. 工程结构

```
├── docs/                     # 本系列文档
├── miniprogram/              # 小程序源码（project.config.json 中声明为 miniprogramRoot）
│   ├── app.js / app.json / app.wxss / sitemap.json
│   ├── pages/
│   │   ├── index/            # 首页：选运动 + 我的板列表 + 导入吐槽码
│   │   ├── editor/           # 编辑器：画布 + 球员 + 箭头 + 气泡（核心页）
│   │   ├── detail/           # 详情：回放展示 + 点赞 + 分享
│   │   ├── profile/          # 我的形象 + 球员名单 + 自定义标签
│   │   └── ranking/          # 本机吐槽排行榜
│   └── utils/                # 纯逻辑层（全部可被 Jest 测试）
│       ├── board.js          # 板数据模型：创建/校验/吐槽值/榜单聚合
│       ├── tags.js           # 标签库：预置称号/自定义/校验
│       ├── safety.js         # 本地攻击性词过滤
│       ├── avatar.js         # 形象方案（色×表情×号码）
│       ├── courts.js         # 球场配置与绘制（篮球/足球）
│       ├── share.js          # 吐槽码编解码（版本化 + 校验和）
│       ├── storage.js        # 存储层（wx 可注入，便于单测）
│       └── format.js         # 时间/数字格式化等小工具
├── tests/                    # Jest 单测（与 utils 一一对应）
├── scripts/preview.js        # （可选）miniprogram-ci 预览脚本
├── .github/workflows/ci.yml  # CI 流水线
├── project.config.json
├── jest.config.js / package.json / .eslintrc.json
└── README.md                 # 含《明日备案部署操作指南》
```

**分层原则**：`utils/` 全部为纯函数/可注入依赖，禁止直接引用 `wx` 全局（storage.js 通过参数注入）；页面层只做交互编排。这保证核心逻辑 80%+ 覆盖率与 CI 可跑。

## 3. 数据模型（storage key：`rtb.boards` / `rtb.profile` / `rtb.roster` / `rtb.customTags`）

```js
// Profile（我的形象）
{
  id: 'u_local',              // MVP 单用户固定 id；V0.2 换 openid
  nickname: '球王本王',
  avatar: { color: '#ff5a36', emoji: '🔥', number: 23 },
  myTagIds: ['t_zuisheng'],   // 我认领的称号
}

// RosterPlayer（我的球员名单，本地）
{ id, name, avatar: { color, emoji, number }, note: '周六场认识' }

// Board（吐槽板）
{
  id: 'b_xxx',                // nanoid 风格随机 id
  schemaVersion: 1,
  sport: 'basketball' | 'football',
  title: '那记惊天横传',
  createdAt / updatedAt: ts,
  players: [{
    id: 'p_xxx',
    name: '阿强',
    source: 'roster' | 'stranger',      // 队友 or 虚拟路人
    avatar: { color, emoji, number },
    tagIds: ['t_suiyuansheshou'],       // 吐槽称号
    x: 50, y: 30,                       // 百分比逻辑坐标(0-100)，与分辨率解耦
    team: 'home' | 'away',
  }],
  arrows: [{
    id, kind: 'pass' | 'run' | 'shoot', // 传球实线/跑位虚线/出手爆炸线
    from: { x, y }, to: { x, y },       // 百分比坐标
  }],
  roasts: [{
    id,
    text: '这球你敢传？',
    tagIds: ['t_tubing'],
    targetIds: ['p_xxx'],               // @ 的球员
    x, y, likes: 0,                     // likes：MVP 本机点赞
    createdAt: ts,
  }],
}

// CustomTag（自定义标签）
{ id: 't_custom_xxx', name: '步频 певец', emoji: '🎵', category: 'technique', sport: null /*null=通用*/ }
```

**坐标规范**：所有画布元素用百分比坐标（0-100 双轴），渲染时乘以画布实际宽高 → 一套数据适配编辑画布、导出画布、详情回放三种尺寸。

## 4. 页面与交互设计

### 4.1 首页 index
- 顶部：热血风 Banner（"今晚的锅，谁来背？"）+ 两个运动大卡（🏀/⚽）点击新建板。
- "输入吐槽码导入"入口（Modal + textarea + 校验反馈）。
- 我的板列表（封面条：运动图标+标题+吐槽值+时间；操作：编辑/复制/删除）。
- 底部入口：我的形象（profile）、本机吐槽榜（ranking）。

### 4.2 编辑器 editor（核心页，状态机）

```
工具模式 toolMode: 'select' | 'pass' | 'run' | 'shoot' | 'erase'
├─ select：拖球员 token / 拖气泡 / 点球员或气泡弹出编辑面板
├─ pass|run|shoot：在画布空白处按下→拖动→抬起，生成一条箭头（吸附到最近球员中心，阈值 6%）
└─ erase：点击箭头命中区（点到线段距离 < 2%）删除；支持撤销栈（仅箭头增删，深度 20）
```

- 画布：Canvas 2D 画球场+箭头（player 移动时重绘）；球员 token 和气泡是**绝对定位 view**（拖拽体验优先，避免 canvas 命中实现的复杂度）。
- 添加球员：底部抽屉 → 「从名单选」/「新建队友」/「生成路人」（随机虚拟角色：前缀称呼×形象×随机名，如"帽衫神秘人·鞋哥"）；同名自动追加 `#号码`。
- 球员编辑面板：改名、选形象、选/贴标签、换队伍、删除。
- 气泡编辑面板：文本（≤60 字，敏感词过滤）+ 模板一键填充 + 多选标签 + 多选 @ 球员。
- 顶栏：标题（可编辑）、保存、出图（跳导出流程）、撤销、清空箭头。

### 4.3 导出与分享（editor 内完成）
1. 隐藏导出画布 750×1000：白底海报框 → 标题+运动角标 → 球场 → 箭头 → 球员（圆+emoji+号码+名字）→ 气泡（漫画泡）→ 底部水印「纯属娱乐 · 友尽不负责 · 吐槽战术板」。
2. `wx.canvasToTempFilePath` → 预览弹层：保存相册（授权处理）/ 图片分享（`wx.showShareImageMenu`）/ 转发卡片（`onShareAppMessage` 用该图）。

### 4.4 详情页 detail
- 只读回放（同渲染管线，token 不可拖），每条气泡可点「太真实了😅」+1（本机）。
- 分享按钮组同 4.3；顶部展示本板吐槽值。

### 4.5 我的 profile
- 三段：我的形象（昵称+形象选择器）、我的球员名单（增删改）、我的称号与自定义标签管理。

### 4.6 本机吐槽榜 ranking
- 聚合本机所有板：按 `targetIds` 聚合吐槽值 → Top20 领奖台样式（🥇🥈🥉+火焰）；榜内展示「名字·称号」组合（为 V0.3 同名区分埋点）。

## 5. 关键技术方案

### 5.1 逻辑坐标与拖拽
- 画布容器 `position: relative`；token `position: absolute; left: x%; top: y%; transform: translate(-50%,-50%)`。
- 拖拽：`catchtouchmove` 中 `clientX/Y - 容器左上角` → 百分比坐标（容器 rect 通过 SelectorQuery 缓存）。
- 箭头重绘：token 移动结束（touchend）时全量重绘箭头（箭头吸附过的端点跟随球员）——实现上：绘制时若端点距某球员中心 < 吸附阈值，则记录 `attach: playerId`，球员移动后按当前坐标重算。

### 5.2 球场绘制（courts.js 数据驱动）
```js
courts = {
  basketball: { aspect: 1.5, paint(ctx, w, h) { /* 中圈、三分线、油漆区、篮板 */ } },  // aspect = h/w
  football:   { aspect: 1.3, paint(ctx, w, h) { /* 中线中圈、禁区、小禁区、点球点、球门 */ } },
}
```
全部用线框+底色，二次元漫画描边（粗描边+亮色）由统一 `strokeStyle` 约定。

### 5.3 吐槽码（share.js）
- 编码：`JSON → UTF-8 bytes → base64url → 'RTB1.' + payload + '.' + checksum(前 4 位 hex)`。
- 校验和：FNV-1a 32 位，防止剪贴板截断/篡改导致的静默坏数据。
- 解码：trim → 前缀校验 → base64url 解码 → checksum → JSON → `validateBoard()`（schemaVersion、必填字段、枚举值、数量上限、坐标范围裁剪）。

### 5.4 敏感词过滤（safety.js）
- MVP 本地词库（辱骂/歧视/政治等类别约 100+ 词，支持全角/间隔符变体归一化）。
- 应用点：自定义标签、吐槽文本、板标题、球员名。命中 → 拒绝保存并提示"换个友好的说法吧～"。

### 5.5 存储层（storage.js）
- 注入式：`createStorage(backend = wx)`；接口 `get(key, def) / set(key, val) / remove(key)`。
- 板集合操作：`listBoards() / getBoard(id) / saveBoard(board) / removeBoard(id) / duplicateBoard(id)`；写入前 `validateBoard` + 单板体积上限（200KB，超出拒绝并提示）。

## 6. UI 风格规范（热血动漫搞笑风）

- 主色：`#ff5a36` 热血红橙；辅色：`#ffc93c` 能量黄、`#1a1a2e` 深夜蓝底、`#21c78a` 球场绿。
- 字体：系统字体 + 大字重标题；标题类文字用 CSS 双层 text-shadow 做"漫画描边"。
- 元素语汇：速度线背景（repeating-linear-gradient）、爆炸贴纸（旋转徽章"咚!!"）、对话泡带尾巴、领奖台、火焰 emoji 计数。
- 动效：卡片入场 `scale+shake`；点赞火焰 +1 飘字；保存成功"必杀技式"闪屏一瞬（200ms）。

## 7. 兼容与降级

| 场景 | 策略 |
|---|---|
| 低版本基础库无 `showShareImageMenu` | 隐藏该按钮，仅保留保存相册+卡片转发 |
| 相册授权被拒 | 引导 `wx.openSetting` |
| Canvas 初始化失败 | Toast 提示 + 静态 SVG 兜底说明（MVP：提示重启小程序） |
| 存储超限（10MB） | 列表页提示清理最旧板 |

## 8. 对后续版本的预留

- `schemaVersion` 字段 + `validateBoard` 版本分支 → 分享码向后兼容。
- `player.source='stranger'` 与 `tagIds` 组合即为 V0.3"同名区分"雏形。
- `board.circleId`（V0.3 增加字段）与 `roastValue` 聚合逻辑已按圈子维度设计，MVP 的本机榜函数 `aggregateRoastValue(boards)` 直接复用为圈子榜。
