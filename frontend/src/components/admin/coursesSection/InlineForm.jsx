import { useState } from "react";
import { Save, X } from "lucide-react";

/**
 * Compact inline form for quick edits (e.g. lesson/module title).
 * fields: [{ name, label, type?, default?, placeholder?, flex?, options? }]
 */
export default function InlineForm({ fields, onSave, onCancel, saving }) {
  const [vals, setVals] = useState(() =>
    Object.fromEntries(fields.map(f => [f.name, f.default ?? ""]))
  );

  const update = (name, value) => setVals(v => ({ ...v, [name]: value }));

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", padding: "0.75rem", background: "rgba(108,99,255,0.06)", borderRadius: "var(--radius-sm)", marginBottom: "0.5rem" }}>
      {fields.map(f => (
        <div key={f.name} className="form-group" style={{ margin: 0, flex: f.flex || "1 1 160px" }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>{f.label}</label>
          {f.type === "select" ? (
            <select className="form-control" style={{ fontSize: "0.8rem" }} value={vals[f.name]} onChange={e => update(f.name, e.target.value)}>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              className="form-control"
              style={{ fontSize: "0.8rem" }}
              type={f.type || "text"}
              placeholder={f.placeholder || f.label}
              value={vals[f.name]}
              onChange={e => update(f.name, e.target.value)}
            />
          )}
        </div>
      ))}
      <button className="btn btn-primary btn-sm" onClick={() => onSave(vals)} disabled={saving} title="Save">
        <Save size={13} />
      </button>
      <button className="btn btn-outline btn-sm" onClick={onCancel} title="Cancel">
        <X size={13} />
      </button>
    </div>
  );
}
