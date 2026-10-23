// The Fulmen mark: a position (the orb) with funding orbiting it (the ring and its satellite dot).
// The ring passes behind the orb and in front of it, which is what gives the flat icon its depth.
// No letters, no numbers, no lightning.

const SAT_T = (38 * Math.PI) / 180; // where the satellite sits on the ring

export function LogoGlyph({
  className,
  bg = "#0b1d5e",
  satellite = "#5b95ff",
}: {
  className?: string;
  /** Colour behind the glyph; the front half of the ring is cut out of the orb with it. */
  bg?: string;
  satellite?: string;
}) {
  const rx = 12.2;
  const ry = 4.7;
  const sx = 16 + rx * Math.cos(SAT_T);
  const sy = 16 + ry * Math.sin(SAT_T);
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <g transform="rotate(-28 16 16)">
        {/* back half of the ring */}
        <path d={`M${16 - rx} 16A${rx} ${ry} 0 0 1 ${16 + rx} 16`} stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" opacity="0.55" />
        {/* the orb */}
        <circle cx="16" cy="16" r="6.4" fill="currentColor" />
        {/* front half of the ring, with a cut-out so it reads as passing in front */}
        <path d={`M${16 - rx} 16A${rx} ${ry} 0 0 0 ${16 + rx} 16`} stroke={bg} strokeWidth="5.2" strokeLinecap="round" />
        <path d={`M${16 - rx} 16A${rx} ${ry} 0 0 0 ${16 + rx} 16`} stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
        <circle cx={sx} cy={sy} r="2.1" fill={satellite} stroke={bg} strokeWidth="1.2" />
      </g>
    </svg>
  );
}

/** The mark on a rounded navy tile, used as the app and site logo. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-xl bg-[#0b1d5e] text-white ${className}`} aria-hidden>
      <LogoGlyph className="h-[78%] w-[78%]" />
    </span>
  );
}
