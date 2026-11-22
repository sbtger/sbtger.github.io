// Orthographic projection of a latitude/longitude map. Strip drawing also
// works when the homepage is opened directly from disk, without WebGL.
function createPlanet({ imageURL, tint, period, tilt }, onReady) {
  const rim = tint.map(channel => channel * .20 + 255 * .80);
  const makeLayer = () => document.createElement('canvas').getContext('2d');
  const meridians = makeLayer();
  const surface = makeLayer();
  const light = makeLayer();
  let rows = [];
  let columns = [];
  let size = 0;
  let mapWidth = 0;
  let lastRender = -Infinity;

  const texture = new Image();
  texture.onload = () => {
    mapWidth = texture.naturalWidth;
    onReady();
  };
  texture.src = imageURL;

  function prepare(resolution) {
    size = resolution;
    for (const layer of [meridians, surface, light]) {
      layer.canvas.width = layer.canvas.height = size;
    }
    meridians.imageSmoothingQuality = 'medium';

    const radius = size / 2;
    const step = 2;
    columns = [];
    for (let x = 0; x < size; x += step) {
      const width = Math.min(step, size - x);
      const left = Math.asin(x / radius - 1);
      const right = Math.asin((x + width) / radius - 1);
      columns.push({ x, width, offset: left / (2 * Math.PI), span: (right - left) / (2 * Math.PI) });
    }
    rows = Array.from({ length: size }, (_, y) => {
      const latitude = (y + .5) / radius - 1;
      const extent = radius * Math.sqrt(1 - latitude * latitude);
      const top = Math.asin(y / radius - 1);
      const bottom = Math.asin((y + 1) / radius - 1);
      return { left: radius - extent, width: extent * 2,
        sourceY: (.5 + top / Math.PI) * size, sourceHeight: (bottom - top) / Math.PI * size };
    });

    // Light the globe separately from the turning material, with a soft luminous limb.
    const lighting = light.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      const ny = (y + .5 - radius) / radius;
      for (let x = 0; x < size; x++) {
        const nx = (x + .5 - radius) / radius;
        // Shade the border texels too; the final circular clip defines the limb.
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const sunlight = Math.max(0, -.68 * nx - .43 * ny + .59 * nz);
        const shadow = .27 * (1 - Math.pow(sunlight, .80));
        const air = (.025 + .94 * Math.pow(1 - nz, 1.65)) * (.90 + .10 * sunlight);
        const dark = shadow * (1 - air);
        const alpha = dark + air;
        const i = 4 * (y * size + x);
        lighting.data[i] = (6 * dark + rim[0] * air) / alpha;
        lighting.data[i + 1] = (9 * dark + rim[1] * air) / alpha;
        lighting.data[i + 2] = (24 * dark + rim[2] * air) / alpha;
        lighting.data[i + 3] = 255 * alpha;
      }
    }
    light.putImageData(lighting, 0, 0);
    lastRender = -Infinity;
  }

  function project(seconds) {
    const turn = (seconds % period) / period;
    for (const col of columns) {
      const start = ((1.5 - turn + col.offset) % 1) * mapWidth;
      const span = col.span * mapWidth;
      const first = Math.min(span, mapWidth - start);
      const firstWidth = col.width * first / span;
      meridians.drawImage(texture, start, 0, first, texture.height, col.x, 0, firstWidth, size);
      if (first < span) {
        meridians.drawImage(texture, 0, 0, span - first, texture.height,
          col.x + firstWidth, 0, col.width - firstWidth, size);
      }
    }
    for (let y = 0; y < size; y++) {
      const row = rows[y];
      surface.drawImage(meridians.canvas, 0, row.sourceY, size, row.sourceHeight,
        row.left, y, row.width, 1);
    }
    lastRender = seconds;
  }

  return function draw(ctx, x, y, diameter, seconds) {
    if (!mapWidth || diameter <= 0) return;
    // Supersample the fine surface contours before scaling back to the display.
    const scale = Math.max(1.5, ctx.getTransform().a);
    const resolution = Math.min(2048, Math.max(96, Math.round(diameter * scale)));
    if (size !== resolution) prepare(resolution);
    if (seconds - lastRender >= 1 / 24) project(seconds);

    const radius = diameter * .5;
    ctx.save();
    ctx.translate(x, y);
    const haloRadius = radius * 1.35;
    const halo = ctx.createRadialGradient(0, 0, radius * .988, 0, 0, haloRadius);
    halo.addColorStop(0, 'rgba(' + rim.join(',') + ',.68)');
    halo.addColorStop(.10, 'rgba(' + rim.join(',') + ',.34)');
    halo.addColorStop(.32, 'rgba(' + rim.join(',') + ',.13)');
    halo.addColorStop(.70, 'rgba(' + tint.join(',') + ',.028)');
    halo.addColorStop(1, 'rgba(' + tint.join(',') + ',0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-haloRadius, -haloRadius, 2 * haloRadius, 2 * haloRadius);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#060b15';
    ctx.fillRect(-radius, -radius, diameter, diameter);
    ctx.save();
    ctx.rotate(tilt * Math.PI / 180);
    ctx.drawImage(surface.canvas, -radius, -radius, diameter, diameter);
    ctx.restore();
    ctx.drawImage(light.canvas, -radius, -radius, diameter, diameter);
    ctx.restore();
  };
}
