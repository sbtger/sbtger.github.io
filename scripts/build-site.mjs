import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const siteName = 'Anred Lab';
const author = 'Peng Zhang';
const cssHref = '/css/anred-lab.css?v=20260620';
const contentDir = path.join(root, 'content/posts');
const generatedBy = '<!-- generated-by: scripts/build-site.mjs -->';

const topicCopy = new Map([
  ['网络安全', 'DDoS、侦察、缓冲区溢出和基础安全实验。'],
  ['android-security', '移动端调试、组件安全和应用攻击面。'],
  ['基础知识', '操作系统、安全错题和长期复习材料。'],
  ['嵌入式系统安全', 'ARM、接口技术和底层系统安全基础。'],
  ['汇编语言', 'Loop、存储器寻址和底层执行模型。'],
  ['DDIA', '可靠、可扩展和可维护的数据系统笔记。'],
  ['python', '常用代码、脚本工具和数据处理片段。'],
  ['leetcode', '算法题训练中的模式和边界条件。'],
  ['操作系统', '进程、线程、调度、内存和 IPC。'],
  ['微机接口', '存储器、接口和硬件抽象。'],
  ['主流操作系统安全', 'Windows 相关安全基础。'],
  ['信息内容安全', '信息采集和爬虫相关笔记。'],
  ['机器学习', '机器学习工具与实践记录。'],
  ['Hexo', '旧博客系统初始化和站点记录。']
]);

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function stripHtml(value = '') {
  return decodeEntities(value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeEntities(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function excerpt(value = '', length = 86) {
  const text = stripHtml(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateParts(date) {
  const iso = formatDate(date);
  const [year, month, day] = iso.split('-');
  return { year, month, day };
}

function hrefForDir(...segments) {
  return `/${segments.map((segment) => encodeURIComponent(segment).replace(/%2F/g, '/')).join('/')}/`;
}

function slugify(value) {
  return String(value)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'note';
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed.replace(/^["']|["']$/g, '');
}

function parseFrontmatter(source, file) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file} is missing YAML frontmatter`);

  const data = {};
  let currentKey = null;
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentKey) {
      data[currentKey].push(parseScalar(listItem[1]));
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    currentKey = key;
    if (rawValue === '') {
      data[key] = [];
    } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      data[key] = rawValue.slice(1, -1).split(',').map((item) => parseScalar(item)).filter(Boolean);
    } else {
      data[key] = parseScalar(rawValue);
    }
  }

  return { data, body: match[2] };
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = [];
  let code = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    list = [];
  }

  for (const line of lines) {
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      if (code) {
        html.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`);
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = { lang: fence[1] || '', lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      html.push(`<h${level} id="${escapeHtml(id)}">${inlineMarkdown(text)}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1].trim());
      continue;
    }
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  if (code) html.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`);
  return html.join('\n');
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function readExistingPosts() {
  const files = (await walk(root))
    .filter((file) => /\/20\d{2}\/\d{2}\/\d{2}\/.+\/index\.html$/.test(file))
    .filter((file) => !file.includes('/node_modules/'));
  const posts = [];

  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    if (html.includes(generatedBy)) continue;
    const relDir = path.dirname(path.relative(root, file));
    const url = `/${relDir.split(path.sep).map(encodeURIComponent).join('/')}/`;
    const title = stripHtml(html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || html.match(/<title>(.*?)\s*\|/)?.[1] || path.basename(relDir));
    const datetime = html.match(/<time datetime="([^"]+)"/)?.[1] || `${relDir.split(path.sep).slice(0, 3).join('-')}T00:00:00+08:00`;
    const categories = [...html.matchAll(/href="\/categories\/([^"]+)\/"/g)].map((match) => decodeURIComponent(match[1]));
    const tags = [...html.matchAll(/href="\/tags\/([^"]+)\/"/g)].map((match) => decodeURIComponent(match[1]));
    const firstParagraph = html.match(/<div class="article-content">[\s\S]*?<p>([\s\S]*?)<\/p>/)?.[1] || '';
    const summary = excerpt(firstParagraph);
    posts.push({
      source: 'html',
      title,
      date: new Date(datetime),
      datetime,
      url,
      categories: [...new Set(categories)],
      tags: [...new Set(tags)],
      summary,
      featured: false
    });
  }
  return posts;
}

async function readMarkdownPosts() {
  const files = (await walk(contentDir)).filter((file) => file.endsWith('.md') && path.basename(file) !== 'README.md');
  const posts = [];
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const { data, body } = parseFrontmatter(source, path.relative(root, file));
    if (data.draft) continue;
    if (!data.title || !data.date) throw new Error(`${file} requires title and date`);
    const date = new Date(data.date);
    const { year, month, day } = dateParts(date);
    const slug = slugify(data.slug || data.title);
    const url = hrefForDir(year, month, day, slug);
    const html = markdownToHtml(body);
    posts.push({
      source: 'markdown',
      file,
      title: data.title,
      date,
      datetime: data.date,
      url,
      outputDir: path.join(root, year, month, day, slug),
      categories: Array.isArray(data.categories) ? data.categories : [data.categories || '未分类'],
      tags: Array.isArray(data.tags) ? data.tags : [],
      summary: data.summary || excerpt(html),
      featured: Boolean(data.featured),
      html
    });
  }
  return posts;
}

function nav(active = '') {
  const item = (href, label, key) => `<a${active === key ? ' class="active"' : ''} href="${href}">${label}</a>`;
  return `<nav class="nav" aria-label="主导航">
    <div class="nav-inner">
      <a class="brand" href="/"><span class="brand-mark"><img src="/images/favicon.svg" alt=""></span><span class="brand-text">${siteName}</span></a>
      <div class="nav-links">
        ${item('/', '首页', 'home')}
        ${item('/categories/', '分类', 'categories')}
        ${item('/tags/', '标签', 'tags')}
        ${item('/archives/', '归档', 'archives')}
        ${item('/about/', '关于', 'about')}
      </div>
    </div>
  </nav>`;
}

function pageShell({ title, description, canonical, active, body }) {
  return `${generatedBy}
<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#070a0f">
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)} | ${siteName}">
  <meta property="og:site_name" content="${siteName}">
  <link rel="canonical" href="${canonical}">
  <link rel="stylesheet" href="${cssHref}">
  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32-next.png">
  <title>${escapeHtml(title)} | ${siteName}</title>
</head>
<body>
  ${nav(active)}
${body}
  <footer class="footer"><div class="footer-inner"><div>© 2026 ${author}. Static site on anred.space.</div><div class="footer-links"><a href="/">Home</a><a href="/archives/">Archives</a><a href="/tags/">Tags</a></div></div></footer>
</body>
</html>
`;
}

function articleShell(post, older, newer) {
  const categoryLinks = post.categories.map((category) => `<a href="/categories/${encodeURIComponent(category)}/">${escapeHtml(category)}</a>`).join(', ');
  const tagLinks = post.tags.map((tag) => `<a href="/tags/${encodeURIComponent(tag)}/"># ${escapeHtml(tag)}</a>`).join('');
  const navLinks = `<nav class="article-nav" aria-label="文章导航">
        ${older ? `<a href="${older.url}"><span class="card-kicker">Older</span><br>${escapeHtml(older.title)}</a>` : '<span></span>'}
        ${newer ? `<a href="${newer.url}"><span class="card-kicker">Newer</span><br>${escapeHtml(newer.title)}</a>` : '<span></span>'}
      </nav>`;
  return `${generatedBy}
<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#070a0f">
  <meta name="description" content="${escapeHtml(post.summary)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(post.title)}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="article:author" content="${author}">
  <meta property="article:published_time" content="${escapeHtml(post.datetime)}">
  <link rel="canonical" href="${post.url}">
  <link rel="stylesheet" href="${cssHref}">
  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32-next.png">
  <title>${escapeHtml(post.title)} | ${siteName}</title>
</head>
<body>
  ${nav()}
  <main class="article-shell">
    <article>
      <header class="article-hero">
        <span class="eyebrow">NOTE</span>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="article-meta">
          <time datetime="${escapeHtml(post.datetime)}">${formatDate(post.date)}</time>
          <span>/</span>
          <span>${categoryLinks}</span>
        </div>
      </header>
      <div class="article-content">
${post.html}
      </div>
      ${tagLinks ? `<div class="article-tags">${tagLinks}</div>` : ''}
      ${navLinks}
    </article>
  </main>
  <footer class="footer"><div class="footer-inner"><div>© 2026 ${author}. Static site on anred.space.</div><div class="footer-links"><a href="/archives/">Archives</a><a href="/categories/">Categories</a><a href="/tags/">Tags</a></div></div></footer>
</body>
</html>
`;
}

function noteCards(posts) {
  return posts.map((post) => `<a class="article-card" href="${post.url}">
            <div class="article-meta"><span class="tag">${escapeHtml(post.categories[0] || 'Note')}</span><span>${formatDate(post.date)}</span></div>
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.summary)}</p>
            <span class="read-more">Read note</span>
          </a>`).join('\n\n          ');
}

async function updateHome(posts) {
  const file = path.join(root, 'index.html');
  let html = await fs.readFile(file, 'utf8');
  const categories = groupBy(posts, (post) => post.categories).size;
  const tags = groupBy(posts, (post) => post.tags).size;
  const words = Math.max(1, Math.round(posts.reduce((sum, post) => sum + (post.summary?.length || 0) * 18, 0) / 1000));
  const metrics = `<div class="metric-strip" aria-label="站点统计">
          <div class="metric"><strong>${posts.length}</strong><span>技术日志</span></div>
          <div class="metric"><strong>${categories}</strong><span>主题分类</span></div>
          <div class="metric"><strong>${tags}</strong><span>知识标签</span></div>
          <div class="metric"><strong>${words}k</strong><span>估算字数</span></div>
        </div>`;
  html = html.replace(/<div class="metric-strip" aria-label="站点统计">[\s\S]*?<\/div>\s*<\/div>\s*<\/header>/, `${metrics}\n      </div>\n    </header>`);

  const featured = posts.filter((post) => post.featured).length
    ? posts.filter((post) => post.featured).slice(0, 6)
    : posts.slice(0, 6);
  html = html.replace(/<div class="article-grid">[\s\S]*?<\/div>\s*<\/section>\s*<section id="systems"/, `<div class="article-grid">\n          ${noteCards(featured)}\n        </div>\n      </section>\n\n      <section id="systems"`);
  await fs.writeFile(file, html);
}

function groupBy(posts, selector) {
  const map = new Map();
  for (const post of posts) {
    const keys = selector(post).filter(Boolean);
    for (const key of keys) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(post);
    }
  }
  return map;
}

function cardsForPosts(posts) {
  return posts.map((post) => `<a class="card" href="${post.url}"><span class="card-kicker">${formatDate(post.date)}</span><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.summary || [post.categories.join(', '), post.tags.join(', ')].filter(Boolean).join(' / '))}</p><strong>Read note</strong></a>`).join('\n');
}

async function writeCategories(posts) {
  const grouped = groupBy(posts, (post) => post.categories);
  const entries = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  await cleanupGeneratedDirs(path.join(root, 'categories'), new Set(entries.map(([category]) => category)));
  const cards = entries.map(([category, items]) => `<a class="card" href="/categories/${encodeURIComponent(category)}/"><span class="card-kicker">${String(items.length).padStart(2, '0')} ${items.length === 1 ? 'note' : 'notes'}</span><h3>${escapeHtml(category)}</h3><p>${escapeHtml(topicCopy.get(category) || `${category} 相关笔记。`)}</p><strong>Open</strong></a>`).join('\n');
  await writePage('categories/index.html', pageShell({
    title: '分类',
    description: `${siteName} 技术博客分类索引。`,
    canonical: '/categories/',
    active: 'categories',
    body: `  <header class="page-hero"><span class="eyebrow">CATEGORY MAP</span><h1>按问题域进入笔记。</h1><p class="hero-copy">从系统、安全、移动端、数据系统和脚本工具几个方向切入，比时间线更适合快速回到某个知识块。</p></header>
  <main class="section"><div class="section-head"><h2>${entries.length} 个分类</h2><p>运行 <code>npm run build</code> 后自动更新。</p></div><div class="grid cols-3">${cards}</div></main>`
  }));
  for (const [category, items] of entries) {
    const sorted = [...items].sort((a, b) => b.date - a.date);
    await writePage(`categories/${category}/index.html`, pageShell({
      title: `分类: ${category}`,
      description: `${category} 分类下的文章。`,
      canonical: `/categories/${encodeURIComponent(category)}/`,
      active: 'categories',
      body: `  <header class="page-hero"><span class="eyebrow">CATEGORY</span><h1>分类：${escapeHtml(category)}</h1><p class="hero-copy">共 ${sorted.length} 篇笔记，按发布时间倒序排列。</p></header>
  <main class="section"><div class="section-head"><h2>${sorted.length} 篇文章</h2><p><a class="button" href="/categories/">返回分类地图</a></p></div><div class="grid cols-3">${cardsForPosts(sorted)}</div></main>`
    }));
  }
}

async function writeTags(posts) {
  const grouped = groupBy(posts, (post) => post.tags);
  const entries = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  await cleanupGeneratedDirs(path.join(root, 'tags'), new Set(entries.map(([tag]) => tag)));
  const cards = entries.map(([tag, items]) => `<a class="card compact" href="/tags/${encodeURIComponent(tag)}/"><span class="card-kicker">${items.length} ${items.length === 1 ? 'note' : 'notes'}</span><h3># ${escapeHtml(tag)}</h3><strong>Open</strong></a>`).join('\n');
  const index = pageShell({
    title: '标签',
    description: `${siteName} 技术博客标签索引。`,
    canonical: '/tags/',
    active: 'tags',
    body: `  <header class="page-hero"><span class="eyebrow">TAG CLOUD</span><h1>按关键词回到现场。</h1><p class="hero-copy">标签适合快速定位技术点、工具、平台和问题类型。</p></header>
  <main class="section"><div class="section-head"><h2>${entries.length} 个标签</h2><p>运行 <code>npm run build</code> 后自动更新。</p></div><div class="grid cols-3">${cards}</div></main>`
  });
  await writePage('tags/index.html', index);
  await writePage('tags/index-1.html', index);
  for (const [tag, items] of entries) {
    const sorted = [...items].sort((a, b) => b.date - a.date);
    await writePage(`tags/${tag}/index.html`, pageShell({
      title: `标签: ${tag}`,
      description: `${tag} 标签下的文章。`,
      canonical: `/tags/${encodeURIComponent(tag)}/`,
      active: 'tags',
      body: `  <header class="page-hero"><span class="eyebrow">TAG</span><h1>标签：${escapeHtml(tag)}</h1><p class="hero-copy">共 ${sorted.length} 篇笔记，按发布时间倒序排列。</p></header>
  <main class="section"><div class="section-head"><h2>${sorted.length} 篇文章</h2><p><a class="button" href="/tags/">返回标签地图</a></p></div><div class="grid cols-3">${cardsForPosts(sorted)}</div></main>`
    }));
  }
}

async function writeArchives(posts) {
  const byYear = new Map();
  for (const post of posts) {
    const { year } = dateParts(post.date);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(post);
  }
  const timeline = [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, items]) => `<section class="year-block">
        <h2>${year}</h2>
        ${items.sort((a, b) => b.date - a.date).map((post) => `<div class="post-row"><time>${formatDate(post.date).slice(5)}</time><a href="${post.url}">${escapeHtml(post.title)}</a></div>`).join('\n        ')}
      </section>`).join('\n');
  const archivePage = pageShell({
    title: '归档',
    description: `${siteName} 技术博客文章归档。`,
    canonical: '/archives/',
    active: 'archives',
    body: `  <header class="page-hero"><span class="eyebrow">ARCHIVE STREAM</span><h1>所有笔记，<br>按时间回放。</h1><p class="hero-copy">完整历史文章入口，按年份排列。</p></header>
  <main class="section"><div class="section-head"><h2>${posts.length} 篇文章</h2><p>运行 <code>npm run build</code> 后自动更新。</p></div><div class="timeline">${timeline}</div></main>`
  });
  await writePage('archives/index.html', archivePage);

  const byMonth = new Map();
  for (const post of posts) {
    const { year, month } = dateParts(post.date);
    const key = `${year}/${month}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(post);
  }
  await cleanupGeneratedArchives(new Set([
    ...byYear.keys(),
    ...byMonth.keys()
  ]));
  for (const [year, items] of byYear) {
    await writePage(`archives/${year}/index.html`, archiveListPage(`归档: ${year}`, `/archives/${year}/`, items));
  }
  for (const [key, items] of byMonth) {
    await writePage(`archives/${key}/index.html`, archiveListPage(`归档: ${key}`, `/archives/${key}/`, items));
  }
  await writeLegacyArchiveAliases(posts);
}

async function cleanupGeneratedArchives(validKeys) {
  const archivesDir = path.join(root, 'archives');
  const years = await fs.readdir(archivesDir, { withFileTypes: true }).catch(() => []);
  for (const yearEntry of years) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;
    const yearDir = path.join(archivesDir, yearEntry.name);
    const months = await fs.readdir(yearDir, { withFileTypes: true }).catch(() => []);
    for (const monthEntry of months) {
      if (!monthEntry.isDirectory() || !/^\d{2}$/.test(monthEntry.name)) continue;
      const key = `${yearEntry.name}/${monthEntry.name}`;
      const html = await fs.readFile(path.join(yearDir, monthEntry.name, 'index.html'), 'utf8').catch(() => '');
      if (!validKeys.has(key) && html.includes(generatedBy)) {
        await fs.rm(path.join(yearDir, monthEntry.name), { recursive: true, force: true });
      }
    }
    const yearHtml = await fs.readFile(path.join(yearDir, 'index.html'), 'utf8').catch(() => '');
    const remainingMonths = (await fs.readdir(yearDir, { withFileTypes: true }).catch(() => [])).filter((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name));
    if (!validKeys.has(yearEntry.name) && yearHtml.includes(generatedBy) && remainingMonths.length === 0) {
      await fs.rm(yearDir, { recursive: true, force: true });
    }
  }
}

function archiveListPage(title, canonical, posts) {
  const sorted = [...posts].sort((a, b) => b.date - a.date);
  return pageShell({
    title,
    description: `${title} 下的文章。`,
    canonical,
    active: 'archives',
    body: `  <header class="page-hero"><span class="eyebrow">ARCHIVE</span><h1>${escapeHtml(title)}</h1><p class="hero-copy">共 ${sorted.length} 篇笔记。</p></header>
  <main class="section"><div class="section-head"><h2>${sorted.length} 篇文章</h2><p><a class="button" href="/archives/">返回完整归档</a></p></div><div class="grid cols-3">${cardsForPosts(sorted)}</div></main>`
  });
}

async function writeLegacyArchiveAliases(posts) {
  const aliases = [
    'page/2/index.html',
    'page/3/index.html',
    'archives/page/2/index.html',
    'archives/page/3/index.html',
    'archives/2020/page/2/index.html',
    'archives/2020/03/page/2/index.html'
  ];
  const recent = posts.slice(0, 12);
  const html = pageShell({
    title: '笔记列表',
    description: 'Anred Lab 技术博客历史分页入口。',
    canonical: '/archives/',
    active: 'archives',
    body: `  <header class="page-hero"><span class="eyebrow">ARCHIVE ALIAS</span><h1>旧分页入口已合并。</h1><p class="hero-copy">这个地址保留兼容性。完整、自动更新的文章列表请进入归档。</p><div class="hero-actions"><a class="button primary" href="/archives/">查看完整归档</a></div></header>
  <main class="section"><div class="section-head"><h2>最近 ${recent.length} 篇</h2><p>运行 <code>npm run build</code> 后自动更新。</p></div><div class="grid cols-3">${cardsForPosts(recent)}</div></main>`
  });
  for (const alias of aliases) {
    await writePage(alias, html);
  }
}

async function writeMarkdownArticles(posts) {
  const all = [...posts].sort((a, b) => a.date - b.date);
  await cleanupGeneratedArticles(new Set(posts.filter((item) => item.source === 'markdown').map((item) => item.url)));
  for (const post of posts.filter((item) => item.source === 'markdown')) {
    const index = all.findIndex((item) => item.url === post.url);
    await fs.mkdir(post.outputDir, { recursive: true });
    await fs.writeFile(path.join(post.outputDir, 'index.html'), articleShell(post, all[index - 1], all[index + 1]));
  }
}

async function cleanupGeneratedArticles(validUrls) {
  const files = (await walk(root))
    .filter((file) => /\/20\d{2}\/\d{2}\/\d{2}\/.+\/index\.html$/.test(file));
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8').catch(() => '');
    if (!html.includes(generatedBy)) continue;
    const relDir = path.dirname(path.relative(root, file));
    const url = `/${relDir.split(path.sep).map(encodeURIComponent).join('/')}/`;
    if (!validUrls.has(url)) {
      await fs.rm(path.dirname(file), { recursive: true, force: true });
    }
  }
}

async function writePage(relative, html) {
  const file = path.join(root, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

async function cleanupGeneratedDirs(baseDir, validNames) {
  const entries = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || validNames.has(entry.name)) continue;
    const indexFile = path.join(baseDir, entry.name, 'index.html');
    const html = await fs.readFile(indexFile, 'utf8').catch(() => '');
    if (html.includes(generatedBy)) {
      await fs.rm(path.join(baseDir, entry.name), { recursive: true, force: true });
    }
  }
}

async function main() {
  const existingPosts = await readExistingPosts();
  const markdownPosts = await readMarkdownPosts();
  const posts = [...existingPosts, ...markdownPosts].sort((a, b) => b.date - a.date);
  await writeMarkdownArticles(posts);
  await updateHome(posts);
  await writeArchives(posts);
  await writeCategories(posts);
  await writeTags(posts);
  console.log(`Built ${posts.length} posts, ${markdownPosts.length} from Markdown.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
