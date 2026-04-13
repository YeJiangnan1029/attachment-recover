# attachment_recover

> Zotero 7 插件工程规格说明书  
> 用于在多设备之间自动恢复缺失的 PDF 附件，避免因受限网络环境导致的“元数据同步成功、附件同步失败、重复抓取产生重复条目”等问题。

---

## 1. 项目概述

`attachment_recover` 是一个运行在 **Zotero 桌面端内部** 的插件。  
它的目标不是替代 Zotero 的文件同步系统，也不是修改 Zotero Connector，而是利用 **Zotero 可同步的数据层**，为 PDF 附件保存一份“恢复描述符（Recovery Descriptor）”，从而在另一台设备上检测并恢复缺失的 PDF 附件。

### 1.1 核心问题

- 用户在公司内网环境使用 Zotero Connector 从 arXiv、IEEE 等页面抓取论文
- 文献条目元数据可以通过 Zotero 数据同步同步到云端
- 但 PDF 附件因为无法上传 WebDAV 或 Zotero Storage，不能同步到其他设备
- 回到另一台设备后，用户只能看到新文献条目，没有 PDF
- 用户若再次抓取该论文，会创建新的条目，导致重复条目与多端库不一致

### 1.2 解决思路

在抓取并保存 PDF 时，同时保存一份可同步的结构化描述信息，包括：

- PDF 原始地址
- landing page 地址
- DOI / arXiv ID
- 文件哈希
- 文件大小
- 文件名
- 恢复状态

这些信息通过 Zotero 数据同步同步到另一台设备后，插件可以：

- 检测“条目已存在但附件缺失”的情况
- 基于恢复描述符重新下载 PDF
- 校验文件完整性
- 将 PDF 添加到原条目下
- 从而恢复附件，而不是新建条目

---

## 2. 项目目标

### 2.1 总体目标

构建一个 Zotero 7 插件，实现 **“跨设备 PDF 附件自动恢复”**。

### 2.2 具体目标

1. 对 **新添加的 PDF 附件** 自动生成恢复描述符
2. 对 **历史已经存在的 PDF 附件** 支持批量补录恢复描述符
3. 在另一台设备上自动或半自动扫描缺失附件
4. 在下载前弹出确认框，由用户确认是否恢复
5. 下载成功后进行校验，并补加到已有条目下
6. 整个过程 **绝不创建新条目**
7. 提供 UI 面板显示恢复任务与状态
8. MVP 阶段优先支持 **arXiv**

---

## 3. 非目标（Out of Scope）

以下内容不属于本项目当前范围：

1. 不替代 Zotero 自带文件同步
2. 不修改或 fork Zotero Connector
3. 不实现破解付费出版商访问限制
4. 不保证对所有出版商页面都能成功恢复 PDF
5. 不处理 EPUB、图片、音视频等非 PDF 附件
6. 不做全文 OCR、摘要生成或文献分析
7. 不实现跨用户共享恢复信息
8. 不直接修改 Zotero 核心数据库结构

---

## 4. 目标用户与应用场景

### 4.1 目标用户

- 需要在公司 / 学校 / 家中多设备之间同步 Zotero 文献的用户
- 数据同步可用，但文件同步受限的用户
- 以公开论文源，尤其 arXiv，为主要来源的用户
- 希望避免重复条目并降低手工修复成本的用户

### 4.2 典型场景

#### 场景 A：公司抓取，家中恢复

- 公司内网只能下载 PDF 但不能上传 WebDAV
- 先通过插件为 PDF 生成描述符
- 回家后家用电脑自动识别缺失附件的描述符并尝试恢复 PDF

#### 场景 B：文献库 URL 备份

- 为文献库所有 PDF 生成描述符
- 附件库不可访问时可重新从互联网上自动下载

---

## 5. 已确认的设计决策

以下设计决策已由用户确认：

1. **MVP 优先支持 arXiv**
2. 恢复描述符存储在 **父条目下唯一的插件管理 attached note** 中
3. 该管理 note **由插件独占管理**，不与用户手写 note 混排
4. 一个父条目下的管理 note 中允许保存 **多个描述符**
5. 恢复 PDF 之前需要 **弹确认框**
6. 需要 **UI 面板** 显示状态与任务列表
7. 所有用户可见 UI 文案使用 **中文**

---

## 6. 技术定位

### 6.1 插件运行模型

本项目是 **Zotero 桌面级插件**，运行在 Zotero 应用内部，不是独立后台服务，不是独立守护进程，也不是浏览器插件。

从工程角度理解：

- 插件代码随 Zotero 主程序启动和关闭
- 通过 Zotero 暴露的内部 JavaScript API 访问条目、附件、搜索、通知系统
- 通过 Zotero 的 Notifier 监听新增条目 / 附件
- 可以增加菜单、命令、弹窗和面板 UI

