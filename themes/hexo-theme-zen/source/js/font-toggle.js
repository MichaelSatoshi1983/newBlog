(function() {
  const STORAGE_KEY = 'zen-font-mode';
  const MODE_CUSTOM = 'custom';
  const MODE_ORIGINAL = 'original';

  function getStoredMode() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function setStoredMode(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      // The font switch still works for this page when storage is unavailable.
    }
  }

  function applyMode(mode) {
    const root = document.documentElement;
    const normalizedMode = mode === MODE_ORIGINAL ? MODE_ORIGINAL : MODE_CUSTOM;
    root.setAttribute('data-font-mode', normalizedMode);

    const button = document.getElementById('font-toggle');
    if (!button) return;

    const switchingTo = normalizedMode === MODE_ORIGINAL
      ? '切换到网站字体'
      : '切换到本机 IPA 原始字体';
    button.setAttribute('aria-label', switchingTo);
    button.setAttribute('title', switchingTo);
    button.setAttribute('aria-pressed', String(normalizedMode === MODE_ORIGINAL));
  }

  function init() {
    applyMode(getStoredMode());

    const button = document.getElementById('font-toggle');
    if (!button) return;

    button.addEventListener('click', function() {
      const currentMode = document.documentElement.getAttribute('data-font-mode');
      const nextMode = currentMode === MODE_ORIGINAL ? MODE_CUSTOM : MODE_ORIGINAL;
      setStoredMode(nextMode);
      applyMode(nextMode);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
