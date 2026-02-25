// dashboard.js — microinteracciones para inici.html

function animateCounters(duration = 1200) {
  document.querySelectorAll('.stat-value[data-value]').forEach(el => {
    const target = parseInt(el.dataset.value, 10);
    if (isNaN(target)) return;
    const start = 0;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.floor(start + (target - start) * easeOutCubic(progress));
      // keep text for non-numeric (e.g., "5 dies") as original
      if (/^\d+$/.test(String(target))) el.textContent = value;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function animateProgressFill() {
  const fill = document.querySelector('.progress-fill[data-progress]');
  if (!fill) return;
  const value = parseFloat(fill.dataset.progress);
  if (isNaN(value)) return;
  // ensure transition triggers
  requestAnimationFrame(() => {
    fill.style.width = value + '%';
  });
}

function addTiltEffect(selector = '.tilt', maxRotate = 10) {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = (x - cx) / cx; // -1..1
      const dy = (y - cy) / cy; // -1..1
      const ry = dx * maxRotate; // rotateY
      const rx = -dy * maxRotate; // rotateX
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(4px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

function addRippleEffect(selector = '.ripple') {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener('click', (e) => {
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.2;
      const ink = document.createElement('span');
      ink.className = 'ripple-ink';
      ink.style.width = ink.style.height = size + 'px';
      ink.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ink.style.top = (e.clientY - rect.top - size / 2) + 'px';
      el.appendChild(ink);
      setTimeout(() => ink.remove(), 700);
    });
  });
}

// Inicializar todo cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // add classes to make elements interactive (non-invasive)
  document.querySelectorAll('.stat-card').forEach(n => n.classList.add('tilt', 'ripple'));
  document.querySelectorAll('.ranks-list li').forEach(n => n.classList.add('ripple'));

  animateCounters();
  animateProgressFill();
  addTiltEffect('.tilt', 8);
  addRippleEffect('.ripple');

  // small enhancement: pulse the logo-box once
  const logo = document.querySelector('.logo-box');
  if (logo) {
    logo.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.06)' },
      { transform: 'scale(1)' }
    ], { duration: 800, easing: 'ease-out' });
  }
});
