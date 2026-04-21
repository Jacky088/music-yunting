# Music888 全面治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在尽量不动现有结构的前提下，完成 Music888 的全量审计、主链路修复、保守整合、桌面与移动双端打磨，并通过浏览器实测与自动化验证确认核心功能稳定可用。

**Architecture:** 以现有 `index.html + js/main.ts + js/ui.ts + js/api/* + js/player/* + css/* + functions/api/proxy.js` 为主干，不做激进重构，优先补足测试和浏览器验证能力，再按 P0 到 P3 分层整改。实现上通过统一状态反馈、补齐浏览器回归测试、收敛页面交互状态和列表渲染行为来提升一致性与可维护性。

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, Cloudflare Pages Functions, Playwright

---

## 实施前说明

- 当前基线验证结果：
  - `npm run build` 失败，原因是缺少 `@rollup/rollup-linux-x64-gnu`
  - `npm run test:run` 同样被这个 Rollup 可选依赖问题阻断
- 仓库当前处于脏工作区，执行时只处理本计划列出的文件，禁止覆盖无关改动
- 本轮目标是保守整合，不做三栏大改版，不删除主功能

### Task 1: 修复构建基线并补齐浏览器回归测试骨架

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Create: `tests/e2e/mobile-smoke.spec.ts`

- [ ] **Step 1: 先写浏览器冒烟用例，让“主页面加载 + 核心区域可见”先失败**

```typescript
import { test, expect } from '@playwright/test';

test('桌面端主界面可见', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#searchInput')).toBeVisible();
  await expect(page.locator('#playBtn')).toBeVisible();
  await expect(page.locator('#playlistActionBtn')).toBeVisible();
});
```

- [ ] **Step 2: 运行新用例，确认当前环境先失败**

Run: `npx playwright test tests/e2e/smoke.spec.ts`
Expected: FAIL，原因应为未配置 Playwright 或本地服务未就绪，而不是断言写错

- [ ] **Step 3: 修复工具链基线并补齐 Playwright 配置**

实施内容：
- 在 `package.json` 增加 `test:e2e`、`test:e2e:headed` 等脚本
- 安装并写入 Playwright 依赖和锁文件
- 通过重新安装依赖修复 Rollup 可选依赖缺失问题
- 在 `playwright.config.ts` 中配置 `baseURL`、本地 `webServer`、桌面与移动端项目

建议配置片段：

```typescript
webServer: {
  command: 'npm run dev -- --host 127.0.0.1 --port 4174',
  url: 'http://127.0.0.1:4174',
  reuseExistingServer: true,
  timeout: 120000,
}
```

- [ ] **Step 4: 运行单测、构建和桌面/移动冒烟测试，确认基线恢复**

