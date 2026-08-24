/**
 * EduPulse - Particle constellation background (canvas), matching the
 * "Cyber Space" reference look: glowing dots drifting slowly, connected by
 * faint lines when close together. Injected once per page, resizes with the
 * window, and pauses when the tab is hidden to save battery/CPU.
 */
(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'edu-particles-bg';
  const ctx = canvas.getContext('2d');

  const COLORS = ['#00f0ff', '#a855f7', '#ff69f5', '#5eead4'];
  let particles = [];
  let width, height, running = true;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function initParticles() {
    const count = Math.min(90, Math.floor((width * height) / 18000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
  }

  function step() {
    if (!running) { requestAnimationFrame(step); return; }
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    const maxDist = 130;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(139, 92, 246, ${0.18 * (1 - dist / maxDist)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(step);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.prepend(canvas);
    resize();
    initParticles();
    requestAnimationFrame(step);
  });

  window.addEventListener('resize', () => { resize(); initParticles(); });
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });
})();
