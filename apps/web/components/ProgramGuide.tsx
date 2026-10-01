import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type GuideChannel = {
  nanoid: string;
  name: string;
};

type GuideProgram = {
  title: string;
  description: string;
  start: string;
  stop: string;
  category: string;
};

const CHANNELS_PER_BATCH = 20;
const WINDOW_HOURS = 6;
const SLOT_MINUTES = 30;
const PX_PER_MINUTE = 4;
const MINUTE_MS = 60_000;

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

const floorToSlot = (time: number) => {
  const slotMs = SLOT_MINUTES * MINUTE_MS;
  return Math.floor(time / slotMs) * slotMs;
};

export default function ProgramGuide({ channels }: { channels: GuideChannel[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(CHANNELS_PER_BATCH);
  const [programs, setPrograms] = useState<Record<string, GuideProgram[] | null>>({});

  // Tick once a minute so the "now" line and on-air highlight stay current.
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(interval);
  }, []);

  // Reset paging when the filtered channel set changes (not on every new array).
  const channelKey = channels.map((channel) => channel.nanoid).join(",");
  useEffect(() => {
    setVisibleCount(CHANNELS_PER_BATCH);
  }, [channelKey]);

  const visibleChannels = useMemo(
    () => channels.slice(0, visibleCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channelKey, visibleCount]
  );

  useEffect(() => {
    const missing = visibleChannels
      .map((channel) => channel.nanoid)
      .filter((id) => !(id in programs));
    if (missing.length === 0) return;

    setPrograms((current) => ({
      ...current,
      ...Object.fromEntries(missing.map((id) => [id, null])),
    }));

    for (let index = 0; index < missing.length; index += CHANNELS_PER_BATCH) {
      const batch = missing.slice(index, index + CHANNELS_PER_BATCH);
      axios
        .get<{ channels: Record<string, { programs: GuideProgram[] }> }>("/api/live-tv-guide", {
          params: { channels: batch.join(",") },
        })
        .then(({ data }) => {
          setPrograms((current) => ({
            ...current,
            ...Object.fromEntries(batch.map((id) => [id, data.channels?.[id]?.programs || []])),
          }));
        })
        .catch(() => {
          setPrograms((current) => ({
            ...current,
            ...Object.fromEntries(batch.map((id) => [id, []])),
          }));
        });
    }
  }, [visibleChannels, programs]);

  const windowStart = useMemo(() => floorToSlot(now), [now]);
  const windowEnd = windowStart + WINDOW_HOURS * 60 * MINUTE_MS;
  const timelineWidth = WINDOW_HOURS * 60 * PX_PER_MINUTE;
  const slots = Array.from(
    { length: (WINDOW_HOURS * 60) / SLOT_MINUTES },
    (_, index) => windowStart + index * SLOT_MINUTES * MINUTE_MS
  );
  const toOffset = (time: number) => ((time - windowStart) / MINUTE_MS) * PX_PER_MINUTE;

  if (channels.length === 0) {
    return (
      <div className="no-results">
        <h3>No guide data for these channels</h3>
        <p>Try a different country, language, or category.</p>
      </div>
    );
  }

  return (
    <div className="program-guide">
      <div className="program-guide-scroll">
        <div className="pg-row pg-header-row" style={{ width: timelineWidth + 220 }}>
          <div className="pg-channel pg-corner">Channel</div>
          <div className="pg-timeline" style={{ width: timelineWidth }}>
            {slots.map((slot) => (
              <span
                key={slot}
                className="pg-slot-label"
                style={{ left: toOffset(slot), width: SLOT_MINUTES * PX_PER_MINUTE }}
              >
                {timeFormatter.format(slot)}
              </span>
            ))}
          </div>
        </div>

        {visibleChannels.map((channel) => {
          const channelPrograms = programs[channel.nanoid];
          const inWindow = (channelPrograms || []).filter((program) => {
            const start = new Date(program.start).getTime();
            const stop = program.stop ? new Date(program.stop).getTime() : start + 30 * MINUTE_MS;
            return stop > windowStart && start < windowEnd;
          });

          return (
            <div key={channel.nanoid} className="pg-row" style={{ width: timelineWidth + 220 }}>
              <Link href={`/live-tv/${channel.nanoid}`} className="pg-channel" title={channel.name}>
                {channel.name}
              </Link>
              <div className="pg-timeline" style={{ width: timelineWidth }}>
                <span className="pg-now-line" style={{ left: toOffset(now) }} aria-hidden="true" />
                {channelPrograms === null ? (
                  <span className="pg-status">Loading guide…</span>
                ) : inWindow.length === 0 ? (
                  <span className="pg-status">No listings for the next {WINDOW_HOURS} hours</span>
                ) : (
                  inWindow.map((program) => {
                    const start = new Date(program.start).getTime();
                    const stop = program.stop
                      ? new Date(program.stop).getTime()
                      : start + 30 * MINUTE_MS;
                    const left = toOffset(Math.max(start, windowStart));
                    const width = toOffset(Math.min(stop, windowEnd)) - left;
                    const isOnAir = start <= now && now < stop;

                    return (
                      <Link
                        key={`${program.start}-${program.title}`}
                        href={`/live-tv/${channel.nanoid}`}
                        className={isOnAir ? "pg-program on-air" : "pg-program"}
                        style={{ left, width: Math.max(width - 4, 8) }}
                        title={`${program.title}\n${timeFormatter.format(start)} – ${timeFormatter.format(stop)}${
                          program.description ? `\n\n${program.description}` : ""
                        }`}
                      >
                        <strong>{program.title}</strong>
                        <span>
                          {timeFormatter.format(start)} – {timeFormatter.format(stop)}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visibleCount < channels.length ? (
        <div className="load-more-row">
          <button
            className="btn-more-info"
            onClick={() => setVisibleCount((count) => count + CHANNELS_PER_BATCH)}
          >
            Load more channels ({channels.length - visibleCount} left)
          </button>
        </div>
      ) : null}
    </div>
  );
}
