import { twMerge } from "tailwind-merge";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: Props) {
  return (
    <input
      {...props}
      className={twMerge(
        "border-b border-border-default py-1 outline-none",
        "bg-transparent w-full placeholder:text-content-secondary focus:border-content-active",
        "transition-colors text-sm",
      )}
    />
  );
}
