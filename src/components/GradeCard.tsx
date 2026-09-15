import {
  PART_SCALE,
  overallVerdict,
  partScaleLabel,
  ratedParts,
  type RatingSet,
} from "@/lib/ratings";
import { parseTreatments, treatmentByCode } from "@/lib/constants";

// The grade card, shown to buyers. Its whole job is to answer "why is this
// one $65 when that one's $30" without the buyer having to ask.

function Bar({ score }: { score: number }) {
  return (
    <span className="bar" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`pip ${n <= score ? "on" : ""}`} />
      ))}
    </span>
  );
}

export default function GradeCard({
  ratings,
  overall,
  treatments,
}: {
  ratings: RatingSet;
  overall: number | null | undefined;
  treatments: string | null | undefined;
}) {
  const parts = ratedParts(ratings);
  const done = parseTreatments(treatments);
  const verdict = overallVerdict(overall);

  if (parts.length === 0 && done.length === 0 && overall == null) return null;

  return (
    <div className="gradecard">
      {overall != null ? (
        <div className="gc-head">
          <div className="gc-score">
            <span className="gc-num">{overall}</span>
            <span className="gc-outof">/10</span>
          </div>
          <div>
            <div className="gc-verdict">{verdict.label}</div>
            {verdict.blurb ? (
              <div className="gc-blurb">{verdict.blurb}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {parts.length > 0 ? (
        <div className="gc-parts">
          {parts.map((part) => (
            <div className="gc-part" key={part.key}>
              <span className="gc-part-name">{part.label}</span>
              <Bar score={part.score} />
              <span className="gc-part-word">{partScaleLabel(part.score)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {done.length > 0 ? (
        <div className="gc-process">
          {/* No denominator: several steps are mutually exclusive (you either
              washed it or hand-cleaned it), so "5 of 13" would read as a 38%
              score on your own work rather than a list of what was done. */}
          <div className="gc-process-head">
            What I did to them — {done.length}{" "}
            {done.length === 1 ? "step" : "steps"}
          </div>
          <div className="gc-steps">
            {done.map((code) => (
              <span className="gc-step" key={code}>
                {treatmentByCode(code)?.label ?? code}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="gc-foot">
        Every pair is graded the same way, by the same person, before it goes
        up. That&apos;s the difference between this and a Marketplace post.
      </p>
    </div>
  );
}

/** The 1–5 scale spelled out, for the seller form and the guide. */
export function ScaleLegend() {
  return (
    <ul className="tight small muted" style={{ marginBottom: 0 }}>
      {PART_SCALE.map((s) => (
        <li key={s.score}>
          <strong>
            {s.score} — {s.label}
          </strong>
          : {s.blurb}
        </li>
      ))}
    </ul>
  );
}