### 6.2 技术栈建议

- **TypeScript**
- Zotero 7 插件系统
- 构建工具：基于社区常用模板（如 `zotero-plugin-template`）构建
- 模块化设计
- 尽量避免将业务逻辑与 UI 强耦合

---

## 7. 核心设计思想

### 7.1 Zotero 的同步分层

Zotero 同步机制分为两层：

- **数据同步**：条目、标签、链接、笔记等
- **文件同步**：附件文件本体（PDF 等）

本项目的关键利用点在于：

> 将“附件可恢复信息”编码为可随数据同步传播的结构化数据，从而在另一端重建附件文件。

### 7.2 为什么不用“重新抓取条目”

因为重新抓取页面通常会：

- 再次创建条目
- 引入重复
- 放大多端数据偏差

本项目必须遵守的原则：

> **只恢复附件，不新建顶层条目。**

### 7.3 为什么使用“父条目下唯一管理 note”

采用父条目级唯一管理 note，而不是写入附件 note，原因如下：

- 原始 PDF 附件在目标设备上可能根本不存在，描述符仍需可访问
- 不会误修改用户原有 note
- 更适合统一管理一个父条目下多个 PDF 描述符
- 扫描缺失附件时可直接从父条目出发
- 状态面板与恢复任务天然以父条目为上下文

---

## 8. 总体方案

### 8.1 方案概述

当 Zotero 中出现新的 PDF 附件时，插件自动执行：

1. 判断该附件是否为 PDF
2. 提取恢复相关信息
3. 计算 PDF 哈希
4. 生成恢复描述符
5. 确保父条目下存在唯一的插件管理 note
6. 将描述符写入该管理 note
7. 为父条目创建或更新用于辅助恢复的 linked URL attachment（可选但推荐）

在另一台设备上，插件执行：

1. 扫描已有父条目
2. 找出有恢复描述符但本地没有对应 stored PDF 的项目
3. 弹出确认框
4. 根据描述符尝试恢复 PDF
5. 校验文件
6. 添加到原条目下
7. 更新管理 note 中对应描述符的恢复状态

### 8.2 为什么不只存一个 PDF URL

只保存一个 URL 风险较高，因为：

- 一些 PDF 链接是临时链接
- 可能依赖 cookie / session
- 可能是机构网络下可用的代理地址
- 长期不可复现

因此必须设计为 **恢复描述符**，而不是单一 URL。

---

## 9. 恢复描述符与管理 note 设计

### 9.1 设计目标

恢复描述符及其容器应满足：

- 可被同步
- 足够小
- 可读、可扩展
- 能表达来源、校验信息、恢复状态
- 能支持一个父条目下多个 PDF
- 能被插件稳定识别和独占管理

### 9.2 TypeScript 类型定义

```ts
export interface AttachmentRecoverDescriptor {
  id: string;
  version: number;

  // 来源信息
  pdfURL?: string;
  pageURL?: string;
  doi?: string;
  arxivId?: string;
  sourceSite?: string;

  // 文件信息
  hash: string;               // sha256
  filesize: number;
  filename: string;
  mimeType: string;

  // 元信息
  createdAt: number;          // timestamp ms
  updatedAt: number;          // timestamp ms

  // 恢复状态
  status: "pending" | "downloading" | "success" | "failed";
  attemptCount: number;
  lastError?: string;

  // 调试信息
  pluginVersion?: string;
  notes?: string;
}

export interface ParentRecoverNotePayload {
  version: 1;
  descriptors: AttachmentRecoverDescriptor[];
}
```

### 9.3 存储位置

**确认方案：恢复描述符存储在父条目下唯一的插件管理 attached note 中。**

约束如下：

- 每个父条目下该 note 必须存在且唯一
- 若不存在，则由插件创建
- 若存在一个，则复用
- 若存在多个，则判定为异常状态，不自动合并
- 插件不得修改父条目下其他非管理用途的 note

### 9.4 管理 note 内容格式

由于该 note 由插件独占管理，因此推荐直接保存为单一机器可读结构，不与用户文本混排。

示例：

```json
{
  "type": "attachment_recover",
  "version": 1,
  "descriptors": [
    {
      "id": "sha256:xxxxxxxx",
      "version": 1,
      "pdfURL": "https://arxiv.org/pdf/2401.12345.pdf",
      "pageURL": "https://arxiv.org/abs/2401.12345",
      "arxivId": "2401.12345",
      "sourceSite": "arxiv",
      "hash": "sha256:xxxxxxxx",
      "filesize": 1234567,
      "filename": "2401.12345.pdf",
      "mimeType": "application/pdf",
      "createdAt": 1710000000000,
      "updatedAt": 1710000000000,
      "status": "pending",
      "attemptCount": 0
    }
  ]
}
```

