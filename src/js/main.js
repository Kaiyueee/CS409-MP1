const header = document.querySelector('.site-header');
const root = document.documentElement;
const navLinks = Array.from(document.querySelectorAll('.site-nav a'));
const sections = navLinks.map(link => document.querySelector(link.hash));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let framePending = false;

// Read the section immediately below the navbar, including our anchor spacing.
function updateNavigation() {
  framePending = false;
  root.classList.toggle('is-scrolled', window.scrollY > 32);

  const gap = parseFloat(getComputedStyle(root).getPropertyValue('--anchor-gap'));
  const readingLine = header.getBoundingClientRect().bottom + gap + 2;
  let currentIndex = 0;

  sections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= readingLine) currentIndex = index;
  });

  // A short footer cannot reach the reading line, so explicitly handle the bottom.
  const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= root.scrollHeight - 2;
  if (atBottom) currentIndex = sections.length - 1;

  navLinks.forEach((link, index) => {
    const active = index === currentIndex;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

function scheduleNavigationUpdate() {
  if (framePending) return;
  framePending = true;
  window.requestAnimationFrame(updateNavigation);
}

function scrollToSection(target, animate = true) {
  const styles = getComputedStyle(root);
  const compactHeight = parseFloat(styles.getPropertyValue('--header-compact'));
  const gap = parseFloat(styles.getPropertyValue('--anchor-gap'));
  const isHome = target.id === 'home' || target.id === 'main';
  // Use the final compact height even when the navigation starts fully expanded.
  const top = isHome ? 0 : window.scrollY + target.getBoundingClientRect().top - compactHeight - gap;

  window.scrollTo({
    top: Math.max(0, top),
    behavior: animate && !reducedMotion.matches ? 'smooth' : 'instant',
  });
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
  const target = document.getElementById(link.hash.slice(1));
  if (!target) return;

  link.addEventListener('click', event => {
    // Preserve modified clicks and the browser's normal open-in-new-tab behavior.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (window.location.hash !== link.hash) window.history.pushState(null, '', link.hash);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    scrollToSection(target);
  });
});

function alignCurrentHash() {
  const target = document.getElementById(window.location.hash.slice(1));
  if (target) scrollToSection(target, false);
  scheduleNavigationUpdate();
}

window.addEventListener('scroll', scheduleNavigationUpdate, { passive: true });
window.addEventListener('resize', scheduleNavigationUpdate);
window.addEventListener('hashchange', alignCurrentHash);
window.addEventListener('pageshow', scheduleNavigationUpdate);
// Images and font/layout changes can move section boundaries without a scroll.
const layoutObserver = new ResizeObserver(scheduleNavigationUpdate);
layoutObserver.observe(header);
sections.forEach(section => layoutObserver.observe(section));
if (document.readyState === 'complete') alignCurrentHash();
else window.addEventListener('load', alignCurrentHash, { once: true });
updateNavigation();

// Virtual likes belong to this browser, not a shared donation or visitor total.
const treatButton = document.querySelector('.treat-button');
const treatStation = document.querySelector('.treat-station');
const treatStatus = document.querySelector('.treat-status');
const treatStorageKey = 'genggeng.virtual-treats';
let treatCount = 0;
let treatAnimationTimer;
try {
  const savedCount = Number(localStorage.getItem(treatStorageKey));
  if (Number.isSafeInteger(savedCount) && savedCount >= 0) treatCount = savedCount;
} catch { /* The interaction also works when browser storage is unavailable. */ }

function renderTreatCount() {
  treatStatus.textContent = treatCount > 0
    ? `${treatCount.toLocaleString('en-US')} virtual ${treatCount === 1 ? 'treat' : 'treats'} from you. Purr!`
    : 'Send him a little love.';
}
renderTreatCount();
treatButton.addEventListener('click', () => {
  treatCount = Math.min(treatCount + 1, Number.MAX_SAFE_INTEGER);
  renderTreatCount();
  try { localStorage.setItem(treatStorageKey, String(treatCount)); } catch { /* Keep the session count. */ }
  clearTimeout(treatAnimationTimer);
  treatStation.classList.remove('is-fed');
  // Restart the short CSS animation on every click, including repeated clicks.
  void treatStation.offsetWidth;
  treatStation.classList.add('is-fed');
  treatAnimationTimer = setTimeout(() => treatStation.classList.remove('is-fed'), 650);
});

// One index controls the visible slide, the dots, and the announced photo number.
const carousel = document.querySelector('.carousel');
const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
const dots = Array.from(carousel.querySelectorAll('.carousel-dot'));
const carouselStatus = carousel.querySelector('.carousel-status');
let slideIndex = 0;

function showSlide(index) {
  slideIndex = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => { slide.hidden = i !== slideIndex; });
  dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === slideIndex)));
  carouselStatus.textContent = `Photo ${slideIndex + 1} of ${slides.length}`;
}

