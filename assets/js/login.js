(async function(){
  const form = document.getElementById('loginForm');
  const togglePw = document.getElementById('togglePw');
  const attemptsInfo = document.getElementById('attemptsInfo');
  const rememberMe = document.getElementById('rememberMe');
  const toastEl = document.getElementById('toast');
  const toast = new bootstrap.Toast(toastEl);
  const toastMsg = document.getElementById('toastMsg');

  const MAX_ATTEMPTS = 5;
  const LOCK_MINUTES = 10;

  const EMBEDDED_USERS = [
    { username: 'veinarous', pass_sha256: '7507fa0c4969976e4baacf589f16e908faa2ba3aa6649051e7e608175b3dd823' }
  ];

  function showToast(message){ toastMsg.textContent = message; toast.show(); }
  function updateLockUI(lock){
    if(Date.now() < lock.until){
      attemptsInfo.textContent = `Locked until ${new Date(lock.until).toLocaleTimeString()}`;
    }else{
      attemptsInfo.textContent = lock.attempts ? `Attempts: ${lock.attempts}/${MAX_ATTEMPTS}` : '';
    }
  }

  // form UX
  togglePw.addEventListener('click', () => {
    const pw = document.getElementById('password');
    const isText = pw.type === 'text';
    pw.type = isText ? 'password' : 'text';
    togglePw.innerHTML = isText ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
    togglePw.setAttribute('aria-label', isText? 'Show password' : 'Hide password');
  });

  // Load lock state
  const lock = Circle8Auth.lsGet('lock', { attempts: 0, until: 0 });
  updateLockUI(lock);

  // Load users.json (best effort)
  let users = EMBEDDED_USERS;
  try{
    const res = await fetch('data/users.json', { cache: 'no-store' });
    if(res.ok){
      const data = await res.json();
      if(Array.isArray(data.users)) users = data.users;
    }
  }catch(_){ /* offline or missing file is fine */ }

  // Prefill remembered username
  const remembered = Circle8Auth.lsGet('remember');
  if(remembered?.username){ document.getElementById('username').value = remembered.username; }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(Date.now() < lock.until){
      return showToast(`Locked. Try again in ${Math.ceil((lock.until-Date.now())/60000)} min.`);
    }

    if(!form.checkValidity()){ form.classList.add('was-validated'); return; }

    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    const pHash = await sha256Hex(p);

    const ok = users.some(rec => rec.username === u && rec.pass_sha256 === pHash);
    if(ok){
      Circle8Auth.setSession(u);
      if(rememberMe.checked){ Circle8Auth.lsSet('remember', { username: u }); }
      Circle8Auth.lsRemove('lock');
      showToast('Welcome to Circle 8');
      setTimeout(()=>{ location.href = 'home.html'; }, 500);
    }else{
      lock.attempts++;
      if(lock.attempts >= MAX_ATTEMPTS){
        lock.until = Date.now() + LOCK_MINUTES*60*1000;
        showToast('Too many attempts. Locked for 10 minutes.');
      }else{
        showToast(`Invalid credentials. Attempts left: ${MAX_ATTEMPTS - lock.attempts}`);
      }
      Circle8Auth.lsSet('lock', lock);
      updateLockUI(lock);
    }
  });

  async function sha256Hex(msg){
    const enc = new TextEncoder().encode(msg);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
})();