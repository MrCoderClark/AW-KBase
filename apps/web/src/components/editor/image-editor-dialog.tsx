"use client";

import { useState, useCallback } from "react";
import { Lock, Unlock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ImageEditorState = {
  filename: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  alt: string;
};

export type ImageEditorTool = {
  id: string;
  label: string;
  Controls: React.ComponentType<{
    state: ImageEditorState;
    onChange: (patch: Partial<ImageEditorState>) => void;
  }>;
};

function ResizeControls({
  state,
  onChange,
}: {
  state: ImageEditorState;
  onChange: (patch: Partial<ImageEditorState>) => void;
}) {
  const [locked, setLocked] = useState(true);

  const handleWidth = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const w = Math.max(1, parseInt(e.target.value, 10) || 1);
      if (locked && state.originalWidth > 0 && state.originalHeight > 0) {
        const h = Math.round((state.originalHeight / state.originalWidth) * w);
        onChange({ width: w, height: h });
      } else {
        onChange({ width: w });
      }
    },
    [locked, state.originalWidth, state.originalHeight, onChange],
  );

  const handleHeight = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const h = Math.max(1, parseInt(e.target.value, 10) || 1);
      if (locked && state.originalHeight > 0 && state.originalWidth > 0) {
        const w = Math.round((state.originalWidth / state.originalHeight) * h);
        onChange({ height: h, width: w });
      } else {
        onChange({ height: h });
      }
    },
    [locked, state.originalWidth, state.originalHeight, onChange],
  );

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Width
        <Input
          type="number"
          min={1}
          value={state.width}
          onChange={handleWidth}
          className="h-7 w-20 text-xs"
        />
        px
      </label>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
        aria-label={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
        onClick={() => setLocked((l) => !l)}
        className="size-7"
      >
        {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
      </Button>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Height
        <Input
          type="number"
          min={1}
          value={state.height}
          onChange={handleHeight}
          className="h-7 w-20 text-xs"
        />
        px
      </label>
    </div>
  );
}

export const ResizeTool: ImageEditorTool = {
  id: "resize",
  label: "Resize",
  Controls: ResizeControls,
};

type Props = {
  open: boolean;
  initialState: ImageEditorState;
  tools?: ImageEditorTool[];
  onConfirm: (state: ImageEditorState) => void;
  onCancel: () => void;
};

const DEFAULT_TOOLS: ImageEditorTool[] = [ResizeTool];

export function ImageEditorDialog({
  open,
  initialState,
  tools = DEFAULT_TOOLS,
  onConfirm,
  onCancel,
}: Props) {
  const [state, setState] = useState<ImageEditorState>(initialState);
  // Note: initialState must be a stable reference from parent component.
  // It should only change when a new image is uploaded, not on every re-render.

  const handleChange = useCallback((patch: Partial<ImageEditorState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const previewSrc = `/api/images/${state.filename}`;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Edit image</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="flex items-center justify-center rounded border border-border bg-muted/20 p-4" style={{ minHeight: 200 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt={state.alt}
            style={{
              maxWidth: 560,
              maxHeight: 360,
              width: "auto",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          {tools.map((tool) => (
            <div key={tool.id}>
              <p className="mb-2 text-xs font-medium text-foreground">
                {tool.label}
              </p>
              <tool.Controls state={state} onChange={handleChange} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <label className="shrink-0 text-xs text-muted-foreground">Alt text</label>
          <Input
            value={state.alt}
            onChange={(e) => handleChange({ alt: e.target.value })}
            placeholder="Describe the image…"
            className="h-7 text-xs"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(state)}>
            Insert image
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
