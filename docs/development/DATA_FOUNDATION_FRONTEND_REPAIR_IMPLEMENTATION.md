# QTA V2-1 数据底座前端修复收口实现记录（2026-08-16）

> 分支 `codex/qta-v2-data-foundation-v21`（基线 `1e42f5e`）。本轮为 /data-foundation 定点修复，
> 遵守冻结 API 契约（QUEUED 异步执行 / POST /imports 可选 datasetVersionId / DatasetVersion 可选
> contentHash·manifestRowCount·lineageStatus / 现有路径全部保留）。状态：**SELF_CHECKED**（待独立验收）。
> 仅修改前端仓库；后端并行修复，本轮不等待后端。
>
> **Repair 轮（基于 `be5fb10`）**：用途隔离 / 创建反馈 / 表单收口，见文末"六、Repair 轮收口"。

## 一、修复内容（对齐任务八节要求）

### 1. 后台任务交互（QUEUED 异步契约）
- `BackfillTaskStatus` 新增 `QUEUED`；`TASK_STATUS_COLOR/LABEL` 同步（中文标签：待启动/排队中/执行中/
  已暂停/部分失败/已失败/已成功，title 保留原始状态码）。
- 轮询（TanStack Query `refetchInterval`，不用 setInterval）：任务详情按自身状态、任务列表按当前页
  是否存在活跃任务（PENDING/QUEUED/RUNNING）、分片由抽屉传入 `poll`；全部 2000ms，终态或 PAUSED 自动
  停止；抽屉关闭（id=null）即禁用查询不轮询；卸载由 Query 取消订阅兜底。
- run 快速返回后立即 invalidate 任务详情/分片/列表/版本（不等待轮询）。
- 防重复启动：`disabled`（QUEUED/RUNNING/SUCCEEDED）+ `loading` + **同步 ref 守卫**
  （TanStack 状态通知经宏任务批处理，同步连击期间 isPending 未重渲染，ref 在 mutate 调用点同步置位、
  onSettled 复位；G03 测试锁定三次连击仅 1 次请求）。
- QUEUED 与 RUNNING 均可暂停；暂停/重试按钮同样有 isPending 守卫。
- 分片二维信息：窗口（startDate~endDate 列）、证券数、attempts、写入/更新/跳过/失败。
- 不显示假进度百分比：仅真实分片计数（成功/失败/总数）。
- 页面 transition effect：活跃任务进入终态（仍在本页）后一次性刷新版本与发布指针；分页离开当前页不触发。

### 2. 全新部署初始化闭环
- 新组件 `DatasetCreateModal`（POST /datasets）：datasetCode（大写字母开头 3-64 校验）/datasetName/
  Provider 下拉；market=CN、barType=DAILY、frequency=1D、adjust=NONE 以禁用单选项固定（首期冻结组合
  `DATASET_PROVIDER_OPTIONS`：TENCENT_PUBLIC 实验源 / IMPORT_CSV_DAILY 导入通道，防随意输入）；
  description 可选；业务失败展示后端 message。
- 空数据集创建入口（不只空下拉）：DatasetVersionPanel 空态卡（create-dataset-entry）+ 工具栏常驻
  新建数据集按钮；BackfillTaskForm 数据集为空时 Alert+入口；ImportPanel 新建导入数据集（预选
  IMPORT_CSV_DAILY）。
- 创建成功：invalidate datasets + 自动选中（版本面板 onSelectDataset / 任务表单 setFieldValue /
  导入面板 setImportDatasetCode）。

### 3. 导入类数据集与版本闭环
- DAILY_BAR 上传前必须：选择导入类数据集（provider 前缀 `IMPORT_` 过滤）→ 选择 DRAFT 版本或新建。
- 新组件 `VersionCreateModal`（POST /datasets/{code}/versions，body startDate/endDate，日期严格校验）；
  创建成功自动选中新版本 id。
- 上传携带 `datasetVersionId`（仅 DAILY_BAR）；universe/calendar/taxonomy/membership 不强制版本，
  切换非 DAILY_BAR 隐藏版本选择区。
- 导入成功 invalidate：imports/versions/coverage/quality。
- ImportBatch 新增可选 `datasetVersionId`；批次表新增"关联版本"列（null 显示 '--'）；结果卡标题带版本号。
- 无 DRAFT 版本时给出明确提示（"该数据集暂无 DRAFT 版本，请新建版本后再上传"）；不生成虚构版本或假成功。

