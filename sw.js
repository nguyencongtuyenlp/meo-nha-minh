/* offline support: network first (always the newest game when online), cached copy when offline */
var V='meo-nha-v14';
var SHELL=['./','index.html','game.js','cat3d.js','coats.js','blendercat.js','meo-blender.bin','engine3.js','vendor/three/build/three.module.min.js','vendor/three/build/three.core.js',
  'vendor/three/jsm/postprocessing/EffectComposer.js','vendor/three/jsm/postprocessing/Pass.js','vendor/three/jsm/postprocessing/MaskPass.js','vendor/three/jsm/postprocessing/ShaderPass.js',
  'vendor/three/jsm/postprocessing/RenderPass.js','vendor/three/jsm/postprocessing/OutputPass.js','vendor/three/jsm/postprocessing/GTAOPass.js','vendor/three/jsm/postprocessing/UnrealBloomPass.js',
  'vendor/three/jsm/shaders/GTAOShader.js','vendor/three/jsm/shaders/CopyShader.js','vendor/three/jsm/shaders/OutputShader.js','vendor/three/jsm/shaders/LuminosityHighPassShader.js',
  'vendor/three/jsm/shaders/PoissonDenoiseShader.js','vendor/three/jsm/math/SimplexNoise.js','vendor/three/jsm/environments/RoomEnvironment.js','worker.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','sounds/meow1.mp3','sounds/meow2.mp3','sounds/meow3.mp3','sounds/meow4.mp3','sounds/meow5.mp3'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(SHELL)}).catch(function(){}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){var r=e.request;if(r.method!=='GET')return;
  e.respondWith(fetch(r).then(function(res){if(res&&res.ok&&(res.type==='basic'||res.type==='cors')){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)});}return res})
    .catch(function(){return caches.match(r,{ignoreSearch:true}).then(function(hit){return hit||caches.match('index.html')})}));});
