<?php

namespace App\Services;

use App\Models\Form;
use App\Support\AuthUser;
use Illuminate\Support\Facades\DB;

class MyFormsAnalyticsService
{
    /**
     * @return array<string, mixed>
     */
    public function getMyFormsAnalytics(AuthUser $user): array
    {
        $forms = Form::query()
            ->where('created_by', $user->id)
            ->orderByDesc('updated_at')
            ->get();

        $formIds = $forms->map(fn (Form $f) => (string) $f->id)->all();
        $now = now();
        $thisMonthStart = $now->copy()->startOfMonth();
        $lastMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();
        $buckets = $this->monthBuckets(12);
        $rangeStart = $buckets[0]['start'];

        $rangeLabel = $thisMonthStart->format('M j, Y').' – '.$now->format('M j, Y');

        if ($formIds === []) {
            return $this->emptyAnalytics($rangeLabel, $buckets, $forms);
        }

        $placeholders = implode(',', array_fill(0, count($formIds), '?'));
        $formMatch = "form_id IN ({$placeholders})";

        $totalRequests = (int) DB::selectOne(
            "SELECT COUNT(*) AS cnt FROM tickets WHERE {$formMatch}",
            $formIds,
        )->cnt;

        $thisMonthCount = (int) DB::selectOne(
            "SELECT COUNT(*) AS cnt FROM tickets WHERE {$formMatch} AND created_at >= ?",
            [...$formIds, $thisMonthStart],
        )->cnt;

        $lastMonthCount = (int) DB::selectOne(
            "SELECT COUNT(*) AS cnt FROM tickets WHERE {$formMatch} AND created_at >= ? AND created_at < ?",
            [...$formIds, $lastMonthStart, $thisMonthStart],
        )->cnt;

        $divisionRows = collect(DB::select(
            "SELECT COALESCE(NULLIF(TRIM(division), ''), 'Unspecified') AS name, COUNT(*) AS count
             FROM tickets WHERE {$formMatch}
             GROUP BY name ORDER BY count DESC",
            $formIds,
        ))->map(fn ($r) => ['name' => (string) $r->name, 'count' => (int) $r->count])->all();

        $serviceRows = collect(DB::select(
            "SELECT COALESCE(NULLIF(TRIM(form_title), ''), 'Other') AS name, COUNT(*) AS count
             FROM tickets WHERE {$formMatch}
             GROUP BY name ORDER BY count DESC",
            $formIds,
        ))->map(fn ($r) => ['name' => (string) $r->name, 'count' => (int) $r->count])->all();

        $monthlyRows = DB::select(
            "SELECT YEAR(created_at) AS year, MONTH(created_at) AS month, COUNT(*) AS count
             FROM tickets WHERE {$formMatch} AND created_at >= ?
             GROUP BY YEAR(created_at), MONTH(created_at)",
            [...$formIds, $rangeStart],
        );

        $perFormMonthlyRows = DB::select(
            "SELECT form_id AS id, YEAR(created_at) AS year, MONTH(created_at) AS month, COUNT(*) AS count
             FROM tickets WHERE {$formMatch} AND created_at >= ?
             GROUP BY form_id, YEAR(created_at), MONTH(created_at)",
            [...$formIds, $rangeStart],
        );

        $thisMonthDivCount = (int) DB::selectOne(
            "SELECT COUNT(*) AS count FROM (
               SELECT COALESCE(NULLIF(TRIM(division), ''), 'Unspecified') AS d
               FROM tickets WHERE {$formMatch} AND created_at >= ?
               GROUP BY d
             ) x",
            [...$formIds, $thisMonthStart],
        )->count;

