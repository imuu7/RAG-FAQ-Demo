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
    <section className="examples">
      <p className="eyebrow">範例提問</p>
      {lead && <p className="examples__lead">{lead}</p>}
      <div className="examples__grid">
        {questions.map((q, i) => (
          <button
            key={i}
            className="example-card"
            onClick={() => onPick(q)}
            type="button"
          >
            <span className="example-card__num">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{q}</span>
            <span className="example-card__arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
