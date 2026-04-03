// @ts-nocheck
import {
  getAnnotationSurface,
  getElementClasses,
  getElementPath,
  getNearbyText,
  identifyElement,
} from '../../src/utils/domInspector';

describe('getElementClasses', () => {
  it('returns space-separated class string', () => {
    const el = document.createElement('div');
    el.className = '  foo   bar  ';
    expect(getElementClasses(el)).toBe('foo bar');
  });

  it('returns empty string for non-string className', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    expect(getElementClasses(el)).toBe('');
  });

  it('returns empty string for element with no classes', () => {
    const el = document.createElement('div');
    expect(getElementClasses(el)).toBe('');
  });
});

describe('getNearbyText', () => {
  it('returns trimmed text content', () => {
    const el = document.createElement('button');
    el.textContent = '  Save Changes  ';
    expect(getNearbyText(el)).toBe('Save Changes');
  });

  it('collapses internal whitespace', () => {
    const el = document.createElement('div');
    el.textContent = 'Hello   World\n  Foo';
    expect(getNearbyText(el)).toBe('Hello World Foo');
  });

  it('truncates at 120 characters', () => {
    const el = document.createElement('div');
    el.textContent = 'a'.repeat(200);
    expect(getNearbyText(el)).toHaveLength(120);
  });
});

describe('getElementPath', () => {
  it('returns tag name for a simple element', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(getElementPath(div)).toBe('div');
    div.remove();
  });

  it('includes id when present', () => {
    const el = document.createElement('section');
    el.id = 'main';
    document.body.appendChild(el);
    expect(getElementPath(el)).toBe('section#main');
    el.remove();
  });

  it('includes first two classes when no id', () => {
    const el = document.createElement('button');
    el.className = 'btn primary large';
    document.body.appendChild(el);
    expect(getElementPath(el)).toBe('button.btn.primary');
    el.remove();
  });

  it('builds path for nested elements', () => {
    const outer = document.createElement('div');
    outer.id = 'app';
    const inner = document.createElement('button');
    inner.className = 'submit';
    outer.appendChild(inner);
    document.body.appendChild(outer);
    expect(getElementPath(inner)).toBe('div#app > button.submit');
    outer.remove();
  });

  it('crosses shadow DOM boundaries', () => {
    const host = document.createElement('my-app');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    inner.className = 'cta';
    shadow.appendChild(inner);
    const path = getElementPath(inner);
    expect(path).toBe('my-app > button.cta');
    host.remove();
  });
});

describe('identifyElement', () => {
  it('returns name and path', () => {
    const el = document.createElement('button');
    el.className = 'primary';
    document.body.appendChild(el);
    const { name, path } = identifyElement(el);
    expect(name).toBe('button.primary');
    expect(path).toBe('button.primary');
    el.remove();
  });
});

describe('getAnnotationSurface', () => {
  it('returns page when no dialog-like container is present', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);

    expect(getAnnotationSurface(el)).toEqual({ kind: 'page', label: 'Page' });

    el.remove();
  });

  it('returns dialog when inside a native dialog', () => {
    const dialog = document.createElement('dialog');
    const title = document.createElement('h2');
    title.textContent = 'Invite people';
    const btn = document.createElement('button');
    dialog.append(title, btn);
    document.body.appendChild(dialog);

    expect(getAnnotationSurface(btn)).toEqual({ kind: 'dialog', label: 'Dialog: Invite people' });

    dialog.remove();
  });

  it('uses aria-label for dialog-like containers', () => {
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Share link');
    const btn = document.createElement('button');
    panel.appendChild(btn);
    document.body.appendChild(panel);

    expect(getAnnotationSurface(btn)).toEqual({ kind: 'dialog', label: 'Dialog: Share link' });

    panel.remove();
  });
});
