-- Mission Back on Track M4: make intent and answer-completeness validation
-- queryable governance evidence and preserve feedback as append-only review.

alter table public.cate_evaluations
  add column if not exists intent_id text,
  add column if not exists question_answered boolean,
  add column if not exists answer_status text,
  add column if not exists output_class text,
  add column if not exists validation_version text;

alter table public.cate_evaluations
  disable trigger cate_evaluations_immutable;

update public.cate_evaluations
set
  intent_id = coalesce(
    output #>> '{intentAssessment,intentId}',
    capability
  ),
  question_answered = coalesce(
    (output #>> '{answerAssessment,questionAnswered}')::boolean,
    false
  ),
  answer_status = coalesce(
    output #>> '{answerAssessment,status}',
    'insufficient'
  ),
  output_class = coalesce(
    output #>> '{answerAssessment,outputClass}',
    case
      when fallback_used then 'deterministic_guidance'
      else 'generative_interpretation'
    end
  ),
  validation_version = coalesce(
    output #>> '{answerAssessment,validationVersion}',
    'historical-unvalidated'
  )
where intent_id is null
   or question_answered is null
   or answer_status is null
   or output_class is null
   or validation_version is null;

alter table public.cate_evaluations
  enable trigger cate_evaluations_immutable;

alter table public.cate_evaluations
  alter column intent_id set not null,
  alter column question_answered set not null,
  alter column answer_status set not null,
  alter column output_class set not null,
  alter column validation_version set not null;

alter table public.cate_evaluations
  drop constraint if exists cate_evaluations_answer_status_check,
  add constraint cate_evaluations_answer_status_check
    check (
      answer_status in (
        'complete', 'partial', 'insufficient', 'permission_limited'
      )
    ),
  drop constraint if exists cate_evaluations_output_class_check,
  add constraint cate_evaluations_output_class_check
    check (
      output_class in (
        'deterministic_calculation',
        'deterministic_guidance',
        'generative_interpretation',
        'permission_boundary'
      )
    );

create index if not exists cate_evaluations_governance_idx
  on public.cate_evaluations (
    tenant_id,
    intent_id,
    question_answered,
    created_at desc
  );

drop trigger if exists cate_feedback_immutable
  on public.cate_feedback;
create trigger cate_feedback_immutable
before update or delete on public.cate_feedback
for each row execute function private.prevent_immutable_mutation();
