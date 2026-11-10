// Each earthquake is a square facing the screen, cut to a disc. Drawn
// instanced: the same six corners, two triangles, once per earthquake.

struct DotOut {
  @builtin(position) position: vec4f,
  @location(0) offsetPx: vec2f, // from the dot's centre, in device pixels
  @location(1) radiusPx: f32,
  @location(2) color: vec3f,
  @location(3) facing: f32,     // above 0 on the camera's side of the globe
}

// Radius in CSS pixels: 2.5 at M2.5, 1.5 times larger per whole magnitude.
// A magnitude step releases about 32 times the energy, so this is a readable
// ranking, not a physical scale.
fn radiusCssPx(magnitude: f32) -> f32 {
  return 2.5 * pow(1.5, magnitude - 2.5);
}

// Depth on one orange ramp, light to dark: shallow earthquakes (to 70 km)
// pale, intermediate ones (70 to 300 km) in the middle, deep ones (300 to
// 700 km) dark. Each class gets a third of the ramp, because most earthquakes
// are shallow and a straight scale to 700 km would paint them all alike. The
// darkest step still stands out from the ocean at 3.3:1.
const depth0 = vec3f(1.0, 0.867, 0.655);    // #ffdda7, 0 km
const depth70 = vec3f(1.0, 0.671, 0.333);   // #ffab55, 70 km
const depth300 = vec3f(0.945, 0.49, 0.141); // #f17d24, 300 km
const depth700 = vec3f(0.808, 0.337, 0.0);  // #ce5600, 700 km

fn depthColor(km: f32) -> vec3f {
  let d = clamp(km, 0.0, 700.0); // a few events sit just above sea level
  if (d < 70.0) {
    return mix(depth0, depth70, d / 70.0);
  }
  if (d < 300.0) {
    return mix(depth70, depth300, (d - 70.0) / 230.0);
  }
  return mix(depth300, depth700, (d - 300.0) / 400.0);
}

// The ring around each dot, the dark of the ocean, so that overlapping dots
// stay apart.
const ringColor = vec3f(0.03, 0.08, 0.16);

@vertex
fn vs(
  @builtin(vertex_index) v: u32,
  @location(0) center: vec3f,
  @location(1) magnitudeDepth: vec2f,
) -> DotOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
    vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0),
  );
  let radiusPx = radiusCssPx(magnitudeDepth.x) * camera.pixelRatio;
  // One pixel beyond the radius, room for the antialiased edge.
  let offsetPx = corners[v] * (radiusPx + 1.0);

  var clip = camera.worldToClip * vec4f(center, 1.0);
  // After the GPU divides by w, the viewport spans 2 in x and y, so one pixel
  // is 2 / viewport there; scaling by w now cancels that divide, which keeps
  // the dot the same size at any distance.
  clip += vec4f(offsetPx * 2.0 / camera.viewport * clip.w, 0.0, 0.0);

  var out: DotOut;
  out.position = clip;
  out.offsetPx = offsetPx;
  out.radiusPx = radiusPx;
  out.color = depthColor(magnitudeDepth.y);
  // A point on the unit sphere is on the near side when the camera is above
  // its horizon: the direction to the camera and the point's normal, which is
  // the point itself, make an angle under 90 degrees.
  out.facing = dot(center, normalize(camera.eye - center));
  return out;
}

// Blended premultiplied: the colour leaves the shader already scaled by alpha.
@fragment
fn fs(in: DotOut) -> @location(0) vec4f {
  let r = length(in.offsetPx);
  // Coverage falls from 1 to 0 across the edge's last pixel.
  let coverage = clamp(in.radiusPx - r + 0.5, 0.0, 1.0);
  // The ring is 1.5 CSS pixels wide, on dots large enough to spare it.
  let ringPx = select(0.0, 1.5 * camera.pixelRatio, in.radiusPx >= 4.0 * camera.pixelRatio);
  let fill = clamp(in.radiusPx - ringPx - r + 0.5, 0.0, 1.0);
  // Dots fade out over the last few degrees before the horizon instead of
  // vanishing at it.
  let alpha = coverage * smoothstep(0.0, 0.08, in.facing);
  if (alpha <= 0.0) {
    discard;
  }
  return vec4f(mix(ringColor, in.color, fill) * alpha, alpha);
}
