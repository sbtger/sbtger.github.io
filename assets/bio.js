const bio = document.querySelector('.bio');
const buttons = bio.querySelectorAll('button[aria-controls]');
const panels = bio.querySelectorAll('.bio-panel');

function showBio(id) {
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.getAttribute('aria-controls') === id));
  }
  for (const panel of panels) panel.hidden = panel.id !== id;
}

for (const button of buttons) {
  button.addEventListener('click', () => showBio(button.getAttribute('aria-controls')));
}
