"use client";

import { useState } from "react";
import { Wand2, AlignLeft, Minimize2, ListOrdered, Wrench, Undo2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAiAction, type AiAction } from "@/hooks/use-ai-action";

const ACTIONS: { id: AiAction; label: string; icon: React.ElementType }[] = [
  { id: "draft", label: "Draft", icon: Wand2 },
  { id: "expand", label: "Expand", icon: AlignLeft },
  { id: "simplify", label: "Simplify", icon: Minimize2 },
  { id: "steps", label: "Steps", icon: ListOrdered },
  { id: "troubleshoot", label: "Troubleshoot", icon: Wrench },
];

export function AiToolbar({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { run, undo, activeAction, canUndo } = useAiAction(onChange);
  const [draftOpen, setDraftOpen] = useState(false);
  const [topic, setTopic] = useState("");

  function handleAction(action: AiAction) {
    if (action === "draft") {
      setTopic("");
      setDraftOpen(true);
      return;
    }
    run(action, value, value);
  }

  function handleDraftSubmit() {
    if (!topic.trim()) return;
    setDraftOpen(false);
    run("draft", topic.trim(), value);
  }

  const isStreaming = activeAction !== null;

  return (
    <>
      <div className="flex items-center gap-0.5">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="xs"
            disabled={isStreaming}
            aria-busy={activeAction === id}
            title={label}
            onClick={() => handleAction(id)}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            {activeAction === id ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Icon className="size-3" />
            )}
            <span className="hidden text-[10px] uppercase tracking-[0.1em] sm:inline">
              {label}
            </span>
          </Button>
        ))}

        {canUndo && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={undo}
            title="Undo AI change"
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="size-3" />
            <span className="hidden text-[10px] uppercase tracking-[0.1em] sm:inline">
              Undo
            </span>
          </Button>
        )}
      </div>

      <AlertDialog open={draftOpen} onOpenChange={setDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Draft a new article</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            autoFocus
            placeholder="e.g. Installing OpenVPN on Windows 11"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDraftSubmit();
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!topic.trim()} onClick={handleDraftSubmit}>
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
