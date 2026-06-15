export interface NoteData {
  id: string;
  title: string;
  meta: string;   // e.g. "found · Level 0"
  body: string[]; // paragraphs
  sig?: string;
}

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** Notes inventory + paper reader. The narrative lives here. */
export class Journal {
  private overlay = el('div', 'overlay');
  private collected: NoteData[] = [];
  private mode: 'closed' | 'list' | 'read' = 'closed';
  private onCloseCb: (() => void) | null = null;

  constructor() {
    this.overlay.id = 'journal';
    document.body.appendChild(this.overlay);
  }

  isOpen() { return this.mode !== 'closed'; }
  has(id: string) { return this.collected.some((n) => n.id === id); }
  count() { return this.collected.length; }

  /** Add to inventory and immediately show the paper reader. */
  openNote(note: NoteData, onClose?: () => void) {
    if (!this.has(note.id)) this.collected.push(note);
    this.onCloseCb = onClose ?? null;
    this.renderReader(note);
    this.overlay.classList.add('show');
    this.mode = 'read';
  }

  toggle(onOpen?: () => void, onClose?: () => void) {
    if (this.mode === 'closed') { this.renderList(); this.overlay.classList.add('show'); this.mode = 'list'; onOpen?.(); this.onCloseCb = onClose ?? null; }
    else this.close();
  }

  close() {
    this.overlay.classList.remove('show');
    this.mode = 'closed';
    const cb = this.onCloseCb; this.onCloseCb = null;
    cb?.();
  }

  clear() { this.collected = []; }

  private renderReader(note: NoteData) {
    const body = note.body.map((p) => `<p>${p}</p>`).join('');
    this.overlay.innerHTML = '';
    const note$ = el('div', 'note');
    note$.innerHTML = `<h3>${note.title}</h3>${body}${note.sig ? `<div class="sig">${note.sig}</div>` : ''}
      <div class="note__hint">TAB / ESC / CLICK TO CLOSE</div>`;
    note$.addEventListener('click', () => this.close());
    this.overlay.appendChild(note$);
  }

  private renderList() {
    this.overlay.innerHTML = '';
    const panel = el('div', 'panel');
    let inner = `<div class="panel__kicker">FIELD JOURNAL</div>
      <div class="panel__title" style="font-size:clamp(20px,5vw,30px)">NOTES · ${this.collected.length}</div>`;
    if (this.collected.length === 0) {
      inner += `<div class="journal-empty">No notes yet. The lost left messages — find them in drawers and on the walls.</div>`;
    } else {
      inner += '<ul class="journal-list">' + this.collected.map((n, i) =>
        `<li data-i="${i}">${n.title}<span class="meta">${n.meta}</span></li>`).join('') + '</ul>';
    }
    inner += `<div class="btn-row" style="margin-top:20px"><button class="btn" data-act="back">CLOSE</button></div>`;
    panel.innerHTML = inner;
    panel.querySelectorAll('.journal-list li').forEach((li) => {
      li.addEventListener('click', () => {
        const i = parseInt((li as HTMLElement).dataset.i!, 10);
        this.renderReader(this.collected[i]);
        this.mode = 'read';
      });
    });
    panel.querySelector('[data-act="back"]')!.addEventListener('click', () => this.close());
    this.overlay.appendChild(panel);
  }
}
