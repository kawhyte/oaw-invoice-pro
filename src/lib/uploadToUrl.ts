// Browser-side: PUT a file/blob to a presigned URL from a server action.
export async function uploadToUrl(url: string, body: Blob, contentType: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': contentType } })
  } catch {
    throw new Error('Upload failed. Check your connection and try again.')
  }
  // B2's free tier enforces $0 daily caps by refusing requests (403) rather than billing.
  if (res.status === 403 && /cap exceeded/i.test(await res.text().catch(() => ''))) {
    throw new Error('Storage limit reached for today — try again tomorrow.')
  }
  if (!res.ok) throw new Error(`Upload failed (${res.status}). Check your connection and try again.`)
}
