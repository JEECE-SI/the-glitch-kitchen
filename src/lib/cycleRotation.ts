/**
 * Rotation des cycles de contests par session de jeu.
 * L'index de rotation (0..3) est dérivé du NOM de la partie si il contient un numéro (ex. "Session 2" → 2.x).
 * Sinon fallback sur hash(gameId) (aléatoire selon l'UUID).
 *
 * Session 1 (rot 0): cycle affiché 1→1.x, 2→2.x, 3→3.x, 4→4.x
 * Session 2 (rot 1): cycle affiché 1→2.x, 2→3.x, 3→4.x, 4→1.x
 * Session 3 (rot 2): cycle affiché 1→3.x, 2→4.x, 3→1.x, 4→2.x
 * Session 4 (rot 3): cycle affiché 1→4.x, 2→1.x, 3→2.x, 4→3.x
 */

function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Extrait un numéro de session du nom de la partie (ex. "Session 2" → 2, "Partie 3" → 3).
 * Retourne 1-4 si trouvé, sinon undefined.
 */
function parseSessionNumberFromName(gameName: string | null | undefined): number | undefined {
  if (!gameName || typeof gameName !== 'string') return undefined;
  // "Session 1", "Partie 2", "S3", "Game 4", "Session1", etc.
  const m = gameName.match(/(?:session|partie|game|s)\s*(\d+)/i) || gameName.match(/(\d+)/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 4 ? n : ((n - 1) % 4) + 1; // 1-4, ou 5→1, 6→2...
}

/**
 * Retourne un index de rotation 0..3 pour cette partie.
 * Si gameName contient un numéro (ex. "Session 2"), utilise (numéro - 1) % 4 pour que Session 1→1.x, Session 2→2.x, etc.
 * Sinon fallback sur hash(gameId) % 4.
 */
export function getRotationIndex(gameId: string, gameName?: string | null): number {
  const sessionNum = parseSessionNumberFromName(gameName);
  if (sessionNum !== undefined) return (sessionNum - 1) % 4;
  return stableHash(gameId) % 4;
}

/**
 * Pour un "cycle affiché" (1-4), retourne le numéro de cycle du catalogue (1-4).
 * gameName optionnel : si présent et contient un numéro (Session 1, 2, 3, 4), la rotation suit l’ordre des sessions.
 */
export function getCatalogCycle(displayCycle: number, gameId: string, gameName?: string | null): number {
  const r = getRotationIndex(gameId, gameName);
  return ((displayCycle - 1 + r) % 4) + 1;
}
