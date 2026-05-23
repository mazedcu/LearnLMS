import { useMemo } from "react";
import { Plus, X } from "lucide-react";

export default function KeywordMatchEditor({ keywords, maxMarks, onChange }) {
  const add = () =>
    onChange([...keywords, { keyword: "", weight: 0, case_sensitive: false }]);
  const remove = (i) => onChange(keywords.filter((_, j) => j !== i));
  const update = (i, field, val) =>
    onChange(keywords.map((k, j) => (j === i ? { ...k, [field]: val } : k)));

  const { totalWeight, balanced } = useMemo(() => {
    const t = keywords.reduce((s, k) => s + (parseFloat(k.weight) || 0), 0);
    return { totalWeight: t, balanced: Math.abs(t - maxMarks) < 0.01 };
  }, [keywords, maxMarks]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <p className="text-muted" style={{ fontSize: "0.75rem", margin: 0 }}>
        Student's answer is checked for these keywords. Weights must total{" "}
        <strong>{maxMarks}</strong> marks.
      </p>
      {keywords.map((kw, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            className="form-control"
            style={{ fontSize: "0.8rem", flex: 1 }}
            placeholder="Keyword"
            value={kw.keyword}
            onChange={(e) => update(i, "keyword", e.target.value)}
          />
          <input
            className="form-control"
            style={{ fontSize: "0.8rem", width: 70 }}
            type="number"
            step="0.5"
            min="0"
            placeholder="Wt"
            value={kw.weight}
            onChange={(e) => update(i, "weight", parseFloat(e.target.value) || 0)}
            title="Weight"
          />
          <label style={{ fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={kw.case_sensitive || false}
              onChange={(e) => update(i, "case_sensitive", e.target.checked)}
            />{" "}
            Aa
          </label>
          <button
            className="btn btn-danger btn-sm"
            style={{ padding: "0.15rem 0.4rem" }}
            onClick={() => remove(i)}
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn btn-outline btn-sm" onClick={add}>
          <Plus size={12} /> Add Keyword
        </button>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: balanced ? "var(--clr-success)" : "var(--clr-danger)" }}>
          Total: {totalWeight} / {maxMarks} {balanced ? "✓" : "⚠ Must equal marks"}
        </span>
      </div>
    </div>
  );
}
