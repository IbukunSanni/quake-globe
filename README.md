# Quake Globe

Every earthquake of magnitude 2.5 or more in the past 30 days, live from the
USGS feed, on a globe drawn with raw WebGPU and WGSL. 

![The globe over the western Pacific: about 2,000 earthquakes along the Ring of Fire, sized by magnitude and shaded by depth](docs/images/globe-v0.1.jpg)

Drag to turn the globe; scroll or pinch to zoom. Hover over an earthquake for
its place, magnitude, depth and time, and click it for its USGS event page
(on a touch screen, tap once for the details and again for the page).

## Run it

Needs a browser with WebGPU (recent Chrome, Edge or Safari).

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # type-checks, then writes dist/

## Data

- Earthquakes: [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/),
  the `2.5_month` GeoJSON summary feed, fetched live on every visit.
- Coastlines: [Natural Earth](https://www.naturalearthdata.com/) 1:50m
  coastline, public domain, in `public/data/coastlines.geojson`.

