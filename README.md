# attachment_recover

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)

`attachment_recover` 是一个 Zotero 7 插件，用于在多设备之间自动恢复缺失的 PDF 附件。

## 背景

在公司/学校内网环境下，Zotero Connector 可以正常抓取论文并保存 PDF 附件，但受限于网络策略无法上传到 WebDAV 或 Zotero Storage。当用户在另一台设备上通过数据同步看到条目时，PDF 附件缺失。如果用户再次抓取同一篇论文，又会产生重复条目。

本插件利用 Zotero 本身的数据同步机制，在条目下创建一份可同步的恢复描述符，在另一台设备上基于描述符自动下载、校验并恢复缺失的 PDF 附件，且绝不创建新的顶层条目。

## v1.0 功能

### 描述符生成

- 为 PDF 附件生成恢复描述符，存储在父条目下的唯一管理 note 中
- 描述符包含：SHA-256 哈希、文件大小、文件名、MIME 类型、PDF URL、页面 URL、DOI、arXiv ID、来源站点等
- arXiv ID 会自动从 URL 中提取并保留版本号（如 `2511.13684v1`）
- PDF URL 和页面 URL 会自动规范化为 https 的 arXiv 标准格式

### 手动补录

- `工具 -> 补录恢复描述符`：为当前选中的条目或附件手动生成描述符
- 支持多选多个父条目，按父条目分组处理
- 对已有描述符执行 upsert（保留 createdAt/status/attemptCount/lastError）

### 自动补录

- 新增 PDF 附件时自动通过 Notifier 触发描述符生成
- 已存在相同 hash 的描述符时自动跳过，不会重复创建

### 扫描与恢复

- `工具 -> 扫描并恢复缺失附件`：扫描整个文献库
- 找出有恢复描述符但本地缺失对应 PDF 的条目
- 确认对话框列出缺失项，用户确认后逐个下载恢复
- 恢复流程：解析下载 URL → 下载到临时文件 → SHA-256 校验 → 导入为 stored attachment → 重命名 → 更新描述符状态
- MVP 阶段优先支持 arXiv PDF URL
- 下载失败时描述符状态更新为 `failed` 并记录错误信息
- 恢复成功后描述符状态更新为 `success`

## 安装

从 [Releases](../../releases) 下载 `.xpi` 文件，在 Zotero 中通过 `工具 -> 插件 -> Install Add-on From File` 安装。

## 使用方法

### 补录恢复描述符

1. 在 Zotero 中选中一个或多个包含 PDF 附件的条目
2. 点击 `工具 -> 补录恢复描述符`
3. 插件会为每个 PDF 附件生成描述符并写入管理 note
4. 同步后，另一台设备即可看到这些描述符

### 扫描并恢复缺失附件

1. 点击 `工具 -> 扫描并恢复缺失附件`
2. 插件扫描文献库，列出有描述符但本地缺失 PDF 的条目
3. 确认后自动下载、校验并挂回原条目

### 自动补录

- 当添加新的 PDF 附件时，插件会自动生成描述符并写入管理 note
- 无需手动操作

## 描述符格式

```json
{
  "type": "attachment_recover",
  "version": 1,
  "descriptors": [
    {
      "id": "sha256:<hex>",
      "version": 1,
      "pdfURL": "https://arxiv.org/pdf/2404.03575v2.pdf",
      "pageURL": "https://arxiv.org/abs/2404.03575v2",
      "doi": "10.xxxx/xxxxx",
      "arxivId": "2404.03575v2",
      "sourceSite": "arxiv",
      "hash": "sha256:<hex>",
      "filesize": 10799460,
      "filename": "Author - 2024 - Paper Title.pdf",
      "mimeType": "application/pdf",
      "createdAt": 1776117047574,
      "updatedAt": 1776117047574,
      "status": "pending | downloading | success | failed",
      "attemptCount": 0,
      "lastError": null,
      "pluginVersion": "0.1.0"
    }
  ]
}
```

## 项目结构

```
src/modules/
  recoveryDescriptor.ts   # 描述符类型定义、创建、upsert、arXiv URL 规范化
  recoveryNote.ts         # 管理 note 的读写、序列化、查找
  recoveryManual.ts       # 手动补录逻辑（多选多父条目分组处理）
  recoveryScanner.ts      # 缺失附件扫描器
  recoveryDownloader.ts   # 下载 URL 解析、PDF 下载、哈希校验
  recoveryExecutor.ts      # 恢复任务执行（下载→校验→导入→状态更新）
  recoveryCommand.ts       # 菜单命令入口
src/hooks.ts              # 插件生命周期、Notifier 自动补录
```

## 开发

```bash
npm install
npm run build
npm run start    # 开发模式
```

## 许可证

AGPL-3.0-or-later