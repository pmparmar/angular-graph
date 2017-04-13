using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
namespace FinancialDashboardApi.Helpers
{
    /// <summary>
    /// 
    /// </summary>
    public class ApiLogEntry
    {
        public MongoDB.Bson.ObjectId Id { get; set; }             // The (database) ID for the API log entry.
        public string Application { get; set; }             // The application that made the request.
        public string UserName { get; set; }                    // The user that made the request.
        public int LoggedInUserId { get; set; }
        public string Machine { get; set; }                 // The machine that made the request.
        public string RequestIpAddress { get; set; }        // The IP address that made the request.
        public string RequestContentType { get; set; }      // The request content type.
        public string RequestContentBody { get; set; }      // The request content body.
        public string RequestUri { get; set; }              // The request URI.
        public string RequestMethod { get; set; }           // The request method (GET, POST, etc).
        public string RequestRouteTemplate { get; set; }    // The request route template.        
        public string RequestHeaders { get; set; }          // The request headers.
        public DateTime? RequestTimestamp { get; set; }     // The request timestamp.
        public string ResponseContentType { get; set; }     // The response content type.
        public string ResponseContentBody { get; set; }     // The response content body.
        public int? ResponseStatusCode { get; set; }        // The response status code.
        public string ResponseHeaders { get; set; }         // The response headers.
        public DateTime? ResponseTimestamp { get; set; }    // The response timestamp.


        public int? UserID { get; set; } // param UserID
        public int? RoleID { get; set; } // param RoleID
        public int? ClientID { get; set; } // param ClientID
        public int? MatterID { get; set; } // param MatterID
    }
}
