import fs from 'node:fs/promises';
import path from 'node:path';
import { writeArchivePeriods } from './legacy-navigation.mjs';
import { writeSearchIndex } from './search-index.mjs';

const root = process.cwd();
const contentDir = path.join(root, 'content/posts');
const articlesDir = path.join(root, 'articles');
const generatedBy = '<!-- generated-by: scripts/build-site.mjs -->';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
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
  const match = source.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file} is missing YAML frontmatter`);

  const data = Object.create(null);
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

async function markdownFiles(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(file));
    else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') files.push(file);
  }
  return files.sort();
}

function topicNames(value) {
  const items = Array.isArray(value) ? value : [value];
  return [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

async function readMarkdownPosts() {
  const posts = [];
  for (const file of await markdownFiles(contentDir)) {
    const { data, body } = parseFrontmatter(await fs.readFile(file, 'utf8'), file);
    if (data.draft === true) continue;
    if (!data.title || typeof data.title !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(data.date)
        || !Number.isFinite(Date.parse(data.date))) {
      throw new Error(`${file} requires a title and an ISO date`);
    }
    const slug = slugify(data.slug || data.title).normalize('NFC');
    if (slug.startsWith('.') || /[\u0000-\u001f]/u.test(slug)) throw new Error(`Invalid slug in ${file}`);
    posts.push({
      slug, title: data.title, date: data.date.slice(0, 10), featured: data.featured === true,
      categories: topicNames(data.categories || '未分类'), tags: topicNames(data.tags),
      description: data.summary || data.title, html: markdownToHtml(body)
    });
  }
  return posts;
}

function articleUrl(post) {
  return `articles/${encodeURIComponent(post.slug)}.html`;
}

function postRow(post) {
  const [year, month, day] = post.date.split('-').map(Number);
  return `<a href="${articleUrl(post)}"><span>${escapeHtml(post.title)}</span><time datetime="${post.date}">${year}年${month}月${day}日</time></a>`;
}

function postRows(posts) {
  return posts.map(post => '          ' + postRow(post)).join('\n');
}

function topicGroups(kind, legacy, posts) {
  const groups = new Map();
  // Existing articles link to these fixed numeric IDs. New topics get permanent
  // IDs derived from their names so adding or removing a note cannot shift them.
  for (const post of legacy) {
    for (const name of post[kind]) {
      if (!groups.has(name)) groups.set(name, { id: `${kind}-${groups.size + 1}`, posts: [] });
    }
  }
  for (const post of posts) {
    for (const name of post[kind]) {
      if (!groups.has(name)) {
        groups.set(name, { id: `${kind}-t-${Buffer.from(name).toString('base64url')}`, posts: [] });
      }
      groups.get(name).posts.push(post);
    }
  }
  return groups;
}

function readerPage({ title, description, canonical, parent = '', body, generatedArticle = false }) {
  return `<!doctype html>
${generatedArticle ? generatedBy + '\n' : ''}<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)} · Andy Zhang</title>
  <link rel="icon" type="image/png" href="/images/andy-zhang-avatar.png">
  <link rel="canonical" href="https://anred.space/${canonical}">
  <link rel="stylesheet" href="${parent}assets/site.css">
</head>
<body>
  <main class="shell">
    <article class="frame reader">
${body}
    </article>
  </main>
