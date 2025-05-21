/*
  # Create crypto alerts table

  1. New Tables
    - `crypto_alerts`
      - `id` (uuid, primary key)
      - `ticker` (text)
      - `price` (numeric)
      - `change_percent` (numeric)
      - `relative_volume` (numeric)
      - `alert_type` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `crypto_alerts` table
    - Add policy for authenticated users to read all alerts
    - Add policy for authenticated users to insert alerts
*/

CREATE TABLE IF NOT EXISTS crypto_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  price numeric NOT NULL,
  change_percent numeric NOT NULL,
  relative_volume numeric NOT NULL,
  alert_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crypto_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON crypto_alerts
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated insert"
  ON crypto_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);