推荐约束：

- note 只存插件管理数据
- 使用固定的顶层 `type` 字段标识
- 所有写入都以容器对象为单位进行读取、校验、更新、回写
- 未来如需版本迁移，以 `version` 为依据

### 9.5 描述符唯一性策略

一个父条目下可能有多个 PDF，因此需要定义描述符唯一性：

- 优先以 `hash` 作为描述符主识别键
- `id` 建议稳定生成，默认可直接使用 `hash`
- 若极端情况下无法获取 hash，再退化使用 `filename + filesize`
- backfill / enrich 时命中已有描述符则更新，不重复追加

### 9.6 linked URL attachment 的使用策略

虽然描述符主存储在父条目下的管理 note 中，但推荐额外增加以下链接型附件（Linked URL Attachment）：

- `Original PDF URL`
- `Landing Page`

目的：

- 提高可视化可调试性
- 给用户一个直接点击的恢复来源
- 即使自动恢复失败，用户也能手动打开链接

注意：

- linked URL attachment 用于存“地址入口”，不用于承载结构化校验信息
- 创建时也应保证标题级唯一性，避免重复生成多个同名辅助链接附件

---

## 10. 数据模型与核心概念

### 10.1 父条目（Parent Item）

论文条目本身，例如 journalArticle / preprint。

### 10.2 附件（Attachment）

父条目下的子项，可以是：

- stored PDF
- linked file
- linked URL
- snapshot
- note

### 10.3 恢复管理 note

本项目中的核心对象不是“新建隐藏表”，而是：

- 一个父条目下唯一的插件管理 attached note
- 该 note 中保存一个或多个恢复描述符
- 所有扫描、恢复、状态更新都围绕该 note 展开

### 10.4 缺失附件的判断

“缺失附件”的定义需谨慎。推荐定义为：

一个父条目满足以下条件之一：

1. 存在恢复描述符，但本地没有与之匹配的可用 stored PDF
2. 曾经有恢复描述符，但当前设备上对应 PDF 文件不存在或未附加
3. 父条目下只有 linked URL attachment，没有匹配的 stored PDF

说明：

- 由于一个父条目可以有多个描述符，缺失判断应按 **descriptor 维度** 进行
- 状态面板也应以 descriptor 作为最小任务单元，而不是仅以 parent item 聚合成一条

---

## 11. 主要功能需求

## 11.1 功能 A：新附件实时增强（Capture Enrichment）

### 目标

对新加入的 PDF 附件自动生成恢复描述符。

### 触发时机

- 新附件被添加到库中
- 插件通过 Zotero Notifier 监听到 `item add` 等事件后处理

### 处理步骤

1. 获取新增 item
2. 判断 item 是否为附件
3. 判断附件 MIME type / 扩展名是否为 PDF
4. 获取父条目
5. 确保父条目下存在唯一的插件管理 note
6. 尝试提取：
   - `pdfURL`
   - `pageURL`
   - `doi`
   - `arxivId`
   - `sourceSite`
7. 读取本地 PDF 文件并计算 SHA-256
8. 构造恢复描述符
9. 将描述符写入父条目管理 note
10. 为父条目创建或更新 linked URL attachment（可选但推荐）
11. 标记状态为 `pending`

### 结果

新 PDF 附件被“增强”为可恢复附件。

---

## 11.2 功能 B：历史附件补录（Backfill）

### 目标

为已有 PDF 附件批量生成恢复描述符。

### 支持范围

- 当前选中条目
- 当前 collection
- 全库

### 处理规则

1. 搜索父条目及其附件
2. 过滤 PDF 附件
3. 定位或创建父条目下唯一管理 note
4. 若某 PDF 已经存在有效描述符，则跳过或按规则更新
5. 否则：
   - 读取父条目信息
   - 计算 hash
   - 提取可能的恢复来源
   - 将描述符写入管理 note

### UI 形式

提供命令：

- `补录选中条目描述符`
- `补录当前分类描述符`
- `补录整个文库描述符`

### 补录限制

对于历史附件，原始 `pdfURL` 不一定还可获得，因此要接受以下情况：

- 只拿到 DOI / arXiv ID / pageURL
- `pdfURL` 为空
- 描述符仍可保存，未来依赖 fallback 恢复

---

## 11.3 功能 C：缺失附件扫描（Recovery Scan）

### 目标

扫描当前库中哪些描述符处于“可恢复但未恢复”状态。

### 扫描结果

每个候选任务输出：

- parent item id / key
- descriptor id
- title
- available descriptor source
- candidate recovery strategy
- current state

### 扫描入口

- 手动菜单命令
- 插件启动后可选执行一次轻量扫描
- UI 面板内刷新按钮

### 扫描规则

