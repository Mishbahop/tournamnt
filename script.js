const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  del(key) {
    localStorage.removeItem(key);
  }
};

// ------------------ Utilities ------------------
function uid() { return Math.random().toString(36).slice(2, 10); }
function futureDate(days = 1) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString(); }
function fmtDate(s) { try { return new Date(s).toLocaleString(); } catch { return s; } }
function session() { return store.get("session", null); }
function setSession(user) { store.set("session", user); updateNav(); }
function nameOf(userId) { const u = store.get("users", []).find(x => x.id === userId); return u ? (u.name || u.email) : "Unknown"; }

// ------------------ Seed data ------------------
(function seed() {
  const users = store.get("users", []) || [];
  if (!users.some(u => u.email === "admin@tourneyhub.com")) {
    users.push({ id: uid(), email: "admin@tourneyhub.com", password: "admin123", role: "ADMIN", name: "Super Admin" });
  }
  store.set("users", users);

  if (!store.get("tournaments")) {
    store.set("tournaments", [
      { id: uid(), title: "BGMI Patna Cup", game: "BGMI", description: "32 teams, single elimination.", type: "TEAM", bracket: "SINGLE_ELIM", max: 32, fee: 0, startsAt: futureDate(2), published: true, participants: [], matches: [] },
      { id: uid(), title: "Valorant Rush", game: "Valorant", description: "5v5 fast cup.", type: "TEAM", bracket: "DOUBLE_ELIM", max: 1, fee: 199, startsAt: futureDate(5), published: true, participants: [], matches: [] },
      { id: uid(), title: "Rapid Chess Sunday", game: "Chess", description: "Solo rapid.", type: "SOLO", bracket: "SINGLE_ELIM", max: 16, fee: 0, startsAt: futureDate(1), published: true, participants: [], matches: [] }
    ]);
  }

  if (!store.get("gifts")) store.set("gifts", []);
  if (store.get("session") === null) store.set("session", null);
})();

// ------------------ Navigation & Mobile ------------------
function updateNav() {
  const user = session();
  const navProfile = document.getElementById("nav-profile");
  const navAdmin = document.getElementById("nav-admin");
  const navLogin = document.getElementById("nav-login");
  if (!navProfile || !navAdmin || !navLogin) return;

  if (user) {
    navLogin.textContent = "Sign out";
    navLogin.onclick = () => { setSession(null); location.replace("index.html"); };
    navProfile.textContent = `👤 ${user.name || "Dashboard"}`;
    navAdmin.style.display = (user.role === "ORGANIZER" || user.role === "ADMIN") ? "inline-block" : "none";
  } else {
    navLogin.textContent = "🔑 Sign in / Join";
    navLogin.onclick = () => location.replace("login.html");
    navProfile.textContent = "👤 My Dashboard";
    navAdmin.style.display = "none";
  }
}

function initMobileNav() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("open", !expanded);
  });
}

// ------------------ Router ------------------
document.addEventListener("DOMContentLoaded", () => {
  updateNav();
  initMobileNav();

  const path = location.pathname.split("/").pop();
  switch (path) {
    case "":
    case "index.html": if (typeof initHome === "function") initHome(); break;
    case "tournaments.html": if (typeof initBrowse === "function") initBrowse(); break;
    case "tournament.html": if (typeof initTournament === "function") initTournament(); break;
    case "login.html": initLogin(); break;
    case "signup.html": initSignup(); break;
    case "profile.html": if (typeof initProfile === "function") initProfile(); break;
    case "admin.html": if (typeof initAdmin === "function") initAdmin(); break;
    case "wallet.html": if (typeof initWallet === "function") initWallet(); break;
    default: break;
  }
});

// ------------------ Minimal page inits ------------------
// Home / Browse / Tournament fragments kept minimal to avoid errors when present in HTML.
// If you need changes to those pages, modify further.

function initHome() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  const list = store.get("tournaments", []).filter(t => t.published).slice(0, 6);
  grid.innerHTML = list.map(t => `
    <a class="card tournament-card" href="tournament.html?id=${t.id}">
      <div class="flex-between"><h3>${t.title}</h3><span class="tiny muted">${t.game}</span></div>
      <p class="muted">${t.description || ""}</p>
    </a>
  `).join("");
}

