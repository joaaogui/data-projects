/** What the urban breathing ("Vida urbana") score measures, as shown to the user. */
export const URBAN_LIFE_CRITERIA_TEXT =
  "Vida urbana (0–10): nota pelos 9 critérios — densidade com prédios altos, relevo plano, gastronomia de rua, vida noturna, parque a até 1 km, arborização, segurança à noite, prédios modernos e calma.";

/** Rubric total that maps to urban breathing 6.0 (São Paulo Sumaré, the lowest catalog total of round 1). */
const RUBRIC_FLOOR_TOTAL = 4.4;
/** Points of rubric between the floor and a perfect 10, spread over the 4 points from 6 to 10. */
const RUBRIC_SPAN = 10 - RUBRIC_FLOOR_TOTAL;

/**
 * Urban breathing (0–10) of a neighbourhood from its 9-criteria rubric total (0–10, .tmp/nb-research):
 * round1(6 + (total − 4.4) × 4 / 5.6). Only a perfect rubric reaches 10, so no reference scores 10 just for
 * being the reference; totals under 4.4 fall below 6.
 */
export function rubricToUrbanBreathing(rubricTotal: number): number {
  return Math.round((6 + ((rubricTotal - RUBRIC_FLOOR_TOTAL) * 4) / RUBRIC_SPAN) * 10) / 10;
}

/**
 * Urban breathing bonus/penalty in the neighbourhood score, on this mapping's scale. They were tuned on the earlier
 * mapping 6 + (total − 4.4) × 4 / 3.63, so old values convert with new = 6 + (old − 6) × 3.63 / 5.6:
 * old 7.5 → 6.97 (7.0), old 9.0 → 7.94 (8.0), and the old 0.75 per point below 7.5 → 0.75 × 5.6 / 3.63 ≈ 1.16 per
 * point below 7.0. Between the two thresholds the bonus ramps linearly to its maximum, held above the upper one.
 */
export const URBAN_BREATHING_BONUS_FROM = 7.0;
export const URBAN_BREATHING_BONUS_FULL_AT = 8.0;
export const URBAN_BREATHING_MAX_BONUS = 0.45;
export const URBAN_BREATHING_PENALTY_PER_POINT = 1.16;

/**
 * Other thresholds tuned on the earlier mapping, converted the same way (below 6 too: 6 − (6 − old) × 3.63 / 5.6):
 * engine-table urban breathing caps the catalog value under old 8.0 → 7.30; the bunker/arterial cap old 5.0 → 5.35;
 * the "alto respiro urbano" justification phrase from old 9.0 → 7.94 (7.9).
 */
export const URBAN_BREATHING_CALIBRATION_CAP_BELOW = 7.3;
export const BUNKER_URBAN_BREATHING_CAP = 5.35;
export const HIGH_URBAN_BREATHING_PHRASE_FROM = 7.9;

/**
 * The user's manual urban breathing, kept over the rubric mapping. Alias rows of the engine table
 * (Jardim Guanabara, Guanabara) copy CP:Jd. Guanabara.
 */
export const URBAN_BREATHING_OVERRIDES: Readonly<Record<string, number>> = {
  "CP:Jd. Guanabara": 5.0,
  "CP:Cambuí": 4.5,
};
