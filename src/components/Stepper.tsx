import { StepperConfig } from "@/lib/nodes";

type Props = {
  config: StepperConfig;
  step: number;
  total: number;
};

export default function Stepper(props: Props) {
  const { config, step, total } = props;
  return (
    <div className="w-full mb-6">
      {config.label ? (
        <p className="text-sm text-content-secondary mb-2">
          {config.label
            .replace("{index}", String(step + 1))
            .replace("{total}", String(total))}
        </p>
      ) : null}
      <div className="h-1 w-full bg-foreground rounded-full overflow-hidden">
        {config.style === "dashed" ? (
          <div className="h-full flex gap-2">
            {Array.from({ length: total }, (_, index) => (
              <div
                key={index}
                className={`h-full flex-1 ${index < step + 1 ? "bg-content-active" : "bg-foreground"}`}
              />
            ))}
          </div>
        ) : (
          <div
            className="h-full bg-content-active"
            style={{
              width: `${((step + 1) / total) * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