function initBrowse() {
  const grid = document.getElementById("tournaments-grid");
  const search = document.getElementById("search");
  const type = document.getElementById("type");
  const bracket = document.getElementById("bracket");
  if (!grid || !search || !type || !bracket) return;
  const render = () => {
    const q = (search.value || "").toLowerCase();
    const t = type.value;
    const b = bracket.value;
    const all = store.get("tournaments", []).filter(x => x.published);
    const filtered = all.filter(x => (!t || x.type === t) && (!b || x.bracket === b) && (x.title.toLowerCase().includes(q) || x.game.toLowerCase().includes(q)));
    grid.innerHTML = filtered.map(card => cardHTML(card)).join("");
  };
  [search, type, bracket].forEach(el => el.addEventListener("input", render));
  render();
}

function registerUser(tid, uid) {
  const tournaments = store.get("tournaments", []);
  const t = tournaments.find(x => x.id === tid);
  if (!t) return;
  if (t.participants.includes(uid)) {
    alert("Already registered");
    return;
  }
  if (t.participants.length >= t.max) {
    alert("Tournament is full");
    return;
  }
  // Check wallet balance if fee > 0
  if (t.fee > 0) {
    const wallet = getWallet(uid);
    if (wallet.balance < t.fee) {
      alert("Insufficient wallet balance. Please deposit funds.");
      location.replace("wallet.html");
      return;
    }
    withdrawWallet(uid, t.fee);
  }
  t.participants.push(uid);
  store.set("tournaments", tournaments);
  alert("Registered!");
  location.reload();
}

// ------------------ Tournament bracket and schedule rendering ------------------
function bracketHTML(t) {
  if (!t.matches || !t.matches.length) {
    return `<p class="muted">Bracket will appear once seeded.</p>`;
  }
  return `<div id="bracket" class="bracket"></div>`;
}

function renderBracket(t) {
  const container = document.getElementById("bracket");
  if (!container) return;
  const rounds = {};
  t.matches.forEach(m => {
    (rounds[m.round] ||= []).push(m);
  });
  container.innerHTML = Object.keys(rounds)
    .sort((a, b) => a - b)
    .map(r => `
      <div class="round">
        <h4>Round ${r}</h4>
        ${rounds[r].map(matchHTML).join("")}
      </div>
    `)
    .join("");
}

function matchHTML(m) {
  return `
    <div class="match">
      <div class="row"><span>${nameOf(m.a)}</span><span class="score">${m.scoreA}</span></div>
      <div class="row"><span>${nameOf(m.b)}</span><span class="score">${m.scoreB}</span></div>
      <div class="row tiny muted">
        <span>Round ${m.round}</span>
      </div>
    </div>
  `;
}

function aboutHTML(t) {
  return `
    <h3>Overview & Rules</h3>
    <p>${t.description || "Organizer will add rules here."}</p>
    <div class="grid two" style="margin-top:12px">
      <div class="item"><strong>Game</strong><div class="tiny muted">${t.game}</div></div>
      <div class="item"><strong>Format</strong><div class="tiny muted">${t.type} • ${t.bracket}</div></div>
    </div>
  `;
}

function participantsHTML(t) {
  const list = t.participants
    .map(uid => `<div class="item flex-between"><div>${nameOf(uid)}</div><div class="tiny muted">Registered</div></div>`)
    .join("");
  return `
    <h3>Registered Players</h3>
    ${list || `<p class="muted">Be the first to sign up.</p>`}
  `;
}

function scheduleHTML(t) {
  return `
    <h3>Match Schedule</h3>
    <p class="muted">Starts at ${fmtDate(t.startsAt)}. Schedule will be announced soon.</p>
  `;
}

