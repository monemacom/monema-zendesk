import { templatingLoop as loop, escapeSpecialChars as escape } from '../javascripts/lib/helpers.js'
import I18n from '../javascripts/lib/i18n.js'

export default function (args) {

  return `<div class="topbarmain">
  <h5 class="u-font-family-system u-semibold">${I18n.t('app.incoming-calls')}</h5>
  <span class="incoming-calls u-font-family-system u-regular">
    <ul>
      <li id="no-incoming-calls">${I18n.t('app.no-incoming-calls')}</li>
    </ul>
  </span>
  <hr>
  <div class="current-call">
    <h5 class="u-font-family-system u-semibold" id="answered-call-header">${I18n.t('app.answered-call')}</h5>
    <h5 class="u-font-family-system u-semibold" id="outgoing-call-header">${I18n.t('app.outgoing-call')}</h5>
    <span>
      <ul class="answered-call-data">
      </ul>
    </span>    
    <div class="last-tickets">
      <br>
      <h5 class="u-font-family-system u-semibold" id="answered-call-header">${I18n.t('app.last-tickets')}</h5>
      <div class="last-tickets-data">
      </div>
    </div>
    <div id="actions">
        <button class="c-btn c-btn--sm c-btn--primary" id="newticket">${I18n.t('app.create-ticket')}</button>
        <button class="c-btn c-btn--sm c-btn--primary" id="viewperson">${I18n.t('app.view-person')}</button>
        <button class="c-btn c-btn--sm c-btn--primary" id="createperson">${I18n.t('app.create-person')}</button>
    </div>
  </div>    
</div>`
}
