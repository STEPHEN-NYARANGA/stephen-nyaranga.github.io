"""Turn GA4 Data API responses into the public visitor-map file.

Usage: python build_visitor_map.py <report.json> <realtime.json> <output.json>

report.json is a runReport for the last 30 days (processed data, which can lag by
up to a day or two); realtime.json is a runRealtimeReport for the last 30 minutes.
Both are active users by country. Realtime visitors are inside the 30-day window, so
each country gets the larger of the two counts (a lower bound; nothing is added twice).
Only country code, name, centre point and count are written. Counts below MIN_COUNT
are replaced by null so small numbers are not exposed. If the 30-day report is
missing or is an error, status is "unavailable" so the homepage can say so.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

MIN_COUNT = 5
WINDOW_DAYS = 30
PROPERTY_TZ = timezone(timedelta(hours=2))  # GA4 property reporting time zone (Rwanda)
# Approximate country centre points, from Google's DSPL canonical countries table.
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "country_centroids.json"), encoding="utf8") as _f:
    CENTROIDS = json.load(_f)


def read_rows(path):
    """Return {code: (name, users)} from a report file; raises if missing or an error."""
    with open(path, encoding="utf8") as f:
        report = json.load(f)
    if "error" in report:
        raise ValueError("API error %s" % report["error"].get("code"))
    rows = {}
    for row in report.get("rows", []):
        code, name = (d["value"] for d in row["dimensionValues"])
        users = int(row["metricValues"][0]["value"])
        code = code.upper()
        if code in CENTROIDS and users > 0:  # skips "(not set)" and unknown codes
            rows[code] = (name, users)
    return rows


def main(src, realtime_src, dst):
    today = datetime.now(PROPERTY_TZ).date()
    out = {
        "status": "unavailable",
        "start_date": (today - timedelta(days=WINDOW_DAYS - 1)).isoformat(),
        "end_date": today.isoformat(),
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "min_count": MIN_COUNT,
        "countries": [],
    }
    try:
        merged = read_rows(src)
        try:
            for code, (name, users) in read_rows(realtime_src).items():
                if users > merged.get(code, ("", 0))[1]:
                    merged[code] = (merged.get(code, (name, 0))[0], users)
        except Exception as exc:
            print("realtime data skipped: %s" % type(exc).__name__, file=sys.stderr)
        for code, (name, users) in sorted(merged.items(), key=lambda kv: -kv[1][1]):
            lat, lng = CENTROIDS[code]
            out["countries"].append({
                "code": code,
                "name": name,
                "lat": lat,
                "lng": lng,
                "users": users if users >= MIN_COUNT else None,
            })
        out["status"] = "ok"
    except Exception as exc:  # report the failure without leaking the response
        print("visitor map unavailable: %s" % type(exc).__name__, file=sys.stderr)
    with open(dst, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("status=%s countries=%d" % (out["status"], len(out["countries"])))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
