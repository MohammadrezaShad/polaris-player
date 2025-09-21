import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../helpers/cn';

const badgeVariants = cva(
  'inline-flex items-center font-medium rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-foreground-alt text-foreground-alt-foreground hover:bg-foreground-alt/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-stroke-alt ',
        foreground: 'bg-foreground text-foreground-extra hover:bg-foreground/90',
        background: 'bg-background-alt border-none text-background-foreground hover:bg-background-alt/80',
        white:
          'dark:bg-foreground/90 dark:text-foreground-extra bg-background-alt text-background-foreground hover:bg-background-alt/80 dark:hover:bg-foreground/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
