import React from "react";
import {
  Sparkles, Plus, Trash2, ArrowUp, ArrowDown, Eye, Pencil,
  Undo2, Redo2, Smartphone, Monitor,
} from "lucide-react";
import { TYPES, DEVICE, FOOTER } from "../constants.js";
import Wire from "../components/Wire.jsx";
import Empty from "../components/Empty.jsx";

/**
 * Step 3 — generate and edit a low-fidelity click-through prototype.
 */
export default function PrototypeView({
  hasAnswers,
  screens,
  activeScreen,
  setActiveScreen,
  selected,
  setSelected,
  previewMode,
  setPreviewMode,
  device,
  setDevice,
  refine,
  setRefine,
  canEdit,
  busy,
  generatePrototype,
  refineScreen,
  addScreen,
  delScreen,
  updScreen,
  updComp,
  moveComp,
  delComp,
  addComp,
  undo,
  redo,
  canUndo,
  canRedo,
  navTo,
  setStep,
}) {
  if (!hasAnswers) {
    return (
      <Empty
        title="Parse a PRD first"
        body="The prototype is generated from the template answers."
        action="Go to Import"
        onClick={() => setStep("import")}
      />
    );
  }
  if (screens.length === 0) {
    return (
      <Empty
        title="Generate a prototype"
        body="The AI proposes the key screens for your product and wireframes each one, with navigation between them. You can edit everything afterwards."
        action="Generate prototype"
        onClick={generatePrototype}
        disabled={!!busy || !canEdit}
        icon={<Sparkles size={15} />}
      />
    );
  }

  const si = Math.min(activeScreen, Math.max(0, screens.length - 1));
  const screen = screens[si];
  const selComp = screen?.components.find((c) => c.id === selected);

  return (
    <section>
      <div className="row between wrap gap ps-toolbar">
        <div className="tabs" role="tablist">
          {screens.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === si}
              className={i === si ? "on" : ""}
              onClick={() => { setActiveScreen(i); setSelected(null); }}
            >
              {s.name}
            </button>
          ))}
          {canEdit && (
            <button className="add" onClick={addScreen} aria-label="Add screen">
              <Plus size={14} />
            </button>
          )}
        </div>
        <div className="row gap wrap">
          {canEdit && (
            <>
              <button className="ps-btn" onClick={undo} disabled={!canUndo} aria-label="Undo">
                <Undo2 size={14} />
              </button>
              <button className="ps-btn" onClick={redo} disabled={!canRedo} aria-label="Redo">
                <Redo2 size={14} />
              </button>
            </>
          )}
          <div className="seg" role="group" aria-label="Device">
            <button
              className={device === DEVICE.DESKTOP ? "on" : ""}
              onClick={() => setDevice(DEVICE.DESKTOP)}
              aria-label="Desktop"
            >
              <Monitor size={13} />
            </button>
            <button
              className={device === DEVICE.MOBILE ? "on" : ""}
              onClick={() => setDevice(DEVICE.MOBILE)}
              aria-label="Mobile"
            >
              <Smartphone size={13} />
            </button>
          </div>
          <div className="seg" role="group" aria-label="Mode">
            <button className={!previewMode ? "on" : ""} onClick={() => setPreviewMode(false)}>
              <Pencil size={12} /> Edit
            </button>
            <button
              className={previewMode ? "on" : ""}
              onClick={() => { setPreviewMode(true); setSelected(null); }}
            >
              <Eye size={12} /> Preview
            </button>
          </div>
          <button className="ps-btn" disabled={!!busy || !canEdit} onClick={generatePrototype}>
            Regenerate all
          </button>
          <button className="ps-btn primary" onClick={() => setStep("jira")}>
            Continue to Jira
          </button>
        </div>
      </div>

      {previewMode && (
        <p className="hint">Preview mode: buttons that link to another screen are clickable.</p>
      )}

      <div className={"ps-proto" + (previewMode ? " solo" : "")}>
        <div className={"ps-frame " + device}>
          <div className="ps-frame-bar">
            <i /><i /><i />
            <span>{screen.name}</span>
          </div>
          <div className="ps-frame-body">
            {screen.components.length === 0 && (
              <p className="hint">
                This screen is empty. Add a component, or describe it under "Refine with AI".
              </p>
            )}
            {screen.components.map((c) => (
              <div
                key={c.id}
                className={"w-wrap" + (!previewMode ? " editable" : "") +
                  (selected === c.id && !previewMode ? " sel" : "")}
                onClick={() => !previewMode && setSelected(c.id)}
                tabIndex={previewMode ? -1 : 0}
                onKeyDown={(e) => {
                  if (!previewMode && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                    e.preventDefault();
                    setSelected(c.id);
                  }
                }}
              >
                <Wire c={c} preview={previewMode} onNav={navTo} />
              </div>
            ))}
          </div>
        </div>

        {!previewMode && (
          <aside className="ps-insp">
            <h2>Screen</h2>
            <label className="ps-lab">
              Name
              <input
                readOnly={!canEdit}
                value={screen.name}
                onChange={(e) => updScreen({ name: e.target.value })}
              />
            </label>
            <label className="ps-lab">
              Purpose
              <textarea
                readOnly={!canEdit}
                rows={2}
                value={screen.purpose}
                onChange={(e) => updScreen({ purpose: e.target.value })}
              />
            </label>
            {canEdit && (
              <>
                <label className="ps-lab">
                  Refine with AI
                  <textarea
                    rows={2}
                    value={refine}
                    onChange={(e) => setRefine(e.target.value)}
                    placeholder="e.g. add a confidence score and a reject-with-reason option"
                  />
                </label>
                <div className="row gap wrap">
                  <button
                    className="ps-btn"
                    disabled={!!busy || !refine.trim()}
                    onClick={refineScreen}
                  >
                    <Sparkles size={13} /> Apply
                  </button>
                  <label className="ps-lab grow" style={{ margin: 0 }}>
                    <span className="ps-sr">Add component</span>
                    <select
                      value=""
                      onChange={(e) => e.target.value && addComp(e.target.value)}
                    >
                      <option value="">Add component…</option>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace("_", " ")}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="ps-btn danger"
                    onClick={delScreen}
                    disabled={screens.length < 2}
                  >
                    <Trash2 size={13} /> Delete screen
                  </button>
                </div>
              </>
            )}
            <hr />
            {selComp ? (
              <>
                <h2>Component</h2>
                <label className="ps-lab">
                  Type
                  <select
                    disabled={!canEdit}
                    value={selComp.type}
                    onChange={(e) => updComp(selComp.id, { type: e.target.value })}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <label className="ps-lab">
                  Label
                  <input
                    readOnly={!canEdit}
                    value={selComp.label}
                    onChange={(e) => updComp(selComp.id, { label: e.target.value })}
                  />
                </label>
                <label className="ps-lab">
                  Value
                  <textarea
                    readOnly={!canEdit}
                    rows={2}
                    value={selComp.value}
                    onChange={(e) => updComp(selComp.id, { value: e.target.value })}
                  />
                </label>
                <label className="ps-lab">
                  Items (one per line)
                  <textarea
                    readOnly={!canEdit}
                    rows={3}
                    value={(selComp.items || []).join("\n")}
                    onChange={(e) => updComp(selComp.id, { items: e.target.value.split("\n") })}
                  />
                </label>
                {selComp.type === "button" && (
                  <label className="ps-lab">
                    Navigates to
                    <select
                      disabled={!canEdit}
                      value={selComp.goto || ""}
                      onChange={(e) => updComp(selComp.id, { goto: e.target.value })}
                    >
                      <option value="">Nowhere</option>
                      {screens.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {canEdit && (
                  <div className="row gap">
                    <button className="ps-btn" onClick={() => moveComp(selComp.id, -1)} aria-label="Move up">
                      <ArrowUp size={13} />
                    </button>
                    <button className="ps-btn" onClick={() => moveComp(selComp.id, 1)} aria-label="Move down">
                      <ArrowDown size={13} />
                    </button>
                    <button className="ps-btn danger" onClick={() => delComp(selComp.id)}>
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="hint">Select a component on the canvas to edit it.</p>
            )}
            {!canEdit && (
              <p className="hint">You have view-only access. Switch to Editor or Owner to make changes.</p>
            )}
          </aside>
        )}
      </div>
      <p className="ps-foot">{FOOTER}</p>
    </section>
  );
}
