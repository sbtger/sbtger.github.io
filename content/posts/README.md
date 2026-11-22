# 发布文章

在本目录新增一个 Markdown 文件，例如 `new-note.md`。

```markdown
---
title: 新笔记标题
date: 2026-06-20T21:30:00+08:00
slug: new-note
categories:
  - 工程笔记
tags:
  - JavaScript
  - 静态站点
summary: 文章摘要。
featured: true
---

## 小标题

正文内容。
```

在仓库根目录运行 `npm run build`，再把 Markdown 源文件与生成的 HTML 一起提交到发布分支。文章地址为 `/articles/new-note.html`。已发布的文章建议沿用原来的 `slug`，方便读者继续使用收藏的链接。

构建会按日期更新首页文章列表、分类页和标签页。`featured: true` 的文章按日期进入首页精选，最多显示六篇。保留 `draft: true` 的文章只保留 Markdown 源文件，不生成正文，也不会列入索引。仓库是公开的，提交后的草稿源文件也可在 GitHub 上查看。
