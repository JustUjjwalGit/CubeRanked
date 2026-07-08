import { Glicko2 } from "glicko2.ts";

const ranking = new Glicko2({
  tau: 0.5,
  rating: 1500,
  rd: 350,
  vol: 0.06
});

const player1 = ranking.makePlayer(1500, 350, 0.06);
const player2 = ranking.makePlayer(1500, 350, 0.06);
ranking.updateRatings([[player1, player2, 1]]);

console.log(player1.getRating(), player1.getRd(), player1.getVol());
console.log(player2.getRating(), player2.getRd(), player2.getVol());
