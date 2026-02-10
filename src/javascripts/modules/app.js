/**
 *  Example app
 **/

import I18n from '../../javascripts/lib/i18n'
import {
    resizeContainer,
    render
} from '../../javascripts/lib/helpers'
import getTopBarTemplate from '../../templates/topbar'
import getTicketTemplate from '../../templates/ticket'
import getUserTemplate from '../../templates/user'

const MAX_HEIGHT = 1000

class App {
    constructor(client, appData) {

        this._zendeskURL = "https://"+appData.context.account.subdomain+".zendesk.com"

        this._client = client
        this._appData = appData
        this._appId = appData.metadata.appId;

        this._settingsUrl = 'https://' + appData.metadata.settings.server + '/events_manager/';
        this._settingsUser = appData.metadata.settings.username;
        this._settingsToken = appData.metadata.settings.api_token;

        this._location = appData.context.location;

        this._CALLS = [];
        this._onCall = false;

        this._topBarClient;

        this._currentUser;
        this._updateTimerId = null;
        this._updateIntervalId = null;
        this._destroyed = false;

        // Sólo registramos los eventos en el iframe del top_bar
        if (this._location == 'top_bar') {
            // Llamadas entrantes
            client.on("api_notification.incoming-call", this._incomingCall.bind(this));
            // Llamadas salientes
            client.on("api_notification.outgoing-call", this._outgoingCall.bind(this));
            // Cuelgue de llamada
            client.on("api_notification.hangup-call", this._hangupCall.bind(this));
            // Llamada respondida
            client.on("api_notification.answer-call", this._answerCall.bind(this));

            // Cuando el usuario hace clic en el icono de la app del top bar
            client.on("pane.activated", this._paneActivated.bind(this));            
        }

        this._client.on('app.willDestroy', this._willDestroy.bind(this));

        // this.initializePromise is only used in testing
        // indicate app initilization(including all async operations) is complete
        this.initializePromise = this.init()
    }

    /**
     * Initialize module, render main template
     */
    async init() {
        this._currentUser = (await this._client.get('currentUser')).currentUser

        I18n.loadTranslations(this._currentUser.locale)

        const instances = await this._client.get('instances').catch(this._handleError.bind(this));
        for (var instanceGuid in instances.instances) {
            if (instances.instances[instanceGuid].location === 'top_bar') {
                this._topBarClient = this._client.instance(instanceGuid);
                if (this._location == 'background') {
                    this._topBarClient.invoke('popover');
                }
            }
        }

        if (this._location == 'top_bar') {

            await this._notifyAppId();
            render('.loader', getTopBarTemplate())

        } else if (this._location == 'ticket_sidebar') {

            var ticket = await this._client.get('ticket').catch(this._handleError.bind(this));


            if(ticket)
            {
              var that = this;
              render('.loader', getTicketTemplate())
              $("#voipsyscomaudio").hide();
              $("#recorded-call-title").hide();
              $("#norecorded-call-title").hide();
              var ret = this._requestGetRecordedUrl(ticket.ticket.id, this._settingsUrl, this._settingsUser, this._settingsToken).then(function(data) {
                if(data.recording_url && data.recording_url.length)
                {
                  $("#voipsyscomaudio").attr("src",data.recording_url);
                  $("#voipsyscomaudio").show();
                  $("#recorded-call-title").show();
                  $("#norecorded-call-title").hide();
                }
                else
                {
                  $("#voipsyscomaudio").hide();
                  $("#recorded-call-title").hide();
                  $("#norecorded-call-title").show();
                }
                return resizeContainer(that._client, MAX_HEIGHT);
              });
            }

        } else if (this._location == 'user_sidebar') {
          this._userToCall = (await this._client.get('user')).user
          render('.loader', getUserTemplate());
          $('#callto').bind('click',$.proxy(this._callTo, this));
          return resizeContainer(this._client, MAX_HEIGHT);
        }

        return await this._updateTemplate();
    }

