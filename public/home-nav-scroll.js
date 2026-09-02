(() => {
  const syncHomeNavigation = () => {
    const header = document.getElementById("main-header");
    if (!header) return;

    const logo = document.getElementById("header-logo");
    const isScrolled = window.scrollY > 0;

    header.classList.toggle("nav-scrolled", isScrolled);
    header.classList.toggle("shadow-sm", isScrolled);
    logo?.classList.toggle("brightness-0", !isScrolled);
    logo?.classList.toggle("invert", !isScrolled);
    logo?.classList.toggle("opacity-100", isScrolled);
  };

  window.addEventListener("scroll", syncHomeNavigation, { passive: true });
  window.addEventListener("pageshow", syncHomeNavigation);
  document.addEventListener("DOMContentLoaded", syncHomeNavigation, { once: true });
})();
