for (const button of document.querySelectorAll('[data-expand]')) {
  button.addEventListener('click', () => {
    for (const details of document.querySelectorAll('[data-schema-node]')) {
      details.open = button.dataset.expand === 'true';
    }
  });
}

function revealReference() {
  let target;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
  if (!target) return;
  for (let element = target; element; element = element.parentElement) {
    if (element instanceof HTMLDetailsElement) element.open = true;
  }
  target.scrollIntoView({block: 'start'});
}
function updateLanguageLinks() {
  for (const link of document.querySelectorAll('[data-language-switch]')) link.hash = location.hash;
}
window.addEventListener('hashchange', () => { revealReference(); updateLanguageLinks(); });
document.addEventListener('click', event => {
  // A repeated click on the current hash must also reopen a collapsed target.
  if (event.target.closest('a')?.hash === location.hash) revealReference();
});
revealReference();
updateLanguageLinks();
