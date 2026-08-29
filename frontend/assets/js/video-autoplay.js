/**
 * Quantum Chat OS - Facebook-style video-in-feed behavior.
 * - Video starts playing MUTED automatically once it scrolls into view (both mobile & desktop).
 * - Tapping the video itself: unmutes AND goes fullscreen.
 * - Tapping the small speaker icon: unmutes in place, no fullscreen.
 * - Leaving the viewport pauses the video again (saves bandwidth/battery).
 *
 * Markup contract, produced by renderVideoBlock():
 *   <div class="qc-video-wrap" data-qc-video>
 *     <video class="qc-video" muted playsinline ...></video>
 *     <button class="qc-mute-btn" onclick="EduVideo.toggleMute(event, this)">...</button>
 *     <div class="qc-video-tap" onclick="EduVideo.tapFullscreen(event, this)"></div>
 *   </div>
 */
const EduVideo = (() => {
  let observer = null;

  function ensureObserver() {
    if (observer) return observer;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target.querySelector('video.qc-video');
        if (!video) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: [0, 0.6, 1] });
    return observer;
  }

  // Renders the standard video block HTML for a post/reel. `loop` = true for Reels.
  function renderVideoBlock(src, { loop = false, extraClass = '' } = {}) {
    return `
    <div class="qc-video-wrap relative rounded-2xl overflow-hidden bg-black mb-2 ${extraClass}" data-qc-video>
      <video class="qc-video w-full h-full object-contain bg-black" src="${src}" muted playsinline ${loop ? 'loop' : ''} preload="metadata"></video>
      <button class="qc-mute-btn absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center z-10" onclick="EduVideo.toggleMute(event, this)" title="Bật/tắt tiếng">
        <i class="fa-solid fa-volume-xmark"></i>
      </button>
      <div class="qc-video-tap absolute inset-0" onclick="EduVideo.tapFullscreen(event, this)"></div>
    </div>`;
  }

  // Call once after inserting new video blocks into the DOM (e.g. after re-rendering a feed).
  function observeAll(root = document) {
    const obs = ensureObserver();
    root.querySelectorAll('[data-qc-video]').forEach(wrap => obs.observe(wrap));
  }

  function toggleMute(evt, btn) {
    evt.stopPropagation();
    const wrap = btn.closest('[data-qc-video]');
    const video = wrap.querySelector('video.qc-video');
    video.muted = !video.muted;
    if (!video.muted && video.paused) video.play().catch(() => {});
    btn.innerHTML = `<i class="fa-solid ${video.muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>`;
  }

  function tapFullscreen(evt, tapLayer) {
    const wrap = tapLayer.closest('[data-qc-video]');
    const video = wrap.querySelector('video.qc-video');
    video.muted = false;
    const muteBtn = wrap.querySelector('.qc-mute-btn');
    if (muteBtn) muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    if (video.paused) video.play().catch(() => {});

    if (video.requestFullscreen) video.requestFullscreen().catch(() => {});
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iOS Safari
  }

  return { observeAll, toggleMute, tapFullscreen, renderVideoBlock };
})();