// Fix tournament registration button logic and tab switching
function initTournament() {
  const params = new URLSearchParams(location.search);
  const tid = params.get("id");
  const t = store.get("tournaments", []).find(x => x.id === tid);
  if (!t) return;
  const hero = document.getElementById("tournament-hero");
  if (hero) hero.innerHTML = `
    <div class="flex-between">
      <div>
        <h1>${t.title}</h1>
        <p class="muted">${t.game} • ${t.type === "SOLO" ? "Solo" : "Team"} • ${t.bracket.replace("_", " ").toLowerCase()}</p>
        <div class="tournament-meta">
          <span>Starts: ${fmtDate(t.startsAt)}</span>
          <span>Capacity: ${t.participants.length}/${t.max}</span>
          <span>${t.fee > 0 ? "Entry: ₹" + t.fee : "Free entry"}</span>
        </div>
      </div>
      <a class="btn btn-outline" href="tournaments.html">Back</a>
    </div>
  `;

  // Registration UI logic
  const regInfo = document.getElementById("reg-info");
  const regBtn = document.getElementById("register-btn");
  const user = session();
  if (regInfo && regBtn) {
    if (!user) {
      regInfo.textContent = "Please sign in to register.";
      regBtn.onclick = () => location.replace("login.html");
    } else {
      const already = t.participants.includes(user.id);
      if (already) {
        regInfo.textContent = "You are registered. Good luck!";
        regBtn.textContent = "Go to my dashboard";
        regBtn.onclick = () => location.replace("profile.html");
      } else {
        regInfo.textContent = `Join as ${user.role.toLowerCase()}.`;
        regBtn.textContent = "Register";
        regBtn.onclick = () => registerUser(t.id, user.id);
      }
    }
  }

  // Tab switching logic
  const tabs = document.querySelectorAll(".tab");
  const content = document.getElementById("tab-content");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(x => x.classList.remove("active"));
      tab.classList.add("active");
      const key = tab.dataset.tab;
      switch (key) {
        case "about":
          content.innerHTML = aboutHTML(t);
          break;
        case "participants":
          content.innerHTML = participantsHTML(t);
          break;
        case "bracket":
          content.innerHTML = bracketHTML(t);
          renderBracket(t);
          break;
        case "schedule":
          content.innerHTML = scheduleHTML(t);
          break;
      }
    });
  });
  if (tabs.length) tabs[0].click();
}

// ------------------ Auth: login/signup ------------------
function initLogin() {
  const email = document.getElementById("login-email");
  const password = document.getElementById("login-password");
  const btn = document.getElementById("login-btn");
  if (!email || !password || !btn) return;

  btn.onclick = () => {
    const emailVal = (email.value || "").trim().toLowerCase();
    const passwordVal = (password.value || "").trim();
    if (!emailVal || !passwordVal) { alert("Please enter both email and password."); return; }
    const users = store.get("users", []);
    const user = users.find(u => (u.email || "").trim().toLowerCase() === emailVal && u.password === passwordVal);
    if (!user) { alert("Invalid email or password"); return; }
    setSession(user);
    location.replace("index.html");
  };
}

function initSignup() {
  const email = document.getElementById("signup-email");
  const password = document.getElementById("signup-password");
  const role = document.getElementById("signup-role");
  const btn = document.getElementById("signup-btn");
  if (!email || !password || !role || !btn) return;

  btn.onclick = () => {
    const emailVal = (email.value || "").trim();
    const passwordVal = (password.value || "").trim();
    if (!emailVal || !passwordVal) { alert("Email and password are required"); return; }
    const users = store.get("users", []);
    if (users.some(u => u.email === emailVal)) { alert("Email already exists, please login."); location.replace("login.html"); return; }
    const newUser = { id: uid(), email: emailVal, password: passwordVal, role: role.value, name: emailVal.split("@")[0] };
    users.push(newUser);
    store.set("users", users);
    setSession(newUser);
    location.replace("index.html");
  };
}

// ------------------ Profile / Admin / Wallet placeholders ------------------
function initProfile() {
  // kept simple to avoid errors when profile.html is present
  const user = session();
  if (!user) { location.replace("login.html"); return; }
  const regsEl = document.getElementById("my-registrations");
  if (!regsEl) return;
  const tournaments = store.get("tournaments", []).filter(t => t.participants.includes(user.id));
  regsEl.innerHTML = tournaments.length ? tournaments.map(t => `<div class="item"><strong>${t.title}</strong></div>`).join("") : `<p class="muted">No registrations.</p>`;
}

