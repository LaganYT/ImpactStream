import Link from "next/link";
import PosterGrid from "../components/PosterGrid";
import { useTitleModal } from "../components/TitleModal";
import { MyListItem, useMyList } from "../utils/myList";
import { posterUrl } from "../utils/posters";

const itemKey = (item: MyListItem) => `${item.mediaType}:${item.id}`;

export default function MyListPage() {
  const { items, remove } = useMyList();
  const { openTitle } = useTitleModal();

  const findItem = (key: string) => items.find((item) => itemKey(item) === key);

  return (
    <main className="container discover-shell">
      <section className="discover-search-panel">
        <div className="discover-search-header">
          <h1>My List</h1>
          <p>
            {items.length > 0
              ? `${items.length} saved title${items.length === 1 ? "" : "s"}`
              : "Titles you save will show up here."}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="discover-empty my-list-empty">
            <h3>Your list is empty</h3>
            <p>
              Open any title and choose <strong>+ My List</strong> to save it for later.
            </p>
            <Link href="/browse/movie" className="discover-chip active">
              Browse titles
            </Link>
          </div>
        ) : (
          <PosterGrid
            items={items.map((item) => ({
              key: itemKey(item),
              title: item.title,
              posterUrl: posterUrl(item.posterPath),
              label: item.isAnime ? "ANIME" : item.mediaType === "tv" ? "TV" : "MOVIE",
              year: item.year,
              rating: item.rating,
            }))}
            onSelect={(gridItem) => {
              const item = findItem(gridItem.key);
              if (item) openTitle({ id: item.id, mediaType: item.mediaType, isAnime: item.isAnime });
            }}
            onRemove={(gridItem) => {
              const item = findItem(gridItem.key);
              if (item) remove(item);
            }}
          />
        )}
      </section>
    </main>
  );
}
