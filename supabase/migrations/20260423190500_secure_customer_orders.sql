ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_token TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_customer_token
ON public.orders (customer_token);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create an order" ON public.orders;
CREATE POLICY "Anyone can create an order"
  ON public.orders FOR INSERT
  WITH CHECK (
    customer_token IS NOT NULL
    AND length(trim(customer_token)) > 0
    AND customer_token = COALESCE(current_setting('request.headers', true)::json->>'x-customer-token', '')
  );

DROP POLICY IF EXISTS "Clients can read their own orders" ON public.orders;
CREATE POLICY "Clients can read their own orders"
  ON public.orders FOR SELECT
  USING (
    customer_token = COALESCE(current_setting('request.headers', true)::json->>'x-customer-token', '')
  );

DROP POLICY IF EXISTS "Clients can rate their completed orders" ON public.orders;
CREATE POLICY "Clients can rate their completed orders"
  ON public.orders FOR UPDATE
  USING (
    auth.role() = 'anon'
    AND status = 'done'
    AND customer_token = COALESCE(current_setting('request.headers', true)::json->>'x-customer-token', '')
  )
  WITH CHECK (
    auth.role() = 'anon'
    AND status = 'done'
    AND customer_token = COALESCE(current_setting('request.headers', true)::json->>'x-customer-token', '')
    AND rating IN ('bad', 'ok', 'good')
  );
