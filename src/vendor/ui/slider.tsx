'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../helpers/cn';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    bufferedValue?: number;
  }
>(({ className, bufferedValue, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('group relative z-10 flex w-full touch-none items-center select-none', className)}
    {...props}
  >
    <SliderPrimitive.Track className="bg-stroke-alt/30 relative h-[5px] w-full grow cursor-pointer overflow-hidden rounded-full">
      <SliderPrimitive.Range className="bg-primary absolute z-20 h-full" />
      <div className="bg-foreground/20 absolute -z-10 h-full" style={{ width: `${bufferedValue}%` }} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="bg-primary block h-2 w-2 rounded-full opacity-0 transition-all group-hover:opacity-100 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