function initAdmin() {
  const user = session();
  if (!user || (user.role !== "ORGANIZER" && user.role !== "ADMIN")) { alert("Organizer/Admin only."); location.replace("login.html"); return; }
  // admin.html contains own inline rendering logic; this function ensures page won't error
}

function getWallet(userId) {
  const wallets = store.get("wallets", []);
  let wallet = wallets.find(w => w.userId === userId);
  if (!wallet) {
    wallet = { userId, balance: 0 };
    wallets.push(wallet);
    store.set("wallets", wallets);
  }
  return wallet;
}
function setWallet(userId, balance) {
  const wallets = store.get("wallets", []);
  let wallet = wallets.find(w => w.userId === userId);
  if (!wallet) {
    wallet = { userId, balance };
    wallets.push(wallet);
  } else {
    wallet.balance = balance;
  }
  store.set("wallets", wallets);
}
function depositWallet(userId, amount) {
  const wallet = getWallet(userId);
  wallet.balance += amount;
  setWallet(userId, wallet.balance);
}
function withdrawWallet(userId, amount) {
  const wallet = getWallet(userId);
  if (wallet.balance < amount) return false;
  wallet.balance -= amount;
  setWallet(userId, wallet.balance);
  return true;
}

function initWallet() {
  const walletBalance = document.getElementById("wallet-balance");
  const walletStatus = document.getElementById("wallet-status");
  const tabDeposit = document.getElementById("tab-deposit");
  const tabWithdraw = document.getElementById("tab-withdraw");
  const tabHistory = document.getElementById("tab-history");
  const walletContent = document.getElementById("wallet-content");
  const user = session();

  if (!user) {
    if (walletStatus) walletStatus.textContent = "Please sign in to use wallet.";
    return;
  }

  // Store UPI info in localStorage per user
  function getUpiInfo() {
    const infos = store.get("upiInfos", []);
    return infos.find(i => i.userId === user.id) || null;
  }
  function setUpiInfo(name, upiId) {
    let infos = store.get("upiInfos", []);
    let info = infos.find(i => i.userId === user.id);
    if (!info) {
      info = { userId: user.id, name, upiId };
      infos.push(info);
    } else {
      info.name = name;
      info.upiId = upiId;
    }
    store.set("upiInfos", infos);
  }

  function renderBalance() {
    const wallet = getWallet(user.id);
    if (walletBalance) walletBalance.textContent = `Wallet Balance: ₹${wallet.balance}`;
  }

  function showDeposit() {
    walletContent.innerHTML = `
      <label class="input"><span>Deposit Amount (₹)</span>
        <input id="deposit-input" type="number" min="1" placeholder="Amount to deposit" />
      </label>
      <button id="deposit-btn" class="btn btn-outline">Deposit</button>
    `;
    walletStatus.textContent = "";
    document.getElementById("deposit-btn").onclick = () => {
      const amt = parseInt(document.getElementById("deposit-input").value, 10);
      if (isNaN(amt) || amt <= 0) {
        walletStatus.textContent = "Enter a valid deposit amount.";
        return;
      }
      localStorage.setItem("pendingDepositAmount", String(amt));
      renderUTR();
    };
  }

  function renderUTR() {
    walletContent.innerHTML = `
      <div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap;">
        <div>
          <img src="YOUR_QR_IMAGE_URL" alt="Scan QR to pay" style="width:160px;border-radius:16px;box-shadow:0 4px 24px #0002;">
          <p class="muted tiny">Scan QR with any UPI app to pay.</p>
        </div>
        <div>
          <label class="input"><span>Enter UTR (Transaction ID)</span>
            <input id="utr-input" placeholder="Enter UTR after payment" />
          </label>
          <button id="submit-utr-btn" class="btn btn-primary">Submit for Verification</button>
        </div>
      </div>
    `;
    walletStatus.textContent = "";
    document.getElementById("submit-utr-btn").onclick = () => {
      const utr = document.getElementById("utr-input").value.trim();
      const amt = parseInt(localStorage.getItem("pendingDepositAmount"), 10) || 0;
      if (!utr) {
        walletStatus.textContent = "Please enter a valid UTR.";
        return;
      }
      const payments = store.get("walletPayments", []);
      payments.push({
        id: uid(),
        userId: user.id,
        utr,
        status: "PENDING",
        amount: amt,
        createdAt: new Date().toISOString()
      });
      store.set("walletPayments", payments);
      walletStatus.textContent = "Submitted! Awaiting admin verification.";
      localStorage.removeItem("pendingDepositAmount");
      renderBalance();
      showHistory();
    };
  }

  function showWithdraw() {
    const upiInfo = getUpiInfo();
    walletContent.innerHTML = `
      <form id="upi-form">
        <label class="input"><span>Your Name (as per UPI)</span>
          <input id="upi-name" type="text" placeholder="Your name" value="${upiInfo ? upiInfo.name : ''}" required />
        </label>
        <label class="input"><span>Your UPI ID</span>
          <input id="upi-id" type="text" placeholder="yourupi@bank" value="${upiInfo ? upiInfo.upiId : ''}" required />
        </label>
        <button id="save-upi-btn" class="btn btn-outline" type="submit">Save UPI Info</button>
      </form>
      <div id="withdraw-section" style="margin-top:24px;${upiInfo ? '' : 'display:none;'}">
        <label class="input"><span>Withdraw Amount (₹)</span>
          <input id="withdraw-input" type="number" min="1" placeholder="Amount to withdraw" />
        </label>
        <button id="withdraw-btn" class="btn btn-outline">Request Withdrawal</button>
      </div>
    `;
    walletStatus.textContent = "";

    // UPI info form logic
    const upiForm = document.getElementById("upi-form");
    upiForm.onsubmit = function(e) {
      e.preventDefault();
      const name = document.getElementById("upi-name").value.trim();
      const upiId = document.getElementById("upi-id").value.trim();
      if (!name || !upiId) {
        walletStatus.textContent = "Please enter both your name and UPI ID.";
        return;
      }
      setUpiInfo(name, upiId);
      walletStatus.textContent = "UPI info saved. You can now withdraw.";
      document.getElementById("withdraw-section").style.display = "";
    };

    // Withdraw logic
    const withdrawBtn = document.getElementById("withdraw-btn");
    if (withdrawBtn) {
      withdrawBtn.onclick = () => {
        const amt = parseInt(document.getElementById("withdraw-input").value, 10);
        if (isNaN(amt) || amt <= 0) {
          walletStatus.textContent = "Enter a valid withdrawal amount.";
          return;
        }
        if (!getUpiInfo()) {
          walletStatus.textContent = "Please enter your UPI info first.";
          return;
        }
        if (!withdrawWallet(user.id, amt)) {
          walletStatus.textContent = "Insufficient balance for withdrawal.";
          return;
        }
        addWithdrawalRequest(user.id, amt, getUpiInfo());
        walletStatus.textContent = `Withdrawal request for ₹${amt} submitted! You will be notified once processed.`;
        document.getElementById("withdraw-input").value = "";
        renderBalance();
        showHistory();
      };
    }
  }

  function showHistory() {
    const payments = store.get("walletPayments", []).filter(p => p.userId === user.id);
    walletContent.innerHTML = `
      <h3>Wallet Transactions</h3>
      <div class="list">
        ${payments.length ? payments.map(p => `
          <div class="item flex-between">
            <div>
              <strong>UTR:</strong> ${p.utr || "-"}<br>
              <strong>Amount:</strong> ₹${p.amount || "-"}<br>
              <span class="tiny muted">${fmtDate(p.createdAt)}</span>
              ${p.status === "CANCELLED" && p.remark ? `<div class="tiny" style="color:#e53935;"><strong>Remark:</strong> ${p.remark}</div>` : ""}
            </div>
            <span class="tiny" style="color:${p.status === "VERIFIED" ? "#4caf50" : p.status === "CANCELLED" ? "#e53935" : "#ffa726"}">${p.status}</span>
          </div>
        `).join("") : `<p class="muted">No wallet transactions yet.</p>`}
      </div>
    `;
    walletStatus.textContent = "";
  }

  if (tabDeposit) tabDeposit.onclick = showDeposit;
  if (tabWithdraw) tabWithdraw.onclick = showWithdraw;
  if (tabHistory) tabHistory.onclick = showHistory;
  showDeposit();
  renderBalance();
}

