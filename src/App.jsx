import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Loader2, AlertTriangle, X,
} from "lucide-react";

import {
  FIELDS, TYPES, FOOTER,
  STEP, ROLE, CONN_STATUS, JIRA_STATUS, FILTER, DEVICE, PRIORITY,
  TUNABLES, activeFieldsOf,
} from "./constants.js";
import {
  PARSE_SYS, FILL_SYS, HEADER_EXTRACT_SYS, IMPROVE_SYS,
  SCREENS_PLAN_SYS, EPICS_PLAN_SYS, STORIES_SYS,
  buildCompSys, buildReviewSys,
} from "./prompts.js";
import { parseSchema, headerSchema, fillSchema } from "./schemas.js";
import {
  uid, chunk, pool, str, strs, ctxOf, readinessOf, countsOf,
  jiraDescription, sanitizeLabel, clamp, formatBytes,
} from "./utils.js";
import { askJSONDedup } from "./api.js";
import {
  loadProject, saveProject, loadVersions, saveVersions,
  exportProjectJSON, importProjectJSON, clearActive,
} from "./store.js";
import { pdfToText, docxToText, htmlToText } from "./pdf.js";

import Boundary from "./components/Boundary.jsx";
import ExportDialog from "./components/ExportDialog.jsx";
import Empty from "./components/Empty.jsx";
import ImportView from "./views/ImportView.jsx";
import ReviewView from "./views/ReviewView.jsx";
import PrototypeView from "./views/PrototypeView.jsx";
import JiraView from "./views/JiraView.jsx";

import { useTaskManager } from "./hooks/useTaskManager.js";
import { useScreens } from "./hooks/useScreens.js";
import { useKeyboard } from "./hooks/useKeyboard.js";

import "./styles.css";

