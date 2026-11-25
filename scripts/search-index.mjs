import fs from 'node:fs/promises';
import path from 'node:path';

function xml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function terms(group, tag, items) {
  const children = items.map(item => `<${tag}>${xml(item)}</${tag}>`).join('');
  return `    <${group}>${children}</${group}>`;
}

export async function writeSearchIndex(posts) {
  const entries = [];
  for (const post of posts) {
    const article = await fs.readFile(path.join('articles', post.slug + '.html'), 'utf8');
    const body = article.match(/<div class="prose">([\s\S]*?)<\/div>\s*<nav\b/);
    const description = article.match(/<meta name="description" content="([^"]*)">/);
    const searchContent = body?.[1] ?? description?.[1];
    if (!searchContent) throw new Error('Missing article body for search: ' + post.slug);
    const content = searchContent.replaceAll(']]>', ']]]]><![CDATA[>');
    entries.push([
      '  <entry>',
      '    <title>' + xml(post.title) + '</title>',
      '    <url>/articles/' + xml(encodeURIComponent(post.slug)) + '.html</url>',
      '    <content><![CDATA[' + content + ']]></content>',
      terms('categories', 'category', post.categories),
      terms('tags', 'tag', post.tags),
      '  </entry>'
    ].join('\n'));
  }
  await fs.writeFile('search.xml', ['<?xml version="1.0" encoding="utf-8"?>', '<search>',
    ...entries, '</search>', ''].join('\n'));
}
