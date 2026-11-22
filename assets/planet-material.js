// GLSL ES 3.00 fragment material. The fallback maps use the same continuous
// sphere coordinates: +X is longitude zero, +Y is north, and +Z is east.
const ANRED_PLANET_MATERIAL = `
precision highp float;

// Antiderivative of a cubic smoothstep, including its constant tail.
float anredStepArea(float x, float lo, float hi) {
  float t = clamp((x - lo) / (hi - lo), 0.0, 1.0);
  return (hi - lo) * t*t*t * (1.0 - 0.5*t) + max(x - hi, 0.0);
}

float anredBandArea(float x, float core, float edge) {
  float p = fract(x) - 0.5;
  return floor(x) * (core + edge)
       + anredStepArea(p, -edge, -core) - anredStepArea(p, core, edge);
}

// Integrate a whole pixel of the periodic stripe, even where many lines meet
// the silhouette. In a close-up the physical crown and its soft shoulders resolve.
float anredBand(float phase, float core, float edge) {
  float footprint = max(fwidth(phase), 0.001);
  float center = fract(phase + 0.5);
  return clamp((anredBandArea(center + 0.5*footprint, core, edge)
              - anredBandArea(center - 0.5*footprint, core, edge)) / footprint, 0.0, 1.0);
}

float anredThread(float phase, float sigma) {
  return anredBand(phase, 0.34*sigma, 1.43*sigma);
}

// Preserve integrated energy for a single unresolved silk thread.
float anredVein(float offset, float sigma) {
  float footprint = fwidth(offset);
  float filtered = sqrt(sigma*sigma + footprint*footprint / 6.0);
  float t = offset / filtered;
  return (sigma/filtered) * exp(-t*t);
}

float anredWell(vec3 n, vec2 positionDegrees, float aspect) {
  vec2 rad = radians(positionDegrees);
  vec2 cs = cos(rad);
  vec2 sn = sin(rad);
  float horizontal = dot(n.xz, vec2(cs.x, sn.x));
  float axial = horizontal*cs.y + n.y*sn.y;
  float u = dot(n.xz, vec2(-sn.x, cs.x));
  float v = n.y*cs.y - horizontal*sn.y;
  float minor = 0.72*v + 0.70*u;
  float major = 0.72*u - 0.70*v;
  float distanceSquared = (2.0*(1.0-axial) + 0.92*minor*minor - 0.42*major*major)*aspect;
  return exp(-23.0*distanceSquared);
}

vec3 planetMaterial(vec3 sphere, bool moon) {
  float x = sphere.x, y = sphere.y, z = sphere.z;
  vec3 n = normalize(sphere + vec3(
    0.072*sin(3.0*y + 4.0*z),
    0.050*sin(3.3*z + 2.5*x - 0.7) + 0.035*sin(7.0*x + 2.0*y - 4.1*z),
    0.116*sin(3.4*y - 2.0*x + 1.0) + 0.034*sin(5.8*x + 2.2*z)));
  float a = n.x, b = n.y, c = n.z;
  float wells = anredWell(n, vec2(-12.0, -11.0), 0.90)
              + anredWell(n, vec2(9.0, 13.0), 1.07)
              + anredWell(n, vec2(136.0, 14.0), 0.95)
              + anredWell(n, vec2(-126.0, -27.0), 0.90)
              + anredWell(n, vec2(-154.0, 64.0), 1.18);
  float f = sqrt(max(0.0015, -log(max(wells, 1e-30))/23.0) + 0.035)
          + 0.028*sin(5.2*a - 3.0*b + 2.0*c) + 0.015*sin(3.0*a + 5.7*b + 4.3*c);
  f += 0.143*pow(clamp((c+0.145)/0.73, 0.0, 1.0), 1.45)*sin(6.8*b + 2.55*c - 0.55*a);
  f += 0.020*sin(3.6*b + 5.0*c - 1.5*sin(3.0*a + 2.05*b));

  vec3 core = moon ? vec3(96, 62, 210) : vec3(54, 107, 188);
  vec3 pale = moon ? vec3(163, 140, 255) : vec3(129, 173, 227);
  vec3 pearl = moon ? vec3(239, 223, 255) : vec3(221, 240, 255);
  float veil = 0.5 + 0.5*sin(2.15*b - 2.9*c + 1.55*a);
  float opal = 0.16 + 0.24*f + 0.11*veil + 0.055*sin(5.0*f + 0.3)
             + 0.03*cos(3.2*x + 1.6*z);
  vec3 rgb = mix(core, pale, clamp(opal, 0.0, 1.0));
  float ticks = (moon ? 10.0 : 37.0)*f;
  float line = moon ? anredThread(ticks, 0.14) : anredBand(ticks, 0.024, 0.115);
  rgb -= anredThread(ticks - 0.155, 0.09)*(moon ? vec3(0.5) : vec3(3.8, 4.0, 2.6));
  rgb = mix(rgb, pearl, line*(moon ? 0.010 : 0.282)*(0.72 + 0.28*veil));

  // The luminous outer fold is tied to the material and rotates with the wells.
  float vertical = a + (moon ? -0.11 : 0.11)*b - 0.075*c;
  float outer = sqrt(vertical*vertical + 0.0005);
  float side = tanh(8.0*a);
  float bend = 0.078*sin(2.6*b + 3.2*c + 0.25) + 0.040*sin(4.25*c - 2.3*b + 1.55);
  float center = outer - (moon ? 0.548 : 0.60) + bend*side;
  float breath = 0.58 + 0.42*(0.5 + 0.5*cos(4.45*b - 2.1*c - 0.37));
  // Double-angle identities avoid the longitude seam and atan(0,0).
  float radialSq = max(dot(n.yz, n.yz), 1e-12);
  vec2 twice = vec2(c*c - b*b, 2.0*b*c)/radialSq;
  float shift = 3.90 + 0.47*cos(3.8*c - 2.0*b);
  float fold = clamp(0.5 + 0.5*dot(twice, vec2(cos(shift), -sin(shift))), 0.0, 1.0);
  float span = moon ? 0.12*breath : 0.040 + 0.145*pow(fold,1.50);
  float q = center/span;
  float softLayer = exp(-q*q*0.84);

  if (moon) {
    const vec3 pos = vec3(-1.70, 0.05, 1.50);
    const vec3 amp = vec3(0.62, 0.66, 0.47);
    const vec3 width = vec3(0.122, 0.111, 0.146);
    for (int i=0; i<3; ++i) {
      float warp = 0.26*sin(2.0*b + 2.8*c + float(i))*side;
      float strand = anredVein(q-pos[i]-warp, width[i]);
      rgb = mix(rgb, pearl, amp[i]*strand*(0.7+0.3*breath));
    }
    rgb = mix(rgb, pearl, softLayer*0.13);
  } else {
    float opening = 0.86 + 0.14*sin(3.3*b - 2.0*c);
    float threads = q*4.5 + 0.43*sin(2.9*b - 2.5*c);
    float trace = anredThread(threads, 0.125);
    float fiberWidth = (q+0.36)/0.72;
    float fiber = anredThread(threads+0.24, 0.072)*exp(-fiberWidth*fiberWidth);
    float edgeA = anredVein(q+0.91, 0.11);
    float edgeB = anredVein(q-1.03, 0.12);
    float silk = 0.31*softLayer + 0.265*softLayer*trace + 0.057*fiber + 0.43*edgeA + 0.36*edgeB;
    rgb = mix(rgb, pearl, clamp(silk*opening, 0.0, 1.0));
    float lip = (center - 0.052 - max(0.0,0.065+0.080*sin(3.5*b-2.0*c-0.3))) / (0.050+0.055*fold);
    float lipCrest = anredVein(lip-0.91, 0.12);
    float sheen = exp(-lip*lip*1.4);
    rgb = mix(rgb, pearl, (0.16*sheen + 0.25*lipCrest + 0.115*sheen*anredThread(lip*2.6, 0.15))*opening);
  }
  return clamp(rgb/255.0, 0.0, 1.0);
}
`;
