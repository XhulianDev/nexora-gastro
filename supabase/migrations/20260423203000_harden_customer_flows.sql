ALTER TABLE public.waiter_calls
ADD COLUMN IF NOT EXISTS customer_token TEXT;

CREATE INDEX IF NOT EXISTS idx_waiter_calls_customer_token
ON public.waiter_calls (customer_token);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create an order" ON public.orders;
DROP POLICY IF EXISTS "Clients can read their own orders" ON public.orders;
DROP POLICY IF EXISTS "Clients can rate their completed orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create a waiter call" ON public.waiter_calls;
