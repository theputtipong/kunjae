import { Link } from "@tanstack/react-router";

import { useLang, useT } from "../i18n/index.ts";
import { LEGAL_EFFECTIVE_DATE, PRIVACY_POLICY, TERMS_OF_USE, type LegalDocument } from "../legal/documents.ts";

const LegalPage = ({ doc }: { readonly doc: LegalDocument }) => {
  const t = useT();

  return (
    <article className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-stone-900">{doc.title}</h1>
        <p className="text-sm text-stone-500">{t.legal.updated(LEGAL_EFFECTIVE_DATE)}</p>
        <p className="text-sm leading-relaxed text-stone-700">{doc.intro}</p>
      </header>

      {doc.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-base font-semibold text-stone-900">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-stone-700">
              {paragraph}
            </p>
          ))}
          {section.bullets !== undefined && (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <nav className="flex gap-4 border-t border-stone-200 pt-4 text-sm">
        <Link to="/privacy" className="font-medium text-brand-700 hover:underline">
          {t.legal.privacy}
        </Link>
        <Link to="/terms" className="font-medium text-brand-700 hover:underline">
          {t.legal.terms}
        </Link>
      </nav>
    </article>
  );
};

export const PrivacyPage = () => <LegalPage doc={PRIVACY_POLICY[useLang()]} />;

export const TermsPage = () => <LegalPage doc={TERMS_OF_USE[useLang()]} />;

export const LegalLinks = () => {
  const t = useT();
  return (
    <>
      <Link to="/privacy" className="hover:text-stone-900 hover:underline">
        {t.legal.privacy}
      </Link>
      <span aria-hidden="true"> · </span>
      <Link to="/terms" className="hover:text-stone-900 hover:underline">
        {t.legal.terms}
      </Link>
    </>
  );
};

export const AgreementNote = () => {
  const t = useT();
  return (
    <p className="text-xs leading-relaxed text-stone-500">
      {t.legal.agreeBefore}
      <Link to="/terms" className="font-medium text-brand-700 hover:underline">
        {t.legal.terms}
      </Link>
      {t.legal.agreeAnd}
      <Link to="/privacy" className="font-medium text-brand-700 hover:underline">
        {t.legal.privacy}
      </Link>
      {t.legal.agreeAfter}
    </p>
  );
};
