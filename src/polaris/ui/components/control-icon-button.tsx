/** src/player/ui/components/control-icon-button.tsx */
'use client';
import * as React from 'react';
import { Button } from '../../../vendor/ui/button';
import { cn } from '../../../vendor/helpers/index';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ariaLabel: string;
  pressed?: boolean;
};

export const ControlIconButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ children, ariaLabel, pressed, className, ...rest }, ref) => {
    return (
      <Button
        ref={ref}
        type="button"
        size="icon"
        variant="secondary"
        aria-label={ariaLabel}
        aria-pressed={pressed}
        className={cn(
          'h-11 w-11 rounded-xl bg-white/10 text-white transition will-change-transform',
          'hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98]',
          className,
        )}
        {...rest} // <- forwards onPointerDown, onMouseDown, etc.
      >
        {children}
      </Button>
    );
  },
);
ControlIconButton.displayName = 'ControlIconButton';
