import './style.css';
import { mat4, vec3 } from 'wgpu-matrix';
import cameraShader from './camera.wgsl?raw';
import coastShader from './coastlines.wgsl?raw';
import globeShader from './globe.wgsl?raw';
import quakeShader from './quakes.wgsl?raw';
import { loadCoastlines } from './coastlines.ts';
import { toUnitSphere } from './geo.ts';
import { floatsPerQuake, loadQuakes } from './quakes.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#globe')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const summary = document.querySelector<HTMLParagraphElement>('#summary')!;

// Every way the page can fail ends here: one message, centred, instead of a
// blank page.
function fail(message: string): void {
  status.textContent = message;
  status.classList.add('error');
}

const fovY = Math.PI / 4; // the camera's view, top to bottom: 45 degrees

// What the visitor controls: the point on the globe the camera hovers over,
// in degrees, and the zoom, where 2 halves the camera's height above the
// ground. It starts over the western Pacific, the busiest part of the Ring of
// Fire.
const view = { lat: 10, lon: 170, zoom: 1 };

// Latitude stays inside ±85 degrees, so looking straight down never lines up
// with north and the camera's right is always defined.
const maxLat = 85;

// How far from the centre the camera sits for a sphere of radius 1.1, the
// globe with a margin, to just fit: the sphere touches the edges of the view
// when sin(half the view's angle) = 1.1 / distance, taking the narrower of the
// vertical and horizontal angles.
function fitDistance(aspect: number): number {
  const halfY = fovY / 2;
  const halfX = Math.atan(aspect * Math.tan(halfY));
  return 1.1 / Math.sin(Math.min(halfX, halfY));
}

function cameraDistance(aspect: number): number {
  return 1 + (fitDistance(aspect) - 1) / view.zoom;
}

// The camera as the shaders read it: above (lat, lon), looking at the centre,
// with north up the screen. right = forward × north, and up completes the
// frame.
function cameraUniforms(width: number, height: number): Float32Array {
  const aspect = width / height;
  const distance = cameraDistance(aspect);
  const eye = vec3.scale(toUnitSphere(view.lon, view.lat), distance);
  const forward = vec3.normalize(vec3.negate(eye));
  const right = vec3.normalize(vec3.cross(forward, [0, 1, 0]));
  const up = vec3.cross(right, forward);
  // Everything drawn lies on the globe, so depth runs from its near side to
  // its far side; zoomed in close, the near plane stays a little in front of
  // the camera.
  const projection = mat4.perspective(fovY, aspect, Math.max(distance - 1.01, 0.01), distance + 1.01);
  const worldToClip = mat4.multiply(projection, mat4.lookAt(eye, [0, 0, 0], [0, 1, 0]));

  const out = new Float32Array(36);
  out.set([...eye, Math.tan(fovY / 2), ...right, aspect, ...up, window.devicePixelRatio, ...forward, 0], 0);
  out.set(worldToClip, 16);
  out.set([width, height], 32);
  return out;
}

// Drag to turn the globe; wheel, or pinch on a trackpad, to zoom. Pointer
// events cover a mouse, a pen and one finger alike.
function listenForInput(requestRender: () => void): void {
  let dragging: number | null = null; // the pointer turning the globe
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId); // keep the moves even off the canvas
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragging) return;
    // The ground below the camera that one pixel covers, in degrees of arc:
    // the pixel's angle seen from the camera times the camera's height. With
    // that, the ground under the pointer follows it at any zoom.
    const altitude = cameraDistance(canvas.clientWidth / canvas.clientHeight) - 1;
    const degreesPerPixel = ((2 * Math.tan(fovY / 2) * altitude) / canvas.clientHeight) * (180 / Math.PI);
    // Pulling the ground right moves the camera west; pulling it down moves
    // the camera north. A degree of longitude is cos(lat) as long as one of
    // latitude, so the camera takes more of them near the poles.
    const cosLat = Math.max(Math.cos((view.lat * Math.PI) / 180), 0.2);
    view.lon -= ((e.clientX - lastX) * degreesPerPixel) / cosLat;
    view.lon = ((((view.lon + 180) % 360) + 360) % 360) - 180; // back into [-180, 180)
    view.lat = Math.max(-maxLat, Math.min(maxLat, view.lat + (e.clientY - lastY) * degreesPerPixel));
    lastX = e.clientX;
    lastY = e.clientY;
    requestRender();
  });
  const release = (e: PointerEvent): void => {
    if (e.pointerId === dragging) dragging = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  // A trackpad pinch arrives as a wheel event with ctrlKey set, and the
  // browser would zoom the page unless the event is cancelled, which a
  // passive listener cannot do. At the closest zoom, 40, the camera is about
  // 300 km above the ground.
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.zoom = Math.max(0.7, Math.min(40, view.zoom * Math.exp(-e.deltaY * 0.001)));
    requestRender();
  }, { passive: false });
}

