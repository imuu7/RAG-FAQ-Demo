interface ExampleChipsProps {
  questions: string[];
  onPick: (q: string) => void;
  lead?: string;
}

/** 首屏空狀態的範例提問卡;點一下直接送出該問題,降低訪客的體驗門檻。 */
export default function ExampleChips({
  questions,
  onPick,
  lead,
}: ExampleChipsProps) {
  return (
    <section className="examples mt-[2.2rem]">
      <p className="eyebrow">範例提問</p>
      {lead && <p className="examples__lead text-ink-2 text-[0.96rem] leading-[1.7]">{lead}</p>}
      <div className="examples__grid grid grid-cols-2 gap-[0.7rem]">
        {questions.map((q, i) => (
          <button
            key={i}
            className="example-card flex items-start gap-[0.7rem] min-h-[44px] py-[0.85rem] px-4 text-left text-[0.95rem] leading-[1.5] text-ink bg-surface cursor-pointer"
            onClick={() => onPick(q)}
            type="button"
          >
            <span className="example-card__num text-[0.72rem] font-bold text-accent pt-[0.12rem]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{q}</span>
            <span className="example-card__arrow ml-auto self-center text-ink-3" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
