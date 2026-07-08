import { downloadFile } from './exportNote.js';

function slug(s) {
  return (s || 'roadmap').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'roadmap';
}

function counts(phases) {
  const total = phases.reduce((s, p) => s + p.steps.length, 0);
  const done = phases.reduce((s, p) => s + p.steps.filter((x) => x.done).length, 0);
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

// A roadmap → GitHub-flavoured Markdown: title, pitch, then each phase as a
// heading with its brief (blockquote) and its steps as checkboxes; a step's
// detail note is indented beneath it.
export function roadmapToMarkdown(idea, phases) {
  const c = counts(phases);
  const out = [`# ${idea.title || 'Roadmap'}`, ''];
  if (idea.note) out.push(idea.note.trim(), '');
  out.push(`*${phases.length} phase${phases.length === 1 ? '' : 's'} · ${c.done}/${c.total} steps · ${c.pct}% complete*`, '');
  phases.forEach((p, i) => {
    out.push(`## ${i + 1}. ${p.title || 'Untitled phase'}`, '');
    if (p.note) out.push(p.note.trim().split('\n').map((l) => `> ${l}`).join('\n'), '');
    for (const s of p.steps) {
      out.push(`- [${s.done ? 'x' : ' '}] ${s.label || ''}`);
      if (s.note) for (const l of s.note.trim().split('\n')) out.push(`  ${l}`);
    }
    out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function esc(s) {
  return String(s || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

// A printable HTML document (used for Print / Save-as-PDF).
export function roadmapToHtml(idea, phases) {
  const c = counts(phases);
  const body = phases.map((p, i) => {
    const steps = p.steps.map((s) =>
      `<li class="${s.done ? 'done' : ''}"><span class="box">${s.done ? '&#10003;' : ''}</span><span class="lbl">${esc(s.label)}</span>${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}</li>`,
    ).join('');
    return `<section><h2><span class="n">${i + 1}</span> ${esc(p.title || 'Untitled phase')}</h2>${p.note ? `<blockquote>${esc(p.note)}</blockquote>` : ''}<ul>${steps || '<li class="empty">No steps yet.</li>'}</ul></section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(idea.title)}</title>
<style>
  :root { --ink:#0F1B2D; --terra:#C65D3E; --slate:#4A5568; --sand:#E8DDD0; }
  * { box-sizing:border-box; }
  body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:var(--ink); max-width:44rem; margin:2.5rem auto; padding:0 1.5rem; line-height:1.55; }
  h1 { font-family:'IBM Plex Serif',Georgia,serif; font-size:2rem; margin:0 0 .25rem; }
  .pitch { color:var(--slate); margin:.25rem 0 .5rem; }
  .summary { font-size:.8rem; color:var(--slate); border-bottom:1px solid var(--sand); padding-bottom:1rem; margin-bottom:1.5rem; }
  section { margin-bottom:1.75rem; break-inside:avoid; }
  h2 { font-family:'IBM Plex Serif',Georgia,serif; font-size:1.25rem; margin:0 0 .5rem; }
  h2 .n { color:var(--terra); }
  blockquote { margin:0 0 .75rem; padding:.5rem .85rem; background:rgba(198,93,62,.06); border-left:2px solid var(--terra); color:var(--slate); font-size:.9rem; }
  ul { list-style:none; margin:0; padding:0; }
  li { display:grid; grid-template-columns:1.3rem 1fr; gap:.5rem; align-items:start; padding:.3rem 0; }
  li .box { width:1.05rem; height:1.05rem; border:1.5px solid var(--sand); border-radius:.3rem; display:grid; place-items:center; color:var(--terra); font-size:.8rem; margin-top:.1rem; }
  li.done .box { border-color:var(--terra); }
  li.done .lbl { color:var(--slate); }
  li .note { grid-column:2; color:var(--slate); font-size:.82rem; margin-top:.15rem; }
  li.empty { color:var(--slate); display:block; }
</style></head><body>
  <h1>${esc(idea.title || 'Roadmap')}</h1>
  ${idea.note ? `<p class="pitch">${esc(idea.note)}</p>` : ''}
  <p class="summary">${phases.length} phase${phases.length === 1 ? '' : 's'} · ${c.done}/${c.total} steps · ${c.pct}% complete</p>
  ${body}
</body></html>`;
}

export function downloadRoadmapMarkdown(idea, phases) {
  downloadFile(`${slug(idea.title)}.md`, roadmapToMarkdown(idea, phases), 'text/markdown;charset=utf-8');
}

export async function copyRoadmapMarkdown(idea, phases) {
  await navigator.clipboard.writeText(roadmapToMarkdown(idea, phases));
}

export function printRoadmap(idea, phases) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('popup blocked');
  w.document.write(roadmapToHtml(idea, phases));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
