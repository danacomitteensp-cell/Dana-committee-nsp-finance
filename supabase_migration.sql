-- ============================================================================
-- Dana Finance: Complete Financial Module Migration
-- ============================================================================
-- This migration adds:
--   1. Missing indexes and unique constraints
--   2. Seed data for financial_settings
--   3. RPC: generate_lavazam_dues
--   4. RPC: record_lavazam_payment (atomic payment + allocation)
--   5. RPC: record_fund_collection
--   6. RPC: record_expense
--   7. RPC: void_transaction (correction mechanism)
--   8. RPC: get_financial_summary (server-side aggregation)
--   9. RPC: get_member_dues_detail (for a single member's year)
--  10. RLS policies for all financial tables
--  11. Audit log trigger
--  12. Storage bucket for receipts
-- ============================================================================

-- ============================================================================
-- 1. INDEXES & CONSTRAINTS
-- ============================================================================

-- Prevent duplicate dues for a member in the same month
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_dues_unique
  ON public.member_dues (member_id, period_month);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_member_dues_member ON public.member_dues (member_id);
CREATE INDEX IF NOT EXISTS idx_member_dues_period ON public.member_dues (period_month);
CREATE INDEX IF NOT EXISTS idx_ft_transaction_date ON public.financial_transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_ft_type ON public.financial_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_ft_status ON public.financial_transactions (status);
CREATE INDEX IF NOT EXISTS idx_ft_member ON public.financial_transactions (member_id);
CREATE INDEX IF NOT EXISTS idx_ft_account ON public.financial_transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_ft_fund ON public.financial_transactions (fund_id);
CREATE INDEX IF NOT EXISTS idx_fta_transaction ON public.financial_transaction_allocations (transaction_id);
CREATE INDEX IF NOT EXISTS idx_fta_due ON public.financial_transaction_allocations (due_id);
CREATE INDEX IF NOT EXISTS idx_fa_transaction ON public.financial_attachments (transaction_id);
CREATE INDEX IF NOT EXISTS idx_fal_transaction ON public.financial_audit_logs (transaction_id);
CREATE INDEX IF NOT EXISTS idx_members_auth_uid ON public.members (auth_uid);

-- ============================================================================
-- 2. SEED FINANCIAL SETTINGS (idempotent)
-- ============================================================================

INSERT INTO public.financial_settings (id, monthly_lavazam_amount, currency)
VALUES (true, 21.00, 'INR')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HELPER: is_treasurer check (used by RPCs)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_current_user_treasurer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_uid = auth.uid()
      AND is_treasurer = true
  );
$$;

-- ============================================================================
-- HELPER: get current member id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_member_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.members
  WHERE auth_uid = auth.uid()
  LIMIT 1;
$$;

