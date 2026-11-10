import { toUnitSphere } from './geo.ts';

// Every earthquake of magnitude 2.5 or more in the past 30 days, as GeoJSON:
// one Point feature per event, its coordinates [longitude, latitude, depth in
// km]. USGS regenerates it every minute and serves it to any origin.
const feedUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson';

interface QuakeFeature {
  geometry: { coordinates: [number, number, number] };
  properties: { mag: number | null; place: string; time: number; type: string; url: string };
}

// A dot's radius in CSS pixels: 2.5 at M2.5, 1.5 times larger per whole
// magnitude. A magnitude step releases about 32 times the energy, so this is
// a readable ranking, not a physical scale. Worked out here once, so the
// drawing and the hit test use the same size.
export function dotRadiusCss(magnitude: number): number {
  return 2.5 * Math.pow(1.5, magnitude - 2.5);
}

// What the GPU reads per earthquake: x, y, z on the unit sphere, then the
// dot's radius in CSS pixels and the depth in km.
export const floatsPerQuake = 5;

// What the page shows about an earthquake.
export interface Quake {
  mag: number;
  place: string;
  depthKm: number;
  time: number; // milliseconds since 1970, UTC
  url: string;  // its USGS event page
}

export interface Quakes {
  instances: Float32Array; // floatsPerQuake floats per earthquake, smallest magnitude first
  records: Quake[];        // the same earthquakes in the same order
  count: number;
}

export async function loadQuakes(): Promise<Quakes> {
  const response = await fetch(feedUrl);
  if (!response.ok) throw new Error(`the USGS feed answered HTTP ${response.status}`);
  const feed = (await response.json()) as { features: QuakeFeature[] };
  // The feed also lists quarry blasts, explosions and landslides, and an event
  // can arrive before its magnitude is known.
  const quakes = feed.features.filter((f) => f.properties.type === 'earthquake' && f.properties.mag !== null);
  if (quakes.length === 0) throw new Error('the USGS feed listed no earthquakes');
  // Smallest first, so the largest are drawn last, on top of their neighbours.
  quakes.sort((a, b) => a.properties.mag! - b.properties.mag!);

  const instances = new Float32Array(quakes.length * floatsPerQuake);
  const records = quakes.map((quake, i): Quake => {
    const [lon, lat, depthKm] = quake.geometry.coordinates;
    const { mag, place, time, url } = quake.properties;
    instances.set([...toUnitSphere(lon, lat), dotRadiusCss(mag!), depthKm], i * floatsPerQuake);
    return { mag: mag!, place, depthKm, time, url };
  });
  return { instances, records, count: quakes.length };
}
