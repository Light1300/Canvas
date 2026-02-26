
const CURSOR_COLORS = [
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#facc15",
  "#22d3ee",
  "#f87171",
  "#4ade80",
  "#e879f9",
];

export const getUserColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length]!;
};