-- ============================================================================
-- 3. RPC: generate_lavazam_dues
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_lavazam_dues(p_year integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_amount numeric;
  v_count integer := 0;
  v_member record;
  v_month integer;
  v_period date;
  v_due_date date;
BEGIN
  -- Authorization: only treasurers
  IF NOT public.is_current_user_treasurer() THEN
    RAISE EXCEPTION 'Only treasurers can generate dues';
  END IF;

  -- Validate year
  IF p_year < 2020 OR p_year > EXTRACT(YEAR FROM now())::integer + 1 THEN
    RAISE EXCEPTION 'Invalid year: %', p_year;
  END IF;

  -- Get current monthly amount from settings
  SELECT monthly_lavazam_amount INTO v_monthly_amount
  FROM public.financial_settings
  WHERE id = true;

  IF v_monthly_amount IS NULL THEN
    RAISE EXCEPTION 'Financial settings not configured';
  END IF;

  -- Generate dues for every member (active + inactive) for all 12 months
  FOR v_member IN
    SELECT id FROM public.members
  LOOP
    FOR v_month IN 1..12 LOOP
      v_period := make_date(p_year, v_month, 1);
      v_due_date := (v_period + interval '1 month' - interval '1 day')::date;

      -- Insert only if not already existing (idempotent via unique index)
      INSERT INTO public.member_dues (member_id, period_month, amount_due, due_date)
      VALUES (v_member.id, v_period, v_monthly_amount, v_due_date)
      ON CONFLICT (member_id, period_month) DO NOTHING;

      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- 4. RPC: record_lavazam_payment (atomic transaction + allocations)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_lavazam_payment(
  p_member_id bigint,
  p_amount numeric,
  p_account_id bigint,
  p_payment_method text,
  p_reference_number text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_transaction_date date DEFAULT CURRENT_DATE,
  p_due_ids bigint[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_treasurer_id bigint;
  v_tx_id bigint;
  v_remaining numeric;
  v_due record;
  v_already_paid numeric;
  v_allocate numeric;
  v_total_allocated numeric := 0;
BEGIN
  -- Authorization
  IF NOT public.is_current_user_treasurer() THEN
    RAISE EXCEPTION 'Only treasurers can record payments';
  END IF;

  v_treasurer_id := public.get_current_member_id();

  -- Validate member exists
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id) THEN
    RAISE EXCEPTION 'Member not found: %', p_member_id;
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Validate account
  IF p_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financial_accounts WHERE id = p_account_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive account';
  END IF;

  -- Validate payment method
  IF p_payment_method IS NOT NULL AND p_payment_method NOT IN ('cash', 'upi', 'bank_transfer', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  -- Create the transaction
  INSERT INTO public.financial_transactions (
    transaction_type, direction, amount, transaction_date,
    account_id, member_id, payment_method, reference_number,
    description, status, recorded_by, category
  ) VALUES (
    'lavazam', 'inflow', p_amount, p_transaction_date,
    p_account_id, p_member_id, p_payment_method, p_reference_number,
    COALESCE(p_description, 'Lavazam payment'), 'completed', v_treasurer_id, 'lavazam'
  )
  RETURNING id INTO v_tx_id;

  -- Allocate payment to dues
  v_remaining := p_amount;

  -- If specific dues are provided, allocate to those first
  -- Otherwise, allocate to oldest unpaid dues
  FOR v_due IN
    SELECT d.id, d.amount_due,
           COALESCE((SELECT SUM(a.amount) FROM public.financial_transaction_allocations a
                     JOIN public.financial_transactions t ON t.id = a.transaction_id
                     WHERE a.due_id = d.id AND t.status = 'completed'), 0) as paid
    FROM public.member_dues d
    WHERE d.member_id = p_member_id
      AND (p_due_ids IS NULL OR d.id = ANY(p_due_ids))
    ORDER BY
      CASE WHEN p_due_ids IS NOT NULL THEN array_position(p_due_ids, d.id) ELSE NULL END NULLS LAST,
      d.period_month ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_already_paid := v_due.paid;

    -- Skip fully paid dues
    IF v_already_paid >= v_due.amount_due THEN
      CONTINUE;
    END IF;

    -- Calculate allocation amount
    v_allocate := LEAST(v_remaining, v_due.amount_due - v_already_paid);

    INSERT INTO public.financial_transaction_allocations (transaction_id, due_id, amount)
    VALUES (v_tx_id, v_due.id, v_allocate);

    v_remaining := v_remaining - v_allocate;
    v_total_allocated := v_total_allocated + v_allocate;
  END LOOP;

  -- If there's remaining amount that couldn't be allocated, that's OK
  -- (overpayment / advance payment — recorded as transaction but no allocation)

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'amount', p_amount,
    'allocated', v_total_allocated,
    'unallocated', v_remaining
  );
END;
$$;

-- ============================================================================
-- 5. RPC: record_fund_collection
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_fund_collection(
  p_fund_id bigint,
  p_amount numeric,
  p_account_id bigint DEFAULT NULL,
  p_member_id bigint DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_transaction_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_treasurer_id bigint;
  v_tx_id bigint;
  v_fund_name text;
BEGIN
  -- Authorization
  IF NOT public.is_current_user_treasurer() THEN
    RAISE EXCEPTION 'Only treasurers can record collections';
  END IF;

  v_treasurer_id := public.get_current_member_id();

  -- Validate fund
  SELECT name INTO v_fund_name FROM public.financial_funds WHERE id = p_fund_id AND is_active = true;
  IF v_fund_name IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive fund';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Validate account
  IF p_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financial_accounts WHERE id = p_account_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive account';
  END IF;

  -- Validate member if provided
  IF p_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members WHERE id = p_member_id
  ) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  INSERT INTO public.financial_transactions (
    transaction_type, direction, amount, transaction_date,
    account_id, member_id, fund_id, payment_method,
    reference_number, description, status, recorded_by, category
  ) VALUES (
    'fund_collection', 'inflow', p_amount, p_transaction_date,
    p_account_id, p_member_id, p_fund_id, p_payment_method,
    p_reference_number,
    COALESCE(p_description, 'Collection for ' || v_fund_name),
    'completed', v_treasurer_id, 'collection'
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'amount', p_amount);
END;
$$;

-- ============================================================================
-- 6. RPC: record_expense
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_expense(
  p_amount numeric,
  p_account_id bigint DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_transaction_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_treasurer_id bigint;
  v_tx_id bigint;
BEGIN
  -- Authorization
  IF NOT public.is_current_user_treasurer() THEN
    RAISE EXCEPTION 'Only treasurers can record expenses';
  END IF;

  v_treasurer_id := public.get_current_member_id();

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Validate account
  IF p_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financial_accounts WHERE id = p_account_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive account';
  END IF;

  INSERT INTO public.financial_transactions (
    transaction_type, direction, amount, transaction_date,
    account_id, category, description, payment_method,
    reference_number, status, recorded_by
  ) VALUES (
    'expense', 'outflow', p_amount, p_transaction_date,
    p_account_id, p_category, p_description, p_payment_method,
    p_reference_number, 'completed', v_treasurer_id
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'amount', p_amount);
END;
$$;

-- ============================================================================
-- 7. RPC: void_transaction (correction mechanism)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.void_transaction(
  p_transaction_id bigint,
  p_reason text DEFAULT 'Correction'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_treasurer_id bigint;
  v_old_status text;
  v_old_data jsonb;
BEGIN
  -- Authorization
  IF NOT public.is_current_user_treasurer() THEN
    RAISE EXCEPTION 'Only treasurers can void transactions';
  END IF;

  v_treasurer_id := public.get_current_member_id();

  -- Get current transaction state
  SELECT status, to_jsonb(t.*) INTO v_old_status, v_old_data
  FROM public.financial_transactions t
  WHERE t.id = p_transaction_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  IF v_old_status = 'void' THEN
    RAISE EXCEPTION 'Transaction is already void';
  END IF;

  -- Void the transaction (do NOT delete)
  UPDATE public.financial_transactions
  SET status = 'void'
  WHERE id = p_transaction_id;

  -- Record audit log
  INSERT INTO public.financial_audit_logs (
    transaction_id, action, old_data, new_data, performed_by
  ) VALUES (
    p_transaction_id,
    'void',
    v_old_data,
    jsonb_build_object('status', 'void', 'reason', p_reason),
    v_treasurer_id
  );

  -- Note: allocations remain but are ignored because we filter by
  -- transaction status = 'completed' in all calculations

  RETURN jsonb_build_object(
    'transaction_id', p_transaction_id,
    'previous_status', v_old_status,
    'new_status', 'void'
  );
END;
$$;

-- ============================================================================
-- 8. RPC: get_financial_summary (server-side aggregation)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Authorization
  IF NOT public.is_current_user_treasurer() THEN
    RAISE EXCEPTION 'Only treasurers can view financial summary';
  END IF;

  SELECT jsonb_build_object(
    'total_inflow', COALESCE((
      SELECT SUM(amount) FROM public.financial_transactions
      WHERE direction = 'inflow' AND status = 'completed'
    ), 0),
    'total_outflow', COALESCE((
      SELECT SUM(amount) FROM public.financial_transactions
      WHERE direction = 'outflow' AND status = 'completed'
    ), 0),
    'current_balance', COALESCE((
      SELECT SUM(CASE WHEN direction = 'inflow' THEN amount ELSE -amount END)
      FROM public.financial_transactions
      WHERE status = 'completed'
    ), 0),
    'pending_inflow', COALESCE((
      SELECT SUM(amount) FROM public.financial_transactions
      WHERE direction = 'inflow' AND status = 'pending'
    ), 0),
    'pending_outflow', COALESCE((
      SELECT SUM(amount) FROM public.financial_transactions
      WHERE direction = 'outflow' AND status = 'pending'
    ), 0),
    'total_outstanding_lavazam', COALESCE((
      SELECT SUM(d.amount_due) - COALESCE(SUM(
        (SELECT COALESCE(SUM(a.amount), 0)
         FROM public.financial_transaction_allocations a
         JOIN public.financial_transactions t ON t.id = a.transaction_id
         WHERE a.due_id = d.id AND t.status = 'completed')
      ), 0)
      FROM public.member_dues d
    ), 0),
    'total_lavazam_collected', COALESCE((
      SELECT SUM(amount) FROM public.financial_transactions
      WHERE transaction_type = 'lavazam' AND status = 'completed' AND direction = 'inflow'
    ), 0),
    'total_fund_collections', COALESCE((
      SELECT SUM(amount) FROM public.financial_transactions
      WHERE transaction_type = 'fund_collection' AND status = 'completed' AND direction = 'inflow'
    ), 0),
    'total_expenses', COALESCE((
      SELECT SUM(amount) FROM public.financial_transactions
      WHERE transaction_type = 'expense' AND status = 'completed' AND direction = 'outflow'
    ), 0),
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', fa.id,
        'name', fa.name,
        'account_type', fa.account_type,
        'balance', fa.opening_balance + COALESCE((
          SELECT SUM(CASE WHEN ft.direction = 'inflow' THEN ft.amount ELSE -ft.amount END)
          FROM public.financial_transactions ft
          WHERE ft.account_id = fa.id AND ft.status = 'completed'
        ), 0)
      ))
      FROM public.financial_accounts fa
      WHERE fa.is_active = true
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 9. RPC: get_member_dues_detail
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_member_dues_detail(
  p_member_id bigint,
  p_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_current_member_id bigint;
BEGIN
  v_current_member_id := public.get_current_member_id();

  -- Members can view their own dues, treasurers can view anyone's
  IF v_current_member_id != p_member_id AND NOT public.is_current_user_treasurer() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'member_id', p_member_id,
    'member_name', (SELECT full_name FROM public.members WHERE id = p_member_id),
    'dues', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'period_month', d.period_month,
          'amount_due', d.amount_due,
          'due_date', d.due_date,
          'amount_paid', COALESCE((
            SELECT SUM(a.amount)
            FROM public.financial_transaction_allocations a
            JOIN public.financial_transactions t ON t.id = a.transaction_id
            WHERE a.due_id = d.id AND t.status = 'completed'
          ), 0),
          'allocations', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'transaction_id', a.transaction_id,
                'amount', a.amount,
                'transaction_date', t.transaction_date,
                'payment_method', t.payment_method
              )
            )
            FROM public.financial_transaction_allocations a
            JOIN public.financial_transactions t ON t.id = a.transaction_id
            WHERE a.due_id = d.id AND t.status = 'completed'
          ), '[]'::jsonb)
        )
        ORDER BY d.period_month
      )
      FROM public.member_dues d
      WHERE d.member_id = p_member_id
        AND (p_year IS NULL OR EXTRACT(YEAR FROM d.period_month) = p_year)
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 10. AUDIT LOG TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_financial_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financial_audit_logs (
      transaction_id, action, old_data, new_data, performed_by
    ) VALUES (
      NEW.id,
      'update',
      to_jsonb(OLD),
      to_jsonb(NEW),
      public.get_current_member_id()
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.financial_audit_logs (
      transaction_id, action, old_data, performed_by
    ) VALUES (
      OLD.id,
      'delete',
      to_jsonb(OLD),
      public.get_current_member_id()
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger (drop first if exists for idempotency)
DROP TRIGGER IF EXISTS trg_financial_transactions_audit ON public.financial_transactions;
CREATE TRIGGER trg_financial_transactions_audit
  AFTER UPDATE OR DELETE ON public.financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_financial_audit_log();

-- ============================================================================
-- 11. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all financial tables (idempotent)
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transaction_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for clean re-application)
DO $$ 
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT policyname, tablename FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('financial_settings','financial_accounts','financial_funds','member_dues','financial_transactions','financial_transaction_allocations','financial_attachments','financial_audit_logs')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- financial_settings: treasurers read, nobody writes via RLS (only RPCs write)
CREATE POLICY "Treasurers can read settings"
  ON public.financial_settings FOR SELECT
  TO authenticated
  USING (public.is_current_user_treasurer());

-- Authenticated members can read settings (needed for lavazam amount display)
CREATE POLICY "Members can read settings"
  ON public.financial_settings FOR SELECT
  TO authenticated
  USING (true);

-- financial_accounts: treasurers full access, members read active accounts
CREATE POLICY "Treasurers manage accounts"
  ON public.financial_accounts FOR ALL
  TO authenticated
  USING (public.is_current_user_treasurer())
  WITH CHECK (public.is_current_user_treasurer());

CREATE POLICY "Members read active accounts"
  ON public.financial_accounts FOR SELECT
  TO authenticated
  USING (is_active = true);

-- financial_funds: treasurers full access, members read active funds
CREATE POLICY "Treasurers manage funds"
  ON public.financial_funds FOR ALL
  TO authenticated
  USING (public.is_current_user_treasurer())
  WITH CHECK (public.is_current_user_treasurer());

CREATE POLICY "Members read active funds"
  ON public.financial_funds FOR SELECT
  TO authenticated
  USING (is_active = true);

-- member_dues: treasurers see all, members see own
CREATE POLICY "Treasurers read all dues"
  ON public.member_dues FOR SELECT
  TO authenticated
  USING (public.is_current_user_treasurer());

CREATE POLICY "Members read own dues"
  ON public.member_dues FOR SELECT
  TO authenticated
  USING (member_id = public.get_current_member_id());

-- Treasurers can insert dues (for generate function fallback)
CREATE POLICY "Treasurers insert dues"
  ON public.member_dues FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_treasurer());

