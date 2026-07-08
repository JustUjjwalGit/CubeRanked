export type Axis = "x" | "y" | "z";
export type Face = "U" | "D" | "L" | "R" | "F" | "B";
export type Vec3 = readonly [number, number, number];
export type TurnAmount = -2 | -1 | 1 | 2;

export interface Sticker {
  face: Face;
  normal: Vec3;
}

export interface Cubie {
  id: string;
  position: Vec3;
  stickers: Sticker[];
}

export type CubeState = Cubie[];

export interface Move {
  face: Face;
  axis: Axis;
  layer: -1 | 1;
  quarterTurns: TurnAmount;
}

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

const MOVE_FACES: Face[] = ["U", "R", "F", "D", "L", "B"];

function createSticker(face: Face): Sticker {
  return { face, normal: FACE_NORMALS[face] };
}

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
    quarterTurns = (quarterTurns === 1 ? -1 : 1) as TurnAmount;
  } else if (suffix === "2") {
    quarterTurns = 2;
  }

  return { face, axis, layer, quarterTurns };
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

export function applyMove(cube: CubeState, move: Move): CubeState {
  const axisIndex = AXIS_INDEX[move.axis];

  return cube.map((cubie) => {
    if (cubie.position[axisIndex] !== move.layer) {
      return cubie;
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

const SOLVED_SERIALIZED = serializeCube(createSolvedCube());

export function validateSolve(scramble: string[], moves: string[]): boolean {
  try {
    let cube = createSolvedCube();

    // Apply scramble
    for (const item of scramble) {
      cube = applyMove(cube, parseMove(item));
    }

    // Apply moves
    for (const item of moves) {
      cube = applyMove(cube, parseMove(item));
    }

    return serializeCube(cube) === SOLVED_SERIALIZED;
  } catch (err) {
    return false;
  }
}
