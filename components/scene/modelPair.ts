import * as THREE from "three";
import type { StatueConfig, SculptureMetrics } from "./types";
import { MODEL_POSITION_Y, PEDESTAL_TOP_RADIUS } from "./types";

// ─── Math helpers ─────────────────────────────────────────────────────────────

export function getShortestAngleDelta(current: number, previous: number) {
  let delta = current - previous;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

// ─── Material utilities ───────────────────────────────────────────────────────

export function collectMaterials(object: THREE.Object3D) {
  const materials: THREE.Material[] = [];

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.frustumCulled = false;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((mat) => {
        const cloned = mat.clone();
        cloned.transparent = true;
        cloned.depthWrite = false;
        cloned.needsUpdate = true;
        return cloned;
      });
      materials.push(...child.material);
    } else if (child.material) {
      const cloned = child.material.clone();
      cloned.transparent = true;
      cloned.depthWrite = false;
      cloned.needsUpdate = true;
      child.material = cloned;
      materials.push(cloned);
    }
  });

  return materials;
}

export function setSceneOpacity(
  scene: THREE.Object3D,
  materials: THREE.Material[],
  opacity: number
) {
  const safeOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
  scene.visible = safeOpacity > 0.01;
  const isOpaque = safeOpacity >= 0.999;

  materials.forEach((mat) => {
    mat.transparent = !isOpaque;
    mat.depthWrite = isOpaque;
    mat.opacity = safeOpacity;
    mat.needsUpdate = true;
  });
}

// ─── Model Pair ───────────────────────────────────────────────────────────────

export type ModelPair = {
  fadedScene: THREE.Object3D;
  recoloredScene: THREE.Object3D;
  fadedMaterials: THREE.Material[];
  recoloredMaterials: THREE.Material[];
};

export function createModelPair(
  fadedSource: THREE.Object3D,
  recoloredSource: THREE.Object3D
): ModelPair {
  const fadedScene = fadedSource.clone(true);
  const recoloredScene = recoloredSource.clone(true);

  fadedScene.traverse((child) => { child.renderOrder = 1; });
  recoloredScene.traverse((child) => { child.renderOrder = 2; });

  const fadedMaterials = collectMaterials(fadedScene);
  const recoloredMaterials = collectMaterials(recoloredScene);

  setSceneOpacity(fadedScene, fadedMaterials, 1);
  setSceneOpacity(recoloredScene, recoloredMaterials, 0);

  return { fadedScene, recoloredScene, fadedMaterials, recoloredMaterials };
}

export function applyColorProgress(
  frontPair: ModelPair,
  backPair: ModelPair,
  progress: number
) {
  setSceneOpacity(frontPair.fadedScene, frontPair.fadedMaterials, 1 - progress);
  setSceneOpacity(frontPair.recoloredScene, frontPair.recoloredMaterials, progress);
  setSceneOpacity(backPair.fadedScene, backPair.fadedMaterials, 1 - progress);
  setSceneOpacity(backPair.recoloredScene, backPair.recoloredMaterials, progress);
}

// ─── Procedural placeholder ───────────────────────────────────────────────────

function buildProceduralScene(color: THREE.ColorRepresentation): THREE.Object3D {
  const group = new THREE.Group();
  const add = (geom: THREE.BufferGeometry, y: number) => {
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color }));
    mesh.position.y = y;
    group.add(mesh);
  };
  add(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 12), 0.06);
  add(new THREE.CylinderGeometry(0.18, 0.28, 0.75, 12), 0.495);
  add(new THREE.SphereGeometry(0.16, 16, 16), 1.0);
  return group;
}

export function createProceduralPair(): ModelPair {
  const fadedScene = buildProceduralScene("#888888");
  const recoloredScene = buildProceduralScene("#c85a1e");

  fadedScene.traverse((c) => { c.renderOrder = 1; });
  recoloredScene.traverse((c) => { c.renderOrder = 2; });

  const fadedMaterials = collectMaterials(fadedScene);
  const recoloredMaterials = collectMaterials(recoloredScene);

  setSceneOpacity(fadedScene, fadedMaterials, 1);
  setSceneOpacity(recoloredScene, recoloredMaterials, 0);

  return { fadedScene, recoloredScene, fadedMaterials, recoloredMaterials };
}

// ─── Sculpture metrics ────────────────────────────────────────────────────────

export function computeMetrics(
  scene: THREE.Object3D,
  config: StatueConfig,
  scale: number
): SculptureMetrics {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);

  let height: number, bottom: number, baseRadius: number;

  if (config.heightAxis === "z") {
    height = (box.max.z - box.min.z) * scale;
    bottom = box.min.z * scale;
    baseRadius = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * scale * 0.5;
  } else {
    height = (box.max.y - box.min.y) * scale;
    bottom = box.min.y * scale;
    baseRadius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * scale * 0.5;
  }

  return {
    renderedHeight: height,
    renderedBottomInGroup: bottom + MODEL_POSITION_Y,
    renderedBaseRadius: baseRadius,
  };
}

export function computeActiveScale(
  sourceScene: THREE.Object3D,
  config: StatueConfig
): number {
  if (config.fixedScale !== undefined) return config.fixedScale;
  const targetBaseRadius = PEDESTAL_TOP_RADIUS * (config.autoBaseRadiusFactor ?? 1);
  const baseMetrics = computeMetrics(sourceScene, config, 1.0);
  const maxHeightScale = 1.6 / baseMetrics.renderedHeight;
  const widthScale = Math.max(
    0.3,
    Math.min(3.0, targetBaseRadius / baseMetrics.renderedBaseRadius)
  );
  return Math.min(widthScale, maxHeightScale);
}
