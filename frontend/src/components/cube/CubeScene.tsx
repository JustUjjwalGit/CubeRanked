import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdaptiveDpr,
  Environment,
  RoundedBox,
  OrbitControls,
} from "@react-three/drei";
import { useMemo, useEffect, useRef } from "react";
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
} from "../../utils/cubeEngine";
import { useCubeStore } from "../../state/cubeStore";
import { audioManager } from "../../utils/audioManager";
import type { Face } from "../../utils/cubeEngine";
import type { CubeStyle } from "../../utils/sessionStats";

const CUBIE_SIZE = 0.92;
const CUBIE_SPACING = 0.98;
const STICKER_SIZE = 0.68;
const STICKER_DEPTH = 0.032;
const STICKER_OFFSET = CUBIE_SIZE / 2 + STICKER_DEPTH / 2 + 0.004;

const FACE_NORMALS: Record<string, Vec3> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

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
  cameraMode?: "competitive" | "free-rotation";
  showVisuals?: boolean;
  cubeStyle?: CubeStyle;
  reducedMotion?: boolean;
}

const FACE_CAMERA_POSITIONS: Record<Face, [number, number, number]> = {
  F: [5.6, 4.4, 6.2],
  R: [6.2, 4.4, -5.6],
  L: [-6.2, 4.4, 5.6],
  B: [-5.6, 4.4, -6.2],
  U: [5.6, 6.2, -4.4],
  D: [5.6, -6.2, 4.4],
};

const FACE_CAMERA_POSITIONS_COMPACT: Record<Face, [number, number, number]> = {
  F: [4.8, 3.7, 5.2],
  R: [5.2, 3.7, -4.8],
  L: [-5.2, 3.7, 4.8],
  B: [-4.8, 3.7, -5.2],
  U: [4.8, 5.2, -3.7],
  D: [4.8, -5.2, 3.7],
};

const FACE_NORMALS_ARRAY: Array<{ face: Face; normal: THREE.Vector3 }> = [
  { face: "F", normal: new THREE.Vector3(0, 0, 1) },
  { face: "B", normal: new THREE.Vector3(0, 0, -1) },
  { face: "R", normal: new THREE.Vector3(1, 0, 0) },
  { face: "L", normal: new THREE.Vector3(-1, 0, 0) },
  { face: "U", normal: new THREE.Vector3(0, 1, 0) },
  { face: "D", normal: new THREE.Vector3(0, -1, 0) },
];

function deriveFaceFromCameraPosition(
  cameraPos: THREE.Vector3,
): Face {
  const dir = cameraPos.clone().normalize();
  let bestFace: Face = "F";
  let bestDot = -Infinity;

  for (const { face, normal } of FACE_NORMALS_ARRAY) {
    const dot = normal.dot(dir);
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = face;
    }
  }

  return bestFace;
}