        $lastMonthDivCount = (int) DB::selectOne(
            "SELECT COUNT(*) AS count FROM (
               SELECT COALESCE(NULLIF(TRIM(division), ''), 'Unspecified') AS d
               FROM tickets WHERE {$formMatch} AND created_at >= ? AND created_at < ?
               GROUP BY d
             ) x",
            [...$formIds, $lastMonthStart, $thisMonthStart],
        )->count;

        $ticketsByForm = collect(DB::select(
            "SELECT form_id AS id, COUNT(*) AS count FROM tickets WHERE {$formMatch} GROUP BY form_id",
            $formIds,
        ))->mapWithKeys(fn ($r) => [(string) $r->id => (int) $r->count]);

        $lastSubmissions = collect(DB::select(
            "SELECT form_id AS id, MAX(created_at) AS lastAt FROM tickets WHERE {$formMatch} GROUP BY form_id",
            $formIds,
        ))->mapWithKeys(fn ($r) => [(string) $r->id => $r->lastAt ? \Carbon\Carbon::parse($r->lastAt) : null]);

        $thisMonthServices = DB::select(
            "SELECT COALESCE(NULLIF(TRIM(form_title), ''), 'Other') AS name, COUNT(*) AS count
             FROM tickets WHERE {$formMatch} AND created_at >= ?
             GROUP BY name",
            [...$formIds, $thisMonthStart],
        );

        $lastMonthServices = collect(DB::select(
            "SELECT COALESCE(NULLIF(TRIM(form_title), ''), 'Other') AS name, COUNT(*) AS count
             FROM tickets WHERE {$formMatch} AND created_at >= ? AND created_at < ?
             GROUP BY name",
            [...$formIds, $lastMonthStart, $thisMonthStart],
        ))->mapWithKeys(fn ($r) => [(string) $r->name => (int) $r->count]);

        $byDivision = $this->toNamedCounts($divisionRows, $totalRequests, 8);
        $byService = $this->toNamedCounts($serviceRows, $totalRequests, 6);
        $topDivisions = $this->toNamedCounts($divisionRows, $totalRequests, 5);

        $monthlyMap = [];
        foreach ($monthlyRows as $row) {
            $key = $row->year.'-'.str_pad((string) $row->month, 2, '0', STR_PAD_LEFT);
            $monthlyMap[$key] = (int) $row->count;
        }
        $monthlyTrend = array_map(fn ($b) => [
            'month' => $b['month'],
            'monthKey' => $b['monthKey'],
            'count' => $monthlyMap[$b['monthKey']] ?? 0,
        ], $buckets);

        $perFormMonthlyMap = [];
        foreach ($perFormMonthlyRows as $row) {
            $fid = (string) $row->id;
            $key = $row->year.'-'.str_pad((string) $row->month, 2, '0', STR_PAD_LEFT);
            $perFormMonthlyMap[$fid][$key] = (int) $row->count;
        }

        $topService = $byService[0] ?? null;
        $topDivision = $byDivision[0] ?? null;
        $daysInMonth = max(1, (int) $now->day);
        $averagePerDay = round(($thisMonthCount / $daysInMonth) * 10) / 10;

        $fastestGrowing = $topService['name'] ?? '—';
        $bestGrowth = PHP_FLOAT_MIN;
        foreach ($thisMonthServices as $row) {
            $name = (string) $row->name;
            $prev = $lastMonthServices[$name] ?? 0;
            $growth = (int) $row->count - $prev;
            if ($growth > $bestGrowth) {
                $bestGrowth = $growth;
                $fastestGrowing = $name !== '' ? $name : '—';
            }
        }

        return [
            'rangeLabel' => $rangeLabel,
            'summary' => [
                'totalRequests' => $totalRequests,
                'totalRequestsChangePct' => $this->pctChange($thisMonthCount, $lastMonthCount),
                'totalDivisions' => count($divisionRows),
                'divisionsChangePct' => $this->pctChange($thisMonthDivCount, $lastMonthDivCount),
                'mostRequestedService' => $topService['name'] ?? '—',
                'mostRequestedCount' => $topService['count'] ?? 0,
                'mostRequestedPercent' => $topService['percent'] ?? 0,
                'requestsThisMonth' => $thisMonthCount,
                'requestsThisMonthChangePct' => $this->pctChange($thisMonthCount, $lastMonthCount),
            ],
            'byDivision' => $byDivision,
            'byService' => $byService,
            'monthlyTrend' => $monthlyTrend,
            'insights' => [
                'mostActiveDivision' => $topDivision['name'] ?? '—',
                'mostRequestedService' => $topService['name'] ?? '—',
                'fastestGrowing' => $fastestGrowing,
                'topSharePercent' => $topService['percent'] ?? 0,
                'averagePerDay' => $averagePerDay,
            ],
            'topDivisions' => $topDivisions,
            'forms' => $forms->map(function (Form $f) use ($ticketsByForm, $lastSubmissions, $buckets, $perFormMonthlyMap) {
                $fid = (string) $f->id;
                $formMonthMap = $perFormMonthlyMap[$fid] ?? [];

                return [
                    '_id' => $fid,
                    'title' => $f->title,
                    'refNumber' => $f->ref_number,
                    'status' => $f->status,
                    'requestCount' => $ticketsByForm[$fid] ?? 0,
                    'lastSubmissionAt' => isset($lastSubmissions[$fid])
                        ? optional($lastSubmissions[$fid])?->toISOString()
                        : null,
                    'updatedAt' => optional($f->updated_at)?->toISOString(),
                    'reviewRemarks' => $f->review_remarks ?: null,
                    'monthlyTrend' => array_map(fn ($b) => [
                        'month' => $b['month'],
                        'monthKey' => $b['monthKey'],
                        'count' => $formMonthMap[$b['monthKey']] ?? 0,
                    ], $buckets),
                ];
            })->all(),
        ];
    }

    /**
     * @param  list<array{monthKey: string, month: string, start: \Carbon\Carbon}>  $buckets
     * @param  \Illuminate\Support\Collection<int, Form>  $forms
     * @return array<string, mixed>
     */
    private function emptyAnalytics(string $rangeLabel, array $buckets, $forms): array
    {
        return [
            'rangeLabel' => $rangeLabel,
            'summary' => [
                'totalRequests' => 0,
                'totalRequestsChangePct' => null,
                'totalDivisions' => 0,
                'divisionsChangePct' => null,
                'mostRequestedService' => '—',
                'mostRequestedCount' => 0,
                'mostRequestedPercent' => 0,
                'requestsThisMonth' => 0,
                'requestsThisMonthChangePct' => null,
            ],
            'byDivision' => [],
            'byService' => [],
            'monthlyTrend' => array_map(fn ($b) => [
                'month' => $b['month'],
                'monthKey' => $b['monthKey'],
                'count' => 0,
            ], $buckets),
            'insights' => [
                'mostActiveDivision' => '—',
                'mostRequestedService' => '—',
                'fastestGrowing' => '—',
                'topSharePercent' => 0,
                'averagePerDay' => 0,
            ],
            'topDivisions' => [],
            'forms' => $forms->map(fn (Form $f) => [
                '_id' => (string) $f->id,
                'title' => $f->title,
                'refNumber' => $f->ref_number,
                'status' => $f->status,
                'requestCount' => 0,
                'lastSubmissionAt' => null,
                'updatedAt' => optional($f->updated_at)?->toISOString(),
                'reviewRemarks' => $f->review_remarks ?: null,
                'monthlyTrend' => array_map(fn ($b) => [
                    'month' => $b['month'],
                    'monthKey' => $b['monthKey'],
                    'count' => 0,
                ], $buckets),
            ])->all(),
        ];
    }

    /**
     * @return list<array{monthKey: string, month: string, start: \Carbon\Carbon}>
     */
    private function monthBuckets(int $months = 12): array
    {
        $buckets = [];
        $now = now();
        for ($i = $months - 1; $i >= 0; $i--) {
            $start = $now->copy()->startOfMonth()->subMonthsNoOverflow($i);
            $buckets[] = [
                'monthKey' => $start->format('Y-m'),
                'month' => $start->format('M'),
                'start' => $start,
            ];
        }

        return $buckets;
    }

    /**
     * @param  list<array{name: string, count: int}>  $rows
     * @return list<array{name: string, count: int, percent: float}>
     */
    private function toNamedCounts(array $rows, int $total, int $limit = 8): array
    {
        return array_map(fn ($row) => [
            'name' => trim($row['name']) !== '' ? $row['name'] : 'Unspecified',
            'count' => $row['count'],
            'percent' => $total > 0 ? round(($row['count'] / $total) * 1000) / 10 : 0,
        ], array_slice($rows, 0, $limit));
    }

    private function pctChange(int $current, int $previous): ?float
    {
        if ($previous === 0) {
            return $current > 0 ? 100.0 : null;
        }

        return round((($current - $previous) / $previous) * 1000) / 10;
    }
}