- 以父条目下的插件管理 note 为入口
- 读取其中所有 descriptors
- 将每个 descriptor 与父条目下现有 stored PDF 做匹配
- 对缺失项生成恢复任务

---

## 11.4 功能 D：恢复 PDF（Recover Attachment）

### 目标

将缺失 PDF 恢复到已有父条目下。

### 恢复前确认

根据用户要求，恢复前必须弹确认框。

确认框至少显示：

- 论文标题
- 来源（pdfURL / arXiv / DOI）
- 将要执行的动作
- 可选择“仅本次恢复”或“本次全部确认”作为后续增强项

### 恢复流程

1. 找到候选任务
2. 载入父条目管理 note
3. 选中目标描述符
4. 选择恢复策略
5. 弹确认框
6. 若用户确认，开始下载
7. 下载到临时文件
8. 校验内容
9. 成功则将 PDF 附加到父条目
10. 更新对应描述符状态
11. 刷新 UI 面板

### 重要约束

**绝对不能创建新父条目。**

---

## 11.5 功能 E：状态面板（Task / Status Panel）

### 目标

给用户一个可视化状态面板，显示：

- 待恢复任务
- 正在恢复的任务
- 成功任务
- 失败任务
- 最后错误信息

### 面板功能建议

- 刷新
- 恢复选中项
- 恢复全部待处理项（未来可选）
- 重试失败项
- 打开父条目
- 打开来源链接

### 列字段建议

- 状态
- 标题
- 来源类型
- 最后尝试时间
- 错误信息

说明：

- 面板中的每一行建议对应一个 descriptor 任务
- 同一父条目下可出现多行

---

## 12. 恢复策略设计

### 12.1 总体策略优先级

恢复策略按如下顺序尝试：

1. `descriptor.pdfURL`
2. `descriptor.arxivId` -> 构造 arXiv PDF URL
3. `descriptor.doi` -> 通过 DOI 页面尝试定位 PDF（MVP 中可只保留接口，不完整实现）
4. `descriptor.pageURL` -> 解析落地页（未来增强）

### 12.2 MVP 支持范围

MVP 优先支持：

- `pdfURL` 直接下载
- `arxivId` 重构 PDF URL

对于 arXiv：

- landing page：`https://arxiv.org/abs/{id}`
- pdf url：`https://arxiv.org/pdf/{id}.pdf`

### 12.3 非 MVP 扩展

后续可扩展支持：

- IEEE
- ACM
- OpenReview
- bioRxiv
- DOI resolver + HTML parser

---

## 13. 校验设计（Verifier）

### 13.1 校验目标

避免以下问题：

- 下载到 HTML 登录页而不是 PDF
- 下载到错误 PDF
- 下载到损坏文件
- 来源站返回重定向错误内容

### 13.2 校验规则

至少包括：

1. `Content-Type` 应接近 `application/pdf`
2. 文件扩展名合理
3. 文件大小 > 最小阈值（例如 > 1KB）
4. 计算 SHA-256
5. 若描述符中存在 hash，则 hash 必须一致

### 13.3 容错策略

若来源不可获得完全一致的文件，则：

- hash 不一致时默认判定恢复失败
- 不要自动接受不同文件
- 在 UI 中显示错误，等待用户决定是否人工处理

说明：

- 这是保守策略，会牺牲一部分恢复成功率，但能最大限度避免误恢复

---

## 14. 去重与匹配策略

### 14.1 根原则

只向 **已有父条目** 补附件，不创建新条目。

### 14.2 为什么不需要复杂全局去重

因为恢复描述符是围绕已有父条目建立的，恢复操作应该从“当前条目 + 当前描述符”出发，而不是从“某个外部页面”重新抓取。

### 14.3 匹配优先级

恢复目标始终是**当前库中已有的具体父条目**。  
若需要判断“某个描述符是否已被恢复”，建议使用如下顺序检查：

1. PDF 哈希
2. 文件名 + 文件大小
3. 来源信息作为辅助比对

这些规则用于定位和校验，不作为创建新条目的依据。

---

## 15. UI 需求

## 15.1 菜单项

建议在 Zotero 菜单中增加：

- `附件恢复 -> 扫描缺失附件`
- `附件恢复 -> 恢复选中条目附件`
- `附件恢复 -> 补录选中条目描述符`
- `附件恢复 -> 补录当前分类描述符`
- `附件恢复 -> 补录整个文库描述符`
- `附件恢复 -> 打开状态面板`

## 15.2 右键菜单（可选增强）

对选中文献提供：

- `补录恢复描述符`
- `恢复缺失附件`

## 15.3 确认对话框

至少显示：

- 文献标题
- 恢复来源（pdfURL / arXiv）
- 是否开始恢复

按钮：

- `确认恢复`
- `取消`

未来可扩展：

- `全部确认`
- `全部跳过`

## 15.4 状态面板

