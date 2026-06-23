import logoSymbol from "../assets/happytong-logo.png";

export default function BrandLogo({ showText = true, size = "default", className = "" }) {
  return (
    <span className={`brand-logo brand-logo-${size} ${className}`.trim()}>
      <span className="brand-logo-symbol" aria-hidden="true">
        <img src={logoSymbol} alt="" />
      </span>
      {showText ? <span className="brand-logo-text">해피통서비스</span> : null}
    </span>
  );
}
