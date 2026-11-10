import { vec3, type Vec3 } from 'wgpu-matrix';

// Latitude and longitude, in degrees, to a point on the unit sphere. y runs
// through the North Pole, z through (0°, 0°) and x through (0°, 90° E), so
// seen from +z north is up and east is right, as on a map. Going back:
// lat = asin(y), lon = atan2(x, z).
//
// A sphere, not the WGS 84 ellipsoid: the polar radius is 0.3% shorter than
// the equatorial one, less than a pixel with the whole globe in view, and on a
// sphere geodetic and geocentric latitude are the same thing.
export function toUnitSphere(lonDeg: number, latDeg: number): Vec3 {
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  return vec3.create(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
}
