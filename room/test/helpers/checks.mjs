// Layout checks run in the page: horizontal overflow, text that spills out of its box, and
// broken images. Shared by the end-to-end tests and the screenshot script.

/** Run inside the page (pass to page.evaluate). Returns a list of problems, empty when clean. */
export function layoutProblems() {
  const out = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) out.push(`page scrolls sideways by ${doc.scrollWidth - doc.clientWidth}px`);
  for (const img of document.images) {
    if (img.closest('[hidden]')) continue;
    // Broken means it finished loading and has no pixels. An image still loading is not broken;
    // callers run loadAllImages first so lazy images are loaded before the check.
    if (img.complete && img.naturalWidth === 0) out.push(`broken image ${img.getAttribute('src')}`);
    else if (!img.complete) out.push(`image still loading ${img.getAttribute('src')}`);
  }
  // Text that overflows its own box (clipped or spilling) where it is not meant to scroll.
  const scrollers = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) || /(auto|scroll)/.test(s.overflow)) return true;
    }
    return false;
  };
  const textEls = [...document.querySelectorAll('body *')].filter((el) => {
    if (!el.childNodes.length) return false;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (!hasText) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
  for (const el of textEls) {
    const s = getComputedStyle(el);
    const ellipsis = s.textOverflow === 'ellipsis';
    if (el.scrollWidth > el.clientWidth + 2 && !ellipsis && s.overflow !== 'visible' && s.display !== 'inline' && !scrollers(el)) {
      out.push(`text clipped in <${el.tagName.toLowerCase()} class="${el.className}">: "${el.textContent.trim().slice(0, 60)}"`);
    }
    // Spilling out of the nearest card or panel.
    const box = el.closest('.card, .panel, .lean-card, .speech, .banner, .sources, .checkin, .vote, .tile, .fact, .chip, .agree, .btn');
    if (box && box !== el && !scrollers(el)) {
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (a.right > b.right + 2 || a.left < b.left - 2 || a.bottom > b.bottom + 2) out.push(`text spills out of .${box.className.split(' ')[0]}: "${el.textContent.trim().slice(0, 60)}"`);
    }
  }
  return [...new Set(out)];
}

/** Run inside the page (pass to page.evaluate): load every image, lazy ones included, and wait. */
export async function loadAllImages() {
  for (const im of document.images) im.loading = 'eager';
  await Promise.all([...document.images].map((im) => (im.complete ? null : new Promise((ok) => { im.onload = im.onerror = ok; }))));
}
