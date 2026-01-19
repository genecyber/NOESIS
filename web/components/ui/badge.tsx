'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emblem-primary focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-emblem-primary text-white',
        secondary:
          'border-transparent bg-emblem-surface-2 text-emblem-text',
        destructive:
          'border-transparent bg-emblem-danger text-white',
        outline:
          'border-emblem-primary/50 text-emblem-text',
        success:
          'border-transparent bg-emblem-accent/20 text-emblem-accent',
        warning:
          'border-transparent bg-emblem-warning/20 text-emblem-warning',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
