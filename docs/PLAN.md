# Plan

The globe is the first geospatial visualization project: real data, drawn on
the GPU in the browser, interactive, live on the web. Each piece below ships on
its own and has an exit you can check.

## v0.1: dots on a globe (built 9 Nov)

Live USGS M2.5+ feed for the past 30 days, a ray-cast globe with a graticule,
Natural Earth coastlines, dots sized by magnitude and shaded by depth, and a
drag-and-zoom camera.

**Exit:** live on GitHub Pages, and the README shows a screenshot and says how
it is drawn.

## Piece 2: picking (built 9 Nov)

Hover over a dot to see its place, magnitude, depth and time; click to open
its USGS event page. With 2,000 dots, the simplest version projects each one to
the screen on the CPU and takes the nearest under the pointer. For millions,
the next step is an ID buffer rendered on the GPU.

**Exit:** hovering the largest quake shows the same place and magnitude as its
USGS event page.

**Met 9 Nov.** Hovering the largest dot shows M7.0, 189 km ENE of Nagqu, China,
18 km deep, 22 Oct 2026 14:33 UTC, the same as USGS event `us6000u43g`. The
first version took the nearest centre and showed an M4.6 aftershock hidden
under the M7.0 instead; the hit test now takes the dot drawn on top.

**Left over:** a dot completely covered by a larger one cannot be picked. A
tooltip that lists every earthquake under the pointer would fix that.

## Piece 3: time

Play the 30 days as an animation, with a slider to scrub to any day. Dots
appear at their time and fade over the following days.

**Exit:** scrubbing to a date shows that date's earthquakes and no others.

## Piece 4: under the crust

Place each earthquake at its true depth, at radius 1 − depth / 6,371 km,
inside a translucent globe, so the slabs subducting under Tonga, Japan and
South America show as surfaces of dots (Wadati–Benioff zones). This piece
brings in a depth buffer.

**Exit:** turning the globe edge-on to the Tonga trench shows the slab dipping
to about 650 km.

## Piece 5: scale

Load a year or more of the full catalogue from the USGS FDSN event API,
hundreds of thousands to millions of events, and keep 60 frames per second:
a compact binary format instead of GeoJSON, filtering on the GPU, and level of
detail when zoomed out.

**Exit:** a measured frame time at one million points, with the number in the
README.

## Later, unordered

Plate boundaries, the day–night terminator from the current time, and a link
or embed on the portfolio site.
