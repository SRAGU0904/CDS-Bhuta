import * as THREE from "three";
import type { RegionDef } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColoringUniforms = Array<{ value: THREE.Vector3 }>;

// ─── Build ────────────────────────────────────────────────────────────────────
// Clones sourceMat and injects partID-based region coloring via onBeforeCompile.
// PBR lighting from MeshStandardMaterial is fully preserved — only diffuseColor
// is overridden per-region after the map_fragment stage.

export function buildColoringMaterial(
  sourceMat: THREE.MeshStandardMaterial,
  partIDTex: THREE.Texture
): { material: THREE.MeshStandardMaterial; colorUniforms: ColoringUniforms } {
  const mat = sourceMat.clone();
  const colorUniforms: ColoringUniforms = Array.from({ length: 9 }, () => ({
    value: new THREE.Vector3(-1, -1, -1),
  }));

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.partID = { value: partIDTex };
    colorUniforms.forEach((u, i) => { shader.uniforms[`col${i}`] = u; });

    // Expose raw mesh UV as vPartIDUv to avoid relying on Three.js internal naming
    shader.vertexShader = shader.vertexShader
      .replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vPartIDUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvPartIDUv = uv;");

    shader.fragmentShader =
      `varying vec2 vPartIDUv;
      uniform sampler2D partID;
      uniform vec3 col0, col1, col2, col3, col4;
      uniform vec3 col5, col6, col7, col8;
      vec3 regionCol(float g) {
        float idx = floor(g * 8.0 + 0.5);
        if (idx < 0.5) return col0;
        if (idx < 1.5) return col1;
        if (idx < 2.5) return col2;
        if (idx < 3.5) return col3;
        if (idx < 4.5) return col4;
        if (idx < 5.5) return col5;
        if (idx < 6.5) return col6;
        if (idx < 7.5) return col7;
        return col8;
      }\n` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      {
        float gray = texture2D(partID, vPartIDUv).r;
        vec3 rCol = regionCol(gray);
        if (rCol.r >= 0.0) diffuseColor.rgb = rCol;
      }`
    );
  };

  return { material: mat, colorUniforms };
}

// ─── Update ───────────────────────────────────────────────────────────────────
// Syncs col0-col8 uniforms from current selections. Vec3(-1,-1,-1) = uncolored.

export function applySelectionsToMaterial(
  colorUniforms: ColoringUniforms,
  regions: RegionDef[],
  selections: Record<string, string>
) {
  for (let i = 0; i < 9; i++) {
    const region = regions[i];
    const hex = region ? selections[region.id] : undefined;
    if (hex) {
      const c = new THREE.Color(hex);
      colorUniforms[i].value.set(c.r, c.g, c.b);
    } else {
      colorUniforms[i].value.set(-1, -1, -1);
    }
  }
}
