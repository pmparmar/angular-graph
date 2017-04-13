//using Dapper;
using FinancialDashboard.Core.Database;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Configuration;

namespace FinancialDashboardApi.Helpers
{
    /// <summary>
    /// Logs all the api calls to MongoDB
    /// </summary>
    public class ApiLogEntryLogger
    {
        /// <summary>
        /// connects to mongodb
        /// </summary>
        /// <returns>MongoDatabase</returns>
        public MongoDatabase getMongoConnection()
        {
            //all the configurations from web.config 
            var mongoUrl = new MongoUrl("mongodb://"+ConfigurationManager.AppSettings["MongoDBServerName"]+"/"+ ConfigurationManager.AppSettings["MongoApiLogDB"]);
            var client = new MongoClient(mongoUrl);
            var server = client.GetServer();
            var logDb = server.GetDatabase(ConfigurationManager.AppSettings["MongoApiLogDB"]);
            var collection = logDb.GetCollection<ApiLogEntry>("ApiLogs");
            return logDb;
        }   
        //private IDbConnection _db = new SqlConnection(new DatabaseRepository().GetConnectionString());

        /// <summary>
        /// adds a document to mongodb collection
        /// </summary>
        /// <param name="apiLogEntry"></param>
        public void Add(ApiLogEntry apiLogEntry)
        {
            var collection = getMongoConnection().GetCollection<ApiLogEntry>("ApiLogs");
            ApiLogEntry apilog = new ApiLogEntry
            {
                Application = apiLogEntry.Application,
                UserName = apiLogEntry.UserName,
                LoggedInUserId = apiLogEntry.LoggedInUserId,
                Machine = apiLogEntry.Machine,
                RequestIpAddress = apiLogEntry.RequestIpAddress,
                RequestContentType = apiLogEntry.RequestContentType,
                RequestContentBody = apiLogEntry.RequestContentBody,
                RequestUri = apiLogEntry.RequestUri,
                RequestMethod = apiLogEntry.RequestMethod,
                RequestRouteTemplate = apiLogEntry.RequestRouteTemplate,
                RequestHeaders = apiLogEntry.RequestHeaders,
                RequestTimestamp = apiLogEntry.RequestTimestamp,
                ResponseContentType = apiLogEntry.ResponseContentType,
                ResponseStatusCode = apiLogEntry.ResponseStatusCode,
                ResponseHeaders = apiLogEntry.ResponseHeaders,
                ResponseTimestamp = apiLogEntry.ResponseTimestamp,
                UserID = apiLogEntry.UserID,
                RoleID = apiLogEntry.RoleID,
                ClientID = apiLogEntry.ClientID,
                MatterID = apiLogEntry.MatterID
            }; 
            collection.Save(apilog);
            //this._db.Execute("InsertApiLogEntry", new
            //{
            //    Application = apiLogEntry.Application,
            //    UserName = apiLogEntry.UserName,
            //    Machine = apiLogEntry.Machine,
            //    RequestIpAddress = apiLogEntry.RequestIpAddress,
            //    RequestContentType = apiLogEntry.RequestContentType,
            //    RequestContentBody = apiLogEntry.RequestContentBody,
            //    RequestUri = apiLogEntry.RequestUri,
            //    RequestMethod = apiLogEntry.RequestMethod,
            //    RequestRouteTemplate = apiLogEntry.RequestRouteTemplate,
            //    RequestHeaders = apiLogEntry.RequestHeaders,
            //    RequestTimestamp = apiLogEntry.RequestTimestamp,
            //    ResponseContentType = apiLogEntry.ResponseContentType,
            //    ResponseStatusCode = apiLogEntry.ResponseStatusCode,
            //    ResponseHeaders = apiLogEntry.ResponseHeaders,
            //    ResponseTimestamp = apiLogEntry.ResponseTimestamp,
            //    UserID = apiLogEntry.UserID,
            //    RoleID = apiLogEntry.RoleID,
            //    ClientID = apiLogEntry.ClientID,
            //    MatterID = apiLogEntry.MatterID
            //}, commandType: CommandType.StoredProcedure);
        }

