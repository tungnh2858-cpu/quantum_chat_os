/**
 * Quantum Chat OS - Shared image cropper (avatar = circle, cover = wide rectangle).
 * Usage: EduCropper.open(file, { aspect: 1, shape: 'circle', outputSize: 512, title: '...' }, blob => { ...upload blob... })
 */
const EduCropper = (() => {
  function point(e) {
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }

  function open(file, opts, onCropped) {
    opts = Object.assign({ aspect: 1, shape: 'circle', outputSize: 512, title: 'Chỉnh ảnh' }, opts);

    const modal = document.createElement('div');
    modal.className = 'edu-crop-modal';
    modal.innerHTML = `
      <div class="edu-crop-box">
        <h3 class="edu-crop-title">${opts.title}</h3>
        <div class="edu-crop-viewport" style="aspect-ratio:${opts.aspect}">
          <img class="edu-crop-img" draggable="false">
          <div class="edu-crop-frame ${opts.shape === 'circle' ? 'edu-crop-frame-circle' : ''}"></div>
        </div>
        <div class="flex items-center gap-2 mt-3 px-1">
          <i class="fa-solid fa-magnifying-glass-minus text-slate-400 text-xs"></i>
          <input type="range" class="edu-crop-zoom flex-1" min="1" max="3" step="0.01" value="1">
          <i class="fa-solid fa-magnifying-glass-plus text-slate-400 text-xs"></i>
        </div>
        <p class="text-[11px] text-slate-500 text-center mt-1">Kéo ảnh để di chuyển, dùng thanh trượt hoặc cuộn chuột để phóng to/thu nhỏ</p>
        <div class="flex gap-2 mt-4">
          <button type="button" class="edu-crop-cancel flex-1 py-2.5 rounded-xl bg-white/5 font-bold text-sm">Huỷ</button>
          <button type="button" class="edu-crop-confirm flex-1 py-2.5 btn-primary text-sm">Xong</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const img = modal.querySelector('.edu-crop-img');
    const viewport = modal.querySelector('.edu-crop-viewport');
    const zoomSlider = modal.querySelector('.edu-crop-zoom');
    const url = URL.createObjectURL(file);
    img.src = url;

    const natural = { w: 0, h: 0 };
    let pos = { x: 0, y: 0 };
    let scale = 1;
    let baseScale = 1;

    function clamp() {
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      const iw = natural.w * scale, ih = natural.h * scale;
      if (pos.x > 0) pos.x = 0;
      if (pos.y > 0) pos.y = 0;
      if (pos.x < vw - iw) pos.x = vw - iw;
      if (pos.y < vh - ih) pos.y = vh - ih;
    }
    function render() {
      img.style.width = `${natural.w * scale}px`;
      img.style.height = `${natural.h * scale}px`;
      img.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    }

    img.onload = () => {
      natural.w = img.naturalWidth;
      natural.h = img.naturalHeight;
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      baseScale = Math.max(vw / natural.w, vh / natural.h);
      scale = baseScale;
      pos.x = (vw - natural.w * scale) / 2;
      pos.y = (vh - natural.h * scale) / 2;
      render();
    };

    let dragging = false, start = { x: 0, y: 0 }, startPos = { x: 0, y: 0 };
    function onDown(e) { dragging = true; start = point(e); startPos = { ...pos }; }
    function onMove(e) {
      if (!dragging) return;
      const p = point(e);
      pos.x = startPos.x + (p.x - start.x);
      pos.y = startPos.y + (p.y - start.y);
      clamp(); render();
    }
    function onUp() { dragging = false; }
    viewport.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    viewport.addEventListener('touchstart', onDown, { passive: true });
    viewport.addEventListener('touchmove', onMove, { passive: true });
    viewport.addEventListener('touchend', onUp);

    function applyZoom(ratio) {
      ratio = Math.min(3, Math.max(1, ratio));
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      const cx = vw / 2, cy = vh / 2;
      const imgX = (cx - pos.x) / scale, imgY = (cy - pos.y) / scale;
      scale = baseScale * ratio;
      pos.x = cx - imgX * scale;
      pos.y = cy - imgY * scale;
      clamp(); render();
    }
    zoomSlider.addEventListener('input', () => applyZoom(Number(zoomSlider.value)));
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const next = Number(zoomSlider.value) + (e.deltaY > 0 ? -0.06 : 0.06);
      zoomSlider.value = Math.min(3, Math.max(1, next));
      applyZoom(Number(zoomSlider.value));
    }, { passive: false });

    function cleanup() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      URL.revokeObjectURL(url);
      modal.remove();
    }
    modal.querySelector('.edu-crop-cancel').onclick = cleanup;
    modal.querySelector('.edu-crop-confirm').onclick = () => {
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      const outW = opts.outputSize;
      const outH = Math.round(outW / opts.aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext('2d');
      const sx = (0 - pos.x) / scale, sy = (0 - pos.y) / scale;
      const sw = vw / scale, sh = vh / scale;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      canvas.toBlob(blob => { cleanup(); onCropped(blob); }, 'image/jpeg', 0.92);
    };
  }

  return { open };
})();