    /**
     * Handle error
     * @param {Object} error error object
     */
    _handleError(error) {
        this._lastError = error;
    }

    /**
     * Update template
     */
    _updateTemplate() {
        if (this._updateTimerId) {
            clearTimeout(this._updateTimerId);
            this._updateTimerId = null;
        }

        var html;
        if (!this._CALLS.length) {
            html = '<span class="incoming-calls"><ul><li id="no-incoming-calls">';
            html += I18n.t('app.no-incoming-calls');
            html += '</li></ul></span>';
            $('.incoming-calls').replaceWith(html);
        } else {
            html = '<span class="incoming-calls"><ul>';
            for (var i = 0; i < this._CALLS.length; i++) {
                if (this._CALLS[i].show_popup) {
                    if (this._CALLS[i].name) {
                        html += '<li class="incoming-call">' + this._CALLS[i].name + ' (' + this._CALLS[i].caller_id + ')' + ' ' + this._formatDuration(this._CALLS[i].start_time) + '</li>';
                    } else {
                        html += '<li class="incoming-call">' + this._CALLS[i].caller_id + ' ' + this._formatDuration(this._CALLS[i].start_time) + '</li>';
                    }
                }
            }
            html += '</ul></span>';
            $('.incoming-calls').replaceWith(html);
        }
        if (!this._onCall) {
            $('.current-call').hide();
        } else {
            html = '<ul class="answered-call-data">';
            if (this._onCall.name) {
                html += '<li>';
                html += '<strong>' + I18n.t('app.from-name') + '</strong>';
                html += ' ' + this._onCall.name;
                html += '</li>';
                $('#createperson').hide();
                $('#viewperson').show();
            } else {
                $('#createperson').show();
                $('#viewperson').hide();
            }
            html += '<li>';
            html += '<strong>' + I18n.t('app.from-number') + '</strong>';
            html += ' ' + this._onCall.caller_id;
            html += '</li>';
            html += '<li>';
            html += '<strong>' + I18n.t('app.duration') + '</strong>';
            html += ' ' + this._formatDuration(this._onCall.answertime);
            html += '</li>';
            html += '</ul>';

            $('.answered-call-data').replaceWith(html);
            $('.current-call').show();
            if (this._onCall.call_direction == 'Inbound') {
                $('#answered-call-header').show();
                $('#outgoing-call-header').hide();
            } else {
                $('#answered-call-header').hide();
                $('#outgoing-call-header').show();
            }
        }
        if (!this._onCall || !this._onCall.tickets || !this._onCall.tickets.length) {
            $('.last-tickets').hide();
        } else {
            html = '<div class="last-tickets-data"><ul>';
            html += '<table><col width="95%"><col width="5%">';
            for (var j = 0; j < this._onCall.tickets.length; j++) {
                var subject = this._onCall.tickets[j].subject;
                if (!subject) subject = I18n.t('app.no-subject');
                var status = this._onCall.tickets[j].status;
                if (status == 'new' || status == 'open' || status == 'pending' || status == 'hold' || status == 'solved' || status == 'closed') {
                    status = I18n.t('app.' + this._onCall.tickets[j].status);
                } else {
                    status = '';
                }
                if (subject.length > 55) subject = subject.substring(0, 52) + '...';
                var trclass;
                if (j % 2) trclass = 'tr-white';
                else trclass = 'tr-gray';
                html += '<tr class="' + trclass + '"><td><a href="#" class="showticket" id="showticket'+this._onCall.tickets[j].id+'">' + subject + '</a></td><td>' + status + '</td></tr>';                
            }
            html += '</table>';
            html += '</ul></div>';
            $('.last-tickets-data').replaceWith(html);
            // Le ponemos la acción para el click en el ticket
            for (var j = 0; j < this._onCall.tickets.length; j++) {
              $('#showticket'+this._onCall.tickets[j].id).unbind('click');
              $('#showticket'+this._onCall.tickets[j].id).bind('click',$.proxy(this._viewTicket, this));
            }
            $('.last-tickets').show();
        }        
        if (this._CALLS.length || this._onCall) {
            var that = this;
            this._updateTimerId = setTimeout(function() {
                if (that._destroyed) return;
                that._updateTemplate();
            }, 1000);
        }

        // Enlazamos las acciones
        $('#newticket').unbind('click');
        $('#newticket').bind('click',$.proxy(this._createTicket, this));
        $('#viewperson').unbind('click');
        $('#viewperson').bind('click',$.proxy(this._viewPerson, this));
        $('#createperson').unbind('click');
        $('#createperson').bind('click',$.proxy(this._createPerson, this));        

        return resizeContainer(this._client, MAX_HEIGHT, '375px');
    }

