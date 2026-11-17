// A minimal stand-in for the Claude Design canvas runtime, used only to render the approved
// boards (docs/design/boards/*.dc.html) next to the Room for visual comparison. It supports what
// the A3 boards use: <helmet>, <sc-for list as>, <sc-if value>, {{expr}} in text and attributes,
// and a Component class with renderVals(). It is not shipped to users.
(function () {
  window.DCLogic = class DCLogic {};
  const get = (scope, expr) => {
    const keys = Object.keys(scope);
    try {
      return Function(...keys, `return (${expr});`)(...keys.map((k) => scope[k]));
    } catch {
      return undefined;
    }
  };
  const sub = (str, scope, attr = false) => {
    const whole = attr && str.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
    if (whole) return get(scope, whole[1]);
    return str.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => {
      const v = get(scope, e);
      return v === undefined || v === null ? '' : String(v);
    });
  };
  function render(node, scope, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(String(sub(node.nodeValue, scope) ?? '')));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      const list = sub(node.getAttribute('list'), scope, true) || [];
      const as = node.getAttribute('as') || 'item';
      list.forEach((item, i) => {
        for (const c of node.childNodes) render(c, { ...scope, [as]: item, index: i }, out);
      });
      return;
    }
    if (tag === 'sc-if') {
      if (sub(node.getAttribute('value'), scope, true)) for (const c of node.childNodes) render(c, scope, out);
      return;
    }
    const el = document.createElement(tag);
    for (const a of node.attributes) {
      if (a.name.startsWith('hint-')) continue;
      const v = sub(a.value, scope, true);
      el.setAttribute(a.name, v === undefined || v === null ? '' : String(v));
    }
    for (const c of node.childNodes) render(c, scope, el);
    out.appendChild(el);
  }
  function boot() {
    const host = document.querySelector('x-dc');
    const script = document.querySelector('script[data-dc-script]');
    if (!host || !script) return;
    const Component = Function('DCLogic', `${script.textContent}; return Component;`)(window.DCLogic);
    const vals = new Component().renderVals();
    const tpl = document.createElement('template');
    tpl.innerHTML = host.innerHTML;
    const helmet = tpl.content.querySelector('helmet');
    if (helmet) {
      for (const c of [...helmet.childNodes]) if (c.nodeType === 1) document.head.appendChild(c.cloneNode(true));
      helmet.remove();
    }
    // The boards' Switzer files are canvas blobs that are not in the repo: load Switzer from Fontshare.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.fontshare.com/v2/css?f[]=switzer@400,500,600&display=swap';
    document.head.appendChild(link);
    const frag = document.createDocumentFragment();
    for (const c of tpl.content.childNodes) render(c, vals, frag);
    host.replaceWith(...frag.childNodes);
    document.documentElement.dataset.dcReady = '1';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
