import React from "react";
import {
  Sparkles, Check, AlertTriangle, ShieldCheck, History, FileText, X,
} from "lucide-react";
import { HEADER_FIELDS, SECTIONS, FIELDS, FILTER, FOOTER, ANSWER_STATE } from "../constants.js";
import { toMarkdown, answerState } from "../utils.js";

const PILL_OF = { filled: "ok", partial: "warn", missing: "bad", ai: "ai" };

/**
 * Step 2 — review and edit the parsed PRD.
 */
export default function ReviewView({
  header,
  setHeader,
  answers,
  setAnswer,
  acceptAI,
  acceptAllAI,
  fillGaps,
  improveField,
  runReview,
  saveVersion,
  restoreVersion,
  versions,
  findings,
  setFindings,
  filter,
  setFilter,
  includesAI,
  canEdit,
  busy,
  counts,
  readiness,
  setStep,
  setExportData,
}) {
  return (
    <section>
      <div className="ps-sheet-head">PRODUCT REQUIREMENTS DOCUMENT</div>
      <div className="ps-hdrgrid">
        {HEADER_FIELDS.map(([k, label]) => (
          <label key={k} className="ps-hrow">
            <span>{label}</span>
            <input
              readOnly={!canEdit}
              value={header[k] || ""}
              placeholder={`[${label}]`}
              onChange={(e) => setHeader({ ...header, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <div className="ps-ready">
        <div className="row between wrap gap">
          <strong>Readiness {readiness}%</strong>
          <span className="hint" style={{ margin: 0 }}>
            {counts.filled || 0} from your PRD or confirmed · {counts.ai || 0} AI suggested · {counts.partial || 0} partial · {counts.missing || 0} missing
          </span>
        </div>
        <div className="stack" aria-hidden="true">
          <i className="s-ok" style={{ flex: counts.filled || 0 }} />
          <i className="s-ai" style={{ flex: counts.ai || 0 }} />
          <i className="s-warn" style={{ flex: counts.partial || 0 }} />
          <i className="s-bad" style={{ flex: counts.missing || 0 }} />
        </div>
      </div>

      <div className="row between wrap gap ps-toolbar">
        <div className="seg" role="group" aria-label="Filter">
          {[[FILTER.ALL, "All"], [FILTER.GAPS, "Needs attention"], [FILTER.AI, "AI suggested"]].map(
            ([k, l]) => (
              <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
                {l}
              </button>
            )
          )}
        </div>
        <div className="row gap wrap">
          {canEdit && (counts.missing || 0) > 0 && (
            <button className="ps-btn" disabled={!!busy} onClick={fillGaps}>
              <Sparkles size={14} /> Fill gaps with AI
            </button>
          )}
          {canEdit && (counts.ai || 0) > 0 && (
            <button className="ps-btn" onClick={acceptAllAI}>
              <Check size={14} /> Accept all AI suggestions
            </button>
          )}
          <button className="ps-btn" disabled={!!busy} onClick={runReview}>
            <ShieldCheck size={14} /> Review PRD
          </button>
          <button className="ps-btn" onClick={saveVersion}>
            <History size={14} /> Save version
          </button>
          {versions.length > 0 && (
            <select
              aria-label="Restore a saved version"
              value=""
              onChange={(e) => e.target.value && restoreVersion(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="">Restore…</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{v.label} ({v.ts})</option>
              ))}
            </select>
          )}
          <button
            className="ps-btn"
            onClick={() => setExportData({
              title: "PRD export (Markdown)",
              text: toMarkdown(header, answers, includesAI),
              filename: "prd.md",
              mime: "text/markdown",
            })}
          >
            <FileText size={14} /> Export
          </button>
          <button className="ps-btn primary" onClick={() => setStep("proto")}>
            Continue to prototype
          </button>
        </div>
      </div>

      {findings && (
        <div className="ps-find">
          <div className="row between">
            <strong>PRD review: {findings.score}/100</strong>
            <button className="ps-icon" onClick={() => setFindings(null)} aria-label="Close review">
              <X size={14} />
            </button>
          </div>
          <p className="hint" style={{ marginTop: 2 }}>{findings.summary}</p>
          {findings.items.length === 0 && <p className="hint">No issues found.</p>}
          {findings.items.map((f, i) => {
            const fd = FIELDS.find((x) => x.id === f.field);
            return (
              <div className="find" key={i}>
                <span className={"pill " + (f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : "ok")}>
                  {f.severity}
                </span>
                <div className="grow">
                  <b>{fd?.topic}.</b> {f.issue} <span className="hint">Fix: {f.fix}</span>
                </div>
                {canEdit && (
                  <button
                    className="ps-link"
                    disabled={!!busy}
                    onClick={() => improveField(f.field, f.issue + f.fix)}
                  >
                    <Sparkles size={12} /> Fix with AI
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="ps-grid head">
        <div>Topic</div><div>Key question</div><div>Your response</div>
      </div>
      {SECTIONS.map((sec) => {
        if (sec.aiOnly && !includesAI) return null;
        const rows = sec.fields.filter(([id]) => {
          const k = answerState(answers[id]);
          return filter === FILTER.ALL || (filter === FILTER.GAPS ? k !== ANSWER_STATE.FILLED : k === ANSWER_STATE.AI);
        });
        if (!rows.length) return null;
        return (
          <div key={sec.id}>
            <div className="ps-band">
              <b>{sec.name}</b>
              {sec.hint && <span>{sec.hint}</span>}
            </div>
            {rows.map(([id, topic, q]) => {
              const ans = answers[id] || {};
              const k = answerState(ans);
              return (
                <div className={"ps-grid row" + (k === ANSWER_STATE.AI ? " is-ai" : "")} key={id}>
                  <div className="c topic">{topic}</div>
                  <div className="c q">{q}</div>
                  <div className="c resp">
                    <textarea
                      readOnly={!canEdit}
                      rows={Math.max(3, Math.min(10, Math.ceil((ans.text || "").length / 48)))}
                      value={ans.text || ""}
                      placeholder="[Insert your response here]"
                      onChange={(e) => setAnswer(id, e.target.value)}
                      aria-label={`Response: ${topic}`}
                    />
                    <div className="row gap wrap meta">
                      <span className={"pill " + PILL_OF[k]}>
                        {k === ANSWER_STATE.AI ? <Sparkles size={11} /> : k === ANSWER_STATE.FILLED ? <Check size={11} /> : <AlertTriangle size={11} />}
                        {" "}{k === ANSWER_STATE.AI ? "AI suggested" : k}
                      </span>
                      {ans.evidence && k !== ANSWER_STATE.MISSING && (
                        <span className="ev">{k === ANSWER_STATE.AI ? ans.evidence : `From: ${ans.evidence}`}</span>
                      )}
                      {canEdit && k === ANSWER_STATE.AI && (
                        <button className="ps-link" onClick={() => acceptAI(id)}>
                          <Check size={12} /> Accept
                        </button>
                      )}
                      {canEdit && k !== ANSWER_STATE.FILLED && (
                        <button
                          className="ps-link"
                          disabled={!!busy}
                          onClick={() => improveField(
                            id,
                            k === ANSWER_STATE.MISSING
                              ? "Draft this field from the rest of the PRD."
                              : "Make this more specific and complete."
                          )}
                        >
                          <Sparkles size={12} /> {k === ANSWER_STATE.MISSING ? "Draft with AI" : "Improve with AI"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <p className="ps-foot">{FOOTER}</p>
    </section>
  );
}
