import React, { useState } from "react";
import { Download, Copy, X } from "lucide-react";

/** Modal that previews an export and offers Download + Copy. */
export default function ExportDialog({ data, onClose }) {
  const [copied, setCopied] = useState(false);

  const download = () => {
    const blob = new Blob([data.text], { type: data.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <div className="ps-modal" role="dialog" aria-label={data.title}>
      <div className="ps-modal-card">
        <div className="row between">
          <strong>{data.title}</strong>
          <button className="ps-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <textarea readOnly value={data.text} className="ps-export" />
        <div className="row gap">
          <button className="ps-btn primary" onClick={download}>
            <Download size={14} /> Download {data.filename}
          </button>
          <button className="ps-btn" onClick={copy}>
            <Copy size={14} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
