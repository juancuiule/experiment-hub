import { twMerge } from "tailwind-merge";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: Props) {
  return (
    <input
      {...props}
      className={twMerge(
        "border-b border-border py-1 outline-none",
        "bg-transparent w-full placeholder:text-muted-foreground focus:border-primary",
        "transition-colors text-sm",
        props.className,
      )}
    />
  );
}
