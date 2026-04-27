"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function Sculpture() {
  const gltf = useGLTF("/models/bhuta-sculpture.glb");

  return (
    <primitive
      object={gltf.scene}
      scale={1.2}
      position={[0, 0.75, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
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

export default function Scene() {
  return (
    <div className="h-screen w-screen bg-black">
      <Canvas camera={{ position: [0, 1.0, 4], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={2} />

        <group position={[0, -0.6, 0]}>
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
    </div>
  );
}