/* Public visitor map: aggregated active users per country for the last 30 days.
   The data file is generated every few hours by .github/workflows/pages.yml from the
   site's own Google Analytics property; it contains only country codes, names, centre
   points, bounding boxes and counts, plus the restricted browser Maps key if configured. */
(function () {
  var box = document.getElementById('visitorMap');
  var status = document.getElementById('visitorMapStatus');
  var caption = document.getElementById('visitorMapCaption');
  if (!box) return;

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function say(msg) { status.textContent = msg; status.hidden = false; }

  function fmtDate(iso) {
    try { return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
    catch (e) { return iso; }
  }

  function label(data, r) {
    return r.users === null ? 'fewer than ' + data.min_count + ' active users'
      : r.users + (r.users === 1 ? ' active user' : ' active users');
  }

  function setCaption(data, rows) {
    caption.textContent = (rows.length
      ? 'Active users from ' + rows.length + (rows.length === 1 ? ' country' : ' countries') + ', '
      : 'No visitor locations recorded yet for ') +
      fmtDate(data.start_date) + ' to ' + fmtDate(data.end_date) + '. Updated ' +
      new Date(data.generated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC.';
  }

  // Last-resort fallback: Google GeoChart (no API key), used if Leaflet cannot load.
  function drawGeoChart(data) {
    var rows = data.countries || [];
    var table = new google.visualization.DataTable();
    // Latitude/longitude markers need no geocoding, so no Maps API key is used.
    table.addColumn('number', 'Latitude');
    table.addColumn('number', 'Longitude');
    table.addColumn('number', 'Active users');
    table.addColumn('number', 'Size');
    table.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
    rows.forEach(function (r) {
      // Small counts are drawn at the threshold size so the dot does not reveal the exact number.
      var v = r.users === null ? data.min_count : r.users;
      table.addRow([r.lat, r.lng, v, v, '<div class="vm-tip"><b>' + esc(r.name) + '</b><br>' + label(data, r) + '</div>']);
    });
    var css = getComputedStyle(document.documentElement);
    var accent = (css.getPropertyValue('--accent') || '#1b6ca8').trim();
    var chart = new google.visualization.GeoChart(box);
    var opts = {
      displayMode: 'markers',
      backgroundColor: 'transparent',
      datalessRegionColor: '#dbe7f1',
      defaultColor: accent,
      colorAxis: { colors: ['#7fb3da', accent] },
      sizeAxis: { minSize: 5, maxSize: 14 },
      markerOpacity: 0.85,
      legend: 'none',
      keepAspectRatio: true,
      tooltip: { isHtml: true }
    };
    chart.draw(table, opts);
    var redraw;
    window.addEventListener('resize', function () { clearTimeout(redraw); redraw = setTimeout(function () { chart.draw(table, opts); }, 200); });
    status.hidden = true;
    setCaption(data, rows);
  }

  function loadGeoChart(data) {
    var s = document.createElement('script');
    s.src = 'https://www.gstatic.com/charts/loader.js';
    s.onload = function () {
      google.charts.load('current', { packages: ['geochart'] });
      google.charts.setOnLoadCallback(function () { drawGeoChart(data); });
    };
    s.onerror = function () { say('The visitor map is temporarily unavailable.'); };
    document.head.appendChild(s);
  }

  // Keyboard- and touch-friendly list of countries below the map.
  function buildList(data, rows, pick) {
    var list = document.getElementById('visitorMapList');
    if (!list) return;
    list.innerHTML = '';
    rows.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'vm-chip';
      b.textContent = r.name + ' · ' + (r.users === null ? '<' + data.min_count : r.users);
      b.setAttribute('aria-label', 'Zoom to ' + r.name + ', ' + label(data, r));
      b.addEventListener('click', function () { pick(r); });
      list.appendChild(b);
    });
    list.hidden = !rows.length;
  }

  function popupHtml(data, r) {
    return '<div class="vm-tip"><b>' + esc(r.name) + '</b><br>' + label(data, r) +
      '<br><span class="vm-tip-sub">' + fmtDate(data.start_date) + ' to ' + fmtDate(data.end_date) + '</span></div>';
  }

  // Free interactive map (Leaflet + OpenStreetMap), used when no Google Maps key is configured
  // or Google Maps fails. Not Google imagery; attribution is shown on the map.
  var LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  function loadLeaflet(data) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET + 'leaflet.min.css';
    css.integrity = 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==';
    css.crossOrigin = 'anonymous';
    document.head.appendChild(css);
    var s = document.createElement('script');
    s.src = LEAFLET + 'leaflet.min.js';
    s.integrity = 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==';
    s.crossOrigin = 'anonymous';
    s.onload = function () {
      try { drawLeaflet(data); }
      catch (e) { box.innerHTML = ''; box.classList.remove('vm-gmap'); if (data.status === 'ok') loadGeoChart(data); else say('The visitor map is temporarily unavailable.'); }
    };
    s.onerror = function () { if (data.status === 'ok') loadGeoChart(data); else say('The visitor map is temporarily unavailable.'); };
    document.head.appendChild(s);
  }

  function drawLeaflet(data) {
    var rows = (data.status === 'ok' && data.countries) || [];
    box.classList.add('vm-gmap');
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Interactive map of the countries website visitors came from in the last 30 days');
    var map = L.map(box, { worldCopyJump: true, minZoom: 1, maxZoom: 12, scrollWheelZoom: false, zoomSnap: 0.25 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);
    function boundsOf(list) {
      return L.latLngBounds(list.map(function (r) { return [[r.bbox[1], r.bbox[0]], [r.bbox[3], r.bbox[2]]]; }).reduce(function (a, b) { return a.concat(b); }, []));
    }
    function showAll() {
      map.closePopup();
      if (rows.length) map.fitBounds(boundsOf(rows), { padding: [24, 24], maxZoom: 7 });
      else map.setView([10, 20], 2);
    }
    var markers = rows.map(function (r) {
      var m = L.circleMarker([r.lat, r.lng], {
        radius: r.users === null ? 9 : Math.min(26, 9 + 3 * Math.sqrt(r.users)),
        color: '#ffffff', weight: 2, fillColor: '#1b6ca8', fillOpacity: 0.85
      }).addTo(map).bindPopup(popupHtml(data, r));
      m.on('click', function () { focus(r); });
      return m;
    });
    function focus(r) {
      map.fitBounds(boundsOf([r]), { padding: [24, 24], maxZoom: 9 });
      markers[rows.indexOf(r)].openPopup();
    }
    // Wheel zoom only after the visitor clicks the map, so page scrolling is not captured;
    // it switches off again when the pointer leaves the map.
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    map.on('mouseout', function () { map.scrollWheelZoom.disable(); });
    // Controls: "All countries" overview and full screen.
    var Ctl = L.Control.extend({
      onAdd: function () {
        var wrap = L.DomUtil.create('div', 'leaflet-bar vm-ctl');
        var all = L.DomUtil.create('a', '', wrap);
        all.href = '#'; all.role = 'button'; all.textContent = rows.length ? 'All countries' : 'World view';
        all.title = 'Show all countries';
        var fs = L.DomUtil.create('a', 'vm-fs', wrap);
        fs.href = '#'; fs.role = 'button'; fs.title = 'Full screen'; fs.setAttribute('aria-label', 'Full screen'); fs.innerHTML = '&#x26F6;';
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.on(all, 'click', function (e) { L.DomEvent.preventDefault(e); showAll(); });
        L.DomEvent.on(fs, 'click', function (e) {
          L.DomEvent.preventDefault(e);
          var el = box.closest('.vm-frame') || box;
          if (document.fullscreenElement) document.exitFullscreen();
          else if (el.requestFullscreen) el.requestFullscreen();
        });
        return wrap;
      }
    });
    map.addControl(new Ctl({ position: 'topleft' }));
    document.addEventListener('fullscreenchange', function () {
      box.closest('.vm-frame').classList.toggle('vm-full', !!document.fullscreenElement);
      setTimeout(function () { map.invalidateSize(); }, 100);
    });
    showAll();
    buildList(data, rows, focus);
    status.hidden = true;
    if (data.status !== 'ok') caption.textContent = 'Visitor-location data is temporarily unavailable.';
    else setCaption(data, rows);
  }

  // Interactive Google Map: satellite / map views, zoom, pan, full screen, country bubbles.
  function drawGoogleMap(data) {
    var gm = google.maps;
    var rows = (data.status === 'ok' && data.countries) || [];
    box.classList.add('vm-gmap');
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Interactive map of the countries website visitors came from in the last 30 days');
    var map = new gm.Map(box, {
      center: { lat: 10, lng: 20 }, zoom: 2, minZoom: 2,
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      mapTypeControlOptions: { mapTypeIds: ['roadmap', 'hybrid'], style: gm.MapTypeControlStyle.HORIZONTAL_BAR },
      zoomControl: true, fullscreenControl: true, streetViewControl: false, rotateControl: false,
      cameraControl: false, gestureHandling: 'cooperative', clickableIcons: false
    });
    // Wheel zoom without Ctrl once the visitor clicks the map (mouse users only);
    // back to cooperative (Ctrl + wheel, two-finger touch) when the pointer leaves.
    if (window.matchMedia && matchMedia('(pointer: fine)').matches) {
      map.addListener('click', function () { map.setOptions({ gestureHandling: 'greedy' }); });
      box.addEventListener('mouseleave', function () { map.setOptions({ gestureHandling: 'cooperative' }); });
    }
    var info = new gm.InfoWindow();
    function boundsOf(list) {
      var b = new gm.LatLngBounds();
      list.forEach(function (r) { b.extend({ lat: r.bbox[1], lng: r.bbox[0] }); b.extend({ lat: r.bbox[3], lng: r.bbox[2] }); });
      return b;
    }
    function showAll() {
      if (rows.length) map.fitBounds(boundsOf(rows), 24);
      else { map.setCenter({ lat: 10, lng: 20 }); map.setZoom(2); }
    }
    // Bubble size is set in screen pixels, then converted to metres for the current zoom.
    function pixels(r) { return r.users === null ? 9 : Math.min(26, 9 + 3 * Math.sqrt(r.users)); }
    var circles = rows.map(function (r) {
      var c = new gm.Circle({
        map: map, center: { lat: r.lat, lng: r.lng }, radius: 1,
        strokeColor: '#ffffff', strokeWeight: 2, strokeOpacity: 0.95,
        fillColor: '#1b6ca8', fillOpacity: 0.85, clickable: true, zIndex: 2
      });
      c.addListener('click', function () { focus(r); });
      return c;
    });
    function resize() {
      var z = map.getZoom();
      rows.forEach(function (r, i) {
        var mpp = 156543.03392 * Math.cos(r.lat * Math.PI / 180) / Math.pow(2, z);
        circles[i].setRadius(pixels(r) * mpp);
      });
    }
    map.addListener('zoom_changed', resize);
    function focus(r) {
      map.fitBounds(boundsOf([r]), 24);
      info.setContent(popupHtml(data, r));
      info.setPosition({ lat: r.lat, lng: r.lng });
      info.open({ map: map });
    }
    // Button that returns to the overview of all countries.
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'vm-reset';
    reset.textContent = rows.length ? 'All countries' : 'World view';
    reset.addEventListener('click', function () { info.close(); showAll(); });
    map.controls[gm.ControlPosition.TOP_LEFT].push(reset);
    gm.event.addListenerOnce(map, 'idle', function () { showAll(); resize(); });
    buildList(data, rows, focus);
    status.hidden = true;
    if (data.status !== 'ok') caption.textContent = 'Visitor-location data is temporarily unavailable.';
    else setCaption(data, rows);
  }

  function loadGoogleMap(data) {
    var done = false;
    function fallback() {
      if (done) return;
      done = true;
      box.innerHTML = '';
      box.classList.remove('vm-gmap');
      var l = document.getElementById('visitorMapList');
      if (l) l.hidden = true;
      loadLeaflet(data);
    }
    window.gm_authFailure = fallback;  // invalid or unauthorised key
    window.__snMapsReady = function () {
      if (done) return;
      try { drawGoogleMap(data); } catch (e) { fallback(); }
    };
    var s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(data.maps_key) + '&v=weekly&loading=async&callback=__snMapsReady';
    s.async = true;
    s.onerror = fallback;
    document.head.appendChild(s);
  }

  function load() {
    say('Loading visitor map…');
    fetch('data/visitor-map.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        if (d.maps_key) return loadGoogleMap(d);
        loadLeaflet(d);
      })
      .catch(function () { say('The visitor map is temporarily unavailable.'); });
  }

  // Fetch the map only when its section approaches the viewport.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); load(); }
    }, { rootMargin: '300px' });
    io.observe(box);
  } else load();
})();