-- financial_transactions: treasurers see all, members see own
CREATE POLICY "Treasurers read all transactions"
  ON public.financial_transactions FOR SELECT
  TO authenticated
  USING (public.is_current_user_treasurer());

CREATE POLICY "Members read own transactions"
  ON public.financial_transactions FOR SELECT
  TO authenticated
  USING (member_id = public.get_current_member_id());

-- Treasurers can insert/update (for RPCs and direct ops)
CREATE POLICY "Treasurers insert transactions"
  ON public.financial_transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_treasurer());

CREATE POLICY "Treasurers update transactions"
  ON public.financial_transactions FOR UPDATE
  TO authenticated
  USING (public.is_current_user_treasurer())
  WITH CHECK (public.is_current_user_treasurer());

-- financial_transaction_allocations: treasurers see all, members see own
CREATE POLICY "Treasurers read all allocations"
  ON public.financial_transaction_allocations FOR SELECT
  TO authenticated
  USING (public.is_current_user_treasurer());

CREATE POLICY "Members read own allocations"
  ON public.financial_transaction_allocations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_transactions t
      WHERE t.id = transaction_id
      AND t.member_id = public.get_current_member_id()
    )
  );

CREATE POLICY "Treasurers insert allocations"
  ON public.financial_transaction_allocations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_treasurer());

