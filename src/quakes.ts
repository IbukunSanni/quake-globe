import { toUnitSphere } from './geo.ts';

// Every earthquake of magnitude 2.5 or more in the past 30 days, as GeoJSON:
// one Point feature per event, its coordinates [longitude, latitude, depth in
// km]. USGS regenerates it every minute and serves it to any origin.
const feedUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson';

interface QuakeFeature {
  geometry: { coordinates: [number, number, number] };
  properties: { mag: number | null; place: string; time: number; type: string };
}

// What the GPU reads per earthquake: x, y, z on the unit sphere, then the
// magnitude and the depth in km.
export const floatsPerQuake = 5;

export interface Quakes {
  instances: Float32Array; // floatsPerQuake floats per earthquake, smallest magnitude first
  count: number;
  largest: { mag: number; place: string };
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
  quakes.forEach((quake, i) => {
    const [lon, lat, depthKm] = quake.geometry.coordinates;
    instances.set([...toUnitSphere(lon, lat), quake.properties.mag!, depthKm], i * floatsPerQuake);
  });
  const top = quakes[quakes.length - 1].properties;
  return { instances, count: quakes.length, largest: { mag: top.mag!, place: top.place } };
}