async function main(): Promise<void> {
  if (!navigator.gpu) {
    fail('This globe needs WebGPU, which this browser does not have. Try a recent Chrome or Edge.');
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    fail('WebGPU is available, but no GPU adapter was found.');
    return;
  }
  const device = await adapter.requestDevice();
  void device.lost.then((info) => {
    fail(`GPU device lost: ${info.message}`);
  });
  const context = canvas.getContext('webgpu');
  if (!context) {
    fail('Could not get a WebGPU context for the canvas.');
    return;
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  // Started now, so the downloads overlap each other and the GPU setup below.
  status.textContent = 'Loading earthquakes from USGS…';
  const quakesLoading = loadQuakes();
  const coastLoading = loadCoastlines(`${import.meta.env.BASE_URL}data/coastlines.geojson`);

  // Lines and dots both blend their antialiased edges over what is already
  // drawn, with colours premultiplied by alpha.
  const blend: GPUBlendState = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  };

  // The globe's pipeline reads no vertex buffers: its vertex shader makes the
  // one triangle that covers the screen.
  const globeModule = device.createShaderModule({ code: cameraShader + globeShader });
  const globePipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: globeModule, entryPoint: 'vs' },
    fragment: { module: globeModule, entryPoint: 'fs', targets: [{ format }] },
  });

  // The coastlines' pipeline reads one point per vertex, 12 bytes each, and
  // joins them in pairs into separate one-pixel lines.
  const coastModule = device.createShaderModule({ code: cameraShader + coastShader });
  const coastPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: coastModule,
      entryPoint: 'vs',
      buffers: [{ arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }],
    },
    fragment: { module: coastModule, entryPoint: 'fs', targets: [{ format, blend }] },
    primitive: { topology: 'line-list' },
  });

  // The earthquakes' pipeline steps through the instance buffer once per
  // earthquake: the position to @location(0), the magnitude and depth to
  // @location(1). Its vertex shader makes each dot's corners.
  const quakeModule = device.createShaderModule({ code: cameraShader + quakeShader });
  const quakePipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: quakeModule,
      entryPoint: 'vs',
      buffers: [{
        arrayStride: floatsPerQuake * 4,
        stepMode: 'instance',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 3 * 4, format: 'float32x2' },
        ],
      }],
    },
    fragment: { module: quakeModule, entryPoint: 'fs', targets: [{ format, blend }] },
  });

  // The camera, 136 bytes of fields rounded up to the struct's 16-byte
  // alignment. One buffer serves both pipelines, but with layout 'auto' each
  // pipeline needs its own bind group pointing at it.
  const uniforms = device.createBuffer({
    size: 144,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bindCamera = (pipeline: GPURenderPipeline): GPUBindGroup => device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniforms } }],
  });
  const globeBindGroup = bindCamera(globePipeline);
  const coastBindGroup = bindCamera(coastPipeline);
  const quakeBindGroup = bindCamera(quakePipeline);

  // Copies data the GPU will read as vertices, once.
  const vertexBuffer = (data: Float32Array): GPUBuffer => {
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  };

  // Each arrives when its download does.
  let coast: { buffer: GPUBuffer; vertexCount: number } | null = null;
  let quakes: { buffer: GPUBuffer; count: number } | null = null;

  // The globe first, then the coastlines, then the dots over both. Nothing
  // needs a depth buffer: the globe is one convex surface, and the lines and
  // dots hide their own far side.
  const render = (): void => {
    device.queue.writeBuffer(uniforms, 0, cameraUniforms(canvas.width, canvas.height));
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(globePipeline);
    pass.setBindGroup(0, globeBindGroup);
    pass.draw(3); // one triangle
    if (coast) {
      pass.setPipeline(coastPipeline);
      pass.setBindGroup(0, coastBindGroup);
      pass.setVertexBuffer(0, coast.buffer);
      pass.draw(coast.vertexCount); // two vertices per line
    }
    if (quakes) {
      pass.setPipeline(quakePipeline);
      pass.setBindGroup(0, quakeBindGroup);
      pass.setVertexBuffer(0, quakes.buffer);
      pass.draw(6, quakes.count); // two triangles per earthquake
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
  };

  // Nothing moves on its own, so a frame is drawn only when something
  // changes, at most once per screen refresh however many events arrive.
  let pending = false;
  const requestRender = (): void => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      render();
    });
  };

  // Keep the drawing buffer at the canvas's real pixel size, so the image
  // stays sharp and undistorted. Resizing clears the canvas, so draw again.
  const maxSize = device.limits.maxTextureDimension2D;
  new ResizeObserver(() => {
    const dpr = window.devicePixelRatio;
    canvas.width = Math.max(1, Math.min(Math.round(canvas.clientWidth * dpr), maxSize));
    canvas.height = Math.max(1, Math.min(Math.round(canvas.clientHeight * dpr), maxSize));
    render();
  }).observe(canvas);

  listenForInput(requestRender);

  // The globe is already up and turning; the coastlines and the dots join it
  // as they arrive. A failed download leaves the rest and says why.
  void coastLoading.then((segments) => {
    coast = { buffer: vertexBuffer(segments), vertexCount: segments.length / 3 };
    requestRender();
  }).catch((err: unknown) => {
    console.error('Could not load the coastlines:', err);
  });
  try {
    const loaded = await quakesLoading;
    quakes = { buffer: vertexBuffer(loaded.instances), count: loaded.count };
    status.textContent = '';
    summary.textContent = `${loaded.count.toLocaleString()} earthquakes of magnitude 2.5 or more · `
      + `largest M${loaded.largest.mag.toFixed(1)}, ${loaded.largest.place}`;
    requestRender();
  } catch (err: unknown) {
    status.textContent = `Could not load earthquakes: ${err instanceof Error ? err.message : String(err)}`;
  }
}

main().catch((err: unknown) => {
  fail(`The globe failed to start: ${err instanceof Error ? err.message : String(err)}`);
});
