const icons = {
  drop: '<path d="M12 2.5c3.2 4.6 7 8 7 12a7 7 0 0 1-14 0c0-4 3.8-7.4 7-12Z"/><path d="M8.5 15a3.5 3.5 0 0 0 3.5 3.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  book: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/>',
  shield: '<path d="M12 3 4 6v5c0 5 3.4 8 8 10 4.6-2 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  inbox: '<path d="M4 4h16l2 10v5H2v-5L4 4Z"/><path d="M2 14h6l2 3h4l2-3h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  graph: '<path d="M3 3v18h18M7 15l4-5 4 2 5-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

const pages = {
  overview: ['Overview', 'grid'],
  report: ['Report an issue', 'plus'],
  track: ['Track a report', 'search'],
  resources: ['Water awareness', 'book'],
  staff: ['Staff console', 'shield'],
};
const categories = ['Water leakage', 'Discoloration or contamination', 'Low water pressure', 'Interrupted supply', 'Other'];
const statuses = ['Received', 'In progress', 'Resolved', 'Closed'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const date = value => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const options = items => items.map(item => `<option>${escape(item)}</option>`).join('');
const badge = status => `<span class="badge ${status.toLowerCase().replaceAll(' ', '-')}">${escape(status)}</span>`;
const nav = key => {
  const [label, symbol] = pages[key];
  return `<a class="nav-link" data-page="${key}" href="#${key}">${icon(symbol)}<span>${label}</span></a>`;
};
const shell = document.querySelector('#shell');
shell.innerHTML = `
  <aside class="sidebar" id="sidebar">
    <a class="brand" href="#overview"><span class="brand-icon">${icon('drop', 23)}</span><span>AquaWatch<small>WATER QUALITY PORTAL</small></span></a>
    <nav aria-label="Main navigation">
      <p class="nav-label">COMMUNITY</p>
      ${['overview','report','track','resources'].map(nav).join('')}
      <p class="nav-label staff-label">WORKSPACE</p>
      ${nav('staff')}
    </nav>
    <div class="sidebar-footer"><span class="footer-icon">${icon('drop', 16)}</span><div><strong>Community water portal</strong><small>Report issues and follow updates</small></div></div>
  </aside>
  <div class="workspace">
    <header class="topbar">
      <button class="menu-button" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button>
      <div class="breadcrumb"><span>Portal</span><span aria-hidden="true">/</span><strong id="current-page"></strong></div>
      <a class="button top-action" href="#report">${icon('plus', 17)} <span>New report</span></a>
    </header>
    <main id="content" tabindex="-1"></main>
    <footer class="main-footer"><span>AquaWatch · Community water quality</span><a href="#resources">Water awareness</a></footer>
  </div>`;
const main = document.querySelector('main');
const menu = document.querySelector('.menu-button');
menu.addEventListener('click', () => {
  const open = shell.classList.toggle('menu-open');
  menu.setAttribute('aria-expanded', open);
});

async function api(path, { method = 'GET', data } = {}) {
  const response = await fetch('/api' + path, {
    method,
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Request failed.'), { status: response.status });
  return result;
}

function heading(label, title, detail) {
  return `<div class="page-heading"><p class="eyebrow">${label}</p><h1>${title}</h1><p>${detail}</p></div>`;
}

function metric(title, value, subtitle, symbol, tone) {
  return `<article class="metric"><span class="metric-icon ${tone}">${icon(symbol)}</span><span>${title}</span><strong>${value}</strong><small>${subtitle}</small></article>`;
}

function activityChart(days) {
  const max = Math.max(4, ...days.map(day => day.count));
  const ceiling = Math.ceil(max / 4) * 4;
  const ticks = [4, 3, 2, 1, 0].map(step => {
    const y = 20 + (4 - step) * 38;
    return `<text x="8" y="${y + 4}">${ceiling * step / 4}</text><line x1="35" y1="${y}" x2="510" y2="${y}"/>`;
  }).join('');
  const bars = days.map(({ date: day, count }, index) => {
    const x = 48 + index * 67;
    const height = count / ceiling * 152;
    const label = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(day));
    return `<rect x="${x}" y="${172 - height}" width="42" height="${height}" rx="5"><title>${day}: ${count} reports</title></rect><text x="${x + 21}" y="197" text-anchor="middle">${label}</text>`;
  }).join('');
  const description = days.map(day => `${day.date}: ${day.count}`).join(', ');
  return `<svg class="chart" viewBox="0 0 520 207" role="img" aria-label="Reports received in the last seven days. ${description}">${ticks}${bars}</svg>`;
}

async function overview(active) {
  main.innerHTML = `
    ${heading('COMMUNITY DASHBOARD', 'Water quality overview', 'Report local water issues and follow your community’s response.')}
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy"><p class="hero-label"><span></span> CITIZEN SERVICES</p>
      <h2 id="hero-title">A clearer way to<br>report water issues.</h2>
      <p>Tell us about a leak, supply interruption or change in water quality in your area.</p>
      <div class="hero-actions"><a class="button primary-light" href="#report">${icon('plus', 18)} Report an issue</a><a class="button hero-secondary" href="#track">Track a report ${icon('arrow', 17)}</a></div></div>
    </section>
    <section class="insights" id="insights" aria-label="Community report statistics" aria-busy="true"><p class="muted">Loading report statistics…</p></section>`;
  const result = await api('/summary');
  if (!active()) return;
  const counts = Object.fromEntries(result.statuses.map(item => [item.status, item.count]));
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const open = (counts.Received || 0) + (counts['In progress'] || 0);
  const insight = document.querySelector('#insights');
  insight.innerHTML = `
    <div class="section-title"><h2>Community activity</h2><span class="data-tag"><span></span>${result.demo ? 'Sample data' : 'Live portal data'}</span></div>
    <div class="metrics">
      ${metric('Total reports', total, 'All submissions', 'inbox', 'blue')}
      ${metric('Open reports', open, 'Received or in progress', 'clock', 'amber')}
      ${metric('Resolved reports', counts.Resolved || 0, 'Marked resolved by staff', 'check', 'green')}
    </div>
    <div class="charts">
      <article class="panel chart-panel"><div class="panel-heading"><div><h3>Report activity</h3><p>New reports over the last 7 days · UTC</p></div><span class="panel-icon">${icon('graph', 18)}</span></div>${activityChart(result.activity)}</article>
      <article class="panel chart-panel"><div class="panel-heading"><div><h3>Issues by category</h3><p>All submitted reports</p></div><span class="panel-icon">${icon('drop', 18)}</span></div>
      <div class="categories">${result.categories.length ? result.categories.map(item => `<div><div class="category-label"><span>${escape(item.category)}</span><strong>${item.count}</strong></div><progress aria-label="${escape(item.category)}" max="${total}" value="${item.count}"></progress></div>`).join('') : '<p class="muted">Category totals appear after the first report.</p>'}</div></article>
    </div>`;
  insight.setAttribute('aria-busy', 'false');
}

function submit(form, action) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const feedback = form.querySelector('.feedback');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    feedback.textContent = '';
    try { await action(Object.fromEntries(new FormData(form)), feedback); }
    catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });
}

