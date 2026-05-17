interface BadgeProps {
  variant: 'pro' | 'free' | 'suspended' | 'active' | 'processing' | 'failed' | 'completed' | 'cancelled';
  children?: React.ReactNode;
  label?: string;
  className?: string;
}

const variantMap: Record<BadgeProps['variant'], string> = {
  pro: 'bg-primary/10 text-primary',
  free: 'bg-secondary-fixed text-secondary',
  suspended: 'bg-error-container text-error',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-50 text-emerald-600',
  processing: 'bg-primary/10 text-primary',
  failed: 'bg-error-container text-error',
  cancelled: 'bg-surface-variant text-on-surface-variant',
};

const labelMap: Record<BadgeProps['variant'], string> = {
  pro: 'Pro',
  free: 'Free',
  suspended: 'Suspended',
  active: 'Active',
  completed: 'Completed',
  processing: 'Processing',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export default function Badge({ variant, children, label, className = '' }: BadgeProps) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${variantMap[variant]} ${className}`}
    >
      {children ?? label ?? labelMap[variant]}
    </span>
  );
}
