import { z } from "zod";

import { EmailSchema } from "./common.ts";

export const CONTACT_LIMITS = {
  name: 100,
  subject: 150,
  message: 5000,
} as const;

export const ContactTopicSchema = z.enum(["general", "support", "privacy", "delete-account"]);

export type ContactTopic = z.infer<typeof ContactTopicSchema>;

export const ContactRequestSchema = z.strictObject({
  topic: ContactTopicSchema,
  name: z.string().trim().max(CONTACT_LIMITS.name),
  email: EmailSchema,
  subject: z.string().trim().max(CONTACT_LIMITS.subject),
  message: z.string().trim().min(1).max(CONTACT_LIMITS.message),
  website: z.string().max(200),
});

export type ContactRequest = z.infer<typeof ContactRequestSchema>;

export const ContactResponseSchema = z.strictObject({
  status: z.literal("sent"),
});

export type ContactResponse = z.infer<typeof ContactResponseSchema>;
