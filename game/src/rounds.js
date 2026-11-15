// Rounds and economy: buy phase, live round, round end, match end. Money is earned by
// kills, round wins and bomb play, and spent in the buy menu on weapons, grenades and
// armour. First to 8 round wins takes the match (max 15 rounds).
import { WEAPONS, GRENADES } from './weapons.js';

const BUY_SECONDS = 12;
const ROUND_SECONDS = 100;
const END_SECONDS = 5;
const WIN_ROUNDS = 8;
const MAX_ROUNDS = 15;

export function createRounds(hooks) {
  const state = {
    phase: 'buy',
    round: 1,
    phaseLeft: BUY_SECONDS,
    roundLeft: ROUND_SECONDS,
    vanguardWins: 0,
    sentinelWins: 0,
    money: 800,
    kills: 0,
    deaths: 0,
    planted: 0,
    defused: 0,
    matchOver: false,
    winner: null,
    lastReason: '',
    buyOpen: false,
  };

  function startRound() {
    state.phase = 'buy';
    state.phaseLeft = BUY_SECONDS;
    state.roundLeft = ROUND_SECONDS;
    state.buyOpen = false;
    hooks.onRoundStart(state.round);
  }

  function endRound(winner, reason) {
    if (state.phase === 'end') return;
    state.phase = 'end';
    state.phaseLeft = END_SECONDS;
    state.lastReason = reason;
    state.buyOpen = false;
    if (winner === 'vanguard') {
      state.vanguardWins += 1;
      state.money += 325;
    } else {
      state.sentinelWins += 1;
      state.money += 1400;
    }
    hooks.onRoundEnd(winner, reason, state);
    if (state.vanguardWins >= WIN_ROUNDS || state.sentinelWins >= WIN_ROUNDS || state.round >= MAX_ROUNDS) {
      state.matchOver = true;
      state.winner = state.vanguardWins > state.sentinelWins ? 'vanguard' : 'sentinel';
      hooks.onMatchEnd(state.winner, state);
    }
  }

  function step(dt, ctx) {
    if (state.matchOver) return;
    state.phaseLeft -= dt;
    if (state.phase === 'buy') {
      if (state.phaseLeft <= 0) {
        state.phase = 'live';
        state.phaseLeft = ROUND_SECONDS;
        state.buyOpen = false;
        hooks.onLive();
      }
      return;
    }
    if (state.phase === 'live') {
      state.roundLeft = state.phaseLeft;
      if (ctx.bomb.state === 'planted') {
        state.roundLeft = Math.max(state.roundLeft, ctx.bomb.fuse);
      }
      const vAlive = ctx.aliveCount('vanguard');
      const sAlive = ctx.aliveCount('sentinel');
      if (vAlive === 0 && ctx.bomb.state !== 'planted') {
        endRound('sentinel', 'Vanguard eliminated');
      } else if (sAlive === 0 && ctx.bomb.state !== 'planted') {
        endRound('vanguard', 'Sentinel eliminated');
      } else if (vAlive === 0 && ctx.bomb.state === 'planted') {
        // Round continues until the bomb resolves.
      } else if (state.phaseLeft <= 0 && ctx.bomb.state !== 'planted') {
        endRound('sentinel', 'Time expired — bomb not planted');
      }
      return;
    }
    if (state.phase === 'end' && state.phaseLeft <= 0) {
      if (state.matchOver) return;
      state.round += 1;
      hooks.onNextRound(state.round);
      startRound();
    }
  }

  function onKill(killerIsPlayer) {
    if (killerIsPlayer) {
      state.kills += 1;
      state.money += 300;
    }
  }
  function onDeath() {
    state.deaths += 1;
  }
  function onPlanted() {
    state.planted += 1;
    state.money += 300;
  }
  function onDefused() {
    state.defused += 1;
    state.money += 300;
  }

  function buyWeapon(id) {
    const w = WEAPONS.find((x) => x.id === id);
    if (!w || state.money < w.price) return false;
    if (!hooks.onBuyWeapon(w)) return false;
    state.money -= w.price;
    return true;
  }
  function buyGrenade(id) {
    const g = GRENADES.find((x) => x.id === id);
    if (!g || state.money < g.price) return false;
    if (!hooks.onBuyGrenade(g)) return false;
    state.money -= g.price;
    return true;
  }
  function buyArmor() {
    if (state.money < 650) return false;
    if (!hooks.onBuyArmor()) return false;
    state.money -= 650;
    return true;
  }

  function reset() {
    state.phase = 'buy';
    state.round = 1;
    state.phaseLeft = BUY_SECONDS;
    state.roundLeft = ROUND_SECONDS;
    state.vanguardWins = 0;
    state.sentinelWins = 0;
    state.money = 800;
    state.kills = 0;
    state.deaths = 0;
    state.planted = 0;
    state.defused = 0;
    state.matchOver = false;
    state.winner = null;
    state.lastReason = '';
    state.buyOpen = false;
  }

  return {
    state,
    startRound,
    endRound,
    step,
    onKill,
    onDeath,
    onPlanted,
    onDefused,
    buyWeapon,
    buyGrenade,
    buyArmor,
    reset,
  };
}
