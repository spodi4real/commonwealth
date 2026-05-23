export function Logo({ size = 40, withWordmark = false, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        role="img"
        aria-label="Commonwealth"
      >
        <rect width="64" height="64" rx="10" fill="#0B1220" />
        <rect x="0.5" y="0.5" width="63" height="63" rx="10"
              fill="none" stroke="#C9A961" strokeOpacity="0.35" />
        <text
          x="32" y="44" textAnchor="middle"
          fontFamily="Cormorant Garamond, Georgia, serif"
          fontSize="34" fontWeight="600" fill="#C9A961"
          letterSpacing="-1"
        >CW</text>
      </svg>
      {withWordmark && (
        <span className="font-serif text-2xl tracking-tight text-ink">
          Commonwealth
        </span>
      )}
    </div>
  );
}