    _willDestroy() {
        this._destroyed = true;
        if (this._updateTimerId) {
            clearTimeout(this._updateTimerId);
            this._updateTimerId = null;
        }
        if (this._updateIntervalId) {
            clearInterval(this._updateIntervalId);
            this._updateIntervalId = null;
        }
    }

    _formatDuration(start_time) {
        var date = new Date();
        var now_seconds = parseInt(date.getTime() / 1000, 10);
        var diff = now_seconds - start_time;
        if (diff < 0) diff = 0;
        var hours = parseInt(diff / 3600, 10);
        var mins = parseInt((diff % 3600) / 60, 10);
        var secs = diff % 60;
        if (mins < 10) mins = '0' + mins;
        if (secs < 10) secs = '0' + secs;

        return hours + ':' + mins + ':' + secs;
    }

    _autoHide() {
        if (!this._CALLS.lenght && !this._onCall) {
            if (this._location == 'top_bar') this._client.invoke('popover','hide');
        }
    }

    _paneActivated() {
      this._updateTemplate();
      this._client.invoke('popover');
    }

    // Events

    _incomingCall(data) {
        var found = -1;
        for (var i = 0; i < this._CALLS.length; i++) {
            if (this._CALLS[i].UUID == data.body.UUID) {
                found = i;
            }
        }
        if (found == -1) {
            this._CALLS[this._CALLS.length] = data.body;
        }
        if (data.body.show_popup) {
            this._updateTemplate();
            this._topBarClient.invoke('popover');
        }
    }

    _outgoingCall(data) {
      if(data.body.agent_id == this._currentUser.id)
      {
        // New call by agent
        this._onCall = data.body;
        var date = new Date();
        var now_seconds = parseInt(date.getTime()/1000,10);
        this._onCall.answertime = now_seconds;
        this._updateTemplate();
        if (this._location == 'top_bar') this._client.invoke('popover');
      }
      else
      {
        this._updateTemplate();
        this._autoHide();
      }      

    }

    _hangupCall(data) {
        var found = -1;
        for (var i = 0; i < this._CALLS.length; i++) {
            if (this._CALLS[i].UUID == data.body.UUID) {
                found = i;
            }
        }
        if (found != -1) {
            this._CALLS.splice(found, 1);
        }
        this._onCall = false;
        this._updateTemplate();
        this._autoHide();
    }

    _answerCall(data) {
        var found = -1;
        for (var i = 0; i < this._CALLS.length; i++) {
            if (this._CALLS[i].UUID == data.body.UUID) {
                found = i;
            }
        }
        if (found != -1) {
            this._CALLS.splice(found, 1);
        }

        if (data.body.agent_id == this._currentUser.id) {
            // Answered call by agent
            this._onCall = data.body;
            var date = new Date();
            var now_seconds = parseInt(date.getTime() / 1000, 10);
            this._onCall.answertime = now_seconds;
            this._updateTemplate();
            if (this._location == 'top_bar') this._client.invoke('popover');
        } else {
            this._updateTemplate();
            this._autoHide();
        }
    }

    // Actions

    _createTicket(e) {
      if(this._onCall)
      {
        this._requestCreateTicket(this._onCall.agent_id, this._onCall.user_id, this._onCall.hash, this._onCall.url, this._onCall.UUID, this._onCall.client_id, this._onCall.call_direction, this._onCall.answertime, this._onCall.recorded_call);
      }
    }

