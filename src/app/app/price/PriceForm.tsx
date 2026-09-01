"use client";

import { useActionState, useEffect, useState } from "react";
import { createItemAction, identifyAction } from "../actions";
import type { IdentifyState } from "../actions";
import { GRADES, SIZE_TYPES } from "@/lib/constants";

// Two steps: photograph it, then confirm what it is. The confirm step is
// always available on its own, so the calculator works with no API key —
// you just type the shoe in yourself.

const EMPTY: IdentifyState = { status: "idle" };

interface Draft {
  brand: string;
  model: string;
  colorway: string;
  styleCode: string;
  nickname: string;
  retail: string;
}

const BLANK_DRAFT: Draft = {
  brand: "",
  model: "",
  colorway: "",
  styleCode: "",
  nickname: "",
  retail: "",
};

export default function PriceForm({ photoIdOn }: { photoIdOn: boolean }) {
  const [state, runIdentify, identifying] = useActionState(
    identifyAction,
    EMPTY,
  );
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);
  const [picked, setPicked] = useState<number | null>(null);
  const [grade, setGrade] = useState("G8");

  const candidates = state.result?.candidates ?? [];

  // When identification comes back, take the top candidate as the starting
  // point. You can still change any field before saving.
  useEffect(() => {
    if (state.status === "ok" && candidates.length > 0) {
      applyCandidate(0);
      if (state.result?.suggestedGrade) setGrade(state.result.suggestedGrade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function applyCandidate(index: number) {
    const c = candidates[index];
    if (!c) return;
    setPicked(index);
    setDraft({
      brand: c.brand ?? "",
      model: c.model ?? "",
      colorway: c.colorway ?? "",
      styleCode: c.styleCode ?? "",
      nickname: c.nickname ?? "",
      retail: c.retailUsd != null ? String(c.retailUsd) : "",
    });
  }

  function set(field: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  return (
    <>
      <h2>1. Photograph it</h2>

      {photoIdOn ? (
        <div className="card">
          <form action={runIdentify}>
            <div className="field">
              <label htmlFor="photos">Photos</label>
              <input
                id="photos"
                type="file"
                name="photos"
                accept="image/*"
                capture="environment"
                multiple
              />
              <div className="hint">
                One side-on shot identifies the model. Add a shot of the tongue
                tag and it can read the style code, which is the only way to be
                certain about a colorway.
              </div>
            </div>
            <div className="field">
              <label htmlFor="hint">Anything you already know (optional)</label>
              <input
                id="hint"
                type="text"
                name="hint"
                placeholder="Seller said they're Jordan 4s, size 10.5"
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={identifying}
            >
              {identifying ? "Looking…" : "Identify this pair"}
            </button>
          </form>
        </div>
      ) : (
        <div className="notice notice-info">
          <strong>Photo ID is off</strong>
          Add <code>ANTHROPIC_API_KEY</code> to your <code>.env</code> file and
          restart to turn it on. Everything below works without it — you just
          type the shoe in yourself.
        </div>
      )}

      {state.status === "error" ? (
        <div className="notice notice-bad" style={{ marginTop: "1rem" }}>
          <strong>Couldn't identify that</strong>
          {state.error}
        </div>
      ) : null}

      {state.status === "ok" && state.result ? (
        <>
          <h3>Which one is it?</h3>
          {state.result.visibleStyleCode ? (
            <div className="notice notice-good">
              <strong>
                Style code read off the tag: {state.result.visibleStyleCode}
              </strong>
              That's the shoe's fingerprint — it beats a guess from the
              silhouette.
            </div>
          ) : null}

          <div className="stack" style={{ marginTop: "0.8rem" }}>
            {candidates.map((c, i) => (
              <button
                key={`${c.brand}-${c.model}-${i}`}
                type="button"
                className={`candidate ${picked === i ? "pick" : ""}`}
                onClick={() => applyCandidate(i)}
                style={{ textAlign: "left", cursor: "pointer", font: "inherit" }}
              >
                <div className="spread">
                  <strong>
                    {[c.brand, c.model, c.colorway].filter(Boolean).join(" ")}
                  </strong>
                  <span
                    className={`badge ${
                      c.confidence === "high"
                        ? "badge-good"
                        : c.confidence === "medium"
                          ? "badge-warn"
                          : "badge-bad"
                    }`}
                  >
                    {c.confidence} confidence
                  </span>
                </div>
                <div className="small muted">{c.reasoning}</div>
                {c.styleCode ? (
                  <div className="tiny mono">{c.styleCode}</div>
                ) : null}
              </button>
            ))}
          </div>

          {state.result.conditionNotes ? (
            <div className="notice" style={{ marginTop: "1rem" }}>
              <strong>What the photos show</strong>
              {state.result.conditionNotes}
            </div>
          ) : null}
        </>
      ) : null}

      <h2>2. Confirm and save</h2>
      <p className="muted small">
        Check every field. Pricing the wrong colorway can be off by three times
        the money.
      </p>

      <div className="card">
        <form action={createItemAction}>
          <input
            type="hidden"
            name="photoUrls"
            value={(state.photoUrls ?? []).join(",")}
          />

          <div className="cols-2">
            <div className="field">
              <label htmlFor="brand">Brand</label>
              <input
                id="brand"
                name="brand"
                required
                value={draft.brand}
                onChange={(e) => set("brand", e.target.value)}
                placeholder="Jordan"
              />
            </div>
            <div className="field">
              <label htmlFor="model">Model</label>
              <input
                id="model"
                name="model"
                required
                value={draft.model}
                onChange={(e) => set("model", e.target.value)}
                placeholder="4 Retro"
              />
            </div>
          </div>

          <div className="cols-2">
            <div className="field">
              <label htmlFor="colorway">Colorway</label>
              <input
                id="colorway"
                name="colorway"
                value={draft.colorway}
                onChange={(e) => set("colorway", e.target.value)}
                placeholder="Military Black"
              />
            </div>
            <div className="field">
              <label htmlFor="styleCode">Style code</label>
              <input
                id="styleCode"
                name="styleCode"
                value={draft.styleCode}
                onChange={(e) => set("styleCode", e.target.value)}
                placeholder="DH6927-111"
                className="mono"
              />
              <div className="hint">Inside the tongue and on the box end.</div>
            </div>
          </div>

          <div className="cols-2">
            <div className="field">
              <label htmlFor="nickname">Nickname</label>
              <input
                id="nickname"
                name="nickname"
                value={draft.nickname}
                onChange={(e) => set("nickname", e.target.value)}
                placeholder="Bred, Panda…"
              />
            </div>
            <div className="field">
              <label htmlFor="retail">Original retail</label>
              <input
                id="retail"
                name="retail"
                inputMode="decimal"
                value={draft.retail}
                onChange={(e) => set("retail", e.target.value)}
                placeholder="210"
              />
              <div className="hint">
                Used as a last-resort estimate when there are no comps.
              </div>
            </div>
          </div>

          <hr />

          <div className="cols-2">
            <div className="field">
              <label htmlFor="size">Size</label>
              <input
                id="size"
                name="size"
                required
                inputMode="decimal"
                placeholder="10.5"
              />
            </div>
            <div className="field">
              <label htmlFor="sizeType">Size type</label>
              <select id="sizeType" name="sizeType" defaultValue="M">
                {SIZE_TYPES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="grade">Condition</label>
            <select
              id="grade"
              name="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              {GRADES.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label} — {g.blurb}
                </option>
              ))}
            </select>
            {state.result?.suggestedGrade ? (
              <div className="hint">
                Suggested from your photos. Trust your own eyes over this.
              </div>
            ) : null}
          </div>

          <div className="cols-2">
            <div className="field">
              <label htmlFor="cost">What you paid (or are being asked)</label>
              <input
                id="cost"
                name="cost"
                inputMode="decimal"
                placeholder="23.00"
              />
              <div className="hint">
                Leave at zero if you're still deciding — you can set it on the
                next screen.
              </div>
            </div>
            <div className="field">
              <label htmlFor="acquiredFrom">Where from</label>
              <input
                id="acquiredFrom"
                name="acquiredFrom"
                placeholder="Josh, Whatnot, thrift…"
              />
            </div>
          </div>

          <button className="btn btn-primary btn-block" type="submit">
            Save and price it
          </button>
        </form>
      </div>
    </>
  );
}
