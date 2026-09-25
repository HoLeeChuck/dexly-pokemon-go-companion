/* global document */
import { updateMarkup } from '../../design/prism/dom.js';
const fixture = document.querySelector('#fixture');
const results = document.querySelector('#results');
function check(name, test) {
  const item = document.createElement('li');
  try {
    test();
    item.textContent = `PASS: ${name}`;
  } catch (error) {
    item.textContent = `FAIL: ${name}: ${error.message}`;
  }
  results.append(item);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function cards(owned = false) {
  return `<div id="grid"><article data-key="one" class="${owned ? 'owned' : ''}"><button aria-pressed="${owned}"><img src="/artwork/pokemon-home/HOME0001.png" alt="Bulbasaur"></button></article><article data-key="two"><img src="/artwork/pokemon-home/HOME0002.png" alt="Ivysaur"></article></div>`;
}
check('Collection update retains both image elements and the focused button', () => {
  updateMarkup(fixture, cards());
  const images = [...fixture.querySelectorAll('img')];
  const button = fixture.querySelector('button');
  button.focus();
  updateMarkup(fixture, cards(true));
  assert(
    images.every((image, i) => image === fixture.querySelectorAll('img')[i]),
    'images were replaced',
  );
  assert(document.activeElement === button, 'focus was lost');
  assert(button.getAttribute('aria-pressed') === 'true', 'state was not updated');
});
check('Filtering retains the matching keyed card and its image', () => {
  const image = fixture.querySelector('[data-key="two"] img');
  updateMarkup(
    fixture,
    '<div id="grid"><article data-key="two"><img src="/artwork/pokemon-home/HOME0002.png" alt="Ivysaur"></article></div>',
  );
  assert(fixture.querySelector('img') === image, 'retained card was recreated');
  assert(fixture.querySelectorAll('article').length === 1, 'old card remained');
});
check('Reordering moves existing cards instead of rebuilding them', () => {
  updateMarkup(fixture, cards());
  const one = fixture.querySelector('[data-key="one"]');
  const two = fixture.querySelector('[data-key="two"]');
  updateMarkup(fixture, `<div id="grid">${two.outerHTML}${one.outerHTML}</div>`);
  assert(fixture.querySelector('#grid').firstChild === two, 'card two was replaced');
  assert(fixture.querySelector('#grid').lastChild === one, 'card one was replaced');
});
check('Disclosure state and unfinished text survive unrelated updates', () => {
  updateMarkup(
    fixture,
    '<details id="options"><summary>Options</summary><input id="draft"><span>Before</span></details>',
  );
  const details = fixture.querySelector('details');
  details.open = true;
  const input = fixture.querySelector('input');
  input.value = 'unfinished';
  input.focus();
  updateMarkup(
    fixture,
    '<details id="options"><summary>Options</summary><input id="draft"><span>After</span></details>',
  );
  assert(
    details.open && input.value === 'unfinished' && document.activeElement === input,
    'user state was lost',
  );
});
check('Select values and checkbox state synchronize without replacing controls', () => {
  updateMarkup(
    fixture,
    '<select id="category"><option>Normal</option><option>Shiny</option></select><input id="collected" type="checkbox">',
  );
  const select = fixture.querySelector('select');
  updateMarkup(
    fixture,
    '<select id="category"><option>Normal</option><option selected>Shiny</option></select><input id="collected" type="checkbox" checked>',
  );
  assert(select === fixture.querySelector('select') && select.value === 'Shiny', 'select mismatch');
  assert(fixture.querySelector('input').checked, 'checkbox mismatch');
});
check('A changed species updates the existing inspector image source', () => {
  updateMarkup(
    fixture,
    '<aside data-key="inspector"><img src="/artwork/pokemon-home/HOME0001.png" alt="Bulbasaur"></aside>',
  );
  const image = fixture.querySelector('img');
  updateMarkup(
    fixture,
    '<aside data-key="inspector"><img src="/artwork/pokemon-home/HOME0002.png" alt="Ivysaur"></aside>',
  );
  assert(
    fixture.querySelector('img') === image && image.alt === 'Ivysaur',
    'inspector was not reconciled',
  );
});
fixture.hidden = true;
