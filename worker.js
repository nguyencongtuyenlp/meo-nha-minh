/* builds the cat mesh off the main thread so the phone never freezes while the kitten grows */
importScripts('cat3d.js?v=22','coats.js?v=22');
self.onmessage=function(e){
  var q=e.data;
  try{var c=self.buildPacked(q.coat,q.k,q.shape);self.postMessage({id:q.id,cat:c});}
  catch(err){self.postMessage({id:q.id,error:String(err&&err.message||err)});}
};