// ------------------ Minimal helpers used across pages ------------------
function cardHTML(t) {
  return `
    <a class="card tournament-card" href="tournament.html?id=${t.id}">
      <div class="flex-between"><h3>${t.title}</h3><span class="tiny muted">${t.game}</span></div>
      <p class="muted">${t.description || ""}</p>
    </a>
  `;
}

// End of file — single consolidated, syntactically-correct script.js

// Admin verifies payment (credits amount to wallet)
function verifyWalletPayment(paymentId) {
  const payments = store.get("walletPayments", []);
  const payment = payments.find(p => p.id === paymentId);
  if (!payment) return alert("Payment not found.");
  payment.status = "VERIFIED";
  store.set("walletPayments", payments);

  // Credit the deposit amount to user's wallet
  const userId = payment.userId;
  const wallet = getWallet(userId);
  wallet.balance += payment.amount || 0;
  setWallet(userId, wallet.balance);

  alert("Payment verified and wallet credited!");
}

// Admin cancels payment with remark
function cancelWalletPayment(paymentId) {
  const payments = store.get("walletPayments", []);
  const payment = payments.find(p => p.id === paymentId);
  if (!payment) return alert("Payment not found.");
  const remark = prompt("Enter remark for cancellation (visible to user):", "");
  payment.status = "CANCELLED";
  payment.remark = remark || "";
  store.set("walletPayments", payments);
  alert("Payment cancelled!");
}

