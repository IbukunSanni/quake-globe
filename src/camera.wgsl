// The camera, shared by every shader on the page and rewritten whenever it
// moves. Its axes are in the world and of unit length. The CPU packs the
// fields in this order; each vec3f takes 16 bytes, so the f32 after it fills
// the gap.
struct Camera {
  eye: vec3f,              // its position
  tanHalfFovY: f32,        // the view's half-height at distance 1
  right: vec3f,
  aspect: f32,             // canvas width / height
  up: vec3f,
  pixelRatio: f32,         // device pixels per CSS pixel
  forward: vec3f,          // where it looks
  worldToClip: mat4x4f,    // for anything drawn as triangles or lines
  viewport: vec2f,         // the canvas in device pixels
}
@group(0) @binding(0) var<uniform> camera: Camera;
