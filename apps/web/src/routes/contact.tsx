import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { CONTACT_LIMITS, type ContactTopic } from "@kunjae/contracts";
import { errorMessage, getSessionView, sendContactMessage } from "@kunjae/client-core";
import { useLang, useT } from "../i18n/index.ts";
import { LEGAL_CONTACT_EMAIL } from "../legal/documents.ts";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";

const TOPICS: readonly ContactTopic[] = ["general", "support", "privacy", "delete-account"];

const INPUT_CLASS =
  "w-full rounded-xl border border-stone-300 bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-400/40";

const ContactForm = ({ fixedTopic }: { readonly fixedTopic?: ContactTopic }) => {
  const t = useT();
  const lang = useLang();
  const [topic, setTopic] = useState<ContactTopic>(fixedTopic ?? "general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(getSessionView().email ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(fixedTopic === "delete-account" ? t.deleteAccount.messagePlaceholder : "");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const result = await sendContactMessage({ topic, name, email: email.trim(), subject, message, website });
    setBusy(false);
    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      return;
    }
    setSent(true);
  };

  if (sent) return <Callout tone="success">{t.contact.sent}</Callout>;

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {fixedTopic === undefined && (
          <div className="space-y-1">
            <label htmlFor="contact-topic" className="block text-sm font-medium text-stone-700">
              {t.contact.topic}
            </label>
            <select
              id="contact-topic"
              value={topic}
              onChange={(event) => { setTopic(event.target.value as ContactTopic); }}
              className={INPUT_CLASS}
            >
              {TOPICS.map((value) => (
                <option key={value} value={value}>
                  {t.contact.topics[value]}
                </option>
              ))}
            </select>
          </div>
        )}

        <Field label={t.contact.email} type="email" value={email} onChange={setEmail} hint={t.contact.emailHint} />
        <Field label={t.contact.name} value={name} onChange={setName} />
        {fixedTopic === undefined && <Field label={t.contact.subject} value={subject} onChange={setSubject} />}

        <div className="space-y-1">
          <label htmlFor="contact-message" className="block text-sm font-medium text-stone-700">
            {t.contact.message}
          </label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(event) => { setMessage(event.target.value); }}
            rows={6}
            maxLength={CONTACT_LIMITS.message}
            aria-describedby="contact-message-hint"
            className={INPUT_CLASS}
          />
          <span id="contact-message-hint" className="block text-xs text-stone-500">
            {t.contact.messageHint}
          </span>
        </div>

        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => { setWebsite(event.target.value); }}
            />
          </label>
        </div>

        {error !== null && <Callout tone="danger">{error}</Callout>}

        <Button type="submit" disabled={busy || email.trim() === "" || message.trim() === ""}>
          {busy ? t.contact.sending : t.contact.send}
        </Button>
      </form>
    </Card>
  );
};

export const ContactPage = () => {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-stone-900">{t.contact.title}</h1>
        <p className="text-sm text-stone-600">{t.contact.intro}</p>
      </header>
      <ContactForm />
      <p className="text-center text-xs text-stone-500">{t.contact.alternative(LEGAL_CONTACT_EMAIL)}</p>
    </div>
  );
};

const List = ({ items, ordered = false }: { readonly items: readonly string[]; readonly ordered?: boolean }) => {
  const className = `${ordered ? "list-decimal" : "list-disc"} space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700`;
  const children = items.map((item) => <li key={item}>{item}</li>);
  return ordered ? <ol className={className}>{children}</ol> : <ul className={className}>{children}</ul>;
};

export const DeleteAccountPage = () => {
  const t = useT();
  const signedIn = getSessionView().mode === "account";

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-stone-900">{t.deleteAccount.title}</h1>
        <p className="text-sm text-stone-600">{t.deleteAccount.intro}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-stone-900">{t.deleteAccount.selfTitle}</h2>
        <List items={t.deleteAccount.selfSteps} ordered />
        <Link
          to={signedIn ? "/settings" : "/sign-in"}
          className="inline-block rounded-full bg-brand-400 px-5 py-2.5 text-sm font-medium text-brand-950 hover:bg-brand-300"
        >
          {signedIn ? t.deleteAccount.openSettings : t.deleteAccount.signIn}
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-stone-900">{t.deleteAccount.requestTitle}</h2>
        <p className="text-sm leading-relaxed text-stone-700">{t.deleteAccount.requestBody}</p>
        <ContactForm fixedTopic="delete-account" />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-stone-900">{t.deleteAccount.whatTitle}</h2>
        <List items={t.deleteAccount.what} />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-stone-900">{t.deleteAccount.keptTitle}</h2>
        <List items={t.deleteAccount.kept} />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-stone-900">{t.deleteAccount.localTitle}</h2>
        <p className="text-sm leading-relaxed text-stone-700">{t.deleteAccount.localBody}</p>
      </section>

      <p className="text-center text-xs text-stone-500">{t.contact.alternative(LEGAL_CONTACT_EMAIL)}</p>
    </div>
  );
};
