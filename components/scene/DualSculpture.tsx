"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

import type {
  ColoringModeState,
  SculptureMetrics,
} from "./types";
import {
  IDLE_TIMEOUT_MS,
  ACTIVITY_THRESHOLD_RAD,
  IDLE_LERP_SPEED,
  MODEL_POSITION_Y,
  PEDESTAL_TOP_RADIUS,
  PEDESTAL_BOTTOM_RADIUS,
} from "./types";
import { STATUE_CONFIGS } from "./config";
import {
  type ModelPair,
  getShortestAngleDelta,
  createModelPair,
  createProceduralPair,
  setSceneOpacity,
  computeMetrics,
  computeActiveScale,
} from "./modelPair";
import {
  type ColoringUniforms,
  buildColoringMaterial,
  applySelectionsToMaterial,
} from "./coloringMaterial";
import { pedestalVertexShader, pedestalFragmentShader } from "./pedestalShader";


// ─── Pedestal ─────────────────────────────────────────────────────────────────

const PEDESTAL_TEXTURE = "/image/wood-texture-close-up.jpg";

export function Pedestal({ metrics }: { metrics: SculptureMetrics | null }) {
  const pedestalHeight = metrics ? Math.max(0.2, metrics.renderedHeight * 0.15) : 0.3;
  const posY = metrics ? metrics.renderedBottomInGroup - pedestalHeight / 2 : -0.35;

  const matRef = useRef<THREE.ShaderMaterial>(null);
  const texture = useTexture(PEDESTAL_TEXTURE);

  const uniforms = useMemo(() => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return {
      uCamPos:   { value: new THREE.Vector3(0, 1, 5) },
      uTexture:  { value: texture },
    };
  }, [texture]);

  useFrame(({ camera }) => {
    if (matRef.current) {
      matRef.current.uniforms.uCamPos.value.copy(camera.position);
    }
  });

  return (
    <mesh position={[0, posY, 0]}>
      <cylinderGeometry args={[PEDESTAL_TOP_RADIUS, PEDESTAL_BOTTOM_RADIUS, pedestalHeight, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={pedestalVertexShader}
        fragmentShader={pedestalFragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ─── Model View ───────────────────────────────────────────────────────────────
// Renders all three scene layers; opacity in useFrame determines what's visible.

function ModelView({
  pair,
  coloringScene,
  position,
  baseYaw,
  yaw,
  modelRotation,
  scale,
}: {
  pair: ModelPair;
  coloringScene: THREE.Object3D | null;
  position: [number, number, number];
  baseYaw: number;
  yaw: number;
  modelRotation: [number, number, number];
  scale: number;
}) {
  return (
    <group position={position} rotation={[0, baseYaw + yaw, 0]}>
      <group scale={scale} rotation={modelRotation}>
        {/* dispose={null} prevents R3F from auto-disposing geometry/material/
            textures when this primitive unmounts. Critical because the scenes
            below are clones that share TEXTURES with the cached GLB — auto
            dispose would invalidate GL handles used by sibling clones (and
            by PaintingSplitView). */}
        <primitive object={pair.fadedScene} dispose={null} />
        <primitive object={pair.recoloredScene} dispose={null} />
        {coloringScene && <primitive object={coloringScene} dispose={null} />}
      </group>
    </group>
  );
}

// ─── Opacity helpers ──────────────────────────────────────────────────────────

function setColoringOpacity(
  mat: THREE.MeshStandardMaterial,
  frontScene: THREE.Object3D,
  backScene: THREE.Object3D,
  opacity: number
) {
  const safe = THREE.MathUtils.clamp(opacity, 0, 1);
  frontScene.visible = safe > 0.01;
  backScene.visible  = safe > 0.01;
  mat.opacity = safe;
  // Keep transparent=true / depthWrite=false permanently (set during useMemo).
  // Toggling these at the 0.999 boundary forces a WebGL program recompile
  // (needsUpdate=true) which blanks the coloring scene for one frame — exactly
  // the "snap to faded" jump the user sees when left-rotating back to full color.
  // renderOrder=3 ensures the coloring layer draws after the opaque faded scene
  // (renderOrder=1) and passes the depth test at the same Z position.
}

// ─── Dual Sculpture ───────────────────────────────────────────────────────────

export function DualSculpture({
  yaw,
  controlMode,
  statueIndex,
  coloringModeState,
  confirmedSelections,
  onIdleReset,
  onDisplayYawChange,
}: {
  yaw: number;
  controlMode: string;
  statueIndex: number;
  coloringModeState: ColoringModeState;
  confirmedSelections: Record<string, string> | null;
  onIdleReset?: () => void;
  onDisplayYawChange?: (yaw: number) => void;
}) {
  const fadedPanjurli     = useGLTF("/models/Panjurli_faded.glb");
  const recoloredPanjurli = useGLTF("/models/Panjurli_recolored.glb");
  const fadedNandigona        = useGLTF("/models/Nandigona_faded.glb");
  const recoloredNandigona    = useGLTF("/models/Nandigona_recolored.glb");
  const panjurliPartIDTexture  = useTexture("/models/Panjurli_MaskColorMap.png");
  const nandigonaPartIDTexture = useTexture("/models/Nandigona_MaskColorMap.png");
  const fadedAmmanavaru        = useGLTF("/models/Ammanavaru_faded.glb");
  const recoloredAmmanavaru    = useGLTF("/models/Ammanavaru_recolored.glb");
  const ammanavaru_PartIDTex   = useTexture("/models/Ammanavaru_MaskColorMap.png");

  const previousAngleRef = useRef<number | null>(null);
  const colorProgressRef = useRef(0);
  const wasColoringRef   = useRef(false); // tracks previous coloringModeState.active
  const lastActivityRef  = useRef(Date.now());
  const displayYawRef    = useRef(0);
  const idleResetCalledRef   = useRef(false);
  const pendingIdleResetRef  = useRef(false);
  const confirmedRef         = useRef(confirmedSelections);
  const [displayYaw, setDisplayYaw] = useState(0);

  // ── TEMP DIAGNOSTIC: startup assert + suspicious-event logger ─────────────
  // Confirms which IDLE_LERP_SPEED value the bundle is actually running.
  useEffect(() => {
    console.log(
      "[DIAG][BOOT] IDLE_LERP_SPEED=", IDLE_LERP_SPEED,
      "IDLE_TIMEOUT_MS=", IDLE_TIMEOUT_MS,
      "(expected after fix: 0.04 / 10000)"
    );
  }, []);
  const dbgPrevProgressRef = useRef<number>(-1);
  const dbgPrevConfirmedRef = useRef<boolean | null>(null);

  // Reset rotation / activity tracking when statue, control mode, or coloring mode
  // toggles. useLayoutEffect runs synchronously after commit and before R3F's first
  // useFrame tick, so refs are guaranteed to be in their reset state before any
  // rendering happens.
  useLayoutEffect(() => {
    wasColoringRef.current   = coloringModeState.active;
    previousAngleRef.current = null;
    lastActivityRef.current  = Date.now();
    displayYawRef.current    = 0;
    setDisplayYaw(0);
    onDisplayYawChange?.(0);
  }, [statueIndex, controlMode, coloringModeState.active, onDisplayYawChange]);

  // Sync `confirmedRef` and `colorProgressRef` to `confirmedSelections` in a single
  // useLayoutEffect. Critical: this must beat R3F's first useFrame so that the
  // first frame after a polling-induced `null → {colors}` transition does NOT
  // briefly fall into the no-confirmed branch (which would render the museum
  // default `recolored.glb` at full opacity — visible as a one-frame jump from
  // user colors to museum colors and back).
  useLayoutEffect(() => {
    confirmedRef.current = confirmedSelections;
    if (confirmedSelections !== null) {
      idleResetCalledRef.current  = false;
      pendingIdleResetRef.current = false;
      lastActivityRef.current     = Date.now();
    }
    if (coloringModeState.active) return; // painting mode handled by useFrame's early branch
    colorProgressRef.current = confirmedSelections !== null ? 1 : 0;
  }, [coloringModeState.active, confirmedSelections]);

  const {
    frontPair,
    backPair,
    metrics,
    activeScale,
    coloringFrontScene,
    coloringBackScene,
    coloringUniforms,
    coloringMaterial,
  } = useMemo(() => {
    const config = STATUE_CONFIGS[statueIndex];

    let frontPair: ModelPair;
    let backPair: ModelPair;
    let sourceScene: THREE.Object3D;

    if (config.id === "panjurli") {
      frontPair   = createModelPair(fadedPanjurli.scene, recoloredPanjurli.scene);
      backPair    = createModelPair(fadedPanjurli.scene, recoloredPanjurli.scene);
      sourceScene = fadedPanjurli.scene;
    } else if (config.id === "nandigona") {
      frontPair   = createModelPair(fadedNandigona.scene, recoloredNandigona.scene);
      backPair    = createModelPair(fadedNandigona.scene, recoloredNandigona.scene);
      sourceScene = fadedNandigona.scene;
    } else if (config.id === "ammanavaru") {
      frontPair   = createModelPair(fadedAmmanavaru.scene, recoloredAmmanavaru.scene);
      backPair    = createModelPair(fadedAmmanavaru.scene, recoloredAmmanavaru.scene);
      sourceScene = fadedAmmanavaru.scene;
    } else {
      frontPair   = createProceduralPair();
      backPair    = createProceduralPair();
      sourceScene = frontPair.fadedScene;
    }

    const activeScale = computeActiveScale(sourceScene, config);
    const metrics     = computeMetrics(sourceScene, config, activeScale);

    let coloringFrontScene: THREE.Object3D | null           = null;
    let coloringBackScene:  THREE.Object3D | null           = null;
    let coloringUniforms:   ColoringUniforms | null         = null;
    let coloringMaterial:   THREE.MeshStandardMaterial | null = null;

    if (config.regions) {
      const partIDTexture =
        config.id === "panjurli"    ? panjurliPartIDTexture  :
        config.id === "nandigona"   ? nandigonaPartIDTexture :
        config.id === "ammanavaru"  ? ammanavaru_PartIDTex   :
        null;

      if (partIDTexture) {
        let sourceMat: THREE.MeshStandardMaterial | null = null;
        sourceScene.traverse((child) => {
          if (sourceMat) return;
          if (child instanceof THREE.Mesh) {
            const mat = Array.isArray(child.material) ? child.material[0] : child.material;
            if (mat instanceof THREE.MeshStandardMaterial) sourceMat = mat;
          }
        });

        // CRITICAL: clone the texture so that disposal in another component
        // (e.g. PaintingSplitView when user exits coloring mode) does NOT
        // invalidate the GL handle we're still using here. Otherwise we get
        // "bindTexture: attempt to use a deleted object" → context lost.
        const partIDTextureClone = partIDTexture.clone();
        partIDTextureClone.flipY = false;
        partIDTextureClone.needsUpdate = true;

        if (sourceMat) {
          const result = buildColoringMaterial(sourceMat, partIDTextureClone);
          coloringMaterial = result.material;
          coloringUniforms = result.colorUniforms;

          coloringMaterial.transparent = true;
          coloringMaterial.depthWrite  = false;
          coloringMaterial.opacity     = 0;

          const stamp = (scene: THREE.Object3D) => {
            scene.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material      = coloringMaterial!;
                child.frustumCulled = false;
                child.renderOrder   = 3;
              }
            });
            scene.visible = false;
          };

          coloringFrontScene = sourceScene.clone(true);
          stamp(coloringFrontScene);
          coloringBackScene = sourceScene.clone(true);
          stamp(coloringBackScene);
        }
      }
    }

    return {
      frontPair, backPair, metrics, activeScale,
      coloringFrontScene, coloringBackScene,
      coloringUniforms, coloringMaterial,
    };
  }, [
    fadedPanjurli.scene, recoloredPanjurli.scene,
    fadedNandigona.scene, recoloredNandigona.scene,
    fadedAmmanavaru.scene, recoloredAmmanavaru.scene,
    panjurliPartIDTexture, nandigonaPartIDTexture, ammanavaru_PartIDTex,
    statueIndex,
  ]);

  // Sync coloring uniforms whenever selections change
  const activeSelections = coloringModeState.active
    ? coloringModeState.selections
    : (confirmedSelections ?? {});

  useEffect(() => {
    const config = STATUE_CONFIGS[statueIndex];
    if (!coloringUniforms || !config.regions) return;
    applySelectionsToMaterial(coloringUniforms, config.regions, activeSelections);
  }, [activeSelections, coloringUniforms, statueIndex]);

  useFrame(() => {
    // ── Coloring mode: locked, show only coloring scene ────────────────────
    if (coloringModeState.active) {
      setSceneOpacity(frontPair.fadedScene,    frontPair.fadedMaterials,    0);
      setSceneOpacity(frontPair.recoloredScene,frontPair.recoloredMaterials,0);
      setSceneOpacity(backPair.fadedScene,     backPair.fadedMaterials,     0);
      setSceneOpacity(backPair.recoloredScene, backPair.recoloredMaterials, 0);
      if (coloringMaterial && coloringFrontScene && coloringBackScene) {
        setColoringOpacity(coloringMaterial, coloringFrontScene, coloringBackScene, 1);
      }
      return;
    }

    // ── Rotation / idle animation ───────────────────────────────────────────
    const currentAngle = yaw;
    const now          = Date.now();

    if (previousAngleRef.current === null) {
      previousAngleRef.current = currentAngle;
      displayYawRef.current    = 0;
      applyOpacities(colorProgressRef.current);
      return;
    }

    const delta    = getShortestAngleDelta(currentAngle, previousAngleRef.current);
    previousAngleRef.current = currentAngle;
    const absDelta = Math.abs(delta);
    const isIdle   =
      absDelta <= ACTIVITY_THRESHOLD_RAD &&
      now - lastActivityRef.current > IDLE_TIMEOUT_MS;

    if (absDelta > ACTIVITY_THRESHOLD_RAD) {
      // User resumed activity. If idle reset was pending (progress is mid-fade),
      // CANCEL it instead of force-zeroing — otherwise progress instantly snaps
      // from e.g. 0.5 to 0 and branch flips from A→B in one frame, which is
      // exactly the "突然不上色" jump the user perceives. Treat resumed activity
      // as "user still engaged, keep their colors". If they truly walk away,
      // another IDLE_TIMEOUT_MS of inactivity will re-arm the reset.
      if (pendingIdleResetRef.current) {
        console.log(
          "[DIAG][PENDING-RESET-CANCELLED] progress=", colorProgressRef.current.toFixed(2),
          "(user resumed mid-fade; keeping colors)"
        );
        pendingIdleResetRef.current = false;
      }
      lastActivityRef.current = now;

      const step = -delta / (Math.PI * 2);
      colorProgressRef.current = THREE.MathUtils.clamp(
        colorProgressRef.current + step, 0, 1
      );
      displayYawRef.current += delta;

    } else if (isIdle) {
      // Mark reset as pending as soon as idle timeout fires with confirmed state
      if (confirmedRef.current !== null && coloringFrontScene !== null && !idleResetCalledRef.current) {
        pendingIdleResetRef.current = true;
      }

      const idleColorTarget = 0;
      colorProgressRef.current =
        Math.abs(colorProgressRef.current - idleColorTarget) > 0.001
          ? THREE.MathUtils.lerp(colorProgressRef.current, idleColorTarget, IDLE_LERP_SPEED)
          : idleColorTarget;

      if (pendingIdleResetRef.current && colorProgressRef.current === 0) {
        pendingIdleResetRef.current = false;
        idleResetCalledRef.current  = true;
        confirmedRef.current        = null;
        onIdleReset?.();
      }

      // Find the nearest visual zero (nearest multiple of 2π) using Math.round,
      // so large accumulated yaw values always take the shortest angular path back.
      const nearest = Math.round(displayYawRef.current / (Math.PI * 2)) * (Math.PI * 2);
      if (Math.abs(displayYawRef.current - nearest) > 0.001) {
        displayYawRef.current = THREE.MathUtils.lerp(
          displayYawRef.current, nearest, IDLE_LERP_SPEED
        );
      } else {
        displayYawRef.current = nearest;
      }
    } else {
      displayYawRef.current += delta;
    }

    setDisplayYaw(displayYawRef.current);
    onDisplayYawChange?.(displayYawRef.current);
    applyOpacities(colorProgressRef.current);

    // ── TEMP DIAGNOSTIC: only fire on truly suspicious events ──────────────
    {
      const p = colorProgressRef.current;
      const c = confirmedRef.current !== null;
      const prevP = dbgPrevProgressRef.current;
      const prevC = dbgPrevConfirmedRef.current;
      // Suspicious = progress moves > 0.2 in a single frame OR confirmed flips
      const progressJump = prevP >= 0 && Math.abs(p - prevP) > 0.2;
      const confirmedFlip = prevC !== null && prevC !== c;
      if (progressJump || confirmedFlip) {
        console.log(
          "[DIAG][SUSPECT]",
          progressJump ? "PROGRESS-JUMP" : "",
          confirmedFlip ? "BRANCH-FLIP" : "",
          "progress", prevP.toFixed(2), "→", p.toFixed(2),
          "| confirmed", prevC, "→", c,
          "| absDelta=", absDelta.toFixed(3),
          "| isIdle=", isIdle,
          "| pendingReset=", pendingIdleResetRef.current,
          "| idleResetCalled=", idleResetCalledRef.current,
        );
      }
      dbgPrevProgressRef.current = p;
      dbgPrevConfirmedRef.current = c;
    }

    // ── Inner helper: drive scene visibility ────────────────────────────────
    function applyOpacities(progress: number) {
      if (confirmedRef.current !== null && coloringMaterial && coloringFrontScene && coloringBackScene) {
        setSceneOpacity(frontPair.fadedScene,    frontPair.fadedMaterials,    1);
        setSceneOpacity(frontPair.recoloredScene,frontPair.recoloredMaterials,0);
        setSceneOpacity(backPair.fadedScene,     backPair.fadedMaterials,     1);
        setSceneOpacity(backPair.recoloredScene, backPair.recoloredMaterials, 0);
        setColoringOpacity(coloringMaterial, coloringFrontScene, coloringBackScene, progress);
      } else {
        // faded stays fully opaque; recolored fades in on top — composite is always opaque
        setSceneOpacity(frontPair.fadedScene,    frontPair.fadedMaterials,    1);
        setSceneOpacity(frontPair.recoloredScene,frontPair.recoloredMaterials,progress);
        setSceneOpacity(backPair.fadedScene,     backPair.fadedMaterials,     1);
        setSceneOpacity(backPair.recoloredScene, backPair.recoloredMaterials, progress);
        if (coloringMaterial && coloringFrontScene && coloringBackScene) {
          setColoringOpacity(coloringMaterial, coloringFrontScene, coloringBackScene, 0);
        }
      }
    }
  });

  const config = STATUE_CONFIGS[statueIndex];

  return (
    <group>
      <group position={[-1.4, 0, 0]}>
        <Pedestal metrics={metrics} />
        <ModelView
          pair={frontPair}
          coloringScene={coloringFrontScene}
          position={[0, MODEL_POSITION_Y, 0]}
          baseYaw={config.baseYaw ?? 0}
          yaw={displayYaw}
          modelRotation={config.modelRotation}
          scale={activeScale}
        />
      </group>

      <group position={[1.4, 0, 0]}>
        <Pedestal metrics={metrics} />
        <ModelView
          pair={backPair}
          coloringScene={coloringBackScene}
          position={[0, MODEL_POSITION_Y, 0]}
          baseYaw={(config.baseYaw ?? 0) + Math.PI}
          yaw={displayYaw}
          modelRotation={config.modelRotation}
          scale={activeScale}
        />
      </group>
    </group>
  );
}
