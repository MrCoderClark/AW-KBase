"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export type AiAction = "draft" | "expand" | "simplify" | "steps" | "troubleshoot";

export function useAiAction(onChange: (value: string) => void) {
  const [activeAction, setActiveAction] = useState<AiAction | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const previousContentRef = useRef<string>("");

  const run = useCallback(
    async (action: AiAction, content: string, currentValue: string) => {
      previousContentRef.current = currentValue;
      setActiveAction(action);
      setCanUndo(false);

      try {
        const res = await fetch(`/api/ai/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          onChange(accumulated);
        }

        setCanUndo(true);
      } catch {
        toast.error("AI action failed. Is Ollama running?");
        onChange(previousContentRef.current);
      } finally {
        setActiveAction(null);
      }
    },
    [onChange],
  );

  const undo = useCallback(() => {
    onChange(previousContentRef.current);
    setCanUndo(false);
  }, [onChange]);

  return { run, undo, activeAction, canUndo };
}