function report() {
  main.innerHTML = `${heading('CITIZEN SERVICES', 'Report a water issue', 'Share enough detail for staff to identify the issue and respond.')}
    <div class="detail-layout"><form class="panel form" id="report-form">
      <h2>Issue details</h2><div class="form-grid">
      <label>Issue type<select name="category" required><option value="">Select an issue</option>${options(categories)}</select></label>
      <label>Area or neighbourhood<input name="area" minlength="2" maxlength="100" placeholder="e.g. Riverside" required></label></div>
      <label>Description<textarea name="description" rows="5" minlength="12" maxlength="1500" placeholder="Describe what you noticed and when it started." required></textarea></label>
      <h2>Your contact details</h2><div class="form-grid">
      <label>Full name<input name="name" autocomplete="name" minlength="2" maxlength="100" required></label>
      <label>Email address<input name="email" autocomplete="email" type="email" maxlength="254" required></label></div>
      <p class="feedback" role="alert"></p><button class="button primary" type="submit">Submit report ${icon('arrow', 17)}</button>
    </form><aside class="panel side-note"><span class="metric-icon blue">${icon('search')}</span><h3>Keep your reference</h3><p>You’ll receive a tracking reference after submission. Save it to check your report’s status later.</p><a href="#track">Go to tracking ${icon('arrow', 16)}</a></aside></div>`;
  const form = document.querySelector('#report-form');
  submit(form, async data => {
    const result = await api('/reports', { method: 'POST', data });
    form.outerHTML = `<section class="panel form success" tabindex="-1"><span class="metric-icon green">${icon('check')}</span><h2>Report received</h2><p>Save this reference to track your report.</p><code>${escape(result.reference)}</code><a class="button primary" href="#track/${result.reference}">Track this report ${icon('arrow', 17)}</a></section>`;
    main.querySelector('.success')?.focus();
  });
}

