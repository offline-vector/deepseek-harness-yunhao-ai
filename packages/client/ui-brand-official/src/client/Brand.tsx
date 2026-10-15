import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

interface BrandMarkProps extends SidebarBrandMarkOwnerProps {
  /** Host class preserving the conversation hero mark geometry. */
  readonly className?: string | undefined
}

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official whale mark.
 */
export function OfficialBrandMark({ size, className }: BrandMarkProps) {
  return <img src="/favicon.svg" width={size} height={size} className={className} alt="" aria-hidden="true" draggable={false} />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @returns the official name wordmark.
 */
export function OfficialBrandName() {
  return <span aria-label="韵浩 AI">韵浩 AI</span>
}
