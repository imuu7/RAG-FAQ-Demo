interface SkeletonListProps {
  count?: number;
}

/** 檢索結果回來前的載入骨架,讓等待期間版面不空白。 */
export default function SkeletonList({ count = 3 }: SkeletonListProps) {
  return (
    <div className="sources__list list-none m-0 p-0 flex flex-col gap-[0.85rem]" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card py-4 px-[1.1rem] bg-surface border border-line rounded-[var(--radius)]">
          <div className="skeleton-line skeleton-line--tag" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--short" />
        </div>
      ))}
    </div>
  );
}
