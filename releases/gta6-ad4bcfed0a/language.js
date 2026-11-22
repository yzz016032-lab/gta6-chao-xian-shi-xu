(() => {
  'use strict';
  const D = window.Tideline;
  const catalog = D.english;
  const preference = 'tideline/language/v1';
  const chinese = /[\u3400-\u9fff]/;
  const rules = catalog.templates.map(([source, english]) => {
    const slots = [];
    const pieces = source.split(/(\{\d+\})/);
    const expression = pieces.map(piece => {
      if (!/^\{\d+\}$/.test(piece)) return piece.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
      slots.push(Number(piece.slice(1, -1)));
      return '(.+?)';
    }).join('');
    return { expression: new RegExp('^' + expression + '$'), slots, english, prefix: pieces[0],
      specificity: source.replace(/\{\d+\}/g, '').length };
  }).sort((a, b) => b.specificity - a.specificity);
  const cache = new Map();
  const staticText = [], staticAttributes = [];
  const textSources = new WeakMap(), attributeSources = new WeakMap();
  let current = 'zh-CN', screen;

  function englishLine(source) {
    if (Object.hasOwn(catalog.exact, source)) return catalog.exact[source];
    if (cache.has(source)) return cache.get(source);
    let result = source;
    for (const rule of rules) {
      if (!source.startsWith(rule.prefix)) continue;
      const match = rule.expression.exec(source);
      if (!match) continue;
      const values = [];
      rule.slots.forEach((slot, i) => { values[slot] = translate(match[i + 1]); });
      result = rule.english.replace(/\{(\d+)\}/g, (_, slot) => values[slot]);
      break;
    }
    if (result === source && source.includes(' · ')) result = source.split(' · ').map(translate).join(' · ');
    if (cache.size >= 512) cache.clear();
    cache.set(source, result);
    return result;
  }
  function translate(value) {
    const source = String(value ?? '');
    if (current !== 'en' || !chinese.test(source)) return source;
    return source.replace(/\S(?:[\s\S]*\S)?/, phrase => englishLine(phrase));
  }
  function text(element, value) {
    const source = String(value ?? '');
    textSources.set(element, source);
    const display = translate(source);
    if (element.textContent !== display) element.textContent = display;
  }
  function attr(element, name, value) {
    let record = attributeSources.get(element);
    if (!record) { record = new Map(); attributeSources.set(element, record); }
    record.set(name, value);
    const display = translate(value);
    if (element.getAttribute(name) !== display) element.setAttribute(name, display);
  }
  function init(root) {
    screen = root;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (chinese.test(node.data) && !node.parentElement.closest('#language-screen, script, style, [data-language-name]'))
        staticText.push([node, node.data, node.parentElement.dataset.en]);
    }
    const elements = [root, ...root.querySelectorAll('[aria-label], [title]')];
    for (const el of elements) {
      if (el.closest('#language-screen')) continue;
      for (const key of ['aria-label', 'title']) {
        const source = el.getAttribute(key);
        if (source && chinese.test(source)) staticAttributes.push([el, key, source]);
      }
    }
    const description = document.querySelector('meta[name="description"]');
    if (description) staticAttributes.push([description, 'content', description.content]);
  }
  function select(code) {
    if (code !== 'en' && code !== 'zh-CN') return;
    current = code;
    document.documentElement.lang = code;
    try { localStorage.setItem(preference, code); } catch {}
    for (const [node, source, english] of staticText) {
      if (node.isConnected) node.data = current === 'en' && english != null ? english : translate(source);
    }
    for (const [el, key, source] of staticAttributes) el.setAttribute(key, translate(source));
    // Look up live elements only. Rebuilt map rows and workshop buttons can be
    // collected normally, and no observer runs during the animation loop.
    for (const el of screen.querySelectorAll('*')) {
      if (textSources.has(el)) text(el, textSources.get(el));
      const attrs = attributeSources.get(el);
      if (attrs) for (const [key, source] of attrs) el.setAttribute(key, translate(source));
    }
  }
  function preferred() {
    try {
      const saved = localStorage.getItem(preference);
      if (saved === 'zh-CN' || saved === 'en') return saved;
    } catch {}
    return /^en\b/i.test(navigator.language || '') ? 'en' : 'zh-CN';
  }
  D.language = { init, select, preferred, t: translate, text, attr, get current() { return current; } };
})();
