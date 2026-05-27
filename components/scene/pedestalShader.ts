// Texture-based stone shader for the pedestal cylinders.
//
// Uses triplanar world-space UV to sample a real texture — eliminates the
// cylinder UV seam. FBM bump adds micro-surface roughness on top.
//
// Colour pipeline: texture is sRGB → convert to linear → light → gamma encode.
// ShaderMaterial bypasses Three.js auto-sRGB output, so we apply it manually.

export const pedestalVertexShader = /* glsl */ `
  varying vec3  vWorldNormal;
  varying vec3  vWorldPos;
  varying float vCylinderV;   // 0 = bottom rim, 1 = top rim (for AO)

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPos    = (modelMatrix * vec4(position, 1.0)).xyz;
    vCylinderV   = uv.y;
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const pedestalFragmentShader = /* glsl */ `
  varying vec3  vWorldNormal;
  varying vec3  vWorldPos;
  varying float vCylinderV;

  uniform sampler2D uTexture;
  uniform vec3      uCamPos;

  // ── Noise (for bump + blend mask) ────────────────────────────────────────────

  float hash(vec2 p) {
    p  = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 74.17);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),                  hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p  = p * 2.03 + vec2(3.71, 1.13);
      a *= 0.50;
    }
    return v;
  }

  // ── 2D rotation helper ────────────────────────────────────────────────────────

  vec2 rot2(vec2 p, float a) {
    float s = sin(a), c = cos(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }

  // ── Triplanar blend weights ──────────────────────────────────────────────────

  vec3 triBlend(vec3 N) {
    vec3 b = abs(N);
    b      = pow(b, vec3(8.0));
    return b / (b.x + b.y + b.z + 0.001);
  }

  // ── Bump via central differences on the XZ plane ────────────────────────────

  vec3 bumpedNormal(vec3 pos, vec3 N, float scale, float strength) {
    float eps = 0.014;
    float hC  = fbm(pos.xz * scale);
    float hX  = fbm((pos.xz + vec2(eps, 0.0)) * scale);
    float hZ  = fbm((pos.xz + vec2(0.0, eps)) * scale);
    vec3  g   = vec3((hX - hC) / eps, 0.0, (hZ - hC) / eps);
    return normalize(N + (g - dot(g, N) * N) * strength);
  }

  void main() {

    vec3 N  = normalize(vWorldNormal);
    vec3 V  = normalize(uCamPos - vWorldPos);

    // ── Dual-layer triplanar sampling ─────────────────────────────────────────
    //
    // Two layers at different scales + small rotation (≈ 20°) are mixed with an
    // FBM mask. Because each layer tiles at a different frequency and orientation,
    // their seam lines never overlap — the eye can't lock onto a repeating grid.
    //
    // Total: 6 texture lookups (vs 12 for stochastic no-tile).

    const float S1 = 1.0;           // layer 1 scale
    const float S2 = 1.75;          // layer 2 scale  (different → seams don't align)
    const float R  = 0.35;          // rotation in radians ≈ 20°

    vec3 tb = triBlend(N);

    // Layer 1 — unrotated
    vec3 l1 = texture2D(uTexture, vWorldPos.yz * S1).rgb * tb.x
            + texture2D(uTexture, vWorldPos.xz * S1).rgb * tb.y
            + texture2D(uTexture, vWorldPos.xy * S1).rgb * tb.z;

    // Layer 2 — slightly rotated in each plane
    vec3 l2 = texture2D(uTexture, rot2(vWorldPos.yz, R)  * S2).rgb * tb.x
            + texture2D(uTexture, rot2(vWorldPos.xz, R)  * S2).rgb * tb.y
            + texture2D(uTexture, rot2(vWorldPos.xy, R)  * S2).rgb * tb.z;

    // FBM mask makes the blend boundary organic, not a straight line
    float mask   = smoothstep(0.35, 0.65, fbm(vWorldPos.xz * 0.45));
    vec3  albedo = mix(l1, l2, mask);

    // sRGB → linear (texture was stored in sRGB; lighting must be in linear)
    albedo = pow(albedo, vec3(2.2));

    // ── Bump map ──────────────────────────────────────────────────────────────
    vec3 Nb = bumpedNormal(vWorldPos, N, S1 * 1.2, 0.055);

    // ── Fake AO: darken the bottom rim ────────────────────────────────────────
    float ao = smoothstep(0.0, 0.18, vCylinderV);
    albedo  *= mix(0.38, 1.0, ao);

    // ── Lighting ──────────────────────────────────────────────────────────────

    // Ambient
    vec3 amb = albedo * 0.34;

    // Primary directional light — scene position [3, 4, 5]
    vec3  L    = normalize(vec3(3.0, 4.0, 5.0));
    float NdL  = max(dot(Nb, L), 0.0);
    vec3  diff = albedo * NdL * 0.60;

    // Specular — low-to-mid gloss for a slightly polished stone/wood surface
    vec3  H    = normalize(L + V);
    float sp   = pow(max(dot(Nb, H), 0.0), 48.0);
    vec3  spec = vec3(0.08, 0.072, 0.060) * sp;

    // Fresnel rim — warm amber accent
    float fr  = pow(1.0 - clamp(dot(Nb, V), 0.0, 1.0), 3.2);
    vec3  rim = vec3(0.48, 0.32, 0.10) * fr * 0.16;

    // Soft fill from the opposite side
    vec3 Lfill = normalize(vec3(-2.0, 0.4, -1.5));
    vec3 fill  = albedo * max(dot(Nb, Lfill), 0.0) * 0.07;

    vec3 color = amb + diff + spec + rim + fill;

    // ── sRGB encode ───────────────────────────────────────────────────────────
    // ShaderMaterial skips Three.js auto-conversion; apply manually.
    color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`;
