export const COLORS = {
  ink: "#0E131B",
  ink2: "#1A222E",
  brass: "#C68B2C",
  brassDeep: "#8E5F14",
  brassLight: "#E3B35C",
  alert: "#D14A3E",
};

export const fullMark = (color) => `
  <circle cx="32" cy="22" r="10.5" fill="none" stroke="${color}" stroke-width="9"/>
  <rect x="26.5" y="30" width="11" height="26" rx="2" fill="${color}"/>
  <rect x="37.5" y="40" width="11.5" height="6" rx="1.5" fill="${color}"/>
  <rect x="37.5" y="49" width="7.5" height="7" rx="1.5" fill="${color}"/>`;

export const smallMark = (color) => `
  <circle cx="32" cy="22" r="14" fill="${color}"/>
  <rect x="25" y="30" width="14" height="26" rx="2" fill="${color}"/>
  <rect x="39" y="39" width="12" height="8" rx="1" fill="${color}"/>
  <rect x="39" y="50" width="8" height="6" rx="1" fill="${color}"/>`;

export const UNLOCKED_DEG = 32;

export const rotated = (shapes, deg) => (deg === 0 ? shapes : `<g transform="rotate(${deg} 32 32)">${shapes}</g>`);

export const alertDot = () => `<circle cx="52" cy="12" r="11" fill="${COLORS.alert}"/>`;
