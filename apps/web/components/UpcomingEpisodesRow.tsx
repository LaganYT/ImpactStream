import { useEffect, useState } from "react";
import { FaBookmark } from "react-icons/fa";
import MediaRow, { MediaRowItem } from "./MediaRow";
import { useTitleModal } from "./TitleModal";
import { backdropUrl, daysFromToday, formatShortDate, TmdbPage } from "../utils/mediaItems";
import { useMyList } from "../utils/myList";
import { tmdbFetch, useTmdb } from "../utils/tmdbClient";

type EpisodeAir = {
  air_date?: string;
  season_number: number;
  episode_number: number;
  still_path?: string | null;
};

type ShowDetails = {
  id: number;
  name?: string;
  backdrop_path?: string | null;
  vote_average?: number;
  next_episode_to_air?: EpisodeAir | null;
  last_episode_to_air?: EpisodeAir | null;
};

const MAX_SHOWS = 18;
const UPCOMING_WINDOW_DAYS = 14;
const RECENT_WINDOW_DAYS = 10;

function dayLabel(date: string, days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return formatShortDate(date);
}

// Picks the episode worth surfacing: one airing soon, else one that just aired.
function featuredEpisode(show: ShowDetails) {
  const candidates = [
    { episode: show.next_episode_to_air, min: 0, max: UPCOMING_WINDOW_DAYS },
    { episode: show.last_episode_to_air, min: -RECENT_WINDOW_DAYS, max: 0 },
  ];
  for (const { episode, min, max } of candidates) {
    if (!episode?.air_date) continue;
    const days = daysFromToday(episode.air_date);
    if (days >= min && days <= max) return { episode, date: episode.air_date, days };
  }
  return null;
}

function episodeBadge(episode: EpisodeAir, days: number) {
  if (episode.episode_number === 1) return episode.season_number === 1 ? "Series premiere" : "New season";
  return days > 0 ? "Coming up" : "New episode";
}

// New and upcoming episodes, with shows from My List first.
export default function UpcomingEpisodesRow() {
  const { openTitle } = useTitleModal();
  const myList = useMyList();
  const onTheAir = useTmdb<TmdbPage>("tv/on_the_air");
  const [shows, setShows] = useState<{ show: ShowDetails; saved: boolean }[] | undefined>();

  const savedIds = myList.items.filter((item) => item.mediaType === "tv").map((item) => item.id);
  const airingIds = (onTheAir?.results || []).map((item) => item.id);
  const idsKey = JSON.stringify([savedIds, airingIds]);

  useEffect(() => {
    if (onTheAir === undefined) return;
    const [saved, airing] = JSON.parse(idsKey) as [number[], number[]];
    const ids = [...new Set([...saved, ...airing])].slice(0, MAX_SHOWS);

    let cancelled = false;
    Promise.all(ids.map((id) => tmdbFetch<ShowDetails>(`tv/${id}`).catch(() => null))).then(
      (results) => {
        if (cancelled) return;
        setShows(
          results
            .filter((show): show is ShowDetails => Boolean(show))
            .map((show) => ({ show, saved: saved.includes(show.id) }))
        );
      }
    );
    return () => {
      cancelled = true;
    };
  }, [idsKey, onTheAir]);

  const items = shows
    ?.map(({ show, saved }) => ({ show, saved, featured: featuredEpisode(show) }))
    .filter((entry) => entry.featured)
    .sort(
      (a, b) =>
        Number(b.saved) - Number(a.saved) ||
        Math.abs(a.featured!.days) - Math.abs(b.featured!.days)
    )
    .map(({ show, saved, featured }): MediaRowItem & { saved: boolean } => {
      const { episode, date, days } = featured!;
      return {
        id: show.id,
        title: show.name || "Untitled",
        imageUrl: show.backdrop_path
          ? backdropUrl(show.backdrop_path)
          : backdropUrl(episode.still_path),
        rating: show.vote_average,
        highlight: `S${episode.season_number}.E${episode.episode_number}`,
        details: [dayLabel(date, days)],
        badge: episodeBadge(episode, days),
        saved,
      };
    });

  if (onTheAir === null) return null;

  return (
    <MediaRow
      title="New & upcoming episodes"
      subtitle="Fresh episodes and premieres, starting with shows on your list"
      href="/browse/tv"
      shape="backdrop"
      items={items}
      onItemClick={(row) => openTitle({ id: Number(row.id), mediaType: "tv" })}
      renderCorner={(row) =>
        items?.find((item) => item.id === row.id)?.saved ? (
          <span className="saved-corner" title="On your list">
            <FaBookmark aria-hidden />
          </span>
        ) : null
      }
    />
  );
}