Run: `npm run test:run`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/mobile-smoke.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts playwright.config.ts tests/e2e/smoke.spec.ts tests/e2e/mobile-smoke.spec.ts
git commit -m "test: add browser smoke baseline"
```

### Task 2: 建立主链路审计支点并统一关键状态反馈

**Files:**
- Modify: `index.html`
- Modify: `js/main.ts`
- Modify: `js/ui.ts`
- Modify: `js/types.ts`
- Modify: `js/ui.test.ts`
- Create: `js/main.test.ts`

- [ ] **Step 1: 先写失败测试，锁定“搜索触发、统一动作按钮、错误/空状态反馈”**

```typescript
it('切换歌单动作时应同步更新输入占位和按钮文案', async () => {
  document.body.innerHTML = `
    <select id="playlistActionSelect">
      <option value="user">用户歌单</option>
      <option value="radio">电台FM</option>
      <option value="playlist">歌单解析</option>
    </select>
    <input id="playlistActionInput" />
    <button id="playlistActionBtn"><i></i><span>加载</span></button>
  `;
});
```

- [ ] **Step 2: 运行相关测试，确认当前失败点真实存在**

Run: `npx vitest run js/ui.test.ts js/main.test.ts`
Expected: FAIL，失败原因应指向缺失的状态同步函数或不可测试的内联逻辑

- [ ] **Step 3: 实现统一状态反馈与可测试选择器**

实施内容：
- 在 `index.html` 为关键区域补充稳定的 `id` / `data-testid`
- 将 `main.ts` 中与“我的”面板动作切换、主区域切换、回退和搜索触发相关的分散 DOM 更新收敛成可复用函数
- 在 `ui.ts` 中统一空状态、加载态、错误态的渲染入口，避免不同模块自行拼接结构
- 在 `types.ts` 中补充状态模型类型，减少字符串散落

- [ ] **Step 4: 跑单测确认状态同步和 UI 反馈逻辑稳定**

Run: `npx vitest run js/ui.test.ts js/main.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html js/main.ts js/ui.ts js/types.ts js/ui.test.ts js/main.test.ts
git commit -m "refactor: unify shell state feedback"
```

### Task 3: 修复核心主链路并补齐浏览器回归

**Files:**
- Modify: `js/main.ts`
- Modify: `js/ui.ts`
- Modify: `js/api.ts`
- Modify: `js/api/client.ts`
- Modify: `js/api/search.ts`
- Modify: `js/api/music.ts`
- Modify: `js/player/control.ts`
- Modify: `js/player/core.ts`
- Modify: `js/player/events.ts`
- Modify: `js/ui.test.ts`
- Create: `tests/e2e/core-flows.spec.ts`

- [ ] **Step 1: 先写失败的浏览器主链路测试**

覆盖链路：
- 搜索 -> 结果展示
- 点击歌曲 -> 播放器信息更新
- 收藏 -> 右栏计数更新
- 历史 -> 播放后记录可见
- 排行榜切换 -> 列表刷新

示例断言：

```typescript
await page.getByRole('button', { name: /搜索/i }).click();
await expect(page.locator('#searchResults .song-item').first()).toBeVisible();
await page.locator('#searchResults .song-item').first().click();
await expect(page.locator('#currentTitle')).not.toHaveText('未选择歌曲');
```

- [ ] **Step 2: 运行浏览器用例，确认失败来自真实链路问题**

Run: `npx playwright test tests/e2e/core-flows.spec.ts`
Expected: FAIL，失败点应能定位到搜索、播放、收藏或历史链路中的真实问题

- [ ] **Step 3: 做最小实现修复，优先保主链路**

实施内容：
- 修复 `main.ts` 中事件绑定与视图切换的竞态和遗漏
- 修复 `ui.ts` 列表点击、收藏按钮、批量播放、空状态恢复的一致性问题
- 修复 `api/client.ts` / `api/search.ts` / `api/music.ts` 的错误冒泡与前端提示不一致
- 修复 `player/*` 中当前歌曲状态、按钮状态、历史记录同步问题

- [ ] **Step 4: 重新运行单测和浏览器主链路用例**

Run: `npx vitest run js/ui.test.ts js/utils.test.ts js/config.test.ts`
Expected: PASS

Run: `npx playwright test tests/e2e/core-flows.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/main.ts js/ui.ts js/api.ts js/api/client.ts js/api/search.ts js/api/music.ts js/player/control.ts js/player/core.ts js/player/events.ts js/ui.test.ts tests/e2e/core-flows.spec.ts
git commit -m "fix: stabilize core playback flows"
```

### Task 4: 完成歌手、电台、“我的”三条副链路的保守整合

**Files:**
- Modify: `index.html`
- Modify: `js/main.ts`
- Modify: `js/ui.ts`
- Modify: `js/api/search.ts`
- Modify: `js/api/music.ts`
- Modify: `css/components.css`
- Modify: `css/player.css`
- Modify: `js/ui.test.ts`
- Create: `tests/e2e/discovery-flows.spec.ts`

- [ ] **Step 1: 写失败测试，覆盖歌手、电台、我的三条副链路**

覆盖链路：
- 歌手筛选 -> 歌手详情 -> 专辑 -> 专辑歌曲 -> 返回
- 电台分类 -> 节目列表 -> 播放 -> 返回
- “我的”动作选择器 -> 用户歌单 / 电台添加 / 歌单解析

- [ ] **Step 2: 运行用例并记录失败点**

Run: `npx playwright test tests/e2e/discovery-flows.spec.ts`
Expected: FAIL，且失败点能归类为返回路径、状态同步、空状态、列表渲染或动作反馈问题

- [ ] **Step 3: 进行保守整合**

实施内容：
- 统一“我的”输入区的占位文案、按钮禁用态、提交中态和成功失败反馈
- 统一歌手/专辑/电台列表的标题、回退、加载态、空状态结构
- 修复详情子视图切换后残留状态、列表不刷新的问题
- 保留原结构，不合并主模块，只清理重复表达和不一致行为

- [ ] **Step 4: 运行浏览器副链路测试和相关单测**

Run: `npx playwright test tests/e2e/discovery-flows.spec.ts`
Expected: PASS

Run: `npx vitest run js/ui.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html js/main.ts js/ui.ts js/api/search.ts js/api/music.ts css/components.css css/player.css js/ui.test.ts tests/e2e/discovery-flows.spec.ts
git commit -m "refactor: align discovery and library flows"
```

### Task 5: 打磨桌面与移动端布局，收口视觉噪音和操作成本

**Files:**
- Modify: `index.html`
- Modify: `css/layout.css`
- Modify: `css/mobile.css`
- Modify: `css/components.css`
- Modify: `css/player.css`
- Modify: `css/lyrics.css`
- Modify: `css/animations.css`
- Create: `tests/e2e/layout-regression.spec.ts`

- [ ] **Step 1: 先写失败的布局回归测试**

目标断言：
- 桌面端三栏无横向溢出
- 移动端顶部搜索和底部页码不遮挡关键控件
- 关键按钮在首屏内可点
- 详情视图返回按钮在移动端始终可见

- [ ] **Step 2: 运行布局用例，确认桌面/移动端现有问题**

Run: `npx playwright test tests/e2e/layout-regression.spec.ts`
Expected: FAIL，失败点应定位为溢出、遮挡、视口内不可见、点击区域过小等问题

- [ ] **Step 3: 实现最小布局调整**

实施内容：
- 调整 `layout.css` 中三栏宽度、最小宽度和高度策略，减少挤压与空耗
- 调整 `mobile.css` 中导航高度、搜索条固定方式、页面容器滚动策略和底部分页指示器位置
- 调整组件间距、标题栏和播放器操作区密度，确保简洁且易操作
- 保持原有信息架构，不大改视觉风格

- [ ] **Step 4: 运行布局回归与移动端冒烟**

Run: `npx playwright test tests/e2e/layout-regression.spec.ts tests/e2e/mobile-smoke.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html css/layout.css css/mobile.css css/components.css css/player.css css/lyrics.css css/animations.css tests/e2e/layout-regression.spec.ts
git commit -m "style: polish desktop and mobile layout"
```

### Task 6: 加固代理与异常处理，完成整体验证闭环

**Files:**
- Modify: `functions/api/proxy.js`
- Modify: `js/api/client.ts`
- Modify: `js/api/utils.ts`
- Modify: `js/ui.ts`
- Create: `functions/api/proxy.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 先写失败测试，覆盖代理错误与前端异常提示**

测试目标：
- 非法 `url` 参数返回 400
- 不允许域名返回 403
- 限流返回 429
- 前端拿到异常时能给出统一错误提示而非静默失败

- [ ] **Step 2: 运行测试，确认失败原因正确**

Run: `npx vitest run functions/api/proxy.test.ts js/ui.test.ts`
Expected: FAIL，失败点应与当前代理错误封装或前端错误映射不一致有关

- [ ] **Step 3: 实现异常治理**

实施内容：
- 统一 `proxy.js` 的 JSON 错误结构和 CORS 响应头
- 在 `api/client.ts` / `api/utils.ts` 中统一错误对象规范
- 在 `ui.ts` 中根据错误类型输出更清晰、不过度惊扰的反馈

- [ ] **Step 4: 运行全量验证**

Run: `npm run test:run`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `npx playwright test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/api/proxy.js functions/api/proxy.test.ts js/api/client.ts js/api/utils.ts js/ui.ts package.json
git commit -m "fix: harden proxy and error handling"
```

### Task 7: 浏览器终验与人工验收记录

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/reports/2026-03-21-music888-governance-report.md`

- [ ] **Step 1: 用桌面与移动双视口做人工终验**

终验清单：
- 搜索、排行榜、歌手、电台、“我的”全部可走通
- 播放、歌词、收藏、历史、下载有明确反馈
- 刷新恢复后状态正常
- 异常情况下页面仍可理解、可恢复

- [ ] **Step 2: 记录剩余风险与验证证据**

将以下内容写入报告：
- 修复项摘要
- 自动化验证结果
- 浏览器人工复测结果
- 外部接口依赖带来的剩余风险

- [ ] **Step 3: 更新 README 中的测试与验证说明**

补充内容：
- 如何运行 Playwright 冒烟与回归测试
- 如何执行桌面/移动端验收

- [ ] **Step 4: 运行最终命令确认**

Run: `npm run test:run && npm run build && npx playwright test`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/reports/2026-03-21-music888-governance-report.md
git commit -m "docs: record governance validation report"
```

