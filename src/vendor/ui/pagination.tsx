import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { ButtonProps, buttonVariants } from './button';
import Link from 'next/link';
import { cn } from '../helpers/cn';

const Pagination = React.forwardRef<HTMLElement, React.ComponentProps<'nav'>>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    role="navigation"
    aria-label="pagination"
    className={cn('flex justify-center', className)}
    {...props}
  />
));
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
  ),
);
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
  size?: ButtonProps['size'];
} & React.ComponentPropsWithoutRef<typeof Link>;

const PaginationLink = React.forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  ({ className, isActive, size = 'icon', ...props }, ref) => (
    <Link
      ref={ref}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'max-sm:h-8 max-sm:w-8',
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        className,
      )}
      {...props}
    />
  ),
);
PaginationLink.displayName = 'PaginationLink';

interface PaginationPrevProps extends PaginationLinkProps {
  isDisabled?: boolean;
}

const PaginationPrevious = React.forwardRef<HTMLAnchorElement, PaginationPrevProps>(
  ({ className, isDisabled, ...props }, ref) => {
    if (isDisabled) {
      return (
        <span
          ref={ref}
          className={cn(
            'bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md border-none px-3 text-sm font-medium whitespace-nowrap shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50',
            'cursor-not-allowed gap-1 pr-2.5 opacity-50 max-sm:pr-0',
            className,
          )}
          aria-disabled="true"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="max-sm:hidden">قبلی</span>
        </span>
      );
    }

    return (
      <PaginationLink
        ref={ref}
        aria-label="Go to previous page"
        size="default"
        className={cn('gap-1 pl-2.5 max-sm:pl-0', className)}
        {...props}
      >
        <ChevronRight className="h-4 w-4" />
        <span className="max-sm:hidden">قبلی</span>
      </PaginationLink>
    );
  },
);
PaginationPrevious.displayName = 'PaginationPrevious';

interface PaginationNextProps extends PaginationLinkProps {
  isDisabled?: boolean;
}

const PaginationNext = React.forwardRef<HTMLAnchorElement, PaginationNextProps>(
  ({ className, isDisabled, ...props }, ref) => {
    if (isDisabled) {
      return (
        <span
          ref={ref}
          className={cn(
            'bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md border-none px-3 text-sm font-medium whitespace-nowrap shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50',
            'cursor-not-allowed gap-1 pr-2.5 opacity-50 max-sm:pr-0',
            className,
          )}
          aria-disabled="true"
        >
          <span className="max-sm:hidden">بعدی</span>
          <ChevronLeft className="h-4 w-4" />
        </span>
      );
    }

    return (
      <PaginationLink
        ref={ref}
        aria-label="Go to next page"
        size="default"
        className={cn('gap-1 pr-2.5 max-sm:pr-0', className)}
        {...props}
      >
        <span className="max-sm:hidden">بعدی</span>
        <ChevronLeft className="h-4 w-4" />
      </PaginationLink>
    );
  },
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = React.forwardRef<HTMLSpanElement, React.ComponentProps<'span'>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} aria-hidden className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}>
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  ),
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
