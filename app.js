const REGION_BOUNDS = L.latLngBounds([42.48, 0.00], [43.35, 1.65]);
const SCORE_FIELDS = [
  ["beaute", "Beauté"],
  ["fraicheur", "Fraîcheur"],
  ["tranquillite", "Tranquillité"],
  ["baignabilite", "Baignabilité"],
  ["facilite_acces", "Facilité d’accès"],
  ["compatibilite_enfants", "Compatibilité enfants"]
];
const SCORE_COLORS = [
  "#e8f3fb",
  "#cfe6f6",
  "#acd4ed",
  "#82bee2",
  "#559fd0",
  "#2f7eb8",
  "#145b91",
  "#08345f"
];

const map = L.map("map", {
  minZoom: 8,
  maxZoom: 18,
  maxBounds: REGION_BOUNDS.pad(0.18),
  maxBoundsViscosity: 0.7
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const detailPanel = document.getElementById("detail-panel");
const resultCount = document.getElementById("result-count");
const resetButton = document.getElementById("reset-filters");
let markers = [];
let selectedFeatureId = null;
let scoreToColorIndex = new Map();

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function totalScore(feature) {
  return SCORE_FIELDS.reduce((sum, [field]) => sum + Number(feature.properties[field] || 0), 0);
}

function buildScoreColorScale(features) {
  const scores = features.map(totalScore).sort((a, b) => a - b);
  scoreToColorIndex = new Map();

  if (scores.length === 0) return;
  if (scores.length === 1) {
    scoreToColorIndex.set(scores[0], 4);
    return;
  }

  const uniqueScores = [...new Set(scores)];
  uniqueScores.forEach(score => {
    const positions = scores
      .map((value, index) => value === score ? index : -1)
      .filter(index => index >= 0);
    const averageRank = positions.reduce((sum, index) => sum + index, 0) / positions.length;
    const percentile = averageRank / (scores.length - 1);
    const colorIndex = Math.max(0, Math.min(7, Math.floor(percentile * 8)));
    scoreToColorIndex.set(score, colorIndex);
  });
}

function markerIcon(feature) {
  const score = totalScore(feature);
  const colorIndex = scoreToColorIndex.get(score) ?? 0;
  const color = SCORE_COLORS[colorIndex];
  return L.divIcon({
    className: "",
    html: `<div class="custom-marker" style="background:${color}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

function scoreRow(label, value) {
  const safe = Math.max(1, Math.min(4, Number(value) || 1));
  return `<div class="score"><span>${escapeHtml(label)}</span><span class="score-bar"><span style="width:${safe * 25}%"></span></span><span class="score-value">${safe}/4</span></div>`;
}

function renderDetail(feature) {
  const p = feature.properties;
  detailPanel.innerHTML = `<article>
    <header class="place-header"><h2>${escapeHtml(p.nom)}</h2></header>
    <section class="scores" aria-label="Notes du lieu">${SCORE_FIELDS.map(([field, label]) => scoreRow(label, p[field])).join("")}</section>
    <div class="place-description">${String(p.commentaire || "").split(/\n\s*\n/).filter(Boolean).map(paragraph => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("")}</div>
  </article>`;
}

function currentFilters() {
  return Object.fromEntries(SCORE_FIELDS.map(([field]) => [field, Number(document.getElementById(field).value)]));
}

function featureMatches(feature, filters) {
  return SCORE_FIELDS.every(([field]) => Number(feature.properties[field] || 0) >= filters[field]);
}

function updateFilters() {
  const filters = currentFilters();
  let visible = 0;
  let selectedStillVisible = false;

  markers.forEach(({ feature, marker }) => {
    const matches = featureMatches(feature, filters);
    if (matches) {
      if (!map.hasLayer(marker)) marker.addTo(map);
      visible++;
      if (feature.properties.id === selectedFeatureId) selectedStillVisible = true;
    } else if (map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  });

  resultCount.textContent = `${visible} lieu${visible > 1 ? "x" : ""} affiché${visible > 1 ? "s" : ""}`;
  SCORE_FIELDS.forEach(([field]) => {
    document.getElementById(`${field}-value`).textContent = `${document.getElementById(field).value}+`;
  });

  if (selectedFeatureId && !selectedStillVisible) {
    selectedFeatureId = null;
    detailPanel.innerHTML = `<div class="empty-state"><h2>Le lieu sélectionné est masqué</h2><p>Assouplissez un critère ou choisissez un autre point encore visible sur la carte.</p></div>`;
  }
}

function resetFilters() {
  SCORE_FIELDS.forEach(([field]) => {
    document.getElementById(field).value = 1;
  });
  updateFilters();
}

function addFeature(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const marker = L.marker([lat, lng], {
    icon: markerIcon(feature),
    title: feature.properties.nom
  });
  marker.bindTooltip(escapeHtml(feature.properties.nom), {
    direction: "top",
    offset: [0, -9],
    opacity: .92
  });
  marker.on("click", () => {
    selectedFeatureId = feature.properties.id;
    renderDetail(feature);
  });
  marker.addTo(map);
  markers.push({ feature, marker });
}

function fitMapToFeatures(features) {
  const points = features
    .filter(feature => feature?.geometry?.type === "Point")
    .map(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      return [lat, lng];
    });

  if (points.length === 0) {
    map.setView([42.95, 0.75], 9);
    return;
  }

  if (points.length === 1) {
    map.setView(points[0], 12);
    return;
  }

  map.fitBounds(L.latLngBounds(points), {
    padding: [18, 18],
    maxZoom: 13
  });
}

fetch("data/baignades.geojson")
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(g => {
    const features = g.features || [];
    buildScoreColorScale(features);
    features.forEach(addFeature);
    fitMapToFeatures(features);
    updateFilters();
  })
  .catch(error => {
    console.error(error);
    resultCount.textContent = "Erreur de chargement";
    detailPanel.innerHTML = `<div class="empty-state"><h2>Les données n’ont pas pu être chargées</h2><p>Lancez le site avec <code>python -m http.server 8000</code>, après avoir exécuté <code>python construire.py</code>.</p></div>`;
  });

document.querySelectorAll(".filters input").forEach(input => {
  input.addEventListener("input", updateFilters);
  input.addEventListener("change", updateFilters);
});
resetButton.addEventListener("click", resetFilters);
