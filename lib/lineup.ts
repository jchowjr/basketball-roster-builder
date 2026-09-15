import type { GameSettings, Player, Ratings, Role, Shift } from './types';

export const roleLabel = (role: Role) => role.replaceAll('_', ' ');
export function suggestedRoles(r: Ratings): Role[] {
  const roles: Role[] = [];
  if (r.playmaking.handle >= 8 && r.playmaking.passing >= 7) roles.push('primary_creator');
  else if (r.playmaking.handle >= 7 || r.playmaking.passing >= 7) roles.push('secondary_creator');
  if (r.shooting.shooting >= 7 || r.shooting.spacing >= 8) roles.push('floor_spacer');
  if (r.finishing.rimPressure >= 7) roles.push('rim_pressure');
  if (r.defense.poa >= 7) roles.push('point_of_attack_defender');
  if (r.defense.help >= 7 && r.physical.size >= 6) roles.push('wing_stopper');
  if (r.defense.rimProtection >= 7) roles.push('rim_protector');
  if (r.physical.rebounding >= 7) roles.push('rebounder');
  if (r.physical.size >= 7 && r.finishing.finishing >= 6) roles.push('screen_setter');
  if (r.playmaking.decisions >= 7) roles.push('connector');
  return roles;
}
export function suggestArchetype(r: Ratings, roles = suggestedRoles(r)) {
  if (roles.includes('primary_creator') && r.shooting.shooting >= 8) return 'Shot-Making Floor General';
  if (roles.includes('primary_creator')) return 'Lead Playmaker';
  if (roles.includes('rim_protector') && roles.includes('rebounder')) return 'Defensive Anchor';
  if (roles.includes('floor_spacer') && roles.includes('wing_stopper')) return '3-and-D Wing';
  if (roles.includes('floor_spacer')) return 'Movement Shooter';
  if (roles.includes('rim_pressure') && roles.includes('wing_stopper')) return 'Two-Way Slasher';
  if (roles.includes('rim_pressure')) return 'Rim Attacker';
  if (roles.includes('rebounder')) return 'Glass Cleaner';
  return 'Utility Player';
}
const top = (values: number[]) => [...values].sort((a, b) => b - a);
const elite = (v: number) => v * 1.4 + Math.max(0, v - 7) ** 2 * 1.35;
const value = (players: Player[], fn: (p: Player) => number) => { const v = top(players.map(fn)); return elite(v[0]) + (v[1] || 0) * .55 + (v[2] || 0) * .25; };
const has = (players: Player[], role: Role) => players.some(p => p.roles.includes(role));
export type Evaluation = { score: number; strengths: string[]; risks: string[]; reasons: string[]; metrics: Record<string, number> };
export function evaluate(line: Player[], game: GameSettings): Evaluation {
  const creator = value(line, p => (p.ratings.playmaking.handle + p.ratings.playmaking.passing + p.ratings.playmaking.decisions) / 3);
  const spacing = value(line, p => (p.ratings.shooting.shooting + p.ratings.shooting.spacing) / 2);
  const pressure = value(line, p => (p.ratings.finishing.rimPressure + p.ratings.finishing.finishing) / 2);
  const defense = value(line, p => (p.ratings.defense.poa + p.ratings.defense.help + p.ratings.defense.rimProtection) / 3);
  const glass = value(line, p => (p.ratings.physical.rebounding + p.ratings.physical.size) / 2);
  const guards = line.filter(p => p.positions.some(x => x === 'PG' || x === 'SG')).length;
  const bigs = line.filter(p => p.positions.some(x => x === 'PF' || x === 'C')).length;
  let score = creator + spacing + pressure + defense + glass;
  const strengths: string[] = [], risks: string[] = [], reasons: string[] = [];
  if (has(line, 'primary_creator')) { score += 18; strengths.push('A true lead creator can organize possessions.'); } else { score -= 30; risks.push('No reliable primary creator; late-clock offense may stall.'); }
  if (has(line, 'floor_spacer')) { score += 10; strengths.push('Real shooting gravity keeps driving lanes open.'); } else { score -= 18; risks.push('Limited spacing could crowd the paint.'); }
  if (has(line, 'rim_pressure')) { score += 8; strengths.push('Rim pressure can bend the defense.'); } else risks.push('This group may struggle to create paint touches.');
  if (has(line, 'rim_protector') || has(line, 'rebounder')) { score += 8; strengths.push('There is a credible answer on the glass or at the rim.'); } else { score -= 12; risks.push('This five is vulnerable on the glass and in the paint.'); }
  if (guards < 1) { score -= 16; risks.push('No guard-capable player is available to initiate.'); }
  if (bigs < 1) { score -= 10; risks.push('No forward/big coverage creates a size mismatch risk.'); }
  const tacticBonus = game.offense === 'spacing' ? spacing * .35 : game.offense === 'pace' ? (pressure + creator) * .18 : game.offense === 'interior' ? (pressure + glass) * .22 : game.offense === 'movement' ? (spacing + creator) * .18 : 0;
  const defenseBonus = game.defense === 'paint' ? glass * .18 : game.defense === 'perimeter' ? defense * .2 : game.defense === 'switch' ? defense * .13 : 0;
  score += tacticBonus + defenseBonus;
  if (game.offense !== 'balanced') reasons.push(`Built to support ${game.offense === 'pace' ? 'a fast pace' : game.offense} offense.`);
  reasons.push(`Its strongest on-court quality is ${Object.entries({ creation: creator, spacing, 'rim pressure': pressure, defense, 'rebounding/size': glass }).sort((a,b) => b[1]-a[1])[0][0]}.`);
  return { score, strengths: strengths.slice(0, 3), risks: risks.slice(0, 3), reasons, metrics: { Creation: creator, Spacing: spacing, 'Rim pressure': pressure, Defense: defense, 'Size & glass': glass } };
}
function combos<T>(a: T[], n: number, start = 0, pick: T[] = [], out: T[][] = []): T[][] { if (pick.length === n) { out.push(pick); return out; } for (let i=start; i<=a.length-(n-pick.length); i++) combos(a,n,i+1,[...pick,a[i]],out); return out; }
export function recommend(pool: Player[], game: GameSettings, minutes: Record<string, number> = {}, locked: string[] = []) {
  const candidates = combos(pool, 5).filter(l => locked.every(id => l.some(p => p.id === id)));
  return candidates.map(players => {
    const base = evaluate(players, game); const fairness = players.reduce((n, p) => n + Math.max(0, 20 - (minutes[p.id] || 0)), 0);
    const factor = game.priority === 'fair' ? 1.4 : game.priority === 'balanced' ? .55 : .12;
    return { players, ...base, rank: base.score + fairness * factor };
  }).sort((a,b) => b.rank-a.rank)[0];
}
export function createRotation(pool: Player[], game: GameSettings) {
  const minutes: Record<string, number> = Object.fromEntries(pool.map(p => [p.id, 0])); const shifts: Shift[] = []; let starterIds: string[] = [];
  for (let i=0;i<8;i++) { const next = recommend(pool, game, minutes, i === 0 ? game.starterLocks : []); if (!next) break; if (!i) starterIds = next.players.map(p => p.id); next.players.forEach(p => minutes[p.id] += 5); shifts.push({ start: i * 5, end: i * 5 + 5, playerIds: next.players.map(p => p.id), score: Math.round(next.score) }); }
  return { shifts, minutes, starterIds };
}
