export type Axis = "x" | "y" | "z";
export type Face = "U" | "D" | "L" | "R" | "F" | "B";
export type Vec3 = readonly [number, number, number];
export type TurnAmount = -2 | -1 | 1 | 2;

export interface Sticker {
  face: Face;
  color: string;
  normal: Vec3;
}

export interface Cubie {
  id: string;
  home: Vec3;
  position: Vec3;
  stickers: Sticker[];
}

export type CubeState = Cubie[];

export interface Move {
  face: Face;
  axis: Axis;
  layer: -1 | 1;
  quarterTurns: TurnAmount;
  notation: string;
}

export const FACE_COLORS: Record<Face, string> = {
  U: "#f8fafc",
  D: "#facc15",
  L: "#f97316",
  R: "#ef4444",
  F: "#22c55e",
  B: "#3b82f6",
};

const FACE_NORMALS: Record<Face, Vec3> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

const FACE_TO_AXIS_LAYER: Record<Face, { axis: Axis; layer: -1 | 1 }> = {
  U: { axis: "y", layer: 1 },
  D: { axis: "y", layer: -1 },
  L: { axis: "x", layer: -1 },
  R: { axis: "x", layer: 1 },
  F: { axis: "z", layer: 1 },
  B: { axis: "z", layer: -1 },
};

const CLOCKWISE_TURN: Record<Face, TurnAmount> = {
  U: -1,
  D: 1,
  L: 1,
  R: -1,
  F: -1,
  B: 1,
};

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = {
  x: 0,
  y: 1,
  z: 2,
};

export const MOVE_FACES: Face[] = ["U", "R", "F", "D", "L", "B"];

export function createSolvedCube(): CubeState {
  const cubies: Cubie[] = [];

  for (const x of [-1, 0, 1] as const) {
    for (const y of [-1, 0, 1] as const) {
      for (const z of [-1, 0, 1] as const) {
        if (x === 0 && y === 0 && z === 0) {
          continue;
        }

        const stickers: Sticker[] = [];
        if (x === 1) stickers.push(createSticker("R"));
        if (x === -1) stickers.push(createSticker("L"));
        if (y === 1) stickers.push(createSticker("U"));
        if (y === -1) stickers.push(createSticker("D"));
        if (z === 1) stickers.push(createSticker("F"));
        if (z === -1) stickers.push(createSticker("B"));

        cubies.push({
          id: `${x}:${y}:${z}`,
          home: [x, y, z],
          position: [x, y, z],
          stickers,
        });
      }
    }
  }

  return cubies;
}

export function parseMove(notation: string): Move {
  const trimmed = notation.trim().toUpperCase();
  const face = trimmed[0] as Face;

  if (!MOVE_FACES.includes(face)) {
    throw new Error(`Unsupported move notation: ${notation}`);
  }

  const suffix = trimmed.slice(1);
  const { axis, layer } = FACE_TO_AXIS_LAYER[face];
  let quarterTurns = CLOCKWISE_TURN[face];

  if (suffix === "'") {
    quarterTurns = invertTurn(quarterTurns);
  } else if (suffix === "2") {
    quarterTurns = 2;
  } else if (suffix.length > 0) {
    throw new Error(`Unsupported move suffix: ${notation}`);
  }

  return {
    face,
    axis,
    layer,
    quarterTurns,
    notation: toNotation(face, suffix === "'" ? "prime" : suffix === "2" ? "double" : "normal"),
  };
}

export function makeMove(face: Face, mode: "normal" | "prime" | "double" = "normal"): Move {
  return parseMove(toNotation(face, mode));
}

export function invertMove(move: Move): Move {
  if (Math.abs(move.quarterTurns) === 2) {
    return makeMove(move.face, "double");
  }

  return makeMove(move.face, move.notation.endsWith("'") ? "normal" : "prime");
}

export function applyMove(cube: CubeState, move: Move): CubeState {
  const axisIndex = AXIS_INDEX[move.axis];

  return cube.map((cubie) => {
    if (cubie.position[axisIndex] !== move.layer) {
      return cloneCubie(cubie);
    }

    return {
      ...cubie,
      position: rotateVector(cubie.position, move.axis, move.quarterTurns),
      stickers: cubie.stickers.map((sticker) => ({
        ...sticker,
        normal: rotateVector(sticker.normal, move.axis, move.quarterTurns),
      })),
    };
  });
}

export function isCubieInMove(cubie: Cubie, move: Move): boolean {
  return cubie.position[AXIS_INDEX[move.axis]] === move.layer;
}

export function rotateVector(vector: Vec3, axis: Axis, quarterTurns: number): Vec3 {
  let result: Vec3 = [...vector] as unknown as Vec3;
  const turns = ((quarterTurns % 4) + 4) % 4;

  for (let index = 0; index < turns; index += 1) {
    const [x, y, z] = result;

    if (axis === "x") {
      result = [x, -z, y];
    } else if (axis === "y") {
      result = [z, y, -x];
    } else {
      result = [-y, x, z];
    }
  }

  return result;
}

export function rotateVectorByAngle(vector: Vec3, axis: Axis, angle: number): [number, number, number] {
  const [x, y, z] = vector;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  if (axis === "x") {
    return [x, y * cos - z * sin, y * sin + z * cos];
  }

  if (axis === "y") {
    return [x * cos + z * sin, y, -x * sin + z * cos];
  }

  return [x * cos - y * sin, x * sin + y * cos, z];
}

export function axisToVector(axis: Axis): [number, number, number] {
  if (axis === "x") return [1, 0, 0];
  if (axis === "y") return [0, 1, 0];
  return [0, 0, 1];
}

export function createScramble(length = 20): Move[] {
  const moves: Move[] = [];
  let previousFace: Face | null = null;

  while (moves.length < length) {
    const face = MOVE_FACES[Math.floor(Math.random() * MOVE_FACES.length)];

    if (face === previousFace) {
      continue;
    }

    const modes = ["normal", "prime", "double"] as const;
    const mode = modes[Math.floor(Math.random() * modes.length)];
    moves.push(makeMove(face, mode));
    previousFace = face;
  }

  return moves;
}

export function serializeCube(cube: CubeState): string {
  return cube
    .map((cubie) => ({
      id: cubie.id,
      position: cubie.position,
      stickers: [...cubie.stickers]
        .sort((left, right) => left.face.localeCompare(right.face))
        .map((sticker) => `${sticker.face}:${sticker.normal.join(",")}`),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => `${entry.id}|${entry.position.join(",")}|${entry.stickers.join(";")}`)
    .join("\n");
}

function createSticker(face: Face): Sticker {
  return {
    face,
    color: FACE_COLORS[face],
    normal: FACE_NORMALS[face],
  };
}

function cloneCubie(cubie: Cubie): Cubie {
  return {
    ...cubie,
    home: [...cubie.home] as unknown as Vec3,
    position: [...cubie.position] as unknown as Vec3,
    stickers: cubie.stickers.map((sticker) => ({
      ...sticker,
      normal: [...sticker.normal] as unknown as Vec3,
    })),
  };
}

function invertTurn(turn: TurnAmount): TurnAmount {
  if (turn === 1) return -1;
  if (turn === -1) return 1;
  return turn;
}

function toNotation(face: Face, mode: "normal" | "prime" | "double"): string {
  if (mode === "prime") return `${face}'`;
  if (mode === "double") return `${face}2`;
  return face;
}
