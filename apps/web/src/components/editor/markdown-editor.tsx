"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { EditorSelection, type SelectionRange } from "@codemirror/state";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Link2,
  Code,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Image as ImageIcon,
  Code2,
  Columns2,
  Eye,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { AiToolbar } from "@/components/editor/ai-toolbar";
import { toast } from "sonner";
import {
  ImageEditorDialog,
  type ImageEditorState,
} from "@/components/editor/image-editor-dialog";

type Mode = "edit" | "split" | "preview";

marked.setOptions({ gfm: true, breaks: false });

/**
 * CodeMirror-powered Markdown editor with optional live preview. Source of
 * truth is Markdown text — the backend renders/sanitizes server-side, and we
 * use `marked` + DOMPurify here purely for the live preview pane.
 *
 * The toolbar inserts raw Markdown syntax around the current selection via
 * EditorSelection transactions, preserving undo history.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "# Start writing in Markdown…",
  minHeight = 420,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [mode, setMode] = useState<Mode>("split");
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editorDialog, setEditorDialog] = useState<{
    open: boolean;
    initialState: ImageEditorState;
  } | null>(null);

  const extensions = useMemo(
    () => [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),
      EditorView.lineWrapping,
      // ⌘S / Ctrl+S is handled by the parent form — swallow the default
      // browser Save dialog so autosave can take over if we ever add it.
      keymap.of([
        {
          key: "Mod-s",
          run: () => true,
        },
        {
          key: "Mod-b",
          run: (v: EditorView) => {
            wrap(v, "**", "**");
            return true;
          },
        },
        {
          key: "Mod-i",
          run: (v: EditorView) => {
            wrap(v, "*", "*");
            return true;
          },
        },
        {
          key: "Mod-k",
          run: (v: EditorView) => {
            wrapLink(v);
            return true;
          },
        },
      ]),
    ],
    [],
  );

  const previewHtml = useMemo(() => {
    if (!value) return "";
    const raw = marked.parse(value, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [value]);

  const action = useCallback((fn: (view: EditorView) => void) => {
    const view = editorRef.current?.view;
    if (!view) return;
    fn(view);
    view.focus();
  }, []);

  const handleImageFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/images/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Upload failed (${res.status})`);
        }
        const { filename } = (await res.json()) as { filename: string };

        const img = new window.Image();
        img.src = `/api/images/${filename}`;
        await Promise.race([
          new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => {
              toast.error("Image uploaded but preview failed to load.");
              resolve();
            };
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);

        const displayWidth = Math.min(img.naturalWidth || 600, 600);
        setEditorDialog({
          open: true,
          initialState: {
            filename,
            originalWidth: img.naturalWidth,
            originalHeight: img.naturalHeight,
            width: displayWidth,
            height: img.naturalHeight
              ? Math.round(
                  (img.naturalHeight / (img.naturalWidth || 1)) *
                    displayWidth,
                )
              : 400,
            alt: "",
          },
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Image upload failed",
        );
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const handleImageConfirm = useCallback(
    (state: ImageEditorState) => {
      setEditorDialog(null);
      const escapedAlt = state.alt.replace(/"/g, "&quot;");
      const tag = `<img src="/api/images/${state.filename}" width="${state.width}" alt="${escapedAlt}" />`;
      action((v) => replaceSelection(v, tag));
    },
    [action],
  );

  const handleImageCancel = useCallback(() => {
    setEditorDialog(null);
  }, []);

  return (
    <div
      className="flex flex-col border border-border bg-background"
      style={{ minHeight }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        <ToolbarButton
          label="Bold"
          kbd="⌘B"
          onClick={() => action((v) => wrap(v, "**", "**"))}
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          kbd="⌘I"
          onClick={() => action((v) => wrap(v, "*", "*"))}
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          onClick={() => action((v) => wrap(v, "`", "`"))}
        >
          <Code className="size-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          label="Heading 1"
          onClick={() => action((v) => linePrefix(v, "# "))}
        >
          <Heading1 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          onClick={() => action((v) => linePrefix(v, "## "))}
        >
          <Heading2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          onClick={() => action((v) => linePrefix(v, "### "))}
        >
          <Heading3 className="size-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          label="Bullet list"
          onClick={() => action((v) => linePrefix(v, "- "))}
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          onClick={() => action((v) => linePrefix(v, "1. "))}
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Task list"
          onClick={() => action((v) => linePrefix(v, "- [ ] "))}
        >
          <CheckSquare className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          onClick={() => action((v) => linePrefix(v, "> "))}
        >
          <Quote className="size-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          label="Code block"
          onClick={() => action((v) => insertCodeBlock(v))}
        >
          <Code2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          kbd="⌘K"
          onClick={() => action((v) => wrapLink(v))}
        >
          <Link2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Upload image"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <span className="size-3.5 animate-spin rounded-full border border-current border-t-transparent" />
          ) : (
            <ImageIcon className="size-3.5" />
          )}
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageFileSelected}
        />

        <Divider />
        <AiToolbar value={value} onChange={onChange} />

        {/* Mode switcher pushed to the right */}
        <div className="ml-auto flex items-center gap-0.5 border border-border p-0.5">
          <ModeButton
            active={mode === "edit"}
            onClick={() => setMode("edit")}
            label="Edit"
          >
            <Pencil className="size-3" />
          </ModeButton>
          <ModeButton
            active={mode === "split"}
            onClick={() => setMode("split")}
            label="Split"
          >
            <Columns2 className="size-3" />
          </ModeButton>
          <ModeButton
            active={mode === "preview"}
            onClick={() => setMode("preview")}
            label="Preview"
          >
            <Eye className="size-3" />
          </ModeButton>
        </div>
      </div>

      {/* Editor + preview panes */}
      <div className="flex min-h-0 flex-1 divide-x divide-border">
        {mode !== "preview" && (
          <div
            className={cn(
              "flex min-w-0 flex-col",
              mode === "split" ? "w-1/2" : "w-full",
            )}
          >
            <CodeMirror
              ref={editorRef}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              theme={isDark ? oneDark : "light"}
              extensions={extensions}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                dropCursor: true,
                autocompletion: true,
                bracketMatching: true,
                closeBrackets: true,
              }}
              className="cm-editor-wrap h-full text-[13px]"
              style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
            />
          </div>
        )}

        {mode !== "edit" && (
          <div
            className={cn(
              "min-w-0 overflow-auto bg-muted/10 px-6 py-4",
              mode === "split" ? "w-1/2" : "w-full",
            )}
          >
            {previewHtml ? (
              <div
                className="markdown-body max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <p className="text-xs text-muted-foreground/70">
                Preview will appear here as you type.
              </p>
            )}
          </div>
        )}
      </div>
      {editorDialog && (
        <ImageEditorDialog
          open={editorDialog.open}
          initialState={editorDialog.initialState}
          onConfirm={handleImageConfirm}
          onCancel={handleImageCancel}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  kbd,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  kbd?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={kbd ? `${label} · ${kbd}` : label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="size-7"
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}

function ModeButton({
  children,
  active,
  label,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-6 items-center gap-1 px-2 text-[10px] uppercase tracking-[0.12em] transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ---------- Editor helpers: pure Markdown text manipulation ----------

function wrap(view: EditorView, before: string, after: string) {
  const change = view.state.changeByRange((range: SelectionRange) => {
    const selected = view.state.sliceDoc(range.from, range.to);
    return {
      changes: [
        { from: range.from, insert: before },
        { from: range.to, insert: after },
      ],
      range: EditorSelection.range(
        range.from + before.length,
        range.to + before.length + (selected.length === 0 ? 0 : 0),
      ),
    };
  });
  view.dispatch(change);
}

function wrapLink(view: EditorView) {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to) || "link text";
  const insert = `[${selected}](https://)`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(range.from + insert.length - 1),
  });
}

function replaceSelection(view: EditorView, text: string) {
  const range = view.state.selection.main;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: EditorSelection.cursor(range.from + text.length),
  });
}

