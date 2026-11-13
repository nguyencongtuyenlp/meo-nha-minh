/* builds the cat mesh off the main thread so the phone never freezes while the kitten grows */
importScripts('cat3d.js?v=9','coats.js?v=9');
self.onmessage=function(e){
  var q=e.data;
  try{var c=self.buildPacked(q.coat,q.k);self.postMessage({id:q.id,cat:c});}
  catch(err){self.postMessage({id:q.id,error:String(err&&err.message||err)});}
};
