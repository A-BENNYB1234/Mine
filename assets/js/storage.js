(function(){
  const LS_PREFIX = 'circle8_';
  function lsGet(key, fallback=null){
    try{ const v = localStorage.getItem(LS_PREFIX + key); return v? JSON.parse(v) : fallback; }
    catch{ return fallback; }
  }
  function lsSet(key, value){ localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); }
  function lsRemove(key){ localStorage.removeItem(LS_PREFIX + key); }

  function setSession(username){
    const token = crypto.getRandomValues(new Uint32Array(4)).join('-');
    const session = { username, token, createdAt: Date.now() };
    lsSet('session', session);
    return session;
  }
  function getSession(){ return lsGet('session'); }
  function clearSession(){ lsRemove('session'); }

  window.Circle8Auth = { lsGet, lsSet, lsRemove, setSession, getSession, clearSession };
})();