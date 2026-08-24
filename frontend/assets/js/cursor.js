/**
 * EduPulse - Custom animated cursor (ring + glowing dot), matching the
 * purple-ring / cyan-pink-dot design. Disabled automatically on touch
 * devices (phones/tablets) so mobile users keep the normal tap behavior.
 */
(function () {
  if (!window.matchMedia('(pointer: fine)').matches) return; // skip on touch devices

  const ring = document.createElement('div');
  ring.id = 'edu-cursor-ring';
  const dot = document.createElement('div');
  dot.id = 'edu-cursor-dot';
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    document.body.classList.add('edu-custom-cursor-active');
  });

  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let ringX = mouseX, ringY = mouseY;

  window.addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  window.addEventListener('mousedown', () => { ring.classList.add('edu-cursor-clicked'); });
  window.addEventListener('mouseup', () => { ring.classList.remove('edu-cursor-clicked'); });

  document.addEventListener('mouseover', e => {
    if (e.target.closest('a, button, input, select, textarea, [role="button"], .tab-link')) {
      ring.classList.add('edu-cursor-hover');
    }
  }, true);
  document.addEventListener('mouseout', e => {
    if (e.target.closest('a, button, input, select, textarea, [role="button"], .tab-link')) {
      ring.classList.remove('edu-cursor-hover');
    }
  }, true);

  function loop() {
    // Ring eases toward the pointer -> gives the "lag" look from the screenshot.
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
