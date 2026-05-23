import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function DragDropWordEditor({ ddw, onChange }) {
  // Local raw text preserves commas while typing (controlled list parsing would
  // strip them mid-edit).
  const [wordsText, setWordsText] = useState((ddw.draggable_words || []).join(", "));

  const mappings = ddw.mappings || {};
  const mapList = Object.entries(mappings).map(([slot, word]) => ({ slot, word }));

  const handleWordsChange = (text) => {
    setWordsText(text);
    const parsed = text.split(",").map((w) => w.trim()).filter(Boolean);
    onChange({ ...ddw, draggable_words: parsed });
  };

  const setMappings = (list) =>
    onChange({ ...ddw, mappings: Object.fromEntries(list.map((m) => [m.slot, m.word])) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <p className="text-muted" style={{ fontSize: "0.75rem", margin: 0 }}>
        Use <code>{"[slot1]"}</code>, <code>{"[slot2]"}</code> in the prompt. Define
        draggable words and correct slot→word mappings.
      </p>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: "0.7rem" }}>
          Draggable Words (comma-separated)
        </label>
        <input
          className="form-control"
          style={{ fontSize: "0.8rem" }}
          placeholder="word1, word2, word3..."
          value={wordsText}
          onChange={(e) => handleWordsChange(e.target.value)}
        />
      </div>

      <div>
        <p style={{ fontSize: "0.7rem", fontWeight: 700, marginBottom: "0.375rem" }}>
          Correct Mappings (slot → word)
        </p>
        {mapList.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: "0.375rem", alignItems: "center", marginBottom: "0.375rem" }}>
            <input
              className="form-control"
              style={{ fontSize: "0.75rem", width: 90 }}
              placeholder="slot1"
              value={m.slot}
              onChange={(e) => {
                const n = [...mapList];
                n[i] = { ...n[i], slot: e.target.value };
                setMappings(n);
              }}
            />
            <span style={{ fontSize: "0.7rem" }}>→</span>
            <input
              className="form-control"
              style={{ fontSize: "0.75rem", flex: 1 }}
              placeholder="word"
              value={m.word}
              onChange={(e) => {
                const n = [...mapList];
                n[i] = { ...n[i], word: e.target.value };
                setMappings(n);
              }}
            />
            <button
              className="btn btn-danger btn-sm"
              style={{ padding: "0.1rem 0.3rem" }}
              onClick={() => setMappings(mapList.filter((_, j) => j !== i))}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-outline btn-sm"
          style={{ fontSize: "0.7rem" }}
          onClick={() => setMappings([...mapList, { slot: `slot${mapList.length + 1}`, word: "" }])}
        >
          <Plus size={11} /> Mapping
        </button>
      </div>
    </div>
  );
}