可采用简单列表视图，支持：

- 刷新
- 过滤（pending / failed / success）
- 查看错误
- 打开父条目

### 15.5 面向用户的中文化要求

以下内容默认使用中文：

- 菜单项
- 右键菜单
- 面板按钮
- 面板列标题
- 确认框按钮和提示语
- 常见错误提示

开发内部日志、类型名、代码符号仍可保留英文。

---

## 16. 模块架构

推荐目录结构：

```text
attachment_recover/
├── src/
│   ├── main.ts
│   ├── core/
│   │   ├── types.ts
│   │   ├── descriptor.ts
│   │   ├── logger.ts
│   │   ├── config.ts
│   │   ├── hash.ts
│   │   └── utils.ts
│   ├── capture/
│   │   ├── notifier.ts
│   │   ├── detector.ts
│   │   ├── extractor.ts
│   │   └── enrich.ts
│   ├── backfill/
│   │   ├── backfill.ts
│   │   └── scope.ts
│   ├── recovery/
│   │   ├── scanner.ts
│   │   ├── resolver.ts
│   │   ├── downloader.ts
│   │   ├── verifier.ts
│   │   ├── attach.ts
│   │   └── recover.ts
│   ├── zotero/
│   │   ├── items.ts
│   │   ├── attachments.ts
│   │   ├── notes.ts
│   │   ├── ui.ts
│   │   └── notifier.ts
│   └── ui/
│       ├── menu.ts
│       ├── dialog.ts
│       ├── panel.ts
│       └── commands.ts
├── test/
├── package.json
├── tsconfig.json
└── README.md
```

---

## 17. 模块职责说明

### 17.1 `core/types.ts`

定义全局类型：

- `AttachmentRecoverDescriptor`
- `ParentRecoverNotePayload`
- `RecoveryTask`
- `RecoveryStatus`
- `BackfillScope`

### 17.2 `core/descriptor.ts`

负责：

- 序列化 / 反序列化管理 note 中的容器数据
- 读取、查找、追加、更新 descriptor
- 按 `id` 或 `hash` 定位 descriptor
- 版本迁移

### 17.3 `core/hash.ts`

负责：

- 读取 PDF 文件
- 计算 SHA-256
- 统一返回格式，例如 `sha256:...`

### 17.4 `capture/notifier.ts`

负责注册 Zotero Notifier，监听新增附件。

### 17.5 `capture/detector.ts`

负责判断 item 是否是可处理的 PDF 附件。

### 17.6 `capture/extractor.ts`

负责从附件及父条目提取：

- page URL
- doi
- arxivId
- source site
- 可能的 pdfURL

### 17.7 `capture/enrich.ts`

将整个“新增 PDF -> 生成描述符 -> 写入父条目管理 note -> 添加 link attachment”的流程串起来。

### 17.8 `backfill/backfill.ts`

负责扫描历史附件并批量回填恢复描述符。

### 17.9 `recovery/scanner.ts`

负责扫描哪些 descriptor 处于“可恢复但缺失”的状态。

### 17.10 `recovery/resolver.ts`

负责根据描述符选择恢复策略和生成最终下载 URL。

### 17.11 `recovery/downloader.ts`

负责下载文件到临时路径。

### 17.12 `recovery/verifier.ts`

负责校验下载文件。

### 17.13 `recovery/attach.ts`

负责将文件添加为父条目下的 stored attachment。

### 17.14 `recovery/recover.ts`

负责整合一个完整恢复任务，并更新管理 note 中对应 descriptor 的状态。

### 17.15 `zotero/notes.ts`

负责：

- 查找或创建父条目下唯一管理 note
- 校验管理 note 唯一性
- 读写 note 内容
- 避免操作非插件管理 note

### 17.16 `ui/dialog.ts`

负责确认框。

### 17.17 `ui/panel.ts`

负责任务状态面板。

---

## 18. 关键流程说明

## 18.1 流程一：新增 PDF 附件增强

```text
User adds PDF
  ↓
Notifier receives item add
  ↓
Check if attachment is PDF
  ↓
Get parent item
  ↓
Ensure unique management note exists
  ↓
Extract source info
  ↓
Compute hash
  ↓
Build descriptor
  ↓
Upsert descriptor into management note
  ↓
Create linked URL attachments (optional)
  ↓
Done
```

## 18.2 流程二：历史附件补录

```text
User triggers backfill
  ↓
Scan selected items / collection / library
  ↓
Filter PDF attachments
  ↓
Locate or create management note for each parent item
  ↓
Skip or update descriptors that already exist
  ↓
Generate descriptors for remaining
  ↓
Write management note
  ↓
Done
```

## 18.3 流程三：恢复缺失附件

