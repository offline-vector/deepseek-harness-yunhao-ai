import type { IconProps } from './icons/props.ts'

/** Display options for the S1API logo. */
export interface BrandWordmarkProps extends IconProps {
  /** Kept for callers that previously selected the wordmark variant. */
  includeMark?: boolean | undefined
}

/**
 * Render the S1API logo image.
 * @param props.size - square edge in px (default 24).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - retained for API compatibility.
 * @returns the logo image (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: BrandWordmarkProps) {
  return <img width={size} height={size} className={className} src="/favicon.svg" alt="" aria-hidden="true" draggable={false} />
}
