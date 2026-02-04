// ===================== SmartAdmin A2 Dashboard ===================== //
// Robust CSV parser (quoted commas)
function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]; const next = text[i+1];
    if (char === '"' && !inQuotes) { inQuotes = true; continue; }
    if (char === '"' && inQuotes) {
      if (next === '"') { cur += '"'; i++; continue; }
      inQuotes = false; continue;
    }
    if (char === ',' && !inQuotes) { row.push(cur); cur = ''; continue; }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (cur.length || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; }
      if (char === '\r' && next === '\n') i++; continue;
    }
    cur += char;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// Normalize various repo inputs to { ownerRepo, url }
function normalizeRepoRef(raw) {
  if (!raw) return null; let s = String(raw).trim();
  s = s.replace(/\"|\'|`/g,'').trim();
  s = s.replace(/\.git$/i, '').replace(/\/+$/, '');
  const full = s.match(/^https?:\/\/(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s]+)/i);
  if (full) return { ownerRepo: `${full[1]}/${full[2]}`, url: `https://github.com/${full[1]}/${full[2]}` };
  const path = s.match(/^(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s]+)/i);
  if (path) return { ownerRepo: `${path[1]}/${path[2]}`, url: `https://github.com/${path[1]}/${path[2]}` };
  const or = s.match(/^([^\/\s]+)\/([^\/\s]+)$/);
  if (or) return { ownerRepo: `${or[1]}/${or[2]}`, url: `https://github.com/${or[1]}/${or[2]}` };
  return null;
}