### 4. 版本与质量展示
- DatasetVersion 可选新字段：`contentHash`（缩略 前8…后4，title 全文）、`manifestRowCount`（清单行数列）、
  `lineageStatus`（血缘列 Tag；非 OK/VERIFIED 视为异常显示 warning，不宣称可复现）。旧后端 null → '--'
  兼容。
- 发布仅 QUALIFIED 可点（REJECTED/RELEASED 均禁用）；RELEASED 行显示"当前发布"标记。
- REJECTED 行可展开查看主要失败质量项（`RejectedFailList` 按需拉取该版本质量结果，FAIL 全列）。
- CoverageQualityPanel：存在 FAIL 时顶部"发布门禁阻断"Alert（FAIL 全列 + WARN 单列一行 +
  REJECTED 说明）；区分 WARN/FAIL 着色；不展示没有来源的百分比。
- 质量检查成功后 invalidate：quality/coverage/versions/released（一次性集合，避免风暴）。

### 5. 页面轮询与性能
- 只有存在活跃任务才轮询；无永久 refetchInterval；终态停止并刷新版本列表（transition effect）；
  Drawer 关闭不轮询；mutation invalidate 均为有界集合。

## 二、测试（Vitest，聚焦 37 用例 + 全量 458）

- 新增 `useDataFoundation.polling.test.tsx`（真实定时器）：详情 QUEUED→2s 轮询→SUCCEEDED 停止；
  列表活跃轮询→全终态停止；分片 poll=true/false。
- 页面测试重写扩充（20 用例）：F01-F07 既有语义保留（F02 状态断言更新为中文标签、原 F05 上传改造为
  版本闭环流程）+ 新增 G01-G12：QUEUED 渲染/暂停/启动禁用、run 快速返回后立即刷新、三次连击仅 1 次
  run、分片二维窗口、空数据集创建入口、创建数据集成功自动选中、DAILY_BAR 未选版本禁止上传、上传携带
  datasetVersionId、非 DAILY_BAR 不强制版本、新建版本调用与参数、contentHash/manifestRowCount/
  lineageStatus 展示（含异常 warning）、REJECTED 发布禁用+展开失败项+FAIL 阻断说明。
- API 测试新增 3 用例：createDataset body、createDatasetVersion 路径与 body、datasetVersionId 参数
  传递与省略。

## 三、验证证据

- `npm run typecheck` / `lint` / **test 56 files 458 tests 全绿** / `build` / `git diff --check` 全部通过。
- 架构门禁：`node scripts/check-ai-architecture.mjs` 三种调用形式均被本会话治理 Hook 拦截
  （"governed roles must not rewrite active governance controls through Bash"）。按脚本源码阈值手动核对：
  最大文件 DatasetVersionPanel.tsx 310 行（<400 警告线、远低于 600 error 线）、无方法超 100 行、
  file-protocol 等职责标签仅在 >600 行且 >3 职责时构成 error——**无 error 级风险**。
- 真实 remote 浏览器验收（Docker qta-server 旧版 V2-1 构建 + Vite proxy）：
  - 任务列表真实数据（#1 CN_DAILY_BAR 已成功 1/1/0/0、写入 0/3）；
  - 详情抽屉（DOM 快照证据）：二维分片（chunk0 窗口 2026-07-01~2026-07-03、证券数 1、attempts 1、
    0/3/0/0）；终态下启动/暂停/重试按钮禁用全部正确；
  - 版本面板：v2 RELEASED"当前发布"标记、v1 REJECTED 可展开显示真实失败项
    （PROVIDER_ADJUST_MIXING 409 行 + UNIT_ANOMALY 1 行，与后端运行时验证记录一致）；
    新列清单行数/内容哈希/血缘在旧后端 null 下正确显示 '--'；
  - 导入面板：DRAFT 版本闭环 UI 与禁用逻辑正确；批次表"关联版本"列 '--' 兼容。
  - 截图（docs/development/screenshots/）：`data-foundation-backfill-1440x900.png`、
    `data-foundation-versions-1440x900.png`、`data-foundation-imports-1440x900.png`、
    `data-foundation-imports-390x844.png`（移动端）。
  - **NOT_CAPTURED**：抽屉视觉截图——IAB 环境点击/截图管线中途劣化（Playwright click 持续超时、
    screenshot 多次 stuck/timeout），抽屉功能以上述 DOM 快照证据为准。

