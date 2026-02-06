/**
 * Core Schema Definitions for Camporee Conductor
 * Shared between Server (Node.js) and Client (Browser)
 */

export const FIELD_TYPES = {
    TEXT: 'text',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    TIMED: 'timed',
    STOPWATCH: 'stopwatch',
    SELECT: 'select',
    RANGE: 'range',
    TEXTAREA: 'textarea'
};

/**
 * Normalizes a raw game definition (from JSON or Designer) into a runtime-ready object.
 * Handles the translation of Designer 'components' to Runtime 'fields'.
 *
 * @param {Object} gameDef - The raw game definition object loaded from disk/network.
 * @param {number} [playlistOrder=0] - The sort order from the playlist manifest.
 * @returns {Object} The normalized game object.
 */
export function normalizeGameDefinition(gameDef, playlistOrder = 0) {
    // Clone to avoid mutating the input
    const game = JSON.parse(JSON.stringify(gameDef));

    // --- THE TRANSLATION LAYER ---
    // Map Designer Schema (scoring.components) -> Collator Schema (fields)
    if (game.scoring && game.scoring.components) {
        game.fields = game.scoring.components.map(comp => ({
            id: comp.id,
            label: comp.label,
            type: comp.type === FIELD_TYPES.STOPWATCH ? FIELD_TYPES.TIMED : comp.type,
            kind: comp.kind,
            weight: comp.weight,
            audience: comp.audience,
            ...comp.config // Spread min/max/placeholder into root
        }));
    } else if (!game.fields) {
        game.fields = [];
    }

    game.sortOrder = playlistOrder * 10;

    return game;
}