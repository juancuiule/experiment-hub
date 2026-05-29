import { twMerge } from 'tailwind-merge';

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: Props) {
  return (
    <input
      {...props}
      className={twMerge(
        'border-border-default border-b py-1 outline-none',
        'placeholder:text-content-secondary focus:border-content-active w-full bg-transparent',
        'text-sm transition-[border-color,color] duration-150 ease-out',
      )}
    />
  );
}
