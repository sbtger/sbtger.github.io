// Draw both globes in screen pixels. The pattern lives in rotating sphere
// coordinates, while illumination and the luminous rim stay in camera space.
function createGlPlanets(canvas, materials, onFailure) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;

  const vertex = `#version 300 es
    uniform vec2 viewport, center;
    uniform float radius;
    out vec2 point;
    void main() {
      vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2.0 - 1.0;
      point = corner * 1.35;
      vec2 screen = (center + point * radius) / viewport;
      gl_Position = vec4(screen * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
    }`;
  const fragment = `#version 300 es
    precision highp float;
    uniform vec2 axis, spin;
    uniform vec3 tint;
    uniform bool moon;
    in vec2 point;
    out vec4 color;
    ${ANRED_PLANET_MATERIAL}
    void main() {
      float r = length(point);
      float edge = max(fwidth(r) * .6, .0001);
      if (r > 1.35) discard;
      vec3 rim = mix(tint, vec3(1.), .80);
      float halo = .66 * exp(-max(r - 1., 0.) * 16.) * (1. - smoothstep(1.20, 1.35, r));
      vec4 airglow = vec4(rim * halo, halo);
      if (r > 1. + edge) { color = airglow; return; }

      float z = sqrt(max(0., 1. - dot(point, point)));
      vec2 local = vec2(dot(point, axis), dot(point, vec2(-axis.y, axis.x)));
      vec3 sphere = vec3(z * spin.x + local.x * spin.y, -local.y, local.x * spin.x - z * spin.y);
      vec3 albedo = planetMaterial(sphere, moon);
      float sun = max(0., dot(vec3(point, z), vec3(-.68, -.43, .59)));
      float shade = .27 * (1. - pow(sun, .80));
      float atmosphere = (.025 + .94 * pow(1. - z, 1.65)) * (.90 + .10 * sun);
      vec3 lit = mix(mix(albedo, vec3(.024, .035, .094), shade), rim, atmosphere);
      float disk = 1. - smoothstep(1. - edge, 1. + edge, r);
      color = mix(airglow, vec4(lit, 1.), disk);
    }`;

  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Using the canvas planet renderer:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const uniforms = {};
  for (const name of ['viewport', 'center', 'radius', 'spin', 'axis', 'tint', 'moon']) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  canvas.addEventListener('webglcontextlost', onFailure, { once: true });

  return {
    begin(width, height) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.viewport, width, height);
    },
    draw(index, x, y, diameter, seconds) {
      if (diameter <= 0) return;
      const { tilt, tint, period } = materials[index];
      const angle = tilt * Math.PI / 180;
      const turn = (seconds % period) / period * 2 * Math.PI;
      gl.uniform2f(uniforms.center, x, y);
      gl.uniform1f(uniforms.radius, diameter / 2);
      gl.uniform1i(uniforms.moon, index === 1);
      gl.uniform2f(uniforms.spin, Math.cos(turn), Math.sin(turn));
      gl.uniform2f(uniforms.axis, Math.cos(angle), Math.sin(angle));
      gl.uniform3f(uniforms.tint, tint[0] / 255, tint[1] / 255, tint[2] / 255);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
}
