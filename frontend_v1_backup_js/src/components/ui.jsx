// Small shared UI primitives used across pages - kept in one file since
// they're all a few lines each and this is a single-developer portfolio app.

export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium px-3.5 py-2 ' +
    'transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1'
  const variants = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-md',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Card({ className = '', children }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-shadow duration-200 ${className}`}>
      {children}
    </div>
  )
}

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

/** Centered spinner + optional label, for a whole page/section's initial load. */
export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400 animate-fade-in">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

/** Shimmering placeholder bar for skeleton loading states. */
export function SkeletonLine({ className = 'h-4 w-full' }) {
  return <div className={`skeleton rounded-md ${className}`} />
}

export function Alert({ kind = 'info', children, onDismiss, className = '' }) {
  const styles = {
    info: 'bg-brand-50 text-brand-800 border-brand-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
  }
  return (
    <div className={`animate-fade-in-up rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${styles[kind]} ${className}`}>
      <div className="flex-1 whitespace-pre-wrap">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-current opacity-60 hover:opacity-100 transition-opacity duration-150"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-100 text-brand-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 ${props.className || ''}`}
    />
  )
}

export function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 ${props.className || ''}`}
    />
  )
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        className="rounded border-slate-300 text-brand-600 transition-transform duration-150 active:scale-90 focus:ring-brand-400"
        {...props}
      />
      {label}
    </label>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 animate-backdrop-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="animate-scale-in bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors duration-150">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
