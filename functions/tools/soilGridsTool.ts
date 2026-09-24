export interface SoilHealth {
  organicCarbon: number; // g/kg, 0-5cm depth
  ph: number; // pH in water, 0-5cm depth
  source: string;
}

const TIMEOUT_MS = 20_000; // SoilGrids latency is variable (seen ~0.7s to 15s+ across real test calls)
const DEPTH = "0-5cm";

interface Layer {
  name: string;
  unit_measure: { d_factor: number };
  depths: { label: string; values: { mean: number | null } }[];
}

// ISRIC SoilGrids v2.0 REST API (rest.isric.org) — free, no API key, public global soil property
// grids. Values come back as scaled integers (e.g. pH*10, soc in dg/kg) with a d_factor to convert
// back to real units — confirmed against a real call, not assumed from docs (soc mean=270,
// d_factor=10 -> 27.0 g/kg; phh2o mean=69, d_factor=10 -> pH 6.9). Fair-use limited to 5 calls/min,
// which a per-report call comfortably stays under.
export async function getSoilHealth(lat: number, lng: number): Promise<SoilHealth | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&property=soc&property=phh2o&depth=${DEPTH}&value=mean`;
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`SoilGrids ${res.status}`);
    const data: any = await res.json();
    const layers: Layer[] = data?.properties?.layers ?? [];

    const readLayer = (name: string): number | null => {
      const layer = layers.find((l) => l.name === name);
      const depth = layer?.depths.find((d) => d.label === DEPTH);
      const mean = depth?.values?.mean;
      if (mean == null || !layer) return null;
      return mean / (layer.unit_measure?.d_factor || 1);
    };

    const organicCarbon = readLayer("soc");
    const ph = readLayer("phh2o");
    if (organicCarbon == null || ph == null) return null; // e.g. no data at this point (ocean, poles)

    return {
      organicCarbon: Math.round(organicCarbon * 10) / 10,
      ph: Math.round(ph * 10) / 10,
      source: "ISRIC SoilGrids v2.0",
    };
  } catch (err) {
    console.warn("soilgrids lookup failed:", err);
    return null; // never blocks the report — same contract as classifierTool.ts / earthEngineTool.ts
  } finally {
    clearTimeout(timer);
  }
}
