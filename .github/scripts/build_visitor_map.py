"""Turn a GA4 Data API runReport response into the public visitor-map file.

Usage: python build_visitor_map.py <report.json or "-"> <output.json>

Only country code, country name and an active-user count for the last 30 days are
written. Counts below MIN_COUNT are replaced by null so small numbers are not exposed.
If the report is missing or is an error, a file with status "unavailable" is written so
the homepage can say so instead of showing an empty or stale map.
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


def main(src, dst):
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
        with (sys.stdin if src == "-" else open(src, encoding="utf8")) as f:
            report = json.load(f)
        if "error" in report:
            raise ValueError("API error %s" % report["error"].get("code"))
        for row in report.get("rows", []):
            code, name = (d["value"] for d in row["dimensionValues"])
            users = int(row["metricValues"][0]["value"])
            code = code.upper()
            if code not in CENTROIDS or users <= 0:
                continue  # skips "(not set)" and codes without a known centre point
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
    main(sys.argv[1], sys.argv[2])