function track(code = '') {
  main.innerHTML = `${heading('CITIZEN SERVICES', 'Track a report', 'Enter the reference you received when you submitted your report.')}
    <form class="panel form narrow" id="track-form"><label>Tracking reference
      <input name="reference" value="${escape(code)}" placeholder="AQ-…" autocomplete="off" required pattern="[Aa][Qq]\\-[A-Za-z0-9]{20}" title="AQ- followed by 20 letters or numbers"></label>
      <p class="feedback" role="alert"></p><button class="button primary" type="submit">${icon('search', 18)} Find report</button>
    </form><div id="tracking-result" aria-live="polite"></div>`;
  const form = document.querySelector('#track-form');
  submit(form, async ({ reference }) => {
    const output = document.querySelector('#tracking-result');
    output.replaceChildren();
    const result = await api('/reports/' + encodeURIComponent(reference.trim()));
    output.innerHTML = `<article class="panel tracking"><div class="section-title"><h2>${escape(result.category)}</h2>${badge(result.status)}</div>
      <p><code>${escape(result.reference)}</code></p><p class="muted">Submitted ${date(result.created_at)} · Updated ${date(result.updated_at)}</p>
      <h3>Staff update</h3><p>${escape(result.note || 'No update has been posted yet.')}</p></article>`;
  });
  if (code) form.requestSubmit();
}

function resources() {
  main.innerHTML = `${heading('COMMUNITY RESOURCES', 'Water awareness', 'What to record when you notice a change in your water supply.')}
    <div class="resource-grid">
      <article class="panel side-note"><span class="metric-icon blue">${icon('drop')}</span><h2>Changes in water quality</h2><p>Record the location, time, and visible change. Check your water provider’s official notices for guidance.</p></article>
      <article class="panel side-note"><span class="metric-icon amber">${icon('clock')}</span><h2>Leaks and supply interruptions</h2><p>Include a nearby landmark and when the leak, pressure drop, or interruption began.</p></article>
      <article class="panel side-note"><span class="metric-icon green">${icon('search')}</span><h2>Following up</h2><p>Save your tracking reference and use it to see status changes and messages from staff.</p></article>
    </div>`;
}