carousel.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => showSlide(slideIndex + Number(button.dataset.direction)));
});
dots.forEach((dot, index) => dot.addEventListener('click', () => showSlide(index)));
carousel.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const photoHadFocus = document.activeElement.classList.contains('photo-open');
  showSlide(slideIndex + (event.key === 'ArrowRight' ? 1 : -1));
  if (photoHadFocus) slides[slideIndex].querySelector('.photo-open').focus({ preventScroll: true });
});

// Native dialog makes the rest of the page inert and handles Escape dismissal.
const photoModal = document.querySelector('#photo-modal');
const modalImage = photoModal.querySelector('.modal-image');
const modalTitle = photoModal.querySelector('#modal-title');
const modalDescription = photoModal.querySelector('#modal-description');
const modalCounter = photoModal.querySelector('.modal-counter');
const closePhoto = photoModal.querySelector('.modal-close');
const catVideos = Array.from(document.querySelectorAll('.cat-video'));
// Keep two clips from playing audio over one another.
catVideos.forEach(video => {
  video.addEventListener('play', () => {
    catVideos.forEach(other => { if (other !== video) other.pause(); });
  });
});
let photoOpener = null;
let backdropPress = false;

function renderModalPhoto() {
  const slide = slides[slideIndex];
  const photo = slide.querySelector('img');
  modalImage.src = photo.currentSrc || photo.src;
  modalImage.alt = photo.alt;
  modalTitle.textContent = slide.querySelector('h3').textContent;
  modalDescription.textContent = slide.querySelector('.photo-story').textContent;
  modalCounter.textContent = `Photo ${slideIndex + 1} of ${slides.length}`;
  photoOpener = slide.querySelector('.photo-open');
}

function moveModalPhoto(direction) {
  showSlide(slideIndex + direction);
  renderModalPhoto();
}

slides.forEach((slide, index) => {
  const opener = slide.querySelector('.photo-open');
  opener.addEventListener('click', () => {
    showSlide(index);
    renderModalPhoto();
    catVideos.forEach(video => video.pause());
    photoModal.showModal();
    root.classList.add('modal-open');
    closePhoto.focus({ preventScroll: true });
  });
});

photoModal.querySelectorAll('[data-modal-direction]').forEach(button => {
  button.addEventListener('click', () => moveModalPhoto(Number(button.dataset.modalDirection)));
});

closePhoto.addEventListener('click', () => photoModal.close());
photoModal.addEventListener('close', () => {
  root.classList.remove('modal-open');
  if (photoOpener) photoOpener.focus({ preventScroll: true });
  backdropPress = false;
});

function isOutsideDialog(event) {
  const bounds = photoModal.getBoundingClientRect();
  return event.target === photoModal && (event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom);
}
// A drag beginning inside the photo must not accidentally close the dialog.
photoModal.addEventListener('pointerdown', event => { backdropPress = isOutsideDialog(event); });
photoModal.addEventListener('click', event => {
  if (backdropPress && isOutsideDialog(event)) photoModal.close();
  backdropPress = false;
});
photoModal.addEventListener('keydown', event => {
  if (!event.altKey && !event.ctrlKey && !event.metaKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    moveModalPhoto(event.key === 'ArrowRight' ? 1 : -1);
  }
  // Keep keyboard focus within the dialog, including its photo navigation.
  if (event.key === 'Tab') {
    const buttons = Array.from(photoModal.querySelectorAll('button'));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
