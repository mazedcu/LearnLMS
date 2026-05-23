import { Plus, X } from "lucide-react";

export default function CalculatedMcqEditor({ calcData, onChange }) {
  const vars = calcData.variables || {};
  const varList = Object.entries(vars).map(([name, cfg]) => ({ name, ...cfg }));
  const distractors = calcData.distractors || [""];

  const addVar = () => {
    const nm = `v${varList.length + 1}`;
    onChange({ ...calcData, variables: { ...vars, [nm]: { min: 0, max: 10, decimals: 0 } } });
  };

  const removeVar = (name) => {
    const nv = { ...vars };
    delete nv[name];
    onChange({ ...calcData, variables: nv });
  };

  const updateVar = (oldName, field, val) => {
    if (field === "name") {
      const cfg = vars[oldName];
      const nv = { ...vars };
      delete nv[oldName];
      nv[val] = { min: cfg.min, max: cfg.max, decimals: cfg.decimals };
      onChange({ ...calcData, variables: nv });
    } else {
      onChange({ ...calcData, variables: { ...vars, [oldName]: { ...vars[oldName], [field]: val } } });
    }
  };

  const setDistractors = (d) => onChange({ ...calcData, distractors: d });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p className="text-muted" style={{ fontSize: "0.75rem", margin: 0 }}>
        Define variables, a formula for the correct answer, and distractor formulas.
        Variables are randomized per attempt.
      </p>

      <div style={{ background: "rgba(108,99,255,0.05)", padding: "0.5rem", borderRadius: "4px" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, marginBottom: "0.375rem" }}>Variables</p>
        {varList.map((v) => (
          <div key={v.name} style={{ display: "flex", gap: "0.375rem", alignItems: "center", marginBottom: "0.375rem" }}>
            <input className="form-control" style={{ fontSize: "0.75rem", width: 60 }} value={v.name} onChange={(e) => updateVar(v.name, "name", e.target.value)} placeholder="name" />
            <input className="form-control" style={{ fontSize: "0.75rem", width: 60 }} type="number" value={v.min ?? 0} onChange={(e) => updateVar(v.name, "min", Number(e.target.value))} placeholder="Min" title="Min" />
            <input className="form-control" style={{ fontSize: "0.75rem", width: 60 }} type="number" value={v.max ?? 10} onChange={(e) => updateVar(v.name, "max", Number(e.target.value))} placeholder="Max" title="Max" />
            <input className="form-control" style={{ fontSize: "0.75rem", width: 50 }} type="number" min={0} max={6} value={v.decimals ?? 0} onChange={(e) => updateVar(v.name, "decimals", Number(e.target.value))} placeholder="Dec" title="Decimals" />
            <button className="btn btn-danger btn-sm" style={{ padding: "0.1rem 0.3rem" }} onClick={() => removeVar(v.name)}>
              <X size={10} />
            </button>
          </div>
        ))}
        <button className="btn btn-outline btn-sm" style={{ fontSize: "0.7rem" }} onClick={addVar}>
          <Plus size={11} /> Variable
        </button>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: "0.7rem" }}>Correct Answer Formula</label>
        <input
          className="form-control"
          style={{ fontSize: "0.8rem", fontFamily: "monospace" }}
          placeholder="a * b + 5"
          value={calcData.formula || ""}
          onChange={(e) => onChange({ ...calcData, formula: e.target.value })}
        />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: "0.7rem" }}>Tolerance</label>
        <input
          className="form-control"
          style={{ fontSize: "0.8rem", width: 100 }}
          type="number"
          step="0.01"
          value={calcData.tolerance ?? 0.01}
          onChange={(e) => onChange({ ...calcData, tolerance: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, marginBottom: "0.375rem" }}>
          Distractor Formulas (wrong answer options)
        </p>
        {distractors.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: "0.375rem", alignItems: "center", marginBottom: "0.375rem" }}>
            <input
              className="form-control"
              style={{ fontSize: "0.75rem", flex: 1, fontFamily: "monospace" }}
              placeholder="a + b"
              value={d}
              onChange={(e) => {
                const n = [...distractors];
                n[i] = e.target.value;
                setDistractors(n);
              }}
            />
            {distractors.length > 1 && (
              <button
                className="btn btn-danger btn-sm"
                style={{ padding: "0.1rem 0.3rem" }}
                onClick={() => setDistractors(distractors.filter((_, j) => j !== i))}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        <button
          className="btn btn-outline btn-sm"
          style={{ fontSize: "0.7rem" }}
          onClick={() => setDistractors([...distractors, ""])}
        >
          <Plus size={11} /> Distractor
        </button>
      </div>
    </div>
  );
}
