import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Eye,
  EyeOff,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCubeStore } from "../../state/cubeStore";
import { parseMove } from "../../utils/cubeEngine";
import CubeScene from "../../components/cube/CubeScene";

interface LessonStep {
  title: string;
  explanation: string;
  setupScramble: string[];
  requiredMoves: string[];
}

interface Lesson {
  id: string;
  title: string;
  steps: LessonStep[];
}

const LESSONS: Lesson[] = [
  {
    id: "basics",
    title: "Cube Basics",
    steps: [
      {
        title: "The Anatomy of a Cube",
        explanation: "A Rubik's Cube consists of 3 types of pieces: Centers (1 color), Edges (2 colors), and Corners (3 colors). Centers are fixed and define the color of each face. White is opposite Yellow, Green is opposite Blue, and Red is opposite Orange.",
        setupScramble: [],
        requiredMoves: [],
      },
      {
        title: "Edges and Corners",
        explanation: "Edges always stay in edge slots, and corners always stay in corner slots. There are 12 edges and 8 corners. Rotate the cube using your mouse or touch (Free Orbit) to inspect all the pieces.",
        setupScramble: [],
        requiredMoves: [],
      },
    ],
  },
  {
    id: "notation",
    title: "Cube Notation",
    steps: [
      {
        title: "Understanding Moves",
        explanation: "Rubik's Cube moves are written as letters. A single letter like R, U, or F means rotate that face 90 degrees clockwise (as if looking directly at it). Try clicking the interactive buttons below to see how each face rotates!",
        setupScramble: [],
        requiredMoves: ["R", "U", "L", "F", "D", "B"],
      },
      {
        title: "Prime Moves (Counter-Clockwise)",
        explanation: "An apostrophe after a letter (like R', U', F') is pronounced 'Prime'. It means rotate that face 90 degrees counter-clockwise. Compare R (clockwise) with R' (counter-clockwise) using the buttons below.",
        setupScramble: [],
        requiredMoves: ["R'", "U'", "L'", "F'", "D'", "B'"],
      },
      {
        title: "Double Turns",
        explanation: "A '2' after a letter (like R2, U2, F2) means rotate that face 180 degrees (a double turn). Since it's a half-turn, rotating clockwise or counter-clockwise yields the exact same position.",
        setupScramble: [],
        requiredMoves: ["R2", "U2", "F2"],
      },
    ],
  },
  {
    id: "white-cross",
    title: "White Cross",
    steps: [
      {
        title: "Creating the Daisy",
        explanation: "The white cross is the first major step. Beginners start by placing 4 white edges around the Yellow center, forming a 'Daisy'. This is easier than solving it directly on the white side.",
        setupScramble: ["F2", "R2", "U2", "L2", "B2"],
        requiredMoves: ["F2", "R2", "B2", "L2"],
      },
      {
        title: "Completing the Cross",
        explanation: "Align each Daisy petal with its matching side center color. Once aligned, rotate that face 180 degrees (2 turns) to send the edge down to the white face. Do this for all 4 edges to form the White Cross.",
        setupScramble: ["F2", "R2", "B2", "L2"],
        requiredMoves: ["F2", "R2", "B2", "L2"],
      },
    ],
  },
  {
    id: "first-layer",
    title: "First Layer Corners",
    steps: [
      {
        title: "The 'Sexy Move' Trigger",
        explanation: "To solve the corners, we use a 4-move trigger: R U R' U'. This is the most famous algorithm in cubing. It moves the front-right-top corner down into the bottom-right slot.",
        setupScramble: ["R", "U", "R'", "U'"],
        requiredMoves: ["R", "U", "R'", "U'"],
      },
      {
        title: "Corner Insertion",
        explanation: "Position a corner directly above its intended target slot. Repeat the R U R' U' algorithm (1, 3, or 5 times) until the corner is inserted with white facing down and matching side colors.",
        setupScramble: ["U", "R", "U'", "R'"],
        requiredMoves: ["R", "U", "R'", "U'"],
      },
    ],
  },
  {
    id: "second-layer",
    title: "Second Layer",
    steps: [
      {
        title: "Inserting to the Right Slot",
        explanation: "Align a non-yellow edge with its matching center on the front. To insert this edge into the front-right slot, move it away (U), lift the right slot (R), reset, and insert using: U R U' R' U' F' U F.",
        setupScramble: ["F", "U'", "F'", "U", "R'", "U", "R", "U'"],
        requiredMoves: ["U", "R", "U'", "R'", "U'", "F'", "U", "F"],
      },
      {
        title: "Inserting to the Left Slot",
        explanation: "Align the edge. To insert it into the front-left slot, move it away (U'), lift the left slot (L'), reset, and insert using: U' L' U L U F U' F'.",
        setupScramble: ["F'", "U", "F", "U'", "L", "U'", "L'", "U"],
        requiredMoves: ["U'", "L'", "U", "L", "U", "F", "U'", "F'"],
      },
    ],
  },
  {
    id: "yellow-cross",
    title: "Yellow Cross",
    steps: [
      {
        title: "Solving the Top Cross",
        explanation: "Once the first two layers are solved, look at the top yellow face. You will have a dot, an L-shape, a line, or a cross. Use the algorithm F R U R' U' F' to transition towards the Yellow Cross.",
        setupScramble: ["F", "R", "U", "R'", "U'", "F'"],
        requiredMoves: ["F", "R", "U", "R'", "U'", "F'"],
      },
    ],
  },
  {
    id: "oll",
    title: "OLL Basics",
    steps: [
      {
        title: "Sune (Orienting Corners)",
        explanation: "To orient all remaining yellow corners so the entire top face is yellow, we use the Sune algorithm: R U R' U R U2 R'. Place the single solved yellow corner in the front-left top slot before running it.",
        setupScramble: ["R", "U2", "R'", "U'", "R", "U'", "R'"],
        requiredMoves: ["R", "U", "R'", "U", "R", "U2", "R'"],
      },
    ],
  },
  {
    id: "pll",
    title: "PLL Basics",
    steps: [
      {
        title: "A-Perm (Corner Swapping)",
        explanation: "To swap the corners of the top layer, look for 'headlights' (two matching corners on one side) and place them on the back. Run this corner-swap algorithm: R' F R' B2 R F' R' B2 R2.",
        setupScramble: ["R2", "B2", "R", "F", "R'", "B2", "R", "F'", "R"],
        requiredMoves: ["R'", "F", "R'", "B2", "R", "F'", "R'", "B2", "R2"],
      },
      {
        title: "U-Perm (Edge Cycling)",
        explanation: "To cycle the three remaining top edges and solve the entire cube, place the solved side on the back, and run the edge-swap algorithm: R U' R U R U R U' R' U' R2.",
        setupScramble: ["R2", "U", "U", "R", "U", "R'", "U'", "R'", "U'", "R'", "U", "R'"],
        requiredMoves: ["R", "U'", "R", "U", "R", "U", "R", "U'", "R'", "U'", "R2"],
      },
    ],
  },
  {
    id: "full-solve",
    title: "Full Beginner Solve",
    steps: [
      {
        title: "Your First Complete Solve!",
        explanation: "Congratulations! You've learned all the building blocks. Now, let's put it all together on a scrambled cube. Walk through the steps: White Cross -> First Corners -> Second Layer -> Yellow Cross -> OLL -> PLL.",
        setupScramble: ["U", "R", "U'", "R'", "F", "R", "U", "R'", "U'", "F'"],
        requiredMoves: ["F", "R", "U", "R'", "U'", "F'", "R", "U", "R'", "U'"],
      },
    ],
  },
];

