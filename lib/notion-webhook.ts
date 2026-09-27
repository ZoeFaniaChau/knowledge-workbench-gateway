import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyNotionSignature(
  rawBody: string,
  signature: string | null,
  verificationToken = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN,
): boolean {
  if (!verificationToken || !signature?.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signature.slice("sha256=".length);

  if (!/^[0-9a-f]{64}$/i.test(receivedHex)) {
    return false;
  }

  const expectedHex = createHmac("sha256", verificationToken)
    .update(rawBody, "utf8")
    .digest("hex");

  const received = Buffer.from(receivedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return timingSafeEqual(received, expected);
}

export function isNotionVerificationHandshake(
  body: unknown,
): body is { verification_token: string } {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  if (!("verification_token" in body)) {
    return false;
  }

  return (
    typeof body.verification_token === "string" &&
    body.verification_token.length > 0
  );
}
