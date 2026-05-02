import logo from '../assets/ministry-logo.png';

export default function MinistryLogo({ compact = false, className = '', showText = true }) {
  const size = compact ? 'h-12 w-12' : 'h-16 w-16';

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div className={`shrink-0 overflow-hidden rounded-[1.2rem] border border-white/20 bg-white/95 p-1 shadow-lg shadow-blue-950/15 ${size}`}>
        <img
          src={logo}
          alt="Ministry of Interior and Municipalities logo"
          className="h-full w-full object-contain"
        />
      </div>

      {showText && (
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase leading-4 tracking-[0.22em] text-current/65">
            Ministry of Interior
          </p>

          <p className={`font-black leading-tight ${compact ? 'text-sm' : 'text-base'}`}>
            Lebanon Complaints System
          </p>
        </div>
      )}
    </div>
  );
}