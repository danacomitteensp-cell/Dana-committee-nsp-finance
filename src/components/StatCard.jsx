export default function StatCard({ icon: Icon, label, value, trend, color = 'primary' }) {
  const colorMap = {
    primary: {
      bg: 'bg-primary-50',
      icon: 'bg-primary-200 text-primary-900',
      text: 'text-primary-900',
    },
    green: {
      bg: 'bg-emerald-50',
      icon: 'bg-emerald-100 text-emerald-700',
      text: 'text-emerald-700',
    },
    red: {
      bg: 'bg-red-50',
      icon: 'bg-red-100 text-red-600',
      text: 'text-red-600',
    },
    blue: {
      bg: 'bg-sky-50',
      icon: 'bg-sky-100 text-sky-700',
      text: 'text-sky-700',
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'bg-amber-100 text-amber-700',
      text: 'text-amber-700',
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'bg-purple-100 text-purple-700',
      text: 'text-purple-700',
    },
  }

  const c = colorMap[color] || colorMap.primary

  return (
    <div className="card-hover bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100/80">
      <div className="flex items-start justify-between">
        <div className="space-y-2 md:space-y-3 min-w-0 flex-1">
          <p className="text-xs md:text-sm font-medium text-gray-500 truncate">{label}</p>
          <p className={`text-xl md:text-3xl font-bold tracking-tight ${c.text} truncate`}>{value}</p>
          {trend && (
            <p className="text-xs text-gray-400 truncate">{trend}</p>
          )}
        </div>
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${c.icon} flex items-center justify-center shadow-sm shrink-0 ml-3`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
      </div>
    </div>
  )
}
