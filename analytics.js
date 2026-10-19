/* Google Analytics 4 for this site, without a consent pop-up.
   - EU/EEA, UK and Switzerland: analytics cookies are off by default (Google Consent Mode
     region default), so GA4 sets no cookies there unless the visitor turns analytics on.
   - Elsewhere: GA4 runs with its standard first-party cookies.
   - Anyone can turn analytics off or on from the footer "Analytics settings" link; a browser
     Global Privacy Control signal, or choosing "off", stops GA4 from loading at all.
   Advertising features and Google signals are disabled. */
(function () {
  var GA_ID = 'G-S49913N5GN';
  var KEY = 'sn_analytics_consent';
  var CONSENT_REGIONS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'];
  if (window.__snAnalytics) return;
  window.__snAnalytics = true;

  // Test visits (localhost or ?analytics_debug=1) go to GA DebugView and can be filtered out as developer traffic.
  var debug = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /[?&]analytics_debug=1/.test(location.search);

  function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var loaded = false, active = false;
  function load(granted) {
    if (loaded) {
      active = true;
      window['ga-disable-' + GA_ID] = false;
      if (granted) gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    loaded = true;
    active = true;
    window['ga-disable-' + GA_ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    var ads = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
    gtag('consent', 'default', Object.assign({ analytics_storage: 'denied', region: CONSENT_REGIONS }, ads));
    gtag('consent', 'default', Object.assign({ analytics_storage: 'granted' }, ads));
    if (granted) gtag('consent', 'update', { analytics_storage: 'granted' });
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

  // Settings panel: opens only when the visitor clicks "Analytics settings".
  var panel = null;
  function stateText() {
    var c = getChoice();
    if (c === 'denied' || (!c && navigator.globalPrivacyControl)) return 'Analytics is currently off on this device.';
    if (c === 'granted') return 'Analytics cookies are currently on.';
    return 'Analytics is on by default; in the EU/EEA, UK and Switzerland it runs without cookies unless you turn cookies on.';
  }
  function showPanel() {
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'consent';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Analytics settings');
      panel.innerHTML = '<p><span class="consent-state"></span> This site uses Google Analytics to count visits and see which links are useful; no advertising features are used. <a href="privacy.html">Privacy note</a></p>' +
        '<div class="consent-btns"><button type="button" class="consent-no">Turn off</button><button type="button" class="consent-yes">Allow cookies</button><button type="button" class="consent-close" aria-label="Close">&times;</button></div>';
      panel.querySelector('.consent-yes').addEventListener('click', function () { setChoice('granted'); load(true); panel.hidden = true; });
      panel.querySelector('.consent-no').addEventListener('click', function () { setChoice('denied'); revoke(); panel.hidden = true; });
      panel.querySelector('.consent-close').addEventListener('click', function () { panel.hidden = true; });
      document.body.appendChild(panel);
    }
    panel.querySelector('.consent-state').textContent = stateText();
    panel.hidden = false;
    panel.querySelector('.consent-yes').focus();
  }

  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    document.querySelectorAll('[data-analytics-settings]').forEach(function (el) { el.hidden = false; });
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-analytics-settings]');
    if (t) { e.preventDefault(); showPanel(); }
  });

  var choice = getChoice();
  if (choice === 'granted') load(true);
  else if (choice !== 'denied' && !navigator.globalPrivacyControl) load(false);

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
