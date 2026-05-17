interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changePositive?: boolean;
  icon: string;
  iconBg?: string;
  iconColor?: string;
  dark?: boolean;
  sparkline?: number[];
  sparklineColor?: string;
  subtitle?: string;
}

export default function StatCard({
  title,
  value,
  change,
  changePositive,
  icon,
  iconBg = 'bg-primary/10',
  iconColor = 'text-primary',
  dark = false,
  sparkline = [40, 60, 50, 80, 70, 95],
  sparklineColor = 'bg-primary',
  subtitle,
}: StatCardProps) {
  const isPositive = changePositive ?? (change ? !change.startsWith('-') : true);

  if (dark) {
    return (
      <div className="bg-[#2f3038] p-6 rounded-2xl shadow-xl card-hover cursor-default select-none">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-primary/20 rounded-xl text-[#dfe0ff]">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{icon}</span>
          </div>
          {change && (
            <span className="bg-primary/20 text-[#dfe0ff] text-[10px] font-bold px-2 py-1 rounded-full">
              {change}
            </span>
          )}
        </div>
        <p className="text-[#757686] text-[12px] font-medium uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-[32px] leading-10 tracking-tight font-bold text-white">{value}</h3>
        {subtitle && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] text-[#757686]">{subtitle}</span>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#dfe0ff] w-[85%]" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl soft-shadow card-hover border border-white/80 cursor-default select-none">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 ${iconBg} rounded-xl ${iconColor}`}>
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{icon}</span>
        </div>
        {change && (
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded-full ${
              isPositive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {change}
          </span>
        )}
      </div>
      <p className="text-outline text-[12px] font-medium uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-[32px] leading-10 tracking-tight font-bold text-on-surface">{value}</h3>
      {sparkline && (
        <div className="mt-4 h-8 w-full flex items-end gap-0.5 px-1">
          {sparkline.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-sm ${i === sparkline.length - 1 ? sparklineColor : `${sparklineColor}/40`}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