// Withdrawal requests storage and admin actions
function addWithdrawalRequest(userId, amount, upiInfo) {
  const withdrawals = store.get("withdrawalRequests", []);
  withdrawals.push({
    id: uid(),
    userId,
    amount,
    upiInfo,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    remark: ""
  });
  store.set("withdrawalRequests", withdrawals);
}

// Update showWithdraw to create a withdrawal request and notify user
function showWithdraw() {
  const upiInfo = getUpiInfo();
  walletContent.innerHTML = `
    <form id="upi-form">
      <label class="input"><span>Your Name (as per UPI)</span>
        <input id="upi-name" type="text" placeholder="Your name" value="${upiInfo ? upiInfo.name : ''}" required />
      </label>
      <label class="input"><span>Your UPI ID</span>
        <input id="upi-id" type="text" placeholder="yourupi@bank" value="${upiInfo ? upiInfo.upiId : ''}" required />
      </label>
      <button id="save-upi-btn" class="btn btn-outline" type="submit">Save UPI Info</button>
    </form>
    <div id="withdraw-section" style="margin-top:24px;${upiInfo ? '' : 'display:none;'}">
      <label class="input"><span>Withdraw Amount (₹)</span>
        <input id="withdraw-input" type="number" min="1" placeholder="Amount to withdraw" />
      </label>
      <button id="withdraw-btn" class="btn btn-outline">Request Withdrawal</button>
    </div>
  `;
  walletStatus.textContent = "";

  // UPI info form logic
  const upiForm = document.getElementById("upi-form");
  upiForm.onsubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById("upi-name").value.trim();
    const upiId = document.getElementById("upi-id").value.trim();
    if (!name || !upiId) {
      walletStatus.textContent = "Please enter both your name and UPI ID.";
      return;
    }
    setUpiInfo(name, upiId);
    walletStatus.textContent = "UPI info saved. You can now withdraw.";
    document.getElementById("withdraw-section").style.display = "";
  };

  // Withdraw logic
  const withdrawBtn = document.getElementById("withdraw-btn");
  if (withdrawBtn) {
    withdrawBtn.onclick = () => {
      const amt = parseInt(document.getElementById("withdraw-input").value, 10);
      if (isNaN(amt) || amt <= 0) {
        walletStatus.textContent = "Enter a valid withdrawal amount.";
        return;
      }
      if (!getUpiInfo()) {
        walletStatus.textContent = "Please enter your UPI info first.";
        return;
      }
      if (!withdrawWallet(user.id, amt)) {
        walletStatus.textContent = "Insufficient balance for withdrawal.";
        return;
      }
      addWithdrawalRequest(user.id, amt, getUpiInfo());
      walletStatus.textContent = `Withdrawal request for ₹${amt} submitted! You will be notified once processed.`;
      document.getElementById("withdraw-input").value = "";
      renderBalance();
      showHistory();
    };
  }
}

