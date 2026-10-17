import React from "react";

/** Empty-state callout used when a step has no data yet. */
export default function Empty({ title, body, action, onClick, disabled, icon, secondary }) {
  return (
    <section className="ps-empty">
      <h1>{title}</h1>
      <p className="lead">{body}</p>
      <div className="row gap" style={{ justifyContent: "center" }}>
        <button className="ps-btn primary big" onClick={onClick} disabled={disabled}>
          {icon}
          {action}
        </button>
        {secondary}
      </div>
    </section>
  );
}
