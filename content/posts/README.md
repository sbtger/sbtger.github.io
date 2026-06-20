# Writing Notes

Create a new Markdown file in this directory, then run:

```bash
npm run build
```

Example:

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
summary: 这是一段会显示在首页、分类页和标签页里的摘要。
featured: true
---

## 小标题

正文内容。
```

Notes:

- `slug` controls the final URL: `/YYYY/MM/DD/slug/`.
- Set `featured: true` to let the note appear in the homepage selected notes.
- Drafts can be kept with `draft: true`; they will not be published.
