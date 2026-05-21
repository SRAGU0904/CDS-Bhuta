"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { STATUE_CONFIGS } from "./config";
import {
  MODEL_POSITION_Y,
  type ColoringModeState,
  type RegionFocus,
} from "./types";
import { Pedestal } from "./DualSculpture";
import { computeActiveScale, computeMetrics } from "./modelPair";
import {
  applySelectionsToMaterial,
  buildColoringMaterial,
  type ColoringUniforms,
} from "./coloringMaterial";

const DEFAULT_CAMERA_FOCUS: RegionFocus = {
  position: [0, 1.0, 5],
  target: [0, 0, 0],
  zoom: 250,
};

function PaintingCamera({ focus }: { focus: RegionFocus | null }) {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(...DEFAULT_CAMERA_FOCUS.target));
  const desiredPosition = useMemo(
    () => new THREE.Vector3(...(focus?.position ?? DEFAULT_CAMERA_FOCUS.position)),
    [focus]
  );
  const desiredTarget = useMemo(
    () => new THREE.Vector3(...(focus?.target ?? DEFAULT_CAMERA_FOCUS.target)),
    [focus]
  );
  const desiredZoom = focus?.zoom ?? DEFAULT_CAMERA_FOCUS.zoom;

  // R3F cameras are imperative Three.js objects; smooth motion is driven per frame.
  // eslint-disable-next-line react-hooks/immutability
  useFrame(() => {
    camera.position.lerp(desiredPosition, 0.08);
    targetRef.current.lerp(desiredTarget, 0.08);
    camera.lookAt(targetRef.current);

    if ("zoom" in camera) {
      // eslint-disable-next-line react-hooks/immutability
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, desiredZoom, 0.08);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function PaintingSculpture({
  statueIndex,
  coloringModeState,
}: {
  statueIndex: number;
  coloringModeState: ColoringModeState;
}) {
  const fadedPanjurli = useGLTF("/models/Panjurli_faded.glb");
  const fadedNandigona = useGLTF("/models/Nandigona_faded.glb");
  const fadedAmmanavaru = useGLTF("/models/Ammanavaru_faded.glb");
  const panjurliPartIDTexture = useTexture("/models/Panjurli_MaskColorMap.png");
  const nandigonaPartIDTexture = useTexture("/models/Nandigona_MaskColorMap.png");
  const ammanavaruPartIDTexture = useTexture("/models/Ammanavaru_MaskColorMap.png");

  const { scene, metrics, activeScale, coloringUniforms } = useMemo(() => {
    const config = STATUE_CONFIGS[statueIndex];
    const sourceScene =
      config.id === "panjurli"
        ? fadedPanjurli.scene
        : config.id === "nandigona"
          ? fadedNandigona.scene
          : config.id === "ammanavaru"
            ? fadedAmmanavaru.scene
            : fadedPanjurli.scene;
    const sourceTexture =
      config.id === "panjurli"
        ? panjurliPartIDTexture
        : config.id === "nandigona"
          ? nandigonaPartIDTexture
          : config.id === "ammanavaru"
            ? ammanavaruPartIDTexture
            : null;

    const activeScale = computeActiveScale(sourceScene, config);
    const metrics = computeMetrics(sourceScene, config, activeScale);
    const scene = sourceScene.clone(true);
    let coloringUniforms: ColoringUniforms | null = null;
    let sourceMat: THREE.MeshStandardMaterial | null = null;

    scene.traverse((child) => {
      if (sourceMat || !(child instanceof THREE.Mesh)) return;
      const mat = Array.isArray(child.material) ? child.material[0] : child.material;
      if (mat instanceof THREE.MeshStandardMaterial) sourceMat = mat;
    });

    if (sourceTexture && sourceMat) {
      const partIDTexture = sourceTexture.clone();
      partIDTexture.flipY = false;
      partIDTexture.needsUpdate = true;

      const result = buildColoringMaterial(sourceMat, partIDTexture);
      coloringUniforms = result.colorUniforms;

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = result.material;
          child.frustumCulled = false;
          child.renderOrder = 3;
        }
      });
    }

    return { scene, metrics, activeScale, coloringUniforms };
  }, [
    fadedPanjurli.scene,
    fadedNandigona.scene,
    fadedAmmanavaru.scene,
    panjurliPartIDTexture,
    nandigonaPartIDTexture,
    ammanavaruPartIDTexture,
    statueIndex,
  ]);

  useEffect(() => {
    const config = STATUE_CONFIGS[statueIndex];
    if (!config.regions || !coloringUniforms) return;
    applySelectionsToMaterial(
      coloringUniforms,
      config.regions,
      coloringModeState.selections
    );
  }, [coloringModeState.selections, coloringUniforms, statueIndex]);

  const config = STATUE_CONFIGS[statueIndex];

  return (
    <group position={[0, -0.2, 0]}>
      <Pedestal metrics={metrics} />
      <group
        position={[0, MODEL_POSITION_Y, 0]}
        rotation={[0, config.baseYaw ?? 0, 0]}
      >
        <group scale={activeScale} rotation={config.modelRotation}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

function PaintingCanvas({
  statueIndex,
  coloringModeState,
  focus,
}: {
  statueIndex: number;
  coloringModeState: ColoringModeState;
  focus: RegionFocus | null;
}) {
  return (
    <Canvas
      className="h-full w-full"
      orthographic
      gl={{ alpha: true }}
      onCreated={({ gl }) => gl.setClearColor("#000000", 0)}
      camera={{
        position: DEFAULT_CAMERA_FOCUS.position,
        zoom: DEFAULT_CAMERA_FOCUS.zoom,
      }}
    >
      <PaintingCamera focus={focus} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <PaintingSculpture
        statueIndex={statueIndex}
        coloringModeState={coloringModeState}
      />
    </Canvas>
  );
}

export function PaintingSplitView({
  statueIndex,
  coloringModeState,
  focus,
}: {
  statueIndex: number;
  coloringModeState: ColoringModeState;
  focus: RegionFocus | null;
}) {
  const frameClass =
    "pointer-events-none absolute top-1/2 aspect-[9/16] h-[90vh] -translate-y-1/2 overflow-hidden rounded-3xl";

  return (
    <div className="fixed inset-0 z-10">
      <div className={`${frameClass} left-[15vw]`}>
        <PaintingCanvas
          statueIndex={statueIndex}
          coloringModeState={coloringModeState}
          focus={focus}
        />
      </div>
      <div className={`${frameClass} right-[15vw]`}>
        <PaintingCanvas
          statueIndex={statueIndex}
          coloringModeState={coloringModeState}
          focus={focus}
        />
      </div>
    </div>
  );
}
