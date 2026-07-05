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
  type CubeState,
  type Move,
  type Sticker,
  type Vec3,
} from "../../lib/cubeEngine";
import { useCubeStore } from "../../state/cubeStore";

const CUBIE_SIZE = 0.92;
const CUBIE_SPACING = 0.98;
const STICKER_SIZE = 0.68;
const STICKER_DEPTH = 0.032;
const STICKER_OFFSET = CUBIE_SIZE / 2 + STICKER_DEPTH / 2 + 0.004;

interface SceneActiveMove {
  move: Move;
  startCube: CubeState;
  progress: number;
}

interface CubeSceneProps {
  theme?: "dark" | "light";
  className?: string;
  cube?: CubeState;
  activeMove?: SceneActiveMove | null;
  onFrame?: (deltaSeconds: number) => void;
  interactive?: boolean;
  compact?: boolean;
}

export default function CubeScene({
  theme = "dark",
  className = "",
  cube,
  activeMove,
  onFrame,
  interactive = true,
  compact = false,
}: CubeSceneProps) {
  const background = theme === "dark" ? "#070b12" : "#eef2f7";
  const cameraPosition: [number, number, number] = compact ? [4.8, 3.7, 5.2] : [5.6, 4.4, 6.2];
  const cameraFov = compact ? 42 : 38;

  return (
    <div className={`cube-stage ${compact ? "cube-stage-compact" : ""} ${className}`} aria-label="Interactive 3D Rubik's Cube">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ position: cameraPosition, fov: cameraFov, near: 0.1, far: 100 }}
      >
        <color attach="background" args={[background]} />
        <fog attach="fog" args={[background, 10, 22]} />
        <hemisphereLight args={["#ffffff", "#a8b3c7", 2.1]} />
        <directionalLight
          position={[4, 8, 5]}
          intensity={2.6}
        />
        <directionalLight position={[-5, 2, -3]} intensity={0.8} color="#8ec5ff" />
        <CubeAnimator onFrame={onFrame} tickPlayerCube={cube === undefined} />
        <CubeModel cube={cube} activeMove={activeMove} />
        <Environment preset="city" />
        <AdaptiveDpr pixelated />
        <OrbitControls
          makeDefault
          enabled={interactive}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          minDistance={compact ? 4.2 : 4.8}
          maxDistance={compact ? 8 : 10}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}

function CubeAnimator({
  onFrame,
  tickPlayerCube,
}: {
  onFrame?: (deltaSeconds: number) => void;
  tickPlayerCube: boolean;
}) {
  const tick = useCubeStore((state) => state.tick);

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.05);

    if (tickPlayerCube) {
      tick(clampedDelta);
    }

    onFrame?.(clampedDelta);
  });

  return null;
}

function CubeModel({
  cube,
  activeMove,
}: {
  cube?: CubeState;
  activeMove?: SceneActiveMove | null;
}) {
  const storeCube = useCubeStore((state) => state.cube);
  const storeActiveMove = useCubeStore((state) => state.activeMove);
  const currentCube = cube ?? storeCube;
  const currentActiveMove = activeMove !== undefined ? activeMove : storeActiveMove;
  const renderCube = currentActiveMove?.startCube ?? currentCube;
  const progress = easeInOutCubic(currentActiveMove?.progress ?? 0);
  const angle = currentActiveMove ? currentActiveMove.move.quarterTurns * (Math.PI / 2) * progress : 0;

  return (
    <group position={[0, 0.1, 0]} rotation={[-0.08, -0.18, 0.02]}>
      {renderCube.map((cubie) => {
        const moving = currentActiveMove ? isCubieInMove(cubie, currentActiveMove.move) : false;
        const visualPosition = moving
          ? rotateVectorByAngle(cubie.position, currentActiveMove!.move.axis, angle)
          : cubie.position;
        const axisVector = currentActiveMove ? axisToVector(currentActiveMove.move.axis) : [0, 1, 0];
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
