const REGION_BOUNDS = L.latLngBounds([42.48, 0.00], [43.35, 1.65]);

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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markerIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="prospective-marker"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

function renderDetail(feature) {
  const p = feature.properties;
  detailPanel.innerHTML = `<article>
    <header class="place-header"><h2>${escapeHtml(p.nom)}</h2></header>
    <div class="place-description">${String(p.commentaire || "")
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map(paragraph => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
      .join("")}</div>
  </article>`;
}

function addFeature(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const marker = L.marker([lat, lng], {
    icon: markerIcon(),
    title: feature.properties.nom
  });

  marker.bindTooltip(escapeHtml(feature.properties.nom), {
    direction: "top",
    offset: [0, -9],
    opacity: .92
  });

  marker.on("click", () => renderDetail(feature));
  marker.addTo(map);
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

fetch("data/prospective.geojson")
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(geojson => {
    const features = geojson.features || [];
    features.forEach(addFeature);
    fitMapToFeatures(features);
    resultCount.textContent = `${features.length} lieu${features.length > 1 ? "x" : ""} à prospecter`;
  })
  .catch(error => {
    console.error(error);
    resultCount.textContent = "Erreur de chargement";
    detailPanel.innerHTML = `<div class="empty-state">
      <h2>Les données n’ont pas pu être chargées</h2>
      <p>Exécutez <code>python construire.py</code> avant de publier le site.</p>
    </div>`;
  });
