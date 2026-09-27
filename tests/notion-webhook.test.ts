import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  isNotionVerificationHandshake,
  verifyNotionSignature,
} from "../lib/notion-webhook.ts";

const verificationToken = "test-notion-webhook-token";
const rawBody = JSON.stringify({
  id: "event-123",
  type: "page.content_updated",
  entity: {
    id: "page-123",
    type: "page",
  },
});

function sign(body: string): string {
  return `sha256=${createHmac("sha256", verificationToken)
    .update(body, "utf8")
    .digest("hex")}`;
}

test("accepts a valid Notion webhook signature", () => {
  const previousToken = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = verificationToken;

  try {
    assert.equal(
      verifyNotionSignature(rawBody, sign(rawBody)),
      true,
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
    } else {
      process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = previousToken;
    }
  }
});

test("rejects an invalid Notion webhook signature", () => {
  const previousToken = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = verificationToken;

  try {
    assert.equal(
      verifyNotionSignature(rawBody, sign(rawBody) + "00"),
      false,
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
    } else {
      process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = previousToken;
    }
  }
});

test("rejects a missing Notion webhook signature", () => {
  const previousToken = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = verificationToken;

  try {
    assert.equal(
      verifyNotionSignature(rawBody, null),
      false,
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
    } else {
      process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = previousToken;
    }
  }
});

test("rejects a malformed Notion webhook signature", () => {
  const previousToken = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = verificationToken;

  try {
    assert.equal(
      verifyNotionSignature(rawBody, "sha256=not-a-valid-signature"),
      false,
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
    } else {
      process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = previousToken;
    }
  }
});

test("recognizes the historical Notion verification handshake", () => {
  assert.equal(
    isNotionVerificationHandshake(
      {
        verification_token: "verification-token-123",
      },
      null,
    ),
    true,
  );
});

test("does not treat a signed payload as a verification handshake", () => {
  assert.equal(
    isNotionVerificationHandshake(
      {
        verification_token: "verification-token-123",
      },
      "sha256=abc",
    ),
    false,
  );
});

test("does not treat an unrelated payload as a verification handshake", () => {
  assert.equal(
    isNotionVerificationHandshake(
      {
        type: "page.content_updated",
      },
      null,
    ),
    false,
  );
});
