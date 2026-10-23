/* Zyma Pay mobile navigation: accessible right-side drawer with explicit close control. */
(() => {
  const sidebar = document.querySelector('.sidebar');
  const topbar = document.querySelector('.topbar');
  if (!sidebar || !topbar) return;

  sidebar.id = sidebar.id || 'zyma-pay-sidebar';
  let toggle = document.getElementById('mobile-menu');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'mobile-menu';
    toggle.className = 'icon-button mobile-menu';
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true">☰</span>';
    topbar.appendChild(toggle);
  } else {
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.setAttribute('aria-expanded', 'false');
  }

  const brand = sidebar.querySelector('.brand');
  let closeButton = sidebar.querySelector('.mobile-drawer-close');
  if (!closeButton && brand) {
    closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'mobile-drawer-close';
    closeButton.setAttribute('aria-label', 'Close navigation menu');
    closeButton.title = 'Close menu';
    closeButton.innerHTML = '<span aria-hidden="true">×</span>';
    brand.appendChild(closeButton);
  }

  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'sidebar-overlay';
    overlay.setAttribute('aria-label', 'Close navigation menu');
    overlay.tabIndex = -1;
    document.body.appendChild(overlay);
  }

  const isMobile = () => window.matchMedia('(max-width: 650px)').matches;
  const close = ({ restoreFocus = false } = {}) => {
    sidebar.classList.remove('open');
    document.body.classList.remove('navigation-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
    if (restoreFocus && isMobile()) toggle.focus({ preventScroll: true });
  };
  const open = () => {
    if (!isMobile()) return;
    sidebar.classList.add('open');
    document.body.classList.add('navigation-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close navigation menu');
    closeButton?.focus({ preventScroll: true });
  };

  toggle.addEventListener('click', () => sidebar.classList.contains('open') ? close({ restoreFocus: true }) : open());
  closeButton?.addEventListener('click', () => close({ restoreFocus: true }));
  overlay.addEventListener('click', () => close({ restoreFocus: true }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) close({ restoreFocus: true });
  });
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => { if (isMobile()) close(); });
  });
  window.addEventListener('resize', () => { if (!isMobile()) close(); });
})();
