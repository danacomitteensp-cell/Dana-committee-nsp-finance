export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-8 md:p-12 text-center">
      {Icon && <Icon className="w-12 h-12 md:w-16 md:h-16 text-gray-200 mx-auto mb-4" />}
      <p className="text-gray-400 font-medium text-base md:text-lg">{title}</p>
      {description && (
        <p className="text-gray-300 text-sm mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
