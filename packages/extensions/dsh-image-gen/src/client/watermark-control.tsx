import { useId, type FC } from 'react'
import type { StudioWatermark, StudioWatermarkCapability } from '../shared.js'

const REASONS = {
  'channel-unconfirmed': { zh: '此渠道尚未确认水印支持，可按接口文档配置对应操作的水印字段。', en: 'Watermark support is unconfirmed. Configure the matching operation using the channel documentation.' },
  'model-unconfirmed': { zh: '当前模型尚未确认水印支持。', en: 'Watermark support is unconfirmed for this model.' },
  'account-unconfirmed': { zh: '此接口的水印参数和账号开通条件尚未确认。', en: 'The watermark parameter and account requirements are unconfirmed for this API.' },
  'edit-format': { zh: '当前图生图请求格式不支持已配置的水印字段。', en: 'The configured watermark field is unavailable in this editing format.' },
  'no-api-control': { zh: '此接口没有已确认的可见水印开关。', en: 'No visible-watermark control has been confirmed for this API.' },
}

/** Keep the control discoverable while clearly distinguishing confirmed and unknown contracts. */
export const WatermarkControl: FC<{
  capability: StudioWatermarkCapability
  value: StudioWatermark
  onChange(value: StudioWatermark): void
  lang: 'zh' | 'en'
}> = ({ capability, value, onChange, lang }) => {
  const noteId = useId()
  const supported = capability.status === 'supported'
  const reason = REASONS[capability.reason ?? 'channel-unconfirmed'][lang]
  return <label className="dsh-ig-field-select">
    <span id={`${noteId}-label`}>{lang === 'en' ? 'Visible watermark' : '可见水印'}</span>
    <select value={supported ? value : 'default'} disabled={!supported} aria-labelledby={`${noteId}-label`} aria-describedby={supported ? undefined : noteId}
      title={supported ? (lang === 'en' ? 'Controls the visible watermark added during generation.' : '控制生成图片时添加的可见水印。') : reason}
      onChange={event => onChange(event.target.value as StudioWatermark)}>
      {supported ? <>
        <option value="default">{lang === 'en' ? 'Channel default' : '渠道默认'}</option>
        <option value="off">{lang === 'en' ? 'Off' : '关闭'}</option>
        <option value="on">{lang === 'en' ? 'On' : '开启'}</option>
      </> : <option value="default">{capability.status === 'unknown'
        ? (lang === 'en' ? 'Support unconfirmed' : '支持未确认')
        : (lang === 'en' ? 'No confirmed control' : '无已确认开关')}</option>}
    </select>
    {!supported ? <small id={noteId} className="dsh-ig-inline-note">{reason}</small> : null}
  </label>
}
