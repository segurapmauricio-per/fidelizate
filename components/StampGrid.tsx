import { cn } from "@/lib/utils";

type StampGridProps = {
  rewardAt: number;
  filledCount: number;
  animateIndex?: number | null;
  primaryColor?: string;
};

export function StampGrid({ rewardAt, filledCount, animateIndex, primaryColor }: StampGridProps) {
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {Array.from({ length: rewardAt }).map((_, index) => {
        const filled = index < filledCount;
        const isAnimating = animateIndex === index;
        return (
          <div
            key={index}
            className={cn(
              "flex aspect-square items-center justify-center rounded-full border-2 text-lg transition-all duration-500",
              filled
                ? "border-gold bg-gradient-to-br from-gold to-gold-dark text-ink shadow-stamp"
                : "border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground/40",
              isAnimating && "scale-125 ring-4 ring-gold/50"
            )}
            style={
              filled && primaryColor
                ? { boxShadow: `0 4px 12px ${primaryColor}33` }
                : undefined
            }
          >
            {filled ? "★" : ""}
          </div>
        );
      })}
    </div>
  );
}
