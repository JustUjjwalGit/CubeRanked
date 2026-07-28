import { useEffect, useMemo, useState } from "react";
import CubeScene from "./CubeScene";
import { createSolvedCube } from "../../utils/cubeEngine";
import type { CubeStyle } from "../../utils/sessionStats";

const CUBE_STYLES: CubeStyle[] = ["classic", "speedcube", "stickerless", "minimal"];

declare global {
  interface Window {
    __cubePreviewReady?: boolean;
  }
}

export default function CubePreviewCapture() {
  const params = new URLSearchParams(window.location.search);
  const requestedStyle = params.get("style") as CubeStyle | null;
  const cubeStyle = requestedStyle && CUBE_STYLES.includes(requestedStyle) ? requestedStyle : "classic";
  const solvedCube = useMemo(() => createSolvedCube(), []);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    window.__cubePreviewReady = false;
    return () => {
      window.__cubePreviewReady = false;
    };
  }, [cubeStyle]);

  useEffect(() => {
    if (!sceneReady) return;

    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        window.__cubePreviewReady = true;
      });
    });

    return () => {
      window.cancelAnimationFrame(first);
      if (second) window.cancelAnimationFrame(second);
    };
  }, [sceneReady]);

  return (
    <main className="cube-preview-capture-page">
      <div className="cube-preview-capture-target" data-style={cubeStyle}>
        <CubeScene
          theme="dark"
          cube={solvedCube}
          interactive={false}
          cameraMode="competitive"
          cubeStyle={cubeStyle}
          cameraPositionOverride={[5.8, 4.8, 6.8]}
          backgroundOverride="#090d14"
          readinessKey={1}
          onSceneReady={() => setSceneReady(true)}
        />
      </div>
    </main>
  );
}
