/* Line icons for buttons (instead of emoji): an inline SVG sprite, used as
   <svg class="ic" aria-hidden="true"><use href="#i-NAME"></use></svg>. Stroke icons take the text colour. */
(function (global) {
  'use strict';
  const F = 'fill="currentColor" stroke="none"';
  const I = {
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
    external: '<path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    play: `<path ${F} d="M7 4.5v15a.8.8 0 0 0 1.2.7l12-7.5a.8.8 0 0 0 0-1.4l-12-7.5A.8.8 0 0 0 7 4.5z"/>`,
    ff: `<path ${F} d="M2.5 5.5v13a.7.7 0 0 0 1.1.6L12 13v5.5a.7.7 0 0 0 1.1.6l9-6.5a.7.7 0 0 0 0-1.2l-9-6.5a.7.7 0 0 0-1.1.6V11L3.6 4.9a.7.7 0 0 0-1.1.6z"/>`,
    'chev-left': '<path d="M15 5l-7 7 7 7"/>',
    'chev-right': '<path d="M9 5l7 7-7 7"/>',
    trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4.5M16 6h3a3 3 0 0 1-3 4.5M12 14v3M8.5 20h7M10 17h4v3h-4z"/>',
    medal: '<circle cx="12" cy="15" r="5"/><path d="M9 10.8L6 3h4l2 4.5L14 3h4l-3 7.8M12 13v4"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    gear: '<circle cx="12" cy="12" r="8.4" stroke-width="3.4" stroke-dasharray="3.3 3.3" stroke-linecap="butt"/><circle cx="12" cy="12" r="6.6"/><circle cx="12" cy="12" r="2.4"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    enter: '<path d="M19 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    swap: '<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>',
    power: '<path d="M12 3v8M6.3 6.8a7.5 7.5 0 1 0 11.4 0"/>',
    home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14a5 5 0 0 1 4.5 6"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    office: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4.5h6V7M3 12.5h18"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    'star-fill': `<path ${F} d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>`,
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    goal: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.8 2.8L16 9.5"/>',
    news: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>',
    hash: '<path d="M5 9h15M4 15h15M10.5 4L8.5 20M15.5 4l-2 16"/>',
    eye: '<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'thumb-up': '<path d="M7 10.5V20H4v-9.5zM7 10.5L11 4a2 2 0 0 1 3.2 2.2L13 10h5.6a2 2 0 0 1 2 2.4l-1.4 6A2 2 0 0 1 17.2 20H7"/>',
    'thumb-down': '<path d="M7 13.5V4H4v9.5zM7 13.5L11 20a2 2 0 0 0 3.2-2.2L13 14h5.6a2 2 0 0 0 2-2.4l-1.4-6A2 2 0 0 0 17.2 4H7"/>',
    hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6M14 10.5V6a1.5 1.5 0 0 1 3 0v8.5a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.8-2.4L3.8 15.5a1.5 1.5 0 0 1 2.4-1.8L8 15.5"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    comment: '<path d="M4 5h16v11H10l-6 4.5z"/>',
  };
  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">'
    + Object.keys(I).map((k) => `<symbol id="i-${k}" viewBox="0 0 24 24">${I[k]}</symbol>`).join('') + '</svg>';
  function mount() { if (!document.getElementById('i-right')) document.body.insertAdjacentHTML('afterbegin', sprite); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  /** Icon markup for a name in the sprite. */
  global.RLIcon = (name) => `<svg class="ic ic-${name}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
})(window);