/* ================================================================== */
/*  MAIN APP                                                            */
/* ================================================================== */
export default function PRDStudio() {
  /* ---- top-level state ---- */
  const [step, setStep] = useState(STEP.IMPORT);
  const [role, setRole] = useState(ROLE.OWNER);
  const [source, setSource] = useState(null);
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState("");
  const [includesAI, setIncludesAI] = useState(true);
  const [autoFill, setAutoFill] = useState(true);
  const [header, setHeader] = useState({});
  const [answers, setAnswers] = useState({});
  const [filter, setFilter] = useState(FILTER.ALL);
  const [findings, setFindings] = useState(null);
  const [versions, setVersions] = useState([]);
  const [activeScreen, setActiveScreen] = useState(0);
  const [selected, setSelected] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [device, setDevice] = useState(DEVICE.DESKTOP);
  const [refine, setRefine] = useState("");
  const [epics, setEpics] = useState([]);
  const [projectKey, setProjectKey] = useState("");
  const [conn, setConn] = useState({ status: CONN_STATUS.IDLE });
  const [log, setLog] = useState([]);
  const [exportData, setExportData] = useState(null);
  const [saved, setSaved] = useState("");
  const [cfg, setCfg] = useState(null);
  const [docLimit, setDocLimit] = useState(16000);
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const loaded = useRef(false);
  const fileInputRef = useRef(null);
  const {
    busy, err, setErr, setBusy, startTask, endTask, cancelTask, fail, clearErr,
    A, isAborted, tick, abortRef,
  } = useTaskManager();

  const {
    screens, screensRef, setScreens, undo, redo, resetHistory, canUndo, canRedo,
  } = useScreens([]);

  /* ---- derived (memoised) ---- */
  const canEdit = role !== ROLE.VIEWER;
  const canPush = role === ROLE.OWNER;
  const hasAnswers = Object.keys(answers).length > 0;
  const activeFields = useMemo(() => activeFieldsOf(includesAI), [includesAI]);
  const counts = useMemo(() => countsOf(answers, activeFields), [answers, activeFields]);
  const readiness = useMemo(() => readinessOf(answers, activeFields), [answers, activeFields]);
  const effectiveSource = useMemo(
    () => source || (pasted.trim() ? { kind: "text", text: pasted } : null),
    [source, pasted]
  );

  /* ---- keyboard shortcuts ---- */
  useKeyboard(useMemo(() => [
    ["mod+z", () => step === STEP.PROTO && undo()],
    ["shift+mod+z", () => step === STEP.PROTO && redo()],
    ["mod+y", () => step === STEP.PROTO && redo()],
    ["esc", () => { setExportData(null); setSelected(null); }],
    ["1", () => setStep(STEP.IMPORT)],
    ["2", () => hasAnswers && setStep(STEP.REVIEW)],
    ["3", () => hasAnswers && setStep(STEP.PROTO)],
    ["4", () => hasAnswers && setStep(STEP.JIRA)],
  ], [step, undo, redo, hasAnswers]));

  /* ---- persistence ---- */
  useEffect(() => {
    (async () => {
      try {
        const d = await loadProject();
        if (d) {
          setHeader(d.header || {});
          setAnswers(d.answers || {});
          setIncludesAI(d.includesAI ?? true);
          if (d.screens) resetHistory(d.screens);
          setEpics(d.epics || []);
          setProjectKey(d.projectKey || "");
          if (d.pasted) setPasted(d.pasted);
          if (d.answers && Object.keys(d.answers).length) setStep(STEP.REVIEW);
        }
      } catch { /* nothing saved */ }
      try {
        const v = await loadVersions();
        if (v) setVersions(v);
      } catch { /* none */ }
      loaded.current = true;
    })();
  }, [resetHistory]);

  // Debounced save. Slice pasted outside the debounce so we don't copy a
  // 200k string on every keystroke — only when we actually save.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(async () => {
      try {
        await saveProject({
          header, answers, includesAI, screens, epics, projectKey,
          pasted: pasted.slice(0, TUNABLES.MAX_PASTED_PERSIST),
        });
        setSaved("Saved");
      } catch {
        setSaved("Not saved");
      }
    }, TUNABLES.SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [header, answers, includesAI, screens, epics, projectKey, pasted]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        if (c.docLimit) setDocLimit(c.docLimit);
        setCfg(c);
      })
      .catch(() => setCfg({ offline: true }));
  }, []);

  /* ---- file import ---- */
  const onFile = useCallback(async (file) => {
    if (!file) return;
    setErr("");
    if (file.size > TUNABLES.MAX_UPLOAD_BYTES) {
      setErr(`That file is ${formatBytes(file.size)} — the limit is ${formatBytes(TUNABLES.MAX_UPLOAD_BYTES)}. Split it or paste the text instead.`);
      return;
    }
    setFileName(file.name);
    try {
      const n = file.name.toLowerCase();
      if (n.endsWith(".pdf")) {
        setPasted(await pdfToText(file));
        setSource(null);
      } else if (/\.(png|jpe?g|webp|gif)$/.test(n)) {
        setErr("Images need OCR or a vision model, which local mode does not include. Paste the text or upload a PDF, DOCX or text file instead.");
        setFileName("");
      } else if (n.endsWith(".docx")) {
        setPasted(await docxToText(file));
        setSource(null);
      } else if (n.endsWith(".html") || n.endsWith(".htm")) {
        setPasted(await htmlToText(file));
        setSource(null);
      } else if (n.endsWith(".json") && n.includes("prd-studio")) {
        // Treat as a project import
        const text = await file.text();
        const imported = await importProjectJSON(text);
        setHeader(imported.header || {});
        setAnswers(imported.answers || {});
        setIncludesAI(imported.includesAI ?? true);
        if (imported.screens) resetHistory(imported.screens);
        setEpics(imported.epics || []);
        setStep(STEP.REVIEW);
        setFileName("");
      } else {
        setPasted(await file.text());
        setSource(null);
      }
    } catch (e) {
      setErr("Could not read that file: " + e.message);
    }
  }, [setErr, resetHistory]);

  /* ---- AI gap filling ---- */
  const asAI = (text) => ({
    text, status: "ai", source: "ai", evidence: "Not in the source PRD",
  });

  const suggest = useCallback(async (fields, hdr, ans, onChunk) => {
    const out = {};
    let failed = 0;
    const res = await pool(
      chunk(fields, TUNABLES.FILL_CHUNK),
      TUNABLES.POOL_WORKERS,
      async (ch) => {
        const list = ch.map((f) => `- ${f.id} (${f.section} / ${f.topic}): ${f.q}`).join("\n");
        const r = await askJSONDedup(A({
          schema: fillSchema(ch.map((f) => f.id)),
          system: FILL_SYS,
          content: [{ type: "text", text:
            `PRD context:\n${ctxOf(hdr, ans)}\n\nWrite content for these empty fields:\n${list}\n\nReturn {"answers":{"<id>":"text"}}` }],
        }));
        onChunk?.();
        return r.answers || {};
      }
    );
    res.forEach((r) => {
      if (!r.ok) { failed += 1; return; }
      Object.entries(r.v).forEach(([id, t]) => {
        const text = str(t).trim();
        if (text) out[id] = text;
      });
    });
    return { out, failed };
  }, [A]);

  const fillGaps = useCallback(async () => {
    const gaps = activeFields.filter((f) => !answers[f.id]?.text?.trim());
    if (!gaps.length) return;
    setErr("");
    startTask("Drafting AI suggestions", Math.ceil(gaps.length / TUNABLES.FILL_CHUNK));
    let done = 0;
    try {
      const { out, failed } = await suggest(gaps, header, answers, () => {
        done += 1;
        setBusy((b) => b && { ...b, done });
      });
      setAnswers((a) => {
        const n = { ...a };
        Object.entries(out).forEach(([id, t]) => { n[id] = asAI(t); });
        return n;
      });
      if (failed) setErr(`${failed} batch(es) of suggestions failed. Run "Fill gaps with AI" again to retry the rest.`);
    } catch (e) { fail("Could not draft suggestions", e); }
    endTask();
  }, [activeFields, answers, header, suggest, startTask, setBusy, fail, endTask, setErr]);

  /* ---- parse ---- */
  const parse = useCallback(async () => {
    if (!effectiveSource) return;
    setErr("");
    const active = activeFieldsOf(includesAI);
    const chunks = chunk(active, TUNABLES.PARSE_CHUNK);
    startTask("Reading the PRD", chunks.length + 1);
    const blocks = [{ type: "text", text: `<prd>\n${effectiveSource.text.slice(0, docLimit)}\n</prd>` }];
    try {
      const jobs = [
        ...chunks.map((ch) => async () => {
          const list = ch.map((f) => `- ${f.id} (${f.section} / ${f.topic}): ${f.q}`).join("\n");
          const r = await askJSONDedup(A({
            schema: parseSchema(ch.map((f) => f.id)),
            system: PARSE_SYS,
            content: [...blocks, { type: "text", text:
              `Fill these template fields from the PRD above.\n${list}\n\nReturn {"answers":{"<id>":{"text":"","status":"filled|partial|missing","evidence":""}}}` }],
          }));
          tick("Mapping the PRD onto the template");
          return r.answers || {};
        }),
        async () => {
          const r = await askJSONDedup(A({
            schema: headerSchema,
            system: HEADER_EXTRACT_SYS,
            content: [...blocks, { type: "text", text:
              `Extract the document header. Return {"header":{"product":"","owner":"","stakeholders":"","industry":"","status":"","version":"","date":""}} using "" when absent.` }],
          }));
          tick();
          return r.header || {};
        },
      ];
      const results = await pool(jobs, TUNABLES.POOL_WORKERS_PARSE, (j) => j());
      const next = {};
      let failed = 0;
      chunks.forEach((ch, i) => {
        const r = results[i];
        ch.forEach((f) => {
          const a = r.ok ? r.v[f.id] || {} : {};
          const text = str(a.text).trim();
          next[f.id] = {
            text,
            status: text ? (a.status === "partial" ? "partial" : "filled") : "missing",
            evidence: str(a.evidence),
            source: "parsed",
          };
        });
        if (!r.ok) failed += 1;
      });
      const hr = results[results.length - 1];
      const hdr = hr.ok
        ? Object.fromEntries(Object.entries(hr.v).map(([k, v]) => [k, str(v)]).filter(([, v]) => v))
        : {};
      setHeader((h) => ({ ...h, ...hdr }));

      let filled = 0;
      if (autoFill) {
        const gaps = active.filter((f) => !next[f.id]?.text);
        if (gaps.length) {
          setBusy((b) => b && {
            ...b,
            label: "Drafting AI suggestions for the gaps",
            total: (b?.done || 0) + Math.ceil(gaps.length / TUNABLES.FILL_CHUNK),
          });
          const { out, failed: ff } = await suggest(gaps, hdr, next, () => tick("Drafting AI suggestions for the gaps"));
          Object.entries(out).forEach(([id, t]) => { next[id] = asAI(t); filled += 1; });
          failed += ff;
        }
      }
      setAnswers(next);
      setFindings(null);
      if (failed) setErr(`${failed} batch(es) failed and those fields are marked missing. Use "Fill gaps with AI" on the Review tab, or re-run the parser.`);
      setStep(STEP.REVIEW);
    } catch (e) { fail("Parsing failed", e); }
    endTask();
  }, [effectiveSource, includesAI, docLimit, autoFill, A, tick, suggest, startTask, setBusy, fail, endTask, setErr]);

  /* ---- review actions ---- */
  const setAnswer = useCallback((id, text) =>
    setAnswers((a) => ({
      ...a,
      [id]: {
        ...(a[id] || {}),
        text,
        status: text.trim() ? "filled" : "missing",
        source: "manual",
        evidence: "Edited by you",
      },
    })), []);

  const acceptAI = useCallback((id) =>
    setAnswers((a) => ({
      ...a,
      [id]: { ...a[id], status: "filled", source: "manual", evidence: "AI suggestion accepted" },
    })), []);

  const acceptAllAI = useCallback(() =>
    setAnswers((a) => {
      const n = { ...a };
      Object.keys(n).forEach((id) => {
        if (n[id].source === "ai" && n[id].text) {
          n[id] = { ...n[id], status: "filled", source: "manual", evidence: "AI suggestion accepted" };
        }
      });
      return n;
    }), []);

  const improveField = useCallback(async (id, instruction) => {
    const f = FIELDS.find((x) => x.id === id);
    if (!f) return;
    setErr("");
    startTask(`Improving "${f.topic}"`);
    try {
      const r = await askJSONDedup(A({
        system: IMPROVE_SYS,
        content: [{ type: "text", text:
          `Context:\n${ctxOf(header, answers)}\n\nField: ${f.topic} - ${f.q}\nCurrent text: ${answers[id]?.text || "(empty)"}\nFeedback: ${instruction}` }],
      }));
      const text = str(r.text).trim();
      if (text) setAnswers((a) => ({ ...a, [id]: asAI(text) }));
      setFindings((fs) => fs && {
        ...fs,
        items: fs.items.filter((x) => !(x.field === id && x.issue + x.fix === instruction)),
      });
    } catch (e) { fail("Could not improve that field", e); }
    endTask();
  }, [A, header, answers, startTask, fail, endTask, setErr]);

  const runReview = useCallback(async () => {
    setErr("");
    startTask("Reviewing the PRD");
    try {
      const r = await askJSONDedup(A({
        system: buildReviewSys(activeFields.map((f) => f.id)),
        content: [{ type: "text", text: ctxOf(header, answers) }],
      }));
      const ids = new Set(activeFields.map((f) => f.id));
      setFindings({
        score: clamp(Number(r.score) || 0, 0, 100),
        summary: str(r.summary),
        items: (Array.isArray(r.findings) ? r.findings : [])
          .map((x) => ({
            field: str(x.field),
            severity: ["high", "medium", "low"].includes(x.severity) ? x.severity : "medium",
            issue: str(x.issue),
            fix: str(x.fix),
          }))
          .filter((x) => ids.has(x.field)),
      });
    } catch (e) { fail("Review failed", e); }
    endTask();
  }, [A, activeFields, header, answers, startTask, fail, endTask, setErr]);

  const saveVersion = useCallback(async () => {
    const v = [{
      id: uid(),
      ts: new Date().toLocaleString(),
      label: `Version ${versions.length + 1}`,
      header, answers,
    }, ...versions].slice(0, TUNABLES.MAX_VERSIONS);
    setVersions(v);
    try { await saveVersions(v); } catch { /* ignore */ }
  }, [versions, header, answers]);

  const restoreVersion = useCallback((id) => {
    const v = versions.find((x) => x.id === id);
    if (v) {
      setHeader(v.header);
      setAnswers(v.answers);
      setFindings(null);
    }
  }, [versions]);

  /* ---- prototype ---- */
  const si = Math.min(activeScreen, Math.max(0, screens.length - 1));
  const screen = screens[si];

  const updScreen = useCallback((patch) =>
    setScreens((ss) => ss.map((s, i) => (i === si ? { ...s, ...patch } : s))),
  [setScreens, si]);

  const updComp = useCallback((id, patch) =>
    updScreen({ components: screen.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
  [updScreen, screen]);

  const moveComp = useCallback((id, d) => {
    const arr = [...screen.components];
    const i = arr.findIndex((c) => c.id === id);
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    updScreen({ components: arr });
  }, [screen, updScreen]);

  const delComp = useCallback((id) => {
    updScreen({ components: screen.components.filter((c) => c.id !== id) });
    setSelected(null);
  }, [screen, updScreen]);

  const addComp = useCallback((type) => {
    const c = {
      id: uid(),
      type,
      label: "New " + type.replace("_", " "),
      value: "",
      items: ["Item 1", "Item 2"],
    };
    updScreen({ components: [...screen.components, c] });
    setSelected(c.id);
  }, [screen, updScreen]);

  const addScreen = useCallback(() => {
    setScreens((ss) => [...ss, { id: uid(), name: "New screen", purpose: "", components: [] }]);
    setActiveScreen(screens.length);
    setSelected(null);
  }, [setScreens, screens.length]);

  const delScreen = useCallback(() => {
    setScreens((ss) => ss.filter((_, i) => i !== si));
    setActiveScreen(0);
    setSelected(null);
  }, [setScreens, si]);

  const navTo = useCallback((id) => {
    const i = screens.findIndex((s) => s.id === id);
    if (i >= 0) { setActiveScreen(i); setSelected(null); }
  }, [screens]);

  const normComps = useCallback((arr, list) =>
    (Array.isArray(arr) ? arr : []).map((c) => {
      const target = c.goto
        ? list.find((s) => s.name.toLowerCase() === str(c.goto).toLowerCase())
        : null;
      return {
        id: uid(),
        type: TYPES.includes(c.type) ? c.type : "text",
        label: str(c.label),
        value: str(c.value),
        items: strs(c.items),
        goto: target?.id || "",
      };
    }), []);

  const generatePrototype = useCallback(async () => {
    setErr("");
    startTask("Choosing the key screens");
    try {
      const first = await askJSONDedup(A({
        system: SCREENS_PLAN_SYS,
        content: [{ type: "text", text: ctxOf(header, answers) }],
      }));
      const list = (Array.isArray(first.screens) ? first.screens : [])
        .slice(0, 4)
        .map((s) => ({ id: uid(), name: str(s.name) || "Screen", purpose: str(s.purpose), components: [] }));
      if (!list.length) throw new Error("The model did not return any screens");
      setBusy((b) => b && { ...b, label: "Designing each screen", total: list.length, done: 0 });
      const res = await pool(list, TUNABLES.POOL_WORKERS, async (s) => {
        const r = await askJSONDedup(A({
          system: buildCompSys(TYPES),
          content: [{ type: "text", text:
            `${ctxOf(header, answers)}\n\nScreens: ${list.map((x) => x.name).join(" > ")}\nDesign this screen: ${s.name}. Purpose: ${s.purpose}` }],
        }));
        tick();
        return normComps(r.components, list);
      });
      const built = list.map((s, i) => ({ ...s, components: res[i].ok ? res[i].v : [] }));
      const failed = res.filter((r) => !r.ok).length;
      resetHistory(built);
      setActiveScreen(0);
      setSelected(null);
      if (failed) setErr(`${failed} of ${list.length} screens could not be designed and were left empty. Use "Refine with AI" on them, or choose Regenerate.`);
    } catch (e) { fail("Prototype generation failed", e); }
    endTask();
  }, [A, header, answers, startTask, setBusy, tick, normComps, resetHistory, fail, endTask, setErr]);

  const refineScreen = useCallback(async () => {
    if (!refine.trim() || !screen) return;
    setErr("");
    startTask("Refining this screen");
    try {
      const current = screen.components.map(({ type, label, value, items }) => ({ type, label, value, items }));
      const r = await askJSONDedup(A({
        system: buildCompSys(TYPES),
        content: [{ type: "text", text:
          `${ctxOf(header, answers)}\n\nScreen: ${screen.name}. Purpose: ${screen.purpose}\nOther screens: ${screens.filter((_, i) => i !== si).map((x) => x.name).join(", ")}\nCurrent components: ${JSON.stringify(current).slice(0, 3000)}\n\nApply this change and return the full updated component list: ${refine}` }],
      }));
      const comps = normComps(r.components, screens);
      if (!comps.length) throw new Error("No components returned");
      updScreen({ components: comps });
      setRefine("");
      setSelected(null);
    } catch (e) { fail("Could not refine the screen", e); }
    endTask();
  }, [refine, screen, screens, si, A, header, answers, startTask, normComps, updScreen, fail, endTask, setErr]);

  /* ---- backlog ---- */
  const protoCtx = useCallback(() => screens.map((s) => `${s.name}: ${s.purpose}`).join("\n"), [screens]);

  const generateBacklog = useCallback(async () => {
    setErr("");
    startTask("Drafting epics");
    try {
      const first = await askJSONDedup(A({
        system: EPICS_PLAN_SYS,
        content: [{ type: "text", text:
          `${ctxOf(header, answers)}\n\nPrototype screens:\n${protoCtx()}` }],
      }));
      const list = (Array.isArray(first.epics) ? first.epics : [])
        .slice(0, TUNABLES.MAX_EPICS)
        .map((e) => ({ title: str(e.title) || "Epic", summary: str(e.summary) }));
      if (!list.length) throw new Error("The model did not return any epics");
      setBusy((b) => b && { ...b, label: "Writing stories", total: list.length, done: 0 });
      const res = await pool(list, TUNABLES.POOL_WORKERS, async (e) => {
        const r = await askJSONDedup(A({
          system: STORIES_SYS,
          content: [{ type: "text", text:
            `${ctxOf(header, answers)}\n\nPrototype screens:\n${protoCtx()}\n\nWrite stories for epic: ${e.title}. ${e.summary}` }],
        }));
        tick();
        return (Array.isArray(r.stories) ? r.stories : []).slice(0, TUNABLES.MAX_STORIES_PER_EPIC).map((s) => ({
          id: uid(),
          include: true,
          title: str(s.title),
          description: str(s.description),
          acceptance_criteria: strs(s.acceptance_criteria),
          priority: PRIORITY.includes(s.priority) ? s.priority : "Medium",
          points: Number(s.points) || 3,
          source: str(s.source),
          screen: str(s.screen),
          jira: null,
        }));
      });
      setEpics(list.map((e, i) => ({
        id: uid(),
        include: true,
        title: e.title,
        summary: e.summary,
        stories: res[i].ok ? res[i].v : [],
        jira: null,
      })));
      const failed = res.filter((r) => !r.ok).length;
      if (failed) setErr(`${failed} epic(s) have no stories because generation failed. Use Regenerate to retry.`);
    } catch (e) { fail("Backlog generation failed", e); }
    endTask();
  }, [A, header, answers, protoCtx, startTask, setBusy, tick, fail, endTask, setErr]);

  const resetJira = useCallback(() =>
    setEpics((es) => es.map((e) => ({
      ...e,
      jira: null,
      stories: e.stories.map((s) => ({ ...s, jira: null })),
    }))), []);

  /* ---- Jira connection + push ---- */
  const pushLog = useCallback((line) =>
    setLog((l) => [...l.slice(-79), `${new Date().toLocaleTimeString()}  ${line}`]), []);

  const api = useCallback(async (path, body) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abortRef.current?.signal,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `Server error ${res.status}`);
    return j;
  }, [abortRef]);

  const connect = useCallback(async (key) => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    setConn({ status: CONN_STATUS.CONNECTING });
    setBusy({ label: "Connecting to Jira", done: 0, total: 1 });
    try {
      pushLog(`Checking project ${key}`);
      const j = await api("/api/jira/connect", { projectKey: key });
      const types = strs(j.issueTypes);
      const epicType = types.find((t) => /^epic$/i.test(t)) || "";
      const storyType = types.find((t) => /^story$/i.test(t))
        || types.find((t) => /^task$/i.test(t))
        || types.find((t) => !/epic|sub-?task/i.test(t))
        || "Story";
      const c = {
        status: CONN_STATUS.OK,
        siteUrl: str(j.siteUrl).replace(/\/$/, ""),
        projectName: str(j.projectName),
        projectKey: key,
        issueTypes: types,
        epicType,
        storyType,
      };
      pushLog(`✓ ${c.projectName}: ${types.join(", ")}`);
      setConn(c);
      setBusy(null);
      return c;
    } catch (e) {
      setConn({ status: CONN_STATUS.ERROR, msg: e.message });
      setBusy(null);
      setErr(`Could not connect to Jira: ${e.message} You can still export the CSV and import it into Jira manually.`);
      return null;
    }
  }, [api, pushLog, setBusy, setErr]);

  const createIssue = useCallback(async (c, spec) => {
    const j = await api("/api/jira/issue", {
      projectKey: c.projectKey,
      type: spec.type,
      title: spec.title,
      description: spec.description,
      priority: spec.priority,
      parent: spec.parent,
      labels: (spec.labels || []).map(sanitizeLabel),
    });
    pushLog(`✓ ${j.key} (${spec.type})`);
    return j.key;
  }, [api, pushLog]);

  const setJ = useCallback((eid, sid, jira) =>
    setEpics((es) => es.map((e) => {
      if (e.id !== eid) return e;
      if (!sid) return { ...e, jira };
      return { ...e, stories: e.stories.map((s) => (s.id === sid ? { ...s, jira } : s)) };
    })), []);

  const pushToJira = useCallback(async () => {
    const key = projectKey.trim().toUpperCase();
    if (!key) { setErr("Enter a Jira project key first."); return; }
    setErr("");
    abortRef.current = new AbortController();
    let c = conn;
    if (c.status !== CONN_STATUS.OK || c.projectKey !== key) {
      c = await connect(key);
      if (!c) return;
    }
    const sel = epics.filter((e) => e.include);
    const total = sel.reduce((n, e) =>
      n + (e.jira?.status === JIRA_STATUS.DONE ? 0 : 1)
        + e.stories.filter((s) => s.include && s.jira?.status !== JIRA_STATUS.DONE).length, 0);
    if (!total) { setErr("Everything selected has already been created."); return; }
    let done = 0;
    const bump = () => { done += 1; setBusy((b) => b && { ...b, done }); };
    setBusy({ label: "Creating issues in Jira", done: 0, total });
    try {
      for (const e of sel) {
        if (isAborted()) break;
        let epicKey = e.jira?.status === JIRA_STATUS.DONE ? e.jira.key : null;
        if (c.epicType && !epicKey) {
          setJ(e.id, null, { status: JIRA_STATUS.CREATING });
          try {
            epicKey = await createIssue(c, {
              type: c.epicType,
              title: e.title,
              description: `${e.summary}\n\n${FOOTER}`,
              labels: ["ai-generated"],
            });
            setJ(e.id, null, { status: JIRA_STATUS.DONE, key: epicKey });
          } catch (x) {
            setJ(e.id, null, { status: JIRA_STATUS.ERROR, error: x.message });
          }
          bump();
        }
        const todo = e.stories.filter((s) => s.include && s.jira?.status !== JIRA_STATUS.DONE);
        if (c.epicType && !epicKey) {
          todo.forEach((s) => {
            setJ(e.id, s.id, { status: JIRA_STATUS.ERROR, error: "Skipped: the epic was not created" });
            bump();
          });
          continue;
        }
        const slug = "epic-" + e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
        await pool(todo, TUNABLES.POOL_WORKERS, async (s) => {
          if (isAborted()) return;
          setJ(e.id, s.id, { status: JIRA_STATUS.CREATING });
          try {
            const k = await createIssue(c, {
              type: c.storyType,
              title: s.title,
              description: jiraDescription(s),
              priority: s.priority,
              parent: epicKey,
              labels: c.epicType ? ["ai-generated"] : ["ai-generated", slug],
            });
            setJ(e.id, s.id, { status: JIRA_STATUS.DONE, key: k });
          } catch (x) {
            setJ(e.id, s.id, { status: JIRA_STATUS.ERROR, error: x.message });
          }
          bump();
        });
      }
    } catch (x) { fail("Jira creation stopped", x); }
    // Anything left "creating" after a cancel goes back to pending
    setEpics((es) => es.map((e) => ({
      ...e,
      jira: e.jira?.status === JIRA_STATUS.CREATING ? null : e.jira,
      stories: e.stories.map((s) => (s.jira?.status === JIRA_STATUS.CREATING ? { ...s, jira: null } : s)),
    })));
    setBusy(null);
  }, [projectKey, conn, connect, epics, setBusy, isAborted, setJ, createIssue, fail, setErr]);

  /* ---- project export / import / clear ---- */
  const handleExportProject = useCallback(async () => {
    const text = await exportProjectJSON(
      { header, answers, includesAI, screens, epics, projectKey, pasted },
      versions
    );
    setExportData({
      title: "PRD Studio project (JSON)",
      text,
      filename: `prd-studio-${(header.product || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`,
      mime: "application/json",
    });
  }, [header, answers, includesAI, screens, epics, projectKey, pasted, versions]);

  const handleNewProject = useCallback(async () => {
    if (!confirm("Start a new project? This clears the current PRD, prototype and backlog.")) return;
    await clearActive();
    setHeader({});
    setAnswers({});
    setFindings(null);
    setEpics([]);
    setPasted("");
    setFileName("");
    resetHistory([]);
    setVersions([]);
    setConn({ status: CONN_STATUS.IDLE });
    setLog([]);
    setStep(STEP.IMPORT);
    setErr("");
  }, [resetHistory, setErr]);

  /* ---- render ---- */
  const steps = [
    { id: STEP.IMPORT, label: "Import", meta: hasAnswers ? "Parsed" : "" },
    { id: STEP.REVIEW, label: "Review and edit", meta: hasAnswers ? `${readiness}%` : "" },
    { id: STEP.PROTO, label: "Prototype", meta: screens.length ? `${screens.length} screens` : "" },
    { id: STEP.JIRA, label: "Jira", meta: epics.length ? `${epics.length} epics` : "" },
  ];

  return (
    <div className="ps">
      <header className="ps-top">
        <div className="ps-brand">PRD Studio</div>
        <span
          className={"pill " + (cfg?.ollamaUp && cfg?.modelInstalled ? "ok" : cfg ? "bad" : "warn")}
          title="Model that reads and drafts your PRD. Runs on this machine."
        >
          {!cfg
            ? "Checking model…"
            : cfg.offline
              ? "API server not running"
              : !cfg.ollamaUp
                ? "Ollama not running"
                : !cfg.modelInstalled
                  ? `Run: ollama pull ${cfg.model}`
                  : `Local model: ${cfg.model}`}
        </span>
        <nav className="ps-steps" aria-label="Workflow">
          {steps.map((s) => (
            <button
              key={s.id}
              className={"ps-step" + (step === s.id ? " on" : "")}
              onClick={() => setStep(s.id)}
            >
              {s.label}{s.meta && <em>{s.meta}</em>}
            </button>
          ))}
        </nav>
        <div className="ps-who">
          <label className="ps-sr" htmlFor="role">Your access</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            title="Preview of role-based access. Real permissions come from your sign-in system."
          >
            <option value={ROLE.VIEWER}>Viewer</option>
            <option value={ROLE.EDITOR}>Editor</option>
            <option value={ROLE.OWNER}>Owner</option>
          </select>
          <button
            className="ps-btn"
            onClick={() => setShowProjectMenu((v) => !v)}
            title="Project actions"
          >
            Project ▾
          </button>
          {showProjectMenu && (
            <div className="ps-menu" role="menu" onBlur={() => setShowProjectMenu(false)}>
              <button className="ps-link" onClick={handleExportProject}>Export project (JSON)</button>
              <button className="ps-link" onClick={() => fileInputRef?.current?.click()}>Import project…</button>
              <button className="ps-link" onClick={handleNewProject}>New project</button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={(e) => { onFile(e.target.files?.[0]); setShowProjectMenu(false); }}
          />
          <span className="ps-saved">{saved}</span>
        </div>
      </header>

      {err && (
        <div className="ps-err" role="alert">
          <AlertTriangle size={15} /> <span>{err}</span>
          <button className="ps-icon" onClick={clearErr} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}
      {busy && (
        <div className="ps-busy" role="status" aria-live="polite">
          <Loader2 size={15} className="spin" />{" "}
          <span>{busy.label}{busy.total > 1 ? ` (${busy.done}/${busy.total})` : ""}</span>
          <button className="ps-link" style={{ marginLeft: "auto" }} onClick={cancelTask}>Cancel</button>
          {busy.total > 1 && (
            <div className="bar"><i style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div>
          )}
        </div>
      )}

      <main className="ps-main">
        <Boundary
          key={step}
          resetLabel="Clear prototype and retry"
          onReset={() => { resetHistory([]); setSelected(null); setActiveScreen(0); }}
        >
          {step === STEP.IMPORT && (
            <ImportView
              pasted={pasted}
              setPasted={setPasted}
              setSource={setSource}
              fileName={fileName}
              onFile={onFile}
              includesAI={includesAI}
              setIncludesAI={setIncludesAI}
              autoFill={autoFill}
              setAutoFill={setAutoFill}
              effectiveSource={effectiveSource}
              busy={busy}
              canEdit={canEdit}
              parse={parse}
              setExportData={setExportData}
              docLimit={docLimit}
            />
          )}

          {step === STEP.REVIEW && (
            hasAnswers ? (
              <ReviewView
                header={header}
                setHeader={setHeader}
                answers={answers}
                setAnswer={setAnswer}
                acceptAI={acceptAI}
                acceptAllAI={acceptAllAI}
                fillGaps={fillGaps}
                improveField={improveField}
                runReview={runReview}
                saveVersion={saveVersion}
                restoreVersion={restoreVersion}
                versions={versions}
                findings={findings}
                setFindings={setFindings}
                filter={filter}
                setFilter={setFilter}
                includesAI={includesAI}
                canEdit={canEdit}
                busy={busy}
                counts={counts}
                readiness={readiness}
                setStep={setStep}
                setExportData={setExportData}
              />
            ) : (
              <Empty
                title="Nothing parsed yet"
                body="Import a PRD and run the parser, and the template will fill in here."
                action="Go to Import"
                onClick={() => setStep(STEP.IMPORT)}
              />
            )
          )}

          {step === STEP.PROTO && (
            <PrototypeView
              hasAnswers={hasAnswers}
              screens={screens}
              activeScreen={activeScreen}
              setActiveScreen={setActiveScreen}
              selected={selected}
              setSelected={setSelected}
              previewMode={previewMode}
              setPreviewMode={setPreviewMode}
              device={device}
              setDevice={setDevice}
              refine={refine}
              setRefine={setRefine}
              canEdit={canEdit}
              busy={busy}
              generatePrototype={generatePrototype}
              refineScreen={refineScreen}
              addScreen={addScreen}
              delScreen={delScreen}
              updScreen={updScreen}
              updComp={updComp}
              moveComp={moveComp}
              delComp={delComp}
              addComp={addComp}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              navTo={navTo}
              setStep={setStep}
            />
          )}

          {step === STEP.JIRA && (
            <JiraView
              hasAnswers={hasAnswers}
              screens={screens}
              epics={epics}
              setEpics={setEpics}
              projectKey={projectKey}
              setProjectKey={setProjectKey}
              setConn={setConn}
              conn={conn}
              log={log}
              busy={busy}
              canEdit={canEdit}
              canPush={canPush}
              setStep={setStep}
              setExportData={setExportData}
              generateBacklog={generateBacklog}
              pushToJira={pushToJira}
              resetJira={resetJira}
              connect={connect}
              abortRef={abortRef}
            />
          )}
        </Boundary>
      </main>

      {exportData && <ExportDialog data={exportData} onClose={() => setExportData(null)} />}
    </div>
  );
}
