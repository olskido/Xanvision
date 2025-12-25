import './TimeTravelFilter.css'

const OPTIONS = [
  { key: '1h', label: '1H' },
  { key: '6h', label: '6H' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
]

export default function TimeTravelFilter({ value, onChange }) {
  return (
    <div className="tw-filter" role="group" aria-label="Time range">
      <div className="tw-filter-label">TIME RANGE</div>
      <div className="tw-filter-sub">Rolling window • affects aggregated + derived only</div>
      <div className="tw-filter-row">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={value === opt.key ? 'tw-filter-btn tw-filter-btn-active' : 'tw-filter-btn'}
            onClick={() => onChange(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
