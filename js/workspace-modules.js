/* Experimental workspace page modules for BSCIAMS role workspaces.
   Loaded before global.js (defer). Handlers run after App boot. */
(function () {
  'use strict';

  const Pages = {};

  function api() {
    const A = window.App;
    if (!A) throw new Error('App not ready');
    return A;
  }

  function u() { return api().utils; }
  function DB() { return api().DB; }
  function can(p) { return api().can(p); }
  function toast(...args) { return api().toast(...args); }
  function uid(prefix) { return api().uid(prefix); }
  function seniorOptions(fn) { return api().seniorOptions(fn); }

  function emptyRow(cols, title, hint) {
    return `<tr><td colspan="${cols}"><div class="empty-state"><strong>${u().esc(title)}</strong><p>${u().esc(hint || '')}</p></div></td></tr>`;
  }

  function seniorName(id) {
    const s = DB().all('seniors').find((x) => x.id === id);
    return s ? u().displayName(s) : '—';
  }

  function setSummary(items) {
    const host = document.getElementById('summaryStats');
    if (!host) return;
    host.innerHTML = items.map((item) => `
      <div class="card mini-stat">
        <span class="mini-stat__icon tone-${u().esc(item.tone || 'violet')}"><i class="fa-solid ${u().esc(item.icon)}" aria-hidden="true"></i></span>
        <div><p class="mini-stat__label">${u().esc(item.label)}</p><p class="mini-stat__value">${u().esc(String(item.value))}</p></div>
      </div>`).join('');
  }

  function bindSearch(render) {
    const search = document.getElementById('moduleSearch');
    const filter = document.getElementById('moduleFilter');
    if (search) search.addEventListener('input', () => render());
    if (filter) filter.addEventListener('change', () => render());
  }

  function filters() {
    return {
      q: (document.getElementById('moduleSearch')?.value || '').trim().toLowerCase(),
      f: document.getElementById('moduleFilter')?.value || ''
    };
  }

  async function save(message) {
    const ok = await DB().persist();
    if (!ok) {
      toast('Changes could not be saved. Check permissions and try again.', 'error');
      return false;
    }
    if (message) toast(message, 'success');
    return true;
  }

  /* ---- Document Verification ---- */
  Pages.documents = function () {
    const head = document.getElementById('moduleHead');
    const body = document.getElementById('moduleBody');
    const filter = document.getElementById('moduleFilter');
    document.getElementById('listHeading').textContent = 'Document checklist';
    document.getElementById('listSubtitle').textContent = 'Update submission and verification status by senior';
    filter.innerHTML = `<option value="">All statuses</option>
      <option>Missing</option><option>Submitted</option><option>Verified</option><option>Rejected</option>`;
    const actions = document.getElementById('pageActions');
    if (can('document.manage')) {
      actions.innerHTML = `<button type="button" class="btn btn--primary" id="seedDocsBtn"><i class="fa-solid fa-plus"></i>Add missing checklist rows</button>`;
    }
    head.innerHTML = `<tr><th>Senior</th><th>Document</th><th>Status</th><th>Verified</th><th>Remarks</th><th></th></tr>`;

    function render() {
      const { q, f } = filters();
      const rows = DB().all('documents').filter((d) => {
        if (f && d.status !== f) return false;
        const hay = `${seniorName(d.seniorId)} ${d.type} ${d.status} ${d.remarks}`.toLowerCase();
        return !q || hay.includes(q);
      });
      const missing = DB().all('documents').filter((d) => d.status === 'Missing' || d.status === 'Rejected').length;
      setSummary([
        { label: 'Total checklist items', value: DB().all('documents').length, icon: 'fa-file', tone: 'violet' },
        { label: 'Missing / rejected', value: missing, icon: 'fa-triangle-exclamation', tone: 'pending' },
        { label: 'Verified', value: DB().all('documents').filter((d) => d.status === 'Verified').length, icon: 'fa-circle-check', tone: 'approved' },
        { label: 'Submitted', value: DB().all('documents').filter((d) => d.status === 'Submitted').length, icon: 'fa-inbox', tone: 'info' }
      ]);
      body.innerHTML = rows.map((d) => `
        <tr>
          <td>${u().esc(seniorName(d.seniorId))}</td>
          <td>${u().esc(d.type)}</td>
          <td>${u().badge(d.status)}</td>
          <td>${u().esc(d.verifiedBy || '—')}<br><small>${u().esc(d.verifiedAt ? u().fmtDate(d.verifiedAt) : '')}</small></td>
          <td>${u().esc(d.remarks || '—')}</td>
          <td class="ws-actions">
            ${can('document.manage') ? `<button type="button" class="btn btn--ghost btn--sm" data-id="${u().esc(d.id)}" data-act="edit">Update</button>` : ''}
          </td>
        </tr>`).join('') || emptyRow(6, 'No documents found', 'Register seniors first or add checklist rows.');
    }

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act="edit"]');
      if (!btn || !can('document.manage')) return;
      const doc = DB().all('documents').find((d) => d.id === btn.dataset.id);
      if (!doc) return;
      const status = prompt('Status (Missing, Submitted, Verified, Rejected):', doc.status);
      if (!status) return;
      if (!['Missing', 'Submitted', 'Verified', 'Rejected'].includes(status)) {
        toast('Invalid status.', 'warning');
        return;
      }
      const remarks = prompt('Remarks:', doc.remarks || '') ?? doc.remarks;
      const session = api().Session.get();
      Object.assign(doc, {
        status,
        remarks,
        updatedAt: new Date().toISOString(),
        submittedAt: status === 'Submitted' || status === 'Verified' ? (doc.submittedAt || new Date().toISOString()) : doc.submittedAt,
        verifiedAt: status === 'Verified' ? new Date().toISOString() : '',
        verifiedBy: status === 'Verified' ? (session?.name || '') : ''
      });
      await DB().log('Update', 'Document Verification', `Updated ${doc.type} for ${seniorName(doc.seniorId)} to ${status}`);
      if (await save('Document status updated.')) render();
    });

    document.getElementById('seedDocsBtn')?.addEventListener('click', async () => {
      const types = ['OSCA Application Form', 'Birth Certificate / Valid ID', 'Proof of Residency', '1x1 / 2x2 Photo'];
      let added = 0;
      DB().all('seniors').forEach((s) => {
        types.forEach((type) => {
          const exists = DB().all('documents').some((d) => d.seniorId === s.id && d.type === type);
          if (!exists) {
            DB().all('documents').push({
              id: uid('DOC'), seniorId: s.id, type, status: 'Missing',
              submittedAt: '', verifiedAt: '', verifiedBy: '', remarks: '', updatedAt: new Date().toISOString()
            });
            added += 1;
          }
        });
      });
      if (!added) { toast('All seniors already have the baseline checklist.', 'info'); return; }
      if (await save(`Added ${added} checklist item(s).`)) render();
    });

    bindSearch(render);
    render();
  };

  /* ---- Pension Monitoring ---- */
  Pages.pension = function () {
    document.getElementById('listHeading').textContent = 'Pension coverage';
    document.getElementById('listSubtitle').textContent = 'Monitoring only — no payment processing';
    document.getElementById('moduleFilter').innerHTML = `<option value="">All pension types</option>
      <option>Social Pension</option><option>SSS</option><option>GSIS</option><option>Veterans</option><option>None</option>`;
    document.getElementById('moduleHead').innerHTML = `<tr><th>Senior</th><th>OSCA ID</th><th>Pension</th><th>Last tagged distribution</th><th></th></tr>`;
    const body = document.getElementById('moduleBody');
    const note = document.createElement('p');
    note.className = 'ws-note';
    note.textContent = 'Use this module for recordkeeping of pension type and distribution tags only. It does not disburse funds.';
    document.getElementById('main').insertBefore(note, document.getElementById('summaryStats'));

    function render() {
      const { q, f } = filters();
      const rows = DB().all('seniors').filter((s) => {
        if (f && s.pension !== f) return false;
        const hay = `${u().displayName(s)} ${s.oscaId} ${s.pension}`.toLowerCase();
        return !q || hay.includes(q);
      });
      const covered = DB().all('seniors').filter((s) => s.pension && s.pension !== 'None' && s.status === 'Active');
      setSummary([
        { label: 'Active with pension', value: covered.length, icon: 'fa-money-bill-wave', tone: 'approved' },
        { label: 'Social Pension', value: covered.filter((s) => s.pension === 'Social Pension').length, icon: 'fa-hand-holding-dollar', tone: 'violet' },
        { label: 'Tagged distributed', value: covered.filter((s) => s.pensionDistributedAt).length, icon: 'fa-stamp', tone: 'info' },
        { label: 'No pension recorded', value: DB().all('seniors').filter((s) => !s.pension || s.pension === 'None').length, icon: 'fa-circle-minus', tone: 'neutral' }
      ]);
      body.innerHTML = rows.map((s) => `
        <tr>
          <td>${u().esc(u().displayName(s))}</td>
          <td>${u().esc(s.oscaId)}</td>
          <td>${u().badge(s.pension || 'None', 'violet')}</td>
          <td>${s.pensionDistributedAt ? u().esc(u().fmtDateTime(s.pensionDistributedAt)) : '<span class="muted">Not tagged</span>'}</td>
          <td>${can('pension.manage') && s.pension && s.pension !== 'None' ? `<button type="button" class="btn btn--ghost btn--sm" data-id="${u().esc(s.id)}">Tag distributed</button>` : ''}</td>
        </tr>`).join('') || emptyRow(5, 'No matching seniors', '');
    }

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-id]');
      if (!btn || !can('pension.manage')) return;
      const s = DB().all('seniors').find((x) => x.id === btn.dataset.id);
      if (!s) return;
      s.pensionDistributedAt = new Date().toISOString();
      s.updatedAt = s.pensionDistributedAt;
      await DB().log('Update', 'Pension Monitoring', `Tagged pension distributed for ${u().displayName(s)}`);
      if (await save('Pension distribution tagged.')) render();
    });
    bindSearch(render);
    render();
  };

  /* ---- Follow-ups ---- */
  Pages.followups = function () {
    document.getElementById('listHeading').textContent = 'Open follow-ups';
    document.getElementById('moduleFilter').innerHTML = `<option value="">All statuses</option>
      <option>Open</option><option>In Progress</option><option>Resolved</option><option>Cancelled</option>`;
    document.getElementById('moduleHead').innerHTML = `<tr><th>Title</th><th>Senior</th><th>Module</th><th>Status</th><th>Due</th><th></th></tr>`;
    const body = document.getElementById('moduleBody');
    const actions = document.getElementById('pageActions');
    if (can('followup.manage')) {
      actions.innerHTML = `<button type="button" class="btn btn--primary" id="newFollowUp"><i class="fa-solid fa-plus"></i>New follow-up</button>`;
    }

    function render() {
      const { q, f } = filters();
      const rows = DB().all('followups').filter((item) => {
        if (f && item.status !== f) return false;
        const hay = `${item.title} ${seniorName(item.seniorId)} ${item.module} ${item.status}`.toLowerCase();
        return !q || hay.includes(q);
      });
      setSummary([
        { label: 'Open', value: DB().all('followups').filter((x) => x.status === 'Open').length, icon: 'fa-folder-open', tone: 'pending' },
        { label: 'In progress', value: DB().all('followups').filter((x) => x.status === 'In Progress').length, icon: 'fa-spinner', tone: 'info' },
        { label: 'Resolved', value: DB().all('followups').filter((x) => x.status === 'Resolved').length, icon: 'fa-check', tone: 'approved' },
        { label: 'Total', value: DB().all('followups').length, icon: 'fa-list', tone: 'violet' }
      ]);
      body.innerHTML = rows.map((item) => `
        <tr>
          <td>${u().esc(item.title)}</td>
          <td>${u().esc(seniorName(item.seniorId))}</td>
          <td>${u().esc(item.module)}</td>
          <td>${u().badge(item.status)}</td>
          <td>${item.dueDate ? u().esc(u().fmtDate(item.dueDate)) : '—'}</td>
          <td class="ws-actions">${can('followup.manage') && item.status !== 'Resolved' ? `<button type="button" class="btn btn--ghost btn--sm" data-id="${u().esc(item.id)}" data-act="resolve">Resolve</button>` : ''}</td>
        </tr>`).join('') || emptyRow(6, 'No follow-ups', 'New items appear when assistance or documents need attention.');
    }

    document.getElementById('newFollowUp')?.addEventListener('click', async () => {
      const title = prompt('Follow-up title:');
      if (!title) return;
      const seniorId = prompt('Senior record ID (optional):') || '';
      const now = new Date().toISOString();
      DB().all('followups').unshift({
        id: uid('FU'), seniorId, module: 'General', relatedId: '', title,
        status: 'Open', dueDate: '', assignedTo: api().Session.get()?.name || '', notes: '',
        createdAt: now, updatedAt: now, resolvedAt: ''
      });
      await DB().log('Create', 'Follow-up Management', `Created follow-up: ${title}`);
      if (await save('Follow-up created.')) render();
    });

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act="resolve"]');
      if (!btn || !can('followup.manage')) return;
      const item = DB().all('followups').find((x) => x.id === btn.dataset.id);
      if (!item) return;
      item.status = 'Resolved';
      item.resolvedAt = new Date().toISOString();
      item.updatedAt = item.resolvedAt;
      await DB().log('Update', 'Follow-up Management', `Resolved: ${item.title}`);
      if (await save('Follow-up resolved.')) render();
    });
    bindSearch(render);
    render();
  };

  /* ---- Beneficiaries ---- */
  Pages.beneficiaries = function () {
    document.getElementById('listHeading').textContent = 'Program beneficiaries';
    document.getElementById('moduleFilter').innerHTML = `<option value="">All programs</option>` +
      DB().all('programs').map((p) => `<option value="${u().esc(p.id)}">${u().esc(p.title)}</option>`).join('');
    document.getElementById('moduleHead').innerHTML = `<tr><th>Program</th><th>Category</th><th>Senior</th><th>Attended</th><th></th></tr>`;
    const body = document.getElementById('moduleBody');

    function render() {
      const { q, f } = filters();
      const rows = [];
      DB().all('programs').forEach((p) => {
        if (f && p.id !== f) return;
        (p.beneficiaries || []).forEach((sid) => {
          rows.push({
            programId: p.id, title: p.title, category: p.category || (p.type === 'Health' ? 'Health' : 'Administrative'),
            seniorId: sid, attended: !!(p.attendance && p.attendance[sid])
          });
        });
      });
      const filtered = rows.filter((r) => {
        const hay = `${r.title} ${seniorName(r.seniorId)} ${r.category}`.toLowerCase();
        return !q || hay.includes(q);
      });
      setSummary([
        { label: 'Enrollment rows', value: rows.length, icon: 'fa-people-group', tone: 'violet' },
        { label: 'Marked attended', value: rows.filter((r) => r.attended).length, icon: 'fa-user-check', tone: 'approved' },
        { label: 'Programs', value: DB().all('programs').length, icon: 'fa-calendar', tone: 'info' },
        { label: 'Health programs', value: DB().all('programs').filter((p) => (p.category || p.type) === 'Health' || p.type === 'Health').length, icon: 'fa-heart-pulse', tone: 'pending' }
      ]);
      body.innerHTML = filtered.map((r) => `
        <tr>
          <td>${u().esc(r.title)}</td>
          <td>${u().badge(r.category, r.category === 'Health' ? 'info' : 'violet')}</td>
          <td>${u().esc(seniorName(r.seniorId))}</td>
          <td>${r.attended ? u().badge('Yes', 'approved') : u().badge('No', 'neutral')}</td>
          <td>${can('beneficiary.manage') ? `<button type="button" class="btn btn--ghost btn--sm" data-program="${u().esc(r.programId)}" data-senior="${u().esc(r.seniorId)}">Toggle attendance</button>` : ''}</td>
        </tr>`).join('') || emptyRow(5, 'No beneficiaries', 'Enroll seniors from Programs & Events.');
    }

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-program]');
      if (!btn || !can('beneficiary.manage')) return;
      const program = DB().all('programs').find((p) => p.id === btn.dataset.program);
      if (!program) return;
      program.attendance = program.attendance || {};
      program.attendance[btn.dataset.senior] = !program.attendance[btn.dataset.senior];
      await DB().log('Update', 'Beneficiary Management', `Attendance toggled for ${seniorName(btn.dataset.senior)} in ${program.title}`);
      if (await save('Attendance updated.')) render();
    });
    bindSearch(render);
    render();
  };

  /* ---- Health helpers ---- */
  function healthDisclaimer() {
    const note = document.createElement('p');
    note.className = 'ws-note health-disclaimer';
    note.textContent = 'Health modules are for documentation by authorized personnel only. They do not provide medical diagnoses or prescriptions.';
    const main = document.getElementById('main');
    main.insertBefore(note, document.getElementById('summaryStats'));
  }

  function ensureProfile(seniorId) {
    let profile = DB().all('healthProfiles').find((p) => p.seniorId === seniorId);
    if (!profile) {
      const now = new Date().toISOString();
      profile = {
        id: uid('HP'), seniorId, bloodType: '', allergies: '', medicalHistory: '',
        currentMeds: '', mobilityNotes: '', careNotes: '', updatedBy: api().Session.get()?.name || '',
        createdAt: now, updatedAt: now
      };
      DB().all('healthProfiles').push(profile);
    }
    return profile;
  }

  Pages['health-dashboard'] = function () {
    healthDisclaimer();
    document.getElementById('listHeading').textContent = 'Recent health activity';
    document.getElementById('moduleFilter').hidden = true;
    document.getElementById('moduleHead').innerHTML = `<tr><th>When</th><th>Type</th><th>Senior</th><th>Summary</th></tr>`;
    const body = document.getElementById('moduleBody');
    setSummary([
      { label: 'Health profiles', value: DB().all('healthProfiles').length, icon: 'fa-notes-medical', tone: 'violet' },
      { label: 'Assessments', value: DB().all('healthAssessments').length, icon: 'fa-file-waveform', tone: 'info' },
      { label: 'Vital readings', value: DB().all('vitalSigns').length, icon: 'fa-heart', tone: 'pending' },
      { label: 'Open referrals', value: DB().all('medicalReferrals').filter((r) => r.status === 'Pending').length, icon: 'fa-hospital', tone: 'alert' }
    ]);
    const events = [];
    DB().all('healthAssessments').slice(0, 8).forEach((a) => events.push({ at: a.assessedAt, type: 'Assessment', seniorId: a.seniorId, summary: a.generalStatus || a.findings || '—' }));
    DB().all('vitalSigns').slice(0, 8).forEach((v) => events.push({ at: v.measuredAt, type: 'Vitals', seniorId: v.seniorId, summary: `BP ${v.systolic || '—'}/${v.diastolic || '—'} · Pulse ${v.pulseRate || '—'}` }));
    DB().all('homeVisits').slice(0, 8).forEach((v) => events.push({ at: v.scheduledAt || v.createdAt, type: 'Home visit', seniorId: v.seniorId, summary: v.status }));
    DB().all('medicalReferrals').slice(0, 8).forEach((r) => events.push({ at: r.referredAt, type: 'Referral', seniorId: r.seniorId, summary: `${r.destination} · ${r.status}` }));
    events.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    body.innerHTML = events.slice(0, 20).map((e) => `
      <tr><td>${u().esc(u().fmtDateTime(e.at))}</td><td>${u().esc(e.type)}</td><td>${u().esc(seniorName(e.seniorId))}</td><td>${u().esc(e.summary)}</td></tr>
    `).join('') || emptyRow(4, 'No health activity yet', 'Start from Senior Health Profiles.');
    document.getElementById('pageActions').innerHTML = `
      <a class="btn btn--secondary" href="/HealthProfiles">Profiles</a>
      <a class="btn btn--primary" href="/VitalSigns">Record vitals</a>`;
  };

  Pages['health-profiles'] = function () {
    healthDisclaimer();
    document.getElementById('listHeading').textContent = 'Profiles linked to Senior Registry';
    document.getElementById('moduleFilter').hidden = true;
    document.getElementById('moduleHead').innerHTML = `<tr><th>Senior</th><th>Blood type</th><th>Allergies</th><th>Updated</th><th></th></tr>`;
    const body = document.getElementById('moduleBody');
    if (can('health.create') || can('health.update')) {
      document.getElementById('pageActions').innerHTML = `<button type="button" class="btn btn--primary" id="newProfile">Create / update profile</button>`;
    }

    function render() {
      const { q } = filters();
      const rows = DB().all('healthProfiles').filter((p) => {
        const hay = `${seniorName(p.seniorId)} ${p.allergies} ${p.bloodType}`.toLowerCase();
        return !q || hay.includes(q);
      });
      setSummary([
        { label: 'Profiles', value: DB().all('healthProfiles').length, icon: 'fa-notes-medical', tone: 'violet' },
        { label: 'Active seniors', value: DB().all('seniors').filter((s) => s.status === 'Active').length, icon: 'fa-users', tone: 'info' },
        { label: 'With allergies noted', value: DB().all('healthProfiles').filter((p) => p.allergies).length, icon: 'fa-triangle-exclamation', tone: 'pending' },
        { label: 'Assessments on file', value: DB().all('healthAssessments').length, icon: 'fa-file', tone: 'approved' }
      ]);
      body.innerHTML = rows.map((p) => `
        <tr>
          <td>${u().esc(seniorName(p.seniorId))}</td>
          <td>${u().esc(p.bloodType || '—')}</td>
          <td>${u().esc(p.allergies || '—')}</td>
          <td>${u().esc(u().fmtDate(p.updatedAt))}</td>
          <td>${can('health.update') ? `<button type="button" class="btn btn--ghost btn--sm" data-id="${u().esc(p.seniorId)}">Edit</button>` : ''}</td>
        </tr>`).join('') || emptyRow(5, 'No health profiles yet', 'Create a profile for a registered senior.');
    }

    async function editProfile(seniorId) {
      if (!seniorId) {
        const options = DB().all('seniors').filter((s) => s.status === 'Active');
        const pick = prompt('Enter senior OSCA ID or Record ID:');
        if (!pick) return;
        const senior = options.find((s) => s.id === pick || s.oscaId === pick);
        if (!senior) { toast('Senior not found in registry.', 'warning'); return; }
        seniorId = senior.id;
      }
      const profile = ensureProfile(seniorId);
      profile.bloodType = prompt('Blood type:', profile.bloodType || '') ?? profile.bloodType;
      profile.allergies = prompt('Allergies:', profile.allergies || '') ?? profile.allergies;
      profile.medicalHistory = prompt('Medical history:', profile.medicalHistory || '') ?? profile.medicalHistory;
      profile.currentMeds = prompt('Current medications (documentation only):', profile.currentMeds || '') ?? profile.currentMeds;
      profile.careNotes = prompt('Care notes:', profile.careNotes || '') ?? profile.careNotes;
      profile.updatedAt = new Date().toISOString();
      profile.updatedBy = api().Session.get()?.name || '';
      await DB().log('Update', 'Health Profiles', `Updated health profile for ${seniorName(seniorId)}`);
      if (await save('Health profile saved.')) render();
    }

    document.getElementById('newProfile')?.addEventListener('click', () => editProfile());
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-id]');
      if (btn) editProfile(btn.dataset.id);
    });
    bindSearch(render);
    render();
  };

  function simpleHealthCrud(config) {
    return function () {
      healthDisclaimer();
      document.getElementById('listHeading').textContent = config.title;
      document.getElementById('moduleFilter').hidden = true;
      document.getElementById('moduleHead').innerHTML = config.head;
      const body = document.getElementById('moduleBody');
      if (can(config.perm)) {
        document.getElementById('pageActions').innerHTML = `<button type="button" class="btn btn--primary" id="addHealthRow">${config.addLabel}</button>`;
      }

      function render() {
        const { q } = filters();
        const rows = DB().all(config.collection).filter((row) => {
          const hay = `${seniorName(row.seniorId)} ${config.search(row)}`.toLowerCase();
          return !q || hay.includes(q);
        });
        setSummary(config.summary());
        body.innerHTML = rows.map(config.row).join('') || emptyRow(config.cols, config.empty, '');
      }

      document.getElementById('addHealthRow')?.addEventListener('click', async () => {
        const ok = await config.create();
        if (ok && await save(config.saved)) render();
        else if (ok === false) render();
      });
      bindSearch(render);
      render();
    };
  }

  Pages['health-assessments'] = simpleHealthCrud({
    title: 'Assessment history',
    collection: 'healthAssessments',
    perm: 'health.assessment',
    addLabel: 'New assessment',
    cols: 5,
    empty: 'No assessments recorded',
    head: `<tr><th>Date</th><th>Senior</th><th>Status</th><th>Findings</th><th>By</th></tr>`,
    search: (a) => `${a.generalStatus} ${a.findings} ${a.assessedBy}`,
    summary: () => [
      { label: 'Assessments', value: DB().all('healthAssessments').length, icon: 'fa-file-waveform', tone: 'violet' },
      { label: 'Need follow-up', value: DB().all('healthAssessments').filter((a) => a.followUpNeeded).length, icon: 'fa-flag', tone: 'pending' },
      { label: 'This month', value: DB().all('healthAssessments').filter((a) => String(a.assessedAt).slice(0, 7) === new Date().toISOString().slice(0, 7)).length, icon: 'fa-calendar', tone: 'info' },
      { label: 'Profiles', value: DB().all('healthProfiles').length, icon: 'fa-notes-medical', tone: 'approved' }
    ],
    row: (a) => `<tr><td>${u().esc(u().fmtDate(a.assessedAt))}</td><td>${u().esc(seniorName(a.seniorId))}</td><td>${u().esc(a.generalStatus || '—')}</td><td>${u().esc(a.findings || '—')}</td><td>${u().esc(a.assessedBy || '—')}</td></tr>`,
    saved: 'Assessment recorded.',
    async create() {
      const pick = prompt('Senior OSCA ID or Record ID:');
      const senior = DB().all('seniors').find((s) => s.id === pick || s.oscaId === pick);
      if (!senior) { toast('Senior not found.', 'warning'); return false; }
      ensureProfile(senior.id);
      const now = new Date().toISOString();
      DB().all('healthAssessments').unshift({
        id: uid('HA'), seniorId: senior.id, assessedAt: now, assessedBy: api().Session.get()?.name || '',
        generalStatus: prompt('General status:', 'Stable') || 'Stable',
        findings: prompt('Findings / observations:', '') || '',
        recommendations: prompt('Recommendations:', '') || '',
        followUpNeeded: confirm('Follow-up needed?'),
        createdAt: now
      });
      await DB().log('Create', 'Health Assessments', `Assessment for ${u().displayName(senior)}`);
      return true;
    }
  });

  Pages.vitals = simpleHealthCrud({
    title: 'Vital signs log',
    collection: 'vitalSigns',
    perm: 'health.vitals',
    addLabel: 'Record vitals',
    cols: 6,
    empty: 'No vital signs recorded',
    head: `<tr><th>When</th><th>Senior</th><th>BP</th><th>Pulse</th><th>Temp °C</th><th>Weight kg</th></tr>`,
    search: (v) => `${v.measuredBy} ${v.remarks}`,
    summary: () => [
      { label: 'Readings', value: DB().all('vitalSigns').length, icon: 'fa-heart', tone: 'violet' },
      { label: 'Seniors measured', value: new Set(DB().all('vitalSigns').map((v) => v.seniorId)).size, icon: 'fa-users', tone: 'info' },
      { label: 'Home visits', value: DB().all('homeVisits').length, icon: 'fa-house', tone: 'pending' },
      { label: 'Referrals', value: DB().all('medicalReferrals').length, icon: 'fa-hospital', tone: 'approved' }
    ],
    row: (v) => `<tr><td>${u().esc(u().fmtDateTime(v.measuredAt))}</td><td>${u().esc(seniorName(v.seniorId))}</td><td>${u().esc(`${v.systolic || '—'}/${v.diastolic || '—'}`)}</td><td>${u().esc(v.pulseRate ?? '—')}</td><td>${u().esc(v.temperatureC ?? '—')}</td><td>${u().esc(v.weightKg ?? '—')}</td></tr>`,
    saved: 'Vital signs saved.',
    async create() {
      const pick = prompt('Senior OSCA ID or Record ID:');
      const senior = DB().all('seniors').find((s) => s.id === pick || s.oscaId === pick);
      if (!senior) { toast('Senior not found.', 'warning'); return false; }
      const now = new Date().toISOString();
      DB().all('vitalSigns').unshift({
        id: uid('VS'), seniorId: senior.id, measuredAt: now, measuredBy: api().Session.get()?.name || '',
        systolic: Number(prompt('Systolic:', '120') || 0) || null,
        diastolic: Number(prompt('Diastolic:', '80') || 0) || null,
        pulseRate: Number(prompt('Pulse rate:', '72') || 0) || null,
        temperatureC: Number(prompt('Temperature °C:', '36.5') || 0) || null,
        weightKg: Number(prompt('Weight kg:', '') || 0) || null,
        bloodSugar: null, oxygenSat: null, remarks: prompt('Remarks:', '') || '', createdAt: now
      });
      await DB().log('Create', 'Vital Signs', `Vitals recorded for ${u().displayName(senior)}`);
      return true;
    }
  });

  Pages['home-visits'] = simpleHealthCrud({
    title: 'Home visits',
    collection: 'homeVisits',
    perm: 'health.home_visit',
    addLabel: 'Schedule visit',
    cols: 5,
    empty: 'No home visits',
    head: `<tr><th>Scheduled</th><th>Senior</th><th>Status</th><th>Assigned</th><th>Observations</th></tr>`,
    search: (v) => `${v.status} ${v.assignedTo} ${v.observations}`,
    summary: () => [
      { label: 'Scheduled', value: DB().all('homeVisits').filter((v) => v.status === 'Scheduled').length, icon: 'fa-calendar', tone: 'pending' },
      { label: 'Completed', value: DB().all('homeVisits').filter((v) => v.status === 'Completed').length, icon: 'fa-check', tone: 'approved' },
      { label: 'Missed', value: DB().all('homeVisits').filter((v) => v.status === 'Missed').length, icon: 'fa-xmark', tone: 'alert' },
      { label: 'Total', value: DB().all('homeVisits').length, icon: 'fa-house-chimney-medical', tone: 'violet' }
    ],
    row: (v) => `<tr><td>${u().esc(u().fmtDate(v.scheduledAt || v.createdAt))}</td><td>${u().esc(seniorName(v.seniorId))}</td><td>${u().badge(v.status)}</td><td>${u().esc(v.assignedTo || '—')}</td><td>${u().esc(v.observations || '—')}</td></tr>`,
    saved: 'Home visit saved.',
    async create() {
      const pick = prompt('Senior OSCA ID or Record ID:');
      const senior = DB().all('seniors').find((s) => s.id === pick || s.oscaId === pick);
      if (!senior) { toast('Senior not found.', 'warning'); return false; }
      const now = new Date().toISOString();
      DB().all('homeVisits').unshift({
        id: uid('HV'), seniorId: senior.id, scheduledAt: prompt('Scheduled date (YYYY-MM-DD):', now.slice(0, 10)) || now.slice(0, 10),
        completedAt: '', assignedTo: api().Session.get()?.name || '', status: 'Scheduled',
        observations: '', followUpActions: '', createdAt: now, updatedAt: now
      });
      await DB().log('Create', 'Home Visits', `Scheduled visit for ${u().displayName(senior)}`);
      return true;
    }
  });

  Pages.referrals = simpleHealthCrud({
    title: 'Medical referrals',
    collection: 'medicalReferrals',
    perm: 'health.referral',
    addLabel: 'New referral',
    cols: 5,
    empty: 'No referrals',
    head: `<tr><th>Date</th><th>Senior</th><th>Destination</th><th>Reason</th><th>Status</th></tr>`,
    search: (r) => `${r.destination} ${r.reason} ${r.status}`,
    summary: () => [
      { label: 'Pending', value: DB().all('medicalReferrals').filter((r) => r.status === 'Pending').length, icon: 'fa-clock', tone: 'pending' },
      { label: 'Completed', value: DB().all('medicalReferrals').filter((r) => r.status === 'Completed').length, icon: 'fa-check', tone: 'approved' },
      { label: 'Cancelled', value: DB().all('medicalReferrals').filter((r) => r.status === 'Cancelled').length, icon: 'fa-ban', tone: 'neutral' },
      { label: 'Total', value: DB().all('medicalReferrals').length, icon: 'fa-hospital', tone: 'violet' }
    ],
    row: (r) => `<tr><td>${u().esc(u().fmtDate(r.referredAt))}</td><td>${u().esc(seniorName(r.seniorId))}</td><td>${u().esc(r.destination)}</td><td>${u().esc(r.reason || '—')}</td><td>${u().badge(r.status)}</td></tr>`,
    saved: 'Referral recorded.',
    async create() {
      const pick = prompt('Senior OSCA ID or Record ID:');
      const senior = DB().all('seniors').find((s) => s.id === pick || s.oscaId === pick);
      if (!senior) { toast('Senior not found.', 'warning'); return false; }
      const now = new Date().toISOString();
      DB().all('medicalReferrals').unshift({
        id: uid('MR'), seniorId: senior.id, referredAt: now, referredBy: api().Session.get()?.name || '',
        destination: prompt('Destination:', 'Barangay Health Center') || 'Barangay Health Center',
        reason: prompt('Reason:', '') || '', status: 'Pending', followUpNotes: '', updatedAt: now
      });
      await DB().log('Create', 'Medical Referrals', `Referral for ${u().displayName(senior)}`);
      return true;
    }
  });

  Pages['health-programs'] = function () {
    healthDisclaimer();
    document.getElementById('listHeading').textContent = 'Health-category programs';
    document.getElementById('moduleFilter').hidden = true;
    document.getElementById('moduleHead').innerHTML = `<tr><th>Program</th><th>Date</th><th>Venue</th><th>Participants</th><th>Attended</th></tr>`;
    const body = document.getElementById('moduleBody');
    const programs = () => DB().all('programs').filter((p) => p.category === 'Health' || p.type === 'Health');
    function render() {
      const { q } = filters();
      const rows = programs().filter((p) => !q || `${p.title} ${p.venue}`.toLowerCase().includes(q));
      setSummary([
        { label: 'Health programs', value: programs().length, icon: 'fa-calendar-plus', tone: 'violet' },
        { label: 'Participants', value: programs().reduce((n, p) => n + (p.beneficiaries || []).length, 0), icon: 'fa-users', tone: 'info' },
        { label: 'Upcoming', value: programs().filter((p) => !p.cancelled && p.date >= new Date().toISOString().slice(0, 10)).length, icon: 'fa-clock', tone: 'pending' },
        { label: 'Cancelled', value: programs().filter((p) => p.cancelled).length, icon: 'fa-ban', tone: 'neutral' }
      ]);
      body.innerHTML = rows.map((p) => {
        const attended = Object.values(p.attendance || {}).filter(Boolean).length;
        return `<tr><td>${u().esc(p.title)}</td><td>${u().esc(u().fmtDate(p.date))}</td><td>${u().esc(p.venue || '—')}</td><td>${(p.beneficiaries || []).length}</td><td>${attended}</td></tr>`;
      }).join('') || emptyRow(5, 'No health programs', 'Create a program with type Health under Programs & Events.');
    }
    document.getElementById('pageActions').innerHTML = `<a class="btn btn--secondary" href="/ProgramManagement">Open Programs & Events</a>
      <a class="btn btn--primary" href="/BeneficiaryManagement">Manage attendance</a>`;
    bindSearch(render);
    render();
  };

  Pages['health-reports'] = function () {
    healthDisclaimer();
    document.getElementById('summaryStats').remove();
    document.getElementById('listHeading').textContent = 'Export health summaries';
    document.getElementById('moduleFilter').hidden = true;
    document.getElementById('moduleSearch').hidden = true;
    document.getElementById('moduleHead').innerHTML = `<tr><th>Report</th><th>Rows</th><th></th></tr>`;
    const body = document.getElementById('moduleBody');
    const reports = [
      { name: 'Health assessments', rows: () => DB().all('healthAssessments'), cols: (a) => [a.assessedAt, seniorName(a.seniorId), a.generalStatus, a.findings, a.assessedBy] },
      { name: 'Vital signs', rows: () => DB().all('vitalSigns'), cols: (v) => [v.measuredAt, seniorName(v.seniorId), v.systolic, v.diastolic, v.pulseRate, v.temperatureC, v.weightKg] },
      { name: 'Home visits', rows: () => DB().all('homeVisits'), cols: (v) => [v.scheduledAt, seniorName(v.seniorId), v.status, v.assignedTo, v.observations] },
      { name: 'Medical referrals', rows: () => DB().all('medicalReferrals'), cols: (r) => [r.referredAt, seniorName(r.seniorId), r.destination, r.reason, r.status] }
    ];
    body.innerHTML = reports.map((r, i) => `
      <tr><td>${u().esc(r.name)}</td><td>${r.rows().length}</td>
      <td>${can('report.export') ? `<button type="button" class="btn btn--ghost btn--sm" data-i="${i}">Export CSV</button>` : ''}</td></tr>`).join('');
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]');
      if (!btn || !can('report.export')) return;
      const report = reports[Number(btn.dataset.i)];
      api().downloadCSV(`${report.name.replace(/\s+/g, '_').toLowerCase()}.csv`, [
        ['Generated'],
        ...report.rows().map(report.cols)
      ]);
      toast('CSV downloaded.', 'success');
    });
  };

  /* ---- Admin: Role permissions ---- */
  Pages.roles = function () {
    document.getElementById('summaryStats').innerHTML = '';
    document.querySelector('.card').innerHTML = `
      <header class="card__header"><div><h2 class="card__title">Permission matrix</h2>
      <p class="card__subtitle">Changes apply immediately to backend authorization</p></div></header>
      <div class="role-tabs" id="roleTabs"></div>
      <div class="perm-grid" id="permGrid"></div>
      <div class="page-actions" style="margin-top:1rem">
        <button type="button" class="btn btn--primary" id="savePerms" data-perm="roles.manage">Save role permissions</button>
        <button type="button" class="btn btn--secondary" id="resetPerms">Reset to defaults</button>
      </div>`;
    let currentRole = 'Administrator';
    let matrix = {};
    let allPerms = [];

    async function load() {
      const res = await fetch('/api/permissions', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const body = await res.json();
      if (!res.ok) { toast(body.errors?.form || 'Cannot load permissions.', 'error'); return; }
      matrix = body.roles || {};
      allPerms = body.permissions || [];
      window.__permDefaults = body.defaults || {};
      render();
    }

    function render() {
      document.getElementById('roleTabs').innerHTML = ['Administrator', 'Barangay Staff', 'Health Worker'].map((role) => `
        <button type="button" class="btn ${role === currentRole ? 'btn--primary' : 'btn--secondary'} btn--sm" data-role="${role}">${role}</button>`).join('');
      const selected = new Set(matrix[currentRole] || []);
      document.getElementById('permGrid').innerHTML = allPerms.map((code) => `
        <label><input type="checkbox" value="${u().esc(code)}" ${selected.has(code) ? 'checked' : ''}> <span>${u().esc(code)}</span></label>`).join('');
    }

    document.getElementById('roleTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-role]');
      if (!btn) return;
      currentRole = btn.dataset.role;
      render();
    });

    document.getElementById('savePerms').addEventListener('click', async () => {
      const codes = Array.from(document.querySelectorAll('#permGrid input:checked')).map((el) => el.value);
      const res = await fetch(`/api/permissions/${encodeURIComponent(currentRole)}`, {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ permissions: codes })
      });
      const body = await res.json();
      if (!res.ok) { toast(body.errors?.form || 'Save failed.', 'error'); return; }
      matrix[currentRole] = body.permissions;
      toast(`Permissions saved for ${currentRole}.`, 'success');
    });

    document.getElementById('resetPerms').addEventListener('click', () => {
      matrix[currentRole] = (window.__permDefaults || {})[currentRole] || [];
      render();
      toast('Form reset to defaults. Click Save to apply.', 'info');
    });

    load();
  };

  /* ---- Security monitoring ---- */
  Pages.security = function () {
    document.getElementById('listHeading').textContent = 'Authentication and security events';
    document.getElementById('moduleFilter').innerHTML = `<option value="">All</option><option>Failed Login</option><option>Login</option><option>Logout</option>`;
    document.getElementById('moduleHead').innerHTML = `<tr><th>When</th><th>User</th><th>Action</th><th>Details</th><th>IP</th><th>Severity</th></tr>`;
    const body = document.getElementById('moduleBody');
    function render() {
      const { q, f } = filters();
      const rows = DB().all('logs').filter((l) => {
        const security = ['Failed Login', 'Login', 'Logout', 'Access'].includes(l.action) || l.module === 'Authentication' || l.severity === 'Warning' || l.severity === 'Critical';
        if (!security) return false;
        if (f && l.action !== f) return false;
        const hay = `${l.user} ${l.action} ${l.details} ${l.ip}`.toLowerCase();
        return !q || hay.includes(q);
      });
      setSummary([
        { label: 'Failed logins', value: DB().all('logs').filter((l) => l.action === 'Failed Login').length, icon: 'fa-user-xmark', tone: 'alert' },
        { label: 'Successful logins', value: DB().all('logs').filter((l) => l.action === 'Login').length, icon: 'fa-right-to-bracket', tone: 'approved' },
        { label: 'Warnings', value: DB().all('logs').filter((l) => l.severity === 'Warning').length, icon: 'fa-triangle-exclamation', tone: 'pending' },
        { label: 'Health record access', value: DB().all('logs').filter((l) => l.module === 'Health Records').length, icon: 'fa-shield-halved', tone: 'info' }
      ]);
      body.innerHTML = rows.slice(0, 200).map((l) => `
        <tr><td>${u().esc(u().fmtDateTime(l.ts))}</td><td>${u().esc(l.user)}</td><td>${u().esc(l.action)}</td>
        <td>${u().esc(l.details)}</td><td>${u().esc(l.ip || '—')}</td><td>${u().badge(l.severity || 'Info')}</td></tr>
      `).join('') || emptyRow(6, 'No security events', '');
    }
    bindSearch(render);
    render();
  };

  /* ---- Office records overview (admin read-only) ---- */
  Pages['office-records'] = function () {
    document.getElementById('listHeading').textContent = 'Supervisory overview';
    document.getElementById('moduleFilter').innerHTML = `<option value="seniors">Seniors</option><option value="assistance">Assistance</option><option value="programs">Programs</option>`;
    document.getElementById('moduleHead').innerHTML = `<tr><th>Record</th><th>Details</th><th>Status</th></tr>`;
    const body = document.getElementById('moduleBody');
    const note = document.createElement('p');
    note.className = 'ws-note';
    note.textContent = 'Administrator view is read-only for operational records. Use Staff Accounts and Role & Permissions for system administration.';
    document.getElementById('main').insertBefore(note, document.getElementById('summaryStats'));

    function render() {
      const { q, f } = filters();
      const kind = f || 'seniors';
      let rows = [];
      if (kind === 'assistance') {
        rows = DB().all('assistance').map((a) => ({ name: a.id, details: `${seniorName(a.seniorId)} · ${a.type} · ₱${a.amount}`, status: a.status }));
      } else if (kind === 'programs') {
        rows = DB().all('programs').map((p) => ({ name: p.title, details: `${p.type} · ${p.date} · ${(p.beneficiaries || []).length} participants`, status: p.cancelled ? 'Cancelled' : 'Active' }));
      } else {
        rows = DB().all('seniors').map((s) => ({ name: u().displayName(s), details: `${s.oscaId} · ${s.purok || ''} · ${s.pension || 'None'}`, status: s.status }));
      }
      rows = rows.filter((r) => !q || `${r.name} ${r.details} ${r.status}`.toLowerCase().includes(q));
      setSummary([
        { label: 'Seniors', value: DB().all('seniors').length, icon: 'fa-users', tone: 'violet' },
        { label: 'Assistance requests', value: DB().all('assistance').length, icon: 'fa-hand-holding-medical', tone: 'pending' },
        { label: 'Programs', value: DB().all('programs').length, icon: 'fa-calendar', tone: 'info' },
        { label: 'Documents tracked', value: DB().all('documents').length, icon: 'fa-file', tone: 'approved' }
      ]);
      body.innerHTML = rows.slice(0, 100).map((r) => `
        <tr><td>${u().esc(r.name)}</td><td>${u().esc(r.details)}</td><td>${u().badge(r.status)}</td></tr>
      `).join('') || emptyRow(3, 'No records', '');
    }
    bindSearch(render);
    render();
  };

  window.WorkspacePages = Pages;
})();
