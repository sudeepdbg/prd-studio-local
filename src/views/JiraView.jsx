import React from "react";
import {
  Sparkles, Loader2, Download, Ticket, Check, ExternalLink, Plug,
} from "lucide-react";
import { CONN_STATUS, JIRA_STATUS, PRIORITY, FOOTER } from "../constants.js";
import { toJiraCsv } from "../utils.js";
import Empty from "../components/Empty.jsx";

/**
 * Step 4 — generate a backlog and push to Jira (or export CSV).
 */
export default function JiraView({
  hasAnswers,
  screens,
  epics,
  setEpics,
  projectKey,
  setProjectKey,
  setConn,
  conn,
  log,
  busy,
  canEdit,
  canPush,
  setStep,
  setExportData,
  generateBacklog,
  pushToJira,
  resetJira,
  connect,
  abortRef,
}) {
  if (!hasAnswers) {
    return (
      <Empty
        title="Parse a PRD first"
        body="The backlog is generated from the template answers and the prototype."
        action="Go to Import"
        onClick={() => setStep("import")}
      />
    );
  }
  if (epics.length === 0) {
    return (
      <Empty
        title="Generate a backlog"
        body={
          screens.length
            ? "The AI turns the PRD and your prototype screens into epics and stories with acceptance criteria, priority and traceability back to the PRD. You review everything before it goes to Jira."
            : "The AI turns the PRD into epics and stories with acceptance criteria. Generate a prototype first if you want the stories to reference its screens."
        }
        action="Generate backlog"
        onClick={generateBacklog}
        disabled={!!busy || !canEdit}
        icon={<Sparkles size={15} />}
      />
    );
  }

  const updEpic = (id, patch) => setEpics((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const updStory = (eid, sid, patch) =>
    setEpics((es) => es.map((e) =>
      e.id === eid ? { ...e, stories: e.stories.map((s) => (s.id === sid ? { ...s, ...patch } : s)) } : e
    ));
  const mvpOnly = () =>
    setEpics((es) => es.map((e) => ({
      ...e,
      stories: e.stories.map((s) => ({ ...s, include: s.priority === "High" })),
    })));
  const allStories = () => epics.filter((e) => e.include).flatMap((e) => e.stories.filter((s) => s.include));
  const totalPoints = allStories().reduce((n, s) => n + (Number(s.points) || 0), 0);
  const jiraStats = epics.reduce((m, e) => {
    [e.jira, ...e.stories.map((s) => s.jira)].forEach((j) => {
      if (j?.status === JIRA_STATUS.DONE) m.done += 1;
      if (j?.status === JIRA_STATUS.ERROR) m.err += 1;
    });
    return m;
  }, { done: 0, err: 0 });

  const itemChip = (j) => {
    if (!j) return null;
    if (j.status === JIRA_STATUS.CREATING) {
      return <span className="pill ai"><Loader2 size={11} className="spin" /> Creating</span>;
    }
    if (j.status === JIRA_STATUS.DONE) {
      return conn.siteUrl ? (
        <a className="pill ok" href={`${conn.siteUrl}/browse/${j.key}`} target="_blank" rel="noreferrer">
          {j.key} <ExternalLink size={10} />
        </a>
      ) : <span className="pill ok">{j.key}</span>;
    }
    return <span className="pill bad" title={j.error}>Failed: {String(j.error || "").slice(0, 60)}</span>;
  };

  return (
    <section>
      <div className="ps-conn">
        <div className="row between wrap gap">
          <div className="row gap wrap">
            <Plug size={15} />
            <strong>Jira connection</strong>
            {conn.status === CONN_STATUS.OK && (
              <span className="pill ok">
                <Check size={11} /> {conn.projectName || conn.projectKey} · {conn.siteUrl.replace("https://", "")}
              </span>
            )}
            {conn.status === CONN_STATUS.CONNECTING && (
              <span className="pill ai"><Loader2 size={11} className="spin" /> Connecting</span>
            )}
            {conn.status === CONN_STATUS.ERROR && <span className="pill bad">Not connected</span>}
            {conn.status === CONN_STATUS.IDLE && <span className="pill warn">Not tested</span>}
          </div>
          <div className="row gap wrap">
            <label className="ps-lab inline">
              Project key
              <input
                value={projectKey}
                onChange={(e) => {
                  setProjectKey(e.target.value.toUpperCase());
                  setConn({ status: CONN_STATUS.IDLE });
                }}
                placeholder="e.g. PRD"
                disabled={!canPush}
              />
            </label>
            <button
              className="ps-btn"
              disabled={!canPush || !!busy || !projectKey.trim()}
              onClick={() => {
                abortRef.current = new AbortController();
                connect(projectKey.trim().toUpperCase());
              }}
            >
              Test connection
            </button>
          </div>
        </div>
        {conn.status === CONN_STATUS.OK && (
          <p className="hint">
            Epics will be created as "{conn.epicType || "(none: stories will be created flat with an epic label)"}"
            and stories as "{conn.storyType}".
          </p>
        )}
        {log.length > 0 && (
          <details>
            <summary>Jira activity ({log.length})</summary>
            <pre className="ps-log">{log.join("\n")}</pre>
          </details>
        )}
      </div>

      <div className="row between wrap gap ps-toolbar">
        <div className="row gap wrap">
          <span className="pill ai">{epics.filter((e) => e.include).length} epics</span>
          <span className="pill ai">{allStories().length} stories</span>
          <span className="pill ai">{totalPoints} pts</span>
          {jiraStats.done > 0 && <span className="pill ok">{jiraStats.done} created</span>}
          {jiraStats.err > 0 && <span className="pill bad">{jiraStats.err} failed</span>}
        </div>
        <div className="row gap wrap">
          <button className="ps-btn" onClick={mvpOnly} disabled={!canEdit}>MVP only (High)</button>
          <button className="ps-btn" disabled={!!busy || !canEdit} onClick={generateBacklog}>Regenerate</button>
          <button
            className="ps-btn"
            onClick={() => setExportData({
              title: "Jira CSV import file",
              text: toJiraCsv(epics),
              filename: "jira-import.csv",
              mime: "text/csv",
            })}
          >
            <Download size={14} /> Export CSV
          </button>
          {(jiraStats.done > 0 || jiraStats.err > 0) && canPush && (
            <button className="ps-btn" onClick={resetJira} disabled={!!busy}>Reset status</button>
          )}
          <button
            className="ps-btn primary"
            disabled={!canPush || !!busy || !projectKey.trim()}
            onClick={pushToJira}
          >
            <Ticket size={14} />{" "}
            {jiraStats.done > 0 || jiraStats.err > 0 ? "Create remaining / retry failed" : "Create in Jira"}
          </button>
        </div>
      </div>
      {!canPush && (
        <p className="hint">Only owners can create issues in Jira. You can still edit the backlog and export the CSV.</p>
      )}
      <p className="hint">
        Issues are created by the local server using the Jira credentials in its .env file, so nothing sensitive
        is entered on this page. Nothing is sent until you choose Create. Already-created items are skipped
        when you retry.
      </p>

      {epics.map((e) => (
        <div className={"ps-epic" + (e.include ? "" : " off")} key={e.id}>
          <div className="ps-epic-h">
            <input
              type="checkbox"
              checked={e.include}
              onChange={(x) => updEpic(e.id, { include: x.target.checked })}
              aria-label="Include epic"
            />
            <span className="tag epic">Epic</span>
            <input
              className="grow strong"
              readOnly={!canEdit}
              value={e.title}
              onChange={(x) => updEpic(e.id, { title: x.target.value })}
              aria-label="Epic title"
            />
            {itemChip(e.jira)}
          </div>
          <textarea
            className="ps-sum"
            readOnly={!canEdit}
            rows={2}
            value={e.summary}
            onChange={(x) => updEpic(e.id, { summary: x.target.value })}
            aria-label="Epic summary"
          />
          {e.stories.map((s) => (
            <div className={"ps-story" + (s.include && e.include ? "" : " off")} key={s.id}>
              <div className="ps-epic-h">
                <input
                  type="checkbox"
                  checked={s.include}
                  onChange={(x) => updStory(e.id, s.id, { include: x.target.checked })}
                  aria-label="Include story"
                />
                <span className="tag">Story</span>
                <input
                  className="grow"
                  readOnly={!canEdit}
                  value={s.title}
                  onChange={(x) => updStory(e.id, s.id, { title: x.target.value })}
                  aria-label="Story title"
                />
                <select
                  disabled={!canEdit}
                  value={s.priority}
                  onChange={(x) => updStory(e.id, s.id, { priority: x.target.value })}
                  aria-label="Priority"
                >
                  {PRIORITY.map((p) => <option key={p}>{p}</option>)}
                </select>
                <input
                  className="pts"
                  type="number"
                  min="0"
                  readOnly={!canEdit}
                  value={s.points}
                  onChange={(x) => updStory(e.id, s.id, { points: Number(x.target.value) })}
                  aria-label="Story points"
                />
                {itemChip(s.jira)}
              </div>
              <textarea
                readOnly={!canEdit}
                rows={2}
                value={s.description}
                onChange={(x) => updStory(e.id, s.id, { description: x.target.value })}
                aria-label="Story description"
              />
              <label className="ps-lab small">
                Acceptance criteria (one per line)
                <textarea
                  readOnly={!canEdit}
                  rows={3}
                  value={(s.acceptance_criteria || []).join("\n")}
                  onChange={(x) => updStory(e.id, s.id, { acceptance_criteria: x.target.value.split("\n") })}
                />
              </label>
              {(s.source || s.screen) && (
                <div className="trace">
                  {s.source && <span>PRD: {s.source}</span>}
                  {s.screen && <span>Screen: {s.screen}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <p className="ps-foot">{FOOTER}</p>
    </section>
  );
}