async function staff(active) {
  main.innerHTML = `${heading('WORKSPACE', 'Staff console', 'Review incoming reports and post status updates for residents.')}<div id="staff-content"><p class="muted">Checking staff access…</p></div>`;
  const access = await api('/admin/session');
  if (!active()) return;
  const content = document.querySelector('#staff-content');
  if (!access.signedIn) {
    content.innerHTML = `<form class="panel form narrow" id="login-form"><span class="metric-icon blue">${icon('shield')}</span><h2>Staff sign-in</h2>
      ${access.enabled ? '<label>Staff password<input name="password" type="password" autocomplete="current-password" required></label><p class="feedback" role="alert"></p><button class="button primary" type="submit">Sign in</button>' : '<p>Set ADMIN_PASSWORD on the server to enable staff access.</p>'}</form>`;
    if (access.enabled) submit(content.querySelector('form'), async data => {
      await api('/admin/session', { method: 'POST', data });
      if (active()) render();
    });
    return;
  }
  content.innerHTML = `<div class="section-title"><h2>Incoming reports</h2><button class="button outline" id="logout">Sign out</button></div>
    <p class="feedback" id="staff-feedback" role="alert"></p><div id="staff-reports"></div>`;
  const feedback = content.querySelector('#staff-feedback');
  content.querySelector('#logout').addEventListener('click', async () => {
    try { await api('/admin/session', { method: 'DELETE' }); if (active()) render(); }
    catch (error) { feedback.textContent = error.message; }
  });
  async function list(cursor) {
    const target = content.querySelector('#staff-reports');
    const { reports, next } = await api('/admin/reports' + (cursor ? '?before=' + cursor : ''));
    if (!active()) return;
    if (!cursor) target.replaceChildren();
    target.querySelector('.load-more')?.remove();
    target.insertAdjacentHTML('beforeend', reports.length ? reports.map(row => `
      <details class="panel staff-row"><summary><span><strong>${escape(row.category)}</strong><small>${escape(row.area)} · ${date(row.created_at)}</small></span>${badge(row.status)}</summary>
      <form class="staff-edit" data-reference="${escape(row.reference)}"><code>${escape(row.reference)}</code>
        <p>${escape(row.description)}</p><p class="muted">${escape(row.name)} · ${escape(row.email)}</p>
        <label>Status<select name="status">${statuses.map(status => `<option${status === row.status ? ' selected' : ''}>${status}</option>`).join('')}</select></label>
        <label>Public update<textarea name="note" maxlength="500" rows="3">${escape(row.note)}</textarea></label>
        <p class="feedback" role="status"></p><button class="button primary" type="submit">Save update</button></form></details>`).join('') : '<p class="panel tracking">No reports have been submitted yet.</p>');
    target.querySelectorAll('form:not([data-bound])').forEach(form => {
      form.dataset.bound = 'true';
      submit(form, async (data, message) => {
        const result = await api('/admin/reports/' + form.dataset.reference, { method: 'PATCH', data });
        form.closest('details').querySelector('.badge').outerHTML = badge(result.status);
        message.textContent = 'Update saved.';
      });
    });
    if (next) {
      target.insertAdjacentHTML('beforeend', '<button class="button outline load-more">Load more</button>');
      target.querySelector('.load-more').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await list(next); }
        catch (error) { feedback.textContent = error.message; }
        finally { button.disabled = false; }
      });
    }
  }
  await list();
}

let generation = 0;
async function render() {
  const token = ++generation;
  const active = () => token === generation;
  const [requested, code] = location.hash.slice(1).split('/');
  if (requested === 'content') return;
  const page = Object.hasOwn(pages, requested) ? requested : 'overview';
  document.querySelector('#current-page').textContent = pages[page][0];
  document.title = `${pages[page][0]} | AquaWatch`;
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  shell.classList.remove('menu-open');
  menu.setAttribute('aria-expanded', 'false');
  try {
    if (page === 'overview') await overview(active);
    if (page === 'report') report();
    if (page === 'track') track(code);
    if (page === 'resources') resources();
    if (page === 'staff') await staff(active);
  } catch (error) {
    if (active()) {
      const output = main.querySelector('#insights, #staff-content') || main;
      output.innerHTML = `<p class="panel tracking feedback" role="alert">${escape(error.message)}</p>`;
      output.setAttribute('aria-busy', 'false');
    }
  }
}

document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); main.focus(); });
render();
