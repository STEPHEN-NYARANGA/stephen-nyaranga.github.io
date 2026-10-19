/* Google Analytics 4 with opt-in consent and tracking for important links.
   Nothing loads and no cookie is set until the visitor clicks "Accept".
   Set GA_ID to the public Measurement ID (G-XXXXXXXXXX) of the GA4 web stream. */
(function () {
  var GA_ID = 'G-S49913N5GN';
  var KEY = 'sn_analytics_consent';
  if (window.__snAnalytics) return;
  window.__snAnalytics = true;

  // Test visits (localhost or ?analytics_debug=1) go to GA DebugView and can be filtered out as developer traffic.
  var debug = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /[?&]analytics_debug=1/.test(location.search);

  function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var loaded = false, active = false;
  function load() {
    if (!GA_ID) return;
    if (loaded) { active = true; window['ga-disable-' + GA_ID] = false; gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    loaded = true;
    window['ga-disable-' + GA_ID] = false;
    active = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('js', new Date());
    var cfg = { allow_google_signals: false, allow_ad_personalization_signals: false };
    if (debug) cfg.debug_mode = true;
    gtag('config', GA_ID, cfg);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }

  function revoke() {
    if (!GA_ID) return;
    active = false;
    window['ga-disable-' + GA_ID] = true;
    if (window.gtag) gtag('consent', 'update', { analytics_storage: 'denied' });
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n === '_ga' || n.indexOf('_ga_') === 0) {
        ['', '; domain=' + location.hostname, '; domain=.' + location.hostname].forEach(function (d) {
          document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
        });
      }
    });
  }

  // Consent banner
  var banner = null;
  function showBanner() {
    if (banner) { banner.hidden = false; return; }
    banner = document.createElement('div');
    banner.className = 'consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Analytics consent');
    banner.innerHTML = '<p>May I use Google Analytics cookies to count visits and see which links are useful? No advertising features are used. <a href="privacy.html">Privacy note</a></p>' +
      '<div class="consent-btns"><button type="button" class="consent-no">Decline</button><button type="button" class="consent-yes">Accept</button></div>';
    banner.querySelector('.consent-yes').addEventListener('click', function () { setChoice('granted'); banner.hidden = true; load(); });
    banner.querySelector('.consent-no').addEventListener('click', function () { setChoice('denied'); banner.hidden = true; revoke(); });
    document.body.appendChild(banner);
  }

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }

  // Without a Measurement ID the script does nothing and the settings links stay hidden.
  if (!GA_ID) return;
  ready(function () {
    document.querySelectorAll('[data-analytics-settings]').forEach(function (el) { el.hidden = false; });
  });
  // Any element with data-analytics-settings reopens the banner (footer link, privacy page).
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-analytics-settings]');
    if (t) { e.preventDefault(); showBanner(); }
  });
  var choice = getChoice();
  if (choice === 'granted') load();
  else if (choice !== 'denied' && !navigator.globalPrivacyControl) {
    ready(showBanner);
  }

  // Link tracking: one delegated listener; links behave normally.
  var CATS = [
    [/(^|\.)linkedin\.com$/, 'linkedin'],
    [/(^|\.)orcid\.org$/, 'orcid'],
    [/(^|\.)github\.(com|io)$|\.vercel\.app$|\.netlify\.app$|\.hf\.space$|(^|\.)huggingface\.co$/, 'project'],
    [/(^|\.)drive\.google\.com$/, 'thesis'],
    [/(^|\.)indico\.|(^|\.)acmad\.org$/, 'event']
  ];
  function category(host) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i][0].test(host)) return CATS[i][1];
    return 'external';
  }
  function label(a) {
    var l = a.querySelector('.cl-l');
    return ((l ? l.textContent : a.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  }
  function section(a) {
    if (a.closest('nav')) return 'nav';
    var s = a.closest('section');
    if (!s) return 'other';
    if (s.id) return s.id;
    var h = s.querySelector('.section-label');
    return h ? h.textContent.replace(/[^A-Za-z&]+/g, ' ').trim().toLowerCase().slice(0, 40) : 'other';
  }

  function track(e) {
    if (e.type === 'auxclick' && e.button !== 1) return;
    if (!active || !window.gtag) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.hasAttribute('data-analytics-settings')) return;
    var href = a.getAttribute('href');
    if (href.charAt(0) === '#') return;
    if (/^mailto:/i.test(href)) {
      // The address itself is never sent.
      gtag('event', 'email_click', { link_category: 'email', link_text: label(a), section: section(a) });
      return;
    }
    var u;
    try { u = new URL(a.href); } catch (err) { return; }
    if (u.origin === location.origin) {
      var m = u.pathname.match(/([^\/]+)\.(pdf)$/i);
      if (!m) return;
      var file = decodeURIComponent(m[0]);
      gtag('event', 'document_download', {
        link_category: /_CV\.pdf$/i.test(file) ? 'cv' : (/certificate/i.test(file) ? 'certificate' : 'document'),
        file_name: file, file_extension: 'pdf', link_text: label(a), section: section(a)
      });
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    gtag('event', 'link_click', {
      link_category: category(u.hostname), link_domain: u.hostname, link_url: u.origin + u.pathname,
      link_text: label(a), section: section(a)
    });
  }
  document.addEventListener('click', track);
  document.addEventListener('auxclick', track);
})();