// Admin: process withdrawal and notify user
function processWithdrawalRequest(requestId, status, remark) {
  const withdrawals = store.get("withdrawalRequests", []);
  const req = withdrawals.find(r => r.id === requestId);
  if (!req) return alert("Withdrawal request not found.");
  req.status = status;
  req.remark = remark || "";
  store.set("withdrawalRequests", withdrawals);

  // Notify user (add to gifts for notification)
  if (status === "PAID") {
    const gifts = store.get("gifts", []);
    gifts.push({
      id: uid(),
      userId: req.userId,
      tournamentId: null,
      message: `Your withdrawal of ₹${req.amount} to UPI ID ${req.upiInfo.upiId} has been processed.`,
      createdAt: new Date().toISOString()
    });
    store.set("gifts", gifts);
  } else if (status === "REJECTED") {
    const gifts = store.get("gifts", []);
    gifts.push({
      id: uid(),
      userId: req.userId,
      tournamentId: null,
      message: `Your withdrawal request was rejected. ${remark}`,
      createdAt: new Date().toISOString()
    });
    store.set("gifts", gifts);
  }
}

// Expose for admin.html
window.processWithdrawalRequest = processWithdrawalRequest;
// install: npm install express nodemailer body-parser cors
const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

let otpStore = {}; // { email: otp }

const transporter = nodemailer.createTransport({
  service: "gmail", // or use your SMTP provider
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password" // use app password, not your main password
  }
});

// Send OTP
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  try {
    await transporter.sendMail({
      from: '"TourneyHub" <your-email@gmail.com>',
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

// Verify OTP
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email]; // clear after use
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("login-email");
  const sendOtpBtn = document.getElementById("send-otp-btn");
  const otpSection = document.getElementById("otp-section");
  const verifyOtpBtn = document.getElementById("verify-otp-btn");
  const otpInput = document.getElementById("login-otp");

  let generatedOtp = null;

  // Email validation
  function isValidEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  // Send OTP (demo only)
  sendOtpBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    // Generate random 6-digit OTP
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // For demo: show OTP in alert (in real app, send via backend email)
    alert("Your OTP is: " + generatedOtp);

    otpSection.style.display = "block";
  });

  // Verify OTP
  verifyOtpBtn.addEventListener("click", () => {
    const enteredOtp = otpInput.value.trim();
    if (enteredOtp === generatedOtp) {
      alert("Login successful!");
      window.location.href = "dashboard.html";
    } else {
      alert("Invalid OTP. Please try again.");
    }
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("login-email");
  const sendOtpBtn = document.getElementById("send-otp-btn");
  const otpSection = document.getElementById("otp-section");
  const otpInput = document.getElementById("login-otp");
  const verifyOtpBtn = document.getElementById("verify-otp-btn");

  let generatedOtp = null;

  function isValidEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  sendOtpBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    // Generate OTP (demo only)
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // For demo: show OTP in alert (in real app, you'd send via backend email)
    alert("Demo OTP (for testing): " + generatedOtp);

    otpSection.style.display = "block";
  });

  verifyOtpBtn.addEventListener("click", () => {
    const enteredOtp = otpInput.value.trim();
    if (enteredOtp === generatedOtp) {
      alert("Login successful!");
      window.location.href = "dashboard.html";
    } else {
      alert("Invalid OTP. Try again.");
    }
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const loginBtn = document.getElementById("login-btn");

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      alert("Login successful! " + userCredential.user.email);
      window.location.href = "dashboard.html";
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });
});