function prettyHeader(h) {
  const map = {
    open_prs: 'Open PRs',
    closed_prs_last_30: 'Closed PRs (30d)',
    merged_prs_last_30: 'Merged PRs (30d)',
    contributors_total: 'Contributors (Total)',
    contributors_active_30_days: 'Contributors Active (30d)',
    repo_size_kb: 'Repo Size (KB)',
    default_branch: 'Default Branch',
    last_update: 'Last Update',
    last_commit: 'Last Commit',
    latest_release: 'Latest Release',
    release_downloads: 'Release Downloads'
  };
  if (map[h]) return map[h];
  return h.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

$(document).ready(function(){
  // Theme toggle
  const savedTheme = localStorage.getItem('ccg-theme');
  if (savedTheme === 'dark') document.body.setAttribute('data-theme','dark');
  $('#themeToggle').on('click', ()=>{
    const dark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', dark ? '' : 'dark');
    localStorage.setItem('ccg-theme', dark ? 'light' : 'dark');
  });

  // Load CSV
  $.get('github_metrics.csv', function(data){
    const rows = parseCSV(data.trim());
    if (!rows || rows.length < 2) { console.error('CSV empty or malformed'); return; }
    const headers = rows[0];
    const tableData = rows.slice(1);

    // Column map (by header name)
    const COL = {
      repository: headers.indexOf('repository'),
      description: headers.indexOf('description'),
      topics: headers.indexOf('topics'),
      default_branch: headers.indexOf('default_branch'),
      license: headers.indexOf('license'),
      stars: headers.indexOf('stars'),
      forks: headers.indexOf('forks'),
      watchers: headers.indexOf('watchers'),
      open_issues: headers.indexOf('open_issues'),
      open_prs: headers.indexOf('open_prs'),
      closed_prs_30: headers.indexOf('closed_prs_last_30'),
      merged_prs_30: headers.indexOf('merged_prs_last_30'),
      contributors_total: headers.indexOf('contributors_total'),
      contributors_active_30: headers.indexOf('contributors_active_30_days'),
      last_commit: headers.indexOf('last_commit'),
      last_update: headers.indexOf('last_update'),
      latest_release: headers.indexOf('latest_release'),
      release_downloads: headers.indexOf('release_downloads'),
      repo_size_kb: headers.indexOf('repo_size_kb')
    };

    // KPI
    const num = v => Number(v) || 0;
    const totalStars = tableData.reduce((s,r)=> s + num(r[COL.stars]), 0);
    const totalForks = tableData.reduce((s,r)=> s + num(r[COL.forks]), 0);
    $('#kpiStars').text(totalStars.toLocaleString('bs-BA'));
    $('#kpiForks').text(totalForks.toLocaleString('bs-BA'));
    $('#kpiRepos').text(tableData.length.toLocaleString('bs-BA'));

    // Default visible set
    const DEFAULT_VISIBLE = new Set([
      COL.description, COL.license, COL.stars, COL.forks, COL.last_update
    ]);

    // Build DataTable
    const dt = $('#metricsTable').DataTable({
      data: tableData,
      columns: headers.map((h,i)=>({
        title: prettyHeader(h),
        className: (
          i === COL.repository ? 'repo-cell noVis' :
          i === COL.description ? 'desc-cell' : ''
        ),
        render: function(data, type, row) {
          // Repository link
          if (i === COL.repository) {
            const raw = (row[COL.repository] || '').trim();
            const norm = normalizeRepoRef(raw) || { ownerRepo: raw, url: `https://github.com/${raw}` };
            if (!norm.ownerRepo) return '';
            return `<a href="${norm.url}" target="_blank" rel="noopener noreferrer">${norm.ownerRepo}</a>`;
          }
          // Topics badges
          if (i === COL.topics) {
            const val = (row[i] || '').trim(); if (!val) return '';
            // Split on | or ; or ,
            const parts = val.split(/\||;|,/).map(s=>s.trim()).filter(Boolean);
            if (!parts.length) return '';
            return `<div class="badges">${parts.map(t=>`<span class="badge topic"><i class="fa fa-tag"></i>${t}</span>`).join('')}</div>`;
          }
          // License badge
          if (i === COL.license) {
            const lic = (row[i] || '').trim(); if (!lic) return '';
            return `<span class="badge license"><i class="fa fa-scale-balanced"></i>${lic}</span>`;
          }
          return data;
        }
      })),
      dom: 'Bfrtip',
      buttons: [
        { extend: 'colvis', text: 'Columns', columns: ':not(.noVis)' },
        { text: 'Core', action: function(){ dt.columns().visible(false); dt.column(COL.repository).visible(true); DEFAULT_VISIBLE.forEach(c=> dt.column(c).visible(true)); } },
        { text: 'Activity', action: function(){ dt.columns().visible(false); [COL.repository, COL.watchers, COL.open_issues, COL.open_prs, COL.closed_prs_30, COL.merged_prs_30, COL.last_commit, COL.last_update].forEach(c=> dt.column(c).visible(true)); } },
        { text: 'Contributors', action: function(){ dt.columns().visible(false); [COL.repository, COL.contributors_total, COL.contributors_active_30].forEach(c=> dt.column(c).visible(true)); } },
        { text: 'Releases', action: function(){ dt.columns().visible(false); [COL.repository, COL.latest_release, COL.release_downloads].forEach(c=> dt.column(c).visible(true)); } },
        { text: 'Show All', action: function(){ dt.columns().visible(true); } }
      ],
      stateSave: true,
      pageLength: 25,
      autoWidth: false,
      fixedHeader: true,
      fixedColumns: { leftColumns: 1 },
      columnDefs: [
        { targets: COL.repository, width: 440,  className: 'repo-cell noVis'},
        { targets: COL.description, width: 520, className: 'desc-cell' },
        { targets: [COL.stars, COL.forks, COL.watchers, COL.open_issues, COL.open_prs, COL.closed_prs_30, COL.merged_prs_30, COL.contributors_total, COL.contributors_active_30, COL.release_downloads, COL.repo_size_kb], className: 'dt-body-right' }
      ]
    });

    // Move DT buttons into header toolbar
    dt.buttons().container().appendTo('#toolbar .actions');

    // Ensure initial visibility
    dt.on('init', function(){
      dt.columns().every(function(idx){
        const isRepo = (idx === COL.repository);
        this.visible(isRepo || DEFAULT_VISIBLE.has(idx));
      });
    });

    // Chart
    const safeNum = v => Number(v) || 0;
    const repos = tableData.map(r => r[COL.repository] || '');
    const stars = tableData.map(r => safeNum(r[COL.stars]));
    const forks = tableData.map(r => safeNum(r[COL.forks]));
    new Chart(document.getElementById('metricsChart'), {
      type: 'bar',
      data: { labels: repos, datasets: [
        { label: 'Stars', data: stars, backgroundColor: '#3A3F51' },
        { label: 'Forks', data: forks, backgroundColor: '#71A06A' }
      ]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 } }, y: { beginAtZero: true } }
      }
    });
  });
});
