'use client';

import { cn } from '../helpers/cn';
import { Button } from './button';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

export type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: 'horizontal' | 'vertical';

  setApi?: (api: CarouselApi) => void;

  autoPlayInterval?: number;
  autoPlayCount?: number;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

export function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error('useCarousel must be used within a <Carousel />');
  }

  return context;
}

const Carousel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & CarouselProps>(
  (
    {
      orientation = 'horizontal',
      opts,
      setApi,
      plugins,
      className,
      children,
      autoPlayInterval,
      autoPlayCount = 1,
      ...props
    },
    ref,
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === 'horizontal' ? 'x' : 'y',
      },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return;
      }

      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev();
    }, [api]);

    const scrollNext = React.useCallback(() => {
      api?.scrollNext();
    }, [api]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (!api || !setApi) {
        return;
      }

      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) {
        return;
      }

      onSelect(api);
      api.on('reInit', onSelect);
      api.on('select', onSelect);

      return () => {
        api?.off('select', onSelect);
      };
    }, [api, onSelect]);

    // === AUTOPLAY EFFECT ===
    React.useEffect(() => {
      if (!api || !autoPlayInterval) return;

      // helper to jump forward N slides
      const scrollMultiple = () => {
        const selected = api.selectedScrollSnap();
        const count = api.scrollSnapList().length;
        // calculate next index, wrapping around
        const next = (selected + autoPlayCount) % count;
        api.scrollTo(next);
      };

      const timer = window.setInterval(scrollMultiple, autoPlayInterval);
      return () => window.clearInterval(timer);
    }, [api, autoPlayInterval, autoPlayCount]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api,
          opts,
          orientation: orientation || (opts?.axis === 'y' ? 'vertical' : 'horizontal'),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn('relative', className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);
Carousel.displayName = 'Carousel';

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();

    return (
      <div ref={carouselRef} className="carousel-content overflow-hidden">
        <div
          ref={ref}
          className={cn('flex', orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col', className)}
          {...props}
        />
      </div>
    );
  },
);
CarouselContent.displayName = 'CarouselContent';

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel();

    return (
      <div
        ref={ref}
        role="group"
        aria-roledescription="slide"
        className={cn('min-w-0 shrink-0 grow-0 basis-full', orientation === 'horizontal' ? 'pl-4' : 'pt-4', className)}
        {...props}
      />
    );
  },
);
CarouselItem.displayName = 'CarouselItem';

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button> & { isSmall?: boolean }>(
  ({ className, variant = 'none', size = 'icon', isSmall, ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          'absolute',
          orientation === 'horizontal'
            ? 'to-background/85 hover:to-background top-0 bottom-0 left-0 h-auto w-auto rounded-none border-none bg-linear-to-l from-transparent p-1 hover:backdrop-blur-xs'
            : '-top-12 left-1/2 -translate-x-1/2 rotate-90',

          !canScrollNext ? 'pointer-events-none cursor-default opacity-40 saturate-0' : 'cursor-pointer!',
          isSmall
            ? 'top-1/2 right-auto !h-14 !w-5 -translate-y-1/2 rounded-l-lg bg-white/50 bg-none p-0 shadow-md backdrop-blur-2xl'
            : '',
          className,
        )}
        disabled={!canScrollNext}
        onClick={scrollNext}
        {...props}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous slide</span>
      </Button>
    );
  },
);
CarouselNext.displayName = 'CarouselNext';

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { isSmall?: boolean }
>(({ className, variant = 'none', size = 'icon', isSmall, ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel();

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        'absolute',
        orientation === 'horizontal'
          ? 'to-background/85 hover:to-background top-0 right-0 bottom-0 h-auto w-auto rounded-none border-none bg-linear-to-r from-transparent p-1 hover:backdrop-blur-xs'
          : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',

        /* ↓ Replace the old `hidden` with graceful-disabled styles ↓ */
        !canScrollPrev ? 'pointer-events-none cursor-default opacity-40 saturate-0' : 'cursor-pointer!',
        isSmall
          ? 'top-1/2 left-auto !h-14 !w-5 -translate-y-1/2 rounded-r-lg bg-white/50 bg-none p-0 shadow-md backdrop-blur-2xl'
          : '',
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ChevronRight className="h-4 w-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  );
});

CarouselPrevious.displayName = 'CarouselPrevious';

export { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi };
