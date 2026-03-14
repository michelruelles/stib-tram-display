(function () {
  "use strict";

  /**
   * Transit Door Display – Vanilla JS (no dependencies)
   * Public endpoint: STIB/MIVB Opendatasoft Explore API v2.1
   *
   * URL parameters you can use:
   *  - stopId=6805F
   *  - title=Kraainem%20%E2%80%93%206805F
   *  - refresh=20
   *  - maxRows=6
   *  - api=(optional override endpoint)
   *
   * Example:
   *   index.html?stopId=6805F&title=Kraainem%20(6805F)&refresh=20&maxRows=6
   */

  // ---- Defaults (baked in) ----
  var DEFAULTS = {
    apiBase:
      "https://data.stib-mivb.brussels/api/explore/v2.1/catalog/datasets/waiting-time-rt-production/records",
    stopId: "6805F",
    title: "Kraainem – 6805F",
    maxRows: 6,
    refreshSeconds: 20,
  };

  // ---- Helpers: URL param reading (compatible, no URLSearchParams required) ----
  function getQueryParam(name) {
    var qs = window.location.search.substring(1);
    var re = new RegExp("(^|&)" + encodeURIComponent(name) + "=([^&]*)");
    var m = re.exec(qs);
    return m ? decodeURIComponent(m[2].replace(/\+/g, " ")) : null;
  }

  function getConfig() {
    return {
      apiBase: getQueryParam("api") || DEFAULTS.apiBase,
      stopId: getQueryParam("stopId") || DEFAULTS.stopId,
      title: getQueryParam("title") || DEFAULTS.title,
      maxRows: parseInt(getQueryParam("maxRows") || DEFAULTS.maxRows, 10),
      refreshSeconds: parseInt(getQueryParam("refresh") || DEFAULTS.refreshSeconds, 10),
    };
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function fmtTime(dateObj) {
    return pad2(dateObj.getHours()) + ":" + pad2(dateObj.getMinutes());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[ch];
    });
  }

  function countdownLabel(isoTime) {
    try {
      var now = new Date();
      var dep = new Date(isoTime);
      var minutes = Math.round((dep.getTime() - now.getTime()) / 60000);
      var isDue = minutes <= 0;
      return { label: isDue ? "Due" : minutes + " min", due: isDue };
    } catch (e) {
      return { label: "—", due: false };
    }
  }

  // Some STIB payloads store passingtimes as a JSON string; handle both.
  function parsePassingTimes(pt) {
    if (!pt) return [];
    if (Object.prototype.toString.call(pt) === "[object Array]") return pt;
    if (typeof pt === "string") {
      try {
        var t = pt.replace(/^\s+|\s+$/g, "");
        if (t.charAt(0) === "[" && t.charAt(t.length - 1) === "]") return JSON.parse(t);
      } catch (e) {}
    }
    return [];
  }

  /**
   * Normalize various response shapes into:
   *   { line, destination, departureTimeISO }[]
   */
  function parseDepartures(data, wantStopId) {
    var out = [];

    function processFields(fields) {
      if (!fields) return;

      var pid = fields.pointid || fields.stopid || fields.stop_id || fields.pointId;
      if (wantStopId && pid && String(pid) !== String(wantStopId)) return;

      var lineid = fields.lineid || fields.lineId || fields.route || fields.line;
      var passing = parsePassingTimes(fields.passingtimes || fields.passingTimes);

      for (var i = 0; i < passing.length; i++) {
        var p = passing[i];
        var dest =
          (p.destination && (p.destination.nl || p.destination.fr)) ||
          p.headsign ||
          p.destination ||
          "—";
        var when =
          p.expectedArrivalTime ||
          p.time ||
          p.departureTime ||
          p.expected_time ||
          null;

        var line = p.lineId || lineid || "?";
        if (when) out.push({ line: String(line), destination: String(dest), departureTimeISO: when });
      }
    }

    // Opendatasoft Explore v2.1 typical shape: { results: [...] }
    if (data && data.results && data.results.length) {
      for (var a = 0; a < data.results.length; a++) {
        var r = data.results[a];
        processFields((r && r.record && r.record.fields) || r.fields || r);
      }
      return out;
    }

    // Alternate shapes
    if (data && data.records && data.records.length) {
      for (var b = 0; b < data.records.length; b++) {
        var r2 = data.records[b];
        processFields(r2.fields || r2);
      }
      return out;
    }

    if (Object.prototype.toString.call(data) === "[object Array]") {
      for (var j = 0; j < data.length; j++) processFields(data[j]);
      return out;
    }

    if (data && typeof data === "object") {
      processFields(data);
      return out;
    }

    return out;
  }

  function buildUrl(base, params) {
    var sep = base.indexOf("?") === -1 ? "?" : "&";
    var q = [];
    for (var k in params) {
      if (params.hasOwnProperty(k) && params[k] != null && params[k] !== "") {
        q.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k])));
      }
    }
    return base + sep + q.join("&");
  }

  // ---- Fetch departures via XHR (widely compatible) ----
  function fetchDepartures(cfg, onOk, onErr) {
    try {
      // Opendatasoft filter for a stop
      var url = buildUrl(cfg.apiBase, {
        "refine.pointid": cfg.stopId,
        limit: 20,
      });

      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var json = JSON.parse(xhr.responseText);
              onOk(parseDepartures(json, cfg.stopId));
            } catch (e) {
              onErr(e);
            }
          } else {
            onErr(new Error("API error " + xhr.status));
          }
        }
      };

      xhr.onerror = function () {
        onErr(new Error("Network error"));
      };

      xhr.send();
    } catch (e) {
      onErr(e);
    }
  }

  // ---- Rendering ----
  var cfg = getConfig();
  var app = document.getElementById("app");

  var state = {
    now: new Date(),
    lastOk: null,
    departures: [],
    error: "",
  };

  function statusLevel() {
    if (!state.lastOk) return "err";
    var ageSec = (state.now.getTime() - state.lastOk.getTime()) / 1000;
    if (ageSec < cfg.refreshSeconds * 2.5) return "ok";
    if (ageSec < cfg.refreshSeconds * 10) return "warn";
    return "err";
  }

  function statusLabel(level) {
    if (level === "ok") return "LIVE";
    if (level === "warn") return "STALE";
    return "OFFLINE";
  }

  function render() {
    var level = statusLevel();
    var dep = state.departures || [];
    var highlight = dep.slice(0, 1);
    var rest = dep.slice(1);

    function rowHTML(d, isHighlight) {
      var c = countdownLabel(d.departureTimeISO);
      var abs = new Date(d.departureTimeISO);
      return (
        '\n<div class="row ' +
        (isHighlight ? "hl" : "nhl") +
        '">' +
        '\n  <div><div class="badge">' +
        escapeHtml(d.line) +
        "</div></div>" +
        '\n  <div class="dest" title="' +
        escapeHtml(d.destination) +
        '">' +
        escapeHtml(d.destination) +
        "</div>" +
        '\n  <div class="time">' +
        escapeHtml(c.label) +
        "<small>" +
        escapeHtml(fmtTime(abs)) +
        "</small></div>" +
        "\n</div>"
      );
    }

    var html =
      '\n<div class="container">' +
      '\n  <div class="header">' +
      '\n    <div class="h-title">' +
      escapeHtml(cfg.title) +
      "</div>" +
      '\n    <div class="h-meta">' +
      escapeHtml(state.now.toLocaleDateString()) +
      " · " +
      escapeHtml(fmtTime(state.now)) +
      '\n      <div><span class="pill ' +
      level +
      '">' +
      statusLabel(level) +
      "</span></div>" +
      "\n    </div>" +
      "\n  </div>";

    if (state.error) {
      html += '\n  <div class="error">' + escapeHtml(state.error) + "</div>";
    }

    html += '\n  <div style="height:8px"></div>';

    if (highlight.length) {
      html += highlight.map(function (d) { return rowHTML(d, true); }).join("");
    }

    if (rest.length) {
      html += rest.map(function (d) { return rowHTML(d, false); }).join("");
    }

    if (!dep.length && !state.error) {
      html += '\n  <div class="empty">No upcoming departures</div>';
    }

    html +=
      '\n  <div style="height:10px"></div>' +
      '\n  <div class="grid2 panel">' +
      '\n    <div><span style="opacity:.7">Stop</span>: ' +
      escapeHtml(cfg.stopId) +
      '<br><span style="opacity:.7">Refresh</span>: ' +
      escapeHtml(String(cfg.refreshSeconds)) +
      "s</div>" +
      '\n    <div style="text-align:right"><span style="opacity:.7">Updated</span>: ' +
      (state.lastOk ? escapeHtml(fmtTime(state.lastOk)) : "—") +
      '<br><span style="opacity:.7">Rows</span>: ' +
      escapeHtml(String(cfg.maxRows)) +
      "</div>" +
      "\n  </div>" +
      '\n  <div class="footer">Tip: keep screen on & hide system bars for a clean kiosk look.</div>' +
      "\n</div>";

    app.innerHTML = html;
  }

  function load() {
    fetchDepartures(
      cfg,
      function (data) {
        // Filter/sort by soonest, ignore far past
        var nowTs = new Date().getTime();
        var list = [];

        for (var i = 0; i < data.length; i++) {
          var ts = new Date(data[i].departureTimeISO).getTime();
          if (!isNaN(ts) && ts > nowTs - 60000) {
            list.push({
              line: String(data[i].line),
              destination: String(data[i].destination),
              departureTimeISO: data[i].departureTimeISO,
              _ts: ts,
            });
          }
        }

        list.sort(function (a, b) { return a._ts - b._ts; });
        list = list.slice(0, cfg.maxRows);

        state.departures = list;
        state.lastOk = new Date();
        state.error = "";
        render();
      },
      function (err) {
        state.error = (err && err.message) ? err.message : "Failed to load";
        render();
      }
    );
  }

  // Start
  render();
  load();

  // Update clock each second (for countdown)
  setInterval(function () {
    state.now = new Date();
    render();
  }, 1000);

  // Poll API on interval
  setInterval(load, Math.max(5, cfg.refreshSeconds) * 1000);
})();
