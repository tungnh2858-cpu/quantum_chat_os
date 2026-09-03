/**
 * Quantum Chat OS - Shared emoji picker.
 * Usage: EduEmoji.attach(triggerButtonEl, targetInputOrTextareaEl)
 * Clicking the trigger opens a small popup grid; picking an emoji inserts it
 * at the current cursor position of the target field.
 */
const EduEmoji = (() => {
  const EMOJIS = [
    '😀','😁','😂','🤣','😊','😍','😘','😜','🤔','😎',
    '😢','😭','😡','😱','🥳','🤩','😴','🙄','😇','🤗',
    '👍','👎','👏','🙌','🙏','💪','🤝','👌','✌️','🤙',
    '❤️','🧡','💛','💚','💙','💜','🖤','💔','💯','🔥',
    '🎉','🎂','🎁','⭐','✨','🌟','☀️','🌙','🌈','⚡',
    '🐶','🐱','🐼','🦄','🐸','🌸','🍕','🍔','☕','🍺'
  ];
  let openPopup = null;

  function closePopup() {
    if (openPopup) { openPopup.remove(); openPopup = null; }
    document.removeEventListener('click', outsideClickHandler, true);
  }
  function outsideClickHandler(e) {
    if (openPopup && !openPopup.contains(e.target)) closePopup();
  }

  function insertAtCursor(field, text) {
    if (typeof field.selectionStart === 'number') {
      const start = field.selectionStart, end = field.selectionEnd;
      field.value = field.value.slice(0, start) + text + field.value.slice(end);
      field.selectionStart = field.selectionEnd = start + text.length;
    } else {
      field.value += text;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
  }

  function attach(triggerEl, targetEl) {
    triggerEl.addEventListener('click', e => {
      e.stopPropagation();
      if (openPopup) { closePopup(); return; }

      const popup = document.createElement('div');
      popup.className = 'edu-emoji-popup';
      popup.innerHTML = EMOJIS.map(em => `<button type="button" class="edu-emoji-item">${em}</button>`).join('');
      document.body.appendChild(popup);

      const rect = triggerEl.getBoundingClientRect();
      const popupWidth = 260;
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 12) left = window.innerWidth - popupWidth - 12;
      popup.style.left = `${Math.max(12, left)}px`;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 260) popup.style.top = `${rect.top - 256}px`;
      else popup.style.top = `${rect.bottom + 6}px`;

      popup.querySelectorAll('.edu-emoji-item').forEach(btn => {
        btn.addEventListener('click', ev => {
          ev.stopPropagation();
          insertAtCursor(targetEl, btn.textContent);
        });
      });

      openPopup = popup;
      setTimeout(() => document.addEventListener('click', outsideClickHandler, true), 0);
    });
  }

  return { attach, closePopup };
})();
