import TurndownService from 'turndown';

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

// Tiptap task items → GitHub-style checkboxes
td.addRule('taskItems', {
  filter: (node) => node.nodeName === 'LI' && node.parentNode?.getAttribute?.('data-type') === 'taskList',
  replacement: (_content, node) => {
    const checked = node.getAttribute('data-checked') === 'true';
    const text = (node.querySelector('div')?.textContent || node.textContent || '').trim();
    return `- [${checked ? 'x' : ' '}] ${text}\n`;
  },
});

// Callout blocks → blockquote with a tone prefix
td.addRule('callout', {
  filter: (node) => node.nodeName === 'ASIDE' && node.classList?.contains('callout'),
  replacement: (content) => content.trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n',
});

// @mentions → just the label text
td.addRule('mention', {
  filter: (node) => node.nodeName === 'SPAN' && node.classList?.contains('mention'),
  replacement: (_c, node) => node.getAttribute('data-label') || node.textContent || '',
});

function slugify(s) {
  return (s || 'note').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'note';
}

function noteTags(note) {
  return (note.universal_tags?.length ? note.universal_tags : note.tags) || [];
}

// Fetch every /api/uploads image and inline it as a base64 data URI so the
// exported file is fully self-contained (works offline, in any viewer).
async function inlineImages(html) {
  if (!html || html.indexOf('<img') === -1) return html || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgs = [...doc.querySelectorAll('img')];
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return;
    try {
      const url = src.startsWith('http') ? src : (window.location.origin + src);
      const res = await fetch(url, { credentials: 'include' });
      const blob = await res.blob();
      const dataUri = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      img.setAttribute('src', dataUri);
    } catch { /* leave original src */ }
  }));
  return doc.body.innerHTML;
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function noteToMarkdown(note, { inline = true } = {}) {
  let html = note.body || '';
  if (inline) html = await inlineImages(html);
  const body = td.turndown(html);
  const tags = noteTags(note);
  const header = [
    `# ${note.title || 'Untitled'}`,
    '',
    tags.length ? `Tags: ${tags.map((t) => '#' + t).join(' ')}` : null,
    note.created_at ? `Created: ${new Date(note.created_at).toLocaleString()}` : null,
    '',
    '---',
    '',
  ].filter((x) => x !== null).join('\n');
  return `${header}${body}\n`;
}

const PRINT_STYLES = `
  :root { --ink:#0F1B2D; --terra:#C65D3E; --slate:#4A5568; --sand:#E8DDD0; }
  * { box-sizing: border-box; }
  body { font-family: Inter, -apple-system, system-ui, sans-serif; color: var(--ink); line-height: 1.6; max-width: 720px; margin: 2.5rem auto; padding: 0 1.5rem; }
  h1,h2,h3,h4 { font-family: 'IBM Plex Serif', Georgia, serif; }
  h1 { font-size: 1.9rem; margin: 0 0 0.25rem; }
  .meta { color: var(--slate); font-size: 0.8rem; margin-bottom: 1.5rem; }
  .tag { background: var(--sand); color: var(--ink); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px; }
  strong { color: var(--terra); }
  a { color: var(--terra); }
  img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--sand); margin: .5rem 0; }
  blockquote { border-left: 3px solid var(--sand); padding-left: .75rem; color: var(--slate); margin: .5rem 0; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  ul[data-type="taskList"] li { display: flex; gap: .5rem; align-items: flex-start; }
  aside.callout { border-left: 3px solid var(--terra); background: rgba(198,93,62,.08); border-radius: 8px; padding: .6rem .9rem; margin: .5rem 0; }
  pre { background: var(--ink); color: #FBF8F3; padding: .75rem; border-radius: 6px; overflow-x: auto; }
  code { background: var(--sand); padding: 1px 4px; border-radius: 4px; }
  pre code { background: transparent; }
  @media print { body { margin: 0; max-width: none; } }
`;

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function noteToHtmlDoc(note) {
  const body = await inlineImages(note.body || '');
  const tags = noteTags(note);
  const tagsHtml = tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join(' ');
  const created = note.created_at ? new Date(note.created_at).toLocaleString() : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(note.title || 'Note')}</title>
<style>${PRINT_STYLES}</style></head>
<body>
<h1>${escapeHtml(note.title || 'Untitled')}</h1>
<div class="meta">${tagsHtml}${tags.length && created ? ' · ' : ''}${created ? 'Created ' + escapeHtml(created) : ''}</div>
<div class="note-body">${body}</div>
</body></html>`;
}

export async function exportNoteMarkdown(note) {
  const md = await noteToMarkdown(note);
  downloadFile(`${slugify(note.title)}.md`, md, 'text/markdown;charset=utf-8');
}

export async function exportNoteHtml(note) {
  const html = await noteToHtmlDoc(note);
  downloadFile(`${slugify(note.title)}.html`, html, 'text/html;charset=utf-8');
}

export async function printNote(note) {
  const html = await noteToHtmlDoc(note);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

// Combine many notes into one Markdown file.
export async function exportNotesMarkdown(notes) {
  const parts = [];
  for (const n of notes) {
    parts.push(await noteToMarkdown(n));
    parts.push('\n\n');
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`notes-${stamp}.md`, parts.join(''), 'text/markdown;charset=utf-8');
}
