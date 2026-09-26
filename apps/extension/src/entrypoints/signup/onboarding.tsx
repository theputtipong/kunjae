import { useEffect, useRef, useState } from "react";

import { KunjaeMark } from "../../kunjae-mark.tsx";
import { OnboardingIcon, type OnboardingIconName } from "../../onboarding-icon.tsx";
import { dictionary, type Dictionary } from "../../i18n.ts";

const t = dictionary();

const finish = (): void => {
  window.close();
};

type Point = {
  readonly icon: OnboardingIconName;
  readonly title: string;
  readonly body: string;
};

type DetailPage = {
  readonly icon: OnboardingIconName;
  readonly title: string;
  readonly points: readonly Point[];
  readonly note?: string;
};

const welcomePoints = (o: Dictionary["onboarding"]): readonly Point[] => [
  { icon: "lock", title: o.zkTitle, body: o.zkBody },
  { icon: "device", title: o.noAccountTitle, body: o.noAccountBody },
  { icon: "sync", title: o.syncTitle, body: o.syncBody },
];

const detailPages = (o: Dictionary["onboarding"]): readonly DetailPage[] => [
  {
    icon: "device",
    title: o.waysTitle,
    points: [
      { icon: "device", title: o.deviceTitle, body: o.deviceBody },
      { icon: "cloud", title: o.accountTitle, body: o.accountBody },
    ],
    note: o.waysMove,
  },
  {
    icon: "key",
    title: o.keysTitle,
    points: [
      { icon: "person", title: o.masterTitle, body: o.masterBody },
      { icon: "key", title: o.secretTitle, body: o.secretBody },
      { icon: "shield", title: o.whyTitle, body: o.whyBody },
    ],
  },
  {
    icon: "info",
    title: o.beforeTitle,
    points: [
      { icon: "info", title: o.noResetTitle, body: o.noResetBody },
      { icon: "folder", title: o.separateTitle, body: o.separateBody },
      { icon: "download", title: o.exportTitle, body: o.exportBody },
      { icon: "clock", title: o.slowTitle, body: o.slowBody },
    ],
  },
];

const PointList = ({ points }: { readonly points: readonly Point[] }) => (
  <ul className="space-y-4">
    {points.map((point) => (
      <li key={point.title} className="flex items-start gap-4">
        <OnboardingIcon name={point.icon} size={40} />
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-stone-900">{point.title}</h2>
          <p className="text-sm text-stone-600">{point.body}</p>
        </div>
      </li>
    ))}
  </ul>
);

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

export const OnboardingPage = () => {
  const o = t.onboarding;
  const [index, setIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const details = detailPages(o);
  const total = details.length + 1;
  const last = index === total - 1;
  const page = index === 0 ? null : details[index - 1];

  useEffect(() => {
    document.title = o.welcomeTitle;
  }, [o.welcomeTitle]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      if (event.key === "ArrowRight") setIndex((current) => Math.min(current + 1, total - 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [total]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 text-sm">
      {page === null || page === undefined ? (
        <section className="space-y-6 pt-6">
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <KunjaeMark size={112} label={o.markLabel} />
            </div>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-stone-900 outline-none">
              {o.welcomeTitle}
            </h1>
            <p className="text-sm text-stone-600">{o.welcomeTagline}</p>
          </div>
          <PointList points={welcomePoints(o)} />
        </section>
      ) : (
        <section className="space-y-5 pt-2">
          <OnboardingIcon name={page.icon} size={64} />
          <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-stone-900 outline-none">
            {page.title}
          </h1>
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <PointList points={page.points} />
          </div>
          {page.note !== undefined && (
            <p className="rounded-2xl border border-brand-300 bg-brand-100 px-4 py-3 text-sm font-medium text-stone-800">
              {page.note}
            </p>
          )}
        </section>
      )}

      <nav aria-label={o.pagesLabel} className="flex justify-center">
        <ol className="flex items-center gap-1">
          {Array.from({ length: total }, (_, i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={o.dot(i + 1, total)}
                aria-current={i === index ? "step" : undefined}
                onClick={() => {
                  setIndex(i);
                }}
                className="flex h-6 items-center justify-center rounded-full px-1"
              >
                <span
                  className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-brand-400" : "w-2 bg-stone-300"}`}
                />
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-2">
        {last && <p className="text-center text-sm text-stone-600">{o.toolbarHint}</p>}
        <button
          type="button"
          onClick={() => {
            if (last) finish();
            else setIndex(index + 1);
          }}
          className="w-full rounded-full bg-brand-400 px-5 py-2.5 text-sm font-medium text-brand-950 hover:bg-brand-300"
        >
          {index === 0 ? o.start : last ? o.finish : o.next}
        </button>

        <div className="flex items-center justify-between">
          {index > 0 ? (
            <button
              type="button"
              onClick={() => {
                setIndex(index - 1);
              }}
              className="rounded-full px-3 py-2 text-sm font-medium text-brand-700 hover:underline"
            >
              {o.back}
            </button>
          ) : (
            <span />
          )}
          {!last && (
            <button
              type="button"
              onClick={finish}
              className="rounded-full px-3 py-2 text-sm font-medium text-stone-600 hover:underline"
            >
              {o.skip}
            </button>
          )}
        </div>
      </div>
    </main>
  );
};
