import { useCallback, useEffect, useState } from "react";

export type MyListItem = {
  id: number;
  mediaType: "movie" | "tv";
  isAnime?: boolean;
  title: string;
  posterPath: string | null;
  year?: string;
  rating?: number;
  addedAt: string;
};

const STORAGE_KEY = "myList:items";
const CHANGE_EVENT = "mylist-change";

const itemKey = (item: Pick<MyListItem, "id" | "mediaType">) => `${item.mediaType}:${item.id}`;

function readMyList(): MyListItem[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeMyList(items: MyListItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {}
}

// Keeps every component that shows My List state in sync, including across tabs.
export function useMyList() {
  const [items, setItems] = useState<MyListItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(readMyList());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync();
    };

    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const isInList = useCallback(
    (ref: Pick<MyListItem, "id" | "mediaType">) =>
      items.some((item) => itemKey(item) === itemKey(ref)),
    [items]
  );

  const remove = useCallback((ref: Pick<MyListItem, "id" | "mediaType">) => {
    writeMyList(readMyList().filter((item) => itemKey(item) !== itemKey(ref)));
  }, []);

  const toggle = useCallback((entry: Omit<MyListItem, "addedAt">) => {
    const current = readMyList();
    const exists = current.some((item) => itemKey(item) === itemKey(entry));
    writeMyList(
      exists
        ? current.filter((item) => itemKey(item) !== itemKey(entry))
        : [{ ...entry, addedAt: new Date().toISOString() }, ...current]
    );
  }, []);

  return { items, isInList, toggle, remove };
}
