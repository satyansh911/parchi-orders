import { renderIcon } from "./icon";

// iOS home-screen icon: 180 px, full bleed (iOS applies its own rounded mask).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderIcon({ size: 180, rounded: false, slipShare: 0.58 });
}
