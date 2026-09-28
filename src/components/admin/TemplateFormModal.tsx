"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Button, Input, FormField, Alert } from "@/components/ui";
import type { ApiJson } from "@/types/api";

type TemplateType = "DOCUMENT" | "SURVEY";

interface SurveyQuestion {
  id: string;
  text: string;
}

interface TemplateFormModalProps {
  initial?: {
    id: string;
    title: string;
    templateType: TemplateType;
    showPatientDetails: boolean;
    content: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-surface-brand-subtle text-text-brand"
          : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function parseInitialQuestions(content: string): SurveyQuestion[] {
  try {
    const parsed = JSON.parse(content) as { questions?: SurveyQuestion[] };
    return Array.isArray(parsed.questions) ? parsed.questions : [];
  } catch {
    return [];
  }
}

export default function TemplateFormModal({ initial, onClose, onSaved }: TemplateFormModalProps) {
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [templateType, setTemplateType] = useState<TemplateType>(initial?.templateType ?? "DOCUMENT");
  const [showPatientDetails, setShowPatientDetails] = useState(initial?.showPatientDetails ?? false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    initial?.templateType === "SURVEY" ? parseInitialQuestions(initial.content) : []
  );
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const isSurvey = templateType === "SURVEY";

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Enter document content…" }),
      TextStyle,
      Color,
    ],
    content: initial?.templateType === "DOCUMENT" ? (initial?.content ?? "") : "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[180px] px-3 py-2 text-sm text-text-primary focus:outline-none",
      },
    },
  });

  function addQuestion() {
    setQuestions((prev) => [...prev, { id: crypto.randomUUID(), text: "" }]);
  }

  function updateQuestion(id: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, text } : q)));
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const next = [...questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      let content: string;
      if (isSurvey) {
        const filled = questions.filter((q) => q.text.trim());
        if (filled.length === 0) {
          setState({ status: "error", message: "Add at least one question to the survey." });
          return;
        }
        content = JSON.stringify({ questions: filled.map((q) => ({ id: q.id, text: q.text.trim() })) });
      } else {
        if (!editor) return;
        content = editor.getHTML();
      }

      setState({ status: "loading" });

      const url = isEdit ? `/api/printable-templates/${initial.id}` : "/api/printable-templates";
      const method = isEdit ? "PATCH" : "POST";

      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), templateType, showPatientDetails, content }),
        });
        const data = (await res.json()) as ApiJson;

        if (!res.ok) {
          setState({ status: "error", message: data.error ?? "Failed to save template." });
          return;
        }

        onSaved();
        onClose();
      } catch {
        setState({ status: "error", message: "Network error. Please try again." });
      }
    },
    [editor, isSurvey, questions, isEdit, initial, title, templateType, showPatientDetails, onSaved, onClose]
  );

  const loading = state.status === "loading";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-lg border border-border-primary bg-surface-primary shadow-lg"
           style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">
            {isEdit ? "Edit Document" : "New Document"}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-hint hover:bg-surface-secondary hover:text-text-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {state.status === "error" && <Alert variant="error">{state.message}</Alert>}

            <FormField label="Document Title" htmlFor="tmpl-title">
              <Input
                id="tmpl-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder={isSurvey ? "e.g. Medical History Screening" : "e.g. Post-Treatment Instructions"}
                disabled={loading}
              />
            </FormField>

            {/* Document type — only shown when creating */}
            {!isEdit && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-text-primary">Document Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "DOCUMENT", label: "Document", desc: "Free-form text with rich formatting" },
                      { value: "SURVEY", label: "Survey / Screening", desc: "Yes / No questions for patients to fill" },
                    ] as { value: TemplateType; label: string; desc: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTemplateType(opt.value)}
                      disabled={loading}
                      className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
                        templateType === opt.value
                          ? "border-brand-500 bg-surface-brand-subtle"
                          : "border-border-primary hover:border-border-secondary"
                      }`}
                    >
                      <p className={`text-sm font-medium ${templateType === opt.value ? "text-text-brand" : "text-text-primary"}`}>
                        {opt.label}
                      </p>
                      <p className="mt-0.5 text-xs text-text-hint">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Patient details toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border-primary px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Include Patient Details</p>
                <p className="text-xs text-text-hint">
                  Shows patient name, ID, age/sex at the top when printing.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showPatientDetails}
                onClick={() => setShowPatientDetails((v) => !v)}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                  showPatientDetails ? "bg-brand-600" : "bg-surface-tertiary"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    showPatientDetails ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Survey question builder */}
            {isSurvey ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-text-primary">
                    Questions
                  </label>
                  <span className="text-xs text-text-hint">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="space-y-2">
                  {questions.map((q, i) => (
                    <div key={q.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs text-text-hint">{i + 1}.</span>
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuestion(q.id, e.target.value)}
                        placeholder="Enter question…"
                        maxLength={400}
                        disabled={loading}
                        className="flex-1 rounded-md border border-border-primary bg-surface-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-hint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                      />
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveQuestion(i, -1)}
                          disabled={i === 0 || loading}
                          className="rounded p-0.5 text-text-hint hover:bg-surface-secondary hover:text-text-primary disabled:opacity-30"
                          title="Move up"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveQuestion(i, 1)}
                          disabled={i === questions.length - 1 || loading}
                          className="rounded p-0.5 text-text-hint hover:bg-surface-secondary hover:text-text-primary disabled:opacity-30"
                          title="Move down"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        disabled={loading}
                        className="shrink-0 rounded p-1 text-text-hint hover:bg-surface-error/10 hover:text-text-error disabled:opacity-50"
                        title="Remove question"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addQuestion}
                  disabled={loading}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-primary py-2 text-sm text-text-hint hover:border-brand-400 hover:text-text-brand disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Question
                </button>
              </div>
            ) : (
              /* Rich text editor */
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Content
                </label>

                {/* Toolbar */}
                <div className="flex flex-wrap gap-0.5 rounded-t-md border border-b-0 border-border-primary bg-surface-secondary px-2 py-1.5">
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    active={editor?.isActive("bold")}
                    title="Bold"
                  >
                    <strong>B</strong>
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    active={editor?.isActive("italic")}
                    title="Italic"
                  >
                    <em>I</em>
                  </ToolbarButton>
                  <span className="mx-1 w-px bg-border-primary" />
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                    active={editor?.isActive("heading", { level: 3 })}
                    title="Heading"
                  >
                    H3
                  </ToolbarButton>
                  <span className="mx-1 w-px bg-border-primary" />
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    active={editor?.isActive("bulletList")}
                    title="Bullet list"
                  >
                    • List
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                    active={editor?.isActive("orderedList")}
                    title="Numbered list"
                  >
                    1. List
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                    active={editor?.isActive("blockquote")}
                    title="Callout / Blockquote"
                  >
                    ❝
                  </ToolbarButton>
                  <span className="mx-1 w-px bg-border-primary" />
                  <ToolbarButton
                    onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                    title="Divider"
                  >
                    ─
                  </ToolbarButton>
                  <span className="mx-1 w-px bg-border-primary" />
                  {[
                    { color: "#0f0f24", title: "Black" },
                    { color: "#1D4ED8", title: "Blue" },
                    { color: "#B91C1C", title: "Red" },
                    { color: "#047857", title: "Green" },
                    { color: "#B45309", title: "Amber" },
                    { color: "#6D28D9", title: "Purple" },
                  ].map(({ color, title }) => (
                    <button
                      key={color}
                      type="button"
                      title={`Text color: ${title}`}
                      onClick={() => editor?.chain().focus().setColor(color).run()}
                      className={`h-5 w-5 rounded-sm border transition-all ${
                        editor?.isActive("textStyle", { color }) ? "border-2 border-neutral-800 scale-110" : "border-border-primary hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button
                    type="button"
                    title="Remove color"
                    onClick={() => editor?.chain().focus().unsetColor().run()}
                    className="rounded px-1.5 py-0.5 text-xs text-text-hint hover:bg-surface-secondary hover:text-text-secondary"
                  >
                    ✕
                  </button>
                </div>

                {/* Editor area */}
                <div className="rounded-b-md border border-border-primary bg-white">
                  <EditorContent editor={editor} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 border-t border-border-primary px-5 py-4">
            <Button type="submit" size="sm" disabled={loading} loading={loading} loadingText="Saving…">
              {isEdit ? "Save Changes" : "Create Document"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
