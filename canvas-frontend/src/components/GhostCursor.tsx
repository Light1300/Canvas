import { CursorPosition } from "../hooks/useRoomSocket";

interface Props {
  cursors: Map<string, CursorPosition>;
  currentUserId: string;
}

export default function GhostCursors({ cursors, currentUserId }: Props) {
  return (
    <>
      {Array.from(cursors.values())
        .filter((c) => c.userId !== currentUserId)
        .map((cursor) => (
          <div
            key={cursor.userId}
            className="pointer-events-none absolute z-10 flex items-center gap-1"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: "translate(8px, 8px)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path
                d="M0 0 L0 12 L4 9 L7 14 L9 13 L6 8 L11 8 Z"
                fill={cursor.color}
                stroke="#0f0f11"
                strokeWidth="1"
              />
            </svg>
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium text-black whitespace-nowrap"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.username}
            </span>
          </div>
        ))}
    </>
  );
}