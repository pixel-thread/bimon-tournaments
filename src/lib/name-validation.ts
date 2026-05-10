/**
 * Detect display names that look "invisible" or unreadable — made of only
 * special Unicode (macrons, combining marks, etc.) with no Latin/ASCII core.
 * e.g. "ŌŌīōŌŪō" has zero recognisable characters → treat as invisible.
 */
export function isInvisibleName(name: string | null | undefined): boolean {
    if (!name || name.trim().length === 0) return true;
    // Strip Unicode decorators, combining marks, zero-width, macron-like chars
    const stripped = name
        .replace(/[\u0080-\u036F\u0370-\u03FF\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g, "") // combining/accented
        .replace(/[\u200B-\u200D\uFEFF\u00AD\u034F\u061C\u2060-\u2064\u2066-\u206F]/g, "") // zero-width
        .replace(/[^\x20-\x7E\u0400-\u04FF\u0900-\u097F\u4E00-\u9FFF\uAC00-\uD7AF]/g, "") // keep Latin/Cyrillic/Devanagari/CJK/Hangul
        .trim();
    return stripped.length === 0;
}
