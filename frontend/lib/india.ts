// Coarse outline of mainland India as [lat, lng]. Used to reject report locations in the sea or
// in neighbouring countries. Keep in sync with functions/tools/india.ts.
const OUTLINE: [number, number][] = [
  // Pakistan border, Kutch -> Punjab -> Jammu & Kashmir
  [23.9, 68.1], [24.7, 71.1], [26.0, 70.1], [26.9, 69.5], [27.7, 70.2], [28.4, 71.7], [29.3, 73.0],
  [29.9, 74.0], [30.9, 74.6], [31.6, 74.5], [32.5, 75.2], [32.8, 74.6], [33.4, 74.0], [34.8, 74.0],
  [35.5, 74.6], [35.8, 76.5], [35.5, 77.8], [34.6, 78.6], [33.6, 78.7], [32.7, 79.5], [31.5, 78.7],
  [30.5, 79.9], [30.1, 80.2],
  // Nepal / Bhutan / Bangladesh / Myanmar borders
  [28.7, 80.4], [28.0, 81.7], [27.5, 82.4], [27.2, 83.5], [27.3, 84.4], [26.5, 86.5], [26.4, 88.1],
  [27.0, 88.0], [27.9, 88.0], [28.1, 88.5], [27.7, 88.9], [27.1, 88.9], [26.9, 89.0], [26.8, 89.9], [27.3, 91.5], [28.3, 91.8], [29.3, 94.0], [28.5, 96.0],
  [29.4, 97.4], [27.5, 97.3], [26.0, 95.2], [24.0, 94.7], [22.0, 93.3], [22.9, 92.3], [24.6, 92.2],
  [25.2, 91.5], [25.2, 89.9], [26.0, 89.7], [25.3, 88.6], [24.1, 88.3], [23.0, 88.9], [21.6, 88.7],
  // East coast, north -> south
  [21.5, 87.0], [20.3, 86.7], [19.4, 85.1], [18.2, 84.2], [17.0, 82.3], [15.8, 81.2], [15.9, 80.4],
  [14.5, 80.2], [13.3, 80.3], [12.0, 79.9], [11.2, 79.8], [10.3, 79.9], [9.3, 79.3], [8.5, 78.1],
  [8.1, 77.5],
  // West coast, south -> north
  [8.4, 76.9], [9.5, 76.3], [10.5, 75.9], [11.8, 75.3], [12.9, 74.8], [14.4, 74.3], [15.4, 73.8],
  [17.5, 73.1], [18.9, 72.8], [20.4, 72.8], [21.1, 72.7], [21.7, 72.6], [22.3, 72.5], [21.8, 72.2],
  [20.7, 71.0], [20.9, 70.4], [21.6, 69.6], [22.2, 68.9], [22.5, 69.0], [22.6, 70.0], [23.0, 70.2],
  [22.8, 69.7], [23.3, 68.6],
];

// Island groups (rough boxes): Andaman & Nicobar, Lakshadweep.
const ISLANDS: [number, number, number, number][] = [
  [6.5, 92.0, 14.0, 94.5],
  [8.0, 71.5, 12.5, 74.0],
];

const TOLERANCE_DEG = 0.2; // ~22 km, so coastal farms aren't rejected by the coarse outline

function inPolygon(lat: number, lng: number): boolean {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [yi, xi] = OUTLINE[i];
    const [yj, xj] = OUTLINE[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(lat: number, lng: number, [ay, ax]: [number, number], [by, bx]: [number, number]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((lng - ax) * dx + (lat - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(lng - (ax + t * dx), lat - (ay + t * dy));
}

export function inIndia(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (ISLANDS.some(([s, w, n, e]) => lat >= s && lat <= n && lng >= w && lng <= e)) return true;
  if (inPolygon(lat, lng)) return true;
  return OUTLINE.some((p, i) => distToSegment(lat, lng, p, OUTLINE[(i + 1) % OUTLINE.length]) <= TOLERANCE_DEG);
}
