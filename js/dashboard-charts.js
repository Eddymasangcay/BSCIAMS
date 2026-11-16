/* ==========================================================================
   dashboard-charts.js: Chart.js for Staff, Admin, and Health dashboards
   ========================================================================== */
(function () {
  'use strict';

  function rgba(hex, alpha) {
    const h = String(hex || '').replace('#', '');
    if (!h) return `rgba(36, 71, 107, ${alpha})`;
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(36, 71, 107, ${alpha})`;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  function monthKey(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function initStaffCharts(App, theme) {
    const canvases = {
      registrations: document.getElementById('registrationsChart'),
      aidType: document.getElementById('aidTypeChart'),
      purok: document.getElementById('purokChart')
    };
    if (!canvases.registrations && !canvases.aidType && !canvases.purok) return;

    const { DB, utils, constants } = App;
    const seniors = DB.all('seniors');
    const assistance = DB.all('assistance');
    const months = App.monthKeys(12);

    if (canvases.registrations) {
      const counts = months.map((m) => seniors.filter((s) => monthKey(s.registeredAt) === m.key).length);
      const total = counts.reduce((a, b) => a + b, 0);
      const badge = document.getElementById('regTotalBadge');
      if (badge) badge.textContent = `${utils.fmtNumber(total)} in 12 months`;

      new Chart(canvases.registrations, {
        type: 'line',
        data: {
          labels: months.map((m) => m.label),
          datasets: [{
            label: 'New registrations',
            data: counts,
            borderColor: theme.primary,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            backgroundColor: (ctx) => {
              const { chart } = ctx;
              const area = chart.chartArea;
              if (!area) return 'transparent';
              const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
              g.addColorStop(0, rgba(theme.primary, 0.16));
              g.addColorStop(1, rgba(theme.primary, 0));
              return g;
            },
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: theme.surface || '#fff',
            pointBorderColor: theme.primary,
            pointBorderWidth: 2
          }]
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, border: { display: false } },
            y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: theme.border }, border: { display: false } }
          }
        }
      });
    }

    if (canvases.aidType) {
      const since = new Date(); since.setFullYear(since.getFullYear() - 1);
      const recent = assistance.filter((a) => a.requestedAt && new Date(a.requestedAt) >= since);
      const counts = constants.AID_TYPES.map((t) => recent.filter((a) => a.type === t).length);
      const total = counts.reduce((a, b) => a + b, 0);

      const centerText = {
        id: 'centerText',
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          const x = (chartArea.left + chartArea.right) / 2;
          const y = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = App.cssVar('--text-dark');
          ctx.font = '700 24px Inter, sans-serif';
          ctx.fillText(String(total), x, y - 8);
          ctx.fillStyle = theme.muted;
          ctx.font = '500 11px Inter, sans-serif';
          ctx.fillText('requests', x, y + 13);
          ctx.restore();
        }
      };

      new Chart(canvases.aidType, {
        type: 'doughnut',
        data: {
          labels: constants.AID_TYPES,
          datasets: [{
            data: counts,
            backgroundColor: [theme.palette[0], theme.palette[1], theme.palette[2], theme.approved, theme.pending],
            borderColor: theme.surface || (theme.isDark ? '#1E293B' : '#fff'),
            borderWidth: 3,
            hoverOffset: 4
          }]
        },
        options: {
          cutout: '70%',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${total ? Math.round((ctx.parsed / total) * 100) : 0}%)`
              }
            }
          }
        },
        plugins: [centerText]
      });
    }

    if (canvases.purok) {
      const active = seniors.filter((s) => s.status === 'Active');
      const bySex = (sex) => constants.PUROKS.map((p) => active.filter((s) => s.purok === p && s.sex === sex).length);

      new Chart(canvases.purok, {
        type: 'bar',
        data: {
          labels: constants.PUROKS.map((p) => p.replace('Purok ', 'P')),
          datasets: [
            { label: 'Female', data: bySex('Female'), backgroundColor: theme.primary, borderRadius: 4, maxBarThickness: 22 },
            { label: 'Male', data: bySex('Male'), backgroundColor: theme.palette[1], borderRadius: 4, maxBarThickness: 22 }
          ]
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { title: (items) => constants.PUROKS[items[0].dataIndex] } }
          },
          scales: {
            x: { stacked: true, grid: { display: false }, border: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: theme.border }, border: { display: false } }
          }
        }
      });
    }
  }

  function initAdminCharts(App, theme) {
    const canvas = document.getElementById('loginActivityChart');
    if (!canvas) return;

    const logs = App.DB.all('logs') || [];
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return d;
    });
    const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const labels = days.map((d) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }));
    const success = days.map((d) => logs.filter((l) => l.action === 'Login' && keyOf(new Date(l.ts)) === keyOf(d)).length);
    const failed = days.map((d) => logs.filter((l) => l.action === 'Failed Login' && keyOf(new Date(l.ts)) === keyOf(d)).length);

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Successful', data: success, backgroundColor: theme.palette[1], borderRadius: 4, maxBarThickness: 18 },
          { label: 'Failed', data: failed, backgroundColor: theme.alert || theme.palette[5], borderRadius: 4, maxBarThickness: 18 }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: false, grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: theme.border }, border: { display: false } }
        }
      }
    });
  }

  function initHealthCharts(App, theme) {
    const canvas = document.getElementById('healthActivityChart');
    if (!canvas) return;

    const assessments = App.DB.all('healthAssessments') || [];
    const vitals = App.DB.all('vitalSigns') || [];
    const months = App.monthKeys(6);
    const assessCounts = months.map((m) => assessments.filter((a) => monthKey(a.assessedAt) === m.key).length);
    const vitalCounts = months.map((m) => vitals.filter((v) => monthKey(v.measuredAt) === m.key).length);

    new Chart(canvas, {
      type: 'line',
      data: {
        labels: months.map((m) => m.label),
        datasets: [
          {
            label: 'Assessments',
            data: assessCounts,
            borderColor: theme.primary,
            backgroundColor: rgba(theme.primary, 0.12),
            borderWidth: 2,
            tension: 0.35,
            fill: false,
            pointRadius: 3,
            pointBackgroundColor: theme.surface || '#fff',
            pointBorderColor: theme.primary
          },
          {
            label: 'Vital readings',
            data: vitalCounts,
            borderColor: theme.palette[1],
            backgroundColor: rgba(theme.palette[1], 0.12),
            borderWidth: 2,
            tension: 0.35,
            fill: false,
            pointRadius: 3,
            pointBackgroundColor: theme.surface || '#fff',
            pointBorderColor: theme.palette[1]
          }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: theme.border }, border: { display: false } }
        }
      }
    });
  }

  function initDashboardCharts() {
    const App = window.App;
    if (!App || !App.ready) return;

    const page = document.body.dataset.page || '';
    const needsChart = ['dashboard', 'admin-dashboard', 'health-dashboard'].includes(page);
    if (!needsChart) return;

    const theme = App.chartTheme();
    if (!theme) {
      ['registrationsChart', 'aidTypeChart', 'purokChart', 'loginActivityChart', 'healthActivityChart']
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .forEach((c) => App.chartFallback(c));
      return;
    }

    if (page === 'dashboard') initStaffCharts(App, theme);
    if (page === 'admin-dashboard') initAdminCharts(App, theme);
    if (page === 'health-dashboard') initHealthCharts(App, theme);
  }

  if (window.App && window.App.ready) initDashboardCharts();
  else document.addEventListener('bscims:ready', initDashboardCharts, { once: true });
})();