export default function CubeScene({
  theme = "dark",
  className = "",
  cube,
  activeMove,
  onFrame,
  interactive = true,
  compact = false,
  cameraMode = "free-rotation",
  showVisuals = false,
  cubeStyle = "classic",
  reducedMotion = false,
}: CubeSceneProps) {
  const background = theme === "dark" ? "#070b12" : "#eef2f7";
  const currentViewFace = useCubeStore((state) => state.currentViewFace);
  const setViewFace = useCubeStore((state) => state.setViewFace);
  const cameraPosition: [number, number, number] = compact
    ? [4.8, 3.7, 5.2]
    : [5.6, 4.4, 6.2];
  const cameraFov = compact ? 42 : 38;

  const viewButtons: Array<{ face: Face; color: string; label: string; key: string }> = [
    { face: "F", color: "#22c55e", label: "Green", key: "1" },
    { face: "L", color: "#f97316", label: "Orange", key: "2" },
    { face: "R", color: "#ef4444", label: "Red", key: "3" },
    { face: "B", color: "#3b82f6", label: "Blue", key: "4" },
    { face: "U", color: "#f8fafc", label: "White", key: "5" },
    { face: "D", color: "#facc15", label: "Yellow", key: "6" },
  ];

  return (
    <div
      className={`cube-stage ${compact ? "cube-stage-compact" : ""} ${className} ${cameraMode === "free-rotation" ? "cube-draggable" : ""}`}
      aria-label="Interactive 3D Rubik's Cube"
    >
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
        <CubeModel cube={cube} activeMove={activeMove} showVisuals={showVisuals} cubeStyle={cubeStyle} />
        <CameraManager
          compact={compact}
          interactive={interactive}
          cameraMode={cameraMode}
        />
        <Environment preset="city" />
        <AdaptiveDpr pixelated />
      </Canvas>

      {/* View selector buttons at bottom center */}
      {interactive && !compact && (
        <div className="view-selector">
          {viewButtons.map(({ face, color, label, key }) => (
            <button
              key={face}
              type="button"
              className={`view-selector-btn ${currentViewFace === face ? "active" : ""}`}
              style={{ "--face-color": color } as React.CSSProperties}
              onClick={() => setViewFace(face)}
              title={`${label} (${key})`}
            >
              <span className="view-selector-key">{key}</span>
              <span className="view-selector-swatch" />
              <span className="view-selector-label">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CameraManager({
  compact,
  interactive,
  cameraMode,
}: {
  compact: boolean;
  interactive: boolean;
  cameraMode: "competitive" | "free-rotation";
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const viewFaceTarget = useCubeStore((state) => state.viewFaceTarget);
  const setCurrentViewFace = useCubeStore((state) => state.setCurrentViewFace);
  const lastVersion = useRef(viewFaceTarget.version);
  const isDragging = useRef(false);
  const lastDragSound = useRef(0);

  useEffect(() => {
    if (viewFaceTarget.version === lastVersion.current) return;
    lastVersion.current = viewFaceTarget.version;

    const positions = compact ? FACE_CAMERA_POSITIONS_COMPACT : FACE_CAMERA_POSITIONS;
    const pos = positions[viewFaceTarget.face];

    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(0, 0, 0);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [viewFaceTarget.version, viewFaceTarget.face, compact, camera]);

  useFrame(() => {
    const face = deriveFaceFromCameraPosition(camera.position);
    setCurrentViewFace(face);

    // Soft friction sound during drag
    if (isDragging.current) {
      const now = performance.now();
      if (now - lastDragSound.current > 180) {
        lastDragSound.current = now;
        audioManager.playCubeDrag();
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom={true}
      enableRotate={interactive && !compact && cameraMode === "free-rotation"}
      target={[0, 0, 0]}
      minDistance={compact ? 6 : 7}
      maxDistance={compact ? 14 : 16}
      onStart={() => { isDragging.current = true; }}
      onEnd={() => { isDragging.current = false; }}
    />
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

const CUBE_STYLE_PROPS: Record<CubeStyle, {
  bodyColor: string;
  bodyRoughness: number;
  bodyMetalness: number;
  bevelRadius: number;
  stickerRoughness: number;
  stickerMetalness: number;
  stickerSize: number;
}> = {
  classic: { bodyColor: "#151923", bodyRoughness: 0.62, bodyMetalness: 0.1, bevelRadius: 0.045, stickerRoughness: 0.44, stickerMetalness: 0.04, stickerSize: 0.68 },
  speedcube: { bodyColor: "#1a1f2e", bodyRoughness: 0.35, bodyMetalness: 0.15, bevelRadius: 0.025, stickerRoughness: 0.25, stickerMetalness: 0.08, stickerSize: 0.72 },
  stickerless: { bodyColor: "#1e2433", bodyRoughness: 0.5, bodyMetalness: 0.05, bevelRadius: 0.035, stickerRoughness: 0.35, stickerMetalness: 0.02, stickerSize: 0.78 },
  minimal: { bodyColor: "#11151f", bodyRoughness: 0.7, bodyMetalness: 0.0, bevelRadius: 0.015, stickerRoughness: 0.5, stickerMetalness: 0.0, stickerSize: 0.74 },
};

function CubeModel({
  cube,
  activeMove,
  showVisuals,
  cubeStyle = "classic",
}: {
  cube?: CubeState;
  activeMove?: SceneActiveMove | null;
  showVisuals: boolean;
  cubeStyle?: CubeStyle;
}) {
  const storeCube = useCubeStore((state) => state.cube);
  const storeActiveMove = useCubeStore((state) => state.activeMove);
  const currentCube = cube ?? storeCube;
  const currentActiveMove = activeMove !== undefined ? activeMove : storeActiveMove;
  const renderCube = currentActiveMove?.startCube ?? currentCube;
  const progress = easeInOutCubic(currentActiveMove?.progress ?? 0);
  const angle = currentActiveMove ? currentActiveMove.move.quarterTurns * (Math.PI / 2) * progress : 0;

  const styleProps = CUBE_STYLE_PROPS[cubeStyle];

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
            isMoving={moving}
            showVisuals={showVisuals}
            styleProps={styleProps}
          />
        );
      })}

      {showVisuals && currentActiveMove && (
        <RotationArrow
          face={currentActiveMove.move.face}
          quarterTurns={currentActiveMove.move.quarterTurns}
        />
      )}
    </group>
  );
}

function getRotationForNormal(normal: [number, number, number]): [number, number, number] {
  const [x, y, z] = normal;
  if (x === 1) return [0, 0, -Math.PI / 2]; // R
  if (x === -1) return [0, 0, Math.PI / 2]; // L
  if (y === 1) return [0, 0, 0];            // U
  if (y === -1) return [Math.PI, 0, 0];     // D
  if (z === 1) return [Math.PI / 2, 0, 0];  // F
  if (z === -1) return [-Math.PI / 2, 0, 0];// B
  return [0, 0, 0];
}

function RotationArrow({ face, quarterTurns }: { face: string; quarterTurns: number }) {
  const normal = FACE_NORMALS[face];
  if (!normal) return null;
  const center: [number, number, number] = [normal[0] * 1.62, normal[1] * 1.62, normal[2] * 1.62];
  const rotation = getRotationForNormal([normal[0], normal[1], normal[2]]);

  const isClockwise = quarterTurns > 0;
  
  const arcLength = Math.PI;
  const endAngle = isClockwise ? Math.PI / 2 : -Math.PI / 2;

  const radius = 1.05;
  const arrowX = radius * Math.cos(endAngle);
  const arrowZ = radius * Math.sin(endAngle);
  
  const tangentX = -Math.sin(endAngle) * (isClockwise ? 1 : -1);
  const tangentZ = Math.cos(endAngle) * (isClockwise ? 1 : -1);
  const arrowRotY = Math.atan2(tangentX, tangentZ);

  return (
    <group position={center} rotation={rotation}>
      <mesh rotation={[Math.PI / 2, 0, isClockwise ? -Math.PI / 2 : -Math.PI / 2]}>
        <torusGeometry args={[radius, 0.045, 8, 32, arcLength]} />
        <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      
      <mesh position={[arrowX, 0, arrowZ]} rotation={[0, arrowRotY, 0]}>
        <coneGeometry args={[0.13, 0.3, 16]} />
        <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

interface CubieProps {
  cubie: CubieType;
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  isMoving: boolean;
  showVisuals: boolean;
  styleProps: typeof CUBE_STYLE_PROPS.classic;
}

function Cubie({
  cubie,
  position,
  quaternion,
  isMoving,
  showVisuals,
  styleProps,
}: CubieProps) {
  return (
    <group position={position} quaternion={quaternion}>
      <RoundedBox
        args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]}
        radius={styleProps.bevelRadius}
        smoothness={5}
      >
        <meshStandardMaterial
          color={styleProps.bodyColor}
          roughness={styleProps.bodyRoughness}
          metalness={styleProps.bodyMetalness}
        />
      </RoundedBox>

      {cubie.stickers.map((sticker) => (
        <StickerPanel
          key={`${cubie.id}-${sticker.face}`}
          sticker={sticker}
          isMoving={isMoving}
          showVisuals={showVisuals}
          stickerSize={styleProps.stickerSize}
          stickerRoughness={styleProps.stickerRoughness}
          stickerMetalness={styleProps.stickerMetalness}
        />
      ))}
    </group>
  );
}

function StickerPanel({
  sticker,
  isMoving,
  showVisuals,
  stickerSize = 0.68,
  stickerRoughness = 0.44,
  stickerMetalness = 0.04,
}: {
  sticker: Sticker;
  isMoving: boolean;
  showVisuals: boolean;
  stickerSize?: number;
  stickerRoughness?: number;
  stickerMetalness?: number;
}) {
  const { position, size } = useMemo(
    () => getStickerTransform(sticker.normal, stickerSize),
    [sticker.normal, stickerSize],
  );
  const emissiveIntensity = showVisuals && isMoving ? 0.38 : 0.025;
  const colorOffset = showVisuals && isMoving ? "#ffffff" : sticker.color;

  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={sticker.color}
        roughness={stickerRoughness}
        metalness={stickerMetalness}
        emissive={colorOffset}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function getStickerTransform(normal: Vec3, stickerSize = STICKER_SIZE): {
  position: [number, number, number];
  size: [number, number, number];
} {
  if (normal[0] !== 0) {
    return {
      position: [normal[0] * STICKER_OFFSET, 0, 0],
      size: [STICKER_DEPTH, stickerSize, stickerSize],
    };
  }

  if (normal[1] !== 0) {
    return {
      position: [0, normal[1] * STICKER_OFFSET, 0],
      size: [stickerSize, STICKER_DEPTH, stickerSize],
    };
  }

  return {
    position: [0, 0, normal[2] * STICKER_OFFSET],
    size: [stickerSize, stickerSize, STICKER_DEPTH],
  };
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}
