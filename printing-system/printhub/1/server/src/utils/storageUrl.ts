/**
 * Builds a public Firebase Storage download URL from a stored download token.
 * This avoids `getSignedUrl()`, which requires the runtime service account to
 * have the IAM "Service Account Token Creator" role on itself — a role Cloud
 * Functions v2's default service account does not have out of the box.
 * The token itself is unguessable (a v4 UUID), so this is safe to expose.
 */
export function buildDownloadUrl(bucketName: string, storagePath: string, token: string): string {
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
}
