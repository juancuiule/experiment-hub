import { StepperConfig } from "@/lib/nodes";

type Props = {
  config: StepperConfig;
  step: number;
  total: number;
};

export default function Stepper({ config, step, total }: Props) {
  return (
    <div className="w-full mb-6">
      {config.label ? (
        <p className="text-sm text-muted-foreground mb-2">
          {config.label
            .replace("{index}", String(step + 1))
            .replace("{total}", String(total))}
        </p>
      ) : null}
      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
        {config.style === "dashed" ? (
          <div className="h-full flex gap-0.5">
            {Array.from({ length: total }, (_, index) => (
              <div
                key={index}
                className={`h-full flex-1 ${index < step + 1 ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
        ) : (
          <div
            className="h-full bg-primary"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
