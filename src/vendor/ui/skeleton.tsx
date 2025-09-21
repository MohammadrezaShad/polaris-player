import { cn } from '../helpers/cn';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-background-alt animate-pulse rounded-md', className)} {...props} />;
}

export { Skeleton };
