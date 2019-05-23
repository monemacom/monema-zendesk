import { templatingLoop as loop, escapeSpecialChars as escape } from '../javascripts/lib/helpers.js'
import I18n from '../javascripts/lib/i18n.js'

export default function (args) {

  return `<div>
  <p id="recorded-call-title">${I18n.t('app.recorded-call')}</p>
  <p id="norecorded-call-title">${I18n.t('app.no-recorded-call')}</p>
  <br>
  <audio id="voipsyscomaudio" controls preload="none">
    <source src="">
  </audio>
</div>`
}
