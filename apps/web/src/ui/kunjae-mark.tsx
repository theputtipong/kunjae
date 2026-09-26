const INK = "#0E131B";
const BRASS_LIGHT = "#E3B35C";

const FullShapes = ({ color }: { readonly color: string }) => (
  <>
    <circle cx="32" cy="22" r="10.5" fill="none" stroke={color} strokeWidth="9" />
    <rect x="26.5" y="30" width="11" height="26" rx="2" fill={color} />
    <rect x="37.5" y="40" width="11.5" height="6" rx="1.5" fill={color} />
    <rect x="37.5" y="49" width="7.5" height="7" rx="1.5" fill={color} />
  </>
);

const SmallShapes = ({ color }: { readonly color: string }) => (
  <>
    <circle cx="32" cy="22" r="14" fill={color} />
    <rect x="25" y="30" width="14" height="26" rx="2" fill={color} />
    <rect x="39" y="39" width="12" height="8" rx="1" fill={color} />
    <rect x="39" y="50" width="8" height="6" rx="1" fill={color} />
  </>
);

export type KunjaeMarkProps = {
  readonly size: number;
  readonly unlocked?: boolean;
  readonly tile?: boolean;
  readonly label?: string;
};

export const KunjaeMark = ({ size, unlocked = false, tile = true, label }: KunjaeMarkProps) => {
  const markPx = tile ? size * 0.61 : size;
  const color = tile ? BRASS_LIGHT : "currentColor";
  const shapes = markPx < 24 ? <SmallShapes color={color} /> : <FullShapes color={color} />;

  return (
    <svg
      width={size}
      height={size}
      viewBox={tile ? "0 0 104 104" : "0 0 64 64"}
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={tile ? "shrink-0" : "shrink-0 text-brand-700"}
    >
      {tile && (
        <rect
          x="1"
          y="1"
          width="102"
          height="102"
          rx="22.3"
          fill={INK}
          strokeWidth="2"
          style={{ stroke: "var(--kunjae-tile-edge)" }}
        />
      )}
      <g transform={tile ? "translate(20 20)" : undefined}>
        <g
          style={{ transform: unlocked ? "rotate(32deg)" : "rotate(0deg)", transformOrigin: "32px 32px" }}
          className="transition-transform duration-300 ease-out motion-reduce:transition-none"
        >
          {shapes}
        </g>
      </g>
    </svg>
  );
};
