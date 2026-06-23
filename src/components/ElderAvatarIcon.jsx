import grandmotherAvatar from "../assets/avatar-grandmother.png";
import grandfatherAvatar from "../assets/avatar-grandfather.png";

export default function ElderAvatarIcon({ gender = "여성", size = "default", className = "" }) {
  const isMale = gender === "남성" || gender === "male";
  const imageSrc = isMale ? grandfatherAvatar : grandmotherAvatar;
  const label = isMale ? "남성 대상자 아바타" : "여성 대상자 아바타";

  const wrapperClass = [
    "elder-avatar-icon",
    isMale ? "elder-avatar-icon-male" : "elder-avatar-icon-female",
    size === "small" ? "elder-avatar-icon-small" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={wrapperClass} aria-label={label}>
      <img src={imageSrc} alt="" />
    </span>
  );
}