-- financial_attachments: treasurers full access
CREATE POLICY "Treasurers manage attachments"
  ON public.financial_attachments FOR ALL
  TO authenticated
  USING (public.is_current_user_treasurer())
  WITH CHECK (public.is_current_user_treasurer());

CREATE POLICY "Members read own attachments"
  ON public.financial_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_transactions t
      WHERE t.id = transaction_id
      AND t.member_id = public.get_current_member_id()
    )
  );

-- financial_audit_logs: treasurers read only, nobody modifies via RLS
CREATE POLICY "Treasurers read audit logs"
  ON public.financial_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_current_user_treasurer());

-- Insert allowed for the trigger function (runs as SECURITY DEFINER)
CREATE POLICY "System insert audit logs"
  ON public.financial_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 12. GRANT EXECUTE ON RPCs
-- ============================================================================

REVOKE ALL ON FUNCTION public.generate_lavazam_dues(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_lavazam_dues(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.record_lavazam_payment(bigint, numeric, bigint, text, text, text, date, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_lavazam_payment(bigint, numeric, bigint, text, text, text, date, bigint[]) TO authenticated;

REVOKE ALL ON FUNCTION public.record_fund_collection(bigint, numeric, bigint, bigint, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_fund_collection(bigint, numeric, bigint, bigint, text, text, text, date) TO authenticated;

REVOKE ALL ON FUNCTION public.record_expense(numeric, bigint, text, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_expense(numeric, bigint, text, text, text, text, date) TO authenticated;

REVOKE ALL ON FUNCTION public.void_transaction(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_transaction(bigint, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_financial_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_summary() TO authenticated;

REVOKE ALL ON FUNCTION public.get_member_dues_detail(bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_dues_detail(bigint, integer) TO authenticated;

-- ============================================================================
-- 13. STORAGE BUCKET (run manually in Supabase dashboard if needed)
-- ============================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('financial-receipts', 'financial-receipts', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Treasurers upload receipts"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'financial-receipts' AND public.is_current_user_treasurer());
--
-- CREATE POLICY "Treasurers read receipts"
-- ON storage.objects FOR SELECT TO authenticated
-- USING (bucket_id = 'financial-receipts' AND public.is_current_user_treasurer());
--
-- CREATE POLICY "Members read own receipts"
-- ON storage.objects FOR SELECT TO authenticated
-- USING (bucket_id = 'financial-receipts' AND ...);
