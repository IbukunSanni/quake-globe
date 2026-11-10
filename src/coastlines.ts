import { toUnitSphere } from './geo.ts';

type LonLat = [number, number];

// Natural Earth's coastlines: GeoJSON features whose geometry is a LineString
// or, rarely, a MultiLineString, each line a run of [longitude, latitude]
// points.
interface CoastFeature {
  geometry:
    | { type: 'LineString'; coordinates: LonLat[] }
    | { type: 'MultiLineString'; coordinates: LonLat[][] };
}

// Every line cut into separate segments, both ends of each on the unit
// sphere, for a 'line-list' draw: six floats per segment.
export async function loadCoastlines(url: string): Promise<Float32Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`the coastlines answered HTTP ${response.status}`);
  const geojson = (await response.json()) as { features: CoastFeature[] };
  const segments: number[] = [];
  for (const { geometry } of geojson.features) {
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        segments.push(...toUnitSphere(...line[i - 1]), ...toUnitSphere(...line[i]));
      }
    }
  }
  return new Float32Array(segments);
}
