"use client";

import { MatchQuestionResult, QuestionMeta } from "@/lib/api";

export function QuestionPicker({
  questions,
  questionId,
  freeText,
  onChange,
  matchStatus,
  validationError,
}: {
  questions: QuestionMeta[];
  questionId: string;
  freeText: string;
  onChange: (next: { questionId: string; freeText: string }) => void;
  matchStatus?: { level: MatchQuestionResult["match_level"] | "checking"; label?: string | null };
  validationError?: string;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
          Curated policy question
        </span>
        <select
          value={questionId}
          onChange={(e) => onChange({ questionId: e.target.value, freeText: "" })}
          className="mt-2 w-full rounded-xl border border-[color:var(--color-border-hi)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] focus:border-[color:var(--color-cyan)] focus:outline-none"
        >
          <option value="">Pick one</option>
          {questions.map((q) => (
            <option key={q.question_id} value={q.question_id}>
              {q.question_label}
            </option>
          ))}
        </select>
      </label>

      <div className="text-center text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
        or
      </div>

      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
          Ask your own (free text)
        </span>
        <textarea
          rows={3}
          placeholder="e.g. Should the federal government do more about climate change?"
          value={freeText}
          onChange={(e) => onChange({ questionId: "", freeText: e.target.value })}
          className="mt-2 w-full resize-none rounded-xl border border-[color:var(--color-border-hi)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] focus:border-[color:var(--color-cyan)] focus:outline-none"
        />
      </label>

      {/* Validation error */}
      {freeText && !questionId && validationError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2 text-xs text-red-400">
          <span className="mt-px shrink-0">✕</span>
          <span>{validationError}</span>
        </div>
      )}

      {/* Match status (only shown when no validation error) */}
      {freeText && !questionId && !validationError && matchStatus && (
        <>
          {matchStatus.level === "checking" && (
            <p className="text-xs text-[color:var(--color-text-faint)] animate-pulse">
              Checking for a survey prior…
            </p>
          )}
          {matchStatus.level === "close" && matchStatus.label && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-400">
              <span className="mt-px shrink-0">✓</span>
              <span>
                <strong className="font-semibold">Close match found.</strong> Agents will be grounded
                with empirical priors from: <em>&ldquo;{matchStatus.label}&rdquo;</em>
              </span>
            </div>
          )}
          {matchStatus.level === "weak" && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-400">
              <span className="mt-px shrink-0">⚠</span>
              <span>
                <strong className="font-semibold">Weak match.</strong> Priors may be imprecise.
              </span>
            </div>
          )}
          {matchStatus.level === "none" && (
            <div className="flex items-start gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 px-3 py-2 text-xs text-[color:var(--color-text-dim)]">
              <span className="mt-px shrink-0">○</span>
              <span>
                No ATP survey question closely matches this topic. Pick a response scale below before running.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
