using FinancialDashboard.BL.Services;
using FinancialDashboard.Core;
using FinancialDashboardApi.Helpers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web;
using System.Web.Http;

namespace FinancialDashboardApi.Controllers
{
    /// <summary>
    /// Manage Logs
    /// </summary>
    public class AdminController : BaseApiController
    {
        /// <summary>
        /// Logs html location
        /// </summary>
        /// <returns></returns>
        [Route("Admin/AddLog")]
        [HttpPost]
        public void AddLog(string url, int loggedInUserId)
        {
            int userID; int roleID; int clientID; int matterID;
            userID = roleID = clientID = matterID = -1;

            string url_qs = url.Substring(url.IndexOf('#') + 2);

            if (url_qs.Length <= 0)
                url_qs = "FirmView";

            string[] url_params = url_qs.Split('/');
            int url_params_len = url_params.Length;

            if (url_params_len > 3)
                int.TryParse(url_params[3], out matterID);

            if (url_params_len > 2)
                int.TryParse(url_params[2], out clientID);

            if (url_params_len > 1)
                int.TryParse(url_params[1], out roleID);

            if (url_params_len > 0)
                int.TryParse(url_params[0], out userID);

            //var request = HttpContext.Current.Request;

            ApiLogEntry apiLogEntry = new ApiLogEntry()
            {
                Application = "FinancialDashboard",
                UserName = User.Identity.Name,
                LoggedInUserId = loggedInUserId,
                Machine = Environment.MachineName,
                RequestIpAddress = null, //request.UserHostAddress,
                RequestUri = url, // request.Url.ToString(),
                RequestRouteTemplate = url_qs,
                RequestTimestamp = DateTime.Now,
            };

            if (userID > -1)
                apiLogEntry.UserID = userID;

            if (roleID > -1)
                apiLogEntry.RoleID = roleID;

            if (clientID > -1)
                apiLogEntry.ClientID = clientID;

            if (matterID > -1)
                apiLogEntry.MatterID = matterID;

            ApiLogEntryLogger apiLogEntryLogger = new ApiLogEntryLogger();
            apiLogEntryLogger.Add(apiLogEntry);
        }

        /// <summary>
        /// Get log history
        /// </summary>
        /// <returns></returns>
        [Route("Admin/GetLogs")]
        [HttpGet]
        public List<ApiLogEntry> GetLogs(
            string filters,
            int pageIndex,
            int pageSize,
            string sortName,
            string sortDirection
        )
        {
            ApiLogEntryLogger apiLogEntryLogger = new ApiLogEntryLogger();
            return apiLogEntryLogger.GetList(filters, pageIndex, pageSize, sortName, sortDirection);
        }

        /// <summary>
        /// Get log history
        /// </summary>
        /// <returns></returns>
        [Route("Admin/ProcessReportImportFromElite")]
        [HttpPost]
        public string ProcessReportImportFromElite()
        {
            AdminRepository repo = new AdminRepository();
            try
            {
                return repo.ProcessReportImportFromElite();
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }
    }
}
