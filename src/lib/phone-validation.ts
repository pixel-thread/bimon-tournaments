/**
 * Phone number validation utilities.
 * Blocks known dummy/placeholder phone numbers.
 */

// Common dummy patterns (digits only, after stripping country code)
const DUMMY_PATTERNS = [
    "1234567890",
    "0123456789",
    "9876543210",
    "0000000000",
    "1111111111",
    "2222222222",
    "3333333333",
    "4444444444",
    "5555555555",
    "6666666666",
    "7777777777",
    "8888888888",
    "9999999999",
    "1234512345",
    "1234567891",
    "9999999999",
    "1000000000",
    "1122334455",
    "9876509876",
];

/**
 * Check if a phone number is a known dummy/placeholder.
 * @param phone Raw phone string (may include +91, spaces, dashes)
 * @returns true if the number is fake/dummy
 */
export function isDummyPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, "");
    // Get last 10 digits (strip country code)
    const local = digits.slice(-10);

    if (local.length < 10) return true; // too short

    // Check against known patterns
    if (DUMMY_PATTERNS.includes(local)) return true;

    // All same digit (e.g. 7777777777)
    if (/^(\d)\1{9}$/.test(local)) return true;

    // Sequential ascending (1234567890)
    if (local === "1234567890" || local === "0123456789") return true;

    // Sequential descending (9876543210)
    if (local === "9876543210") return true;

    // Repeating pairs (e.g. 1212121212, 1313131313)
    if (/^(\d{2})\1{4}$/.test(local)) return true;

    return false;
}

/**
 * Validate and clean a phone number.
 * @returns cleaned phone string or error message
 */
export function validatePhone(raw: string): { valid: true; phone: string } | { valid: false; error: string } {
    const cleaned = raw.replace(/\D/g, "");
    const local = cleaned.slice(-10);

    if (local.length < 10) {
        return { valid: false, error: "Enter a valid 10-digit phone number" };
    }

    if (isDummyPhone(local)) {
        return { valid: false, error: "Please enter your real phone number, not a placeholder" };
    }

    // Indian numbers start with 6-9
    if (!/^[6-9]/.test(local)) {
        return { valid: false, error: "Enter a valid Indian mobile number" };
    }

    return { valid: true, phone: `+91${local}` };
}
