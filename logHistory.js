(function () {
    'use strict';
    var controllerId = 'LogHistory';
    angular.module('app').controller(controllerId, ['session', 'common', '$q', 'adminDataService', 'userDataService', 'clientDataService', 'matterDataService', LogHistory]);

    function LogHistory(session, common, $q, adminDataService, userDataService, clientDataService, matterDataService) {
        var getLogFn = common.logger.getLogFn;
        var log = getLogFn(controllerId);

        var vm = this;
        vm.title = 'Log History';
        vm.filter = {};
        vm.pageSize = 100;
        vm.sortName = 'RequestTimestamp';
        vm.sortDirection = "DESC";
        vm.attorneys = [];
        vm.userName = session.fullName;
        vm.willkieUsername = "";
        vm.userFullName = [];
        vm.loggedInUserName = [];
        vm.clientName = [];
        vm.matterName = [];
        vm.search = search;
        vm.filterUserId;
        vm.fl_UserName = "";
        //vm.isIE = false; // common.isIE();

        //Calendar settings, used by IE
        vm.dateFromStatus = { opened: false };
        vm.dateToStatus = { opened: false };
        vm.datePattern = "/^[0,1]?\d{1}\/(([0-2]?\d{1})|([3][0,1]{1}))\/(([1]{1}[9]{1}[9]{1}\d{1})|([2-9]{1}\d{3}))$/";

        var customSearchInterval = "";

        activate();

        function activate() {
            var promises = [getLogHistory(1)];
            common.activateController(promises, controllerId)
                .then(function () {
                    vm.loading = false;
                    //console.log(vm.logs);
                    for (var i = 0; i < vm.logs.length; i++) {
                        common.activateController([getUserInfo(vm.logs[i].userID), getClientInfo(vm.logs[i].clientID), getMatterInfo(vm.logs[i].clientID, vm.logs[i].matterID), getUserName(vm.logs[i].loggedInUserId)], controllerId).then(function () {
                            mapClientNames();
                            mapMatterNames();
                            mapUserNames();
                            mapLoggedInUserNames();
                            vm.loading = false;
                        });
                    }
                });
        }

        function search(searchText) {
            clearInterval(customSearchInterval);
            customSearchInterval = setTimeout(vm.searchAttorneys, 1000);
        }

        function mapLoggedInUserNames() {
            for (var i = 0; i < vm.logs.length; i++) {
                if (vm.logs[i].loggedInUserId != 0) {
                    for (var j = 0; j < vm.loggedInUserName.length; j++) {
                        if (vm.loggedInUserName[j] == null) {
                            continue;
                        }
                        else if (vm.logs[i].loggedInUserId == vm.loggedInUserName[j].userID) {
                            vm.logs[i].loggedInUserName = vm.loggedInUserName[j].userFullName;
                        }
                    }
                }
            }
        }

        function mapUserNames() {
            for (var i = 0; i < vm.logs.length; i++) {
                if (vm.logs[i].userID != 0) {
                    for (var j = 0; j < vm.userFullName.length; j++) {
                        if (vm.userFullName[j] == null) {
                            continue;
                        }
                        else if (vm.logs[i].userID == vm.userFullName[j].userID) {
                            vm.logs[i].userFullName = vm.userFullName[j].userFullName;
                        }
                    }
                }
            }
        }

        function mapClientNames() {
            for (var i = 0; i < vm.logs.length; i++) {
                if (vm.logs[i].clientID != null) {
                    for (var j = 0; j < vm.clientName.length; j++) {
                        if (vm.clientName[j] == null) {
                            continue;
                        }
                        else if (vm.logs[i].clientID == vm.clientName[j].clientID) {
                            vm.logs[i].clientName = vm.clientName[j].clientName;
                        }
                    }
                }
            }
        }

        function mapMatterNames() {
            for (var i = 0; i < vm.logs.length; i++) {
                if (vm.logs[i].matterID != null) {
                    for (var j = 0; j < vm.matterName.length; j++) {
                        if (vm.matterName[j] == null) {
                            continue;
                        }
                        else if (vm.logs[i].matterID == vm.matterName[j].matterID && vm.logs[i].clientID == vm.matterName[j].clientID) {
                            vm.logs[i].matterName = vm.matterName[j].matterName;
                        }
                    }
                }
            }
        }
        function getLogHistory(pageIndex) {

            var filters = [];
            angular.forEach(vm.filter, function (value, key) {
                if ((value != null) && (value != "")) {
                    if (key === "UserName") {
                        filters.push("LoggedInUserId:" + value);
                    } else {
                        filters.push(key + ':' + value);
                    }

                }
            });
            vm.filterString = filters.join("|");

            if (!vm.sortName)
                vm.sortName = "RequestTimestamp";

            var httpParams = {
                params: {
                    Filters: vm.filterString,
                    PageIndex: pageIndex,
                    PageSize: vm.pageSize,
                    SortName: vm.sortName,
                    SortDirection: vm.sortDirection
                }
            };
            //console.log(vm.filterString);
            return adminDataService.getLogs(httpParams).then(function (response) {
                vm.logs = response.data;
                //console.log(vm.logs);
                vm.loading = false;
            });
        }
        function getUserName(id) {
            if (id != 0) {
                return userDataService.getByUserID({
                    params: {
                        userID: id,
                    }
                }).then(function (response) {
                    if (!!response.data) {
                        vm.loggedInUserName.push({ userID: response.data.userID, userFullName: response.data.lastName + ", " + response.data.firstName });
                        //console.log(vm.loggedInUserName);
                    }
                });
            }
            else {
                //invalid ids will return a null object
                var deferred = $q.defer();
                deferred.resolve(null);
                return deferred.promise;
            }
            var deferred = $q.defer();
        }

        function getUserInfo(id) {
            if (id != 0) {
                return userDataService.getByUserID({
                    params: {
                        userID: id,
                    }
                }).then(function (response) {
                    if (!!response.data) {
                        vm.userFullName.push({ userID: response.data.userID, userFullName: response.data.lastName + ", " + response.data.firstName });
                    }
                });
            }
            else {
                //invalid ids will return a null object
                var deferred = $q.defer();
                deferred.resolve(null);
                return deferred.promise;
            }
            var deferred = $q.defer();
        }

        function getClientInfo(id) {
            if (id == null) {
                vm.clientName.push(null);
            }
            else if (id != 0) {
                return clientDataService.getClientByID({
                    params: {
                        clientID: id,
                    }
                }).then(function (response) {
                    if (!!response.data) {
                        vm.clientName.push({ clientID: response.data.clientID, clientName: response.data.clientName });
                    }
                });
            } else {
                vm.clientName.push(null);
                var deferred = $q.defer();
                deferred.resolve(null);
                return deferred.promise;
            }
        }

        function getMatterInfo(cid, mid) {
            if (mid == null) {
                vm.matterName.push(null);
            }
            else if (cid != 0 && mid != 0) {
                return matterDataService.getMatterByID({
                    params: {
                        clientID: cid,
                        matterID: mid,
                    }
                }).then(function (response) {
                    if (!!response.data) {
                        vm.matterName.push({ clientID: response.data.clientID, matterID: response.data.matterID, matterName: response.data.matterName });
                        //vm.matterName = response.data.matterName;
                    }
                });
            }
            else {
                vm.matterName.push(null);
                var deferred = $q.defer();
                deferred.resolve(null);
                return deferred.promise;
            }
        }

        vm.popover = {
            template_username: 'popover_template_username.html',
            template_userid: 'popover_template_userid.html',
            template_roleid: 'popover_template_roleid.html',
            template_clientid: 'popover_template_clientid.html',
            template_matterid: 'popover_template_matterid.html',
            template_timestamp: 'popover_template_timestamp.html'
        };

        vm.applyFilterUserName = function (userId) {
            //console.log(userId);
            vm.filterUserId = userId;
            vm.applyFilter('UserName');
            //$('suggestionTable').empty();
        }

        vm.applyFilter = function (key) {

            var isChanges = false;

            switch (key) {
                case ("UserName"):
                    isChanges = (vm.filter[key] != vm.fl_UserName);
                    vm.filter[key] = vm.filterUserId;
                    break;
                case ("UserID"):
                    isChanges = (vm.filter[key] != vm.fl_UserID);
                    vm.filter[key] = vm.fl_UserID;
                    break;
                case ("RoleID"):
                    isChanges = (vm.filter[key] != vm.fl_RoleID);
                    vm.filter[key] = vm.fl_RoleID;
                    break;
                case ("ClientID"):
                    isChanges = (vm.filter[key] != vm.fl_ClientID);
                    vm.filter[key] = vm.fl_ClientID;
                    break;
                case ("MatterID"):
                    isChanges = (vm.filter[key] != vm.fl_MatterID);
                    vm.filter[key] = vm.fl_MatterID;
                    break;
                case ("Timestamp"):
                    //if (vm.isIE) {
                    //    vm.fl_Timestamp_Start = angular.element("#txtTimestampFrom").val();
                    //    vm.fl_Timestamp_End = angular.element("#txtTimestampTo").val();
                    //}
                    isChanges = ((vm.filter["Timestamp_Start"] != vm.fl_Timestamp_Start) || (vm.filter["Timestamp_End"] != vm.fl_Timestamp_End));
                    vm.filter["Timestamp_Start"] = (vm.fl_Timestamp_Start ? vm.fl_Timestamp_Start.toLocaleString() : null); //: '01/01/2016'
                    vm.filter["Timestamp_End"] = (vm.fl_Timestamp_End ? vm.fl_Timestamp_End.toLocaleString() : null);// : '01/01/2050'
                    break;
            }

            //close popover
            var elem = document.getElementsByClassName('popoverTrigger');
            for (var i = 0; i < elem.length; i++) {
                angular.element(elem[i]).trigger('click');
                angular.element(elem[i]).removeClass('popoverTrigger');
            }

            if (isChanges) {
                vm.loading = true;
                //getLogHistory(1);
                activate();
            }

        }

        vm.clearFilter = function (key) {
            switch (key) {
                case ("UserName"):
                    vm.fl_UserName = null;
                    vm.filterUserId = null;
                    break;
                case ("UserID"):
                    vm.fl_UserID = null;
                    break;
                case ("RoleID"):
                    vm.fl_RoleID = null;
                    break;
                case ("ClientID"):
                    vm.fl_ClientID = null;
                    break;
                case ("MatterID"):
                    vm.fl_MatterID = null;
                    break;
                case ("Timestamp"):
                    vm.fl_Timestamp_Start = null;
                    vm.fl_Timestamp_End = null;
                    break;
            }
            vm.applyFilter(key);
        }

        vm.clearFilters = function () {
            vm.fl_UserName = null;
            vm.fl_UserID = null;
            vm.fl_RoleID = null;
            vm.fl_ClientID = null;
            vm.fl_MatterID = null;
            vm.fl_Timestamp_Start = null;
            vm.fl_Timestamp_End = null;

            angular.forEach(vm.filter, function (value, key) {
                vm.filter[key] = null;
            });

            vm.loading = true;
            //getLogHistory(1);
            activate();
        }

        vm.getValueFromID = function (id, name) {
            if (id && name) {
                return id + " - " + name;
            }
            else if (id) {
                return id;
            }
            else {
                return '-';
            }
        }

        vm.getRoleName = function (id) {
            var roleName;
            if (id == 1) {
                roleName = "System Admin";
            } else if (id == 2) {
                roleName = "Accounting User";
            } else if (id == 3) {
                roleName = "Originating Partner";
            } else if (id == 4) {
                roleName = "Supervising Partner";
            } else if (id == 5) {
                roleName = "Executive Partner";
            } else if (id == 6) {
                roleName = "Administrative Assistant";
            } else if (id == 7) {
                roleName = "Chief Officer";
            } else if (id == 8) {
                roleName = "Billing Buddy";
            }
            return vm.getValueFromID(id, roleName)
        }

        vm.searchAttorneys = function (searchText) {
            var searchText1 = vm.fl_UserName.replace(/[^a-zA-Z\d\s:]/g, "");
            vm.loading = true;
            vm.attorneys = [];
            return userDataService.search({
                params: {
                    searchText: searchText1,
                    loggedInUserID: session.loggedInUserId,
                    onlyAttorneySearch: false,
                    pageIndex: 1,
                    pageSize: 20,
                    SortName: "NumerOfMatches,LastName",
                    SortDirection: "DESC,ASC"
                }
            }).then(function (response) {
                if (!!response.data) {
                    vm.attorneys = response.data;
                }
                vm.loading = false;
            });
        }

        //The following functions used by IE
        vm.openFrom = function () {
            vm.dateFromStatus.opened = true;
        };

        vm.openTo = function () {
            vm.dateToStatus.opened = true;
        };

        vm.dateOptions = {
            dateDisabled: false,
            formatYear: 'yy',
            startingDay: 1
        };
        //End IE functions

    }
})();