/** Reconcile rendered markup without replacing unchanged controls or artwork. */
function key(node) {
  return node.nodeType === 1 ? node.getAttribute('data-key') || node.id || null : null;
}
function compatible(a, b) {
  return a.nodeType === b.nodeType && a.nodeName === b.nodeName;
}
// The site's CSP (style-src 'self') forbids style attributes in markup. Dynamic values travel as
// data-style and are applied through the CSSOM, which the policy allows.
function applyStyle(element) {
  element.style.cssText = element.getAttribute('data-style') || '';
}
function applyStyles(root) {
  if (root.nodeType !== 1) return;
  if (root.hasAttribute('data-style')) applyStyle(root);
  root.querySelectorAll('[data-style]').forEach(applyStyle);
}
function syncNode(current, next) {
  if (current.isEqualNode(next)) return;
  if (current.nodeType !== 1) {
    current.nodeValue = next.nodeValue;
    return;
  }
  // An expanded disclosure is a user choice, not transient render state.
  // An applied data-style lives in the style attribute; keep it so transitions can run.
  const preserve = (name) =>
    (current.tagName === 'DETAILS' && name === 'open') ||
    (name === 'style' && next.hasAttribute('data-style'));
  const styleBefore = current.getAttribute('data-style');
  for (const attribute of [...current.attributes]) {
    if (!next.hasAttribute(attribute.name) && !preserve(attribute.name))
      current.removeAttribute(attribute.name);
  }
  for (const attribute of next.attributes) {
    if (current.getAttribute(attribute.name) !== attribute.value && !preserve(attribute.name))
      current.setAttribute(attribute.name, attribute.value);
  }
  if (current.getAttribute('data-style') !== styleBefore) applyStyle(current);
  syncChildren(current, next);
  if (current.tagName === 'SELECT' && current.value !== next.value) current.value = next.value;
  if (current.tagName === 'INPUT') {
    if (['checkbox', 'radio'].includes(current.type)) current.checked = next.checked;
    else if (current.type !== 'file' && next.hasAttribute('value') && current.value !== next.value)
      current.value = next.value;
  }
}
function syncChildren(parent, nextParent) {
  const originals = [...parent.childNodes];
  const keyed = new Map(originals.filter((node) => key(node)).map((node) => [key(node), node]));
  const retained = new Set();
  let cursor = parent.firstChild;
  for (const next of [...nextParent.childNodes]) {
    const nextKey = key(next);
    let current = nextKey ? keyed.get(nextKey) : cursor;
    if (
      !current ||
      retained.has(current) ||
      !compatible(current, next) ||
      key(current) !== nextKey
    ) {
      current = next.cloneNode(true);
      applyStyles(current);
    }
    if (current !== cursor) parent.insertBefore(current, cursor);
    syncNode(current, next);
    retained.add(current);
    cursor = current.nextSibling;
  }
  for (const node of originals) if (!retained.has(node)) node.remove();
}
export function updateMarkup(container, markup) {
  const template = container.ownerDocument.createElement('template');
  template.innerHTML = markup;
  syncChildren(container, template.content);
}