```text
User triggers scan
  ↓
Find parent items with recoverable descriptors missing local stored PDF
  ↓
Show descriptor tasks in panel
  ↓
User selects one task
  ↓
Show confirmation dialog
  ↓
Resolve download strategy
  ↓
Download to temp
  ↓
Verify content
  ↓
Attach to existing parent item
  ↓
Update descriptor status in management note
  ↓
Refresh panel
```

---

## 19. Zotero 集成要点

### 19.1 Notifier

需要使用 Zotero 的通知系统监听 item add / modify 事件，用于发现新增附件。

### 19.2 搜索 API

需要使用 Zotero 提供的搜索机制扫描：

- 所有 attachment
- 选中条目下 attachment
- 某 collection 下 attachment
- 父条目下的 note

### 19.3 Attachment API

需要支持：

- 判断 attachment 类型
- 获取附件路径
- 获取父条目
- 创建 stored attachment
- 创建 linked URL attachment
- 创建 attached note

### 19.4 Note 读写

需要安全处理插件管理 note：

- 识别该 note 是否为插件管理 note
- 读取 note 内容并解析为结构化对象
- 增量更新容器中的某个 descriptor
- 避免覆盖非插件管理 note

说明：

- 实现时应注意 Zotero note 的实际存储格式可能不是纯文本，读写层需要做兼容封装

---

## 20. 错误处理与状态机

### 20.1 状态枚举

```ts
type RecoveryStatus = "pending" | "downloading" | "success" | "failed";
```

### 20.2 状态转换

- 新建描述符：`pending`
- 开始恢复：`downloading`
- 校验并附加成功：`success`
- 任一步骤出错：`failed`

### 20.3 失败原因示例

- `missing_descriptor`
- `management_note_missing`
- `management_note_conflict`
- `download_url_unresolved`
- `network_error`
- `http_403`
- `http_404`
- `not_pdf`
- `hash_mismatch`
- `attach_failed`

### 20.4 日志

建议为插件实现内部 logger，至少支持：

- info
- warn
- error

并在开发模式下输出到 Zotero 调试控制台。

---

## 21. 配置项建议

建议预留配置结构：

```ts
export interface AttachmentRecoverConfig {
  autoScanOnStartup: boolean;
  autoCreateLinkedURLAttachments: boolean;
  minPdfSizeBytes: number;
  enableArxivRecovery: boolean;
  enableDoiRecovery: boolean;
  confirmBeforeRecovery: boolean;
}
```

MVP 默认：

- `autoScanOnStartup = false`
- `autoCreateLinkedURLAttachments = true`
- `minPdfSizeBytes = 1024`
- `enableArxivRecovery = true`
- `enableDoiRecovery = false`
- `confirmBeforeRecovery = true`

---

## 22. 伪代码建议

## 22.1 解析管理 note

```ts
function parseManagementNote(raw: string): ParentRecoverNotePayload | null {
  try {
    const payload = JSON.parse(raw);
    if (payload?.type !== "attachment_recover") return null;
    if (!Array.isArray(payload.descriptors)) return null;
    return payload;
  } catch {
    return null;
  }
}
```

## 22.2 将描述符写回管理 note

```ts
function upsertDescriptor(
  payload: ParentRecoverNotePayload,
  descriptor: AttachmentRecoverDescriptor
): ParentRecoverNotePayload {
  const descriptors = [...payload.descriptors];
  const index = descriptors.findIndex((item) => item.id === descriptor.id);

  if (index >= 0) {
    descriptors[index] = descriptor;
  } else {
    descriptors.push(descriptor);
  }

  return {
    ...payload,
    descriptors,
  };
}
```

## 22.3 检测 PDF 附件

```ts
function isPdfAttachment(item: Zotero.Item): boolean {
  if (!item.isAttachment()) return false;
  const mime = item.attachmentContentType || "";
  const path = item.getFilePath?.() || "";
  return mime === "application/pdf" || path.toLowerCase().endsWith(".pdf");
}
```

## 22.4 恢复流程

```ts
async function recoverDescriptorTask(parentItem: Zotero.Item, descriptorId: string) {
  const note = await getManagementNote(parentItem);
  const payload = await loadPayload(note);
  const descriptor = payload.descriptors.find((item) => item.id === descriptorId);
  if (!descriptor) throw new Error("missing_descriptor");

  const confirmed = await showConfirmDialog(parentItem, descriptor);
  if (!confirmed) return;

  descriptor.status = "downloading";
  descriptor.updatedAt = Date.now();
  await saveDescriptor(note, descriptor);

  const url = await resolveDownloadURL(descriptor);
  const tempFile = await downloadToTemp(url);
  await verifyPdf(tempFile, descriptor);
  await attachPdfToParent(parentItem, tempFile);

  descriptor.status = "success";
  descriptor.updatedAt = Date.now();
  await saveDescriptor(note, descriptor);
}
```

---

