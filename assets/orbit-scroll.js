// Send document scroll progress to the artwork, including when opened from disk.
const sceneFrame = document.querySelector('.art iframe');
const sceneOrigin = location.protocol === 'file:' ? '*' : location.origin;
let pending = false;

function sendScrollProgress() {
  pending = false;
  const page = document.scrollingElement;
  const travel = page.scrollHeight - page.clientHeight;
  const progress = travel > 0 ? Math.max(0, Math.min(1, page.scrollTop / travel)) : 0;
  sceneFrame.contentWindow.postMessage({ type: 'anred:orbit', progress }, sceneOrigin);
}

function scheduleOrbitUpdate() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(sendScrollProgress);
}

window.addEventListener('scroll', scheduleOrbitUpdate, { passive: true });
window.addEventListener('resize', scheduleOrbitUpdate);
window.addEventListener('pageshow', scheduleOrbitUpdate);
sceneFrame.addEventListener('load', scheduleOrbitUpdate);
new ResizeObserver(scheduleOrbitUpdate).observe(document.body);
scheduleOrbitUpdate();
