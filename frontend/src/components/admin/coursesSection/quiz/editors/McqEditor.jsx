import { Plus, X } from "lucide-react";

export default function McqEditor({ options, correctIndex, onChange }) {
  const add = () => onChange([...options, ""], correctIndex);
  const remove = (i) => {
    const next = options.filter((_, j) => j !== i);
    const ci = i === correctIndex ? -1 : i < correctIndex ? correctIndex - 1 : correctIndex;
    onChange(next, ci);
  };
  const update = (i, val) =>
    onChange(options.map((o, j) => (j === i ? val : o)), correctIndex);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <p className="text-muted" style={{ fontSize: "0.75rem", margin: 0 }}>
        Click the radio to mark the correct answer:
      </p>
      {options.map((opt, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="radio"
            name="mcq-correct"
            checked={correctIndex === i}
            onChange={() => onChange(options, i)}
            title="Mark as correct"
          />
          <input
            className="form-control"
            style={{ fontSize: "0.8rem", flex: 1 }}
            placeholder={`Option ${i + 1}`}
            value={opt}
            onChange={(e) => update(i, e.target.value)}
          />
          {options.length > 1 && (
            <button
              className="btn btn-danger btn-sm"
              style={{ padding: "0.15rem 0.4rem" }}
              onClick={() => remove(i)}
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={add}>
        <Plus size={12} /> Add Option
      </button>
    </div>
  );
}