        /// <summary>
        /// queries the database according to the filters provided by the user
        /// </summary>
        /// <param name="filters"></param>
        /// <param name="pageIndex"></param>
        /// <param name="pageSize"></param>
        /// <param name="sortName"></param>
        /// <param name="sortDirection"></param>
        /// <returns>List of Apilogentries</returns>
        public List<ApiLogEntry> GetList(
            string filters,
            int pageIndex,
            int pageSize,
            string sortName,
            string sortDirection
        )
        {
            var db = getMongoConnection();
            List<ApiLogEntry> returnList = null;
            string queryJSON = "{RequestRouteTemplate:{$ne:\"\"}}";
            QueryDocument queryDoc;
          
            if (filters != null)
            {
                string pattern = "^(Timestamp_)";
                Regex r = new Regex(pattern, RegexOptions.IgnoreCase);          
                string[] filtersArr = filters.Split('|');
                int filtersArrLen = filtersArr.Length;
                queryJSON = "{";
                int flag = 0;
                for (int i = 0; i < filtersArrLen; i++)
                {
                    Match m = r.Match(filtersArr[i]);
                    if (m.Success)
                    {
                        string temp = filtersArr[i].Replace(filtersArr[i].Substring(filtersArr[i].IndexOf(",")),"");
                        string[] splitJSON = temp.Split(':');
                        if(splitJSON[0]== "Timestamp_Start")
                        {
                                queryJSON += "RequestTimestamp:{$gt:new Date('" + splitJSON[1] + "')}";     //  '11/2/2016 04:00:00 PM'
                                flag = 1;                
                            
                        }
                        else
                        {
                            //queryJSON += "RequestTimestamp:{$lt:new Date('" + splitJSON[1].Replace(",", "") + "')}";     //  '11/2/2016 04:00:00 PM'
                            
                            if (flag == 1)
                            {
                                queryJSON = queryJSON.Substring(0, queryJSON.Length - 2);
                                queryJSON += ",$lt:new Date('" + splitJSON[1] + "')}";
                            }
                            else
                            {
                                queryJSON += "RequestTimestamp:{$lt:new Date('" + splitJSON[1].Replace(",", "") + "')}";     //  '11/2/2016 04:00:00 PM'
                            }
                        }
                    }
                    else
                    {
                        queryJSON += filtersArr[i];
                    }
                    if(i == filtersArrLen - 1)
                    {
                        queryJSON += ",RequestRouteTemplate:{$ne:\"\"}}";
                    }else
                    {
                        queryJSON += ",";
                    }
                }              
            }
            else
            {
                queryJSON = "{RequestRouteTemplate:{$ne:\"\"}}";
            }
            
            BsonDocument query = MongoDB.Bson.Serialization.BsonSerializer.Deserialize<BsonDocument>(queryJSON);
            queryDoc = new QueryDocument(query);

            if (sortDirection == "DESC")
            {
                returnList = db.GetCollection("ApiLogs").FindAs<ApiLogEntry>(queryDoc).SetSortOrder(MongoDB.Driver.Builders.SortBy.Descending(sortName)).ToList();
            }
            else
            {
                returnList = db.GetCollection("ApiLogs").FindAs<ApiLogEntry>(new QueryDocument()).SetSortOrder(MongoDB.Driver.Builders.SortBy.Ascending(sortName)).ToList();
            }          
            return returnList.Take(pageSize).ToList() ;
           //return this._db.Query<dynamic>("dbo.GetApiLogEntries", new
           //{
           //    Filters = filters,
           //    PageIndex = pageIndex,
           //    PageSize = pageSize,
           //    SortName = sortName,
           //    SortDirection = sortDirection
           //}, commandType: CommandType.StoredProcedure).ToList();
        }
    }
}