## 23. MVP 范围定义

### 23.1 必做

1. TypeScript 工程骨架
2. 新附件监听
3. PDF 判定
4. SHA-256 计算
5. 父条目唯一管理 note 的查找 / 创建 / 读写
6. 管理 note 中多描述符的读写与更新
7. linked URL attachment 创建
8. 历史补录：选中条目 / 全库
9. 缺失扫描
10. 恢复前确认框
11. `pdfURL` 下载恢复
12. `arxivId` 恢复
13. 基础状态面板
14. 基础日志
15. 用户可见 UI 中文化

### 23.2 可延后

1. DOI 页面解析恢复
2. pageURL HTML parser
3. 并发下载
4. 自动启动扫描
5. 重试全部 / 恢复全部
6. 设置面板
7. 单元测试完善

---

## 24. 分阶段开发计划

## Phase 1：工程搭建

- 初始化 Zotero 7 插件模板
- 搭建 TypeScript 工程
- 注册中文菜单与基础 UI
- 建立 logger / config / types

## Phase 2：描述符系统

- 实现 descriptor 与父条目 note 容器类型
- 实现管理 note 查找 / 创建 / 读写
- 实现 hash 计算
- 完成 PDF 检测

## Phase 3：新增附件监听

- 接入 notifier
- 新 PDF 自动增强
- 创建 linked URL attachment

## Phase 4：历史补录

- 扫描当前选择 / 全库
- 为已有 PDF 生成描述符

## Phase 5：恢复系统

- 扫描缺失附件
- 实现确认框
- 实现下载、校验、附加
- 状态更新

## Phase 6：状态面板

- 列表显示任务状态
- 刷新 / 筛选 / 打开条目

## Phase 7：增强

- DOI / pageURL fallback
- 错误处理完善
- 更强的 UI 和配置能力

---

## 25. 测试建议

### 25.1 场景测试

#### 测试 A：新 arXiv PDF

- 添加一个 arXiv 条目和 PDF
- 验证是否自动生成描述符
- 验证父条目下是否创建唯一管理 note
- 验证 linked URL attachment 是否创建

#### 测试 B：历史 PDF 补录

- 对现有库执行 backfill
- 检查是否成功写入管理 note

#### 测试 C：另一设备恢复

- 模拟目标库只有元数据 / 无 PDF
- 执行 scan + recover
- 检查是否添加到原条目

#### 测试 D：hash mismatch

- 故意返回错误文件
- 验证是否被拦截

#### 测试 E：取消确认框

- 用户取消恢复
- 验证不会下载，不改变条目结构

### 25.2 边界测试

- 父条目下已有用户 note
- 一个条目多个 PDF
- 已有 linked URL attachment 的情况
- 缺失 `pdfURL` 但有 `arxivId`
- 管理 note 不存在
- 管理 note 重复存在
- 网络失败 / 403 / 404

---

## 26. 命名约定

### 26.1 插件名

- 项目仓库名：`attachment_recover`
- 显示名建议：`附件恢复`

### 26.2 管理 note 标识

固定使用：

- 顶层 `type`：`attachment_recover`
- 顶层 `version`：容器版本号

### 26.3 linked URL attachment 标题

建议固定为：

- `Original PDF URL`
- `Landing Page`

说明：

- 用户可见主菜单等界面使用中文
- linked URL attachment 标题可先保留英文，后续如需统一中文可再调整

---

## 27. Agent 实现约束（给 OpenCode / Codex）

以下是对代码生成 agent 的明确要求：

1. 使用 **TypeScript**
2. 优先采用 **模块化设计**
3. 不要把所有逻辑塞进一个入口文件
4. 所有 Zotero 交互应封装在独立模块中
5. 所有对管理 note 的读写必须是“安全更新”，不能误改用户其他 note
6. 管理 note 必须是“父条目下存在且唯一”的插件专用 attached note
7. 管理 note 需要支持“一个父条目多个描述符”
8. 恢复操作必须要求确认框
9. 恢复成功时只能将 PDF 附加到已有父条目，不得创建新父条目
10. 所有关键路径要有错误处理
11. 所有模块都应保留未来扩展接口
12. MVP 中优先实现 arXiv 恢复路径
13. 所有面向用户的 UI 文案使用中文

---

## 28. 首版交付物要求

Agent 首轮应生成：

1. 可构建的 Zotero 7 插件工程
2. `README.md`
3. 核心目录结构与空实现文件
4. 描述符类型与父条目管理 note 读写逻辑
5. PDF 检测与 hash 计算
6. 新增附件监听骨架
7. backfill 命令骨架
8. recovery 命令骨架
9. 基础确认框
10. 简单状态面板
11. 中文菜单与基础中文 UI 文案

第二轮再补全：

- 下载器
- 校验器
- arXiv 恢复
- linked URL attachment 逻辑