function insertCodeBlock(view: EditorView) {
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  const snippet = `\n\`\`\`ts\n${selected || "// your code"}\n\`\`\`\n`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: snippet },
    selection: EditorSelection.cursor(
      range.from + snippet.indexOf("\n```\n") + 1,
    ),
  });
}

/**
 * Toggle/prefix the current line(s) with a Markdown marker like `# `, `- `,
 * or `> `. If every selected line already has the prefix, it's stripped
 * (toggle behaviour). Otherwise it's added to all selected lines.
 */
function linePrefix(view: EditorView, prefix: string) {
  const state = view.state;
  const ranges = state.selection.ranges;
  const changes: { from: number; to: number; insert: string }[] = [];

  for (const range of ranges) {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(range.to);
    let allHavePrefix = true;

    for (let n = startLine.number; n <= endLine.number; n++) {
      const line = state.doc.line(n);
      if (!line.text.startsWith(prefix)) {
        allHavePrefix = false;
        break;
      }
    }

    for (let n = startLine.number; n <= endLine.number; n++) {
      const line = state.doc.line(n);
      if (allHavePrefix) {
        changes.push({
          from: line.from,
          to: line.from + prefix.length,
          insert: "",
        });
      } else if (!line.text.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from, insert: prefix });
      }
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes });
  }
}
