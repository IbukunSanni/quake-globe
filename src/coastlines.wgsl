// The coastlines, one-pixel lines between points on the unit sphere.

struct LineOut {
  @builtin(position) position: vec4f,
  @location(0) world: vec3f,
}

@vertex
fn vs(@location(0) position: vec3f) -> LineOut {
  var out: LineOut;
  out.position = camera.worldToClip * vec4f(position, 1.0);
  out.world = position;
  return out;
}

const coastColor = vec3f(0.62, 0.72, 0.85);

// Blended premultiplied: the colour leaves the shader already scaled by alpha.
@fragment
fn fs(in: LineOut) -> @location(0) vec4f {
  // The horizon test, per pixel. Between its ends a segment runs along the
  // chord, a hair inside the sphere, so the point is pushed back out to the
  // surface first.
  let p = normalize(in.world);
  let facing = dot(p, normalize(camera.eye - p));
  let alpha = 0.75 * smoothstep(0.0, 0.08, facing);
  if (alpha <= 0.0) {
    discard;
  }
  return vec4f(coastColor * alpha, alpha);
}