---

## 29. 后续扩展方向

1. DOI 解析恢复
2. IEEE / ACM / OpenReview 专用恢复器
3. 重试策略
4. 批量恢复
5. 插件设置页
6. 更完整的任务队列
7. 恢复历史记录
8. 数据迁移与描述符版本升级

---

## 30. 最终一句话定义

`attachment_recover` 的本质是：

> 一个运行在 Zotero 内部的恢复型插件。  
> 它不做“重新抓取文献”，而是为已有父条目保存一个可同步、唯一、由插件管理的恢复 note，并在另一台设备上将缺失附件恢复到原条目下，从而避免重复条目和多端库分叉。

---

## 31. 实现状态（v1.0）

### 已实现

| 模块 | 状态 | 说明 |
|------|------|------|
| 插件基础骨架 | ✅ | 基于 zotero-plugin-template，已替换所有模板标识为项目自身 |
| 描述符类型定义 | ✅ | `AttachmentRecoverDescriptor` / `ParentRecoverNotePayload`，含完整字段 |
| 管理 note 读写 | ✅ | 序列化为 JSON、解析验证、查找/确保/保存唯一管理 note |
| 手动补录 | ✅ | 多选多父条目分组处理、upsert 已有描述符 |
| 自动补录 | ✅ | Notifier 监听 `add/item`，新 PDF 附件自动生成描述符，已有同 hash 则跳过 |
| arXiv URL 规范化 | ✅ | 优先从 pageURL 提取带版本号的 arXiv ID，规范化为 https 标准格式 |
| 缺失附件扫描 | ✅ | 扫描全库，找出有描述符但本地缺 PDF 的条目 |
| 下载与校验 | ✅ | resolveDownloadURL（arXiv 优先）→ Zotero.HTTP.request 下载 → SHA-256 校验 → importFromFile 导入 → renameAttachmentFile |
| 状态更新 | ✅ | 恢复任务更新 descriptor.status/attemptCount/lastError/updatedAt |
| 确认对话框 | ✅ | 列出最多 10 条缺失项，用户确认后才执行恢复 |
| 菜单入口 | ✅ | `工具 → 补录恢复描述符` + `工具 → 扫描并恢复缺失附件` |
| 中英文本地化 | ✅ | 所有用户可见文案均通过 Fluent i10n |
| 路径跨平台 | ✅ | 临时文件路径使用 PathUtils.join 拼接 |

### 已知限制

- MVP 阶段恢复下载仅支持 arXiv URL；非 arXiv 的 pdfURL 直接下载未做专项处理
- 哈希校验目前只支持 SHA-256；若远程文件重新编译（如 arXiv 更新版本），哈希不匹配会导致恢复失败
- 一次恢复所有缺失项，不支持勾选部分项
- 恢复进度没有进度条，只有最终汇总弹窗
- 未监听父条目 URL 字段变化来刷新描述符
- 没有偏好设置来开关自动补录

---

## 32. 下一步计划

### v1.1 — 恢复体验优化

1. **恢复进度反馈**：恢复过程中逐条显示进度（ProgressWindow 或面板），而非最后汇总弹窗
2. **勾选部分恢复**：确认对话框中允许用户勾选要恢复的条目，跳过不需要的
3. **哈希不匹配时的降级策略**：当 SHA-256 不匹配时，提示用户文件已变更，提供"仍然导入"选项
4. **偏好设置页**：
   - 开关自动补录
   - 开关恢复时的哈希校验
   - 设置下载超时时间

### v1.2 — 来源扩展

5. **DOI → PDF 路径**：利用 DOI 解析服务（如 Unpaywall、CrossRef）查找开放获取 PDF
6. **pageURL 抓取**：从页面 URL 解析 PDF 链接（作为未来增强，MVP 不做）
7. **URL 降级链**：当首选 URL 下载失败时，按优先级依次尝试 arxivId → pdfURL → pageURL → DOI

### v1.3 — 持续性与健壮性

8. **父条目 URL/元数据变化后自动刷新描述符**：监听 item-modify 事件，当父条目 URL、DOI 等字段变化时更新对应描述符
9. **描述符版本迁移**：当 `ATTACHMENT_RECOVER_NOTE_VERSION` 升级时，自动迁移旧版描述符格式
10. **群组库支持**：当前仅处理用户库，需要扩展到群组库
11. **批量操作优化**：对大量条目时使用批量保存而非逐条 saveTx，减少 Zotero 数据库写入次数

### 未来方向

12. **UI 面板**：在 Zotero 右侧面板或独立 tab 中显示恢复任务列表与状态
13. **定时自动扫描**：插件启动时或定期自动扫描缺失附件，无需手动触发
14. **非 PDF 附件支持**：扩展到 EPUB、快照等附件类型
