# QTA V2-1 数据中心前端实现记录（2026-08-16）

> 任务契约：后端仓库 `docs/development/tasks/QTA-V2-DATA-FOUNDATION-V21-CONTRACT.md`（AC-07）；分支 `codex/qta-v2-data-foundation-v21`（候选 commit `601be32`，未 push，待 Codex 独立验收）。后端 API 契约见后端仓库 `docs/api/MARKET_DATA_API.md` §7。

## 1. 工程结构（feature-based）

```text
src/features/data-foundation/
├── model/types.ts            # 18 端点全量 VO 类型（字段名与后端 VO 逐一对齐）
├── model/format.ts           # null→'--'、ratio→百分比、严格 YYYY-MM-DD 校验、状态颜色映射、2021/chunkSize 边界常量
├── api/dataFoundationApi.ts  # 仅 remote：共享 client + unwrap/unwrapNullable；导入用 FormData（不手动设 Content-Type）
├── hooks/useDataFoundation.ts# 9 个查询 + 7 个 mutation，retry:false，全部以 apiMode==='remote' 门控，操作后 invalidate
└── components/
    ├── BackfillTaskForm.tsx      # 创建任务：数据集下拉派生 market/provider/frequency/adjust；日期顺序/2021 边界/chunkSize 1-500 校验
    ├── BackfillTaskTable.tsx     # 任务列表：状态 Tag、计划/成功/失败/跳过、写入/更新
    ├── BackfillTaskDrawer.tsx    # 详情：分片表（attempts/计数/lastError）+ 启动/继续、暂停、重试失败分片（按状态禁用）
    ├── DatasetVersionPanel.tsx   # 数据集选择、版本表（发布按钮仅 QUALIFIED 可用）、当前发布版本描述
    ├── CoverageQualityPanel.tsx  # 质量结果（FAIL 红/WARN 橙）+ 覆盖率（百分比）
    ├── ImportPanel.tsx           # kind 选择 + 上传 + 最近批次 + 错误报告展开
    └── ImportBatchTable.tsx      # 批次表（新增/更新/跳过/拒绝）
```

页面：`src/pages/data-foundation.tsx`（Tabs 回补任务/数据集与版本/导入）+ `data-foundation.css`（≤768px 可用）；路由 `/data-foundation` + 菜单"数据中心"（DatabaseOutlined）。

## 2. 状态纪律

- loading（Skeleton）/ empty（Empty）/ error（Alert 展示后端 `DATA_FOUNDATION_*` message + 重试）/ partial（PARTIAL_FAILED/REJECTED 等明确标识；发布按钮按版本状态禁用）。
- null 数字显示 `--` 不显示 0；remote 失败禁止回退 mock；**mock 模式仅渲染 `data-foundation-mock-unavailable` 提示且不发起任何 API 请求**（数据中心无任何本地演示数据，与市场全景修复后口径一致）。

## 3. 测试与门禁

- `api/dataFoundationApi.test.ts`（11 用例）：参数拼装、业务失败 reject、FormData 构造、mock 设置下仅走 HTTP 无本地合成。
- `src/pages/data-foundation.test.tsx`（9 用例，F01-F07）：表单校验与创建、任务列表状态、分片失败原因与重试、覆盖率与质量渲染（FAIL/WARN 标色）、导入结果与错误报告、mock 模式不调 api 不出假数据、remote 失败错误+重试无假数据。
- 门禁：typecheck / lint / **test 55 files 441 tests** / build / `git diff --check` 全绿；架构门禁 errors=0（3 条 JSX 组合方法 WARN 已声明）。

## 4. 浏览器验收（remote 模式，Docker 真实后端）

真实数据渲染：回补任务表（id=1 CN_DAILY_BAR SUCCEEDED 1/1/0/0、写入/更新 0/3）；数据集与版本（v2 RELEASED 发布按钮禁用、v1 REJECTED 发布按钮禁用、当前发布版本 v2、选中行显示覆盖率 100% 与 13 族质量结果）；导入（批次列表 4 条真实批次、计数 3/0/0/0、错误报告 `--`）。
截图：`docs/development/screenshots/data-foundation-{backfill,versions-quality,imports}.png`。
运行时链路证据（curl 全程）：后端仓库 `docs/development/tasks/QTA-V2-DATA-FOUNDATION-V21-RUNTIME-VERIFICATION.md`。

## 5. 遗留

- 后端建数据集/手动建版本接口未暴露 UI（契约交付物外；后端内置 `CN_DAILY_BAR` 可直接用于回补）。
- 候选未独立验收、未 push；服务器部署 NOT_DEPLOYED。
