import { Plus, X } from "lucide-react";

export default function DragDropImageEditor({ ddi, onChange }) {
  const zones = ddi.zones || [];
  const items = ddi.items || [];

  const addZone = () =>
    onChange({
      ...ddi,
      zones: [...zones, { id: `z${zones.length + 1}`, label: "", x: 0, y: 0, width: 80, height: 60 }],
    });
  const removeZone = (i) => onChange({ ...ddi, zones: zones.filter((_, j) => j !== i) });
  const updateZone = (i, f, v) =>
    onChange({ ...ddi, zones: zones.map((z, j) => (j === i ? { ...z, [f]: v } : z)) });

  const addItem = () =>
    onChange({
      ...ddi,
      items: [...items, { id: `i${items.length + 1}`, label: "", image_url: "", correct_zone: "" }],
    });
  const removeItem = (i) => onChange({ ...ddi, items: items.filter((_, j) => j !== i) });
  const updateItem = (i, f, v) =>
    onChange({ ...ddi, items: items.map((it, j) => (j === i ? { ...it, [f]: v } : it)) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p className="text-muted" style={{ fontSize: "0.75rem", margin: 0 }}>
        Define a background image, drop zones on the canvas, and draggable items with
        their correct zones.
      </p>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: "0.7rem" }}>Background Image URL</label>
        <input
          className="form-control"
          style={{ fontSize: "0.8rem" }}
          placeholder="https://example.com/diagram.png"
          value={ddi.background_url || ""}
          onChange={(e) => onChange({ ...ddi, background_url: e.target.value })}
        />
      </div>

      {ddi.background_url && (
        <div style={{ position: "relative", border: "1px solid var(--clr-border)", borderRadius: "4px", overflow: "hidden", maxHeight: 200 }}>
          <img
            src={ddi.background_url}
            alt="bg"
            style={{ width: "100%", display: "block", maxHeight: 200, objectFit: "contain" }}
            onError={(e) => (e.target.style.display = "none")}
          />
        </div>
      )}

      <div style={{ background: "rgba(0,212,170,0.06)", padding: "0.5rem", borderRadius: "4px" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, marginBottom: "0.375rem" }}>
          Drop Zones (areas on the canvas)
        </p>
        {zones.map((z, i) => (
          <div key={i} style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginBottom: "0.375rem", flexWrap: "wrap" }}>
            <input className="form-control" style={{ fontSize: "0.7rem", width: 50 }} value={z.id} onChange={(e) => updateZone(i, "id", e.target.value)} placeholder="ID" title="Zone ID" />
            <input className="form-control" style={{ fontSize: "0.7rem", flex: 1 }} value={z.label} onChange={(e) => updateZone(i, "label", e.target.value)} placeholder="Label" />
            <input className="form-control" style={{ fontSize: "0.7rem", width: 45 }} type="number" value={z.x} onChange={(e) => updateZone(i, "x", Number(e.target.value))} title="X" placeholder="X" />
            <input className="form-control" style={{ fontSize: "0.7rem", width: 45 }} type="number" value={z.y} onChange={(e) => updateZone(i, "y", Number(e.target.value))} title="Y" placeholder="Y" />
            <input className="form-control" style={{ fontSize: "0.7rem", width: 45 }} type="number" value={z.width} onChange={(e) => updateZone(i, "width", Number(e.target.value))} title="W" placeholder="W" />
            <input className="form-control" style={{ fontSize: "0.7rem", width: 45 }} type="number" value={z.height} onChange={(e) => updateZone(i, "height", Number(e.target.value))} title="H" placeholder="H" />
            <button className="btn btn-danger btn-sm" style={{ padding: "0.1rem 0.3rem" }} onClick={() => removeZone(i)}>
              <X size={10} />
            </button>
          </div>
        ))}
        <button className="btn btn-outline btn-sm" style={{ fontSize: "0.7rem" }} onClick={addZone}>
          <Plus size={11} /> Zone
        </button>
      </div>

      <div style={{ background: "rgba(108,99,255,0.06)", padding: "0.5rem", borderRadius: "4px" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, marginBottom: "0.375rem" }}>
          Draggable Items
        </p>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginBottom: "0.375rem", flexWrap: "wrap" }}>
            <input className="form-control" style={{ fontSize: "0.7rem", width: 50 }} value={it.id} onChange={(e) => updateItem(i, "id", e.target.value)} placeholder="ID" title="Item ID" />
            <input className="form-control" style={{ fontSize: "0.7rem", flex: 1 }} value={it.label} onChange={(e) => updateItem(i, "label", e.target.value)} placeholder="Label (e.g. Left Ventricle)" />
            <input className="form-control" style={{ fontSize: "0.7rem", flex: 1 }} value={it.image_url || ""} onChange={(e) => updateItem(i, "image_url", e.target.value)} placeholder="Image URL (optional)" />
            <select className="form-control" style={{ fontSize: "0.7rem", width: 80 }} value={it.correct_zone} onChange={(e) => updateItem(i, "correct_zone", e.target.value)}>
              <option value="">Zone...</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.id} - {z.label}</option>
              ))}
            </select>
            <button className="btn btn-danger btn-sm" style={{ padding: "0.1rem 0.3rem" }} onClick={() => removeItem(i)}>
              <X size={10} />
            </button>
          </div>
        ))}
        <button className="btn btn-outline btn-sm" style={{ fontSize: "0.7rem" }} onClick={addItem}>
          <Plus size={11} /> Item
        </button>
      </div>
    </div>
  );
}