    _viewPerson(e) {   
      if(this._onCall && this._onCall.user_id)
      {
        this._requestOpenPersonTab(this._onCall.agent_id, this._onCall.user_id, this._onCall.hash, this._onCall.url, this._onCall.UUID, this._onCall.client_id);
      }
    }

    _viewTicket(e) {
      var ticketId = e.target.id.replace("showticket","");

      if(this._onCall)
      {
        this._requestViewTicket(this._onCall.agent_id, ticketId, this._onCall.hash, this._onCall.url, this._onCall.UUID, this._onCall.client_id);
      } 
    } 

    _createPerson(e) {   
      if(this._onCall)
      {
        this._requestCreatePerson(this._onCall.agent_id, this._onCall.hash, this._onCall.url, this._onCall.UUID, this._onCall.client_id, this._onCall.caller_id, this._onCall.original_caller_id);
      }
    }

    _callTo(e) {
      var agent_id  = this._currentUser.id;

      var that = this;

      this._requestCallTo(agent_id, this._userToCall.id, this._settingsUrl, this._settingsUser, this._settingsToken).then(function(data) {
            if(data && data.hasOwnProperty('success') && data.success == 1)
            {
              that._client.invoke('notify',I18n.t('app.call-to-success'), 'notice', 4000);
            }            
            else
            {
              that._client.invoke('notify',I18n.t('app.call-to-failure'), 'error', 4000);
            }
         });
    }

    // AJAX requests
    _notifyAppId() {    
        var options = {        
         url:  this._settingsUrl + 'ZenDesk_updateAppId',
         cors: true,
         data: {login: this._settingsUser, t: this._settingsToken, app_id: this._appId },
         dataType: 'json'
       };

       this._client.request(options);
     }

     _requestCreateTicket(agent_id, person_id, hash, tt_url, id, clientid, direction, answertime, recorded) {
       var options = {
         url:  tt_url + 'ZenDesk_CreateTicket',
         cors: true,
         data: {agent_id: agent_id, person: person_id, h: hash, uuid: id, client_id: clientid, call_direction: direction, answer_time: answertime, recorded_url: recorded}
       };
       this._client.request(options);
     }

    _requestOpenPersonTab(agent_id, person_id, hash, tt_url, id, clientid) {
       var options = {
         url:  tt_url + 'ZenDesk_ViewPerson',
         cors: true,
         data: {agent_id: agent_id, person: person_id, h: hash, uuid: id, client_id: clientid}
       };
       this._client.request(options);
     }

     _requestCreatePerson(agent_id, hash, tt_url, id, clientid, phone, original_phone) {
       var options = {
         url:  tt_url + 'ZenDesk_CreatePerson',
         cors: true,
         data: {agent_id: agent_id, h: hash, uuid: id, client_id: clientid, phone_number: phone, original_phone_number: original_phone}
       };
       this._client.request(options);
     }

     _requestGetRecordedUrl(ticket_id, tt_url, user, token) {
       var options = {
         url:  tt_url + 'ZenDesk_getRecordedUrl',
         cors: true,
         data: {ticket: ticket_id, login: user, t: token },
         dataType: 'json'
       };

       return this._client.request(options);
     }

    _requestCallTo(agent_id, person_id, tt_url, user, token) {
       var options = {
         url:  tt_url + 'ZenDesk_CallTo',
         cors: true,
         data: {agent_id: agent_id, person: person_id, login: user, t: token },
         dataType: 'json'
       };

       return this._client.request(options);
     }


     _requestViewTicket(agent_id, ticket_id, hash, tt_url, id, clientid) {
       var options = {
         url:  tt_url + 'ZenDesk_ViewTicket',
         cors: true,
         data: {agent_id: agent_id, ticket: ticket_id, h: hash, uuid: id, client_id: clientid}
       };
       this._client.request(options);
     }


}

export default App
