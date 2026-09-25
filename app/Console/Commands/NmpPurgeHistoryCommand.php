<?php

namespace App\Console\Commands;

use App\Services\UploadService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Remove all ticketing history (forms, tickets, messages, activity) while keeping users and RBAC.
 */
class NmpPurgeHistoryCommand extends Command
{
    protected $signature = 'nmp:purge-history {--uploads : Also delete files on the uploads disk} {--force : Skip confirmation prompt}';

    protected $description = 'Purge forms, tickets, conversations, and activity logs (keeps users and RBAC)';

    /** @var list<string> */
    private const HISTORY_TABLES = [
        'conversation_messages',
        'conversation_participants',
        'pokes',
        'ticket_assignees',
        'conversations',
        'activity_logs',
        'tickets',
        'forms',
    ];

    public function handle(): int
    {
        if (! $this->option('force') && ! $this->confirm('This will permanently delete all forms, tickets, messages, and activity logs. Users and RBAC are kept. Continue?')) {
            $this->info('Aborted.');

            return self::SUCCESS;
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        foreach (self::HISTORY_TABLES as $table) {
            $count = DB::table($table)->count();
            DB::table($table)->truncate();
            $this->line("  cleared {$table}: {$count} row(s)");
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        if ($this->option('uploads')) {
            $this->purgeUploads();
        }

        $this->info('History purge complete.');
        $this->line('  users_ kept: '.DB::table('users_')->count());
        $this->line('  users kept: '.DB::table('users')->count());

        return self::SUCCESS;
    }

    private function purgeUploads(): void
    {
        $removed = app(UploadService::class)->purge();
        $this->line("  cleared uploads: {$removed} file(s)");
    }
}
