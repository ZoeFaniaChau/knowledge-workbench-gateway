import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  isNotionVerificationHandshake,
  verifyNotionSignature,
} from "../lib/notion-webhook.ts";

const verificationToken = "test-verification-token";

function sign(body: string, secret: string) {
  return `sha256=${createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex")}`;
}

test("accepts a valid Notion webhook signature", () => {
  const body = JSON.stringify({
    type: "page.content_updated",
    entity: {
      id: "page-123",
    },
  });

  const signature = sign(body, verificationToken);

  assert.equal(
    verifyNotionSignature(body, signature, verificationToken),
    true,
  );
});

test("rejects an invalid Notion webhook signature", () => {
  const body = JSON.stringify({
    type: "page.content_updated",
    entity: {
      id: "page-123",
    },
  });

  assert.equal(
    verifyNotionSignature(body, "sha256=invalid", verificationToken),
    false,
  );
});

test("rejects a missing Notion webhook signature", () => {
  const body = JSON.stringify({
    type: "page.content_updated",
  });

  assert.equal(
    verifyNotionSignature(body, null, verificationToken),
    false,
  );
});

test("rejects a malformed Notion webhook signature", () => {
  const body = JSON.stringify({
    type: "page.content_updated",
  });

  assert.equal(
    verifyNotionSignature(body, "invalid-signature", verificationToken),
    false,
  );
});

test("recognizes a Notion verification handshake", () => {
  const body = {
    verification_token: verificationToken,
  };

  assert.equal(
    isNotionVerificationHandshake(body),
    true,
  );
});

test("recognizes a signed Notion verification handshake", () => {
  const body = {
    verification_token: verificationToken,
  };

  const rawBody = JSON.stringify(body);
  const signature = sign(rawBody, verificationToken);

  assert.equal(
    isNotionVerificationHandshake(body),
    true,
  );

  assert.equal(
    verifyNotionSignature(
      rawBody,
      signature,
      body.verification_token,
    ),
    true,
  );
});

test("does not treat an unrelated payload as a verification handshake", () => {
  const body = {
    type: "page.content_updated",
    entity: {
      id: "page-123",
    },
  };

  assert.equal(
    isNotionVerificationHandshake(body),
    false,
  );
});
