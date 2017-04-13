(function () {
    'use strict';
    var controllerId = 'TimeKPIController';
    angular.module('app').controller(controllerId, ['$rootScope', 'session', 'common', '$uibModal', 'datacontext', 'timeStatisticsDataService', '$filter', 'drilldownDetailsSharedService', TimeKPIController]);

    function TimeKPIController($rootScope, session, common, $uibModal, datacontext, timeStatisticsDataService, $filter, drilldownDetailsSharedService) {
        var getLogFn = common.logger.getLogFn;
        var log = getLogFn(controllerId);
        var $q = common.$q;
        var vm = this;

        // http parameters
        vm.userId = session.userId;
        vm.clientId = session.clientId ;
        vm.matterId = session.matterId;
        vm.currencyId = session.defaultCurrencyID;
        vm.endDate = session.dashboardDate.clone().endOf("month");
        vm.monthlyStartDate = vm.endDate.clone().subtract(datacontext.numMonthsBackKPI, 'month').startOf("month");

        // categories for the stat details modal
        vm.BillableTime = drilldownDetailsSharedService.categories.BillableTime;
        vm.BillableMoney = drilldownDetailsSharedService.categories.BillableMoney;
        // function to open the stat details in the modal
        vm.showKPIDetails = showKPIDetails;
        vm.openKPIDetails = function () {
            $uibModal.open({
                templateUrl: 'app/dashboard/KPIDetailsModal/KPIDetailsModal.html',
                controller: 'KPIDetailsModalController as vm',
                animation: true,
                keyboard: true,
            });
        }

        // loading parameters
        vm.loading = false;
        vm.barchartLoading = false;
        vm.colors = ['#b2aacb', '#f36a0e'];
        // bar chart labels and data objects
        vm.billableHoursChartLabels = [];
        vm.dollarsWorkedChartLabels = [];
        vm.billableHoursChartData = {};
        vm.dollarsWorkedChartData = {};
        vm.timeStatisticsByMonth = {};
        vm.unCommittedTimeStatisticsByMonth = [];
        vm.series = ["Committed", "Uncommitted"];
        // stacked barchart configuration
        vm.barchart = {
            options: {
                datasetFill: false,
                scales: {
                    xAxes: [{
                        display: false,
                        stacked: true
                    }],
                    yAxes: [{
                        display: false,
                        stacked: true
                    }]
                },
                responsive: true,
                tooltips: {
                    enabled: false,
                    titleMarginBottom: 3,
                    bodySpacing: 1,
                    yPadding: 2,
                    custom: function (tooltip) {
                        var canvas = this;
                        return common.customTooltips(tooltip, canvas);
                    },
                    callbacks: {
                        // text to render as the title
                        title: function (tooltipItems, data) {
                            var mDate = moment(tooltipItems[0].xLabel);
                            if (mDate.isValid()) {
                                return mDate.format(common.dateChartFormat);
                            }
                            console.log(tooltipItems[0].xLabel);
                            return tooltipItems[0].xLabel;
                        },
                        // text to render for each item in the tooltip
                        label: function (tooltipItem, data) {
                            // this is for the straight horizontal line starting from last year
                            //if (tooltipItem.datasetIndex == 0) {
                            //    if (tooltipItem.yLabel == 0) {
                            //        return '0';
                            //    } else {
                            //        var filtered = $filter("numberShort")(tooltipItem.yLabel);
                            //        filtered = $filter("accountingValue")(filtered);
                            //        return filtered;
                            //    }
                            //}
                            //return '';


                                var filtered = $filter("numberShort")(tooltipItem.yLabel);
                                filtered = $filter("addParenthesis")(filtered);
                                return filtered;
                        }
                    }
                }
                //tooltipFontSize: 10,
                //tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= value %>",
                //percentageInnerCutout: 70
            }
        };

        // KPI sums and their increase/decrease indicator
        vm.timeStatisticsByYear = {};
        vm.timeStatisticsByLastYear = {};
        vm.billableHoursYOY = null;
        vm.billableMoneyYOY = null;

        // reflect the selected currency for the billable money worked KPI
        vm.currencyName = "";

        // function to calculate the billable time
        vm.fnBillableTime = datacontext.calculateTotalBillableTime;
        // function to calculate the billable money worked
        vm.fnBillableMoney = datacontext.calculateTotalBillableMoney;
        vm.isChartDataEmpty = datacontext.isChartDataEmpty;

        // refresh the KPIs whenever currency changes
        $rootScope.$on('currencyChanged', function (event, data) {            
            activate();
        });

        activate();
        
        function activate() {
            var promises = [];
            common.activateController(promises, controllerId)
                .then(function () {
                    // updates the money worked text
                    updateCurrencyNameFields();

                    // load data for KPI sums
                    vm.loading = true;
                    var yearlyStats = [getTimeStatisticsByYear(), getTimeStatisticsByLastYear()];
                    $q.all(yearlyStats)
                        .then(function (response) {

                            // Set up the year over year indicator for the figures
                            if (vm.timeStatisticsByYear.length > 0) {
                                if (vm.timeStatisticsByLastYear.length > 0) {
                                    vm.billableHoursYOY = common.compareYOYFigures(vm.fnBillableTime(vm.timeStatisticsByYear[0]), vm.fnBillableTime(vm.timeStatisticsByLastYear[0]));
                                    vm.billableMoneyYOY = common.compareYOYFigures(vm.fnBillableMoney(vm.timeStatisticsByYear[0]), vm.fnBillableMoney(vm.timeStatisticsByLastYear[0]));
                                } else {
                                    vm.billableHoursYOY = common.compareYOYFigures(vm.fnBillableTime(vm.timeStatisticsByYear[0]), 0);
                                    vm.billableMoneyYOY = common.compareYOYFigures(vm.fnBillableMoney(vm.timeStatisticsByYear[0]), 0);
                                }
                            } else {
                                vm.billableHoursYOY = null;
                                vm.billableMoneyYOY = null;
                            }

                            // hide the YTD billable hours indicator if the change is 0
                            if (!!vm.billableHoursYOY) {
                                vm.billableHoursYOY = common.nullObjectIfTrue(vm.billableHoursYOY, vm.billableHoursYOY.change == 0);
                            }

                            // hide the YTD money worked if the change is 0
                            if (!!vm.billableMoneyYOY) {
                                vm.billableMoneyYOY = common.nullObjectIfTrue(vm.billableMoneyYOY, vm.billableMoneyYOY.change == 0);
                            }

                            vm.loading = false;
                        });

                    // load data for stacked bar chart
                    vm.barchartLoading = true;
                    var monthlyStats = [getTimeStatisticsByMonth(), getUncommittedTimeStatisticsByMonth()];
                    $q.all(monthlyStats)
                        .then(function (response) {
                            // demo purposes to show the red bar because we have no data for it yet
                            //vm.unCommittedTimeStatisticsByMonth = [{ timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 0, standardAmount: 0 },
                            //    { timeInHours: 10000, standardAmount: 500000 }];
                            // mapping for bar chart data and labels
                            if (vm.timeStatisticsByMonth.length > 0) {
                                // stacked bar chart requires more than 1 dataset
                                vm.billableHoursChartData = [_.map(vm.timeStatisticsByMonth, vm.fnBillableTime),
                                    _.map(vm.unCommittedTimeStatisticsByMonth, vm.fnBillableTime)];

                                vm.billableHoursChartLabels = _.map(vm.timeStatisticsByMonth, common.timeStatisticsDate);
                                // stacked bar chart requires more than 1 dataset
                                vm.dollarsWorkedChartData = [_.map(vm.timeStatisticsByMonth, vm.fnBillableMoney),
                                    _.map(vm.unCommittedTimeStatisticsByMonth, vm.fnBillableMoney)];
                                vm.dollarsWorkedChartLabels = _.map(vm.timeStatisticsByMonth, common.timeStatisticsDate);
                            }
                            else {
                                vm.billableHoursChartData = [];
                                vm.dollarsWorkedChartData = [];
                            }

                            vm.barchartLoading = false;
                        });
                });
        }


        // get committed time for the bar chart
        function getTimeStatisticsByMonth() {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", true, session,
                vm.monthlyStartDate.format(common.dateFormat),
                vm.endDate.format(common.dateFormat),
                1, datacontext.numMonthsBackKPI+1, "Year,Month", "desc,desc");

            return timeStatisticsDataService.getTimeStatisticsByMonth(httpParams).then(function (response) {
                if (!!response.data) {
                    return vm.timeStatisticsByMonth = $filter("sortByMonthYear")(response.data);
                } else {
                    return vm.timeStatisticsByMonth = [];
                }
            });
        }

        // get uncommitted time for the bar chart
        function getUncommittedTimeStatisticsByMonth() {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", false, session,
                vm.monthlyStartDate.format(common.dateFormat),
                vm.endDate.format(common.dateFormat),
                1, datacontext.numMonthsBackKPI+1, "Year,Month", "desc,desc");

            return timeStatisticsDataService.getTimeStatisticsByMonth(httpParams).then(function (response) {
                if (!!response.data) {
                    return vm.unCommittedTimeStatisticsByMonth = $filter("sortByMonthYear")(response.data);
                } else {
                    return vm.unCommittedTimeStatisticsByMonth = [];
                }
            });
        }

        // get ALL committed and uncommitted time for the KPI sum
        function getTimeStatisticsByYear() {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", "", session,
                datacontext.startOfDashboardYear(session).format(common.dateFormat),
                vm.endDate.format(common.dateFormat),
                1, 1, "Year", "desc");

            return timeStatisticsDataService.getTimeStatisticsByYear(httpParams).then(function (response) {
                if (!!response.data) {
                    return vm.timeStatisticsByYear = response.data;
                } else {
                    return vm.timeStatisticsByYear = [];
                }
            });
        }

        // get ALL committed and uncommitted time for the KPI sum last year
        function getTimeStatisticsByLastYear() {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", "", session,
                datacontext.startOfDashboardLastYear(session).format(common.dateFormat),
                datacontext.dashboardLastYear(session).endOf("month").format(common.dateFormat),
                1, 1, "Year", "desc");

            return timeStatisticsDataService.getTimeStatisticsByYear(httpParams).then(function (response) {
                if (!!response.data) {
                    return vm.timeStatisticsByLastYear = response.data;
                } else {
                    return vm.timeStatisticsByLastYear = [];
                }
            });
        }

        // updates the money worked text for the billable money worked KPI
        function updateCurrencyNameFields() {
            vm.currencyName = $filter("currencyName")(vm.session);
        }

        // function to open the stat details in the modal
        // @param data is one of the Categories object in drilldownDetailsSharedService
        function showKPIDetails(data) {
            if (!session.isModalOpened) {
                // only works if user clicks on the X button otherwise 
                //session.isModalOpened = true;
                datacontext.kpiModalCategory = data;
                vm.openKPIDetails();
            }
        }
    }
})();

