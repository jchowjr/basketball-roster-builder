import { suggestArchetype, suggestedRoles } from './lineup';
import { defaultGame, emptyRatings, type Player, type Role, type Store } from './types';

const KEY = 'ballHandlers.v2';
export const emptyStore = (): Store => ({ version: 2, players: [], game: defaultGame(), presets: [], plans: [] });
const num = (v: unknown, fallback = 5) => typeof v === 'number' && v >= 1 && v <= 10 ? v : fallback;
const clamp = (v: number) => Math.max(1, Math.min(10, v));
function migratePlayer(raw: any): Player | null {
  if (!raw?.id || !raw?.name) return null;
  const old = Array.isArray(raw.ratings) ? raw.ratings : [], ratings = emptyRatings(), now = new Date().toISOString();
  const tags: string[] = Array.isArray(raw.profileTags) ? raw.profileTags.map(String) : [];
  const tagged = (...names: string[]) => names.some(name => tags.some(tag => tag.toLowerCase() === name.toLowerCase()));
  ratings.shooting.shooting = num(old[0] * 2); ratings.shooting.spacing = clamp(ratings.shooting.shooting + (tagged('Shooter', 'Corner shooter', 'Floor spacer') ? 1 : 0));
  ratings.playmaking.handle = num(old[1] * 2); ratings.playmaking.passing = num(old[2] * 2);
  ratings.playmaking.decisions = clamp(Math.round((ratings.playmaking.handle + ratings.playmaking.passing) / 2) + (tagged('Playmaker') ? 1 : 0));
  ratings.finishing.rimPressure = clamp(num(old[5] * 2) + (tagged('Slasher', 'Finisher') ? 1 : 0)); ratings.finishing.finishing = clamp(ratings.finishing.rimPressure + (tagged('Finisher', 'Post scorer') ? 1 : 0));
  ratings.defense.poa = clamp(num(old[4] * 2) + (tagged('On-ball defender', 'Lockdown defender') ? 1 : 0)); ratings.defense.help = clamp(num(old[4] * 2) + (tagged('Versatile defender') ? 1 : 0)); ratings.defense.rimProtection = clamp(num(old[4] * 2) + (tagged('Rim protector') ? 1 : 0));
  ratings.physical.rebounding = clamp(num(old[3] * 2) + (tagged('Rebounder') ? 1 : 0)); ratings.physical.size = Array.isArray(raw.positions) && raw.positions.some((p: string) => p === 'PF' || p === 'C') ? 7 : 5; ratings.physical.mobility = num(old[5] * 2); ratings.physical.stamina = num(old[6] * 2);
  const mapped: Role[] = [...(tagged('Playmaker') ? ['secondary_creator' as Role] : []), ...(tagged('Shooter', 'Corner shooter', 'Floor spacer') ? ['floor_spacer' as Role] : []), ...(tagged('Slasher', 'Finisher') ? ['rim_pressure' as Role] : []), ...(tagged('On-ball defender', 'Lockdown defender') ? ['point_of_attack_defender' as Role] : []), ...(tagged('Versatile defender') ? ['wing_stopper' as Role] : []), ...(tagged('Rim protector') ? ['rim_protector' as Role] : []), ...(tagged('Rebounder') ? ['rebounder' as Role] : []), ...(tagged('Screen setter') ? ['screen_setter' as Role] : [])];
  const roles = Array.from(new Set([...suggestedRoles(ratings), ...mapped]));
  return { id: raw.id, name: String(raw.name), jerseyNumber: raw.number ? String(raw.number) : '', height: raw.height || '', positions: Array.isArray(raw.positions) ? raw.positions : [], ratings, roles, archetype: suggestArchetype(ratings, roles), coachNotes: raw.notes || '', createdAt: now, updatedAt: now };
}
export function loadStore(): Store {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) { const v = JSON.parse(saved); if (v?.version === 2) return { ...emptyStore(), ...v, game: { ...defaultGame(), ...v.game } }; }
    const legacy = localStorage.getItem('ballHandlers.players');
    if (legacy) return { ...emptyStore(), players: JSON.parse(legacy).map(migratePlayer).filter(Boolean) };
  } catch { /* a corrupt local backup never blocks the planner */ }
  return emptyStore();
}
export const persist = (store: Store) => localStorage.setItem(KEY, JSON.stringify(store));
export const exportStore = (store: Store) => JSON.stringify({ exportedAt: new Date().toISOString(), ...store }, null, 2);
export function parseImport(text: string): Store { const v = JSON.parse(text); if (v?.version === 2 && Array.isArray(v.players)) return { ...emptyStore(), ...v, game: { ...defaultGame(), ...v.game } }; if (Array.isArray(v?.players)) return { ...emptyStore(), players: v.players.map(migratePlayer).filter(Boolean) }; throw new Error('Choose a Ball Handlers roster export or v2 backup.'); }
