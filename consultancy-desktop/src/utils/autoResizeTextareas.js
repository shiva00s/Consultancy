// Utility to auto-resize textareas marked in the app
function autosizeElement(el) {
  if (!el) return;
  el.style.boxSizing = 'border-box';
  el.style.overflowY = 'hidden';
  const resize = () => {
    el.style.height = 'auto';
    const newH = Math.min(Math.max(el.scrollHeight, 40), 800);
    el.style.height = newH + 'px';
  };
  // run once to initialize
  resize();
  el.addEventListener('input', resize);
  // keep a reference so callers can cleanup if needed
  return () => el.removeEventListener('input', resize);
}

export function initAutoResizeAll() {
  // target common textarea selectors used across the app
  const selectors = ['textarea', '.auto-resize', '.notes-textarea'];
  const all = document.querySelectorAll(selectors.join(','));
  const removers = [];
  all.forEach((el) => {
    // don't double-init
    if (el.__autoResizeInit) return;
    el.__autoResizeInit = true;
    const remove = autosizeElement(el);
    if (remove) removers.push(remove);
  });
  return () => {
    removers.forEach((r) => r());
  };
}

export default initAutoResizeAll;
