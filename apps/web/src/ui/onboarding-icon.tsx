export type OnboardingIconName =
  | "lock"
  | "device"
  | "sync"
  | "key"
  | "person"
  | "shield"
  | "info"
  | "folder"
  | "clock"
  | "download"
  | "cloud";

const PATHS: Readonly<Record<OnboardingIconName, readonly string[]>> = {
  lock: ["M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z", "M8 11V7a4 4 0 0 1 8 0v4"],
  device: ["M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M8 20h8", "M12 16v4"],
  sync: ["M4 12a8 8 0 0 1 14-5.3L20 9", "M20 4v5h-5", "M20 12a8 8 0 0 1-14 5.3L4 15", "M4 20v-5h5"],
  key: ["M12 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0z", "M11 12l9-9", "M17 6l3 3", "M14.5 8.5l2 2"],
  person: ["M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z", "M4 21a8 8 0 0 1 16 0"],
  shield: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"],
  info: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "M12 11v6", "M12 7.5v.5"],
  folder: ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  clock: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "M12 7v5l3 2"],
  download: ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"],
  cloud: ["M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5z"],
};

export const OnboardingIcon = ({ name, size }: { readonly name: OnboardingIconName; readonly size: number }) => (
  <span
    aria-hidden="true"
    className="flex shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-800"
    style={{ width: size, height: size }}
  >
    <svg
      width={size * 0.55}
      height={size * 0.55}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  </span>
);
