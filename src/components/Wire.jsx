import React from "react";
import { str, strs } from "../utils.js";

/**
 * Render a single wireframe component. The shape comes from the model
 * (or the user's manual edits) and is intentionally low-fidelity.
 *
 * `preview` enables click-through navigation on buttons.
 * `onNav(screenId)` is called when a button with a `goto` is clicked.
 */
export default function Wire({ c: raw, preview, onNav }) {
  const c = { ...raw, label: str(raw.label), value: str(raw.value) };
  const items = strs(raw.items);

  switch (c.type) {
    case "header":
      return (
        <div>
          <div className="w-h1">{c.label}</div>
          {c.value && <div className="w-sub">{c.value}</div>}
        </div>
      );

    case "text":
      return <p className="w-text">{[c.label, c.value].filter(Boolean).join(" ")}</p>;

    case "input":
      return (
        <div>
          <div className="w-lab">{c.label}</div>
          <div className="w-box">{c.value || "Type here"}</div>
        </div>
      );

    case "textarea":
      return (
        <div>
          <div className="w-lab">{c.label}</div>
          <div className="w-box tall">{c.value || "Type here"}</div>
        </div>
      );

    case "select":
      return (
        <div>
          <div className="w-lab">{c.label}</div>
          <div className="w-box sel">
            <span>{c.value || "Select"}</span>
            <span>▾</span>
          </div>
        </div>
      );

    case "button":
      return (
        <button
          type="button"
          className="w-btn"
          onClick={(e) => {
            if (preview && raw.goto) {
              e.stopPropagation();
              onNav(raw.goto);
            }
          }}
        >
          {c.label}
          {raw.goto && !preview ? " ↗" : ""}
        </button>
      );

    case "list":
      return (
        <div>
          <div className="w-lab">{c.label}</div>
          <ul className="w-list">
            {items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </div>
      );

    case "card":
      return (
        <div className="w-card">
          <div className="w-card-t">{c.label}</div>
          <div className="w-text">{c.value}</div>
        </div>
      );

    case "table":
      return (
        <div>
          <div className="w-lab">{c.label}</div>
          <div className="w-table">
            <div className="w-tr head">
              {items.map((it, i) => <span key={i}>{it}</span>)}
            </div>
            {[0, 1].map((r) => (
              <div className="w-tr" key={r}>
                {items.map((_, i) => <span key={i}><i className="w-skel" /></span>)}
              </div>
            ))}
          </div>
        </div>
      );

    case "chips":
      return (
        <div>
          <div className="w-lab">{c.label}</div>
          <div className="w-chips">
            {items.map((it, i) => <span key={i}>{it}</span>)}
          </div>
        </div>
      );

    case "stats":
      return (
        <div className="w-stats">
          {items.map((it, i) => {
            const [k, ...v] = it.split(":");
            return (
              <div key={i} className="w-stat">
                <b>{v.join(":").trim() || "–"}</b>
                <span>{k}</span>
              </div>
            );
          })}
        </div>
      );

    case "image":
      return <div className="w-img">{c.label || "Image"}</div>;

    case "chat":
      return (
        <div className="w-chat">
          <div className="w-lab">{c.label}</div>
          {items.map((it, i) => (
            <div key={i} className={"w-bubble " + (i % 2 ? "ai" : "me")}>{it}</div>
          ))}
          <div className="w-box">{c.value || "Ask or reply…"}</div>
        </div>
      );

    case "ai_output":
      return (
        <div className="w-ai">
          <div className="w-ai-tag">AI suggested</div>
          <div className="w-text">{c.value || c.label}</div>
          <div className="w-ai-actions">
            <span>Approve</span>
            <span>Edit</span>
            <span>Reject</span>
          </div>
        </div>
      );

    case "notice":
      return <div className="w-notice">{[c.label, c.value].filter(Boolean).join(" ")}</div>;

    default:
      return <div className="w-box">{c.label}</div>;
  }
}
