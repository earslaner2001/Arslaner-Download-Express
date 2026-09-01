(function () {
  const header = document.querySelector('.site-header');
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const SECTIONS = new Set(['ozellikler', 'nasil', 'pro', 'indir']);

  window.addEventListener('scroll', function () {
    header.classList.toggle('scrolled', window.scrollY > 8);
  });

  toggle.addEventListener('click', function () {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  function closeNav() {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function sectionFromPath(pathname) {
    const slug = String(pathname || '/').replace(/\/+$/, '').split('/').pop();
    return SECTIONS.has(slug) ? slug : '';
  }

  function pathForSection(id) {
    return id ? '/' + id : '/';
  }

  function scrollToSection(id, smooth) {
    if (!id) {
      window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  function goToSection(id, push) {
    const url = pathForSection(id);
    if (push) history.pushState({ section: id }, '', url);
    else history.replaceState({ section: id }, '', url);
    scrollToSection(id, Boolean(push));
  }

  function sectionFromAnchor(anchor) {
    try {
      const u = new URL(anchor.href, location.origin);
      if (u.origin !== location.origin) return null;
      if (u.pathname === '/' || u.pathname === '') return '';
      const id = sectionFromPath(u.pathname);
      return SECTIONS.has(id) ? id : null;
    } catch {
      return null;
    }
  }

  document.addEventListener('click', function (event) {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = sectionFromAnchor(link);
    if (id === null) return;
    event.preventDefault();
    closeNav();
    goToSection(id, true);
  });

  window.addEventListener('popstate', function () {
    scrollToSection(sectionFromPath(location.pathname), true);
  });

  const hashId = location.hash.replace(/^#/, '');
  if (hashId && SECTIONS.has(hashId)) {
    goToSection(hashId, false);
  } else {
    scrollToSection(sectionFromPath(location.pathname), false);
  }
})();
