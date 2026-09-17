function tryPortalRoute_(request) {
  request = request || {};
  var body = request.body && typeof request.body === "object" ? request.body : request;
  if (body.payload && typeof body.payload === "object") body = body.payload;
  var procurementResult = typeof tryProcurementRoute_ === "function" ? tryProcurementRoute_({ action: request.action || body.action, body: body }) : null;
  if (procurementResult) return procurementResult;
  var action = String(request.action || body.action || "").trim().toLowerCase();
  switch (action) {
    case "createdraft": return portalCreateDraft_(body);
    case "getmyprofile": return portalGetMyProfile_(body);
    case "savemyprofile": return portalSaveMyProfile_(body);
    case "listmyrequests": return portalListMyRequests_(body);
    case "getrequestdetail": return portalGetRequestDetail_(body);
    case "uploaddocument": return portalUploadDocument_(body);
    case "submitrequest": return portalSubmitRequest_(body);
    default: return null;
  }
}
