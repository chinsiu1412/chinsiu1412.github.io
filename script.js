/*Toggle menu mobile*/
/*Toggle dropdown submenu*/
/*Smooth scroll*/
/*Sticky header*/
/*Animation on scroll*/



/* ==========================================================================
   EDUPATH AI — script.js
   Chỉ xử lý 3 việc: menu mobile, header đổi trạng thái khi cuộn, smooth scroll
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- 1. Toggle menu mobile ---------- */
  var menuToggle = document.querySelector('.menu-toggle');
  var body = document.body;

  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      var isOpen = body.classList.toggle('nav-open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Đóng menu khi bấm vào 1 link trong menu (trên mobile)
    document.querySelectorAll('.main-nav a').forEach(function (link) {
      link.addEventListener('click', function () {
        body.classList.remove('nav-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- 2. Header đổi trạng thái (đổ bóng) khi cuộn trang ---------- */
  var header = document.querySelector('.site-header');

  if (header) {
    var onScroll = function () {
      if (window.scrollY > 8) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // set trạng thái đúng ngay khi tải trang
  }

  /* ---------- 3. Smooth scroll cho các anchor link, có trừ chiều cao header sticky ---------- */
  var headerHeight = header ? header.offsetHeight : 0;

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = link.getAttribute('href');
      if (targetId.length < 2) return; // bỏ qua href="#"

      var target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      var targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    });
  });

});
