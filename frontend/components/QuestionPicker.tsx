"use client";

import { QuestionMeta } from "@/lib/api";

export function QuestionPicker({
  questions,
  questionId,
  freeText,
  onChange,
}: {
  questions: QuestionMeta[];
  questionId: string;
  freeText: string;
  onChange: (next: { questionId: string; freeText: string }) => void;
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
          <option value="">— pick one —</option>
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
        <span className="mt-1 block text-xs text-[color:var(--color-text-faint)]">
          Free-text questions are matched to the nearest curated question for prior lookup.
        </span>
      </label>
    </div>
  );
}
