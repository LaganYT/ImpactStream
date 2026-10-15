import { useCallback, useState } from "react";
import { FaFilm, FaInfoCircle } from "react-icons/fa";
import { CardMeta, MediaCard, RowScroller, SectionHeader, SkeletonCards } from "./MediaRow";
import TrailerDialog from "./TrailerDialog";
import { useTitleModal } from "./TitleModal";
import {
  backdropUrl,
  EXTRAS_PARAMS,
  getTitle,
  pickLogoUrl,
  pickTrailerKey,
  TmdbImages,
  TmdbListItem,
  TmdbVideo,
  toRowItem,
  toTitleRef,
} from "../utils/mediaItems";
import { getMediaType } from "../utils/mediaRouting";
import { useTmdb } from "../utils/tmdbClient";

type LeaderDetails = {
  credits?: { cast?: { name: string }[] };
  images?: TmdbImages;
  videos?: { results?: TmdbVideo[] };
};

const RankFlag = ({ rank }: { rank: number }) => (
  <span className="rank-flag" aria-label={`Number ${rank}`}>
    <small>Top</small>
    {rank}
  </span>
);

// Today's ten most-trending titles; #1 gets a wide card with cast, synopsis, and trailer.
export default function TopTenRow({ items }: { items: TmdbListItem[] | undefined }) {
  const { openTitle } = useTitleModal();
  const [showTrailer, setShowTrailer] = useState(false);
  const closeTrailer = useCallback(() => setShowTrailer(false), []);

  const ranked = items?.filter((item) => item.poster_path).slice(0, 10);
  const leader = ranked?.[0];
  const details = useTmdb<LeaderDetails>(
    leader ? `${getMediaType(leader)}/${leader.id}` : null,
    { append_to_response: "credits,images,videos", ...EXTRAS_PARAMS }
  );

  if (ranked && ranked.length === 0) return null;

  const logoUrl = pickLogoUrl(details?.images);
  const trailerKey = pickTrailerKey(details?.videos?.results);
  const cast = (details?.credits?.cast || []).slice(0, 4).map((person) => person.name);

  return (
    <section className="media-row top-ten">
      <SectionHeader title="Top 10 today" subtitle="The most-talked-about movies and shows right now" />
      <RowScroller label="Top 10">
        {!ranked || !leader ? (
          <SkeletonCards shape="poster" />
        ) : (
          <>
            <div className="top-feature">
              <div className="top-feature-art">
                <img src={backdropUrl(leader.backdrop_path, "w1280")} alt="" />
                <RankFlag rank={1} />
                <div className="top-feature-body">
                  {logoUrl ? (
                    <img className="top-feature-logo" src={logoUrl} alt={getTitle(leader)} />
                  ) : (
                    <h3>{getTitle(leader)}</h3>
                  )}
                  {cast.length ? <p className="top-feature-cast">{cast.join(", ")}</p> : null}
                  {leader.overview ? <p className="top-feature-overview">{leader.overview}</p> : null}
                  <div className="top-feature-actions">
                    <button className="btn-chip" onClick={() => openTitle(toTitleRef(leader))}>
                      <FaInfoCircle /> More info
                    </button>
                    {trailerKey ? (
                      <button className="btn-chip" onClick={() => setShowTrailer(true)}>
                        <FaFilm /> Trailer
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <span className="media-card-title">{getTitle(leader)}</span>
              <CardMeta item={toRowItem(leader, "poster")} />
            </div>
            {ranked.slice(1).map((item, index) => (
              <MediaCard
                key={item.id}
                item={toRowItem(item, "poster")}
                shape="poster"
                corner={<RankFlag rank={index + 2} />}
                onClick={() => openTitle(toTitleRef(item))}
              />
            ))}
          </>
        )}
      </RowScroller>
      {showTrailer && trailerKey && leader ? (
        <TrailerDialog videoKey={trailerKey} title={getTitle(leader)} onClose={closeTrailer} />
      ) : null}
    </section>
  );
}
