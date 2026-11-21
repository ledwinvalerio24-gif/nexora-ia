'use strict';

const $ = id => document.getElementById(id);
let chats = [], active = '', busy = false, epoch = 0;
const client = () => window.nexoraSupabase;
const uuid = () => crypto.randomUUID();
const errorText = e => e?.message || 'No se pudo completar la operación.';
const current = () => chats.find(c => c.id === active);

// Markdown seguro: se construyen nodos DOM, nunca HTML procedente de la IA.
function inlineMarkdown(text, parent) {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > start) parent.append(document.createTextNode(text.slice(start, index)));
    const part = match[0];
    if (part.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      parent.append(strong);
    } else if (part.startsWith('*')) {
      const em = document.createElement('em');
      em.textContent = part.slice(1, -1);
      parent.append(em);
    } else if (part.startsWith('`')) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      parent.append(code);
    } else {
      const m = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (m) {
        const a = document.createElement('a');
        a.textContent = m[1];
        a.href = m[2];
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        parent.append(a);
      } else parent.append(document.createTextNode(part));
    }
    start = index + part.length;
  }
  if (start < text.length) parent.append(document.createTextNode(text.slice(start)));
}

function formattedMessage(content, parent) {
  const lines = String(content || '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) codeLines.push(lines[i++]);
      if (i < lines.length) i++;
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      if (language) code.dataset.language = language.slice(0, 24);
      pre.append(code);
      parent.append(pre);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const h = document.createElement('h' + heading[1].length);
      inlineMarkdown(heading[2], h);
      parent.append(h); i++; continue;
    }
    const item = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.+)$/.exec(line);
    if (item) {
      const ordered = Boolean(item[2]);
      const list = document.createElement(ordered ? 'ol' : 'ul');
      while (i < lines.length) {
        const next = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.+)$/.exec(lines[i]);
        if (!next || Boolean(next[2]) !== ordered) break;
        const li = document.createElement('li');
        inlineMarkdown(next[3], li);
        list.append(li); i++;
      }
      parent.append(list); continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^\s*```/.test(lines[i]) && !/^#{1,3}\s+/.test(lines[i]) && !/^\s*(?:[-*+]\s+|\d+\.\s+)/.test(lines[i])) {
      paragraph.push(lines[i++]);
    }
    if (paragraph.length) {
      const p = document.createElement('p');
      paragraph.forEach((part, index) => {
        if (index) p.append(document.createElement('br'));
        inlineMarkdown(part, p);
      });
      parent.append(p);
    } else i++;
  }
}

function welcome(area) {
  const w = document.createElement('div');
  w.className = 'welcome';
  w.innerHTML = '<div class="hero-icon">✦</div><p class="eyebrow">TU ESPACIO INTELIGENTE</p><h1>¡Hola! Soy <span>Nexora.</span></h1><p>Tu asistente creativo con inteligencia artificial real y conversaciones privadas.</p><div class="suggestions"><button data-prompt="Ayúdame a organizar mi semana">📅 Organiza mi semana</button><button data-prompt="Dame ideas para un proyecto creativo">💡 Ideas creativas</button><button data-prompt="Explícame cómo aprender programación">💻 Aprender programación</button><button data-prompt="Ayúdame a escribir un correo profesional">✍️ Escribir un correo</button></div>';
  area.append(w);
  w.querySelectorAll('[data-prompt]').forEach(b => b.onclick = () => send(b.dataset.prompt));
}

function render() {
  const list = $('chats');
  list.replaceChildren();
  chats.forEach(c => {
    const b = document.createElement('button');
    b.textContent = '💬 ' + c.title;
    b.className = c.id === active ? 'active' : '';
    b.onclick = () => {
      active = c.id;
      render();
      document.querySelector('.sidebar')?.classList.remove('open');
    };
    list.append(b);
  });
  const area = $('messages');
  area.replaceChildren();
  const chat = current();
  if (!chat || !chat.messages.length) welcome(area);
  else {
    chat.messages.forEach(m => {
      const row = document.createElement('div');
      row.className = 'message ' + m.role;
      if (m.role === 'assistant') {
        const avatar = document.createElement('span');
        avatar.className = 'avatar';
        avatar.textContent = '✦';
        row.append(avatar);
      }
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      if (m.role === 'assistant') {
        formattedMessage(m.content, bubble);
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'nexora-copy';
        copy.textContent = '📋 Copiar';
        copy.setAttribute('aria-label', 'Copiar respuesta');
        copy.onclick = async () => {
          try {
            await navigator.clipboard.writeText(m.content);
            copy.textContent = '✓ Copiado';
          } catch { copy.textContent = 'No se pudo copiar'; }
        };
        bubble.append(copy);
      } else bubble.textContent = m.content;
      row.append(bubble);
      area.append(row);
    });
    if (busy && chat.id === active) {
      const row = document.createElement('div');
      row.className = 'message assistant';
      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.textContent = '✦';
      const bubble = document.createElement('div');
      bubble.className = 'bubble nexora-thinking';
      bubble.textContent = 'Nexora está pensando';
      const dots = document.createElement('span');
      dots.className = 'nexora-dots';
      dots.textContent = ' ● ● ●';
      bubble.append(dots);
      row.append(avatar, bubble);
      area.append(row);
    }
  }
  area.scrollTop = area.scrollHeight;
}

function notify(s) {
  $('disclaimerStatus')?.remove();
  const p = document.createElement('p');
  p.id = 'disclaimerStatus';
  p.className = 'disclaimer';
  p.textContent = s;
  $('form').after(p);
}

async function loadChats() {
  const run = ++epoch;
  chats = []; active = ''; render();
  if (!window.nexoraUserId || !client()) return;
  const {data, error} = await client().from('conversations')
    .select('id,title,created_at,messages(id,role,content,created_at)')
    .order('created_at', {ascending:false});
  if (run !== epoch) return;
  if (error) {
    notify('No se pudo cargar el historial: ' + errorText(error) + '. Ejecuta el SQL de instalación.');
    return;
  }
  chats = (data || []).map(c => ({
    ...c,
    messages: (c.messages || []).sort((a,b) => a.created_at.localeCompare(b.created_at))
  }));
  active = chats[0]?.id || '';
  render();
}
window.addEventListener('nexora-auth', loadChats);

async function createChat() {
  if (!window.nexoraUserId) { window.nexoraShowAuth?.(); return null; }
  const id = uuid();
  const chat = {id, title:'Nueva conversación', messages:[]};
  const {error} = await client().from('conversations').insert({
    id, user_id:window.nexoraUserId, title:chat.title
  });
  if (error) throw error;
  chats.unshift(chat); active = id; render();
  return chat;
}

async function send(text) {
  if (busy) return;
  if (!window.nexoraUserId || !client()) { window.nexoraShowAuth?.(); return; }
  const value = (text || '').trim();
  if (!value) return;
  if (value.length > 4000) { notify('El mensaje supera el límite de 4000 caracteres.'); return; }
  busy = true;
  const submit = $('form').querySelector('button[type=submit]');
  submit.disabled = true;
  const owner = window.nexoraUserId;
  let chatId = '';
  try {
    let chat = current();
    if (!chat) chat = await createChat();
    if (!chat) return;
    chatId = chat.id;
    const {error:saveError} = await client().from('messages').insert({
      conversation_id:chatId, user_id:owner, role:'user', content:value
    });
    if (saveError) throw saveError;
    chat.messages.push({id:uuid(), role:'user', content:value});
    if (chat.title === 'Nueva conversación') {
      chat.title = value.slice(0,45);
      await client().from('conversations').update({title:chat.title}).eq('id',chatId);
    }
    $('prompt').value = '';
    render();
    notify('Nexora está pensando…');
    const {data:{session}} = await client().auth.getSession();
    if (!session?.access_token) throw Error('Inicia sesión de nuevo.');
    const response = await fetch('/api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + session.access_token},
      body:JSON.stringify({conversationId:chatId})
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw Error('El servidor devolvió una respuesta no válida (HTTP ' + response.status + '). Revisa Vercel Logs.'); }
    if (!response.ok) throw Error(data.error || 'Error de IA (HTTP ' + response.status + ')');
    if (typeof data.reply !== 'string' || !data.reply.trim()) throw Error('La IA devolvió una respuesta vacía.');
    if (owner !== window.nexoraUserId) return;
    chat.messages.push({id:uuid(), role:'assistant', content:data.reply});
    notify('Respuesta guardada en tu historial privado.');
  } catch(e) { notify('Error: ' + errorText(e)); }
  finally { busy = false; submit.disabled = false; render(); }
}

$('form').addEventListener('submit', e => { e.preventDefault(); send($('prompt').value); });
$('prompt').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send($('prompt').value); }
});
$('newChat').onclick = async () => {
  try { await createChat(); document.querySelector('.sidebar')?.classList.remove('open'); }
  catch(e) { notify(errorText(e)); }
};
$('clear').onclick = async () => {
  if (!window.nexoraUserId) return window.nexoraShowAuth?.();
  if (!confirm('¿Eliminar permanentemente TODAS tus conversaciones en Supabase?')) return;
  const {error} = await client().from('conversations').delete().eq('user_id', window.nexoraUserId);
  if (error) return notify(errorText(error));
  chats = []; active = ''; render(); notify('Historial eliminado.');
};
$('menu').onclick = () => document.querySelector('.sidebar')?.classList.toggle('open');

// Estilos complementarios encapsulados: no requieren editar styles.css.
const nexoraStyle = document.createElement('style');
nexoraStyle.textContent = `
.message.assistant .bubble p { margin: 0 0 .75em; line-height: 1.65; }
.message.assistant .bubble p:last-of-type { margin-bottom: .3em; }
.message.assistant .bubble h1, .message.assistant .bubble h2,
.message.assistant .bubble h3 { margin: .55em 0 .35em; line-height: 1.35; }
.message.assistant .bubble ul, .message.assistant .bubble ol { margin: .5em 0 .8em; padding-left: 1.5em; }
.message.assistant .bubble li { margin: .3em 0; }
.message.assistant .bubble pre { overflow-x: auto; white-space: pre; padding: 14px;
  border-radius: 12px; background: rgba(0,0,0,.32); font-size: .9em; }
.message.assistant .bubble :not(pre) > code { background: rgba(255,255,255,.12);
  padding: .1em .3em; border-radius: 5px; }
.message.assistant .bubble a { color: #9cc6ff; overflow-wrap: anywhere; }
.nexora-copy { display: block; margin-top: 12px; border: 1px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.08); color: inherit; border-radius: 9px;
  padding: 6px 10px; font-size: 12px; cursor: pointer; }
.nexora-copy:hover { background: rgba(255,255,255,.17); }
.nexora-dots { display: inline-block; animation: nexoraPulse 1.2s ease-in-out infinite; }
@keyframes nexoraPulse { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .nexora-dots { animation: none; } }
`;
document.head.append(nexoraStyle);
render();

// Nexora 6.0: precargar ideas desde la página principal sin enviarlas automáticamente.
try { const idea = new URLSearchParams(window.location.search).get('prompt'); if (idea && idea.length <= 4000) { const box = document.getElementById('prompt'); if (box) box.value = idea; } } catch (_) {}
