/* Public visitor map: draws aggregated country counts for the last 30 days.
   The data file is generated every few hours by .github/workflows/pages.yml from the
   site's own Google Analytics property; it contains only country codes and counts. */
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

  function draw(data) {
    var rows = data.countries || [];
    if (!rows.length) {
      say('No visitor locations have been recorded in the last 30 days yet. The map fills in as data arrives.');
      return;
    }
    var table = new google.visualization.DataTable();
    // Latitude/longitude markers need no geocoding, so no Maps API key is used.
    table.addColumn('number', 'Latitude');
    table.addColumn('number', 'Longitude');
    table.addColumn('number', 'Visitors');
    table.addColumn('number', 'Size');
    table.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
    rows.forEach(function (r) {
      var label = r.users === null ? 'fewer than ' + data.min_count + ' visitors' : r.users + (r.users === 1 ? ' visitor' : ' visitors');
      // Small counts are drawn at the threshold size so the dot does not reveal the exact number.
      var v = r.users === null ? data.min_count : r.users;
      table.addRow([r.lat, r.lng, v, v, '<div class="vm-tip"><b>' + esc(r.name) + '</b><br>' + label + '</div>']);
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
    caption.textContent = 'Visitors from ' + rows.length + (rows.length === 1 ? ' country' : ' countries') +
      ', ' + fmtDate(data.start_date) + ' to ' + fmtDate(data.end_date) + '. Updated ' +
      new Date(data.generated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC.';
  }

  function load() {
    say('Loading visitor map…');
    var data;
    fetch('data/visitor-map.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        data = d;
        if (d.status !== 'ok') throw new Error('unavailable');
        return new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = 'https://www.gstatic.com/charts/loader.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      })
      .then(function () {
        google.charts.load('current', { packages: ['geochart'] });
        google.charts.setOnLoadCallback(function () { draw(data); });
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
