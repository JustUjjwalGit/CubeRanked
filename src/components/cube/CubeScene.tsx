import { Canvas, useFrame } from "@react-three/fiber";
import {
  AdaptiveDpr,
  Environment,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import {
  axisToVector,
  isCubieInMove,
  rotateVectorByAngle,
  type Cubie as CubieType,
  type Sticker,
  type Vec3,
} from "../../lib/cubeEngine";
import { useCubeStore } from "../../state/cubeStore";

const CUBIE_SIZE = 0.92;
const CUBIE_SPACING = 0.98;
const STICKER_SIZE = 0.68;
const STICKER_DEPTH = 0.032;
const STICKER_OFFSET = CUBIE_SIZE / 2 + STICKER_DEPTH / 2 + 0.004;

export default function CubeScene() {
  return (
    <div className="cube-stage" aria-label="Interactive 3D Rubik's Cube">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ position: [5.6, 4.4, 6.2], fov: 38, near: 0.1, far: 100 }}
      >
        <color attach="background" args={["#eef2f7"]} />
        <fog attach="fog" args={["#eef2f7", 10, 22]} />
        <hemisphereLight args={["#ffffff", "#a8b3c7", 2.1]} />
        <directionalLight
          position={[4, 8, 5]}
          intensity={2.6}
        />
        <directionalLight position={[-5, 2, -3]} intensity={0.8} color="#8ec5ff" />
        <CubeAnimator />
        <CubeModel />
        <Environment preset="city" />
        <AdaptiveDpr pixelated />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          minDistance={4.8}
          maxDistance={10}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}

function CubeAnimator() {
  const tick = useCubeStore((state) => state.tick);

  useFrame((_, delta) => {
    tick(Math.min(delta, 0.05));
  });

  return null;
}

function CubeModel() {
  const cube = useCubeStore((state) => state.cube);
  const activeMove = useCubeStore((state) => state.activeMove);
  const renderCube = activeMove?.startCube ?? cube;
  const progress = easeInOutCubic(activeMove?.progress ?? 0);
  const angle = activeMove ? activeMove.move.quarterTurns * (Math.PI / 2) * progress : 0;

  return (
    <group position={[0, 0.1, 0]} rotation={[-0.08, -0.18, 0.02]}>
      {renderCube.map((cubie) => {
        const moving = activeMove ? isCubieInMove(cubie, activeMove.move) : false;
        const visualPosition = moving
          ? rotateVectorByAngle(cubie.position, activeMove!.move.axis, angle)
          : cubie.position;
        const axisVector = activeMove ? axisToVector(activeMove.move.axis) : [0, 1, 0];
        const quaternion = new THREE.Quaternion();

        if (moving) {
          quaternion.setFromAxisAngle(new THREE.Vector3(...axisVector), angle);
        }

        return (
          <Cubie
            key={cubie.id}
            cubie={cubie}
            position={[
              visualPosition[0] * CUBIE_SPACING,
              visualPosition[1] * CUBIE_SPACING,
              visualPosition[2] * CUBIE_SPACING,
            ]}
            quaternion={quaternion}
          />
        );
      })}
    </group>
  );
}

interface CubieProps {
  cubie: CubieType;
  position: [number, number, number];
  quaternion: THREE.Quaternion;
}

function Cubie({ cubie, position, quaternion }: CubieProps) {
  return (
    <group position={position} quaternion={quaternion}>
      <RoundedBox
        args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]}
        radius={0.045}
        smoothness={5}
      >
        <meshStandardMaterial color="#151923" roughness={0.62} metalness={0.1} />
      </RoundedBox>

      {cubie.stickers.map((sticker) => (
        <StickerPanel key={`${cubie.id}-${sticker.face}`} sticker={sticker} />
      ))}
    </group>
  );
}

function StickerPanel({ sticker }: { sticker: Sticker }) {
  const { position, size } = useMemo(() => getStickerTransform(sticker.normal), [sticker.normal]);

  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={sticker.color}
        roughness={0.44}
        metalness={0.04}
        emissive={sticker.color}
        emissiveIntensity={0.025}
      />
    </mesh>
  );
}

function getStickerTransform(normal: Vec3): {
  position: [number, number, number];
  size: [number, number, number];
} {
  if (normal[0] !== 0) {
    return {
      position: [normal[0] * STICKER_OFFSET, 0, 0],
      size: [STICKER_DEPTH, STICKER_SIZE, STICKER_SIZE],
    };
  }

  if (normal[1] !== 0) {
    return {
      position: [0, normal[1] * STICKER_OFFSET, 0],
      size: [STICKER_SIZE, STICKER_DEPTH, STICKER_SIZE],
    };
  }

  return {
    position: [0, 0, normal[2] * STICKER_OFFSET],
    size: [STICKER_SIZE, STICKER_SIZE, STICKER_DEPTH],
  };
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}
