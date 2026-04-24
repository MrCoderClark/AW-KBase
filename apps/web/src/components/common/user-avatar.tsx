import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  src?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
};

const hues = [
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserAvatar({ name, src, size = "default", className }: Props) {
  const hue = hues[hash(name) % hues.length];
  return (
    <Avatar size={size} className={className} aria-label={name}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        className={cn(
          "font-medium uppercase tracking-wider",
          hue,
          size === "sm" && "text-[9px]",
          size === "default" && "text-[10px]",
          size === "lg" && "text-xs",
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
