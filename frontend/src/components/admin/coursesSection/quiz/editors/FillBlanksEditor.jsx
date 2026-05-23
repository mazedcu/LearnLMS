import { Plus, X } from "lucide-react";

export default function FillBlanksEditor({ blanks, onChange }) {
  const add = () =>
    onChange([...blanks, { key: `blank${blanks.length + 1}`, answer: "" }]);
  const remove = (i) => onChange(blanks.filter((_, j) => j !== i));
  const update = (i, field, val) =>
    onChange(blanks.map((b, j) => (j === i ? { ...b, [field]: val } : b)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <p className="text-muted" style={{ fontSize: "0.75rem", margin: 0 }}>
        Use <code>{"{{blank1}}"}</code>, <code>{"{{blank2}}"}</code> etc. in the prompt.
        Define each blank's answer below:
      </p>
      {blanks.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, minWidth: 60, color: "var(--clr-primary)" }}>
            {`{{${b.key}}}`}
          </span>
          <input
            className="form-control"
            style={{ fontSize: "0.8rem", flex: 1 }}
            placeholder="Correct answer"
            value={b.answer}
            onChange={(e) => update(i, "answer", e.target.value)}
          />
          <button
            className="btn btn-danger btn-sm"
            style={{ padding: "0.15rem 0.4rem" }}
            onClick={() => remove(i)}
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <button className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }} onClick={add}>
        <Plus size={12} /> Add Blank
      </button>
    </div>
  );
}
