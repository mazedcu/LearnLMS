/**
 * Extract a human-friendly error message from an Axios error response.
 * Handles string body, { detail }, and field-keyed validation errors.
 */
export function apiErrorMessage(error, fallback = "Something went wrong.") {
  const data = error?.response?.data;
  if (!data) return error?.message || fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const entries = Object.entries(data);
  if (entries.length === 1) {
    const [, value] = entries[0];
    return Array.isArray(value) ? value.join(" ") : String(value);
  }
  return Object.entries(data)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join(" ");
}
