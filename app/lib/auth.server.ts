/**
 * API authentication for write endpoints.
 * Validates Bearer token or X-API-Key header against ADMIN_API_KEY secret.
 */
export function authenticateRequest(
  request: Request,
  adminKey: string | undefined,
): Response | null {
  if (!adminKey) {
    return Response.json(
      { error: "ADMIN_API_KEY not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("X-API-Key");

  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : apiKeyHeader;

  if (!token || token !== adminKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Auth passed
}
