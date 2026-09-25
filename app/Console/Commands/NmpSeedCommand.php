<?php

namespace App\Console\Commands;

use App\Models\Form;
use App\Models\OrgUser;
use App\Models\User;
use App\Services\PamanaEmployeeService;
use App\Support\Id;
use App\Utils\TicketNumber;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Keeps ticketing aligned with real org/PAMANA logins.
 * Removes legacy seed/demo @nmp.gov.ph accounts that are not PAMANA employees.
 */
class NmpSeedCommand extends Command
{
    protected $signature = 'nmp:seed';

    protected $description = 'Remove non-PAMANA demo accounts; ensure a published form exists';

    /** Legacy seed emails — not real PAMANA staff. */
    private const DEMO_EMAILS = [
        'user@nmp.gov.ph',
        'maria.santos@nmp.gov.ph',
        'juan.reyes@nmp.gov.ph',
        'ana.garcia@nmp.gov.ph',
        'carlo.mendoza@nmp.gov.ph',
        'elena.ramos@nmp.gov.ph',
        'mark.torres@nmp.gov.ph',
        'sophia.lim@nmp.gov.ph',
        'diego.navarro@nmp.gov.ph',
        'isabel.cruz@nmp.gov.ph',
        'patrick.ong@nmp.gov.ph',
        'grace.villanueva@nmp.gov.ph',
        'miguel.fernandez@nmp.gov.ph',
        'camille.bautista@nmp.gov.ph',
        'rafael.dizon@nmp.gov.ph',
        'admin@nmp.gov.ph',
        'james.alcantara@nmp.gov.ph',
        'patricia.mendoza@nmp.gov.ph',
        'rico.delarosa@nmp.gov.ph',
        'nina.castillo@nmp.gov.ph',
        'records@nmp.gov.ph',
    ];

    public function handle(): int
    {
        $pamana = app(PamanaEmployeeService::class);
        $keeper = $this->resolveKeeperUser($pamana);

        $removed = $this->purgeDemoAccounts($keeper?->id);
        $this->info("Removed {$removed} non-PAMANA demo account(s).");

        if ($keeper) {
            $this->ensurePublishedForm($keeper);
        } else {
            $this->warn('No PAMANA-linked ticketing user found — skipped published-form ensure.');
        }

        $this->info('Seed complete. Sign in with museum (org/PAMANA) usernames only.');

        return self::SUCCESS;
    }

    private function resolveKeeperUser(PamanaEmployeeService $pamana): ?User
    {
        foreach (User::query()->orderBy('email')->cursor() as $user) {
            if ($pamana->findForTicketingUser($user)) {
                return $user;
            }
        }

        // Prefer a known PAMANA admin if ticketing row exists after login sync.
        return User::query()
            ->whereRaw('LOWER(email) = ?', ['resty.morancil@nationalmuseum.gov.ph'])
            ->first();
    }

    private function purgeDemoAccounts(?string $reassignToUserId): int
    {
        $emails = array_map('strtolower', self::DEMO_EMAILS);
        $demoUsers = User::query()
            ->where(function ($q) use ($emails) {
                foreach ($emails as $email) {
                    $q->orWhereRaw('LOWER(email) = ?', [$email]);
                }
            })
            ->get();

        $demoIds = $demoUsers->pluck('id')->all();
        if ($demoIds !== []) {
            $this->reassignOrNullUserFks($demoIds, $reassignToUserId);

            DB::table('ticket_assignees')->whereIn('user_id', $demoIds)->delete();
            DB::table('conversation_participants')->whereIn('user_id', $demoIds)->delete();
            DB::table('pokes')
                ->where(function ($q) use ($demoIds) {
                    $q->whereIn('from_user_id', $demoIds)->orWhereIn('to_user_id', $demoIds);
                })
                ->delete();
            DB::table('tickets')->whereIn('creator_id', $demoIds)->delete();

            User::query()->whereIn('id', $demoIds)->delete();
        }

        $orgRemoved = 0;
        foreach ($emails as $email) {
            $org = OrgUser::query()->whereRaw('LOWER(email) = ?', [$email])->first();
            if (! $org) {
                continue;
            }
            DB::table('model_has_roles')->where('model_id', $org->id)->delete();
            $org->delete();
            $orgRemoved++;
            $this->line("  deleted org login: {$email}");
        }

        foreach ($demoUsers as $user) {
            $this->line("  deleted ticketing profile: {$user->email}");
        }

        return count($demoIds) + $orgRemoved;
    }

    /**
     * @param  list<string>  $demoIds
     */
    private function reassignOrNullUserFks(array $demoIds, ?string $reassignToUserId): void
    {
        $forms = DB::table('forms')
            ->where(function ($q) use ($demoIds) {
                $q->whereIn('created_by', $demoIds)
                    ->orWhereIn('updated_by', $demoIds)
                    ->orWhereIn('reviewed_by', $demoIds);
            })
            ->get(['id', 'created_by', 'updated_by', 'reviewed_by']);

        foreach ($forms as $form) {
            $createdBy = in_array($form->created_by, $demoIds, true)
                ? ($reassignToUserId ?? $form->created_by)
                : $form->created_by;
            $updatedBy = in_array($form->updated_by, $demoIds, true)
                ? ($reassignToUserId ?? null)
                : $form->updated_by;
            $reviewedBy = in_array($form->reviewed_by, $demoIds, true)
                ? ($reassignToUserId ?? null)
                : $form->reviewed_by;

            // created_by is required — skip delete path if we cannot reassign.
            if (in_array($form->created_by, $demoIds, true) && ! $reassignToUserId) {
                $this->warn("  form {$form->id} still references a demo creator; keeping row until a PAMANA user exists.");
                continue;
            }

            DB::table('forms')->where('id', $form->id)->update([
                'created_by' => $createdBy,
                'updated_by' => $updatedBy,
                'reviewed_by' => $reviewedBy,
            ]);
        }
    }

    private function ensurePublishedForm(User $owner): void
    {
        $publishedExists = Form::query()->where('status', 'published')->exists();
        if ($publishedExists) {
            $this->info('Skip existing: published form');

            return;
        }

        Form::create([
            'id' => Id::newId(),
            'title' => 'Technical Assistance Request',
            'description' => 'Request technical assistance from ICT',
            'department' => 'ICT',
            'ref_number' => TicketNumber::generateFormRef(),
            'effectivity' => now()->toDateString(),
            'version' => 'v1.0',
            'status' => 'published',
            'fields' => [
                ['id' => 'fld_subject', 'type' => 'textbox', 'variable' => 'txt_subject', 'label' => 'Request subject', 'required' => true],
                ['id' => 'fld_details', 'type' => 'textarea', 'variable' => 'txa_details', 'label' => 'Request details', 'required' => true],
                ['id' => 'fld_division', 'type' => 'textbox', 'variable' => 'txt_division', 'label' => 'Division / office', 'required' => true],
                ['id' => 'fld_attachment', 'type' => 'file', 'variable' => 'pdf_attachment', 'label' => 'Supporting document (PDF)', 'required' => false],
            ],
            'signatories' => [['id' => 'sig_1', 'division' => 'IT', 'name' => $owner->name]],
            'print_template' => '',
            'print_placements' => [],
            'print_placement_font_size' => 10,
            'work_procedure_name' => '',
            'review_remarks' => '',
            'created_by' => $owner->id,
            'updated_by' => $owner->id,
        ]);
        $this->info('Created: published Technical Assistance Request form');
    }
}
