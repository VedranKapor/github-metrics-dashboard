// $(document).ready(function () {

//     $.get('github_metrics.csv', function (data) {

//         // Parse CSV
//         let rows = data.trim().split('\n');
//         let headers = rows[0].split(',');

//         let tableData = rows.slice(1).map(row => row.split(','));

//         // Build dynamic DataTable
//         $('#metricsTable').DataTable({
//             data: tableData,
//             columns: headers.map(h => ({ title: h })),
//             pageLength: 25
//         });

//         // Extract chart data
//         let repos = tableData.map(r => r[0]);      // repository column
//         let stars = tableData.map(r => Number(r[5])); // stars column
//         let forks = tableData.map(r => Number(r[6])); // forks column
//         let downloads = tableData.map(r => Number(r[17])); // downloads

//         // Render Chart
//         new Chart(document.getElementById('metricsChart'), {
//             type: 'bar',
//             data: {
//                 labels: repos,
//                 datasets: [
//                     {
//                         label: 'Stars',
//                         data: stars,
//                         backgroundColor: '#3a3f51'
//                     },
//                     {
//                         label: 'Forks',
//                         data: forks,
//                         backgroundColor: '#71a06a'
//                     }
//                     // ,
//                     // {
//                     //     label: 'Downloads',
//                     //     data: downloads,
//                     //     backgroundColor: '#58A4B0'
//                     // }
//                 ]
//             },
//             options: {
//                 responsive: true,
//                 maintainAspectRatio: false,
//                 scales: {
//                     x: { ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 } },
//                     y: { beginAtZero: true }
//                 }
//             }
//         });

//     });

// });


// -------------------------------
// Simple CSV parser that handles quoted fields with commas
// (Keeps things dependency-free; if you prefer Papa Parse, we can swap it in.)
// -------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
      continue;
    }
    if (char === '"' && inQuotes) {
      // Escaped quote
      if (next === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = false;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      }
      // Skip \r\n pairs
      if (char === '\r' && next === '\n') i++;
      continue;
    }
    cur += char;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

$(document).ready(function () {
  // Load CSV
  $.get('github_metrics.csv', function (data) {
    // Parse CSV robustly (handles quoted commas)
    const rows = parseCSV(data.trim());
    if (!rows || rows.length < 2) {
      console.error('CSV seems empty or malformed.');
      return;
    }

    const headers = rows[0];
    const tableData = rows.slice(1);

    // Column index map (must match your CSV header order)
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

    // Define default visible columns (Core view)
    // Repo (always visible) + description, license, stars, forks, last_update
    const DEFAULT_VISIBLE = new Set([
      COL.description, COL.license, COL.stars, COL.forks, COL.last_update
    ]);

    // Build DataTable
    const dt = $('#metricsTable').DataTable({
      data: tableData,
      columns: headers.map((h, i) => {
        // Assign classes for styling (repo + description special)
        const className =
          i === COL.repository ? 'repo-cell noVis' :
          i === COL.description ? 'desc-cell' : '';

        return {
          title: h,
          className,
          render: function (data, type, row) {
            // Render repository as a GitHub link
            if (i === COL.repository) {
              const repo = row[COL.repository] || '';
              const url = `https://github.com/${repo}`;
              return `${url}${repo}</a>`;
            }
            return data;
          }
        };
      }),

      // Toolbar with Column chooser + preset buttons
      dom: 'Bfrtip',
      buttons: [
        {
          extend: 'colvis',
          text: 'Columns',
          // prevent hiding the repository column
          columns: ':not(.noVis)'
        },
        {
          text: 'Core',
          action: function () {
            dt.columns().visible(false);
            // Repo always on
            dt.column(COL.repository).visible(true);
            // Default visible set
            DEFAULT_VISIBLE.forEach(c => dt.column(c).visible(true));
          }
        },
        {
          text: 'Activity',
          action: function () {
            dt.columns().visible(false);
            [
              COL.repository,
              COL.watchers, COL.open_issues, COL.open_prs,
              COL.closed_prs_30, COL.merged_prs_30, COL.last_commit, COL.last_update
            ].forEach(c => dt.column(c).visible(true));
          }
        },
        {
          text: 'Contributors',
          action: function () {
            dt.columns().visible(false);
            [COL.repository, COL.contributors_total, COL.contributors_active_30]
              .forEach(c => dt.column(c).visible(true));
          }
        },
        {
          text: 'Releases',
          action: function () {
            dt.columns().visible(false);
            [COL.repository, COL.latest_release, COL.release_downloads]
              .forEach(c => dt.column(c).visible(true));
          }
        },
        {
          text: 'Show All',
          action: function () {
            dt.columns().visible(true);
          }
        }
      ],

      // Remember column visibility between reloads
      stateSave: true,

      // Table ergonomics
      pageLength: 25,
      stripeClasses: ['even', 'odd'],
      autoWidth: false,

      // Widths + numeric alignment
      columnDefs: [
        { targets: COL.repository, width: 560, className: 'repo-cell noVis' },
        { targets: COL.description, width: 320, className: 'desc-cell' },
        {
          targets: [
            COL.stars, COL.forks, COL.watchers, COL.open_issues, COL.open_prs,
            COL.closed_prs_30, COL.merged_prs_30, COL.contributors_total,
            COL.contributors_active_30, COL.release_downloads, COL.repo_size_kb
          ],
          className: 'dt-body-right'
        }
      ]
    });

    // Apply initial visibility AFTER dt exists (fixes "Cannot access 'dt' before initialization")
    dt.on('init', function () {
      // Hide everything first (except repo)
      dt.columns().every(function (idx) {
        const isRepo = idx === COL.repository;
        this.visible(isRepo || DEFAULT_VISIBLE.has(idx));
      });
    });

    // ---------- Chart (Stars & Forks) ----------
    const safeNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const repos = tableData.map(r => r[COL.repository] || '');
    const stars = tableData.map(r => safeNum(r[COL.stars]));
    const forks = tableData.map(r => safeNum(r[COL.forks]));

    new Chart(document.getElementById('metricsChart'), {
      type: 'bar',
      data: {
        labels: repos,
        datasets: [
          { label: 'Stars', data: stars, backgroundColor: '#3A3F51' },
          { label: 'Forks', data: forks, backgroundColor: '#71A06A' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 } },
          y: { beginAtZero: true }
        },
        plugins: {
          legend: { labels: { color: '#3A3F51' } }
        }
      }
    });
  });
});