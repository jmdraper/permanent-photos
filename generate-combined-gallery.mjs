<!--
  YMS COMBINED PHOTO GALLERY — Squarespace Embed Widget
  Paste this entire file into a Squarespace Code Block (set to HTML mode).
  Replaces both the permanent and flickr widgets.
-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap');

  .pg * { box-sizing: border-box; margin: 0; padding: 0; }

  .pg {
    --pg-height: 600px;
    --pg-cols:   5;
    --pg-gap:    8px;
    --pg-radius: 3px;
    --pg-accent: #c8a96e;

    font-family:    'Almarai', sans-serif;
    color:          inherit;
    height:         var(--pg-height);
    display:        flex;
    flex-direction: column;
    overflow:       hidden;
    background:     transparent;
  }

  /* ── Breadcrumbs ─────────────────────────────────────────────────────── */
  .pg-crumbs {
    display:        flex;
    align-items:    center;
    gap:            0.3rem;
    flex-wrap:      wrap;
    min-height:     2rem;
    padding-bottom: 0.5rem;
    font-size:      0.85rem;
    font-weight:    600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex-shrink:    0;
    position:       relative;
    z-index:        1;
  }
  .pg-crumbs:empty { display: none; }

  .pg-crumb {
    background:     none;
    border:         none;
    padding:        0;
    cursor:         pointer;
    font:           inherit;
    font-size:      inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color:          inherit;
    opacity:        0.45;
    transition:     opacity 0.15s;
  }
  .pg-crumb:hover  { opacity: 0.9; }
  .pg-crumb.active { opacity: 1; cursor: default; }
  .pg-crumb-sep    { opacity: 0.25; font-size: 0.6rem; }

  /* ── Scrollable area ─────────────────────────────────────────────────── */
  .pg-scroll {
    flex:            1;
    overflow-y:      auto;
    overflow-x:      hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(128,128,128,0.25) transparent;
  }
  .pg-scroll::-webkit-scrollbar       { width: 3px; }
  .pg-scroll::-webkit-scrollbar-track { background: transparent; }
  .pg-scroll::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 2px; }

  /* ── Grid ────────────────────────────────────────────────────────────── */
  .pg-grid {
    display:               grid;
    grid-template-columns: repeat(var(--pg-cols), 1fr);
    gap:                   var(--pg-gap);
  }

  /* ── Shared tile base ────────────────────────────────────────────────── */
  .pg-tile {
    position:     relative;
    aspect-ratio: 1;
    overflow:     hidden;
    background:   rgba(128,128,128,0.1);
    cursor:       pointer;
  }
  .pg-tile img {
    width:      100%;
    height:     100%;
    object-fit: cover;
    display:    block;
    transition: transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s;
    opacity:    0;
  }
  .pg-tile img.loaded { opacity: 1; }
  .pg-tile:hover img  { transform: scale(1.06); }

  .pg-tile-overlay {
    position:       absolute;
    inset:          0;
    background:     linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%);
    display:        flex;
    flex-direction: column;
    justify-content: flex-end;
    padding:        0.7rem 0.6rem;
    transition:     background 0.25s;
  }
  .pg-tile:hover .pg-tile-overlay {
    background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 55%, transparent 100%);
  }
  .pg-tile-name {
    color:          #fff;
    font-size:      0.78rem;
    font-weight:    500;
    letter-spacing: 0.03em;
    line-height:    1.3;
    text-shadow:    0 1px 4px rgba(0,0,0,0.6);
  }
  .pg-tile-meta {
    color:          rgba(255,255,255,0.55);
    font-size:      0.6rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-top:     0.2rem;
  }

  /* ── Type badge (top-right corner) ──────────────────────────────────── */
  .pg-badge {
    position:        absolute;
    top:             0.5rem;
    right:           0.5rem;
    width:           1.6rem;
    height:          1.6rem;
    background:      rgba(0,0,0,0.45);
    border-radius:   50%;
    display:         flex;
    align-items:     center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
  .pg-badge svg { width: 0.85rem; height: 0.85rem; fill: rgba(255,255,255,0.85); }

  /* ── Lightbox ────────────────────────────────────────────────────────── */
  .pg-lb {
    display:         none;
    position:        fixed;
    inset:           0;
    z-index:         999999;
    background:      rgba(0,0,0,0.92);
    align-items:     center;
    justify-content: center;
    backdrop-filter: blur(6px);
  }
  .pg-lb.open { display: flex; }

  .pg-lb-inner {
    position:       relative;
    width:          fit-content;
    max-width:      min(92vw, 1200px);
    max-height:     92vh;
    display:        flex;
    flex-direction: column;
    align-items:    center;
  }
  .pg-lb-img-wrap { position: relative; line-height: 0; }
  .pg-lb-img {
    max-width:  100%;
    max-height: 78vh;
    object-fit: contain;
    display:    block;
    box-shadow: 0 30px 80px rgba(0,0,0,0.8);
  }
  .pg-lb-caption {
    margin-top:     0.75rem;
    font-family:    'Almarai', sans-serif;
    font-size:      1.4rem;
    color:          rgba(255,255,255,0.9);
    letter-spacing: 0.02em;
    text-align:     center;
  }
  .pg-lb-close {
    margin-top:     1.5rem;
    background:     none;
    border:         1px solid rgba(255,255,255,0.6);
    border-radius:  2rem;
    color:          rgba(255,255,255,0.9);
    font-size:      0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor:         pointer;
    padding:        0.5rem 2rem;
    transition:     color 0.15s, border-color 0.15s;
    font-family:    'Almarai', sans-serif;
  }
  .pg-lb-close:hover { color: #fff; border-color: #fff; }

  .pg-lb-nav {
    position:      absolute;
    top:           50%;
    transform:     translateY(-50%);
    background:    rgba(0,0,0,0.35);
    border:        none;
    color:         rgba(255,255,255,0.8);
    font-size:     2.8rem;
    padding:       0.5rem 1rem;
    cursor:        pointer;
    transition:    background 0.15s, color 0.15s;
    border-radius: var(--pg-radius);
    line-height:   1;
    font-family:   'Almarai', sans-serif;
  }
  .pg-lb-nav:hover { background: rgba(255,255,255,0.12); color: #fff; }
  .pg-lb-nav.prev  { left:  -4.5rem; }
  .pg-lb-nav.next  { right: -4.5rem; }

  /* ── Skeleton ────────────────────────────────────────────────────────── */
  .pg-skel {
    aspect-ratio: 1;
    background:   rgba(128,128,128,0.1);
    position:     relative;
    overflow:     hidden;
  }
  .pg-skel::after {
    content:    '';
    position:   absolute;
    inset:      0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%);
    animation:  pg-shimmer 1.5s infinite;
  }
  @keyframes pg-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

  .pg-message {
    grid-column: 1 / -1;
    padding:     3rem 1rem;
    text-align:  center;
    font-size:   0.8rem;
    opacity:     0.45;
  }

  @media (max-width: 640px) { .pg { --pg-cols: 3; --pg-height: 480px; } }
  @media (max-width: 380px) { .pg { --pg-cols: 2; } }
  @media (max-width: 640px) {
    .pg-lb-nav    { font-size: 2.2rem; padding: 0.4rem 0.75rem; }
    .pg-lb-nav.prev { left:  -3.5rem; }
    .pg-lb-nav.next { right: -3.5rem; }
    .pg-lb-img    { max-height: 65vh; }
  }
</style>

<div class="pg" id="pg">
  <nav class="pg-crumbs" id="pg-crumbs" aria-label="Gallery navigation"></nav>
  <div class="pg-scroll">
    <div class="pg-grid" id="pg-grid">
      <div class="pg-skel"></div><div class="pg-skel"></div><div class="pg-skel"></div>
      <div class="pg-skel"></div><div class="pg-skel"></div><div class="pg-skel"></div>
    </div>
  </div>
</div>

<div class="pg-lb" id="pg-lb">
  <div class="pg-lb-inner">
    <div class="pg-lb-img-wrap">
      <button class="pg-lb-nav prev" id="pg-lb-prev">‹</button>
      <img class="pg-lb-img" id="pg-lb-img" src="" alt="">
      <button class="pg-lb-nav next" id="pg-lb-next">›</button>
      <button class="pg-lb-close" id="pg-lb-close" style="position:absolute;top:0.4rem;right:0;margin:0;border:none;background:none;color:rgba(255,255,255,0.5);font-size:1.4rem;padding:0.2rem;">×</button>
    </div>
    <div class="pg-lb-caption" id="pg-lb-caption"></div>
    <button class="pg-lb-close" id="pg-lb-close2">Close</button>
  </div>
</div>

<script>
(function() {

  // ── CONFIGURATION ──────────────────────────────────────────────────────
  var DATA_SOURCE = 'https://jmdraper.github.io/permanent-photos/combined-gallery.json';
  // ──────────────────────────────────────────────────────────────────────

  // SVG icons
  var FOLDER_ICON = '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 5a2 2 0 012-2h3.586a1 1 0 01.707.293L9.707 4.7A1 1 0 0010.414 5H16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"/></svg>';
  var FLICKR_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="7.5" cy="12" r="4.5" fill="#ff0084"/><circle cx="16.5" cy="12" r="4.5" fill="#0063dc"/></svg>';

  // State
  var data       = null;  // full combined-gallery.json
  var state      = 'years';   // 'years' | 'albums' | 'photos'
  var currentYear   = null;   // year object
  var currentAlbum  = null;   // permanent album object
  var lbPhotos   = [];
  var lbIndex    = 0;

  var grid   = document.getElementById('pg-grid');
  var crumbs = document.getElementById('pg-crumbs');
  var lb     = document.getElementById('pg-lb');
  var lbImg  = document.getElementById('pg-lb-img');
  var lbCap  = document.getElementById('pg-lb-caption');

  // Lightbox controls
  document.getElementById('pg-lb-close').onclick  = closeLb;
  document.getElementById('pg-lb-close2').onclick = closeLb;
  document.getElementById('pg-lb-prev').onclick   = function() { navLb(-1); };
  document.getElementById('pg-lb-next').onclick   = function() { navLb(+1); };
  lb.addEventListener('click', function(e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function(e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLb();
    if (e.key === 'ArrowLeft')  navLb(-1);
    if (e.key === 'ArrowRight') navLb(+1);
  });

  // Touch swipe
  var touchStartX = 0;
  lb.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend',   function(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) navLb(dx < 0 ? 1 : -1);
  }, { passive: true });

  // ── Render years ───────────────────────────────────────────────────────
  function renderYears() {
    state = 'years';
    currentYear = currentAlbum = null;
    crumbs.innerHTML = '';
    grid.innerHTML   = '';
    document.querySelector('.pg-scroll').scrollTop = 0;

    data.years.forEach(function(year) {
      var tile = document.createElement('div');
      tile.className = 'pg-tile';
      tile.innerHTML =
        (year.coverUrl ? '<img src="' + esc(year.coverUrl) + '" alt="' + esc(year.year) + '" loading="lazy">' : '') +
        '<div class="pg-badge">' + FOLDER_ICON + '</div>' +
        '<div class="pg-tile-overlay">' +
          '<div class="pg-tile-name">' + esc(year.year) + '</div>' +
          '<div class="pg-tile-meta">' + year.albums.length + ' album' + (year.albums.length !== 1 ? 's' : '') + '</div>' +
        '</div>';
      if (year.coverUrl) tile.querySelector('img').onload = function() { this.classList.add('loaded'); };
      tile.onclick = function() { renderAlbums(year); };
      grid.appendChild(tile);
    });
  }

  // ── Render albums for a year ───────────────────────────────────────────
  function renderAlbums(year) {
    state = 'albums';
    currentYear  = year;
    currentAlbum = null;
    renderCrumbs();
    grid.innerHTML = '';
    document.querySelector('.pg-scroll').scrollTop = 0;

    year.albums.forEach(function(album) {
      var tile = document.createElement('div');
      tile.className = 'pg-tile';

      var meta = album.photographer ? 'Photos by ' + album.photographer : '';
      var icon = album.type === 'flickr' ? FLICKR_ICON : FOLDER_ICON;

      tile.innerHTML =
        (album.coverUrl ? '<img src="' + esc(album.coverUrl) + '" alt="' + esc(album.name) + '" loading="lazy">' : '') +
        '<div class="pg-badge">' + icon + '</div>' +
        '<div class="pg-tile-overlay">' +
          '<div class="pg-tile-name">' + esc(album.name) + '</div>' +
          (meta ? '<div class="pg-tile-meta">' + esc(meta) + '</div>' : '') +
        '</div>';

      if (album.coverUrl) tile.querySelector('img').onload = function() { this.classList.add('loaded'); };

      if (album.type === 'flickr') {
        tile.onclick = function() { window.open(album.flickrUrl, '_blank', 'noopener'); };
      } else {
        tile.onclick = function() { renderPhotos(album); };
      }

      grid.appendChild(tile);
    });
  }

  // ── Render photos for a permanent album ───────────────────────────────
  function renderPhotos(album) {
    state = 'photos';
    currentAlbum = album;
    renderCrumbs();
    grid.innerHTML = '';
    lbPhotos = album.photos || [];
    document.querySelector('.pg-scroll').scrollTop = 0;

    if (!lbPhotos.length) {
      grid.innerHTML = '<div class="pg-message">No photos in this album.</div>';
      return;
    }

    lbPhotos.forEach(function(photo, i) {
      var tile = document.createElement('div');
      tile.className = 'pg-tile';
      tile.innerHTML =
        '<img src="' + esc(photo.thumbUrl || photo.fullUrl) + '" alt="' + esc(photo.title) + '" loading="lazy">' +
        '<div class="pg-tile-overlay"><span class="pg-tile-name">' + esc(photo.title) + '</span></div>';
      tile.querySelector('img').onload = function() { this.classList.add('loaded'); };
      (function(idx) { tile.onclick = function() { openLb(idx); }; })(i);
      grid.appendChild(tile);
    });
  }

  // ── Breadcrumbs ────────────────────────────────────────────────────────
  function renderCrumbs() {
    crumbs.innerHTML = '';

    var allBtn = document.createElement('button');
    allBtn.className   = 'pg-crumb';
    allBtn.textContent = 'All';
    allBtn.onclick     = renderYears;
    crumbs.appendChild(allBtn);

    if (currentYear) {
      crumbs.appendChild(sep());
      var yearBtn = document.createElement('button');
      yearBtn.className   = 'pg-crumb' + (state === 'albums' ? ' active' : '');
      yearBtn.textContent = currentYear.year;
      if (state === 'photos') yearBtn.onclick = function() { renderAlbums(currentYear); };
      crumbs.appendChild(yearBtn);
    }

    if (currentAlbum) {
      crumbs.appendChild(sep());
      var albumBtn = document.createElement('button');
      albumBtn.className   = 'pg-crumb active';
      albumBtn.textContent = currentAlbum.name;
      crumbs.appendChild(albumBtn);
    }
  }

  function sep() {
    var s = document.createElement('span');
    s.className   = 'pg-crumb-sep';
    s.textContent = '/';
    return s;
  }

  // ── Lightbox ───────────────────────────────────────────────────────────
  function openLb(idx) {
    lbIndex = idx;
    showSlide();
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function showSlide() {
    var photo = lbPhotos[lbIndex];
    if (!photo) return;
    lbImg.src = photo.fullUrl || photo.thumbUrl;
    lbImg.alt = photo.title || '';
    var datePart = '';
    try { if (photo.date) datePart = new Date(photo.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' }); } catch(e){}
    lbCap.textContent = [photo.title, datePart].filter(Boolean).join(' · ');
  }

  function closeLb() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
  }

  function navLb(dir) {
    lbIndex = (lbIndex + dir + lbPhotos.length) % lbPhotos.length;
    showSlide();
  }

  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────
  fetch(DATA_SOURCE)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(d) {
      data = d;
      if (!data.years || !data.years.length) {
        grid.innerHTML = '<div class="pg-message">No albums found.</div>';
        return;
      }
      renderYears();
    })
    .catch(function(err) {
      grid.innerHTML = '<div class="pg-message">Could not load gallery.<br><small>' + esc(err.message) + '</small></div>';
    });

})();
</script>
