import { templatingLoop as loop, escapeSpecialChars as escape } from '../javascripts/lib/helpers.js'
import I18n from '../javascripts/lib/i18n.js'

export default function (args) {

  return `<div>
  <button id="callto" class="c-btn c-btn--sm c-btn--primary">${I18n.t('app.call-to')}</button>
</div>`
}