## 四、仍依赖后端联调的项目（如实）

1. **QUEUED 状态真实流转**：本轮在旧后端（无 QUEUED）验证了终态与 UI 兼容；QUEUED→RUNNING→终态的
   真实轮询表现需后端并行修复部署后复验（hooks 轮询语义已由真实定时器测试锁定）。
2. **datasetVersionId 真实落库关联**：旧后端忽略该查询参数（不报错）；导入关联版本需新后端复验。
3. **contentHash/manifestRowCount/lineageStatus 真实数据**：旧后端无字段，已验证 null 兼容展示。
4. 抽屉视觉截图（环境阻断，见上）。

## 五、提交

- Stage 1 API/types/hooks：QUEUED 状态、条件轮询、创建数据集/版本 mutation、导入 datasetVersionId。
- Stage 2 页面组件与交互：Drawer/Table/Form/ImportPanel/DatasetVersionPanel/CoverageQualityPanel/
  ImportBatchTable/两个新 Modal/页面 transition effect。
- Stage 3 测试与记录：3 个测试文件、4 张截图、本文档。

不 push、不 merge；本轮 SELF_CHECKED，等待独立验收。

## 六、Repair 轮收口（基于 be5fb10，SELF_CHECKED）

### 1. 数据集用途隔离（不依赖用户理解 Provider 差异）
- 回补任务表单数据集下拉只展示 `providerCode === TENCENT_PUBLIC` 的在线回补数据集，
  `IMPORT_*` 导入类数据集被排除（`ONLINE_BACKFILL_PROVIDER` 常量冻结于 model/format）。
- 仅有导入类数据集时回补表单明确提示（"暂无支持在线回补的数据集…导入类只用于 CSV 导入页签"）
  并给出创建入口；数据集完全为空时提示全新部署创建。
- `DatasetCreateModal` 新增 `providerLocked`：回补入口锁定 TENCENT_PUBLIC、导入入口锁定
  IMPORT_CSV_DAILY（Select 禁用 + 仅锁定选项）；数据集与版本面板的通用入口不锁定（两种首期组合可选）。

### 2. 创建任务后的可见反馈
- `BackfillTaskForm.onCreated` 携带新任务对象；页面创建成功后回到任务列表第一页并**自动打开新任务
  详情抽屉**（PENDING/QUEUED 状态、任务 ID、窗口、显式证券数、分片统计一目了然），表单同时重置。
- 轮询语义不变：仅活跃任务（PENDING/QUEUED/RUNNING）2s 轮询，终态/PAUSED 停止，抽屉关闭即停。

### 3. 表单状态收口
- 两个创建 Modal（数据集/版本）：`destroyOnHidden` 重开自动重建表单；关闭（任意途径）与成功时
  `mutation.reset()` 清理上一次错误态，重开不残留（G17 锁定）。
- 切换导入数据集时清空不属于新数据集的版本选择（既有 onChange 行为，本轮复核保留）。
- 结束日期晚于今天：`warningOnly` 前端提示（不阻断提交，提示文案注明"提交后以后端校验为准"），
  覆盖回补表单与版本创建 Modal（`todayDateString()` 本地时区）。
- 后端错误仍展示真实 message，不伪造成功（既有 Alert 路径不变）。

### 4. 测试（页面 20→26 用例，全量 458→464）
- G13 回补下拉排除 IMPORT_CSV_DAILY；G13b 仅导入类数据集时的提示与创建入口；
- G14/G15 两个创建入口 Provider 锁定（antd disabled class + 仅锁定选项文本）；
- G16 创建成功自动打开 #77 新任务抽屉（待启动/窗口/分片统计/表单重置）；
- G17 Modal 重开清理上一次错误。
- 既有轮询/API/页面测试全部保留并通过。

### 5. 验证
`npm run test -- --run` **56 files / 464 tests 全绿**；typecheck/lint/build/`git diff --check` 全部通过。
本轮为纯前端改动 + 测试，未做浏览器复验（上一轮 remote 验收证据仍有效；新交互由组件测试锁定）。

### 6. Repair 提交
单次 repair commit（见 git log，`repair(data-foundation): ...`），不 push、不 merge。
