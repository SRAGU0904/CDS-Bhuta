"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function Sculpture() {
  const gltf = useGLTF("/models/panjurli.glb");

  return (
    <primitive
      object={gltf.scene}
      scale={1.5}
      position={[0, 0.12, 0]}
      rotation={[-Math.PI / 2 , Math.PI / 180 , 0]}
    />
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
  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas camera={{ position: [0, 1.0, 4], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={2} />

        <group position={[0, -0.2, 0]}>
          <Pedestal />
          <Sculpture />
        </group>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

      <MusicControl />
    </div>
  );
}