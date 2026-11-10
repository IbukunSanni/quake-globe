// The globe, ray-cast per pixel. One triangle covers the screen, and each
// pixel's fragment shader shoots its own ray at the unit sphere, as a CPU ray
// tracer does. The silhouette is exact at any zoom and there is no mesh.

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) ndc: vec2f, // where on the screen: -1 to 1, left to right and bottom to top
}

// Corners (-1,-1), (3,-1) and (-1,3): one triangle that covers the square
// from -1 to 1 with room to spare, so no diagonal seam crosses the globe.
@vertex
fn vs(@builtin(vertex_index) i: u32) -> VertexOut {
  let ndc = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var out: VertexOut;
  out.position = vec4f(ndc, 0.0, 1.0);
  out.ndc = ndc;
  return out;
}

const background = vec3f(0.02, 0.024, 0.04);
const ocean = vec3f(0.07, 0.17, 0.32);
const gridColor = vec3f(0.4, 0.55, 0.75);

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  // The ray through this pixel from a pinhole camera.
  let eye = camera.eye;
  let dir = normalize(camera.forward
      + in.ndc.x * camera.tanHalfFovY * camera.aspect * camera.right
      + in.ndc.y * camera.tanHalfFovY * camera.up);

  // Where it meets the unit sphere: |eye + t dir|² = 1. With dir of unit
  // length that is t² + 2bt + c = 0, with b = dot(eye, dir), c = |eye|² - 1.
  //
  // Trap: fwidth below compares values with neighbouring pixels, so WGSL only
  // allows it where every pixel runs the same code. A ray that misses must not
  // return early; it computes everything and is blended out at the end.
  let b = dot(eye, dir);
  let c = dot(eye, eye) - 1.0;
  let discriminant = b * b - c;
  let t = -b - sqrt(max(discriminant, 0.0)); // the nearer root: the camera is outside the sphere
  let p = eye + t * dir; // on the unit sphere a point is also its own normal

  // Back from the point to latitude and longitude. y runs through the North
  // Pole, z through (0°, 0°) and x through (0°, 90° E), so seen from +z north
  // is up and east is right, as on a map.
  let lat = asin(clamp(p.y, -1.0, 1.0));
  let lon = atan2(p.x, p.z);

  // The graticule: a line every 30 degrees of latitude and longitude. Each
  // distance is an arc on the sphere; a degree of longitude shrinks by cos(lat)
  // towards the poles, where the meridians stop before they crowd together.
  let step = radians(30.0);
  let toParallel = abs(lat - round(lat / step) * step);
  let toMeridian = cos(lat) * abs(lon - round(lon / step) * step);
  let toLine = min(toParallel, select(1.0, toMeridian, abs(lat) < radians(80.0)));
  let pixel = length(fwidth(p)); // how much sphere one pixel spans here
  let facing = dot(p, -dir); // 1 facing the camera, 0 edge-on
  let line = (1.0 - smoothstep(0.0, pixel, toLine)) * smoothstep(0.0, 0.3, facing);

  // Lambert's cosine law, plus an ambient floor so the side away from the
  // light is not black. The light rides with the camera, above, to the left
  // and behind it, so whatever side the visitor turns to is lit.
  let toLight = normalize(-0.4 * camera.right + 0.45 * camera.up - 0.8 * camera.forward);
  let lambert = max(dot(p, toLight), 0.0);
  let surface = mix(ocean * (0.3 + 0.7 * lambert), gridColor, 0.3 * line);

  // Antialiased edge: how far inside the silhouette this pixel is, in pixels.
  // closest is the ray's nearest approach to the centre; the edge is where it is 1.
  let closest = sqrt(max(dot(eye, eye) - b * b, 0.0));
  let coverage = clamp((1.0 - closest) / max(fwidth(closest), 1e-6) + 0.5, 0.0, 1.0);

  return vec4f(mix(background, surface, coverage), 1.0);
}