</body>
</html>
`;
}

function taxonomyPage(kind, groups) {
  const title = kind === 'tags' ? '标签' : '分类';
  const links = [], sections = [];
  for (const [name, group] of groups) {
    const label = escapeHtml(name);
    links.push(`<li><a href="#${group.id}">${label}</a></li>`);
    sections.push(`<section><h2 id="${group.id}">${label}</h2><div class="post-list">\n${postRows(group.posts)}\n        </div></section>`);
  }
  const body = `      <a class="back" href="index.html">返回首页</a>
      <h1 class="page-title">${title}</h1>
      <ul class="notes">${links.join('')}</ul>
      <div class="writing">${sections.join('')}</div>`;
  return readerPage({ title, description: `按${title}浏览 Anred Lab 的技术笔记。`, canonical: `${kind}.html`, body });
}

function articlePage(post, groups) {
  const links = ['<a href="../index.html#archive">返回文章列表</a>'];
  for (const kind of ['categories', 'tags']) {
    for (const name of post[kind]) {
      links.push(`<a href="../${kind}.html#${groups[kind].get(name).id}">${escapeHtml(name)}</a>`);
    }
  }
  const body = `      <h1 class="page-title">${escapeHtml(post.title)}</h1>
      <header class="byline"><a class="author" href="../index.html"><img src="../images/author.jpg" alt="" width="20" height="20">Peng Zhang</a><span aria-hidden="true">·</span><time datetime="${post.date}">${post.date}</time></header>
      <div class="prose">${post.html}</div>
      <nav class="page-links" aria-label="相关索引">${links.join(' ')}</nav>`;
  return readerPage({ title: post.title, description: post.description, canonical: articleUrl(post),
    parent: '../', body, generatedArticle: true });
}

function homePage(html, posts) {
  const featured = posts.filter(post => post.featured);
  const notes = (featured.length ? featured : posts).slice(0, 6)
    .map(post => `          <li><a href="${articleUrl(post)}">${escapeHtml(post.title)}</a></li>`).join('\n');
  // Only replace the contents of the two public lists. The authored introduction,
  // artwork, headings, and their surrounding layout live in index.html.
  const lists = [
    [/(<section aria-labelledby="notes">\s*<h2[^>]*>[^<]*<\/h2>\s*<ul class="notes">)[\s\S]*?(<\/ul>)/, notes],
    [/(<section aria-labelledby="archive">\s*<h2[^>]*>[^<]*<\/h2>\s*<div class="post-list">)[\s\S]*?(<\/div>)/, postRows(posts)]
  ];
  for (const [pattern, rows] of lists) {
    if (!pattern.test(html)) throw new Error('Missing a generated list in index.html');
    html = html.replace(pattern, (_, open, close) => `${open}\n${rows}\n        ${close}`);
  }
  return html;
}

async function build() {
  const legacy = JSON.parse(await fs.readFile(path.join(root, 'content/legacy-posts.json'), 'utf8'));
  const markdown = await readMarkdownPosts();
  const posts = [...legacy, ...markdown].sort((a, b) => b.date.localeCompare(a.date));
  const slugs = new Set();
  for (const post of posts) {
    const slug = post.slug.normalize('NFC').toLowerCase();
    if (slugs.has(slug)) throw new Error(`Duplicate article URL for ${post.slug}`);
    slugs.add(slug);
  }
  const groups = {
    categories: topicGroups('categories', legacy, posts),
    tags: topicGroups('tags', legacy, posts)
  };
  const outputs = new Map();
  const homeFile = path.join(root, 'index.html');
  outputs.set(homeFile, homePage(await fs.readFile(homeFile, 'utf8'), posts));
  for (const [kind, values] of Object.entries(groups)) {
    outputs.set(path.join(root, `${kind}.html`), taxonomyPage(kind, values));
  }
  for (const post of markdown) {
    outputs.set(path.join(articlesDir, post.slug + '.html'), articlePage(post, groups));
  }

  // Retire only pages previously written by this generator, e.g. a published
  // Markdown note has been renamed, deleted, or switched back to draft.
  const obsolete = [];
  for (const entry of await fs.readdir(articlesDir, { withFileTypes: true })) {
    if (!entry.name.endsWith('.html')) continue;
    if (!entry.isFile()) throw new Error(`Expected regular article file: ${entry.name}`);
    const file = path.join(articlesDir, entry.name);
    const existing = await fs.readFile(file, 'utf8');
    const isGenerated = existing.startsWith('<!doctype html>\n' + generatedBy);
    if (outputs.has(file) && !isGenerated) throw new Error(`Refusing to overwrite existing article: ${entry.name}`);
    if (!outputs.has(file) && isGenerated) obsolete.push(file);
  }
  for (const [file, html] of outputs) await fs.writeFile(file, html);
  for (const file of obsolete) await fs.unlink(file);
  await writeArchivePeriods(posts);
  await writeSearchIndex(posts);
  console.log(`Built ${posts.length} articles, including ${markdown.length} from Markdown.`);
}

build().catch(error => { console.error(error); process.exitCode = 1; });
