import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

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
 * @param props - Locale seat for the distribution's product name.
 * @returns the official name wordmark.
 */
export function OfficialBrandName({ t }: PropsLocale<'common'>) {
  const name = t('brand.localBuild')
  return <span aria-label={name}>{name}</span>
}
