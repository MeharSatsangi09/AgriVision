// The uploader's Firebase Auth uid travels as Storage object metadata (`uid`). storage.rules require it to equal
// request.auth.uid, so it can't be forged for someone else. Only the uid is kept: never a phone number or anything
// else that identifies the person. Anything that doesn't look like a Firebase uid is ignored (report gets no owner).
export function uploaderUid(metadata: Record<string, string> | undefined | null): string | undefined {
  const uid = metadata?.uid;
  return typeof uid === "string" && /^[A-Za-z0-9]{6,128}$/.test(uid) ? uid : undefined;
}
