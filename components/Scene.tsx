"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function collectMaterials(object: THREE.Object3D) {
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

function setSceneOpacity(
  scene: THREE.Object3D,
  materials: THREE.Material[],
  opacity: number
) {
  const safeOpacity = THREE.MathUtils.clamp(opacity, 0, 1);

  scene.visible = safeOpacity > 0.01;

  materials.forEach((mat) => {
    mat.transparent = true;
    mat.depthWrite = false;
    mat.opacity = safeOpacity;
    mat.needsUpdate = true;
  });
}

function getShortestAngleDelta(current: number, previous: number) {
  let delta = current - previous;

  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;

  return delta;
}

function Sculpture({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const fadedGltf = useGLTF("/models/panjurli_faded.glb");
  const recoloredGltf = useGLTF("/models/panjurli_recolored.glb");

  const previousAzimuthRef = useRef<number | null>(null);
  const accumulatedRightRotationRef = useRef(0);

  const { fadedScene, recoloredScene, fadedMaterials, recoloredMaterials } =
    useMemo(() => {
      const fadedScene = fadedGltf.scene.clone(true);
      const recoloredScene = recoloredGltf.scene.clone(true);

      fadedScene.traverse((child) => {
        child.renderOrder = 1;
      });

      recoloredScene.traverse((child) => {
        child.renderOrder = 2;
      });

      const fadedMaterials = collectMaterials(fadedScene);
      const recoloredMaterials = collectMaterials(recoloredScene);

      setSceneOpacity(fadedScene, fadedMaterials, 1);
      setSceneOpacity(recoloredScene, recoloredMaterials, 0);

      return {
        fadedScene,
        recoloredScene,
        fadedMaterials,
        recoloredMaterials,
      };
    }, [fadedGltf.scene, recoloredGltf.scene]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const currentAzimuth = controls.getAzimuthalAngle();

    if (previousAzimuthRef.current === null) {
      previousAzimuthRef.current = currentAzimuth;

      setSceneOpacity(fadedScene, fadedMaterials, 1);
      setSceneOpacity(recoloredScene, recoloredMaterials, 0);

      return;
    }

    const delta = getShortestAngleDelta(
      currentAzimuth,
      previousAzimuthRef.current
    );

    previousAzimuthRef.current = currentAzimuth;

   
    if (delta < 0) {
      accumulatedRightRotationRef.current += Math.abs(delta);
    }

    const fullTurn = Math.PI * 2;

    const phase = (accumulatedRightRotationRef.current / fullTurn) % 2;

    /**
     * phase:
     * 0   = faded
     * 1   = recolored
     * 2   = faded
     */
    const mixValue = phase <= 1 ? phase : 2 - phase;

    setSceneOpacity(fadedScene, fadedMaterials, 1 - mixValue);
    setSceneOpacity(recoloredScene, recoloredMaterials, mixValue);
  });

  return (
    <group
      scale={1.5}
      position={[0, 0.12, 0]}
      rotation={[-Math.PI / 2, Math.PI / 180, 0]}
    >
      <primitive object={fadedScene} />
      <primitive object={recoloredScene} />
    </group>
  );
}

function Pedestal() {
  return (
    <mesh position={[0, -0.35, 0]}>
      <cylinderGeometry args={[1.1, 1.25, 0.25, 64]} />
      <meshStandardMaterial color="#333333" />
    </mesh>
  );
}

function MusicControl() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.35;
    audio.loop = true;

    const playMusic = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };

    playMusic();
  }, []);

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isPlaying) {
      try {
        audio.muted = false;
        await audio.play();
        setIsPlaying(true);
        setIsMuted(false);
      } catch {
        console.log("Audio playback was blocked by the browser.");
      }
      return;
    }

    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/bg-1.mp3" preload="auto" />

      <button
        onClick={toggleMusic}
        className="fixed right-6 top-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl text-white backdrop-blur-md transition hover:bg-black/70"
        aria-label="Toggle music"
      >
        {isPlaying && !isMuted ? "🔊" : "🔇"}
      </button>
    </>
  );
}

export default function Scene() {
  const controlsRef = useRef<any>(null);

  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas camera={{ position: [0, 1.0, 4], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={2} />

        <group position={[0, -0.2, 0]}>
          <Pedestal />
          <Sculpture controlsRef={controlsRef} />
        </group>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={false}
          enableDamping={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

      <MusicControl />
    </div>
  );
}

useGLTF.preload("/models/panjurli_faded.glb");
useGLTF.preload("/models/panjurli_recolored.glb");