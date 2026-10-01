import Link from "next/link";
import MediaRow from "./MediaRow";
import { useTitleModal } from "./TitleModal";
import { useMyList } from "../utils/myList";
import { posterUrl } from "../utils/posters";

export default function MyListRow({ maxItems = 18 }: { maxItems?: number }) {
  const { items } = useMyList();
  const { openTitle } = useTitleModal();

  if (items.length === 0) return null;

  return (
    <MediaRow
      title="My List"
      action={
        <Link href="/my-list" className="media-row-link">
          See all
        </Link>
      }
      items={items.slice(0, maxItems).map((item) => ({
        id: `${item.mediaType}:${item.id}`,
        title: item.title,
        posterUrl: posterUrl(item.posterPath),
        year: item.year,
        rating: item.rating,
      }))}
      onItemClick={(row) => {
        const item = items.find((entry) => `${entry.mediaType}:${entry.id}` === row.id);
        if (item) openTitle({ id: item.id, mediaType: item.mediaType, isAnime: item.isAnime });
      }}
    />
  );
}
