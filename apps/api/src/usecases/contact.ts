import type { ContactRequest, ContactTopic } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import type { ContactConfig } from "../config/contact.ts";
import { sendWithResend } from "../mail/resend.ts";
import { isoNow, type Deps } from "./deps.ts";
import { internal, type UseCaseResult } from "./errors.ts";

const TOPIC_LABELS: Readonly<Record<ContactTopic, string>> = {
  general: "General",
  support: "Support",
  privacy: "Privacy",
  "delete-account": "Account deletion request",
};

const CONTROL_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;

const singleLine = (value: string): string => value.replace(CONTROL_CHARACTERS, " ").trim();

export const buildContactEmail = (
  config: ContactConfig,
  request: ContactRequest,
  requestId: string,
  receivedAt: string,
) => {
  const topic = TOPIC_LABELS[request.topic];
  const subject = singleLine(request.subject);
  const name = singleLine(request.name);

  return {
    from: config.from,
    to: config.to,
    replyTo: request.email,
    subject: `[Kunjae] ${topic}${subject.length > 0 ? `: ${subject}` : ""}`,
    text: [
      `Topic: ${topic}`,
      `From: ${name.length > 0 ? `${name} <${request.email}>` : request.email}`,
      `Received: ${receivedAt}`,
      `Request ID: ${requestId}`,
      "",
      request.message,
    ].join("\n"),
    idempotencyKey: requestId,
  };
};

export const submitContact = async (
  deps: Deps,
  config: ContactConfig,
  request: ContactRequest,
  requestId: string,
): Promise<UseCaseResult<{ readonly status: "sent" }>> => {
  if (request.website.length > 0) return ok({ status: "sent" });

  const email = buildContactEmail(config, request, requestId, isoNow(deps.nowMs));
  const sent = await sendWithResend(config.resendApiKey, email);
  return sent ? ok({ status: "sent" }) : err(internal());
};
