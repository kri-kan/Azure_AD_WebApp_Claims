﻿window.AadPicker = function (searchUrl, maxResultsPerPage, input, token, tenant) {
    function AadPicker() {
        // Inputs
        this.resultsPerPage = maxResultsPerPage / 2;
        this.$input = $( input );
        this.searchUrl = searchUrl;
        this.token = token;
        this.tenant = tenant;

        // Outputs
        this.selected = null;

        // Members
        this.currentResults = [];
        this.userSkipToken = null;
        this.groupSkipToken = null;
        this.lastDisplayed = null;
        this.lastInput;
        this.isPaging = false;
        this.isResultsOpen = false;

        // Constants
        this.graphLoc = "https://graph.windows.net";
        this.apiVersion = "1.22-preview";

        // UI Labels
        this.userLabel = "";
        this.groupLabel = "(group)";

        // Activate
        this.Listen();
    }

    AadPicker.prototype.Listen = function () {
        var picker = this;
        this.$input.catcomplete({
            source: function (request, response) {
                picker.Search(request.term, response);
            },
            minLength: 0,
            delay: 200,
            open: function (event, ui) {
                picker.isResultsOpen = true;
                if (picker.isPaging) {
                    event.target.scrollTop = 0;
                    picker.isPaging = false;
                }
                picker.Page();
            },
            select: function (event, ui) {
                picker.selected = {
                    objectId: ui.item.objectId,
                    displayName: ui.item.label,
                    objectType: ui.item.objectType,
                };
            },
            close: function (event, ui) {
                picker.isResultsOpen = false;
                picker.lastDisplayed = null;
                picker.userSkipToken = null;
                picker.groupSkipToken = null;
                picker.currentResults = [];
            },
        });

        this.$input.focus(function (event) {
            if (!picker.isResultsOpen)
                $(this).catcomplete("search", this.value);
        });

        picker.BindPagingListener();
    }

    AadPicker.prototype.ConstructUserQuery = function (inputValue) {
        
        var url = this.graphLoc + '/' + this.tenant + "/users?api-version="
            + this.apiVersion + "&$top=" + this.resultsPerPage;

        if (inputValue.length > 0) {
            url += "&$filter=" +
            "startswith(displayName,'" + inputValue +
            "') or startswith(givenName,'" + inputValue +
            "') or startswith(surname,'" + inputValue +
            "') or startswith(userPrincipalName,'" + inputValue +
            "') or startswith(mail,'" + inputValue +
            "') or startswith(mailNickname,'" + inputValue +
            "') or startswith(jobTitle,'" + inputValue +
            "') or startswith(department,'" + inputValue +
            "') or startswith(city,'" + inputValue + "')";
        }

        if (this.userSkipToken && this.lastDisplayed != null && inputValue == this.lastDisplayed)
            url += '&' + this.userSkipToken;

        return url;
    }

    AadPicker.prototype.ConstructGroupQuery = function (inputValue) {

        var url = this.graphLoc + '/' + this.tenant + "/groups?api-version="
            + this.apiVersion + "&$top=" + this.resultsPerPage;

        if (inputValue.length > 0) {
            url += "&$filter=" +
            "startswith(displayName,'" + inputValue +
            "') or startswith(mail,'" + inputValue +
            "') or startswith(mailNickname,'" + inputValue + "')";
        }

        if (this.groupSkipToken && this.lastDisplayed != null && inputValue == this.lastDisplayed)
            url += '&' + this.groupSkipToken;

        return url;
    }

    AadPicker.prototype.SendQuery = function (graphQuery) {
        
        return $.ajax({
            url: this.searchUrl,
            type: "POST",
            picker: this,
            data: {
                token: this.token,
                query: graphQuery
            },
            beforeSend: function (jqxhr, settings) {
                jqxhr.overrideMimeType("application/json");
            }
        });
    }

    AadPicker.prototype.Search = function (inputValue, callback) {

        this.lastInput = inputValue;
        this.selected = null;

        var userQuery = this.ConstructUserQuery(inputValue);
        var groupQuery = this.ConstructGroupQuery(inputValue);
        
        var userDeffered = new $.Deferred().resolve({value: []}, "success");
        var groupDeffered = new $.Deferred().resolve({value: []}, "success");

        if ((inputValue == this.lastDisplayed && this.userSkipToken) || inputValue != this.lastDisplayed)
            userDeffered = this.SendQuery(userQuery);
        if ((inputValue == this.lastDisplayed && this.groupSkipToken) || inputValue != this.lastDisplayed)
            groupDeffered = this.SendQuery(groupQuery);

        var recordResults = function (picker, inputValue, callback) {
            return function (userQ, groupQ) {

                if (userQ[1] == "success" && groupQ[1] == "success" 
                    && userQ[0].error == undefined && groupQ[0].error == undefined) {

                    var usersAndGroups = userQ[0].value.concat(groupQ[0].value);

                    if (userQ[0]["odata.nextLink"] != undefined) {
                        picker.userSkipToken = userQ[0]["odata.nextLink"]
                            .substring(userQ[0]["odata.nextLink"].indexOf("$skiptoken"),
                            userQ[0]["odata.nextLink"].length);
                    }
                    else {
                        picker.userSkipToken = null;
                    }
                    if (groupQ[0]["odata.nextLink"] != undefined) {
                        picker.groupSkipToken = groupQ[0]["odata.nextLink"]
                            .substring(groupQ[0]["odata.nextLink"].indexOf("$skiptoken"),
                            groupQ[0]["odata.nextLink"].length);
                    }
                    else {
                        picker.groupSkipToken = null;
                    }

                    if (picker.lastDisplayed == null || inputValue != picker.lastDisplayed) {
                        picker.currentResults = [];
                    }
                    
                    for (var i = 0; i < usersAndGroups.length; i++) {

                        if (usersAndGroups[i].objectType == "User") {
                            picker.currentResults.push({
                                label: usersAndGroups[i].displayName,
                                value: usersAndGroups[i].displayName,
                                objectId: usersAndGroups[i].objectId,
                                objectType: picker.userLabel,
                            });
                        } else if (usersAndGroups[i].objectType == "Group") {
                            picker.currentResults.push({
                                label: usersAndGroups[i].displayName,
                                value: usersAndGroups[i].displayName,
                                objectId: usersAndGroups[i].objectId,
                                objectType: picker.groupLabel,
                            });
                        }
                    }
                }
                else {
                    picker.currentResults = [];
                    callback([{ label: "Error During Search" }]);
                    picker.selected = null;
                    return;
                }
                
                if (inputValue == picker.lastInput) {
                    picker.lastDisplayed = inputValue;
                    callback(picker.currentResults);
                }
            };
        };

        $.when(userDeffered, groupDeffered)
            .always(recordResults(this, inputValue, callback))
    };

    AadPicker.prototype.BindPagingListener = function () {

        this.isPaging = false;
        this.$input.catcomplete("widget").bind("scroll", { picker: this }, this.ScrollHandler);
    };

    AadPicker.prototype.ScrollHandler = function () {
        picker.Page();   
    };

    AadPicker.prototype.Page = function () {
        var $resultsDiv = this.$input.catcomplete("widget");
        if ($resultsDiv.scrollTop() + $resultsDiv.innerHeight() >= $resultsDiv[0].scrollHeight && !picker.isPaging && (this.userSkipToken || this.groupSkipToken)) {
            this.isPaging = true;
            this.$input.catcomplete("search", this.lastDisplayed);
        }
    };

    $.widget("custom.catcomplete", $.ui.autocomplete, {
        _create: function () {
            this._super();
            this.widget().menu("option", "items", "> :not(.ui-autocomplete-category)");
        },
        _renderMenu: function (ul, items) {
            var that = this;

            $.each(items, function (index, item) {
                that._renderItemData(ul, item);
            });
        },
        _renderItem: function (ul, item) {

            var label = $("<div>").addClass("aadpicker-result-label").append(item.label);
            var type = $("<div>").addClass("aadpicker-result-type").append(item.objectType);
            var toappend = [label, type];

            return $("<li>").addClass("aadpicker-result-elem").attr("data-selected", "false")
                .attr("data-objectId", item.objectId).append(toappend).appendTo(ul);
        },
    });

    return new AadPicker();
};