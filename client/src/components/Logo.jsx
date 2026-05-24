// Refined CW monogram. Two interlocked serif letters on a dark plate,
// underlined with a hairline gold stroke. Reads as a private-wealth crest
// rather than an app logo.

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
        {/* Plate */}
        <rect width="64" height="64" rx="8" fill="#0B1220" />
        <rect
          x="0.5" y="0.5" width="63" height="63" rx="8"
          fill="none" stroke="#C9A961" strokeOpacity="0.35"
        />

        {/* C — back letter, slightly larger */}
        <text
          x="14" y="46"
          fontFamily="Cormorant Garamond, Playfair Display, Georgia, serif"
          fontSize="44" fontWeight="600"
          fill="#C9A961"
          letterSpacing="-2"
        >C</text>

        {/* W — front letter, dimmer gold, smaller */}
        <text
          x="28" y="48"
          fontFamily="Cormorant Garamond, Playfair Display, Georgia, serif"
          fontSize="36" fontWeight="500"
          fill="#9C8348"
          letterSpacing="-1.5"
          opacity="0.95"
        >W</text>

        {/* Hairline underline — the crest's signature stroke */}
        <line
          x1="14" y1="54" x2="50" y2="54"
          stroke="#C9A961" strokeOpacity="0.5" strokeWidth="0.5"
        />
      </svg>
      {withWordmark && (
        <span className="font-serif text-2xl tracking-tight text-ink">
          Commonwealth
        </span>
      )}
    </div>
  );
}
