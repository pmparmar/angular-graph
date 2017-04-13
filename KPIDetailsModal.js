(function () {
    'use strict';
    var controllerId = 'KPIDetailsModalController';
    angular.module('app').controller(controllerId, ['$rootScope', 'session', 'common', 'datacontext', '$modalInstance', '$filter', 'drilldownDetailsSharedService', KPIDetailsModalController]);

    function KPIDetailsModalController($rootScope, session, common, datacontext, $modalInstance, $filter, drilldownDetailsSharedService) {
        var getLogFn = common.logger.getLogFn;
        var log = getLogFn(controllerId);
        var $q = common.$q;
        var vm = this;

        vm.selectedCategory = datacontext.kpiModalCategory;

        // loading parameters
        vm.loading = true;
        vm.barchartloading = false;

        vm.drilldownDetailsSharedService = drilldownDetailsSharedService;

        vm.title = '';
        vm.monthTitle = '';
        vm.columnHeader1 = "";
        vm.columnHeader2 = "";
        vm.columnHeader3 = "";

        // http parameters
        vm.userId = session.userId;
        vm.clientId = session.clientId;
        vm.matterId = session.matterId;
        vm.endDate = null;
        vm.startDate = null;
        vm.barchartendDate = null;
        vm.barchartstartDate = null;
        vm.sortName = "";
        vm.sortDirection = "";
        vm.pageIndex = 1;
        vm.pageSize = 50;
        vm.chartPageIndex = 1;
        vm.chartPageSize = datacontext.numMonthsBackKPI+1;


        // different group by cache data sources when the table is displaying yearly data
        vm.statisticsForClient = [];
        vm.statisticsForMatter = [];
        vm.statisticsForTimeKeeper = [];
        vm.statisticsForOP = [];
        vm.statisticsByYear = [];
        vm.yearlyTotal = null;

        // different group by cache data source when the table is displaying monthly data
        vm.statisticsByMonthForClient = [];
        vm.statisticsByMonthForMatter = [];
        vm.statisticsByMonthForTimeKeeper = [];
        vm.statisticsByMonthForOP = [];
        vm.statisticsByMonth = [];
        vm.montlyTotal = null;

        vm.statistics = [];
        // true if the barchart period was clicked and the drilldown is set to view only a month's worth of data
        vm.isDisplayingMonthlyData = false;
        // dataset of monthly periods for the barchart
        vm.barchartStatisticsByMonth = [];
        // only applicable for billable hours because this dataset contains Carpe Diem time data
        vm.unCommittedTimeStatisticsByMonth = [];

        vm.promises = [];
        vm.chartPromises = [];
        vm.closeModal = closeModal;

        vm.GroupBys = drilldownDetailsSharedService.getGroupBys(session, vm.selectedCategory);
        // for comparison in the html
        vm._groupBys = drilldownDetailsSharedService.groupBy;
        vm.selectedGroupBy = drilldownDetailsSharedService.getDefaultGroupBy(session, vm.GroupBys, vm.selectedCategory);
        vm.previousYearlyGroupBy = vm.selectedGroupBy;

        // always ensures that the time frames are sorted from current to previous year
        vm.timeFrames = createTimeFrames();
        vm.selectedYear = _.head(_.reverse(_.sortBy(vm.timeFrames, function (o) { return o; })));

        vm.error = null;

        // an object array - the actual data is contained in data property
        vm.ChartData = null;
        // a string array displaying "MMM YYYY"
        vm.ChartLabels = null;
        vm.ChartSeries = [];

        // true to refresh chart data
        vm.reloadBarchartData = false;
        // true to refresh all cache with new data, false to append data to cache
        vm.reloadTableData = false;

        vm.initiated = false;

        // the back button
        vm.backToYearlyData = function () {
            vm.isDisplayingMonthlyData = false;
            vm.selectedGroupBy = vm.previousYearlyGroupBy;
            vm.statistics = []; //Added by Viktor on 2016/11/29. Back button doesn't properly clear the table.
            reloadTable();

            if (vm.isDisplayingMonthlyData) {
                vm.title = vm.title.replace("YTD", "MT");
            }
            else
                vm.title = vm.title.replace("MTD", "YTD");
        }

        // Load more data on scroll
        vm.loadData = function () {
            if (vm.initiated) {
                vm.pageIndex = vm.pageIndex + 1;
                setDatasources(vm.selectedCategory);
                activate();
            }

            vm.initiated = true;
        }

        vm.myChart = null;
        var baseController = Chart.controllers.bar;
        // barAlt chart gets bar defaults
        Chart.defaults.BarAlt = Chart.defaults.bar;
        Chart.controllers.BarAlt = Chart.controllers.bar.extend({
            // Draw the representation of the dataset
            // @param ease : if specified, this number represents how far to transition elements. See the implementation of draw() in any of the provided controllers to see how this should be used
            draw: function () {
                baseController.prototype.draw.apply(this, arguments);
                var ctx = this.chart.chart.ctx;
                ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontFamily, 'normal', Chart.defaults.global.defaultFontFamily);
                ctx.fillStyle = "White";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                 var labels = this.chart.data.labels;
                var primarySet = this.chart.data.datasets[this.chart.data.datasets.length - 1];
                for (var i = 0; i < primarySet.data.length; i++) {
                    var model = primarySet._meta[Object.keys(primarySet._meta)[0]].data[i]._model;
                    var s = labels[i].split(' ');
                    var result = labels[i];
                    if (s.length == 2) {
                        result = s[0] + " '" + s[1].substr(2, 2);
                    }
                    ctx.fillText(result, model.x, model.y + 20);
                }
            },

        });
        vm.standardChartOptions = {
            options: {
                scales: {
                    xAxes: [{
                        display: false,
                        stacked: true,
                    }],
                    yAxes: [{
                        display: false,
                        stacked: true
                    }]
                },
                responsive: true,
                tooltips: {
                    enabled: true,
                    titleMarginBottom: 1,
                    bodySpacing: 1,
                    yPadding: 2,
                    caretSize: 1,
                    //custom: common.customTooltips,
                    callbacks: {
                        // text to render as the title
                        title: function (tooltipItems, data) {
                            return tooltipItems[0].xLabel;
                        },
                        // text to render for each item in the tooltip
                        label: function (tooltipItem, data) {
                            //if (tooltipItem.yLabel == 0) {
                            //    return '0';
                            //}
                            return $filter("numberShort")(tooltipItem.yLabel);
                        }
                    },
                    itemSort: function (itemA, itemB) {
                        if (!!itemB) {
                            return 1;
                        }
                        return -1;
                    }
                },
                onClick: function (event, chartElements) {
                    if (!vm.loading) {
                        // is an array of points on the canvas that are at the same position as the click event
                        var chartElems = this.getElementsAtEvent(event);
                        if (chartElems.length > 0) {
                            var chartElem = chartElems[0];
                            // first param is the x-value 
                            // second param is the y-value
                            // third param is needed to calculate yearly totals
                            vm.selectedMonthChange(chartElem._model.label,
                                chartElem._chart.config.data.datasets[0].data[chartElem._index],
                                chartElem._chart.config.data);
                        }
                    }
                }
            },
        }
 
        // changes data sources when the group by changes
        vm.selectedGroupByChange = function () {
            vm.isDisplayingMonthlyData = vm.isDisplayingMonthlyData || false;
            vm.reloadBarchartData = false;
            vm.reloadTableData = true;
            vm.initiated = false;
            vm.loading = true;

            // create a date starting from 1/1/{selected year}
           // vm.startDate = new moment().year(vm.selectedYear).startOf("year");
            // create a date ending in 12/31/{selected year}
          //  vm.endDate = new moment().year(vm.selectedYear).endOf("year");

            // configure the barchart dates
            vm.barchartendDate = session.dashboardDate.clone().year(vm.selectedYear).endOf("month");
            vm.barchartstartDate = vm.barchartendDate.clone().subtract(datacontext.numMonthsBackKPI, 'month').startOf("month");

            vm.statistics = [];
            resetPagingVars();
            setTitle(vm.selectedCategory);
            setHeaders(vm.selectedCategory);
            setSortName(vm.selectedCategory);
            setDatasources(vm.selectedCategory);
            activate();
        }

        vm.selectedYearChange = function () {

            vm.isDisplayingMonthlyData = false;
            vm.reloadBarchartData = true;
            vm.reloadTableData = true;
            vm.initiated = false;
            vm.loading = true;

            // create a date starting from 1/1/{selected year}
            vm.startDate = new moment().year(vm.selectedYear).startOf("year");
            // create a date ending in 12/31/{selected year}
            vm.endDate = new moment().year(vm.selectedYear).endOf("year");

            // configure the barchart dates
            vm.barchartendDate = session.dashboardDate.clone().year(vm.selectedYear).endOf("month");
            vm.barchartstartDate = vm.barchartendDate.clone().subtract(datacontext.numMonthsBackKPI, 'month').startOf("month");

            vm.statistics = [];
            resetPagingVars();
            setTitle(vm.selectedCategory);
            setHeaders(vm.selectedCategory);
            setSortName(vm.selectedCategory);
            setDatasources(vm.selectedCategory);
            activate();
        };

        vm.selectedMonthChange = function (endDate, monthlyTotal, chartData) {

            vm.isDisplayingMonthlyData = true;
            // bar chart would not load if the drill down starts with monthly data unless we add a dirty flag
            vm.reloadBarchartData = false;
            vm.reloadTableData = true;
            vm.initiated = false;
            vm.loading = true;

            // save the group by option for the back button
            //vm.previousYearlyGroupBy = vm.previousYearlyGroupBy.Id != vm.selectedGroupBy.Id ? vm.previousYearlyGroupBy : vm.selectedGroupBy;

            // start and end date changes to encompass first day of the month to the end of the month
            vm.startDate = new moment(endDate, common.dateChartFormat).startOf("month");
            vm.endDate = new moment(endDate, common.dateChartFormat).endOf("month");

            // barchart dates do not change UNLESS monthly data is instantiaed first

            vm.statistics = [];
            resetPagingVars();
            setTitle(vm.selectedCategory);
            setHeaders(vm.selectedCategory);
            setSortName(vm.selectedCategory);
            setDatasources(vm.selectedCategory);
            setMonthlyTotal(monthlyTotal);
            setYearlyTotal(chartData, vm.endDate);
            activate();
        };

        // load more data for the current table
        vm.loadMoreData = function () {
            // we want to append the results
            vm.reloadTableData = false;
            // TODO: figure out the end
            vm.pageIndex += 1;
            activate();
        }

        vm.selectItem = function () {
            $modalInstance.dismiss('cancel');
        }

        // main entry point
        vm.selectedYearChange();

        function activate() {

            // async task to load main table data
            if (vm.reloadTableData) {                
                $q.all(vm.promises)
                    .then(function (response) {
                        reloadTable();
                        vm.loading = false;
                    });
            }

            // async task to load chart data
            if (vm.reloadBarchartData) {
                vm.barchartloading = true;
                $q.all(vm.chartPromises)
                    .then(function (response) {
                        reloadBarchart(vm.selectedCategory);
                        vm.barchartloading = false;
                    });
            }           
        }

        function setDatasources(category) {
            // first condition is to choose the correct data sources for the data
            // second condition is to only execute service calls based on selected grouping by option
            if (category.Id == drilldownDetailsSharedService.categories.BillableTime.Id ||
                category.Id == drilldownDetailsSharedService.categories.BillableMoney.Id) {

                // table data
                vm.selectedGroup = '';
                if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Client.Id) {
                    vm.promises = [getTimeStatisticsForClient()];
                } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Matter.Id) {
                    vm.selectedGroup = 'Matters'; //Added by Viktor on 9/26/2016
                    vm.promises = [getTimeStatisticsForMatter()];
                } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Timekeeper.Id) {
                    vm.promises = [getTimeStatisticsForTimeKeeper()];
                } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.OrigAtty.Id) {
                    vm.promises = [getTimeStatisticsForOP()];
                }

                // barchart data
                if (vm.reloadBarchartData) {
                    vm.chartPromises = [getTimeStatisticsByMonth(), getUncommittedTimeStatisticsByMonth()];
                }
            }
            else if (category.Id == drilldownDetailsSharedService.categories.Billed.Id ||
                category.Id == drilldownDetailsSharedService.categories.Writeoffs.Id) {

                // table data
                if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Client.Id) {
                    vm.promises = [getInvoiceStatisticsForClient()];
                } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Matter.Id) {
                    vm.promises = [getInvoiceStatisticsForMatter()];
                } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.OrigAtty.Id) {
                    vm.promises = [getInvoiceStatisticsForOP()];
                }

                // barchart data
                if (vm.reloadBarchartData) {
                    vm.chartPromises = [getInvoiceStatisticsByMonth()];
                }
            }
            else if (category.Id == drilldownDetailsSharedService.categories.Collected.Id) {

                // table data
                if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Client.Id) {
                    vm.promises = [getPaymentStatisticsForClient()];
                } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Matter.Id) {
                    vm.promises = [getPaymentStatisticsForMatter()];
                } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.OrigAtty.Id) {
                    vm.promises = [getPaymentStatisticsForOP()];
                }

                // barchart data
                if (vm.reloadBarchartData) {
                    vm.chartPromises = [getPaymentStatisticsByMonth()];
                }
            }
        }

        function setSortName(category) {
            vm.sortName = drilldownDetailsSharedService.getSortName(category);
            vm.sortDirection = drilldownDetailsSharedService.getSortDirection(category);
        }

        function setHeaders(category) {
            // the second column is always selected category
            vm.columnHeader2 = drilldownDetailsSharedService.getColumnHeader(category);

            // the third column 
            if (category.Id == drilldownDetailsSharedService.categories.BillableTime.Id) {
                vm.columnHeader3 = drilldownDetailsSharedService.getColumnHeader(drilldownDetailsSharedService.categories.BillableMoney);
            }
            else if (category.Id == drilldownDetailsSharedService.categories.BillableMoney.Id) {
                vm.columnHeader3 = drilldownDetailsSharedService.getColumnHeader(drilldownDetailsSharedService.categories.BillableTime);
            }
            else if (category.Id == drilldownDetailsSharedService.categories.Billed.Id) {
                vm.columnHeader3 = '';
            }
            else if (category.Id == drilldownDetailsSharedService.categories.Writeoffs.Id) {
                vm.columnHeader3 = drilldownDetailsSharedService.getColumnHeader(drilldownDetailsSharedService.categories.Realization);
            }
            else if (category.Id == drilldownDetailsSharedService.categories.Collected.Id) {
                vm.columnHeader3 = '';
            }
        }

        function setTitle(category) {
            // create the ytd title
            vm.title = drilldownDetailsSharedService.getTitle(category);

            // create the month title
            if (vm.isDisplayingMonthlyData) {
                vm.monthTitle = ' - ' + vm.endDate.format(common.dateChartFormat);
                vm.title = vm.title.replace("YTD", "MTD");
            }
            else
                vm.title = vm.title.replace("MTD", "YTD");
        }

        function setMonthlyTotal(monthlyTotal) {
            vm.monthlyTotal = monthlyTotal;
        }

        //@param endDate is a moment containing the date that was clicked - it is set to the end of the month
        function setYearlyTotal(chartData, endDate) {

            // if the click date is in this year we can use the chart data to get the yearly value
            // otherwise we need to call another ajax request
            vm.yearlyTotal = 0;
            var startOfYear = endDate.clone().startOf("year");

            if (endDate.year() == session.dashboardDate.year()) {
                if (!!chartData && endDate.isValid()) {
                    // mark the beginning of the year
                    // the end of the current year that was click is in the endDate parameter
                    
                    var sum = 0;
                    for (var i = 0; i < chartData.datasets[0].data.length; i++) {
                        // create a moment for the current dataset's data item
                        var itemDate = moment(chartData.labels[i], common.dateChartFormat).startOf("month");

                        if (itemDate.isBetween(startOfYear, endDate, null, "[")) {
                            // in case of stacked charts
                            _.forEach(chartData.datasets, function (o) {
                                sum += o.data[i] || 0;
                            });
                        }
                    }

                    vm.yearlyTotal = sum;
                }
            }
            else {
                // category
                var category = vm.selectedCategory;
                if (category.Id == drilldownDetailsSharedService.categories.BillableTime.Id) {
                    getTimeStatisticsByYear(startOfYear, endDate);
                }
                else if (category.Id == drilldownDetailsSharedService.categories.BillableMoney.Id) {
                    getTimeStatisticsByYear(startOfYear, endDate);
                }
                else if (category.Id == drilldownDetailsSharedService.categories.Billed.Id) {
                    getInvoiceStatisticsByYear(startOfYear, endDate);
                }
                else if (category.Id == drilldownDetailsSharedService.categories.Writeoffs.Id) {
                    getInvoiceStatisticsByYear(startOfYear, endDate);
                }
                else if (category.Id == drilldownDetailsSharedService.categories.Collected.Id) {
                    getPaymentStatisticsByYear(startOfYear, endDate);
                }
            }
        }

        // changes data sources when the group by changes
        function reloadTable() {
            // indicates which cached datasource to use for the main table
            if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.OrigAtty.Id) {
                vm.statisticsByYear = vm.statisticsForOP;
                if (vm.isDisplayingMonthlyData) {
                    
                    vm.statisticsByMonth = vm.statisticsByMonthForOP;
                }
            } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Client.Id) {
                vm.statisticsByYear = vm.statisticsForClient;
                if (vm.isDisplayingMonthlyData) {
                    vm.statisticsByMonth = vm.statisticsByMonthForClient;
                }
            } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Matter.Id) {
                vm.statisticsByYear = vm.statisticsForMatter;
                if (vm.isDisplayingMonthlyData) {
                    vm.statisticsByMonth = vm.statisticsByMonthForMatter;
                }
            } else if (vm.selectedGroupBy.Id == drilldownDetailsSharedService.groupBy.Timekeeper.Id) {
                vm.statisticsByYear = vm.statisticsForTimeKeeper;
                if (vm.isDisplayingMonthlyData) {
                    vm.statisticsByMonth = vm.statisticsByMonthForTimeKeeper;
                }
            }

            // need dto keep two datasets for yearly and monthly data for the header total values
            // header total values are incorrect because of paging
            if (vm.isDisplayingMonthlyData) {
                vm.statistics = vm.statistics.concat(vm.statisticsByMonth);
            } else {
                vm.statistics = vm.statistics.concat(vm.statisticsByYear);
            }

            // change the first column header to indicate what the data is group by
            vm.columnHeader1 = vm.selectedGroupBy.Text;

        };

        function reloadBarchart(category) {

            if (!!vm.myChart) {
                vm.myChart.destroy();
            }

            if (vm.barchartStatisticsByMonth.length > 0) {

                var datasets = [];

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

                if (category.Id == drilldownDetailsSharedService.categories.BillableTime.Id) {
                    datasets.push(_.map(vm.barchartStatisticsByMonth, datacontext.calculateTotalBillableTime));
                    datasets.push(_.map(vm.unCommittedTimeStatisticsByMonth, datacontext.calculateTotalBillableTime));
                }
                else if (category.Id == drilldownDetailsSharedService.categories.BillableMoney.Id) {
                    datasets.push(_.map(vm.barchartStatisticsByMonth, datacontext.calculateTotalBillableMoney));
                    datasets.push(_.map(vm.unCommittedTimeStatisticsByMonth, datacontext.calculateTotalBillableMoney));
                }
                else if (category.Id == drilldownDetailsSharedService.categories.Billed.Id) {
                    var fnBilled = datacontext.calculateTotalBilled;
                    datasets.push(_.map(vm.barchartStatisticsByMonth, fnBilled));
                }
                else if (category.Id == drilldownDetailsSharedService.categories.Writeoffs.Id) {
                    var fnWriteoff = common.isFirmView(session) ? datacontext.calculateFeesWriteoff : datacontext.calculateFeesWriteoff;
                    datasets.push(_.map(vm.barchartStatisticsByMonth, fnWriteoff));
                }
                else if (category.Id == drilldownDetailsSharedService.categories.Collected.Id) {
                    var fnCollected = datacontext.calculateTotalCollected ;
                    datasets.push(_.map(vm.barchartStatisticsByMonth, fnCollected));
                }

                // [ [100, 232, 4141, 433], [100, 232, 4141, 433] ]
                vm.ChartData = datasets;
                // ["Jan 2015", "Feb 2015", ... "Jul 2016"]
                vm.ChartLabels = _.map(vm.barchartStatisticsByMonth, common.timeStatisticsDate);
                // 'Committed Time', 'Uncommitted Time'
                createChartSeries(category);

                createChart(category);
            }
            else {
                if (!!vm.myChart) {
                    vm.myChart.destroy();
                }
            }
        }

        function createChartSeries(category) {
            vm.ChartSeries = [];

            if (category.Id == drilldownDetailsSharedService.categories.BillableTime.Id) {
                vm.ChartSeries.push("Committed Time");
                vm.ChartSeries.push("UnCommitted Time");
            }
            else if (category.Id == drilldownDetailsSharedService.categories.BillableMoney.Id) {
                vm.ChartSeries.push("Committed Money");
                vm.ChartSeries.push("UnCommitted Money");
            }
            else if (category.Id == drilldownDetailsSharedService.categories.Billed.Id) {
                vm.ChartSeries.push("Billed");
            }
            else if (category.Id == drilldownDetailsSharedService.categories.Writeoffs.Id) {
                vm.ChartSeries.push("Writeoffs");
            }
            else if (category.Id == drilldownDetailsSharedService.categories.Collected.Id) {
                vm.ChartSeries.push("Collected");
            }
        }
        
        // create an array of year time frames sorted by current year first
        function createTimeFrames() {
            var numYearsBack = datacontext.numYearsBack;
            var currentYear = moment(session.dashboardDate).year();

            var years = [];
            for (var i = 0; i <= numYearsBack; i++) {
                years.push(currentYear - i);
            }
            return years;
        }

        function createChart(category) {
            if (!!category) {

                var ctx = document.getElementById("kpi-details-modal-chart");
                //If popup immediately closed after open, chart element not found
                if (ctx) {
                    ctx.getContext("2d");


                    var data1 = {
                        labels: vm.ChartLabels,
                        datasets: []
                    };

                    // create an array of rgba values for each bar
                    var purpleBackgroundColorArray = [];
                    _.forEach(vm.ChartData[0], function (c) {
                        purpleBackgroundColorArray.push(datacontext.purpleRGBA);
                    });

                    var cloneOptions = vm.standardChartOptions.options;
                    if (category.Id == drilldownDetailsSharedService.categories.BillableTime.Id ||
                        category.Id == drilldownDetailsSharedService.categories.BillableMoney.Id) {
                        cloneOptions = _.cloneDeep(vm.standardChartOptions.options);
                        cloneOptions.scales.xAxes[0].stacked = true;
                        cloneOptions.scales.yAxes[0].stacked = true;
                        //stacked bar chart
                        data1.datasets.push({
                            backgroundColor: purpleBackgroundColorArray,
                            data: vm.ChartData[0],
                            label: vm.ChartSeries[0]
                        });

                        // create an array of rgba values for each bar
                        var redBackgroundColorArray = [];
                        _.forEach(vm.ChartData[0], function (c) {
                            redBackgroundColorArray.push(datacontext.redRGBA);
                        });

                        data1.datasets.push({
                            backgroundColor: redBackgroundColorArray,
                            data: vm.ChartData[1],
                            label: vm.ChartSeries[1]
                        });
                    } else {
                        data1.datasets.push({
                            backgroundColor: purpleBackgroundColorArray,
                            data: vm.ChartData[0],
                            label: vm.ChartSeries[0]
                        });

                    }

                    var config = {
                        type: 'BarAlt',
                        data: data1,
                        options: cloneOptions
                    };

                    vm.myChart = new Chart(ctx, config);
                }

            }
        }

        function getCommonHttpParams() {
            return datacontext.createStatisticsParams("", "", session,
                vm.startDate.format(common.dateFormat),
                vm.endDate.format(common.dateFormat),
                vm.pageIndex,
                vm.pageSize,
                vm.sortName,
                vm.sortDirection);
        }

        function resetPagingVars() {
            vm.pageIndex = 1;
            vm.pageSize = 50;
        }

        // Data services to get billable hours and dollars worked
        // =======================================================================
        function getTimeStatisticsForClient() {
            // create api parameters
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getTimeStatisticsForClient(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToTimeStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.Client);

                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForClient = [];
                    }
                    return vm.statisticsByMonthForClient = vm.statisticsByMonthForClient.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForClient = [];
                    }
                    return vm.statisticsForClient = vm.statisticsForClient.concat(temp);
                }
            });
        }

        function getTimeStatisticsForMatter() {
            // create api parameters
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getTimeStatisticsForMatter(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToTimeStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.Matter);
                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForMatter = [];
                    }
                    vm.statisticsByMonthForMatter = vm.statisticsByMonthForMatter.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForMatter = [];
                    }
                    vm.statisticsForMatter = vm.statisticsForMatter.concat(temp);
                }
            });
        }

        function getTimeStatisticsForTimeKeeper() {
            // create api parameters
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getTimeStatisticsForTimeKeeper(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToTimeStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.Timekeeper);

                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForTimeKeeper = [];
                    }
                    vm.statisticsByMonthForTimeKeeper = vm.statisticsByMonthForTimeKeeper.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForTimeKeeper = [];
                    }
                    vm.statisticsForTimeKeeper = vm.statisticsForTimeKeeper.concat(temp);
                }
            });
        }

        function getTimeStatisticsForOP() {
            // create api parameters
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getTimeStatisticsForOP(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToTimeStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.OrigAtty);
                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForOP = [];
                    }
                    vm.statisticsByMonthForOP = vm.statisticsByMonthForOP.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForOP = [];
                    }
                    vm.statisticsForOP = vm.statisticsForOP.concat(temp);
                }
            });
        }

        // dataservice call to get time data for the bar charts
        function getTimeStatisticsByMonth(){
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", true, session,
                vm.barchartstartDate.format(common.dateFormat),
                vm.barchartendDate.format(common.dateFormat),
                vm.chartPageIndex, vm.chartPageSize,
                "Year,Month", "desc,desc");

            return drilldownDetailsSharedService.getTimeStatisticsByMonth(httpParams).then(function (response) {
                if (!!response.data) {
                    return vm.barchartStatisticsByMonth = $filter("sortByMonthYear")(response.data);
                }
                else {
                    return vm.barchartStatisticsByMonth = [];
                }
            });
        }

        // get carpe diem time - time that has not been committed to Elite
        function getUncommittedTimeStatisticsByMonth() {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", false, session,
                vm.barchartstartDate.format(common.dateFormat),
                vm.barchartendDate.format(common.dateFormat),
                vm.chartPageIndex, vm.chartPageSize,
                "Year,Month", "desc,desc");

            return drilldownDetailsSharedService.getTimeStatisticsByMonth(httpParams).then(function (response) {
                if (!!response.data) {
                    return vm.unCommittedTimeStatisticsByMonth = $filter("sortByMonthYear")(response.data);
                } else {
                    return vm.unCommittedTimeStatisticsByMonth = [];
                }
            });
        }

        // get ALL committed and uncommitted time for the YTD sum
        function getTimeStatisticsByYear(startOfYear, endDate) {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", "", session,
                startOfYear.format(common.dateFormat),
                endDate.format(common.dateFormat),
                1, 1, "Year", "desc");

            return drilldownDetailsSharedService.getTimeStatisticsByYear(httpParams).then(function (response) {
                if (!!response.data) {
                  
                    var fnSum = null;
                    if (vm.selectedCategory.Id == drilldownDetailsSharedService.categories.BillableTime.Id) {
                        fnSum = datacontext.calculateTotalBillableTime;
                    }
                    else if (vm.selectedCategory.Id == drilldownDetailsSharedService.categories.BillableMoney.Id) {
                        fnSum = common.isFirmView(session) ? datacontext.calculateTotalBillableMoney : datacontext.calculateFeesBillableMoney;
                    }

                    vm.yearlyTotal = fnSum(response.data[0]);
                } else {
                    vm.yearlyTotal = 0;
                }
            });
        }

      
        // Data services to get billed and writeoffs
        // =======================================================================
        function getInvoiceStatisticsForClient() {
            // create api parameters
            //Modified by Viktor on 11/08/2016 - sorting Billed
            vm.sortName = getSortingColumn();
            //vm.sortName = "RelievedFeeAmount-InvoiceFeeAmount + Matter_ARWriteOffFeeAmount";
            vm.sortDirection = "desc";
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getInvoiceStatisticsForClient(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToInvoiceStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.Client);

                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForClient = [];
                    }
                    vm.statisticsByMonthForClient = vm.statisticsByMonthForClient.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForClient = [];
                    }
                    vm.statisticsForClient = vm.statisticsForClient.concat(temp);
                }
            });
        }

        function getInvoiceStatisticsForMatter() {
            // create api parameters
            //Modified by Viktor on 11/08/2016 - sorting Billed
            vm.sortName = getSortingColumn();
            vm.sortDirection = "desc";
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getInvoiceStatisticsForMatter(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToInvoiceStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.Matter);
                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForMatter = [];
                    }
                    vm.statisticsByMonthForMatter = vm.statisticsByMonthForMatter.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForMatter = [];
                    }
                    vm.statisticsForMatter = vm.statisticsForMatter.concat(temp);
                }
            });
        }

        function getInvoiceStatisticsForOP() {
            // create api parameters
            //vm.sortName = "RelievedFeeAmount-InvoiceFeeAmount + Matter_ARWriteOffFeeAmount";
            vm.sortName = getSortingColumn();
            vm.sortDirection = "desc";
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getInvoiceStatisticsForOP(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToInvoiceStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.OrigAtty);
                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForOP = [];
                    }
                    vm.statisticsByMonthForOP = vm.statisticsByMonthForOP.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForOP = [];
                    }
                    vm.statisticsForOP = vm.statisticsForOP.concat(temp);
                }
            });
        }

        // dataservice call to get time data for the bar charts
        function getInvoiceStatisticsByMonth() {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", true, session,
                vm.barchartstartDate.format(common.dateFormat),
                vm.barchartendDate.format(common.dateFormat),
                vm.chartPageIndex, vm.chartPageSize,
                "Year,Month", "desc,desc");

            return drilldownDetailsSharedService.getInvoiceStatisticsByMonth(httpParams).then(function (response) {
                // response is in columnData1, columnData2, columnData3

                if (!!response.data) {
                    return vm.barchartStatisticsByMonth = $filter("sortByMonthYear")(response.data);
                } else {
                    return vm.barchartStatisticsByMonth = [];
                }

            });
        }

        function getInvoiceStatisticsByYear(startOfYear, endDate) {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", "", session,
                startOfYear.format(common.dateFormat),
                endDate.format(common.dateFormat),
                1, 1, "Year", "desc");

            return drilldownDetailsSharedService.getInvoiceStatisticsByYear(httpParams).then(function (response) {
                if (!!response.data) {

                    var fnSum = null;
                    if (vm.selectedCategory.Id == drilldownDetailsSharedService.categories.Billed.Id) {
                        fnSum = datacontext.calculateTotalBilled;
                    }
                    else if (vm.selectedCategory.Id == drilldownDetailsSharedService.categories.Writeoffs.Id) {
                        fnSum = datacontext.calculateFeesWriteoff;
                    }

                    vm.yearlyTotal = fnSum(response.data[0]);
                } else {
                    vm.yearlyTotal = 0;
                }
            });
        }
        

        // Data services to get collected
        // =======================================================================
        function getPaymentStatisticsForClient() {
            // create api parameters
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getPaymentStatisticsForClient(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToPaymentStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.Client);

                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForClient = [];
                    }
                    vm.statisticsByMonthForClient = vm.statisticsByMonthForClient.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForClient = [];
                    }
                    vm.statisticsForClient = vm.statisticsForClient.concat(temp);
                }
            });
        }

        function getPaymentStatisticsForMatter() {
            // create api parameters
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getPaymentStatisticsForMatter(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToPaymentStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.Matter);
                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForMatter = [];
                    }
                    vm.statisticsByMonthForMatter = vm.statisticsByMonthForMatter.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForMatter = [];
                    }
                    vm.statisticsForMatter = vm.statisticsForMatter.concat(temp);
                }
            });
        }

        function getPaymentStatisticsForOP() {

            // create api parameters
            var httpParams = getCommonHttpParams();

            return drilldownDetailsSharedService.getPaymentStatisticsForOP(httpParams).then(function (response) {
                // data
                var temp = drilldownDetailsSharedService.mapToPaymentStatistics(response, vm.selectedCategory, drilldownDetailsSharedService.groupBy.OrigAtty);
                if (vm.isDisplayingMonthlyData) {
                    if (vm.reloadTableData) {
                        vm.statisticsByMonthForOP= [];
                    }
                    vm.statisticsByMonthForOP = vm.statisticsByMonthForOP.concat(temp);
                } else {
                    if (vm.reloadTableData) {
                        vm.statisticsForOP = [];
                    }
                    vm.statisticsForOP = vm.statisticsForOP.concat(temp);
                }
            });
        }

        // dataservice call to get time data for the bar charts
        function getPaymentStatisticsByMonth() {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", true, session,
                vm.barchartstartDate.format(common.dateFormat),
                vm.barchartendDate.format(common.dateFormat),
                vm.chartPageIndex, vm.chartPageSize,
                "Year,Month", "desc,desc");

            return drilldownDetailsSharedService.getPaymentStatisticsByMonth(httpParams).then(function (response) {
                if (!!response.data) {
                    return vm.barchartStatisticsByMonth = $filter("sortByMonthYear")(response.data);
                } else {
                    return vm.barchartStatisticsByMonth = [];
                }
            });
        }

        function getPaymentStatisticsByYear(startOfYear, endDate) {
            // create api parameters
            var httpParams = datacontext.createStatisticsParams("", "", session,
                startOfYear.format(common.dateFormat),
                endDate.format(common.dateFormat),
                1, 1, "Year", "desc");

            return drilldownDetailsSharedService.getPaymentStatisticsByYear(httpParams).then(function (response) {
                if (!!response.data) {

                    var fnSum = null;
                    if (vm.selectedCategory.Id == drilldownDetailsSharedService.categories.Collected.Id) {
                        fnSum = datacontext.calculateTotalCollected;
                    }
                    
                    vm.yearlyTotal = fnSum(response.data[0]);
                } else {
                    vm.yearlyTotal = 0;
                }
            });
        }

        function closeModal() {
            session.isModalOpened = false;
            datacontext.kpiModalCategory = {};
            $modalInstance.dismiss('cancel');
        }

        function getSortingColumn() {
            switch (vm.selectedCategory.Id) {
                case (3): //Categories.Billed.Id from drilldownDetailsSharedService
                    return "InvoiceFeeAmount + InvoiceExpenseAmount + InvoiceAmountOnAccount";
                default:
                    return "RelievedFeeAmount - InvoiceFeeAmount + Matter_ARWriteOffFeeAmount";
            }
        }

        vm.popover = {
            template_matter_details: './app/dashboard/MatterManagement/Matters/MatterDetailsPopoverKPI.html',
        };
    }
})();