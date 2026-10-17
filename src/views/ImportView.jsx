import React, { useRef } from "react";
import { Upload, Sparkles, FileText } from "lucide-react";
import { TUNABLES, SAMPLE } from "../constants.js";
import { toBlankTemplate, formatBytes } from "../utils.js";

/**
 * Step 1 — bring a PRD in (paste, upload, or load the sample).
 * Stateless: all handlers come from props.
 */
export default function ImportView({
  pasted,
  setPasted,
  setSource,
  fileName,
  onFile,
  includesAI,
  setIncludesAI,
  autoFill,
  setAutoFill,
  effectiveSource,
  busy,
  canEdit,
  parse,
  setExportData,
  docLimit,
}) {
  const fileInputRef = useRef(null);

  return (
    <section className="ps-import">
      <div>
        <h1>Bring in any PRD</h1>
        <p className="lead">
          Paste it or upload it in whatever shape it is in: prose, bullets, tables,
          slides, meeting notes. The parser maps it onto the standard PRD template,
          and anything the PRD does not cover is drafted by AI and clearly tagged.
        </p>

        <label className="ps-drop">
          <Upload size={18} />
          <span>{fileName || `Upload .docx, .pdf, .md, .txt or .html (max ${formatBytes(TUNABLES.MAX_UPLOAD_BYTES)})`}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,.md,.txt,.html,.htm,.csv,.json"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>

        <label className="ps-lab" htmlFor="paste">Or paste the text</label>
        <textarea
          id="paste"
          className="ps-paste"
          value={pasted}
          onChange={(e) => { setPasted(e.target.value); setSource(null); }}
          placeholder="Paste your PRD here"
        />

        {pasted.length > docLimit && (
          <p className="hint">
            This PRD is longer than the local model can read at once. Only the first{" "}
            {docLimit.toLocaleString()} characters will be parsed. Raise NUM_CTX in
            .env or split the document.
          </p>
        )}

        <div className="row gap wrap">
          <button
            className="ps-btn"
            onClick={() => { setPasted(SAMPLE); setSource(null); setFileName(""); }}
          >
            Load a sample PRD
          </button>
          <button
            className="ps-btn"
            onClick={() => setExportData({
              title: "Blank PRD template (Markdown)",
              text: toBlankTemplate(includesAI),
              filename: "prd-template.md",
              mime: "text/markdown",
            })}
          >
            <FileText size={14} /> View blank template
          </button>
        </div>
      </div>

      <aside className="ps-side">
        <h2>Parse settings</h2>
        <label className="ps-check">
          <input
            type="checkbox"
            checked={includesAI}
            onChange={(e) => setIncludesAI(e.target.checked)}
          />
          <span>Product includes AI / ML features
            <small>Adds the AI considerations section.</small>
          </span>
        </label>
        <label className="ps-check">
          <input
            type="checkbox"
            checked={autoFill}
            onChange={(e) => setAutoFill(e.target.checked)}
          />
          <span>Draft the gaps with AI
            <small>Fields the PRD does not cover are drafted and tagged "AI suggested" for you to accept or edit.</small>
          </span>
        </label>
        <button
          className="ps-btn primary big"
          disabled={!effectiveSource || !!busy || !canEdit}
          onClick={parse}
        >
          <Sparkles size={15} /> Parse into template
        </button>
        {!canEdit && <p className="hint">Viewers cannot run the parser.</p>}
        <p className="hint">
          Only import content you are cleared to use here. Personal data about staff,
          consumers or talent needs Privacy Legal approval, and never include credentials.
        </p>
      </aside>
    </section>
  );
}
