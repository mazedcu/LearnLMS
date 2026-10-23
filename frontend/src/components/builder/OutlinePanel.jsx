import { useState } from "react";
import { GripVertical, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Lock, Eye, FolderPlus } from "lucide-react";
import { InlineEdit, RowMenu, dropPosition } from "./shared";

/**
 * Course outline: modules → lessons.
 * Drag lessons within or between modules, drag modules to reorder.
 * Every drag action also has a menu equivalent (Move up / down / to module),
 * which works on touch screens and with the keyboard.
 */
export default function OutlinePanel({
  modules, activeLessonId, onSelectLesson,
  onReorder, onAddModule, onRenameModule, onDeleteModule,
  onAddLesson, onRenameLesson, onDeleteLesson,
}) {
  const [drag, setDrag] = useState(null);        // { kind: 'lesson'|'module', id }
  const [over, setOver] = useState(null);        // { kind, id, pos } | { kind:'module-body', id }
  const [collapsed, setCollapsed] = useState({});
  const [renaming, setRenaming] = useState(null); // module or lesson id
  const [adding, setAdding] = useState(null);     // module id getting a new lesson, or 'module'

  const structure = () => modules.map((m) => ({ id: m.id, lessons: m.lessons.map((l) => l.id) }));

  // ── Move helpers (shared by drag-and-drop and menus) ──
  const moveLesson = (lessonId, targetModuleId, targetIndex) => {
    const s = structure();
    const from = s.find((m) => m.lessons.includes(lessonId));
    const fromIndex = from.lessons.indexOf(lessonId);
    from.lessons.splice(fromIndex, 1);
    const to = s.find((m) => m.id === targetModuleId);
    let idx = targetIndex;
    if (from.id === to.id && fromIndex < targetIndex) idx -= 1;
    to.lessons.splice(Math.max(0, Math.min(idx, to.lessons.length)), 0, lessonId);
    onReorder(s);
  };
  const moveModule = (moduleId, targetIndex) => {
    const s = structure();
    const fromIndex = s.findIndex((m) => m.id === moduleId);
    const [mod] = s.splice(fromIndex, 1);
    let idx = targetIndex;
    if (fromIndex < targetIndex) idx -= 1;
    s.splice(Math.max(0, Math.min(idx, s.length)), 0, mod);
    onReorder(s);
  };

  const endDrag = () => { setDrag(null); setOver(null); };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!drag || !over) return endDrag();
    if (drag.kind === "lesson") {
      if (over.kind === "lesson" && over.id !== drag.id) {
        const mod = modules.find((m) => m.lessons.some((l) => l.id === over.id));
        const idx = mod.lessons.findIndex((l) => l.id === over.id) + (over.pos === "after" ? 1 : 0);
        moveLesson(drag.id, mod.id, idx);
      } else if (over.kind === "module-body") {
        const mod = modules.find((m) => m.id === over.id);
        moveLesson(drag.id, mod.id, mod.lessons.length);
      }
    } else if (drag.kind === "module" && over.kind === "module" && over.id !== drag.id) {
      const idx = modules.findIndex((m) => m.id === over.id) + (over.pos === "after" ? 1 : 0);
      moveModule(drag.id, idx);
    }
    endDrag();
  };

  const dragProps = (kind, id) => ({
    draggable: renaming !== id,
    onDragStart: (e) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id); // Firefox needs data to start a drag
      setDrag({ kind, id });
    },
    onDragEnd: endDrag,
  });

  const lineClass = (kind, id) =>
    over && over.kind === kind && over.id === id && drag && drag.id !== id
      ? ` cb-drop-line cb-drop-${over.pos}` : "";

  return (
    <>
      <div className="cb-outline-head">
        <h2>Course outline</h2>
      </div>
      <div className="cb-outline-scroll" onDragOver={(e) => drag && e.preventDefault()} onDrop={handleDrop}>
        {modules.length === 0 && (
          <div className="cb-module-empty" style={{ margin: "0.5rem" }}>
            Start by adding your first module (a chapter or unit).
          </div>
        )}

        {modules.map((mod, mi) => {
          const isCollapsed = collapsed[mod.id];
          const moduleTargets = modules.filter((m) => m.id !== mod.id);
          return (
            <div
              key={mod.id}
              className={`cb-module${drag?.id === mod.id ? " dragging" : ""}${over?.kind === "module-body" && over.id === mod.id ? " drop-into" : ""}`}
            >
              <div
                className={`cb-module-head${lineClass("module", mod.id)}`}
                style={{ position: "relative" }}
                {...dragProps("module", mod.id)}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault(); e.stopPropagation();
                  if (drag.kind === "module") setOver({ kind: "module", id: mod.id, pos: dropPosition(e) });
                  else setOver({ kind: "module-body", id: mod.id });
                }}
              >
                <span className="cb-handle" aria-hidden><GripVertical size={14} /></span>
                <button
                  className="cb-icon-btn" style={{ width: 22, height: 22 }}
                  aria-label={isCollapsed ? "Expand module" : "Collapse module"}
                  onClick={() => setCollapsed((c) => ({ ...c, [mod.id]: !c[mod.id] }))}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <InlineEdit
                  key={renaming === mod.id ? "edit" : "view"}
                  autoEdit={renaming === mod.id}
                  value={mod.title}
                  className="cb-module-title"
                  onSave={(t) => { setRenaming(null); onRenameModule(mod.id, t); }}
                  onCancel={() => setRenaming(null)}
                />
                <span className="cb-module-count">{mod.lessons.length}</span>
                <RowMenu
                  label="Module actions"
                  items={[
                    { label: "Add lesson", icon: Plus, onClick: () => { setCollapsed((c) => ({ ...c, [mod.id]: false })); setAdding(mod.id); } },
                    { label: "Rename", icon: Pencil, onClick: () => setRenaming(mod.id) },
                    "divider",
                    { label: "Move up", icon: ArrowUp, disabled: mi === 0, onClick: () => moveModule(mod.id, mi - 1) },
                    { label: "Move down", icon: ArrowDown, disabled: mi === modules.length - 1, onClick: () => moveModule(mod.id, mi + 2) },
                    "divider",
                    { label: "Delete module", icon: Trash2, danger: true, onClick: () => onDeleteModule(mod) },
                  ]}
                />
              </div>

              {!isCollapsed && (
                <div className="cb-module-lessons">
                  {mod.lessons.map((l, li) => (
                    <div
                      key={l.id}
                      className={`cb-lesson${l.id === activeLessonId ? " active" : ""}${!l.is_published ? " is-draft" : ""}${drag?.id === l.id ? " dragging" : ""}${lineClass("lesson", l.id)}`}
                      onClick={() => onSelectLesson(l.id)}
                      {...dragProps("lesson", l.id)}
                      onDragOver={(e) => {
                        if (drag?.kind !== "lesson") return;
                        e.preventDefault(); e.stopPropagation();
                        setOver({ kind: "lesson", id: l.id, pos: dropPosition(e) });
                      }}
                    >
                      <span className="cb-handle" aria-hidden><GripVertical size={14} /></span>
                      <div className="cb-lesson-body">
                        {renaming === l.id ? (
                          <InlineEdit autoEdit value={l.title}
                            onSave={(t) => { setRenaming(null); onRenameLesson(l.id, t); }}
                            onCancel={() => setRenaming(null)} />
                        ) : (
                          <div className="cb-lesson-title">{l.title}</div>
                        )}
                        <div className="cb-lesson-meta">
                          {!l.is_published && <span className="cb-tag cb-tag-draft">Draft</span>}
                          {l.is_preview && <span className="cb-tag cb-tag-preview"><Eye size={10} /> Preview</span>}
                          {l.drip_rule && <span className="cb-tag cb-tag-lock"><Lock size={10} /> Locked</span>}
                          <span>
                            {l.block_count === 0 ? "Empty" : `${l.block_count} item${l.block_count === 1 ? "" : "s"}`}
                            {l.quiz_count > 0 && ` · ${l.quiz_count} quiz${l.quiz_count === 1 ? "" : "zes"}`}
                          </span>
                        </div>
                      </div>
                      <RowMenu
                        label="Lesson actions"
                        items={[
                          { label: "Rename", icon: Pencil, onClick: () => setRenaming(l.id) },
                          "divider",
                          { label: "Move up", icon: ArrowUp, disabled: li === 0, onClick: () => moveLesson(l.id, mod.id, li - 1) },
                          { label: "Move down", icon: ArrowDown, disabled: li === mod.lessons.length - 1, onClick: () => moveLesson(l.id, mod.id, li + 2) },
                          ...moduleTargets.map((t) => ({
                            label: `Move to "${t.title}"`, icon: ArrowDown,
                            onClick: () => moveLesson(l.id, t.id, t.lessons.length),
                          })),
                          "divider",
                          { label: "Delete lesson", icon: Trash2, danger: true, onClick: () => onDeleteLesson(l) },
                        ]}
                      />
                    </div>
                  ))}

                  {mod.lessons.length === 0 && adding !== mod.id && (
                    <div className="cb-module-empty">No lessons yet — drop one here or add below.</div>
                  )}

                  {adding === mod.id ? (
                    <div style={{ padding: "0.25rem 0.25rem 0.25rem 0.5rem" }}>
                      <InlineEdit autoEdit value="" placeholder="Lesson title, then Enter"
                        onSave={(t) => { setAdding(null); onAddLesson(mod.id, t); }}
                        onCancel={() => setAdding(null)} />
                    </div>
                  ) : (
                    <button className="cb-add-lesson" onClick={() => setAdding(mod.id)}>
                      <Plus size={14} /> Add lesson
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {adding === "module" && (
          <div style={{ padding: "0.25rem" }}>
            <InlineEdit autoEdit value="" placeholder="Module title, then Enter"
              onSave={(t) => { setAdding(null); onAddModule(t); }}
              onCancel={() => setAdding(null)} />
          </div>
        )}
      </div>
      <div className="cb-outline-foot">
        <button className="cb-btn" onClick={() => setAdding("module")}>
          <FolderPlus size={15} /> Add module
        </button>
      </div>
    </>
  );
}
