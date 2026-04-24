"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubmitFeedback, type FeedbackVote } from "@/lib/articles";

type Props = {
  articleId: string;
  slug: string;
  helpful: number;
  notHelpful: number;
};

export function FeedbackBar({ articleId, slug, helpful, notHelpful }: Props) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const submit = useSubmitFeedback(slug);

  const cast = (intent: "up" | "down") => {
    if (submit.isPending || vote !== null) return;
    setVote(intent);
    submit.mutate({
      id: articleId,
      vote: (intent === "up" ? "HELPFUL" : "NOT_HELPFUL") satisfies FeedbackVote,
    });
  };

  return (
    <section className="mt-12 border border-border bg-sidebar/30 px-5 py-5">
      <AnimatePresence mode="wait">
        {vote === null ? (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <div className="text-sm font-medium text-foreground">
                Was this article helpful?
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Your feedback directly informs the review queue.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <VoteButton
                intent="up"
                count={helpful}
                disabled={submit.isPending}
                onClick={() => cast("up")}
              />
              <VoteButton
                intent="down"
                count={notHelpful}
                disabled={submit.isPending}
                onClick={() => cast("down")}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="thanks"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-3"
          >
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 14 }}
              className="grid size-7 place-items-center bg-primary text-primary-foreground"
            >
              {submit.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
            </motion.span>
            <div>
              <div className="text-sm font-medium text-foreground">
                {submit.isError
                  ? "Couldn't save that vote"
                  : submit.isPending
                    ? "Recording…"
                    : "Thanks — noted."}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {submit.isError
                  ? "Please try again in a moment."
                  : vote === "up"
                    ? "We\u2019ll keep this article on the happy path."
                    : "We\u2019ll flag this for a reviewer."}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function VoteButton({
  intent,
  count,
  onClick,
  disabled,
}: {
  intent: "up" | "down";
  count: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = intent === "up" ? ThumbsUp : ThumbsDown;
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.94 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex h-8 items-center gap-1.5 border border-border bg-background px-2.5 text-xs text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        intent === "up"
          ? "hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400"
          : "hover:border-rose-500/50 hover:text-rose-600 dark:hover:text-rose-400",
      )}
    >
      <Icon className="size-3.5" />
      <span className="tabular-nums">{count}</span>
    </motion.button>
  );
}
