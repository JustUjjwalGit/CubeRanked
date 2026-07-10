declare module "glicko2.ts" {
  interface Glicko2Options {
    tau: number;
    rating: number;
    rd: number;
    vol: number;
  }

  interface Player {
    getRating(): number;
    getRd(): number;
    getVol(): number;
  }

  class Glicko2 {
    constructor(options?: Partial<Glicko2Options>);
    makePlayer(rating?: number, rd?: number, vol?: number): Player;
    updateRatings(teams: [Player, Player, number][]): void;
  }

  export { Glicko2, type Glicko2Options, type Player };
}
