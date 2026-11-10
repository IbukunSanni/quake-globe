import { vec3, type Mat4, type Vec3 } from 'wgpu-matrix';
import { floatsPerQuake } from './quakes.ts';

// How close the pointer must come to a dot's centre, in CSS pixels: its
// radius plus a margin, and never under 6, so a dot a few pixels wide is
// still easy to land on.
function reachCss(radiusCss: number): number {
  return Math.max(radiusCss + 2, 6);
}

const ndc = vec3.create(); // reused for every dot, so a pointer move allocates nothing

// The index of the earthquake under the pointer, or -1 for none, among the
// dots on the camera's side of the globe. What the visitor sees wins: if the
// pointer is on one or more dots, the one drawn last, which is on top. Only
// if it is on none, the dot whose centre is nearest and within reach.
//
// Trap: the nearest centre alone is not what is seen. An aftershock a few km
// from a large earthquake sits hidden under the large dot, its centre can be
// the nearer one, and the tooltip would describe a dot nobody can see.
export function pick(
  instances: Float32Array,
  count: number,
  worldToClip: Mat4,
  eye: Vec3,
  pointerX: number, // CSS pixels from the canvas's left edge
  pointerY: number, // and from its top edge
  width: number,    // the canvas in CSS pixels
  height: number,
): number {
  let top = -1;     // the last dot drawn whose disc holds the pointer
  let nearest = -1; // the dot with the nearest centre within reach
  let nearestDistanceSq = Infinity;
  for (let i = 0; i < count; i++) {
    const p = instances.subarray(i * floatsPerQuake, i * floatsPerQuake + 3);
    // Behind the horizon: for a point on the unit sphere, dot(p, eye - p) > 0
    // is dot(p, eye) > 1. The small margin skips dots already faded out.
    if (vec3.dot(p, eye) < 1.02) continue;
    // To normalized device coordinates (x and y from -1 to 1, y up), then to
    // CSS pixels from the top-left.
    vec3.transformMat4(p, worldToClip, ndc);
    const dx = ((ndc[0] + 1) / 2) * width - pointerX;
    const dy = ((1 - ndc[1]) / 2) * height - pointerY;
    const distanceSq = dx * dx + dy * dy;
    const radius = instances[i * floatsPerQuake + 3];
    if (distanceSq <= radius * radius) top = i; // dots are drawn in index order
    const reach = reachCss(radius);
    if (distanceSq <= reach * reach && distanceSq < nearestDistanceSq) {
      nearest = i;
      nearestDistanceSq = distanceSq;
    }
  }
  return top >= 0 ? top : nearest;
}
