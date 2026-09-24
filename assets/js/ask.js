/* "Ask my portfolio": the chat box. It posts the question to the Cloudflare Worker (agent/), which
   calls Claude with the knowledge base and verifies every quote. With no worker configured it runs
   the same offline keyword search in the browser, and says so. */
import { extractiveAnswer } from './agent-core.js';
import { $, $$ } from './ui.js';

export function initAsk() {
  const box = $('#askBox');
  if (!box) return;
  const log = $('#askLog');
  const form = $('#askForm');
  const input = $('#askInput');
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const endpoint = (local ? box.dataset.endpointLocal : box.dataset.endpoint) || '';
  const history = [];
  let kb = null;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  async function answer(question) {
    if (endpoint) {
      const res = await fetch(endpoint.replace(/\/$/, '') + '/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `The agent answered with an error (${res.status}).`);
      return data;
    }
    kb ??= await fetch('assets/data/kb.json').then((r) => r.json());
    return extractiveAnswer(kb.passages, question);
  }

  function render(a, n) {
    const msg = el('div', 'msg msg--bot');
    const p = el('p');
    for (const part of a.parts || []) {
      p.append(part.text);
      for (const r of part.refs) {
        const sup = el('sup', 'ref');
        const link = el('a', '', `[${r}]`);
        link.href = `#src-${n}-${r}`;
        sup.append(link);
        p.append(sup);
      }
    }
    if (!(a.parts || []).length) p.textContent = 'I could not find anything about that in his portfolio.';
    msg.append(p);
    if (a.sources?.length) {
      const list = el('ol', 'msg__sources');
      a.sources.forEach((s, i) => {
        const li = el('li');
        li.id = `src-${n}-${i + 1}`;
        const body = el('span');
        body.append(el('q', '', s.quote), ' ');
        const go = el('a', '', s.title);
        go.href = s.section;
        body.append(go);
        li.append(el('span', 'n', String(i + 1)), body);
        list.append(li);
      });
      msg.append(list);
    }
    const trace = el('p', 'msg__trace');
    if (a.mode === 'ai') {
      trace.append(el('span', 'ok', `${a.sources.length} of ${a.cited} quotes verified`));
      if (a.rejected) trace.append(el('span', '', `${a.rejected} dropped, not found in the knowledge base`));
      trace.append(el('span', '', `Answered by ${a.model}`));
    } else if (a.mode === 'offline') {
      trace.append(el('span', '', 'Offline mode: the closest passage by keyword search, no AI'));
    } else if (a.mode === 'no-quote') {
      trace.append(el('span', '', 'No verified quote, so no answer'));
    }
    if (a.note) trace.append(el('span', '', a.note));
    msg.append(trace);
    return msg;
  }

  let count = 0;
  async function ask(question) {
    question = question.trim();
    if (question.length < 2) return;
    log.append(el('div', 'msg msg--user', question));
    const pending = el('div', 'msg msg--bot msg--pending');
    pending.append(el('p', '', 'Checking the knowledge base'));
    log.append(pending);
    scrollDown();
    input.value = '';
    form.querySelector('button').disabled = true;
    try {
      const a = await answer(question);
      pending.replaceWith(render(a, ++count));
      if (a.mode === 'ai') {
        history.push({ q: question, a: (a.parts || []).map((x) => x.text).join('') });
        history.splice(0, Math.max(0, history.length - 2));
      }
    } catch (err) {
      const msg = el('div', 'msg msg--bot');
      msg.append(el('p', '', err.message || 'Something went wrong. Try again in a moment.'));
      pending.replaceWith(msg);
    } finally {
      form.querySelector('button').disabled = false;
      scrollDown();
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  $$('#askChips button').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
  // keep wheel scrolling inside the chat log instead of the page
  log.setAttribute('data-lenis-prevent', '');
}
