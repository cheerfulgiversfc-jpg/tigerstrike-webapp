function json(res, status, payload){
  res.status(status).json(payload);
}

function readJsonBody(req){
  if(req.body && typeof req.body === "object") return req.body;
  if(typeof req.body === "string" && req.body.trim()){
    try{ return JSON.parse(req.body); }catch(e){ return {}; }
  }
  return {};
}

module.exports = {
  json,
  readJsonBody,
};
