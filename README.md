# attachment_recover

[![zotero target](https://img.shields.io/badge/Zotero-Add--on-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)

`attachment_recover` 是一个 Zotero 插件，用于在多设备之间恢复缺失的 PDF 附件，并且只恢复附件，不创建新的顶层条目。

[English](doc/README-enUS.md)

## 背景

在公司、学校等受限网络环境中，Zotero Connector 往往可以正常抓取论文元数据和 PDF，但附件文件未必能够上传到 WebDAV 或 Zotero Storage。这样一来，用户在另一台设备上只能看到条目，无法看到 PDF，重复抓取还会带来重复条目。

本项目利用 Zotero 的数据同步层，将附件恢复所需信息保存为父条目下的插件管理 note。另一台设备同步到这些信息后，可以扫描缺失附件并重新下载、校验、导入回原条目。

## v1.1 已完成功能

### 描述符生成

- 为 PDF 附件生成恢复描述符，并存储在父条目下唯一的插件管理 note 中
- 描述符包含哈希、文件大小、文件名、MIME 类型、PDF URL、页面 URL、DOI、arXiv ID、来源站点、恢复状态等信息
- 自动提取并规范化 arXiv ID、arXiv 页面 URL、arXiv PDF URL

### 手动补录

- `工具 -> 补录恢复描述符`
- 支持选中父条目、PDF 附件、管理 note 后按父条目分组处理
- 对已有描述符执行 upsert，保留 `createdAt`、`status`、`attemptCount`、`lastError`

### 自动补录

- 新增 PDF 附件时通过 Notifier 自动补录描述符
- 已存在相同哈希的描述符时自动跳过，避免重复记录

### 扫描与恢复

- `工具 -> 扫描并恢复缺失附件`
- 扫描用户文库中带恢复描述符但本地缺失 PDF 的条目
- 先弹出确认框，再逐项执行恢复
- 恢复流程：解析下载 URL -> 下载临时文件 -> SHA-256 校验 -> 导入为 stored attachment -> 重命名 -> 更新描述符状态
- 当前优先支持 arXiv 来源

### 状态面板

- 在条目右侧面板显示当前父条目下的恢复任务
- 显示字段：文件名、状态、来源、最后更新时间、报错信息
- 状态包含：`已下载`、`缺失`、`下载中`、`恢复失败`
- 使用项目自定义 SVG 图标和高亮状态样式

### 中文化 UI

- 菜单、确认框、状态面板等用户可见文本默认使用中文

## 安装

从仓库 Releases 页面下载 `.xpi` 文件，在 Zotero 中通过 `工具 -> 插件 -> Install Add-on From File` 安装。

## 使用方式

### 补录恢复描述符

1. 在 Zotero 中选中一个或多个条目、PDF 附件或管理 note
2. 点击 `工具 -> 补录恢复描述符`
3. 插件会为对应父条目下的 PDF 生成或更新恢复描述符
4. 同步后，其他设备即可读取这些描述符

### 扫描并恢复缺失附件

1. 点击 `工具 -> 扫描并恢复缺失附件`
2. 插件扫描整个用户文库中的缺失附件任务
3. 确认后自动尝试恢复并更新状态

### 查看状态面板

1. 在 Zotero 中选中条目、附件或管理 note
2. 查看右侧 `附件恢复状态` 面板
3. 面板会展示当前父条目下的恢复任务列表

## 相关文档

- English README: [doc/README-enUS.md](doc/README-enUS.md)
- 需求与架构说明: [project_requirements.md](project_requirements.md)
- Release Notes v1.1: [doc/release-v1.1.md](doc/release-v1.1.md)

## 开发

```bash
npm install
npm run build
npm run start
```

## 许可证

AGPL-3.0-or-later