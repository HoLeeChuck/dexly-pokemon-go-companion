/* global document, MutationObserver */
const frame = document.querySelector('iframe');
const output = document.querySelector('#observation');
let observer;
function begin() {
  observer?.disconnect();
  const doc = frame.contentDocument;
  const originalImages = [...doc.querySelectorAll('img')];
  let added = 0,
    removed = 0,
    sources = 0;
  function report() {
    const retained = originalImages.filter((image) => image.isConnected).length;
    output.textContent = `${retained}/${originalImages.length} original images retained · ${added} image nodes added · ${removed} removed · ${sources} image source changes`;
  }
  const count = (node) =>
    node.nodeName === 'IMG' ? 1 : node.querySelectorAll?.('img').length || 0;
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        added += [...mutation.addedNodes].reduce((total, node) => total + count(node), 0);
        removed += [...mutation.removedNodes].reduce((total, node) => total + count(node), 0);
      } else if (mutation.target.tagName === 'IMG') sources++;
    }
    report();
  });
  observer.observe(doc.querySelector('main'), {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src'],
  });
  report();
}
frame.addEventListener('load', begin);
document.querySelector('#reset').addEventListener('click', begin);