interface LearnModeProps {
  onBack: () => void;
  theme?: "dark" | "light";
}

export default function LearnMode({
  onBack,
  theme = "dark",
}: LearnModeProps) {
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playedMoveIdx, setPlayedMoveIdx] = useState(-1);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 0.25, 0.5, 1, 2
  const [focusMode, setFocusMode] = useState(false);
  const [notationText, setNotationText] = useState<string | null>(null);

  const activeLesson = LESSONS[activeLessonIdx];
  const activeStep = activeLesson.steps[activeStepIdx];
  const requiredMoves = activeStep.requiredMoves;

  const setCubeFromScramble = useCubeStore((state) => state.setCubeFromScramble);
  const resetCube = useCubeStore((state) => state.resetCube);
  const enqueueMove = useCubeStore((state) => state.enqueueMove);
  const activeMove = useCubeStore((state) => state.activeMove);
  const setTurnDuration = useCubeStore((state) => state.setTurnDuration);

  // Set animation speed in cube store
  useEffect(() => {
    // base speed is 0.24 seconds per turn
    setTurnDuration(0.24 / speedMultiplier);
  }, [speedMultiplier, setTurnDuration]);

  // Load lesson step state
  const loadStep = () => {
    setIsPlaying(false);
    setPlayedMoveIdx(-1);
    setNotationText(null);
    if (activeStep.setupScramble.length > 0) {
      setCubeFromScramble(activeStep.setupScramble);
    } else {
      resetCube();
    }
  };

  useEffect(() => {
    loadStep();
  }, [activeLessonIdx, activeStepIdx]);

  // Autoplay moves loop
  useEffect(() => {
    if (!isPlaying) return;

    if (activeMove === null) {
      const nextIdx = playedMoveIdx + 1;
      if (nextIdx < requiredMoves.length) {
        // Trigger next move
        const moveObj = parseMove(requiredMoves[nextIdx]);
        enqueueMove(moveObj);
        setPlayedMoveIdx(nextIdx);
      } else {
        // Done playing
        setIsPlaying(false);
      }
    }
  }, [isPlaying, activeMove, playedMoveIdx, requiredMoves, enqueueMove]);

  const handlePlayPause = () => {
    if (playedMoveIdx >= requiredMoves.length - 1) {
      // Re-run from start
      setCubeFromScramble(activeStep.setupScramble.length > 0 ? activeStep.setupScramble : []);
      setPlayedMoveIdx(-1);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleRestart = () => {
    loadStep();
  };

  const handlePrevStep = () => {
    if (activeStepIdx > 0) {
      setActiveStepIdx(activeStepIdx - 1);
    } else if (activeLessonIdx > 0) {
      const prevLesson = LESSONS[activeLessonIdx - 1];
      setActiveLessonIdx(activeLessonIdx - 1);
      setActiveStepIdx(prevLesson.steps.length - 1);
    }
  };

  const handleNextStep = () => {
    if (activeStepIdx < activeLesson.steps.length - 1) {
      setActiveStepIdx(activeStepIdx + 1);
    } else if (activeLessonIdx < LESSONS.length - 1) {
      setActiveLessonIdx(activeLessonIdx + 1);
      setActiveStepIdx(0);
    }
  };

  const playNotationMove = (moveStr: string) => {
    setIsPlaying(false);
    const moveObj = parseMove(moveStr);
    enqueueMove(moveObj);
    
    // Set custom feedback message
    const sideMap: Record<string, string> = {
      R: "Right face clockwise",
      "R'": "Right face counter-clockwise",
      R2: "Right face 180° half-turn",
      L: "Left face clockwise",
      "L'": "Left face counter-clockwise",
      L2: "Left face 180° half-turn",
      U: "Top (Up) face clockwise",
      "U'": "Top (Up) face counter-clockwise",
      U2: "Top (Up) face 180° half-turn",
      D: "Bottom (Down) face clockwise",
      "D'": "Bottom (Down) face counter-clockwise",
      D2: "Bottom (Down) face 180° half-turn",
      F: "Front face clockwise",
      "F'": "Front face counter-clockwise",
      F2: "Front face 180° half-turn",
      B: "Back face clockwise",
      "B'": "Back face counter-clockwise",
      B2: "Back face 180° half-turn",
    };
    setNotationText(`${moveStr} Triggered: ${sideMap[moveStr] || "Rotation"}`);
  };

  return (
    <div className={`learn-mode-layout ${focusMode ? "focus-active" : ""}`}>
      {/* Sidebar Navigation */}
      <aside className="learn-sidebar">
        <div className="learn-sidebar-head">
          <GraduationCap size={22} className="academy-icon" />
          <div>
            <h3>Academy</h3>
            <span>CubeRanked School</span>
          </div>
        </div>

        <nav className="learn-sidebar-nav">
          {LESSONS.map((lesson, lIdx) => (
            <div key={lesson.id} className="lesson-nav-group">
              <div className="lesson-nav-title">{lesson.title}</div>
              <div className="lesson-nav-steps">
                {lesson.steps.map((step, sIdx) => {
                  const isActive = activeLessonIdx === lIdx && activeStepIdx === sIdx;
                  return (
                    <button
                      key={step.title}
                      type="button"
                      className={`lesson-step-btn ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveLessonIdx(lIdx);
                        setActiveStepIdx(sIdx);
                      }}
                    >
                      <span className="step-dot" />
                      {step.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="learn-sidebar-footer">
          <button type="button" className="academy-exit-btn" onClick={onBack}>
            <ChevronLeft size={16} /> Exit Academy
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <section className="learn-main">
        {/* Top bar */}
        <header className="learn-topbar">
          <div className="topbar-left">
            {!focusMode && (
              <>
                <span className="academy-pill">Academy</span>
                <span className="divider">/</span>
                <span className="lesson-crumb">{activeLesson.title}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className={`focus-toggle-btn ${focusMode ? "active" : ""}`}
              onClick={() => setFocusMode(!focusMode)}
              title={focusMode ? "Show Navigation UI" : "Enable Focus Mode"}
            >
              {focusMode ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>{focusMode ? "Show UI" : "Focus Mode"}</span>
            </button>
            {!focusMode && (
              <button type="button" className="close-academy-btn" onClick={onBack}>
                Exit
              </button>
            )}
          </div>
        </header>

        {/* Content Container */}
        <div className="learn-workspace">
          {/* Left panel: Explanation & Controls */}
          <div className="learn-card-container">
            <div className="learn-explanation-card">
              <span className="step-indicator">
                Step {activeStepIdx + 1} of {activeLesson.steps.length}
              </span>
              <h2>{activeStep.title}</h2>
              <p className="step-explanation">{activeStep.explanation}</p>

              {/* Required moves / Algorithm display */}
              {requiredMoves.length > 0 && (
                <div className="learn-algorithm-box">
                  <div className="box-title">
                    <BookOpen size={14} />
                    <span>{activeLesson.id === "notation" ? "Teach Moves" : "Algorithm"}</span>
                  </div>
                  <div className="algorithm-moves">
                    {requiredMoves.map((move, idx) => {
                      const isActive = isPlaying && playedMoveIdx === idx;
                      return (
                        <span
                          key={idx}
                          className={`algorithm-move-pill ${isActive ? "active" : ""}`}
                        >
                          {move}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notation Interactive Buttons (only in notation lesson) */}
              {activeLesson.id === "notation" && (
                <div className="notation-guide-panel">
                  <h4>Interactive Practice</h4>
                  <p>Click any button below to trigger the move and see the face rotate.</p>
                  <div className="notation-grid-buttons">
                    {requiredMoves.map((move) => (
                      <button
                        key={move}
                        type="button"
                        className="notation-trigger-btn"
                        onClick={() => playNotationMove(move)}
                      >
                        {move}
                      </button>
                    ))}
                  </div>
                  {notationText && (
                    <div className="notation-feedback-text">
                      {notationText}
                    </div>
                  )}
                </div>
              )}

              {/* Progress and controls */}
              <div className="learn-controls-panel">
                <div className="player-main-controls">
                  <button
                    type="button"
                    className="player-btn play-pause-btn"
                    onClick={handlePlayPause}
                    disabled={requiredMoves.length === 0}
                    title={isPlaying ? "Pause Demo" : "Play Demo"}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    <span>{isPlaying ? "Pause" : "Play"}</span>
                  </button>

                  <button
                    type="button"
                    className="player-btn restart-btn"
                    onClick={handleRestart}
                    title="Restart Step"
                  >
                    <RotateCcw size={16} />
                    <span>Restart</span>
                  </button>

                  {requiredMoves.length > 0 && (
                    <div className="speed-selector">
                      <span className="speed-label">Speed:</span>
                      <div className="speed-buttons">
                        {([0.25, 0.5, 1.0, 2.0] as const).map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            className={`speed-btn ${speedMultiplier === spd ? "active" : ""}`}
                            onClick={() => setSpeedMultiplier(spd)}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="step-navigation-controls">
                  <button
                    type="button"
                    className="nav-step-btn prev"
                    onClick={handlePrevStep}
                    disabled={activeLessonIdx === 0 && activeStepIdx === 0}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <div className="nav-progress-dots">
                    {activeLesson.steps.map((_, idx) => (
                      <span
                        key={idx}
                        className={`nav-dot ${activeStepIdx === idx ? "active" : ""}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="nav-step-btn next"
                    onClick={handleNextStep}
                    disabled={activeLessonIdx === LESSONS.length - 1 && activeStepIdx === activeLesson.steps.length - 1}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: 3D Stage */}
          <div className="learn-stage-container">
            <CubeScene
              theme={theme}
              cameraMode="free-rotation"
              showVisuals={true}
              interactive={true}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
