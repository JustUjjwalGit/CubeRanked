import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdaptiveDpr,
  Environment,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import { useMemo, useState, useEffect, useRef } from "react";
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
  cameraMode?: "competitive" | "free-orbit";
  cameraInvertVertical?: boolean;
  cameraSensitivity?: number;
  cameraZoomSpeed?: number;
  showVisuals?: boolean;
}

export default function CubeScene({
  theme = "dark",
  className = "",
  cube,
  activeMove,
  onFrame,
  interactive = true,
  compact = false,
  cameraMode = "competitive",
  cameraInvertVertical = false,
  cameraSensitivity = 1.0,
  cameraZoomSpeed = 1.0,
  showVisuals = false,
}: CubeSceneProps) {
  const background = theme === "dark" ? "#070b12" : "#eef2f7";
  const cameraPosition: [number, number, number] = compact ? [4.8, 3.7, 5.2] : [5.6, 4.4, 6.2];
  const cameraFov = compact ? 42 : 38;

  const [targetPreset, setTargetPreset] = useState<string | null>(null);

  // Hotkey listener for camera presets
  useEffect(() => {
    if (compact || !interactive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in a text field
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.hasAttribute("contenteditable")
      ) {
        return;
      }

      const key = event.key;
      const isAlt = event.altKey;

      if (key === "1" || (isAlt && key === "1")) {
        event.preventDefault();
        setTargetPreset("front");
      } else if (key === "2" || (isAlt && key === "2")) {
        event.preventDefault();
        setTargetPreset("top");
      } else if (key === "3" || (isAlt && key === "3")) {
        event.preventDefault();
        setTargetPreset("right");
      } else if (key === "4" || (isAlt && key === "4")) {
        event.preventDefault();
        setTargetPreset("isometric");
      } else if (key === "5" || (isAlt && key === "5")) {
        event.preventDefault();
        setTargetPreset("reset");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [compact, interactive]);

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
        <CubeModel cube={cube} activeMove={activeMove} showVisuals={showVisuals} />
        <Environment preset="city" />
        <AdaptiveDpr pixelated />
        
        <CameraManager
          cameraMode={cameraMode}
          invertVertical={cameraInvertVertical}
          mouseSensitivity={cameraSensitivity}
          zoomSpeed={cameraZoomSpeed}
          compact={compact}
          preset={targetPreset}
          onPresetDone={() => setTargetPreset(null)}
        />
      </Canvas>

      {/* Floating camera preset buttons (only show if interactive and not compact) */}
      {interactive && !compact && (
        <div className="camera-presets-panel">
          <div className="camera-presets-header">Camera</div>
          <div className="camera-presets-row">
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => setTargetPreset("front")}
              title="Front View (Hotkey: 1)"
            >
              Front
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => setTargetPreset("top")}
              title="Top View (Hotkey: 2)"
            >
              Top
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => setTargetPreset("right")}
              title="Right View (Hotkey: 3)"
            >
              Right
            </button>
            <button
              type="button"
              className="camera-preset-btn"
              onClick={() => setTargetPreset("isometric")}
              title="Isometric View (Hotkey: 4)"
            >
              Iso
            </button>
            <button
              type="button"
              className="camera-preset-btn reset"
              onClick={() => setTargetPreset("reset")}
              title="Reset View (Hotkey: 5)"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CameraManager({
  cameraMode,
  invertVertical,
  mouseSensitivity,
  zoomSpeed,
  compact,
  preset,
  onPresetDone,
}: {
  cameraMode: "competitive" | "free-orbit";
  invertVertical: boolean;
  mouseSensitivity: number;
  zoomSpeed: number;
  compact: boolean;
  preset: string | null;
  onPresetDone: () => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  // Track animation targets
  const transitionRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    progress: number;
  } | null>(null);

  // Apply camera settings dynamically
  useEffect(() => {
    const activeControls = controlsRef.current;
    if (!activeControls) return;

    activeControls.zoomSpeed = zoomSpeed * 1.0;
    activeControls.rotateSpeed = mouseSensitivity * 0.7;

    // Override rotateUp to support vertical inversion
    activeControls.rotateUp = function (angle: number) {
      const sign = invertVertical ? 1 : -1;
      this.sphericalDelta.phi += angle * sign;
    };
  }, [invertVertical, mouseSensitivity, zoomSpeed]);

  // Handle preset transitions
  useEffect(() => {
    if (!preset) return;

    let targetPos: [number, number, number] = compact ? [4.8, 3.7, 5.2] : [5.6, 4.4, 6.2];

    if (preset === "front") {
      targetPos = [0, 0, 8.5];
    } else if (preset === "top") {
      targetPos = [0.001, 8.5, 0]; // slight offset to prevent gimbal lock
    } else if (preset === "right") {
      targetPos = [8.5, 0, 0];
    } else if (preset === "isometric" || preset === "reset") {
      targetPos = compact ? [4.8, 3.7, 5.2] : [5.6, 4.4, 6.2];
    }

    const endPosVector = new THREE.Vector3(...targetPos);
    const endTargetVector = new THREE.Vector3(0, 0, 0);

    transitionRef.current = {
      active: true,
      startPos: camera.position.clone(),
      endPos: endPosVector,
      startTarget: controlsRef.current ? controlsRef.current.target.clone() : new THREE.Vector3(0, 0, 0),
      endTarget: endTargetVector,
      progress: 0,
    };

    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }

    onPresetDone();
  }, [preset, camera, compact, onPresetDone]);

  // If cameraMode changes to competitive, fly back to default and lock
  useEffect(() => {
    if (cameraMode === "competitive") {
      const targetPos: [number, number, number] = compact ? [4.8, 3.7, 5.2] : [5.6, 4.4, 6.2];
      const endPosVector = new THREE.Vector3(...targetPos);
      const endTargetVector = new THREE.Vector3(0, 0, 0);

      transitionRef.current = {
        active: true,
        startPos: camera.position.clone(),
        endPos: endPosVector,
        startTarget: controlsRef.current ? controlsRef.current.target.clone() : new THREE.Vector3(0, 0, 0),
        endTarget: endTargetVector,
        progress: 0,
      };

      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
    } else {
      if (controlsRef.current && !(transitionRef.current?.active)) {
        controlsRef.current.enabled = true;
      }
    }
  }, [cameraMode, camera, compact]);

  useFrame((_, delta) => {
    const trans = transitionRef.current;
    if (trans && trans.active) {
      trans.progress = Math.min(1, trans.progress + delta * 2.5); // transition over ~0.4s
      const eased = easeInOutCubic(trans.progress);

      camera.position.lerpVectors(trans.startPos, trans.endPos, eased);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(trans.startTarget, trans.endTarget, eased);
        controlsRef.current.update();
      }

      if (trans.progress >= 1) {
        trans.active = false;
        if (controlsRef.current) {
          controlsRef.current.enabled = (cameraMode === "free-orbit");
        }
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={cameraMode === "free-orbit" && !(transitionRef.current?.active)}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.8}
      maxDistance={40.0}
      target={[0, 0, 0]}
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

function CubeModel({
  cube,
  activeMove,
  showVisuals,
}: {
  cube?: CubeState;
  activeMove?: SceneActiveMove | null;
  showVisuals: boolean;
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
            isMoving={moving}
            showVisuals={showVisuals}
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
  const rotation = getRotationForNormal(normal);

  // If quarterTurns > 0, it's clockwise.
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
      {/* Curved Arc */}
      <mesh rotation={[Math.PI / 2, 0, isClockwise ? -Math.PI / 2 : -Math.PI / 2]}>
        <torusGeometry args={[radius, 0.045, 8, 32, arcLength]} />
        <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={0.8} toneMapped={false} />
      </mesh>
      
      {/* Arrow Head */}
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
}

function Cubie({
  cubie,
  position,
  quaternion,
  isMoving,
  showVisuals,
}: CubieProps & { isMoving: boolean; showVisuals: boolean }) {
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
        <StickerPanel
          key={`${cubie.id}-${sticker.face}`}
          sticker={sticker}
          isMoving={isMoving}
          showVisuals={showVisuals}
        />
      ))}
    </group>
  );
}

function StickerPanel({
  sticker,
  isMoving,
  showVisuals,
}: {
  sticker: Sticker;
  isMoving: boolean;
  showVisuals: boolean;
}) {
  const { position, size } = useMemo(() => getStickerTransform(sticker.normal), [sticker.normal]);
  const emissiveIntensity = showVisuals && isMoving ? 0.38 : 0.025;
  const colorOffset = showVisuals && isMoving ? "#ffffff" : sticker.color;

  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={sticker.color}
        roughness={0.44}
        metalness={0.04}
        emissive={colorOffset}
        emissiveIntensity={emissiveIntensity}
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
